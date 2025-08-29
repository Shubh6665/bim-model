import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';
import { canMakeProjectAdmin, canManageAccess, isApprovedAdministratorForCompany, isPlatformOwnerEmail } from '@/app/lib/rbac';
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
    $or: [
      { 'invitee.role': 'ProjectAdmin' },
      { 'invitee.role': 'Project Admin' }
    ]
  });
  return !!accepted;
}

async function authorizeInviteManager(db: any, projectId: string, user: any, email: string) {
  if (!user) return false;
  const proj = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!proj) return false;
  // Platform Owner, approved company Admin, or Project Admin may manage invites
  return await canManageAccess(db, proj, email, user);
}

// PATCH /api/projects/[projectId]/invites -> update an invite (packages/status/role)
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
    const { inviteId, packages, status, role } = body || {};
    if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });

    const update: any = {};
    if (Array.isArray(packages)) update['invitee.packages'] = packages;
    if (status && ['pending', 'accepted', 'declined', 'expired'].includes(status)) update['status'] = status;
    if (typeof role === 'string' && role.trim().length > 0) update['invitee.role'] = role;

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

    // For Project Admins, restrict editing to invites they created and never their own
    const proj = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    const isOwner = isPlatformOwnerEmail(email) || isApprovedAdministratorForCompany(user, proj?.company);
    if (!isOwner) {
      const isSelfInvite = String(existing?.invitee?.email || '').toLowerCase() === email.toLowerCase();
      const createdBySelf = String(existing?.inviterUserId || '') === String(user._id);
      if (isSelfInvite || !createdBySelf) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Role change RBAC: only Platform Owner/Admin can appoint Project Admin
    if (typeof role === 'string' && role.trim().length > 0) {
      const normalized = role.replace(/\s+/g, '').toLowerCase();
      const wantsPA = normalized === 'projectadmin' || normalized === 'projectadministrator';
      if (wantsPA) {
        const canAppointPA = await canMakeProjectAdmin(db, proj, email, user);
        if (!canAppointPA) {
          return NextResponse.json({ error: 'Only Platform Owner or approved Administrator can appoint a Project Administrator' }, { status: 403 });
        }
      }
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

    // Determine scope: ONLY Platform Owner and Project Creator/Administrator see all invites
    // Project Admin should NOT see invites they didn't create
    const proj = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    const isPlatformOwner = isPlatformOwnerEmail(email);
    const isProjectCreator = proj && String(proj.userId) === String(user._id);
    const isCompanyAdmin = isApprovedAdministratorForCompany(user, proj?.company);
    
    // Only Platform Owner OR Project Creator who is also Company Admin can see all invites
    const canSeeAllInvites = isPlatformOwner || (isProjectCreator && isCompanyAdmin);

    console.log('[GET invites] Access check:', {
      email,
      isPlatformOwner,
      isProjectCreator,
      isCompanyAdmin,
      canSeeAllInvites,
      projectUserId: proj?.userId,
      userObjectId: user._id
    });

    const baseFilter: any = { projectId: new ObjectId(projectId) };
    const listFilter: any = canSeeAllInvites
      ? baseFilter
      : { ...baseFilter, inviterUserId: user._id, 'invitee.email': { $ne: email } };

    const invites = await db
      .collection('invites')
      .find(listFilter)
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
    // Fetch the invite to enforce fine-grained rules for Project Admins
    const idOnlyFilter: any = { $or: [ { _id: new ObjectId(inviteId) }, { _id: inviteId } ] };
    const existing = await db.collection('invites').findOne(idOnlyFilter);
    if (!existing) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

    // Determine if requester is PlatformOwner/Admin of company
    const proj = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    const isOwner = isPlatformOwnerEmail(email) || isApprovedAdministratorForCompany(user, proj?.company);
    if (!isOwner) {
      // Project Admin: may not revoke their own invite and may only act on invites they created
      const isSelfInvite = String(existing?.invitee?.email || '').toLowerCase() === email.toLowerCase();
      const createdBySelf = String(existing?.inviterUserId || '') === String(user._id);
      if (isSelfInvite || !createdBySelf) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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

    // Only Platform Owner or approved Administrator can nominate a Project Administrator
    const canAppointPA = await canMakeProjectAdmin(db, proj, email, user);
    const normRole = String(role || '').replace(/\s+/g, '').toLowerCase();
    if ((normRole === 'projectadmin' || normRole === 'projectadministrator') && !canAppointPA) {
      return NextResponse.json({ error: 'Only Platform Owner or approved Administrator can appoint a Project Administrator' }, { status: 403 });
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
