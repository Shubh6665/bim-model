import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";
import { sendEmail } from "@/app/lib/email";
import { generateTicketNotificationEmail } from "@/app/lib/email-templates";

// Ticket doc shape in DB
// {
//   _id: ObjectId,
//   projectId: string,
//   ticketCode: string,
//   qrCode: string,
//   requester: {
//     name: string,
//     surname: string,
//     contact: string
//   },
//   location: {
//     building?: string,
//     level?: string,
//     room?: string,
//     spaceCode?: string
//   },
//   intervention: {
//     discipline?: string,
//     category?: string,
//     item?: string,
//     itemDbId?: number,
//     descriptionShort?: string,
//     descriptionDetailed?: string,
//     attachments?: string[]
//   },
//   status: "Open" | "Planned" | "In Progress" | "Resolved",
//   assignedTo?: string,
//   createdAt: string,
//   updatedAt: string
// }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_tickets");

    const items = await col.find({ projectId }).sort({ createdAt: -1 }).toArray();
    
    // Normalize id
    const normalized = items.map((item: any) => ({ 
      id: item._id?.toString?.() || item.id, 
      ...item, 
      _id: undefined 
    }));
    
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[Tickets][GET] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const payload = await req.json();

    const db = await getDb();
    const col = db.collection("fm_tickets");

    const now = new Date().toISOString();
    
    // Generate ticket code if not provided
    const ticketCode = payload.ticketCode || `TKT-${Date.now()}`;
    
    // Generate QR data
    const qrData = `TICKET:${ticketCode}|REQUESTER:${payload.requester?.name || ''} ${payload.requester?.surname || ''}|CONTACT:${payload.requester?.contact || ''}|LOCATION:${payload.location?.building || ''}-${payload.location?.level || ''}-${payload.location?.room || ''}`;

    const doc = {
      projectId,
      ticketCode,
      qrCode: qrData,
      requester: {
        name: payload.requester?.name || '',
        surname: payload.requester?.surname || '',
        contact: payload.requester?.contact || ''
      },
      location: {
        building: payload.location?.building || '',
        level: payload.location?.level || '',
        room: payload.location?.room || '',
        spaceCode: payload.location?.spaceCode || ''
      },
      intervention: {
        discipline: payload.intervention?.discipline || '',
        category: payload.intervention?.category || '',
        item: payload.intervention?.item || '',
        itemDbId: payload.intervention?.itemDbId || null,
        descriptionShort: payload.intervention?.descriptionShort || '',
        descriptionDetailed: payload.intervention?.descriptionDetailed || '',
        attachments: Array.isArray(payload.intervention?.attachments) ? payload.intervention.attachments : []
      },
      status: payload.status || 'Open',
      assignedTo: payload.assignedTo || null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(doc);
    
    // Send notifications to Maintenance Team members
    try {
      await sendNotificationsToMaintenanceTeam(db, projectId, doc, payload.qrCodeDataUrl);
    } catch (notifError) {
      console.error('[Tickets][POST] Notification error (non-blocking):', notifError);
      // Don't fail the ticket creation if notifications fail
    }
    
    return NextResponse.json({ 
      ok: true, 
      ticket: { id: result.insertedId.toString(), ...doc } 
    });
  } catch (err) {
    console.error('[Tickets][POST] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const payload = await req.json();
    const { id, ...updates } = payload;
    
    if (!id) return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_tickets");

    const objectId = safeObjectId(id);
    if (!objectId) return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });

    const result = await col.updateOne(
      { _id: objectId, projectId },
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date().toISOString() 
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Tickets][PATCH] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_tickets");

    const objectId = safeObjectId(id);
    if (!objectId) return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });

    const result = await col.deleteOne({ _id: objectId, projectId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Tickets][DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function safeObjectId(id: string | undefined) {
  try { return id && ObjectId.createFromHexString(id); } catch { return undefined; }
}

// Helper function to send notifications to Maintenance Team members
async function sendNotificationsToMaintenanceTeam(
  db: any, 
  projectId: string, 
  ticket: any,
  qrCodeDataUrl?: string
) {
  try {
    // Get all accepted invites for this project with "Maintenance Team" role
    const invites = await db.collection('invites').find({
      projectId: new ObjectId(projectId),
      status: 'accepted',
      'invitee.role': { $regex: /maintenance\s*team/i }
    }).toArray();
    
    console.log(`[Tickets] Found ${invites.length} Maintenance Team members for project ${projectId}`);
    
    if (invites.length === 0) {
      console.log('[Tickets] No Maintenance Team members found, skipping notifications');
      return;
    }
    
    // Prepare email data
    const emailData = {
      ticketCode: ticket.ticketCode,
      requester: ticket.requester,
      location: ticket.location,
      intervention: ticket.intervention,
      createdAt: ticket.createdAt,
      qrCodeDataUrl
    };
    
    const emailHtml = generateTicketNotificationEmail(emailData);
    const emailSubject = `🔧 New Maintenance Ticket: ${ticket.ticketCode}`;
    
    // Send email to each Maintenance Team member
    const emailPromises = invites.map(async (invite: any) => {
      const email = invite.invitee?.email;
      if (!email) return;
      
      try {
        await sendEmail(email, emailSubject, emailHtml);
        console.log(`[Tickets] Email sent to ${email}`);
      } catch (emailError) {
        console.error(`[Tickets] Failed to send email to ${email}:`, emailError);
      }
    });
    
    // Create in-app notifications
    const notificationPromises = invites.map(async (invite: any) => {
      const email = invite.invitee?.email;
      if (!email) return;
      
      try {
        // Create notification in database
        await db.collection('notifications').insertOne({
          userEmail: email,
          type: 'maintenance_ticket',
          title: 'New Maintenance Ticket',
          message: `Ticket ${ticket.ticketCode}: ${ticket.intervention?.descriptionShort || 'New maintenance request'} at ${ticket.location?.building || ''} ${ticket.location?.level || ''} ${ticket.location?.room || ''}`.trim(),
          read: false,
          timestamp: Date.now(),
          meta: {
            ticketCode: ticket.ticketCode,
            projectId,
            ticketId: ticket._id?.toString(),
            discipline: ticket.intervention?.discipline,
            location: `${ticket.location?.building || ''} - ${ticket.location?.level || ''} - ${ticket.location?.room || ''}`.replace(/^-\s*|-\s*$/g, '').trim()
          },
          createdAt: new Date().toISOString()
        });
        console.log(`[Tickets] In-app notification created for ${email}`);
      } catch (notifError) {
        console.error(`[Tickets] Failed to create notification for ${email}:`, notifError);
      }
    });
    
    // Wait for all notifications to complete (but don't fail if some fail)
    await Promise.allSettled([...emailPromises, ...notificationPromises]);
    
    console.log('[Tickets] All notifications processed');
  } catch (error) {
    console.error('[Tickets] Error in sendNotificationsToMaintenanceTeam:', error);
    throw error;
  }
}
