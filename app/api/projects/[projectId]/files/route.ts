import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';
import { Readable } from 'stream';

// Note: Access control disabled intentionally for open database access.

// GET /api/projects/[projectId]/files - Get all files for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const url = new URL(request.url);
    const folderId = url.searchParams.get('folderId');

    const query: any = { projectId: new ObjectId(projectId) };
    if (folderId) {
      query.folderId = new ObjectId(folderId);
    }

    const files = await db.collection('files').find(query).toArray();

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/files - Upload a new file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    console.log('[Upload] Received new file upload request.');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderId = formData.get('folderId') as string;
    console.log(`[Upload] File: ${file?.name}, Size: ${file?.size}, FolderID: ${folderId}`);

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB' }, { status: 400 });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    const uploadStream = bucket.openUploadStream(file.name, {
      metadata: { projectId, folderId, contentType: file.type }
    });
    console.log(`[Upload] GridFS upload stream created for ${file.name}. Stream ID: ${uploadStream.id}`);

    await new Promise((resolve, reject) => {
      stream.pipe(uploadStream)
        .on('error', (err) => {
          console.error('[Upload] GridFS stream error:', err);
          reject(err);
        })
        .on('finish', () => {
          console.log(`[Upload] GridFS stream finished for ${file.name}.`);
          resolve(void 0);
        });
    });

    // Determine file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    let fileType = 'pdf';
    if (['.doc', '.docx'].includes(fileExtension)) fileType = 'word';
    else if (['.xls', '.xlsx'].includes(fileExtension)) fileType = 'excel';
    else if (fileExtension === '.dwg') fileType = 'dwg';

    // Create file record
    const fileRecord = {
      name: file.name,
      type: fileType,
      size: file.size,
      projectId: new ObjectId(projectId),
      folderId: folderId ? new ObjectId(folderId) : null,
      fileId: uploadStream.id,
      mimeType: file.type,
      createdAt: new Date(),
      createdBy: 'public',
      updatedAt: new Date()
    };

    const result = await db.collection('files').insertOne(fileRecord);
    console.log(`[Upload] File record inserted into database with ID: ${result.insertedId}`);
    
    return NextResponse.json({ 
      id: result.insertedId,
      ...fileRecord,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      modified: 'Just now'
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/projects/[projectId]/files/[fileId] - Update file (rename)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const body = await request.json();
    const { fileId, name, moveToFolderId } = body || {};

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    if (name === undefined && moveToFolderId === undefined) {
      return NextResponse.json({ error: 'Nothing to update. Provide name or moveToFolderId' }, { status: 400 });
    }

    const $set: any = { updatedAt: new Date() };
    if (typeof name === 'string') {
      $set.name = name.trim();
    }
    if (moveToFolderId !== undefined) {
      $set.folderId = moveToFolderId ? new ObjectId(moveToFolderId) : null;
    }

    const result = await db.collection('files').updateOne(
      {
        _id: new ObjectId(fileId),
        projectId: new ObjectId(projectId)
      },
      { $set }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/files/[fileId] - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const file = await db.collection('files').findOne({
      _id: new ObjectId(fileId),
      projectId: new ObjectId(projectId)
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete from GridFS
    if (file.fileId) {
      const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
      try {
        await bucket.delete(file.fileId);
      } catch (error) {
        console.warn(`Could not delete file from GridFS: ${(error as Error).message}`);
      }
    }

    // Delete file record from files collection
    await db.collection('files').deleteOne({ _id: new ObjectId(fileId) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
