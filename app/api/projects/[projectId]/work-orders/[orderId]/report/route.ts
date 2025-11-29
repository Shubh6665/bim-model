import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { logActivity } from '@/app/lib/activity-logger';

/**
 * PATCH /api/projects/[projectId]/work-orders/[orderId]/report
 * Update maintenance report fields for a work order
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, orderId } = await params;
    const body = await request.json();

    const {
      diagnosis,
      workPerformed,
      materialsUsed,
      complianceCompleted,
      ppeUsed,
      assetCondition,
      technicalNotes,
      tmSignature,
      fmSignature,
      signatureDate,
      additionalComments
    } = body;

    const db = await getDb();
    const workOrdersCol = db.collection('fm_work_orders');
    const invitesCol = db.collection('invites');

    // Check user role
    // First check if user is project owner
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    const user = await db.collection('users').findOne({ email: session.user.email });
    const isOwner = project && user && String(project.userId) === String(user._id);

    let isTM = false;
    let isFM = false;
    let userRoleForLog = '';

    if (isOwner) {
      // Owner has full access (acts as FM)
      isFM = true;
      isTM = true; // Owner can also edit TM fields if needed
      userRoleForLog = 'OWNER';
    } else {
      // Check invite role
      const userInvite = await invitesCol.findOne({ 
        projectId: new ObjectId(projectId),
        'invitee.email': { $regex: new RegExp(`^${session.user.email}$`, 'i') },
        status: 'accepted'
      });

      if (!userInvite) {
        return NextResponse.json({ error: 'User not found in project' }, { status: 403 });
      }

      const userRole = String(userInvite.invitee?.role || '').toLowerCase();
      userRoleForLog = userRole;
      // Check for various role strings
      isTM = /maintenance|team|tm/i.test(userRole);
      isFM = /facility|manager|fm/i.test(userRole);
    }

    if (!isTM && !isFM) {
      return NextResponse.json({ 
        error: 'Only Maintenance Team or Facility Manager can update report' 
      }, { status: 403 });
    }

    // Build update object based on role
    const updateFields: any = {};
    
    // TM can edit work description, safety, and result sections
    if (isTM) {
      if (diagnosis !== undefined) updateFields.diagnosis = diagnosis;
      if (workPerformed !== undefined) updateFields.workPerformed = workPerformed;
      if (materialsUsed !== undefined) updateFields.materialsUsed = materialsUsed;
      if (complianceCompleted !== undefined) updateFields.complianceCompleted = complianceCompleted;
      if (ppeUsed !== undefined) updateFields.ppeUsed = ppeUsed;
      if (assetCondition !== undefined) updateFields.assetCondition = assetCondition;
      if (technicalNotes !== undefined) updateFields.technicalNotes = technicalNotes;
      if (tmSignature !== undefined) updateFields.tmSignature = tmSignature;
    }

    // FM can edit signatures and comments
    if (isFM) {
      if (fmSignature !== undefined) updateFields.fmSignature = fmSignature;
    }

    // Both TM and FM can edit additional comments and signature date
    if (isTM || isFM) {
      if (additionalComments !== undefined) updateFields.additionalComments = additionalComments;
      if (signatureDate !== undefined) updateFields.signatureDate = signatureDate;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }

    // Update the work order
    const result = await workOrdersCol.updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $set: {
          ...updateFields,
          lastModified: new Date().toISOString(),
          lastModifiedBy: session.user.email
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Log activity
    const updatedFields = Object.keys(updateFields).join(', ');
    await logActivity({
      db,
      projectId,
      workOrderId: orderId,
      author: session.user.email,
      authorRole: isTM ? 'TM' : 'FM',
      action: 'REPORT_UPDATED' as any,
      notes: `Updated report fields: ${updatedFields}`,
      metadata: {
        updatedFields: Object.keys(updateFields),
        role: userRoleForLog
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Report updated successfully',
      updatedFields: Object.keys(updateFields)
    });

  } catch (error: any) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
