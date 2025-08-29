import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';

// Note: Access control disabled intentionally for open database access.

// GET /api/projects/[projectId]/folders - Get all folders and files for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    // Get folders for this project
    const folders = await db.collection('folders').find({ 
      projectId: new ObjectId(projectId) 
    }).toArray();

    // Get files for this project
    const files = await db.collection('files').find({ 
      projectId: new ObjectId(projectId) 
    }).toArray();

    return NextResponse.json({ folders, files });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/folders - Create a new folder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const { name, parentId } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // resolve current user email if logged in
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || 'public';

    const folder = {
      name: name.trim(),
      projectId: new ObjectId(projectId),
      parentId: parentId ? new ObjectId(parentId) : null,
      createdAt: new Date(),
      createdBy: email,
      updatedAt: new Date(),
      updatedBy: email
    };

    const result = await db.collection('folders').insertOne(folder);
    
    return NextResponse.json({ 
      id: result.insertedId,
      ...folder 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/projects/[projectId]/folders/[folderId] - Update folder (rename)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const body = await request.json();
    const { folderId, name, parentId } = body || {};

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    if (name === undefined && parentId === undefined) {
      return NextResponse.json({ error: 'Nothing to update. Provide name or parentId' }, { status: 400 });
    }

    // resolve current user email if logged in
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || 'public';

    const $set: any = { updatedAt: new Date(), updatedBy: email };
    if (typeof name === 'string') {
      $set.name = name.trim();
    }
    if (parentId !== undefined) {
      $set.parentId = parentId ? new ObjectId(parentId) : null;
    }

    const result = await db.collection('folders').updateOne(
      { 
        _id: new ObjectId(folderId),
        projectId: new ObjectId(projectId)
      },
      { $set }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/folders/[folderId] - Delete folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const db = await getDb();

    const url = new URL(request.url);
    const folderId = url.searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Delete folder and all its contents recursively
    await deleteFolder(db, folderId, projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function deleteFolder(db: any, folderId: string, projectId: string) {
  // Find all subfolders
  const subfolders = await db.collection('folders').find({
    parentId: new ObjectId(folderId),
    projectId: new ObjectId(projectId)
  }).toArray();

  // Recursively delete subfolders
  for (const subfolder of subfolders) {
    await deleteFolder(db, subfolder._id.toString(), projectId);
  }

  // Delete all files in this folder
  await db.collection('files').deleteMany({
    folderId: new ObjectId(folderId),
    projectId: new ObjectId(projectId)
  });

  // Delete the folder itself
  await db.collection('folders').deleteOne({
    _id: new ObjectId(folderId),
    projectId: new ObjectId(projectId)
  });
}
