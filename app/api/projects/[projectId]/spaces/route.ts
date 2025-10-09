import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// Space doc shape in DB
// {
//   _id: ObjectId,
//   projectId: string,
//   source: 'BIM_MODEL' | 'MANUAL',
//   name?: string,
//   level?: string,
//   building?: string,
//   spaceCode?: string,
//   description?: string,
//   area?: number,
//   dbId?: number | null,
//   footprint?: { points: { x: number; y: number; z: number }[]; z?: number; levelIndex?: number } | null,
//   conflictWithId?: string | null,
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
    const col = db.collection("fm_spaces");

    const spaces = await col.find({ projectId }).sort({ updatedAt: -1 }).toArray();
    // Normalize id
    const normalized = spaces.map((s: any) => ({ id: s._id?.toString?.() || s.id, ...s, _id: undefined }));
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[Spaces][GET] error', err);
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
    const col = db.collection("fm_spaces");

    // Support multiple modes for flexibility
    // 1) { action: 'upsertMany', spaces: Space[] }
    if (payload?.action === 'upsertMany' && Array.isArray(payload?.spaces)) {
      const results: any[] = [];
      for (const raw of payload.spaces) {
        // eslint-disable-next-line no-await-in-loop
        const res = await upsertOne(col, projectId, raw);
        results.push(res);
      }
      return NextResponse.json({ ok: true, count: results.length });
    }

    // 2) Upsert single space
    const saved = await upsertOne(col, projectId, payload);
    return NextResponse.json({ ok: true, space: saved });
  } catch (err) {
    console.error('[Spaces][POST] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function upsertOne(col: any, projectId: string, raw: any) {
  const now = new Date().toISOString();
  const doc = {
    projectId,
    source: raw?.source === 'BIM_MODEL' ? 'BIM_MODEL' : 'MANUAL',
    name: raw?.name || undefined,
    level: raw?.level || undefined,
    building: raw?.building || undefined,
    spaceCode: raw?.spaceCode || undefined,
    description: raw?.description || undefined,
    area: typeof raw?.area === 'number' ? raw.area : (raw?.area ? Number(raw.area) : undefined),
    dbId: raw?.dbId ?? null,
    footprint: raw?.footprint ? {
      points: Array.isArray(raw.footprint.points) ? raw.footprint.points.map((p: any) => ({ x: Number(p.x), y: Number(p.y), z: Number(p.z) })) : [],
      z: raw?.footprint?.z != null ? Number(raw.footprint.z) : undefined,
      levelIndex: raw?.footprint?.levelIndex != null ? Number(raw.footprint.levelIndex) : undefined,
    } : null,
    conflictWithId: raw?.conflictWithId || null,
    updatedAt: now,
  } as any;

  // Compute a stable key for BIM rooms to prevent duplication across re-extractions
  const isBIM = doc.source === 'BIM_MODEL';
  const filter = isBIM
    ? { projectId, source: 'BIM_MODEL', level: (doc.level || '').toLowerCase(), name: (doc.name || '').toLowerCase() }
    : (raw?.id ? { projectId, _id: safeObjectId(raw.id) } : null);

  if (filter) {
    const existing = await col.findOne(filter);
    if (existing) {
      await col.updateOne({ _id: existing._id }, { $set: doc });
      return { id: existing._id.toString(), ...existing, ...doc };
    }
  }

  // Insert new
  const insertDoc = { ...doc, createdAt: now };
  const ins = await col.insertOne(insertDoc);
  return { id: ins.insertedId.toString(), ...insertDoc };
}

function safeObjectId(id: string | undefined) {
  try { return id && ObjectId.createFromHexString(id); } catch { return undefined; }
}
