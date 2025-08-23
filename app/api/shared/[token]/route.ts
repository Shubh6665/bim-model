import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = await getDb();
    const { token } = params;

    // Find the share link
    const shareLink = await db.collection('shareLinks').findOne({
      token,
      expiresAt: { $gt: new Date() } // Not expired
    });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
    }

    // Get the actual item (file or folder)
    const collection = shareLink.type === 'file' ? 'files' : 'folders';
    const item = await db.collection(collection).findOne({
      _id: shareLink.itemId,
      projectId: shareLink.projectId
    });

    if (!item) {
      return NextResponse.json({ error: 'Shared item no longer exists' }, { status: 404 });
    }

    // Increment access count
    await db.collection('shareLinks').updateOne(
      { _id: shareLink._id },
      { $inc: { accessCount: 1 } }
    );

    return NextResponse.json({
      token: shareLink.token,
      type: shareLink.type,
      itemId: shareLink.itemId.toString(),
      projectId: shareLink.projectId.toString(),
      expiresAt: shareLink.expiresAt,
      item: {
        name: item.name,
        size: item.size,
        type: item.type
      }
    });
  } catch (error) {
    console.error('Error fetching shared item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
