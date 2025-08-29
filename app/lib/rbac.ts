import { ObjectId } from 'mongodb';

export type AdminApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface AdminCompanyEntry {
  company: string;
  status: AdminApprovalStatus;
}

function getPlatformOwnerEmails(): string[] {
  const csv = process.env.PLATFORM_OWNER_EMAILS || '';
  return csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const owners = getPlatformOwnerEmails();
  return owners.includes(email.toLowerCase());
}

export async function getUserByEmail(db: any, email: string) {
  if (!email) return null;
  return db.collection('users').findOne({ email });
}

export function getApprovedAdminCompanies(user: any): string[] {
  const entries: AdminCompanyEntry[] = Array.isArray(user?.adminCompanies)
    ? user.adminCompanies
    : [];
  return entries.filter((e) => e?.status === 'approved').map((e) => (e.company || '').trim());
}

export function isApprovedAdministratorForCompany(user: any, company?: string | null): boolean {
  if (!user) return false;
  const approvedCompanies = getApprovedAdminCompanies(user);
  const normList = approvedCompanies.map((c) => String(c).trim().toLowerCase());
  // Global admin applies even if company is missing
  if (normList.includes('(unspecified)')) return true;
  if (!company) return false;
  const normCompany = String(company).trim().toLowerCase();
  return normList.includes(normCompany);
}

export async function getAcceptedInvite(db: any, projectId: string, email: string) {
  return db.collection('invites').findOne({
    projectId: new ObjectId(projectId),
    status: 'accepted',
    'invitee.email': email,
  });
}

export async function isProjectAdmin(db: any, projectId: string, email: string): Promise<boolean> {
  const inv = await getAcceptedInvite(db, projectId, email);
  const roleRaw = String(inv?.invitee?.role || '');
  const norm = roleRaw.replace(/\s+/g, '').toLowerCase();
  return norm === 'projectadmin' || norm === 'projectadministrator';
}

async function isAnyProjectAdmin(db: any, email: string): Promise<boolean> {
  const invites = await db.collection('invites').find({
    status: 'accepted',
    'invitee.email': email,
  }).project({ 'invitee.role': 1 }).toArray();
  return invites.some((inv: any) => {
    const roleRaw = String(inv?.invitee?.role || '');
    const norm = roleRaw.replace(/\s+/g, '').toLowerCase();
    return norm === 'projectadmin' || norm === 'projectadministrator';
  });
}

export function isProjectOwner(project: any, user: any): boolean {
  if (!project || !user) return false;
  return String(project.userId) === String(user._id);
}

// Policy helpers
export async function canCreateProject(db: any, email: string, user: any): Promise<boolean> {
  if (!email || !user) return false;
  
  // Debug logging
  console.log('[canCreateProject] Checking permissions for:', {
    email,
    isPlatformOwner: isPlatformOwnerEmail(email),
    adminCompanies: getApprovedAdminCompanies(user),
    adminCompaniesLength: getApprovedAdminCompanies(user).length
  });
  
  if (isPlatformOwnerEmail(email)) return true;
  // Only approved Administrators can create projects
  if (getApprovedAdminCompanies(user).length > 0) return true;
  
  // NEW: Project Administrators can also create projects
  const isAnyPA = await isAnyProjectAdmin(db, email);
  return isAnyPA;
}

// Helper function to get role-based permissions
export function getRolePermissions(role: EffectiveRole): {
  canEdit: boolean;
  canInvite: boolean;
  canManageModels: boolean;
  canDeleteModels: boolean;
  canViewOnly: boolean;
} {
  switch (role) {
    case 'PlatformOwner':
    case 'Administrator':
      return {
        canEdit: true,
        canInvite: true,
        canManageModels: true,
        canDeleteModels: true,
        canViewOnly: false
      };
    
    case 'ProjectAdmin':
      return {
        canEdit: true,
        canInvite: true,
        canManageModels: true,
        canDeleteModels: true,
        canViewOnly: false
      };
    
    case 'BIMManager':
      return {
        canEdit: true,
        canInvite: false,
        canManageModels: true,
        canDeleteModels: false,
        canViewOnly: false
      };
    
    case 'BIMSpecialist':
    case 'BIMCoordinator':
    case 'Designer':
      return {
        canEdit: false,
        canInvite: false,
        canManageModels: false,
        canDeleteModels: false,
        canViewOnly: true
      };
    
    case 'FacilityManager':
    case 'MaintenanceTeam':
    case 'Planner':
      return {
        canEdit: false,
        canInvite: false,
        canManageModels: false,
        canDeleteModels: false,
        canViewOnly: true
      };
    
    case 'Contractor':
    case 'Other':
    case 'User':
    default:
      return {
        canEdit: false,
        canInvite: false,
        canManageModels: false,
        canDeleteModels: false,
        canViewOnly: true
      };
  }
}

// Helper function to map EffectiveRole back to display string
export function getDisplayRoleName(role: EffectiveRole): string {
  const roleMap: Record<EffectiveRole, string> = {
    'PlatformOwner': 'Platform Owner',
    'Administrator': 'Administrator',
    'ProjectAdmin': 'Project Admin',
    'BIMSpecialist': 'BIM Specialist',
    'BIMCoordinator': 'BIM Coordinator',
    'BIMManager': 'BIM Manager',
    'Contractor': 'Contractor',
    'Designer': 'Designer',
    'FacilityManager': 'Facility Manager',
    'MaintenanceTeam': 'Maintenance Team',
    'Planner': 'Planner',
    'Other': 'Other',
    'User': 'General',
    'AdministratorPending': 'Administrator (Pending)'
  };
  
  return roleMap[role] || 'General';
}

// Helper function to get platform-level role (for dashboard display)
export function getPlatformRole(user: any, email: string): 'Platform Owner' | 'Administrator' | 'General User' {
  if (isPlatformOwnerEmail(email)) return 'Platform Owner';
  if (getApprovedAdminCompanies(user).length > 0) return 'Administrator';
  return 'General User';
}

export async function canDeleteProject(db: any, project: any, email: string, user: any): Promise<boolean> {
  if (!email || !user || !project) return false;
  if (isPlatformOwnerEmail(email)) return true;
  // Administrator for this project's company can delete
  if (isApprovedAdministratorForCompany(user, project.company)) return true;
  // Project Administrators CANNOT delete projects
  return false;
}

export async function canUpdateProject(db: any, project: any, email: string, user: any): Promise<boolean> {
  if (!email || !user || !project) return false;
  if (isPlatformOwnerEmail(email)) return true;
  if (isApprovedAdministratorForCompany(user, project.company)) return true;
  // ProjectAdmin within this project can update
  const isPA = await isProjectAdmin(db, String(project._id), email);
  return !!isPA;
}

export async function canModifyModels(db: any, project: any, email: string, user: any): Promise<boolean> {
  // Same rule as update
  return canUpdateProject(db, project, email, user);
}

export async function canManageAccess(db: any, project: any, email: string, user: any): Promise<boolean> {
  if (!email || !user || !project) return false;
  if (isPlatformOwnerEmail(email)) return true;
  if (isApprovedAdministratorForCompany(user, project.company)) return true;
  // ProjectAdmin within this project can manage access (except appointing other PAs)
  const isPA = await isProjectAdmin(db, String(project._id), email);
  return !!isPA;
}

export async function canInvite(db: any, project: any, email: string, user: any): Promise<boolean> {
  return canManageAccess(db, project, email, user);
}

export async function canMakeProjectAdmin(db: any, project: any, email: string, user: any): Promise<boolean> {
  if (!email || !user || !project) return false;
  if (isPlatformOwnerEmail(email)) return true;
  if (isApprovedAdministratorForCompany(user, project.company)) return true;
  return false; // Project Admin cannot appoint other PAs
}

export async function ensurePendingAdminForCompany(db: any, user: any, company?: string | null) {
  if (!user || !company) return;
  const arr: AdminCompanyEntry[] = Array.isArray(user.adminCompanies) ? user.adminCompanies : [];
  const idx = arr.findIndex((e) => (e.company || '').toLowerCase() === String(company).toLowerCase());
  if (idx >= 0) return; // already present (any status)
  const newEntry: AdminCompanyEntry = { company, status: 'pending' };
  await db.collection('users').updateOne(
    { _id: user._id },
    { $push: { adminCompanies: newEntry } }
  );
}

export async function ensurePendingAdminForCompanyByEmail(db: any, email: string, company?: string | null) {
  if (!email || !company) return;
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return ensurePendingAdminForCompany(db, existing, company);
  }
  // create minimal user doc with pending admin entry
  const newUser = {
    email,
    adminCompanies: [ { company, status: 'pending' } as AdminCompanyEntry ],
    createdAt: new Date(),
  };
  await db.collection('users').insertOne(newUser);
}

export type EffectiveRole = 
  | 'PlatformOwner' 
  | 'Administrator' 
  | 'ProjectAdmin' 
  | 'BIMSpecialist'
  | 'BIMCoordinator'
  | 'BIMManager'
  | 'Contractor'
  | 'Designer'
  | 'FacilityManager'
  | 'MaintenanceTeam'
  | 'Planner'
  | 'Other'
  | 'User' 
  | 'AdministratorPending';

// Helper function to map project role strings to EffectiveRole enum
function mapProjectRoleToEffective(roleString: string): EffectiveRole {
  const normalized = String(roleString || '').replace(/\s+/g, '').toLowerCase();
  
  switch (normalized) {
    case 'projectadmin':
    case 'projectadministrator':
      return 'ProjectAdmin';
    case 'bimspecialist':
      return 'BIMSpecialist';
    case 'bimcoordinator':
      return 'BIMCoordinator';
    case 'bimmanager':
      return 'BIMManager';
    case 'contractor':
      return 'Contractor';
    case 'designer':
      return 'Designer';
    case 'facilitymanager':
      return 'FacilityManager';
    case 'maintenanceteam':
      return 'MaintenanceTeam';
    case 'planner':
      return 'Planner';
    case 'other':
      return 'Other';
    case 'general':
    default:
      return 'User';
  }
}

export async function getEffectiveRole(db: any, project: any, email: string, user: any): Promise<EffectiveRole> {
  if (!email || !user) return 'User';
  if (isPlatformOwnerEmail(email)) return 'PlatformOwner';
  
  // For project context
  if (project) {
    // Check if user owns this project AND is Administrator
    if (isApprovedAdministratorForCompany(user, project.company) && 
        String(project.userId) === String(user._id)) {
      return 'Administrator'; // Full admin access in own project
    }
    
    // Check project-specific invite role
    const invite = await getAcceptedInvite(db, String(project._id), email);
    if (invite) {
      return mapProjectRoleToEffective(invite.invitee.role);
    }
  }
  
  // Platform level (no project context) - check if user is Administrator
  if (isApprovedAdministratorForCompany(user, project?.company)) return 'Administrator';
  
  // If they have pending admin for this company
  const pend = (Array.isArray(user?.adminCompanies) ? user.adminCompanies : []) as AdminCompanyEntry[];
  const normProjCompany = String(project?.company || '').trim().toLowerCase();
  const hasPendingForProjectOrGlobal = pend.some((e) => {
    const c = String(e?.company || '').trim().toLowerCase();
    return e?.status === 'pending' && (c === normProjCompany || c === '(unspecified)');
  });
  if (hasPendingForProjectOrGlobal) return 'AdministratorPending';
  
  return 'User';
}
