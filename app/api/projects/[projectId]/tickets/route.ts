import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

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
