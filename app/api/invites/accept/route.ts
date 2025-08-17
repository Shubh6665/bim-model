import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/invites/accept?token=...&projectId=...
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const projectId = url.searchParams.get('projectId');

    if (!token || !projectId) {
      return NextResponse.json({ error: 'Missing token or projectId' }, { status: 400 });
    }

    const db = await getDb();

    // First, try exact match by token + projectId
    let invite = await db.collection('invites').findOne({ token, projectId: new ObjectId(projectId) });
    // If not found, try by token only (in case projectId string mismatch)
    if (!invite) {
      invite = await db.collection('invites').findOne({ token });
    }
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Idempotent: if already accepted, just return success
    if (invite.status === 'accepted') {
      return NextResponse.json({ success: true, alreadyAccepted: true });
    }

    // Update status to accepted
    await db.collection('invites').updateOne(
      { _id: invite._id },
      { $set: { status: 'accepted', acceptedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error accepting invite:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
