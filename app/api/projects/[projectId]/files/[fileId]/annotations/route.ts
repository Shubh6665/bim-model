import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { isApprovedAdministratorForCompany, isPlatformOwnerEmail } from '@/app/lib/rbac';

// Reuse helper logic similar to properties route
async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

async function getSessionUser(db: any, email: string) {
  return db.collection('users').findOne({ email });
}

async function canReadProject(db: any, projectId: string, user: any, email: string) {
  if (!user) return false;
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) return false;
  if (isPlatformOwnerEmail(email)) return true;
  if (isApprovedAdministratorForCompany(user, project.company)) return true;
  if (String(project.userId) === String(user._id)) return true; // owner
  const invite = await db.collection('invites').findOne({
    projectId: new ObjectId(projectId),
    status: 'accepted',
    'invitee.email': email,
  });
  return !!invite;
}

async function canWriteProject(db: any, projectId: string, user: any, email: string) {
  // For MVP: anyone who can read can also write annotations. Adjust if needed.
  return canReadProject(db, projectId, user, email);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { projectId, fileId } = await params;

    const db = await getDb();
    const user = await getSessionUser(db, email);
    const allowed = await canReadProject(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const items = await db
      .collection('annotations')
      .find({ projectId, fileId })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json({ annotations: items });
  } catch (e) {
    console.error('Annotations GET error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { projectId, fileId } = await params;

    const body = await req.json();
    const { pageIndex, type, quads, comment } = body || {};

    if (typeof pageIndex !== 'number' || !Array.isArray(quads) || !type) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const db = await getDb();
    const user = await getSessionUser(db, email);
    const allowed = await canWriteProject(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const doc = {
      projectId,
      fileId,
      pageIndex,
      type, // 'highlight' | 'underline' | 'comment'
      quads, // [{ x, y, width, height } in page coordinates ratio 0..1]
      comment: comment || '',
      authorEmail: email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection('annotations').insertOne(doc);
    return NextResponse.json({ annotation: { _id: res.insertedId, ...doc } }, { status: 201 });
  } catch (e) {
    console.error('Annotations POST error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { projectId, fileId } = await params;
    const body = await req.json();
    const { id, comment, quads, type } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    const allowed = await canWriteProject(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const q: any = { _id: new ObjectId(id), projectId, fileId };
    const upd: any = { updatedAt: new Date() };
    if (typeof comment === 'string') upd.comment = comment;
    if (Array.isArray(quads)) upd.quads = quads;
    if (type) upd.type = type;

    const r = await db.collection('annotations').updateOne(q, { $set: upd });
    if (!r.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const saved = await db.collection('annotations').findOne(q);
    return NextResponse.json({ annotation: saved });
  } catch (e) {
    console.error('Annotations PUT error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { projectId, fileId } = await params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDb();
    const user = await getSessionUser(db, email);
    const allowed = await canWriteProject(db, projectId, user, email);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const r = await db.collection('annotations').deleteOne({ _id: new ObjectId(id), projectId, fileId });
    if (!r.deletedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Annotations DELETE error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
