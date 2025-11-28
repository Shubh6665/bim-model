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
    // Try to get email from work order contact first, then fallback to ticket lookup
    let requesterEmail = workOrder.contact;

    if (!requesterEmail && workOrder.sourceTicketId) {
      try {
        const ticketsCol = db.collection('fm_tickets');
        const ticket = await ticketsCol.findOne({ _id: new ObjectId(workOrder.sourceTicketId) });
        if (ticket && ticket.requester && ticket.requester.contact) {
          requesterEmail = ticket.requester.contact;
        }
      } catch (err) {
        console.error('Error looking up ticket for email:', err);
      }
    }

    if (requesterEmail) {
      try {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #059669; margin: 0;">Resolution Confirmed</h2>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Hello,
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We are pleased to inform you that your maintenance request has been successfully resolved and verified by our Facility Management team.
            </p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #f3f4f6;">
              <p style="margin: 8px 0; color: #4b5563;"><strong>Request ID:</strong> <span style="color: #111827;">${workOrder.requestId || workOrder.id}</span></p>
              <p style="margin: 8px 0; color: #4b5563;"><strong>Description:</strong> <span style="color: #111827;">${workOrder.description}</span></p>
              <p style="margin: 8px 0; color: #4b5563;"><strong>Resolved Date:</strong> <span style="color: #111827;">${new Date().toLocaleDateString()}</span></p>
            </div>

            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              If you have any further questions or issues, please don't hesitate to submit a new request.
            </p>
            
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated message from the BIM Maintenance Platform.
              </p>
            </div>
          </div>
        `;
        
        await sendEmail(requesterEmail, `Resolution Confirmed: Request ${workOrder.requestId || workOrder.id}`, html);
        console.log(`Confirmation email sent to ${requesterEmail}`);
      } catch (e) {
        console.error('Failed to notify requester', e);
      }
    } else {
      console.warn('No requester email found for work order', orderId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Confirm Resolution] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
