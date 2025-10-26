import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// Track deleted BIM spaces to prevent re-extraction across devices
// Collection: deletedSpaces
// Schema: { _id, projectId, spaceId, source, deletedAt }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const db = await getDb();
    const deletedSpaces = await db
      .collection("deletedSpaces")
      .find({ projectId })
      .toArray();

    return NextResponse.json({ deletedSpaces });
  } catch (error: any) {
    console.error("[API] GET /deleted-spaces error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch deleted spaces" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const body = await request.json();
    const { spaceId, source } = body;

    if (!spaceId) {
      return NextResponse.json({ error: "Missing spaceId" }, { status: 400 });
    }

    const db = await getDb();
    
    // Upsert to avoid duplicates
    await db.collection("deletedSpaces").updateOne(
      { projectId, spaceId },
      {
        $set: {
          projectId,
          spaceId,
          source: source || "BIM_MODEL",
          deletedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] POST /deleted-spaces error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to track deleted space" },
      { status: 500 }
    );
  }
}
