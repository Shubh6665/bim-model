import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';

// GET /api/projects/[projectId]/files/by-name?fileName=xxx
// Returns file record by file name (used for manual asset manuals)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const url = new URL(request.url);
    const fileName = url.searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    // Search for file by name in the files collection
    const file = await db.collection('files').findOne({
      projectId: new ObjectId(projectId),
      name: fileName
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(file);
  } catch (error) {
    console.error('Error fetching file by name:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
