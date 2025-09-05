import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { isApprovedAdministratorForCompany, isPlatformOwnerEmail } from '@/app/lib/rbac';

// Helpers mirroring logic in projects route for consistent RBAC
async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

async function getSessionUser(db: any, email: string) {
  return db.collection('users').findOne({ email });
}

async function getInviteFor(db: any, projectId: string, email: string) {
  return db.collection('invites').findOne({
    projectId: new ObjectId(projectId),
    status: 'accepted',
    'invitee.email': email,
  });
}

async function canReadProject(db: any, projectId: string, user: any, email: string) {
  if (!user) return false;
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) return false;
  if (isPlatformOwnerEmail(email)) return true;
  // Any approved Administrator can read projects (no company matching required)
  if (Array.isArray(user.adminCompanies) && user.adminCompanies.some((entry: any) => entry.status === 'approved')) return true;
  if (String(project.userId) === String(user._id)) return true; // owner
  const invite = await getInviteFor(db, projectId, email);
  return !!invite; // any accepted invite grants read
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const email = await getUserEmail();
    
    if (!email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { projectId } = await context.params;
    const db = await getDb();
    const user = await getSessionUser(db, email);
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const canRead = await canReadProject(db, projectId, user, email);
    if (!canRead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Get user's project-specific profile
    const profile = await db.collection('project_profiles').findOne({
      projectId,
      email
    });

    // If no profile exists, try to get data from invite
    if (!profile) {
      // Prefer an accepted invite
      const acceptedInvite = await db.collection('invites').findOne({
        projectId: new ObjectId(projectId),
        'invitee.email': email,
        status: 'accepted'
      });

      // If none accepted, fallback to the latest invite for this user in this project (any status)
      let latestInvite: any = null;
      if (!acceptedInvite) {
        const candidates = await db.collection('invites')
          .find({ projectId: new ObjectId(projectId), 'invitee.email': email })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();
        latestInvite = candidates?.[0] || null;
      }

      const chosen = acceptedInvite || latestInvite;
      console.log('[Profile GET] Invite prefill check', {
        hasAccepted: !!acceptedInvite,
        hasLatest: !!latestInvite,
        usingFrom: acceptedInvite ? 'accepted' : (latestInvite ? 'latest' : 'none'),
        projectId,
        email,
      });

      if (chosen?.invitee) {
        return NextResponse.json({
          profile: {
            name: chosen.invitee.name || '',
            surname: chosen.invitee.surname || '',
            society: chosen.invitee.society || '',
            telephone: '',
            avatarUrl: ''
          }
        });
      }
    }

    return NextResponse.json({
      profile: {
        name: profile?.name || '',
        surname: profile?.surname || '',
        title: profile?.title || '',
        society: profile?.society || '',
        logoSociety: profile?.logoSociety || '',
        telephone: profile?.telephone || '',
        avatarUrl: profile?.avatarUrl || ''
      }
    });

  } catch (error) {
    console.error('Error fetching project profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    
    if (!email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { projectId } = await context.params;
    const body = await req.json();
    const db = await getDb();
    
    // Verify project exists and caller has at least read access (can update their own profile)
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const user = await getSessionUser(db, email);
    const allowed = await canReadProject(db, projectId, user, email);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate telephone format
    if (body.telephone && !/^\+?[0-9]{7,15}$/.test(body.telephone)) {
      return NextResponse.json({ error: 'Invalid telephone number format' }, { status: 400 });
    }

    // Update or create project-specific profile
    const profileData = {
      projectId,
      email,
      name: body.name || '',
      surname: body.surname || '',
      title: body.title || '',
      society: body.society || '',
      logoSociety: body.logoSociety || '',
      telephone: body.telephone || '',
      avatarUrl: body.avatarUrl || '',
      updatedAt: new Date()
    };

    await db.collection('project_profiles').updateOne(
      { projectId, email },
      { 
        $set: profileData,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    const savedProfile = await db.collection('project_profiles').findOne({
      projectId,
      email
    });

    return NextResponse.json({
      success: true,
      profile: {
        name: savedProfile?.name || '',
        surname: savedProfile?.surname || '',
        title: savedProfile?.title || '',
        society: savedProfile?.society || '',
        logoSociety: savedProfile?.logoSociety || '',
        telephone: savedProfile?.telephone || '',
        avatarUrl: savedProfile?.avatarUrl || ''
      }
    });

  } catch (error) {
    console.error('Error updating project profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
