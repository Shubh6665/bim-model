import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId, type UpdateFilter } from 'mongodb';
import { canModifyModels as rbacCanModifyModels } from '@/app/lib/rbac';
import type { ProjectModel } from '@/app/types/projects';

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
  if (String(project.userId) === String(user._id)) return true;
  return !!(await getInviteFor(db, projectId, email));
}

async function canModifyModels(db: any, projectId: string, user: any, email: string) {
  if (!user) return false;
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) return false;
  return rbacCanModifyModels(db, project, email, user);
}

// GET /api/projects/[projectId]/models -> list models for a project
export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ models: [] }, { status: 200 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ models: [] }, { status: 200 });

    const { projectId } = await context.params;
    const allowed = await canReadProject(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const models: ProjectModel[] = Array.isArray(project.models) ? project.models : [];
    return NextResponse.json({ models }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/models -> add a model
export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const { name, discipline = 'other', urn, fileType = '', transform = null } = body || {};

    if (!urn) return NextResponse.json({ error: 'urn is required' }, { status: 400 });

    const { projectId } = await context.params;
    const allowed = await canModifyModels(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const newModel: ProjectModel = {
      id: new ObjectId().toHexString(),
      name: name || 'Model',
      discipline,
      urn,
      fileType,
      transform,
    };

    const updateRes = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      ({ $push: { models: newModel } } as unknown as UpdateFilter<any>)
    );

    if (updateRes.modifiedCount !== 1) {
      return NextResponse.json({ error: 'Failed to add model' }, { status: 500 });
    }

    return NextResponse.json({ model: newModel }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
