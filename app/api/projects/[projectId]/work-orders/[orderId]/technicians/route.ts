/**
 * Technician Assignment Endpoints
 * POST /api/projects/[projectId]/work-orders/[orderId]/technicians
 * DELETE /api/projects/[projectId]/work-orders/[orderId]/technicians
 * TM can add/remove technicians from work orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { isMaintenanceTeam } from '@/app/lib/maintenance-roles';
import { logActivity } from '@/app/lib/activity-logger';
import { sendEmail } from '@/app/lib/email';

/**
 * POST - Add technician to work order
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { projectId, orderId } = await context.params;
    if (!projectId || !orderId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const db = await getDb();
    const isTM = await isMaintenanceTeam(db, projectId, userEmail);
    if (!isTM) return NextResponse.json({ error: 'Only TM can assign technicians' }, { status: 403 });

    const body = await req.json();
    const { technicianEmail, technicianName } = body;

    if (!technicianEmail || !technicianName) {
      return NextResponse.json({ error: 'Technician email and name are required' }, { status: 400 });
    }

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const now = new Date().toISOString();
    const newTechnician = {
      email: technicianEmail,
      name: technicianName,
      assignedBy: userEmail,
      assignedAt: now,
    };

    // Check if already assigned
    const existingTechnicians = workOrder.assignedTechnicians || [];
    const alreadyAssigned = existingTechnicians.some((t: any) => t.email === technicianEmail);
    
    if (alreadyAssigned) {
      return NextResponse.json({ error: 'Technician already assigned' }, { status: 400 });
    }

    await workOrdersCol.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $push: { assignedTechnicians: newTechnician } as any,
        $set: { updatedAt: now },
      }
    );

    // Log activity
    await logActivity({
      db,
      projectId,
      workOrderId: orderId,
      author: userEmail,
      authorRole: 'TM',
      action: 'TECHNICIAN_ASSIGNED',
      notes: `Assigned ${technicianName} (${technicianEmail})`,
    } as any);

    // Send notification to technician
    try {
      const html = `<div style="font-family: Arial, sans-serif; max-width:600px;">
        <h3 style="color:#2563eb">You've been assigned to a work order</h3>
        <p>You have been assigned to work order <strong>${workOrder.requestId || workOrder.id}</strong> by ${userEmail}.</p>
        <p><strong>Description:</strong> ${workOrder.description || 'N/A'}</p>
        <p><strong>Location:</strong> ${workOrder.location || 'N/A'}</p>
        <p><strong>Priority:</strong> ${workOrder.priority || 'N/A'}</p>
      </div>`;
      await sendEmail(technicianEmail, `Work Order Assignment: ${workOrder.requestId || workOrder.id}`, html);
    } catch (e) {
      console.error('Failed to notify technician', e);
    }

    return NextResponse.json({ success: true, technician: newTechnician });
  } catch (error: any) {
    console.error('[Add Technician] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove technician from work order
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { projectId, orderId } = await context.params;
    if (!projectId || !orderId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const db = await getDb();
    const isTM = await isMaintenanceTeam(db, projectId, userEmail);
    if (!isTM) return NextResponse.json({ error: 'Only TM can remove technicians' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const technicianEmail = searchParams.get('email');

    if (!technicianEmail) {
      return NextResponse.json({ error: 'Technician email is required' }, { status: 400 });
    }

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const now = new Date().toISOString();

    await workOrdersCol.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $pull: { assignedTechnicians: { email: technicianEmail } } as any,
        $set: { updatedAt: now },
      }
    );

    // Log activity
    await logActivity({
      db,
      projectId,
      workOrderId: orderId,
      author: userEmail,
      authorRole: 'TM',
      action: 'TECHNICIAN_REMOVED',
      notes: `Removed technician ${technicianEmail}`,
    } as any);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Remove Technician] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
