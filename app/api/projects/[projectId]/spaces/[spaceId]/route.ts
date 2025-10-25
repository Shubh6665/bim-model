import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string; spaceId: string }> }
) {
  try {
    const { projectId, spaceId } = await params;
    if (!projectId || !spaceId) {
      return NextResponse.json({ error: 'Project ID and Space ID are required' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection("fm_spaces");

    const space = await col.findOne({
      _id: new ObjectId(spaceId),
      projectId
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Normalize id
    const normalized = { id: space._id?.toString(), ...space, _id: undefined };
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[Spaces][GET by ID] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string; spaceId: string }> }
) {
  try {
    const { projectId, spaceId } = await params;
    if (!projectId || !spaceId) {
      return NextResponse.json({ error: 'Project ID and Space ID are required' }, { status: 400 });
    }

    const payload = await req.json();

    const db = await getDb();
    const col = db.collection("fm_spaces");

    // Build update doc - only update fields that are provided
    const now = new Date().toISOString();
    const updateDoc: any = { updatedAt: now };

    // Only include fields that are explicitly provided in payload
    if (payload.name !== undefined) updateDoc.name = payload.name;
    if (payload.level !== undefined) updateDoc.level = payload.level;
    if (payload.building !== undefined) updateDoc.building = payload.building;
    if (payload.spaceCode !== undefined) updateDoc.spaceCode = payload.spaceCode;
    if (payload.description !== undefined) updateDoc.description = payload.description;
    if (payload.area !== undefined) {
      updateDoc.area = typeof payload.area === 'number' ? payload.area : (payload.area ? Number(payload.area) : undefined);
    }

    const result = await col.updateOne(
      {
        _id: new ObjectId(spaceId),
        projectId
      },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to update space' }, { status: 500 });
    }

    console.log(`[Spaces][PUT] Updated space ${spaceId} in project ${projectId}`);

    // Fetch and return updated space
    const updated = await col.findOne({
      _id: new ObjectId(spaceId),
      projectId
    });

    const normalized = { id: updated?._id?.toString(), ...updated, _id: undefined };
    return NextResponse.json({ ok: true, space: normalized });
  } catch (err) {
    console.error('[Spaces][PUT] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string; spaceId: string }> }
) {
  try {
    const { projectId, spaceId } = await params;
    if (!projectId || !spaceId) {
      return NextResponse.json({ error: 'Project ID and Space ID are required' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection("fm_spaces");

    const result = await col.deleteOne({
      _id: new ObjectId(spaceId),
      projectId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    console.log(`[Spaces][DELETE] Deleted space ${spaceId} from project ${projectId}`);
    return NextResponse.json({ ok: true, message: 'Space deleted' });
  } catch (err) {
    console.error('[Spaces][DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
