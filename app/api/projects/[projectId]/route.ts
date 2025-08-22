import { NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';
import { canDeleteProject, canUpdateProject, getEffectiveRole, isPlatformOwnerEmail, isApprovedAdministratorForCompany } from '@/app/lib/rbac';

// Helper to get user email from session
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
  if (isApprovedAdministratorForCompany(user, project.company)) return true;
  if (String(project.userId) === String(user._id)) return true; // owner
  const invite = await getInviteFor(db, projectId, email);
  return !!invite; // any accepted invite grants read
}

// GET: Get specific project by ID
export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const db = await getDb();
    const email = await getUserEmail();
    const { projectId } = await context.params;
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const canRead = await canReadProject(db, projectId, user, email);
    if (!canRead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Determine access using RBAC effective role
    const role = await getEffectiveRole(db, project, email, user);
    let packages: string[] = [];
    const invite = await getInviteFor(db, projectId, email);
    if (invite && Array.isArray(invite?.invitee?.packages)) packages = invite.invitee.packages;
    const access = { role, packages, owner: String(project.userId) === String(user._id) };
    return NextResponse.json({ project: { ...project, access } });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update specific project by ID (only allow certain fields)
export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const db = await getDb();
    const email = await getUserEmail();
    const { projectId } = await context.params;
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const allowed = await canUpdateProject(db, project, email, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Parse JSON body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      console.error('Failed to parse JSON body:', err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    // Only allow specific fields to be updated (security measure)
    const allowedFields = [
      'name', 
      'description', 
      'code', 
      'country', 
      'municipality', 
      'address', 
      'cadastral',
      'company', 
      'clientName'
    ];
    
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    // Add updatedAt timestamp
    updateData.updatedAt = new Date();
    
    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    // Update the project
    const result = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Fetch and return updated project
    const updatedProject = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    const role = updatedProject ? await getEffectiveRole(db, updatedProject, email, user) : 'General';
    const access = {
      role,
      packages: [],
      owner: !!(updatedProject && String(updatedProject.userId) === String(user._id)),
    };
    return NextResponse.json({ 
      message: 'Project updated successfully',
      project: updatedProject ? { ...updatedProject, access } : null,
    });
    
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete specific project by ID
export async function DELETE(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const db = await getDb();
    const email = await getUserEmail();
    const { projectId } = await context.params;
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const allowed = await canDeleteProject(db, project, email, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Project deleted successfully' });
    
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
