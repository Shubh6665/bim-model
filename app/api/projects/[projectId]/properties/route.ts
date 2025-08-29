import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/app/services/mongodb';

// GET /api/projects/[projectId]/properties?type=file|folder&itemId=<id>
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || '').toLowerCase();
    const itemId = url.searchParams.get('itemId');

    if (!['file', 'folder'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be "file" or "folder"' }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const projectObjectId = new ObjectId(projectId);
    const itemObjectId = new ObjectId(itemId);

    if (type === 'file') {
      const file = await db.collection('files').findOne({ _id: itemObjectId, projectId: projectObjectId });
      if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

      const sizeBytes: number = Number(file.size) || 0;
      const uploadedByName = await resolveUserFullName(db, file.createdBy, projectId);
      const modifiedByName = await resolveUserFullName(db, file.updatedBy, projectId);
      return NextResponse.json({
        type: 'file',
        name: file.name,
        sizeBytes,
        sizeFormatted: formatBytes(sizeBytes),
        uploadedBy: file.createdBy || undefined,
        uploadedByName: uploadedByName || undefined,
        createdAt: file.createdAt ? new Date(file.createdAt).toISOString() : undefined,
        modifiedBy: file.updatedBy || undefined,
        modifiedByName: modifiedByName || undefined,
        modifiedAt: file.updatedAt ? new Date(file.updatedAt).toISOString() : undefined,
      });
    }

    // Folder
    const folder = await db.collection('folders').findOne({ _id: itemObjectId, projectId: projectObjectId });
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

    // Collect all descendant folder IDs (including this one)
    const allFolderIds = await collectDescendantFolderIds(db, projectObjectId, itemObjectId);

    // Sum sizes of all files within these folders
    const cursor = db.collection('files').find({ projectId: projectObjectId, folderId: { $in: allFolderIds } });
    let total = 0;
    await cursor.forEach((doc: any) => { total += Number(doc.size) || 0; });

    const uploadedByName = await resolveUserFullName(db, folder.createdBy, projectId);
    const modifiedByName = await resolveUserFullName(db, folder.updatedBy, projectId);
    return NextResponse.json({
      type: 'folder',
      name: folder.name,
      sizeBytes: total,
      sizeFormatted: formatBytes(total),
      uploadedBy: folder.createdBy || undefined,
      uploadedByName: uploadedByName || undefined,
      createdAt: folder.createdAt ? new Date(folder.createdAt).toISOString() : undefined,
      modifiedBy: folder.updatedBy || undefined,
      modifiedByName: modifiedByName || undefined,
      modifiedAt: folder.updatedAt ? new Date(folder.updatedAt).toISOString() : undefined,
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${sizes[i]}`;
}

async function collectDescendantFolderIds(db: any, projectId: ObjectId, rootId: ObjectId): Promise<ObjectId[]> {
  const result: ObjectId[] = [rootId];
  const queue: ObjectId[] = [rootId];

  while (queue.length) {
    const batch = queue.splice(0, queue.length);
    const children = await db
      .collection('folders')
      .find({ projectId, parentId: { $in: batch } })
      .toArray();
    for (const f of children) {
      const id = f._id as ObjectId;
      result.push(id);
      queue.push(id);
    }
  }

  return result;
}

// Attempts to resolve a user identifier to a full name, preferring project-specific profile first.
async function resolveUserFullName(db: any, identifier: any, projectId?: string): Promise<string | null> {
  try {
    if (!identifier) return null;
    // If identifier looks like an email
    if (typeof identifier === 'string' && /@/.test(identifier)) {
      // 1) project-specific profile
      if (projectId) {
        const proj = await db.collection('project_profiles').findOne({ projectId, email: identifier });
        if (proj) {
          const first = (proj?.name || '').toString().trim();
          const last = (proj?.surname || '').toString().trim();
          let nm = [first, last].filter(Boolean).join(' ').trim();
          if (first && last) {
            const parts = first.split(/\s+/);
            if (parts[parts.length - 1].toLowerCase() === last.toLowerCase()) {
              nm = first; // avoid duplicating surname
            }
          }
          if (nm) return nm;
        }
      }
      // 2) platform profile
      const u = await db.collection('users').findOne({ email: identifier });
      if (!u) return fallbackFromIdentifier(identifier);
      const first = (u?.name || '').toString().trim();
      const last = (u?.surname || '').toString().trim();
      let name = [first, last].filter(Boolean).join(' ').trim();
      if (first && last) {
        const parts = first.split(/\s+/);
        if (parts[parts.length - 1].toLowerCase() === last.toLowerCase()) {
          name = first; // avoid duplicating surname
        }
      }
      return name || (u?.email || null);
    }
    // If identifier is an ObjectId or stringified ObjectId
    let user: any = null;
    try {
      const id = typeof identifier === 'string' ? new ObjectId(identifier) : identifier;
      user = await db.collection('users').findOne({ _id: id });
    } catch {}
    if (user) {
      const name = `${(user?.name || '').toString().trim()} ${(user?.surname || '').toString().trim()}`.trim();
      return name || (user?.email || null);
    }
    if (typeof identifier === 'string') return fallbackFromIdentifier(identifier);
    return null;
  } catch {
    return null;
  }
}

function fallbackFromIdentifier(id: string): string | null {
  if (!id) return null;
  if (id.toLowerCase() === 'public') return 'Public User';
  return id;
}
