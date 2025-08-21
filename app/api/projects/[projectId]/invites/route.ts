import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

async function getSessionUser(db: any, email: string) {
  return db.collection('users').findOne({ email });
}

async function isOwner(db: any, projectId: string, user: any) {
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  return project && String(project.userId) === String(user?._id);
}

async function isProjectAdmin(db: any, projectId: string, email: string) {
  const accepted = await db.collection('invites').findOne({
    projectId: new ObjectId(projectId),
    status: 'accepted',
    'invitee.email': email,
    'invitee.role': 'ProjectAdmin',
  });
  return !!accepted;
}

async function authorizeInviteManager(db: any, projectId: string, user: any, email: string) {
  if (!user) return false;
  // Only project owner can manage invites
  if (await isOwner(db, projectId, user)) return true;
  return false;
}

// PATCH /api/projects/[projectId]/invites -> update an invite (packages/status) (owner only)
export async function PATCH(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId } = await context.params;
    const allowed = await authorizeInviteManager(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { inviteId, packages, status } = body || {};
    if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });

    const update: any = {};
    if (Array.isArray(packages)) update['invitee.packages'] = packages;
    if (status && ['pending', 'accepted', 'declined', 'expired'].includes(status)) update['status'] = status;

    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    // Pre-check: fetch invite by id first for clear diagnostics
    const idMatchFilter: any = { $or: [ { _id: new ObjectId(inviteId) }, { _id: inviteId } ] };
    const existing = await db.collection('invites').findOne(idMatchFilter);
    if (!existing) {
      console.warn('[PATCH invites] No invite found by id', { inviteId, projectId });
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Validate invite belongs to the project in the route
    const existingProjId = existing.projectId?.toHexString ? existing.projectId.toHexString() : String(existing.projectId || '');
    if (existingProjId && String(existingProjId) !== String(projectId)) {
      console.warn('[PATCH invites] Invite belongs to different project', { inviteId, routeProjectId: projectId, inviteProjectId: existingProjId });
      return NextResponse.json({ error: 'Invite does not belong to this project' }, { status: 404 });
    }

    // Use updateOne and then findOne to ensure we return the updated document reliably.
    const updateResult = await db.collection('invites').updateOne({ _id: existing._id }, { $set: update });

    if (updateResult.matchedCount === 0) {
      console.error('[PATCH invites] Document not found for update, though it was just fetched.', { inviteId });
      return NextResponse.json({ error: 'Invite not found during update' }, { status: 404 });
    }

    // Re-fetch the document to get its latest state to return to the client.
    const updatedInvite = await db.collection('invites').findOne({ _id: existing._id });

    if (!updatedInvite) {
      console.error('[PATCH invites] Invite disappeared after update', { inviteId });
      return NextResponse.json({ error: 'Could not retrieve invite after update' }, { status: 404 });
    }

    return NextResponse.json({ success: true, invite: updatedInvite });
  } catch (err: any) {
    console.error('PATCH invite error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/projects/[projectId]/invites -> list invites for this project (owner only)
export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId } = await context.params;
    const allowed = await authorizeInviteManager(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invites = await db
      .collection('invites')
      .find({ projectId: new ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .toArray();

    // Normalize identifiers for client consumption
    const normalized = invites.map((inv: any) => ({
      ...inv,
      id: inv?._id?.toHexString ? inv._id.toHexString() : String(inv?._id || ''),
      projectId: inv?.projectId?.toHexString ? inv.projectId.toHexString() : String(inv?.projectId || ''),
    }));

    return NextResponse.json({ invites: normalized });
  } catch (err: any) {
    console.error('GET invites error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/invites?inviteId=... -> revoke/remove an invite (owner only)
export async function DELETE(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get('inviteId');
    if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId } = await context.params;
    const allowed = await authorizeInviteManager(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // remove the invite only if it belongs to the project
    // Support both ObjectId and string storage for _id and projectId
    const deleteFilter: any = {
      $and: [
        { $or: [ { _id: new ObjectId(inviteId) }, { _id: inviteId } ] },
        { $or: [ { projectId: new ObjectId(projectId) }, { projectId } ] },
      ],
    };
    let res = await db.collection('invites').deleteOne(deleteFilter);
    if (res.deletedCount === 0) {
      // Fallback: match by _id only
      const idOnlyFilter: any = { $or: [ { _id: new ObjectId(inviteId) }, { _id: inviteId } ] };
      res = await db.collection('invites').deleteOne(idOnlyFilter);
      if (res.deletedCount === 0) {
        console.warn('[DELETE invites] Invite not found', { inviteId, projectId });
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE invite error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/invites -> create and (optionally) send an invite
export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId } = await context.params;
    const proj = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const allowed = await authorizeInviteManager(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, surname, email: inviteeEmail, role, society, packages } = body || {};

    if (!inviteeEmail || typeof inviteeEmail !== 'string') {
      return NextResponse.json({ error: 'Valid invitee email is required' }, { status: 400 });
    }

    // Only Owner can nominate a Project Administrator
    const isOwnerUser = String(proj.userId) === String(user._id);
    if (role === 'ProjectAdmin' && !isOwnerUser) {
      return NextResponse.json({ error: 'Only the project owner can nominate a Project Administrator' }, { status: 403 });
    }

    const inviteDoc = {
      _id: new ObjectId(),
      projectId: proj._id,
      inviterUserId: user._id,
      invitee: {
        name: name || '',
        surname: surname || '',
        email: inviteeEmail,
        role: role || 'General',
        society: society || '',
        packages: Array.isArray(packages) ? packages : [],
      },
      status: 'pending' as 'pending' | 'accepted' | 'declined' | 'expired',
      token: new ObjectId().toHexString(),
      createdAt: new Date(),
    };

    await db.collection('invites').insertOne(inviteDoc);

    // Attempt to send email via SMTP (Nodemailer)
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT || 587);
      const userSmtp = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = process.env.MAIL_FROM || 'noreply@example.com';
      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

      if (host && userSmtp && pass) {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465, // true for 465, false for 587/25
          auth: { user: userSmtp, pass },
        });

        const acceptUrl = `${appBaseUrl}/invite/accept?token=${inviteDoc.token}&projectId=${projectId}`;

        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>You have been invited to a project</h2>
            <p><strong>Project:</strong> ${proj.name || 'Untitled Project'}</p>
            <p><strong>Invited by:</strong> ${user.email}</p>
            <p>
              Click the button below to accept the invitation and get access.
            </p>
            <p>
              <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Accept Invitation</a>
            </p>
            <p>If the button doesn’t work, copy and paste this link in your browser:</p>
            <p style="word-break:break-all"><a href="${acceptUrl}">${acceptUrl}</a></p>
          </div>
        `;

        await transporter.sendMail({
          from,
          to: inviteeEmail,
          subject: `Invitation to join project${proj.name ? `: ${proj.name}` : ''}`,
          html,
        });
        emailSent = true;
      } else {
        emailError = 'SMTP not configured (missing SMTP_HOST/USER/PASS).';
      }
    } catch (e: any) {
      console.error('Error sending invite email:', e);
      emailError = e?.message || 'Failed to send email';
    }

    return NextResponse.json({ success: true, inviteId: inviteDoc._id, token: inviteDoc.token, emailSent, emailError });
  } catch (err: any) {
    console.error('Error creating invite:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
