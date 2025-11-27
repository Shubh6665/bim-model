/**
 * Maintenance System Role Detection & Authorization
 * 
 * Roles:
 * - TM (Team Manager/Maintenance Team): Can approve/reject, set Priority/Type, assign technicians, set RESOLVED
 * - FM (Facility Manager): Can modify Priority/Type anytime, request integrations, read-only for maintenance logs
 * - Maintainer: Can perform PLANNED → IN_PROGRESS → CLOSE, add notes/attachments
 * - User: Can only create tickets
 */

import { ObjectId } from 'mongodb';

export type MaintenanceRole = 'TM' | 'FM' | 'Maintainer' | 'User' | null;

/**
 * Get user's maintenance role for a project
 * Checks the invites collection for accepted invitations with specific roles
 */
export async function getUserMaintenanceRole(
  db: any,
  projectId: string,
  userEmail: string
): Promise<MaintenanceRole> {
  if (!db || !projectId || !userEmail) return null;

  try {
    // Find accepted invite for this user in this project
    const invite = await db.collection('invites').findOne({
      projectId: new ObjectId(projectId),
      status: 'accepted',
      'invitee.email': userEmail,
    });

    console.log('[Role Detection] ProjectId:', projectId);
    console.log('[Role Detection] User Email:', userEmail);
    console.log('[Role Detection] Found Invite:', invite ? {
      projectId: invite.projectId,
      role: invite.invitee?.role,
      email: invite.invitee?.email,
      status: invite.status
    } : 'No invite found');

    if (!invite || !invite.invitee?.role) {
      console.log('[Role Detection] No invite or role found, returning User');
      return 'User';
    }

    const roleRaw = String(invite.invitee.role);
    const normalized = roleRaw.replace(/\s+/g, '').toLowerCase();
    console.log('[Role Detection] Raw role:', roleRaw);
    console.log('[Role Detection] Normalized role:', normalized);

    // Match role patterns (case-insensitive, space-insensitive)
    // "Maintenance Team" or "MaintenanceTeam" → TM
    if (normalized.includes('maintenance')) {
      console.log('[Role Detection] Matched TM role (contains "maintenance")');
      return 'TM';
    }
    // "Facility Manager" or "FacilityManager" → FM
    if (normalized.includes('facility') || normalized.includes('manager')) {
      console.log('[Role Detection] Matched FM role');
      return 'FM';
    }
    // "Maintainer" or "Technician" → Maintainer
    if (normalized.includes('maintainer') || normalized.includes('technician')) {
      console.log('[Role Detection] Matched Maintainer role');
      return 'Maintainer';
    }

    // Default to User if role doesn't match any maintenance role
    console.log('[Role Detection] No pattern matched, returning User');
    return 'User';
  } catch (error) {
    console.error('[getUserMaintenanceRole] Error:', error);
    return null;
  }
}

/**
 * Check if user is TM (Maintenance Team)
 */
export async function isMaintenanceTeam(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  const role = await getUserMaintenanceRole(db, projectId, userEmail);
  return role === 'TM';
}

/**
 * Check if user is FM (Facility Manager)
 */
export async function isFacilityManager(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  const role = await getUserMaintenanceRole(db, projectId, userEmail);
  return role === 'FM';
}

/**
 * Check if user is Maintainer (Technician)
 */
export async function isMaintainer(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  const role = await getUserMaintenanceRole(db, projectId, userEmail);
  return role === 'Maintainer';
}

/**
 * Check if user can approve/reject tickets (TM only)
 */
export async function canApproveTickets(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  return await isMaintenanceTeam(db, projectId, userEmail);
}

/**
 * Check if user can perform maintenance operations (TM or Maintainer)
 */
export async function canPerformMaintenance(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  const role = await getUserMaintenanceRole(db, projectId, userEmail);
  return role === 'TM' || role === 'Maintainer';
}

/**
 * Check if user can set RESOLVED status (TM only)
 */
export async function canResolveTicket(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  return await isMaintenanceTeam(db, projectId, userEmail);
}

/**
 * Check if user can modify FM fields (Priority/Type) (FM only)
 */
export async function canModifyFMFields(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  return await isFacilityManager(db, projectId, userEmail);
}

/**
 * Check if user can request integration (FM only)
 */
export async function canRequestIntegration(
  db: any,
  projectId: string,
  userEmail: string
): Promise<boolean> {
  return await isFacilityManager(db, projectId, userEmail);
}

/**
 * Get all TM members for a project (for notifications)
 */
export async function getMaintenanceTeamMembers(
  db: any,
  projectId: string
): Promise<string[]> {
  try {
    const invites = await db.collection('invites').find({
      projectId: new ObjectId(projectId),
      status: 'accepted',
      'invitee.role': { $regex: /maintenance.*team/i }
    }).toArray();

    return invites
      .map((inv: any) => inv.invitee?.email)
      .filter((email: string) => email && email.trim().length > 0);
  } catch (error) {
    console.error('[getMaintenanceTeamMembers] Error:', error);
    return [];
  }
}

/**
 * Get all FM members for a project (for notifications)
 */
export async function getFacilityManagers(
  db: any,
  projectId: string
): Promise<string[]> {
  try {
    const invites = await db.collection('invites').find({
      projectId: new ObjectId(projectId),
      status: 'accepted',
      'invitee.role': { $regex: /facility.*manager/i }
    }).toArray();

    return invites
      .map((inv: any) => inv.invitee?.email)
      .filter((email: string) => email && email.trim().length > 0);
  } catch (error) {
    console.error('[getFacilityManagers] Error:', error);
    return [];
  }
}

/**
 * Get all Maintainers for a project
 */
export async function getMaintainers(
  db: any,
  projectId: string
): Promise<string[]> {
  try {
    const invites = await db.collection('invites').find({
      projectId: new ObjectId(projectId),
      status: 'accepted',
      'invitee.role': { $regex: /maintainer|technician/i }
    }).toArray();

    return invites
      .map((inv: any) => inv.invitee?.email)
      .filter((email: string) => email && email.trim().length > 0);
  } catch (error) {
    console.error('[getMaintainers] Error:', error);
    return [];
  }
}
