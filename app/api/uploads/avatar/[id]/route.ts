import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const db = await getDb();
    const doc = await db.collection('avatars').findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const contentType = doc.contentType || 'application/octet-stream';
    const data: Buffer = doc.data?.buffer ? Buffer.from(doc.data.buffer) : doc.data;
    // Use Uint8Array for Fetch-compatible BodyInit
    const res = new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
    return res;
  } catch (e: any) {
    console.error('Avatar fetch failed:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
