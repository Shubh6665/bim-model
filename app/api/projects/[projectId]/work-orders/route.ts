import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

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

    const items = await col.find({ projectId }).sort({ createdAt: -1 }).toArray();
    
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
