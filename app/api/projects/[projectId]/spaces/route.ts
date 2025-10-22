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
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_spaces");

    // Optional filter by modelGuid to scope rooms to the current model
    const url = new URL(req.url);
    const modelGuid = url.searchParams.get('modelGuid') || undefined;
    const findFilter: any = { projectId };
    if (modelGuid) {
      findFilter.modelGuid = modelGuid;
      console.log(`[Spaces][GET] Filtering by modelGuid=${modelGuid}`);
    } else {
      console.log(`[Spaces][GET] No modelGuid filter - returning all spaces for project`);
    }

    const spaces = await col.find(findFilter).sort({ updatedAt: -1 }).toArray();
    console.log(`[Spaces][GET] Found ${spaces.length} spaces in DB matching filter`);
    
    // Normalize id
    const normalized = spaces.map((s: any) => ({ id: s._id?.toString?.() || s.id, ...s, _id: undefined }));
    
    // If modelGuid was provided but we got spaces without modelGuid, filter them out client-side as fallback
    const filtered = modelGuid 
      ? normalized.filter((s: any) => s.source !== 'BIM_MODEL' || s.modelGuid === modelGuid)
      : normalized;
    
    console.log(`[Spaces][GET] Returning ${filtered.length} spaces after filtering`);
    return NextResponse.json(filtered);
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
    modelGuid: raw?.modelGuid || undefined,
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
  let filter: any = null;
  if (isBIM) {
    const mg = doc.modelGuid;
    // Prefer exact match by modelGuid + dbId when available
    if (mg && doc.dbId != null) {
      filter = { projectId, source: 'BIM_MODEL', modelGuid: mg, dbId: doc.dbId };
    } else if (mg) {
      // Fallback: modelGuid + normalized identity fields
      filter = {
        projectId,
        source: 'BIM_MODEL',
        modelGuid: mg,
        level: (doc.level || '').toLowerCase(),
        name: (doc.name || '').toLowerCase(),
        ...(doc.spaceCode ? { spaceCode: String(doc.spaceCode) } : {})
      };
    } else {
      // Legacy fallback (no modelGuid provided)
      filter = { projectId, source: 'BIM_MODEL', level: (doc.level || '').toLowerCase(), name: (doc.name || '').toLowerCase() };
    }
  } else {
    filter = (raw?.id ? { projectId, _id: safeObjectId(raw.id) } : null);
  }

  if (filter) {
    let existing = await col.findOne(filter);
    // Backward-compat fallback to avoid duplicates when adopting modelGuid: try legacy matches
    if (!existing && isBIM && doc.modelGuid) {
      // 1) Legacy by dbId only
      if (doc.dbId != null) {
        existing = await col.findOne({ projectId, source: 'BIM_MODEL', dbId: doc.dbId });
      }
      // 2) Legacy by level+name
      if (!existing) {
        existing = await col.findOne({ projectId, source: 'BIM_MODEL', level: (doc.level || '').toLowerCase(), name: (doc.name || '').toLowerCase() });
      }
    }
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
