import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// Track deleted BIM assets to prevent re-extraction across devices
// Collection: deletedAssets
// Schema: { _id, projectId, assetId, source, deletedAt }

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
    const deletedAssets = await db
      .collection("deletedAssets")
      .find({ projectId })
      .toArray();

    return NextResponse.json({ deletedAssets });
  } catch (error: any) {
    console.error("[API] GET /deleted-assets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch deleted assets" },
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
    const { assetId, source } = body;

    if (!assetId) {
      return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
    }

    const db = await getDb();
    
    // Upsert to avoid duplicates
    await db.collection("deletedAssets").updateOne(
      { projectId, assetId },
      {
        $set: {
          projectId,
          assetId,
          source: source || "BIM_MODEL",
          deletedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] POST /deleted-assets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to track deleted asset" },
      { status: 500 }
    );
  }
}
