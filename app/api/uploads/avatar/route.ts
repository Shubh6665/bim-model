import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const owner = session?.user?.email || null;

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const type = file.type || '';
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Enforce ~5MB limit
    const size = file.size || 0;
    if (size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const db = await getDb();
    const doc = {
      kind: 'avatar',
      filename: (file as any).name || 'avatar',
      contentType: type,
      size,
      data: buffer,
      owner, // may be null for now
      createdAt: new Date()
    };
    const result = await db.collection('avatars').insertOne(doc as any);
    const id = (result.insertedId as ObjectId).toString();
    const url = `/api/uploads/avatar/${id}`;
    return NextResponse.json({ url, id });
  } catch (e: any) {
    console.error('Avatar upload failed:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
