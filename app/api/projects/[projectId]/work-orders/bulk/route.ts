import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const { updates } = await req.json();
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Updates array is required' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection("fm_work_orders");

    // Perform bulk update
    const bulkOps = updates.map((update: any) => {
      const { id, ...fields } = update;
      const objectId = ObjectId.createFromHexString(id);
      
      return {
        updateOne: {
          filter: { _id: objectId, projectId },
          update: {
            $set: {
              ...fields,
              updatedAt: new Date().toISOString()
            }
          }
        }
      };
    });

    const result = await col.bulkWrite(bulkOps);

    console.log(`[WorkOrders][Bulk] Updated ${result.modifiedCount} work orders`);

    return NextResponse.json({ 
      ok: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('[WorkOrders][Bulk] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
