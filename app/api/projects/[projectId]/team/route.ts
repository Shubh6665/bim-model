
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const db = await getDb();

    // Get user details to check ownership
    const user = await db.collection('users').findOne({ email: userEmail });
    
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check ownership
    const isOwner = user && String(project.userId) === String(user._id);
    
    // Check membership via invites (case insensitive email check)
    const userInvite = await db.collection('invites').findOne({
      projectId: new ObjectId(projectId),
      'invitee.email': { $regex: new RegExp(`^${userEmail}$`, 'i') },
      status: 'accepted'
    });

    // Allow if owner OR has accepted invite
    if (!isOwner && !userInvite) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    // Fetch all accepted invites with roles TM or FM
    const teamInvites = await db.collection('invites').find({
      projectId: new ObjectId(projectId),
      status: 'accepted',
      'invitee.role': { $in: ['TM', 'FM', 'Maintenance Team', 'Facility Manager'] }
    }).toArray();

    // Map to simplified objects
    const team = teamInvites.map((inv: any) => {
      const roleRaw = inv.invitee.role;
      // Normalize role
      let role = 'User';
      if (roleRaw === 'TM' || roleRaw === 'Maintenance Team') role = 'TM';
      if (roleRaw === 'FM' || roleRaw === 'Facility Manager') role = 'FM';

      return {
        name: `${inv.invitee.name} ${inv.invitee.surname}`.trim(),
        firstName: inv.invitee.name,
        surname: inv.invitee.surname,
        email: inv.invitee.email,
        role
      };
    });

    return NextResponse.json({ team });

  } catch (error: any) {
    console.error('[Team API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
