import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// Asset doc shape in DB
// {
//   _id: ObjectId,
//   projectId: string,
//   modelGuid?: string, // BIM model GUID for scoping BIM assets to a specific model
//   source: 'BIM_MODEL' | 'MANUAL',
//   assetCode?: string,
//   assetName?: string,
//   category?: string,
//   type?: string,
//   brand?: string,
//   model?: string,
//   serialNumber?: string,
//   installationDate?: string,
//   assetClassification?: 'STRUCTURAL' | 'ARCHITECTURAL' | 'MEP' | 'FURNITURE' | 'EQUIPMENT' | 'OTHER',
//   material?: string,
//   dimensions?: string,
//   weight?: string,
//   capacity?: string,
//   powerRating?: string,
//   manuals?: string,
//   warranties?: string,
//   certifications?: string,
//   condition?: string,
//   serviceDate?: string,
//   expectedLife?: string,
//   maintenanceSchedule?: string,
//   lastService?: string,
//   nextService?: string,
//   purchaseCost?: string,
//   maintenanceCost?: string,
//   regulations?: string,
//   safetyNotes?: string,
//   parentAsset?: string,
//   location?: string,
//   suppliers?: string,
//   description?: string,
//   dbId?: number | null,
//   placeholderX?: number,
//   placeholderY?: number,
//   placeholderZ?: number,
//   placeholderShape?: 'cube' | 'sphere',
//   placeholderSize?: number,
//   conflictWithId?: string,
//   linkedAssetId?: string,
//   hidden?: boolean,
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
    const col = db.collection("fm_assets");

    // Optional filter to scope BIM assets to a specific model
    const url = new URL(_req.url);
    const rawModelGuid = url.searchParams.get('modelGuid') || undefined;

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let query: any = { projectId };
    if (rawModelGuid) {
      const mg = String(rawModelGuid || '').trim();
      if (!mg) {
        query = { projectId };
      } else {
        // Build a robust BIM filter that matches:
        // - exact modelGuid (e.g., 'guid|urn')
        // - left-part guid/id only (e.g., 'guid' or '1')
        // - any stored value ending with '|urn'
        const parts = mg.split('|');
        const left = parts[0] || '';
        const right = parts.length > 1 ? parts.slice(1).join('|') : '';

        const orVariants: any[] = [ { modelGuid: mg } ];
        if (left) orVariants.push({ modelGuid: left });
        if (right) orVariants.push({ modelGuid: { $regex: `\\|${escapeRegExp(right)}$` } });

        const bimFilter = { $and: [ { source: 'BIM_MODEL' }, { $or: orVariants } ] };
        query = { projectId, $or: [ { source: 'MANUAL' }, bimFilter ] };
      }
    }

    const assets = await col.find(query).sort({ updatedAt: -1 }).toArray();
    // Normalize id
    const normalized = assets.map((asset: any) => ({ 
      id: asset._id?.toString?.() || asset.id, 
      ...asset, 
      _id: undefined 
    }));
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[Assets][GET] error', err);
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
    const col = db.collection("fm_assets");

    // 0) { action: 'replaceForModel', modelGuid: string, assets: Asset[] }
    // Delete all BIM_MODEL assets for this project+modelGuid, then upsert provided assets
    if (payload?.action === 'replaceForModel') {
      const modelGuid = payload?.modelGuid as string | undefined;
      const assets = Array.isArray(payload?.assets) ? payload.assets : [];
      if (!modelGuid) {
        return NextResponse.json({ error: 'modelGuid is required for replaceForModel' }, { status: 400 });
      }

      // Delete only BIM-derived assets for this model
      await col.deleteMany({ projectId, source: 'BIM_MODEL', modelGuid });

      let count = 0;
      for (const raw of assets) {
        // Ensure BIM source and modelGuid are carried over
        const withScope = { ...raw, source: 'BIM_MODEL', modelGuid };
        // eslint-disable-next-line no-await-in-loop
        await upsertOne(col, projectId, withScope);
        count++;
      }
      return NextResponse.json({ ok: true, replaced: count, modelGuid });
    }

    // Support multiple modes for flexibility
    // 1) { action: 'upsertMany', assets: Asset[] }
    if (payload?.action === 'upsertMany' && Array.isArray(payload?.assets)) {
      const results: any[] = [];
      for (const raw of payload.assets) {
        // eslint-disable-next-line no-await-in-loop
        const res = await upsertOne(col, projectId, raw);
        results.push(res);
      }
      return NextResponse.json({ ok: true, count: results.length });
    }

    // 2) Upsert single asset
    const saved = await upsertOne(col, projectId, payload);
    return NextResponse.json({ ok: true, asset: saved });
  } catch (err) {
    console.error('[Assets][POST] error', err);
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
    
    if (!id) return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });

    const db = await getDb();
    const col = db.collection("fm_assets");

    const objectId = safeObjectId(id);
    if (!objectId) return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });

    const result = await col.deleteOne({ _id: objectId, projectId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Assets][DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function upsertOne(col: any, projectId: string, raw: any) {
  const now = new Date().toISOString();
  const doc = {
    projectId,
    modelGuid: raw?.modelGuid || undefined,
    source: raw?.source === 'BIM_MODEL' ? 'BIM_MODEL' : 'MANUAL',
    assetCode: raw?.assetCode || undefined,
    assetName: raw?.assetName || undefined,
    category: raw?.category || undefined,
    type: raw?.type || undefined,
    brand: raw?.brand || undefined,
    model: raw?.model || undefined,
    serialNumber: raw?.serialNumber || undefined,
    installationDate: raw?.installationDate || undefined,
    elementId: raw?.elementId || undefined,
    ifcGuid: raw?.ifcGuid || undefined,
    ifcClass: raw?.ifcClass || undefined,
    ifcType: raw?.ifcType || undefined,
    ifcPredefined: raw?.ifcPredefined || undefined,
    ifcCandidates: raw?.ifcCandidates || undefined,
    assetClassification: raw?.assetClassification || undefined,
    material: raw?.material || undefined,
    dimensions: raw?.dimensions || undefined,
    weight: raw?.weight || undefined,
    capacity: raw?.capacity || undefined,
    powerRating: raw?.powerRating || undefined,
    manuals: raw?.manuals || undefined,
    warranties: raw?.warranties || undefined,
    certifications: raw?.certifications || undefined,
    condition: raw?.condition || undefined,
    serviceDate: raw?.serviceDate || undefined,
    expectedLife: raw?.expectedLife || undefined,
    maintenanceSchedule: raw?.maintenanceSchedule || undefined,
    lastService: raw?.lastService || undefined,
    nextService: raw?.nextService || undefined,
    purchaseCost: raw?.purchaseCost || undefined,
    maintenanceCost: raw?.maintenanceCost || undefined,
    regulations: raw?.regulations || undefined,
    safetyNotes: raw?.safetyNotes || undefined,
    parentAsset: raw?.parentAsset || undefined,
    location: raw?.location || undefined,
    suppliers: raw?.suppliers || undefined,
    description: raw?.description || undefined,
    dbId: raw?.dbId ?? null,
    placeholderX: raw?.placeholderX || undefined,
    placeholderY: raw?.placeholderY || undefined,
    placeholderZ: raw?.placeholderZ || undefined,
    placeholderShape: raw?.placeholderShape || undefined,
    placeholderSize: raw?.placeholderSize || undefined,
    conflictWithId: raw?.conflictWithId || undefined,
    linkedAssetId: raw?.linkedAssetId || undefined,
    hidden: raw?.hidden || false,
    updatedAt: now,
  } as any;

  // Compute a stable key for BIM assets to prevent duplication across re-extractions
  const isBIM = doc.source === 'BIM_MODEL';
  const filter = isBIM
    ? { projectId, source: 'BIM_MODEL', modelGuid: doc.modelGuid, dbId: doc.dbId }
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
