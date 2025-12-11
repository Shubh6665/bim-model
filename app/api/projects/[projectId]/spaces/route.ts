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
      // Equivalence-aware filtering: accept composite guid|urn or plain guid
      const left = String(modelGuid).split('|')[0];
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      findFilter.$or = [
        { modelGuid: modelGuid },
        { modelGuid: left },
        { modelGuid: { $regex: `^${escape(left)}\\|` } }
      ];
      console.log(`[Spaces][GET] Filtering by modelGuid (equivalence-aware) modelGuid=${modelGuid} left=${left}`);
    } else {
      console.log(`[Spaces][GET] No modelGuid filter - returning all spaces for project`);
    }

    const spaces = await col.find(findFilter).sort({ updatedAt: -1 }).toArray();
    console.log(`[Spaces][GET] Found ${spaces.length} spaces in DB matching filter`);
    
    // Normalize id
    const normalized = spaces.map((s: any) => ({ id: s._id?.toString?.() || s.id, ...s, _id: undefined }));
    
    // We rely on the DB query to filter by modelGuid correctly (including equivalence checks).
    // No need for strict equality check here which would break guid vs guid|urn matching.
    
    console.log(`[Spaces][GET] Returning ${normalized.length} spaces`);
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

function polygonArea2D(points: { x: number; y: number }[]): number {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    sum += (a.x * b.y) - (b.x * a.y);
  }
  return Math.abs(sum) * 0.5;
}

function polygonPerimeter2D(points: { x: number; y: number }[]): number {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    sum += Math.hypot(dx, dy);
  }
  return sum;
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
    perimeter: typeof raw?.perimeter === 'number' ? raw.perimeter : (raw?.perimeter ? Number(raw.perimeter) : undefined),
    dbId: raw?.dbId ?? null,
    footprint: raw?.footprint ? {
      points: Array.isArray(raw.footprint.points) ? raw.footprint.points.map((p: any) => ({ x: Number(p.x), y: Number(p.y), z: Number(p.z) })) : [],
      z: raw?.footprint?.z != null ? Number(raw.footprint.z) : undefined,
      levelIndex: raw?.footprint?.levelIndex != null ? Number(raw.footprint.levelIndex) : undefined,
    } : null,
    conflictWithId: raw?.conflictWithId || null,
    updatedAt: now,
  } as any;

  if (doc?.footprint?.points && Array.isArray(doc.footprint.points) && doc.footprint.points.length >= 3) {
    try {
      const pts2d = doc.footprint.points.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
      const a = polygonArea2D(pts2d);
      const per = polygonPerimeter2D(pts2d);
      doc.area = a;
      doc.perimeter = per;
    } catch {}
  }

  // For BIM extraction upserts, preserve user-edited fields (building, description)
  // Only update BIM-specific fields (name, level, area, spaceCode, dbId, footprint)
  const docForUpdate = doc.source === 'BIM_MODEL' ? {
    projectId: doc.projectId,
    source: doc.source,
    modelGuid: doc.modelGuid,
    name: doc.name,
    level: doc.level,
    spaceCode: doc.spaceCode,
    area: doc.area,
    perimeter: doc.perimeter,
    dbId: doc.dbId,
    footprint: doc.footprint,
    conflictWithId: doc.conflictWithId,
    updatedAt: doc.updatedAt,
    // Note: building and description are NOT updated here - they are preserved from existing record
  } : doc;

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
      await col.updateOne({ _id: existing._id }, { $set: docForUpdate });
      return { id: existing._id.toString(), ...existing, ...docForUpdate };
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
