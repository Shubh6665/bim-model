import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../../services/mongodb";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; modelId: string }> }
) {
  try {
    const { projectId, modelId } = await params;
    const { urn } = await request.json();

    if (!projectId || !modelId || !urn) {
      return NextResponse.json(
        { message: "Missing required fields: projectId, modelId, and urn" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const result = await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId), "models.id": modelId },
      { $set: { "models.$.urn": urn } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Project or model not found" },
        { status: 404 }
      );
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: "Model URN was not modified (it may already have this URN)." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: "Model URN updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update model URN:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

