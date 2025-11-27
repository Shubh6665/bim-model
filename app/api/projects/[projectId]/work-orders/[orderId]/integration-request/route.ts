/**
 * FM Integration Request Endpoint
 * POST /api/projects/[projectId]/work-orders/[orderId]/integration-request
 * FM requests integration after TM resolved - reopens the work order
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { canRequestIntegration, getMaintenanceTeamMembers } from '@/app/lib/maintenance-roles';
import { isValidWorkOrderTransition } from '@/app/lib/maintenance-state-machine';
import { logActivity } from '@/app/lib/activity-logger';
import { sendEmail } from '@/app/lib/email';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { projectId, orderId } = await context.params;
    if (!projectId || !orderId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const db = await getDb();
    const canFM = await canRequestIntegration(db, projectId, userEmail);
    if (!canFM) return NextResponse.json({ error: 'Only FM can request integration' }, { status: 403 });

    const body = await req.json();
    const { reason } = body || {};
    if (!reason || String(reason).trim().length === 0) return NextResponse.json({ error: 'Integration reason required' }, { status: 400 });

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const currentState = workOrder.status || 'OPEN';
    const validation = isValidWorkOrderTransition(currentState, 'OPEN', 'FM');
    if (!validation.valid) return NextResponse.json({ error: validation.reason || 'Cannot request integration in current state' }, { status: 400 });

    const now = new Date().toISOString();

    // Mark integration requested and reopen (status -> OPEN)
    const newCycleNumber = Array.isArray(workOrder.maintenanceCycles) ? workOrder.maintenanceCycles.length + 1 : 1;

    await workOrdersCol.updateOne({ _id: new ObjectId(orderId) }, {
      $set: {
        status: 'OPEN',
        integrationRequested: true,
        integrationRequestedBy: userEmail,
        integrationRequestedAt: now,
        integrationReason: reason,
        currentCycle: newCycleNumber,
        updatedAt: now
      }
    });

    // log activity
    await logActivity({ db, projectId, workOrderId: orderId, author: userEmail, authorRole: 'FM', action: 'FM_INTEGRATION_REQUESTED', notes: reason } as any);

    // Notify maintenance team
    const tmEmails = await getMaintenanceTeamMembers(db, projectId);
    for (const to of tmEmails) {
      try {
        const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
          <h3 style="color:#b45309">Integration Requested</h3>
          <p>FM ${userEmail} requested integration for work order <strong>${workOrder.requestId || workOrder.id}</strong>.</p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>`;
        await sendEmail(to, `Integration Request for ${workOrder.requestId || workOrder.id}`, html);
      } catch (e) {
        console.error('Failed to notify TM about integration request', e);
      }
    }

    return NextResponse.json({ success: true, reopened: true, integrationRequested: true });
  } catch (error: any) {
    console.error('[Integration Request] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
