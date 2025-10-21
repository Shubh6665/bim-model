import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// ScheduledMaintenance doc shape in DB
// {
//   _id: ObjectId,
//   projectId: string,
//   discipline: string,
//   category: string,
//   code: string,
//   asset: string,
//   tasks: string[],
//   frequency: number,
//   timeHours: number,
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
    const col = db.collection("fm_scheduled_maintenance");

    const items = await col.find({ projectId }).sort({ updatedAt: -1 }).toArray();
    // Normalize id
    const normalized = items.map((item: any) => ({ 
      id: item._id?.toString?.() || item.id, 
      ...item, 
      _id: undefined 
    }));
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[ScheduledMaintenance][GET] error', err);
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
    const col = db.collection("fm_scheduled_maintenance");

    const now = new Date().toISOString();
    const doc = {
      projectId,
      discipline: payload?.discipline || '',
      category: payload?.category || '',
      code: payload?.code || '',
      asset: payload?.asset || '',
      tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
      frequency: typeof payload?.frequency === 'number' ? payload.frequency : 0,
      timeHours: typeof payload?.timeHours === 'number' ? payload.timeHours : 0,
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(doc);
    return NextResponse.json({ 
      ok: true, 
      item: { id: result.insertedId.toString(), ...doc } 
    });
  } catch (err) {
    console.error('[ScheduledMaintenance][POST] error', err);
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
    
    if (!id) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_scheduled_maintenance");

    const objectId = safeObjectId(id);
    if (!objectId) return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });

    const result = await col.deleteOne({ _id: objectId, projectId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ScheduledMaintenance][DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function safeObjectId(id: string | undefined) {
  try { return id && ObjectId.createFromHexString(id); } catch { return undefined; }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const payload = await req.json().catch(() => ({}));

    const objectId = safeObjectId(id || payload?.id);
    if (!objectId) return NextResponse.json({ error: 'Valid id is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_scheduled_maintenance");

    const now = new Date().toISOString();
    const $set: any = {
      updatedAt: now,
    };
    if (payload?.discipline !== undefined) $set.discipline = payload.discipline;
    if (payload?.category !== undefined) $set.category = payload.category;
    if (payload?.code !== undefined) $set.code = payload.code;
    if (payload?.asset !== undefined) $set.asset = payload.asset; // string or string[]
    if (payload?.tasks !== undefined) $set.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    if (payload?.frequency !== undefined) $set.frequency = Number(payload.frequency) || 0;
    if (payload?.timeHours !== undefined) $set.timeHours = Number(payload.timeHours) || 0;

    const result = await col.findOneAndUpdate(
      { _id: objectId, projectId },
      { $set },
      { returnDocument: 'after' as any }
    );

    const doc: any = result?.value;
    if (!doc) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    return NextResponse.json({ ok: true, item: { id: doc._id?.toString?.() || id, ...doc, _id: undefined } });
  } catch (err) {
    console.error('[ScheduledMaintenance][PUT] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
