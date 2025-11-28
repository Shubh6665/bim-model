/**
 * Work Order Status Update Endpoint
 * PATCH /api/projects/[projectId]/work-orders/[orderId]/status
 * TM or Maintainer can update status (PLANNED/IN_PROGRESS/CLOSE)
 * Enforces state machine and logs activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { canPerformMaintenance, getUserMaintenanceRole, getMaintenanceTeamMembers } from '@/app/lib/maintenance-roles';
import { isValidWorkOrderTransition } from '@/app/lib/maintenance-state-machine';
import { logStatusChange } from '@/app/lib/activity-logger';
import { sendEmail } from '@/app/lib/email';

export async function PATCH(
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
    const canDo = await canPerformMaintenance(db, projectId, userEmail);
    if (!canDo) return NextResponse.json({ error: 'Only TM or Maintainer can perform maintenance updates' }, { status: 403 });

    const body = await req.json();
    const { newStatus, note, attachments } = body || {};
    if (!newStatus) return NextResponse.json({ error: 'newStatus is required' }, { status: 400 });

    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'CLOSE'];
    if (!validStatuses.includes(newStatus)) return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const currentState = workOrder.status || 'OPEN';
    const userRole = await getUserMaintenanceRole(db, projectId, userEmail);
    const validation = isValidWorkOrderTransition(currentState, newStatus as any, userRole as any);
    if (!validation.valid) return NextResponse.json({ error: validation.reason || 'Invalid transition' }, { status: 400 });

    const now = new Date().toISOString();

    // Update maintenanceCycles depending on transition
    const cycles = Array.isArray(workOrder.maintenanceCycles) ? workOrder.maintenanceCycles : [];
    let currentCycleNumber = workOrder.currentCycle || 0;

    if (newStatus === 'PLANNED') {
      // start a new cycle
      const newCycleNum = cycles.length + 1;
      const newCycle = {
        cycleNumber: newCycleNum,
        startedBy: userEmail,
        startedByRole: userRole,
        startedAt: now,
        plannedAt: now,
        plannedBy: userEmail,
        inProgressAt: undefined,
        inProgressBy: undefined,
        closedAt: undefined,
        closedBy: undefined,
        notes: [],
      };
      cycles.push(newCycle);
      currentCycleNumber = newCycleNum;
    } else if (newStatus === 'IN_PROGRESS') {
      // mark inProgressAt on current cycle
      const idx = cycles.length - 1;
      if (idx < 0) {
        return NextResponse.json({ error: 'No active cycle found. Set PLANNED first.' }, { status: 400 });
      }
      cycles[idx].inProgressAt = now;
      cycles[idx].inProgressBy = userEmail;
    } else if (newStatus === 'CLOSE') {
      const idx = cycles.length - 1;
      if (idx < 0) {
        return NextResponse.json({ error: 'No active cycle found. Set PLANNED first.' }, { status: 400 });
      }
      cycles[idx].closedAt = now;
      cycles[idx].closedBy = userEmail;

      // calculate duration minutes between plannedAt and closedAt
      const plannedAt = new Date(cycles[idx].plannedAt || cycles[idx].startedAt).getTime();
      const closedAt = new Date(now).getTime();
      const durationMinutes = Math.round((closedAt - plannedAt) / (1000 * 60));
      cycles[idx].duration = durationMinutes;

      // append note if provided
      if (note) {
        cycles[idx].notes.push({ id: `${Date.now()}`, author: userEmail, authorRole: userRole, text: note, timestamp: now, attachments: attachments || [] });
      }

      // compute totalTimeSpent
      const totalTimeSpent = cycles.reduce((sum: number, c: any) => sum + (Number(c.duration || 0)), 0);

      await workOrdersCol.updateOne({ _id: new ObjectId(orderId) }, { $set: { maintenanceCycles: cycles, currentCycle: currentCycleNumber, status: newStatus, totalTimeSpent, updatedAt: now } });

      await logStatusChange(db, projectId, orderId, userEmail, userRole as any, currentState, newStatus, note);

      // Notify TM when maintainer marks as CLOSE
      try {
        const tmMembers = await getMaintenanceTeamMembers(db, projectId);
        for (const tmEmail of tmMembers) {
          const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
            <h3 style="color:#f59e0b">Work Order Closed by Maintainer</h3>
            <p>Work order <strong>${workOrder.requestId || workOrder.id}</strong> has been marked as CLOSE by ${userEmail}.</p>
            <p>Ready for your review and resolution.</p>
          </div>`;
          await sendEmail(tmEmail, `Work Order ${workOrder.requestId || workOrder.id} Ready for Review`, html).catch(() => {});
        }
      } catch (e) {
        console.error('Failed to notify TM on CLOSE', e);
      }

      return NextResponse.json({ success: true, status: newStatus, totalTimeSpent });
    }

    // For PLANNED and IN_PROGRESS updates (fallthrough)
    await workOrdersCol.updateOne({ _id: new ObjectId(orderId) }, { $set: { maintenanceCycles: cycles, currentCycle: currentCycleNumber, status: newStatus, updatedAt: now } });

    await logStatusChange(db, projectId, orderId, userEmail, userRole as any, currentState, newStatus, note);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error('[WorkOrder Status] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
