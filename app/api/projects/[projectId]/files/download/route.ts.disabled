import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import path from 'path';

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

    // Check if physical file exists
    if (!file.filePath) {
      return NextResponse.json({ error: 'File path not found' }, { status: 404 });
    }

    try {
      const fileBuffer = await fs.readFile(file.filePath);
      
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.name}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('Error reading file:', error);
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
