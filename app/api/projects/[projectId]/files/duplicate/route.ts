import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const body = await request.json();
    const { fileId } = body || {};

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    // Find the source file record
    const src = await db.collection('files').findOne({
      _id: new ObjectId(fileId),
      projectId: new ObjectId(projectId)
    });

    if (!src) {
      return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
    }

    if (!src.fileId) {
      return NextResponse.json({ error: 'Source file blob missing' }, { status: 400 });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });

    // Compose new name (avoid double copy suffix) and preserve extension
    const name: string = src.name || 'file';
    const hasCopy = name.toLowerCase().includes(' (copy)');
    let copyName = name;
    if (!hasCopy) {
      const lastDot = name.lastIndexOf('.');
      if (lastDot > 0 && lastDot < name.length - 1) {
        const base = name.substring(0, lastDot);
        const ext = name.substring(lastDot + 1);
        copyName = `${base} (copy).${ext}`;
      } else {
        copyName = `${name} (copy)`;
      }
    }

    // Stream copy in GridFS
    const downloadStream = bucket.openDownloadStream(src.fileId);
    const uploadStream = bucket.openUploadStream(copyName, {
      metadata: { projectId, folderId: src.folderId?.toString?.(), contentType: src.mimeType }
    });

    await new Promise<void>((resolve, reject) => {
      downloadStream
        .on('error', reject)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });

    // Create new file record
    const newRecord = {
      name: copyName,
      type: src.type,
      size: src.size,
      projectId: new ObjectId(projectId),
      folderId: src.folderId ? new ObjectId(src.folderId) : null,
      fileId: uploadStream.id,
      mimeType: src.mimeType,
      createdAt: new Date(),
      createdBy: 'public',
      updatedAt: new Date()
    };

    const result = await db.collection('files').insertOne(newRecord);

    return NextResponse.json({ id: result.insertedId, success: true });
  } catch (error) {
    console.error('Error duplicating file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
