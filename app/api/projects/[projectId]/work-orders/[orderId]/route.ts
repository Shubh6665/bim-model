import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-config";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, orderId } = await context.params;
    if (!projectId || !orderId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const body = await req.json();
    // Remove _id from body if present to avoid immutable field error
    const { _id, ...updateFields } = body;

    const db = await getDb();
    const col = db.collection("fm_work_orders");

    const result = await col.updateOne(
      { _id: new ObjectId(orderId), projectId },
      { $set: { ...updateFields, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating work order:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, orderId } = await context.params;
    if (!projectId || !orderId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection("fm_work_orders");

    const workOrder = await col.findOne({ _id: new ObjectId(orderId), projectId });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    return NextResponse.json(workOrder);
  } catch (error) {
    console.error("Error fetching work order:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
