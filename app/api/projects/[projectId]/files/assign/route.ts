import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { sendEmail } from '@/app/lib/email';

// Note: Access control disabled intentionally for open database access.

// POST /api/projects/[projectId]/files/assign - Assign file/folder to user
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const db = await getDb();

    const { type, itemId, email, permissions } = await request.json();

    if (!type || !itemId || !email) {
      return NextResponse.json({ error: 'Type, item ID, and email are required' }, { status: 400 });
    }

    // Get item details
    const collection = type === 'file' ? 'files' : 'folders';
    const item = await db.collection(collection).findOne({
      _id: new ObjectId(itemId),
      projectId: new ObjectId(params.projectId)
    });

    if (!item) {
      return NextResponse.json({ error: `${type} not found` }, { status: 404 });
    }

    // Check if user exists
    const targetUser = await db.collection('users').findOne({ email });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create assignment record
    const assignment = {
      type,
      itemId: new ObjectId(itemId),
      projectId: new ObjectId(params.projectId),
      assignedTo: email,
      assignedBy: 'public',
      permissions: permissions || ['read'], // Default to read-only
      createdAt: new Date(),
      status: 'active'
    };

    await db.collection('assignments').insertOne(assignment);

    // Send notification email
    try {
      await sendEmail(
        email,
        `You've been assigned a ${type}: ${item.name}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New ${type} Assignment</h2>
            <p><strong>Public User</strong> has assigned a ${type} to you:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${item.name}</h3>
              ${type === 'file' ? `<p>Size: ${(item.size / 1024 / 1024).toFixed(1)} MB</p>` : ''}
              <p>Permissions: ${permissions?.join(', ') || 'Read'}</p>
            </div>
            
            <a href="${process.env.APP_BASE_URL}/projects/${params.projectId}/database" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View in Project
            </a>
          </div>
        `
      );
    } catch (error) {
      console.warn('Could not send assignment email:', error);
    }

    return NextResponse.json({ success: true, message: 'Assignment created successfully' });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/files/assign - Remove user access
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const db = await getDb();

    const { type, itemId, email } = await request.json();

    if (!type || !itemId || !email) {
      return NextResponse.json({ error: 'Type, item ID, and email are required' }, { status: 400 });
    }

    // Remove assignment
    const result = await db.collection('assignments').deleteOne({
      type,
      itemId: new ObjectId(itemId),
      projectId: new ObjectId(params.projectId),
      assignedTo: email
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Access removed successfully' });
  } catch (error) {
    console.error('Error removing assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
