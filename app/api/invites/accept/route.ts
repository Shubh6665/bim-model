import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';

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

    const invitedEmail = invite?.invitee?.email as string | undefined;

    // Require authentication and matching email
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email as string | undefined;
    if (!sessionEmail) {
      // Tell client which email must be used so it can pass login_hint
      return NextResponse.json({ error: 'Not authenticated', requiresAuth: true, invitedEmail }, { status: 401 });
    }
    if (invitedEmail && sessionEmail.toLowerCase() !== invitedEmail.toLowerCase()) {
      return NextResponse.json({ error: 'wrong_account', invitedEmail, signedInAs: sessionEmail }, { status: 403 });
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

    // Ensure a user record exists for this email so future logins resolve projects
    if (sessionEmail) {
      const existing = await db.collection('users').findOne({ email: sessionEmail });
      if (!existing) {
        await db.collection('users').insertOne({ email: sessionEmail, createdAt: new Date(), invited: true });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error accepting invite:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
