/**
 * Ticket Rejection Endpoint
 * POST /api/projects/[projectId]/tickets/[ticketId]/reject
 * TM rejects a ticket with a reason
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { isMaintenanceTeam, getFacilityManagers } from '@/app/lib/maintenance-roles';
import { isValidTicketTransition } from '@/app/lib/maintenance-state-machine';
import { logTicketRejection } from '@/app/lib/activity-logger';
import { sendEmail } from '@/app/lib/email';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { projectId, ticketId } = await context.params;
    if (!projectId || !ticketId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const db = await getDb();
    const isTM = await isMaintenanceTeam(db, projectId, userEmail);
    if (!isTM) return NextResponse.json({ error: 'Only TM can reject tickets' }, { status: 403 });

    const body = await req.json();
    const { reason } = body || {};
    if (!reason || String(reason).trim().length === 0) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });

    const ticketsCol = db.collection('fm_tickets');
    const ticket = await ticketsCol.findOne({ _id: new ObjectId(ticketId), projectId });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const now = new Date().toISOString();

    const currentState = ticket.approvalStatus || 'PENDING_APPROVAL';
    const validation = isValidTicketTransition(currentState, 'REJECTED', 'TM');
    if (!validation.valid) return NextResponse.json({ error: validation.reason || 'Invalid transition' }, { status: 400 });

    // Update ticket status
    await ticketsCol.updateOne(
      { _id: new ObjectId(ticketId) }, 
      { 
        $set: { 
          approvalStatus: 'REJECTED',
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedBy: userEmail,
          rejectedAt: now,
          updatedAt: now 
        } 
      }
    );

    // Also update corresponding Work Order status to 'Rejected' if it exists
    const workOrdersCol = db.collection('fm_work_orders');
    await workOrdersCol.updateOne(
      { sourceTicketId: ticketId, projectId },
      { 
        $set: { 
          status: 'Rejected',
          updatedAt: now 
        } 
      }
    );

    // Log activity
    await logTicketRejection(db, projectId, ticketId, userEmail, reason);

    // Notify FM
    const fmEmails = await getFacilityManagers(db, projectId);
    for (const fmEmail of fmEmails) {
      try {
        const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
          <h3 style="color:#b91c1c">Ticket Rejected</h3>
          <p>Ticket <strong>${ticket.ticketCode}</strong> was rejected by the Maintenance Team.</p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>`;
        await sendEmail(fmEmail, `Ticket ${ticket.ticketCode} Rejected`, html);
      } catch (e) {
        console.error('Failed to send FM notification on reject', e);
      }
    }

    // Notify requester if contact is email
    const requesterEmail = ticket.requester?.contact;
    if (requesterEmail && requesterEmail.includes('@')) {
      try {
        const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
          <h3 style="color:#b91c1c">Your Ticket Was Rejected</h3>
          <p>Your ticket <strong>${ticket.ticketCode}</strong> was rejected by the Maintenance Team.</p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>`;
        await sendEmail(requesterEmail, `Your Ticket ${ticket.ticketCode} Was Rejected`, html);
      } catch (e) {
        console.error('Failed to send requester notification on reject', e);
      }
    }

    return NextResponse.json({ success: true, ticketId, approvalStatus: 'REJECTED' });
  } catch (error: any) {
    console.error('[Ticket Reject] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
