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
  if (!user || !company) return false;
  const approvedCompanies = getApprovedAdminCompanies(user);
  return approvedCompanies.map((c) => c.toLowerCase()).includes(String(company).toLowerCase());
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
  // Project Administrators and General users cannot create projects
  return false;
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
  // ProjectAdmin within this project can manage access
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

export type EffectiveRole = 'PlatformOwner' | 'Administrator' | 'ProjectAdmin' | 'User' | 'AdministratorPending';

export async function getEffectiveRole(db: any, project: any, email: string, user: any): Promise<EffectiveRole> {
  if (!email || !user) return 'User';
  if (isPlatformOwnerEmail(email)) return 'PlatformOwner';
  if (isApprovedAdministratorForCompany(user, project?.company)) return 'Administrator';
  // If they have pending admin for this company
  const pend = (Array.isArray(user?.adminCompanies) ? user.adminCompanies : []) as AdminCompanyEntry[];
  if (project?.company && pend.some((e) => e.company?.toLowerCase() === String(project.company).toLowerCase() && e.status === 'pending')) {
    return 'AdministratorPending';
  }
  const isPA = project?._id ? await isProjectAdmin(db, String(project._id), email) : false;
  return isPA ? 'ProjectAdmin' : 'User';
}
