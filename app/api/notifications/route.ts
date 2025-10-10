import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-config";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const notifications = await db.collection('notifications')
      .find({ userEmail: session.user.email })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // Transform to match AppNotification interface
    const transformed = notifications.map((n: any) => ({
      id: n._id.toString(),
      type: n.type || 'generic',
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read || false,
      meta: n.meta || {}
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('[Notifications][GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, read } = await req.json();
    
    const db = await getDb();
    await db.collection('notifications').updateOne(
      { _id: id, userEmail: session.user.email },
      { $set: { read } }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Notifications][PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
