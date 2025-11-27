/**
 * FM Field Update Endpoint
 * PATCH /api/projects/[projectId]/work-orders/[orderId]/fm-fields
 * FM can update Priority and Type at any time
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';
import { canModifyFMFields, getMaintenanceTeamMembers } from '@/app/lib/maintenance-roles';
import { logPriorityChange, logTypeChange } from '@/app/lib/activity-logger';
import { sendEmail } from '@/app/lib/email';

export async function PATCH(
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
    const canFM = await canModifyFMFields(db, projectId, userEmail);
    if (!canFM) return NextResponse.json({ error: 'Only FM can modify these fields' }, { status: 403 });

    const body = await req.json();
    const { priority, type } = body || {};
    if (!priority && !type) return NextResponse.json({ error: 'priority or type required' }, { status: 400 });

    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
    const validTypes = ['Corrective','Urgent','Preventive','Safety','Regulatory','Inspection','Cleaning'];

    const workOrdersCol = db.collection('fm_work_orders');
    const workOrder = await workOrdersCol.findOne({ _id: new ObjectId(orderId), projectId });
    if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    // Extract project name from work order's location field (format: "Building - Level - Room")
    let projectName = 'Unknown Project';
    if (workOrder.location && typeof workOrder.location === 'string') {
      const parts = workOrder.location.split('-').map((p: string) => p.trim());
      if (parts.length > 0 && parts[0]) {
        projectName = parts[0]; // First part is the building/project name
      }
    }
    // Fallback to building field if available
    if ((!projectName || projectName === 'Unknown Project') && workOrder.building) {
      projectName = workOrder.building;
    }

    const now = new Date().toISOString();
    const updates: any = { updatedAt: now };

    // Track old values for email
    const oldPriority = workOrder.priority || 'Not Set';
    const oldType = workOrder.type || 'Not Set';
    let priorityChanged = false;
    let typeChanged = false;

    if (priority) {
      if (!validPriorities.includes(priority)) return NextResponse.json({ error: `Invalid priority` }, { status: 400 });
      updates.priority = priority;
      priorityChanged = true;
      await workOrdersCol.updateOne({ _id: new ObjectId(orderId) }, { $set: updates });
      await logPriorityChange(db, projectId, orderId, userEmail, oldPriority, priority);
    }

    if (type) {
      if (!validTypes.includes(type)) return NextResponse.json({ error: `Invalid type` }, { status: 400 });
      updates.type = type;
      typeChanged = true;
      await workOrdersCol.updateOne({ _id: new ObjectId(orderId) }, { $set: updates });
      await logTypeChange(db, projectId, orderId, userEmail, oldType, type);
    }

    // Notify TM about FM change with detailed information
    const tmEmails = await getMaintenanceTeamMembers(db, projectId);
    for (const to of tmEmails) {
      try {
        let changesHtml = '';
        if (priorityChanged) {
          changesHtml += `
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 10px 0;">
              <strong style="color: #1f2937;">Priority Updated:</strong><br/>
              <span style="color: #6b7280;">From:</span> <span style="color: #ef4444; font-weight: 600;">${oldPriority}</span> 
              → 
              <span style="color: #10b981; font-weight: 600;">${priority}</span>
            </div>
          `;
        }
        if (typeChanged) {
          changesHtml += `
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 10px 0;">
              <strong style="color: #1f2937;">Maintenance Type Updated:</strong><br/>
              <span style="color: #6b7280;">From:</span> <span style="color: #ef4444; font-weight: 600;">${oldType}</span> 
              → 
              <span style="color: #10b981; font-weight: 600;">${type}</span>
            </div>
          `;
        }

        const html = `
          <div style="font-family: Arial, sans-serif; max-width:600px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
            <div style="background: linear-gradient(135deg, #0ea5a4 0%, #0891b2 100%); padding: 20px; border-radius: 6px; margin-bottom: 20px;">
              <h2 style="color: white; margin: 0; font-size: 20px;">FM Update Notification</h2>
            </div>
            
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Facility Manager <strong style="color: #0ea5a4;">${userEmail}</strong> has updated work order fields.
            </p>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
              <strong style="color: #92400e;">Work Order:</strong> ${workOrder.requestId || workOrder.id}
            </div>

            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0;">
              <strong style="color: #1e40af;">Project:</strong> ${projectName}
            </div>

            <div style="margin: 20px 0;">
              <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">Changes Made:</h3>
              ${changesHtml}
            </div>

            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                <strong>Location:</strong> ${workOrder.location || 'Not specified'}<br/>
                <strong>Description:</strong> ${workOrder.description || 'No description'}
              </p>
            </div>

            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated notification from the Maintenance Management System.<br/>
                Please log in to the system to view complete details.
              </p>
            </div>
          </div>
        `;
        
        const subject = `FM Updated: ${workOrder.requestId || workOrder.id} - ${projectName}`;
        await sendEmail(to, subject, html);
      } catch (e) {
        console.error('Failed to notify TM about FM update', e);
      }
    }

    return NextResponse.json({ success: true, updated: updates });
  } catch (error: any) {
    console.error('[FM Fields] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
