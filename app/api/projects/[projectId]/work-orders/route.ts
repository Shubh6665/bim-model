import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";
import { sendEmail } from "@/app/lib/email";

// WorkOrder doc shape in DB
// {
//   _id: ObjectId,
//   projectId: string,
//   requestId?: string,
//   requester?: string,
//   contact?: string,
//   location?: string,
//   interventionDetails?: string,
//   discipline?: string,
//   category?: string,
//   description?: string,
//   attachments?: string[],
//   asset?: string,
//   responsibleTechnician?: string,
//   company?: string,
//   status: "Open" | "Planned" | "In Progress" | "Resolved",
//   sourceTicketId?: string,
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
    const col = db.collection("fm_work_orders");

    // Use aggregation to join with tickets and get the real-time approval status
    // This ensures that if a ticket is rejected, the work order reflects it even if the work order status wasn't updated
    const items = await col.aggregate([
      { $match: { projectId } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'fm_tickets',
          let: { tid: '$sourceTicketId' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$tid'] } } },
            { $project: { approvalStatus: 1 } }
          ],
          as: 'ticket_info'
        }
      },
      {
        $addFields: {
          ticketStatus: { $arrayElemAt: ['$ticket_info.approvalStatus', 0] }
        }
      },
      { $project: { ticket_info: 0 } }
    ]).toArray();
    
    // Normalize id
    const normalized = items.map((item: any) => ({ 
      id: item._id?.toString?.() || item.id, 
      ...item, 
      _id: undefined 
    }));
    
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[WorkOrders][GET] error', err);
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
    const col = db.collection("fm_work_orders");

    const now = new Date().toISOString();

    const doc = {
      projectId,
      requestId: payload.requestId || '',
      requester: payload.requester || '',
      contact: payload.contact || '',
      location: payload.location || '',
      interventionDetails: payload.interventionDetails || '',
      discipline: payload.discipline || '',
      category: payload.category || '',
      description: payload.description || '',
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      asset: payload.asset || '',
      responsibleTechnician: payload.responsibleTechnician || '',
      company: payload.company || '',
      status: payload.status || 'Open',
      sourceTicketId: payload.sourceTicketId || null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(doc);
    
    return NextResponse.json({ 
      ok: true, 
      workOrder: { id: result.insertedId.toString(), ...doc } 
    });
  } catch (err) {
    console.error('[WorkOrders][POST] error', err);
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
    
    if (!id) return NextResponse.json({ error: 'Work Order ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_work_orders");

    const objectId = safeObjectId(id);
    if (!objectId) return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });

    // Get the work order before update
    const workOrder = await col.findOne({ _id: objectId, projectId });

    // Determine if we're transitioning TO Resolved status
    const isTransitioningToResolved = updates.status === 'Resolved' && workOrder?.status !== 'Resolved';

    // If transitioning to Resolved, set resolvedAt timestamp
    if (isTransitioningToResolved && !updates.resolvedAt) {
      updates.resolvedAt = new Date().toISOString();
    }

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
      return NextResponse.json({ error: 'Work Order not found' }, { status: 404 });
    }

    // If transitioning to Resolved, update linked tickets/service-requests
    if (isTransitioningToResolved && workOrder?.sourceTicketId) {
      try {
        const ticketsCol = db.collection("fm_tickets");
        await ticketsCol.updateOne(
          { _id: safeObjectId(workOrder.sourceTicketId) || workOrder.sourceTicketId, projectId },
          { $set: { status: 'Resolved', resolvedAt: updates.resolvedAt, updatedAt: new Date().toISOString() } }
        );
        console.log(`[WorkOrders] Linked ticket ${workOrder.sourceTicketId} marked as Resolved`);
      } catch (ticketErr) {
        console.error('[WorkOrders] Error updating linked ticket:', ticketErr);
      }
    }

    // Send notifications - only when transitioning to Resolved
    try {
      if (isTransitioningToResolved && workOrder?.contact) {
        try {
          sendEmail(
            workOrder.contact,
            `Work Order ${workOrder.requestId} - Resolved`,
            `
              <h2>Work Order Resolved</h2>
              <p>Your maintenance request <strong>${workOrder.requestId}</strong> has been resolved.</p>
              <p><strong>Description:</strong> ${workOrder.description || 'N/A'}</p>
              <p><strong>Technician:</strong> ${updates.responsibleTechnician || workOrder.responsibleTechnician || 'N/A'}</p>
              <p><strong>Resolved At:</strong> ${updates.resolvedAt ? new Date(updates.resolvedAt).toLocaleString() : 'N/A'}</p>
              <p>Thank you for your patience.</p>
            `
          ).then(() => console.log(`[WorkOrders] Requester notified (async): ${workOrder.contact}`))
            .catch(notifError => console.error('[WorkOrders] Notification error (async):', notifError));
        } catch (notifError) {
          console.error('[WorkOrders] Notification scheduling error (non-blocking):', notifError);
        }
      }
    } catch (notifError) {
      console.error('[WorkOrders] Notification error (non-blocking):', notifError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WorkOrders][PATCH] error', err);
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
    
    if (!id) return NextResponse.json({ error: 'Work Order ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_work_orders");

    const objectId = safeObjectId(id);
    if (!objectId) return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });

    const result = await col.deleteOne({ _id: objectId, projectId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Work Order not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WorkOrders][DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function safeObjectId(id: string | undefined) {
  try { return id && ObjectId.createFromHexString(id); } catch { return undefined; }
}
