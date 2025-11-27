/**
 * Ticket Approval Endpoint
 * POST /api/projects/[projectId]/tickets/[ticketId]/approve
 * 
 * TM approves a ticket and sets Priority + Type
 * Creates corresponding work order
 * Sends notifications to FM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { isMaintenanceTeam } from '@/app/lib/maintenance-roles';
import { isValidTicketTransition } from '@/app/lib/maintenance-state-machine';
import { logTicketApproval } from '@/app/lib/activity-logger';
import { getFacilityManagers } from '@/app/lib/maintenance-roles';
import { sendEmail } from '@/app/lib/email';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; ticketId: string }> }
) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { projectId, ticketId } = await context.params;

    if (!projectId || !ticketId) {
      return NextResponse.json(
        { error: 'Missing projectId or ticketId' },
        { status: 400 }
      );
    }

    // 2. Authorization - Check if user is TM
    const db = await getDb();
    const isTM = await isMaintenanceTeam(db, projectId, userEmail);

    if (!isTM) {
      return NextResponse.json(
        { error: 'Only Maintenance Team members can approve tickets' },
        { status: 403 }
      );
    }

    // 3. Get request body
    const body = await req.json();
    const { priority, type } = body;

    // Validate required fields
    if (!priority || !type) {
      return NextResponse.json(
        { error: 'Priority and Type are required for approval' },
        { status: 400 }
      );
    }

    // Validate enum values
    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
    const validTypes = [
      'Corrective',
      'Urgent',
      'Preventive',
      'Safety',
      'Regulatory',
      'Inspection',
      'Cleaning',
    ];

    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Fetch ticket
    const ticketsCol = db.collection('fm_tickets');
    const ticket = await ticketsCol.findOne({
      _id: new ObjectId(ticketId),
      projectId,
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // 5. Validate state transition
    const currentState = ticket.approvalStatus || 'PENDING_APPROVAL';
    const validation = isValidTicketTransition(currentState, 'APPROVED', 'TM');

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason || 'Invalid state transition' },
        { status: 400 }
      );
    }

    // 6. Update ticket
    const now = new Date().toISOString();
    const updateResult = await ticketsCol.updateOne(
      { _id: new ObjectId(ticketId) },
      {
        $set: {
          approvalStatus: 'APPROVED',
          approvedBy: userEmail,
          approvedAt: now,
          priority,
          type,
          status: 'APPROVED',
          updatedAt: now,
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }

    // 7. Create Work Order
    const workOrdersCol = db.collection('fm_work_orders');
    
    const locationStr = [
      ticket.location?.building,
      ticket.location?.level,
      ticket.location?.room,
    ]
      .filter(Boolean)
      .join(' - ');

    const workOrder = {
      projectId,
      requestId: ticket.ticketCode,
      requester: `${ticket.requester?.name || ''} ${ticket.requester?.surname || ''}`.trim(),
      contact: ticket.requester?.contact || '',
      location: locationStr,
      interventionDetails: ticket.intervention?.descriptionDetailed || '',
      discipline: ticket.intervention?.discipline || '',
      category: ticket.intervention?.category || '',
      description: ticket.intervention?.descriptionShort || '',
      attachments: ticket.intervention?.attachments || [],
      asset: ticket.intervention?.item || '',
      priority,
      type,
      status: 'OPEN',
      sourceTicketId: ticketId,
      maintenanceCycles: [],
      currentCycle: 0,
      createdAt: now,
      updatedAt: now,
    };

    const workOrderResult = await workOrdersCol.insertOne(workOrder);

    // 8. Log activity
    await logTicketApproval(
      db,
      projectId,
      ticketId,
      userEmail,
      priority,
      type
    );

    // 9. Send notification to FM
    const fmEmails = await getFacilityManagers(db, projectId);
    
    for (const fmEmail of fmEmails) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">✅ Ticket Approved</h2>
            <p><strong>Ticket:</strong> ${ticket.ticketCode}</p>
            <p><strong>Priority:</strong> <span style="color: ${priority === 'Critical' ? '#dc2626' : priority === 'High' ? '#ea580c' : priority === 'Medium' ? '#ca8a04' : '#16a34a'};">${priority}</span></p>
            <p><strong>Type:</strong> ${type}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <p><strong>Location:</strong> ${locationStr}</p>
            <p><strong>Description:</strong> ${ticket.intervention?.descriptionShort || 'N/A'}</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              A work order has been created and is now ready for maintenance planning.
            </p>
          </div>
        `;
        
        await sendEmail(
          fmEmail,
          `Ticket ${ticket.ticketCode} Approved`,
          emailHtml
        );
      } catch (emailError) {
        console.error(`Failed to send email to ${fmEmail}:`, emailError);
      }
    }

    // 10. Send notification to original requester
    const requesterEmail = ticket.requester?.contact;
    if (requesterEmail && requesterEmail.includes('@')) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">✅ Your Request Has Been Approved</h2>
            <p>Dear ${ticket.requester?.name || 'User'},</p>
            <p>Your maintenance request <strong>${ticket.ticketCode}</strong> has been approved and will be addressed with <strong>${priority}</strong> priority.</p>
            <p>Our maintenance team will begin work on this shortly.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              You will receive updates as work progresses.
            </p>
          </div>
        `;
        
        await sendEmail(
          requesterEmail,
          `Your Ticket ${ticket.ticketCode} Has Been Approved`,
          emailHtml
        );
      } catch (emailError) {
        console.error(`Failed to send email to requester:`, emailError);
      }
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticketId,
        approvalStatus: 'APPROVED',
        priority,
        type,
        approvedBy: userEmail,
        approvedAt: now,
      },
      workOrder: {
        id: workOrderResult.insertedId.toString(),
        ...workOrder,
      },
    });
  } catch (error: any) {
    console.error('[Ticket Approval] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
