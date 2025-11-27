/**
 * Activity Logging System for Maintenance Platform
 * 
 * Logs all actions performed on tickets and work orders
 * Provides complete audit trail for compliance and debugging
 */

import { ObjectId } from 'mongodb';
import type { MaintenanceRole } from './maintenance-roles';
import type { ActivityAction } from '@/app/components/fm-panel-types';

export interface LogActivityParams {
  db: any;
  projectId: string;
  ticketId?: string;
  workOrderId?: string;
  author: string;  // email
  authorRole: MaintenanceRole;
  action: ActivityAction;
  fieldChanged?: string;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity to the activity_logs collection
 */
export async function logActivity(params: LogActivityParams): Promise<boolean> {
  const {
    db,
    projectId,
    ticketId,
    workOrderId,
    author,
    authorRole,
    action,
    fieldChanged,
    oldValue,
    newValue,
    notes,
    metadata,
  } = params;

  try {
    if (!db || !projectId || !author || !authorRole || !action) {
      console.error('[logActivity] Missing required parameters');
      return false;
    }

    const logEntry = {
      projectId: new ObjectId(projectId),
      ticketId: ticketId ? new ObjectId(ticketId) : undefined,
      workOrderId: workOrderId ? new ObjectId(workOrderId) : undefined,
      author,
      authorRole,
      action,
      fieldChanged: fieldChanged || undefined,
      oldValue: oldValue !== undefined ? String(oldValue) : undefined,
      newValue: newValue !== undefined ? String(newValue) : undefined,
      notes: notes || undefined,
      metadata: metadata || undefined,
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
    };

    // Remove undefined fields
    Object.keys(logEntry).forEach((key) => {
      if (logEntry[key as keyof typeof logEntry] === undefined) {
        delete logEntry[key as keyof typeof logEntry];
      }
    });

    await db.collection('activity_logs').insertOne(logEntry);

    console.log('[logActivity] Logged:', {
      action,
      author,
      role: authorRole,
      ticket: ticketId,
      workOrder: workOrderId,
    });

    return true;
  } catch (error) {
    console.error('[logActivity] Error logging activity:', error);
    return false;
  }
}

/**
 * Get activity logs for a ticket
 */
export async function getTicketActivityLogs(
  db: any,
  ticketId: string
): Promise<any[]> {
  try {
    const logs = await db
      .collection('activity_logs')
      .find({ ticketId: new ObjectId(ticketId) })
      .sort({ timestamp: -1 })
      .toArray();

    return logs.map((log: any) => ({
      id: log._id.toString(),
      ...log,
      _id: undefined,
    }));
  } catch (error) {
    console.error('[getTicketActivityLogs] Error:', error);
    return [];
  }
}

/**
 * Get activity logs for a work order
 */
export async function getWorkOrderActivityLogs(
  db: any,
  workOrderId: string
): Promise<any[]> {
  try {
    const logs = await db
      .collection('activity_logs')
      .find({ workOrderId: new ObjectId(workOrderId) })
      .sort({ timestamp: -1 })
      .toArray();

    return logs.map((log: any) => ({
      id: log._id.toString(),
      ...log,
      _id: undefined,
    }));
  } catch (error) {
    console.error('[getWorkOrderActivityLogs] Error:', error);
    return [];
  }
}

/**
 * Get all activity logs for a project
 */
export async function getProjectActivityLogs(
  db: any,
  projectId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const logs = await db
      .collection('activity_logs')
      .find({ projectId: new ObjectId(projectId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return logs.map((log: any) => ({
      id: log._id.toString(),
      ...log,
      _id: undefined,
    }));
  } catch (error) {
    console.error('[getProjectActivityLogs] Error:', error);
    return [];
  }
}

/**
 * Get activity logs filtered by action type
 */
export async function getActivityLogsByAction(
  db: any,
  projectId: string,
  action: ActivityAction,
  limit: number = 50
): Promise<any[]> {
  try {
    const logs = await db
      .collection('activity_logs')
      .find({
        projectId: new ObjectId(projectId),
        action,
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return logs.map((log: any) => ({
      id: log._id.toString(),
      ...log,
      _id: undefined,
    }));
  } catch (error) {
    console.error('[getActivityLogsByAction] Error:', error);
    return [];
  }
}

/**
 * Get activity logs for a specific user
 */
export async function getUserActivityLogs(
  db: any,
  projectId: string,
  userEmail: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const logs = await db
      .collection('activity_logs')
      .find({
        projectId: new ObjectId(projectId),
        author: userEmail,
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return logs.map((log: any) => ({
      id: log._id.toString(),
      ...log,
      _id: undefined,
    }));
  } catch (error) {
    console.error('[getUserActivityLogs] Error:', error);
    return [];
  }
}

/**
 * Helper: Log ticket creation
 */
export async function logTicketCreation(
  db: any,
  projectId: string,
  ticketId: string,
  author: string,
  ticketCode: string
): Promise<boolean> {
  return await logActivity({
    db,
    projectId,
    ticketId,
    author,
    authorRole: 'User',
    action: 'TICKET_CREATED',
    notes: `Ticket ${ticketCode} created`,
  });
}

/**
 * Helper: Log ticket approval
 */
export async function logTicketApproval(
  db: any,
  projectId: string,
  ticketId: string,
  author: string,
  priority: string,
  type: string
): Promise<boolean> {
  return await logActivity({
    db,
    projectId,
    ticketId,
    author,
    authorRole: 'TM',
    action: 'TICKET_APPROVED',
    notes: `Ticket approved with Priority: ${priority}, Type: ${type}`,
    metadata: { priority, type },
  });
}

/**
 * Helper: Log ticket rejection
 */
export async function logTicketRejection(
  db: any,
  projectId: string,
  ticketId: string,
  author: string,
  reason: string
): Promise<boolean> {
  return await logActivity({
    db,
    projectId,
    ticketId,
    author,
    authorRole: 'TM',
    action: 'TICKET_REJECTED',
    notes: reason,
  });
}

/**
 * Helper: Log status change
 */
export async function logStatusChange(
  db: any,
  projectId: string,
  workOrderId: string,
  author: string,
  authorRole: MaintenanceRole,
  oldStatus: string,
  newStatus: string
): Promise<boolean> {
  return await logActivity({
    db,
    projectId,
    workOrderId,
    author,
    authorRole,
    action: 'STATUS_CHANGE',
    fieldChanged: 'status',
    oldValue: oldStatus,
    newValue: newStatus,
  });
}

/**
 * Helper: Log priority change (by FM)
 */
export async function logPriorityChange(
  db: any,
  projectId: string,
  workOrderId: string,
  author: string,
  oldPriority: string,
  newPriority: string
): Promise<boolean> {
  return await logActivity({
    db,
    projectId,
    workOrderId,
    author,
    authorRole: 'FM',
    action: 'PRIORITY_CHANGE',
    fieldChanged: 'priority',
    oldValue: oldPriority,
    newValue: newPriority,
  });
}

/**
 * Helper: Log type change (by FM)
 */
export async function logTypeChange(
  db: any,
  projectId: string,
  workOrderId: string,
  author: string,
  oldType: string,
  newType: string
): Promise<boolean> {
  return await logActivity({
    db,
    projectId,
    workOrderId,
    author,
    authorRole: 'FM',
    action: 'TYPE_CHANGE',
    fieldChanged: 'type',
    oldValue: oldType,
    newValue: newType,
  });
}
