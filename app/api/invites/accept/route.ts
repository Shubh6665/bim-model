import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';

// GET /api/invites/accept?token=...&projectId=...
// This route is only for checking the invite status before auth.
// It tells the client if auth is needed, and for which email.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const db = await getDb();
    const invite = await db.collection('invites').findOne({ token });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    const invitedEmail = invite.invitee.email as string;

    // If user is already logged in, check if it's the right account
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      if (session.user.email.toLowerCase() === invitedEmail.toLowerCase()) {
        // Already logged in with correct account, we can accept it right away.
        // This is an edge case, the main flow will use POST after login.
        await db.collection('invites').updateOne(
          { _id: invite._id },
          { $set: { status: 'accepted', acceptedAt: new Date() } }
        );
        return NextResponse.json({ success: true });
      } else {
        // Logged in, but wrong account
        return NextResponse.json({ error: 'wrong_account', invitedEmail, signedInAs: session.user.email }, { status: 403 });
      }
    }

    // Not logged in, tell client to authenticate
    return NextResponse.json({ error: 'Not authenticated', requiresAuth: true, invitedEmail }, { status: 401 });

  } catch (err: any) {
    console.error('Error checking invite:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/invites/accept
// This is called by the client *after* a successful login/signup on the main page.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { token, projectId } = await req.json();
    if (!token || !projectId) {
      return NextResponse.json({ error: 'Missing token or projectId' }, { status: 400 });
    }

    const db = await getDb();
    const invite = await db.collection('invites').findOne({
      token,
      'invitee.email': { $regex: `^${session.user.email}$`, $options: 'i' }
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found for your account' }, { status: 404 });
    }

    // Idempotent: if already accepted, just return success
    if (invite.status === 'accepted') {
      return NextResponse.json({ success: true, alreadyAccepted: true });
    }

    await db.collection('invites').updateOne(
      { _id: invite._id },
      { $set: { status: 'accepted', acceptedAt: new Date() } }
    );

    // The user record should already exist from the signup/login process.
    // We don't need to create it here.

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error accepting invite:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
