import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';

// Helper to get user email from session
async function getUserEmail(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

// GET: Get specific project by ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    const project = await db.collection('projects').findOne({ 
      _id: new ObjectId(params.id),
      userId: user._id 
    });
    
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update specific project by ID (only allow certain fields)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    // Parse JSON body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      console.error('Failed to parse JSON body:', err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    // Only allow specific fields to be updated (security measure)
    const allowedFields = [
      'name', 
      'description', 
      'code', 
      'country', 
      'municipality', 
      'address', 
      'cadastral',
      'company', 
      'clientName'
    ];
    
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    // Add updatedAt timestamp
    updateData.updatedAt = new Date();
    
    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    // Update the project
    const result = await db.collection('projects').updateOne(
      { 
        _id: new ObjectId(params.id),
        userId: user._id 
      },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Fetch and return updated project
    const updatedProject = await db.collection('projects').findOne({ 
      _id: new ObjectId(params.id),
      userId: user._id 
    });
    
    return NextResponse.json({ 
      message: 'Project updated successfully',
      project: updatedProject 
    });
    
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete specific project by ID
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    const result = await db.collection('projects').deleteOne({ 
      _id: new ObjectId(params.id),
      userId: user._id 
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Project deleted successfully' });
    
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
