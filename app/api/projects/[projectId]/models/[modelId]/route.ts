import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId, type UpdateFilter } from 'mongodb';
import { canModifyModels as rbacCanModifyModels } from '@/app/lib/rbac';
import type { ProjectModel, ModelTransform, Discipline } from '@/app/types/projects';

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

// PATCH /api/projects/[projectId]/models/[modelId] -> update model metadata/transform
export async function PATCH(req: NextRequest, context: { params: Promise<{ projectId: string, modelId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId, modelId } = await context.params;
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const allowed = await rbacCanModifyModels(db, project, email, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const update: Partial<ProjectModel> = {};
    if (typeof body.name === 'string') update.name = body.name;
    if (typeof body.fileType === 'string') update.fileType = body.fileType;
    if (typeof body.urn === 'string') update.urn = body.urn;
    if (typeof body.discipline === 'string') update.discipline = body.discipline as Discipline;
    if (body.transform && typeof body.transform === 'object') {
      const t = body.transform as ModelTransform;
      update.transform = {
        tx: typeof t.tx === 'number' ? t.tx : undefined,
        ty: typeof t.ty === 'number' ? t.ty : undefined,
        tz: typeof t.tz === 'number' ? t.tz : undefined,
        rx: typeof t.rx === 'number' ? t.rx : undefined,
        ry: typeof t.ry === 'number' ? t.ry : undefined,
        rz: typeof t.rz === 'number' ? t.rz : undefined,
        sx: typeof t.sx === 'number' ? t.sx : undefined,
        sy: typeof t.sy === 'number' ? t.sy : undefined,
        sz: typeof t.sz === 'number' ? t.sz : undefined,
      };
    }

    const res = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId), 'models.id': modelId },
      ({ $set: Object.fromEntries(Object.entries(update).map(([k, v]) => ([`models.$.${k}`, v]))) } as unknown as UpdateFilter<any>)
    );

    if (res.matchedCount !== 1) return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    if (res.modifiedCount !== 1) return NextResponse.json({ error: 'No changes applied' }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/models/[modelId]
export async function DELETE(_req: NextRequest, context: { params: Promise<{ projectId: string, modelId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId, modelId } = await context.params;
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const allowed = await rbacCanModifyModels(db, project, email, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const res = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      ({ $pull: { models: { id: modelId } } } as unknown as UpdateFilter<any>)
    );

    if (res.matchedCount !== 1) return NextResponse.json({ error: 'Project not found or model not present' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
