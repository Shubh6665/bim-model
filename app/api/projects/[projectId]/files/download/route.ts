import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import path from 'path';
import { GridFSBucket } from 'mongodb';

// Note: Access control disabled intentionally for open database access.

// GET /api/projects/[projectId]/files/download?fileId=xxx - Download a file
export async function GET(
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

    // Get file record
    const file = await db.collection('files').findOne({
      _id: new ObjectId(fileId),
      projectId: new ObjectId(projectId)
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Prefer legacy disk path if present; otherwise fallback to GridFS stream using stored fileId
    if (file.filePath) {
      try {
        const fileBuffer = await fs.readFile(file.filePath);
      
        // Check if this is a request for inline viewing (PDFs, images, etc.)
        const url = new URL(request.url);
        const inline = url.searchParams.get('inline') === 'true';
        
        // Determine if file should be displayed inline by default
        const inlineTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'];
        const shouldBeInline = inline || inlineTypes.includes(file.mimeType || '');
        
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Content-Disposition': shouldBeInline 
              ? `inline; filename="${file.name}"` 
              : `attachment; filename="${file.name}"`,
            'Content-Length': fileBuffer.length.toString(),
          },
        });
      } catch (error) {
        console.error('Error reading file from disk path:', error);
        // fallthrough to GridFS attempt
      }
    }

    // Fallback to GridFS if no filePath or disk read failed
    try {
      const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
      const gridId = file.fileId;
      if (!gridId) {
        return NextResponse.json({ error: 'File storage not found' }, { status: 404 });
      }
      const stream = bucket.openDownloadStream(gridId);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      const fileBuffer = Buffer.concat(chunks);

      const url = new URL(request.url);
      const inline = url.searchParams.get('inline') === 'true';
      const inlineTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'];
      const shouldBeInline = inline || inlineTypes.includes(file.mimeType || '');

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': shouldBeInline
            ? `inline; filename="${file.name}"`
            : `attachment; filename="${file.name}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('Error reading file from GridFS:', error);
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
