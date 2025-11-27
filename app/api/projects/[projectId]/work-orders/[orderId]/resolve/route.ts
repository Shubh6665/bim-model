/**
 * TM Resolve Endpoint
 * POST /api/projects/[projectId]/work-orders/[orderId]/resolve
 * TM marks a work order as RESOLVED (final operational closure)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { canResolveTicket, getMaintenanceTeamMembers } from '@/app/lib/maintenance-roles';
import { isValidWorkOrderTransition } from '@/app/lib/maintenance-state-machine';
import { logActivity, logStatusChange } from '@/app/lib/activity-logger';
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
    const canResolve = await canResolveTicket(db, projectId, userEmail);
    if (!canResolve) return NextResponse.json({ error: 'Only TM can resolve work orders' }, { status: 403 });

    // Get TM Closing Notes from request body
    const body = await req.json().catch(() => ({}));
    const { tmClosingNotes } = body;
    
    if (!tmClosingNotes || String(tmClosingNotes).trim().length === 0) {
      return NextResponse.json({ error: 'TM Closing Notes are required' }, { status: 400 });
    }

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const currentState = workOrder.status || 'OPEN';
    const validation = isValidWorkOrderTransition(currentState, 'RESOLVED', 'TM');
    if (!validation.valid) return NextResponse.json({ error: validation.reason || 'Invalid transition' }, { status: 400 });

    const now = new Date().toISOString();

    await workOrdersCol.updateOne(
      { _id: new ObjectId(orderId) }, 
      { 
        $set: { 
          status: 'RESOLVED', 
          resolvedBy: userEmail, 
          resolvedAt: now, 
          updatedAt: now,
          tmClosingNotes: String(tmClosingNotes).trim()
        } 
      }
    );

    // compute totalTimeToResolve (from work order creation time to resolvedAt)
    let totalTimeToResolve = null;
    if (workOrder.createdAt) {
      const createdMs = new Date(workOrder.createdAt).getTime();
      const resolvedMs = new Date(now).getTime();
      totalTimeToResolve = Math.round((resolvedMs - createdMs) / (1000 * 60));
      await workOrdersCol.updateOne({ _id: new ObjectId(orderId) }, { $set: { totalTimeToResolve } });
    }

    // log activity
    await logStatusChange(db, projectId, orderId, userEmail, 'TM', currentState, 'RESOLVED');
    await logActivity({ db, projectId, workOrderId: orderId, author: userEmail, authorRole: 'TM', action: 'TM_RESOLVED', notes: `Resolved by ${userEmail}` } as any);

    // notify facility managers
    const fmEmails = await getMaintenanceTeamMembers(db, projectId); // notify TM members as well
    for (const to of fmEmails) {
      try {
        const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
          <h3 style="color:#064e3b">Work Order Resolved</h3>
          <p>Work order <strong>${workOrder.requestId || workOrder.id}</strong> was resolved by the TM.</p>
        </div>`;
        await sendEmail(to, `Work Order ${workOrder.requestId || workOrder.id} Resolved`, html);
      } catch (e) {
        console.error('Failed to notify on resolve', e);
      }
    }

    return NextResponse.json({ success: true, status: 'RESOLVED', totalTimeToResolve });
  } catch (error: any) {
    console.error('[WorkOrder Resolve] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
