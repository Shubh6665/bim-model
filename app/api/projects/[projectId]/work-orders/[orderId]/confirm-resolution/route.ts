import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { isFacilityManager } from '@/app/lib/maintenance-roles';
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
    const isFM = await isFacilityManager(db, projectId, userEmail);
    if (!isFM) return NextResponse.json({ error: 'Only FM can confirm resolution' }, { status: 403 });

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    if (workOrder.status !== 'RESOLVED') {
      return NextResponse.json({ error: 'Work order must be RESOLVED to confirm' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await workOrdersCol.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          resolutionConfirmed: true,
          resolutionConfirmedBy: userEmail,
          resolutionConfirmedAt: now,
          updatedAt: now
        }
      }
    );

    // Log activity
    await logActivity({
      db,
      projectId,
      workOrderId: orderId,
      author: userEmail,
      authorRole: 'FM',
      action: 'FM_RESOLUTION_CONFIRMED',
      notes: 'Resolution confirmed by FM',
    } as any);

    // Notify Requester (User)
    // Need to fetch the ticket to get requester email
    if (workOrder.sourceTicketId) {
      const ticketsCol = db.collection('fm_tickets');
      const ticket = await ticketsCol.findOne({ _id: new ObjectId(workOrder.sourceTicketId) });
      
      if (ticket && ticket.requester && ticket.requester.contact) {
        const requesterEmail = ticket.requester.contact;
        try {
          const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
            <h3 style="color:#059669">Work Order Completed</h3>
            <p>Your request <strong>${workOrder.requestId || workOrder.id}</strong> has been successfully resolved and confirmed by the Facility Manager.</p>
            <p><strong>Description:</strong> ${workOrder.description}</p>
            <p>Thank you for using our maintenance system.</p>
          </div>`;
          await sendEmail(requesterEmail, `Work Order ${workOrder.requestId || workOrder.id} Completed`, html);
        } catch (e) {
          console.error('Failed to notify requester', e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Confirm Resolution] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
