import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';
import { canCreateProject, getApprovedAdminCompanies, getEffectiveRole, isPlatformOwnerEmail } from '@/app/lib/rbac';
import nodemailer from 'nodemailer';

// Email notification for auto-created admin invites
async function sendAdminInviteEmail(email: string, projectName: string, company: string, token: string) {
  try {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const userSmtp = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    if (host && userSmtp && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: userSmtp, pass },
      });

      const acceptUrl = `${appBaseUrl}/invite/${token}`;
      
      await transporter.sendMail({
        from: userSmtp,
        to: email,
        subject: `You've been made Project Administrator for ${projectName}`,
        html: `
          <h2>Project Administrator Invitation</h2>
          <p>You have been appointed as Project Administrator for the project <strong>${projectName}</strong> in company <strong>${company}</strong>.</p>
          <p>Click the link below to accept your invitation and access the project:</p>
          <a href="${acceptUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
          <p>If the button doesn't work, copy and paste this URL into your browser:</p>
          <p>${acceptUrl}</p>
        `,
      });
      console.log('Admin invite email sent to:', email);
    }
  } catch (error) {
    console.warn('Failed to send admin invite email to', email, error);
  }
}

// Helper to get user email from session
async function getUserEmail(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

// GET: List projects for user
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
    if (!email) return NextResponse.json({ projects: [] });
    const user = await db.collection('users').findOne({ email });
    // Platform Owner: return ALL projects with full package access
    if (isPlatformOwnerEmail(email)) {
      const all = await db.collection('projects').find({}).toArray();
      const packages = ['BIM','IoT','Database','AI','FM'];
      const mapped = all.map((p: any) => ({
        ...p,
        access: {
          role: 'PlatformOwner',
          packages,
          owner: !!(user && String(p.userId) === String(user._id)),
        },
        models: Array.isArray(p.models) ? p.models : [],
      }));
      return NextResponse.json({ projects: mapped });
    }

    // Owned projects (if user exists)
    const ownedFilter = user ? { userId: user._id } : { _id: { $in: [] } };
    const ownedProjects = await db.collection('projects').find(ownedFilter).toArray();

    // Invited projects with accepted status for this email
    const acceptedInvites = await db
      .collection('invites')
      .find({ 'invitee.email': email, status: 'accepted' })
      .toArray();
    const invitedProjectIds = acceptedInvites.map((i: any) => i.projectId).filter(Boolean);
    const invitedProjects = invitedProjectIds.length
      ? await db
          .collection('projects')
          .find({ _id: { $in: invitedProjectIds } })
          .toArray()
      : [];

    // Union projects by _id
    const byId = new Map<string, any>();
    // index invites by projectId
    const inviteByProject = new Map<string, any>();
    acceptedInvites.forEach((inv: any) => inviteByProject.set(String(inv.projectId), inv));

    // merge
    const combined = [...ownedProjects, ...invitedProjects];
    for (const p of combined) {
      const key = String(p._id);
      if (!byId.has(key)) {
        // attach access via RBAC effective role
        const isOwner = user && String(p.userId) === String(user._id);
        const inv = inviteByProject.get(key);
        const packages = Array.isArray(inv?.invitee?.packages) ? inv.invitee.packages : [];
        // Compute role
        // Note: getEffectiveRole may use invite role internally for PA; we still pass packages separately
        const role = await getEffectiveRole(db, p, email, user);
        byId.set(key, { ...p, access: { role, packages, owner: !!isOwner } });
      }
    }
    const union = Array.from(byId.values());

    // Ensure backward compatibility: always provide models array
    const normalized = union.map((p: any) => ({
      ...p,
      models: Array.isArray(p.models) ? p.models : [],
    }));
    return NextResponse.json({ projects: normalized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save new project (name, urn, location)
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    let user = await db.collection('users').findOne({ email });
    if (!user) {
      // Create user if not exists
      const result = await db.collection('users').insertOne({ email, createdAt: new Date() });
      user = { _id: result.insertedId, email } as any;
    }

    // Safety guard
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Check RBAC: allow owner/admin; allow others to create but they will be pending Admin for company
    const allowed = await canCreateProject(db, email, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Parse JSON body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      console.error('Failed to parse JSON body:', err);
      return NextResponse.json({ error: 'Invalid JSON body', details: String(err) }, { status: 400 });
    }
    const {
      name, code, country, municipality, address, cadastral,
      company, surname, clientName, lat, lng, urn, fileType, description,
      models,
      adminEmails
    } = body;
    console.log('POST /api/projects body:', body);
    // Validation: allow either (legacy) single urn OR (new) models array
    const hasLegacyUrn = typeof urn === 'string' && urn.length > 0;
    const hasModelsArray = Array.isArray(models) && models.length > 0;
    if (!name || isNaN(lat) || isNaN(lng) || (!hasLegacyUrn && !hasModelsArray)) {
      console.error('Missing required fields:', { name, urn, modelsCount: hasModelsArray ? models.length : 0, lat, lng });
      return NextResponse.json({ error: 'Missing required fields: require name, lat, lng, and either urn or models[]' }, { status: 400 });
    }

    // Enforce company match for non-platform owners: company must be one of approved admin companies (case-insensitive)
    const isOwner = isPlatformOwnerEmail(email);
    const companyTrimmed = (company || '').trim();
    if (!isOwner) {
      if (!companyTrimmed) {
        return NextResponse.json({ error: 'Company is required for project creation.' }, { status: 400 });
      }
      const approved = getApprovedAdminCompanies(user).map((c) => c.toLowerCase());
      const match = approved.includes(companyTrimmed.toLowerCase());
      if (!match) {
        return NextResponse.json({ error: 'Company does not match your approved administrator companies.', approvedCompanies: approved }, { status: 400 });
      }
    }

    // Save project to DB (owner is the user creating it)
    const project = {
      userId: user._id,
      name,
      code: code || '',
      country: country || '',
      municipality: municipality || '',
      address: address || '',
      cadastral: cadastral || '',
      company: company || '',
      surname: surname || '',
      clientName: clientName || '',
      urn: hasLegacyUrn ? urn : '',
      fileType: hasLegacyUrn ? (fileType || '') : '',
      models: hasModelsArray
        ? models.map((m: any) => ({
            id: m.id || new ObjectId().toHexString(),
            name: m.name || 'Model',
            discipline: m.discipline || 'other',
            urn: m.urn,
            fileType: m.fileType || '',
            transform: m.transform || null,
          }))
        : [],
      location: { lat, lng },
      description: description || '',
      createdAt: new Date(),
    };
    try {
      const result = await db.collection('projects').insertOne(project);
      const created = { ...project, _id: result.insertedId } as any;

      // Auto-create accepted ProjectAdmin invites for provided adminEmails and send notification emails
      if (Array.isArray(adminEmails)) {
        for (const e of adminEmails) {
          const target = (typeof e === 'string' ? e.trim().toLowerCase() : '').trim();
          if (!target) continue;
          try {
            const inviteToken = new ObjectId().toHexString();
            await db.collection('invites').insertOne({
              projectId: created._id,
              inviterUserId: user._id,
              invitee: {
                name: '',
                surname: '',
                email: target,
                role: 'Project Administrator',
                society: company || '',
                packages: ['BIM','IoT','Database','AI','FM'],
              },
              status: 'accepted',
              token: inviteToken,
              createdAt: new Date(),
            });
            
            // Send notification email
            await sendAdminInviteEmail(target, created.name, company || '', inviteToken);
          } catch (ie) {
            console.warn('Failed to create accepted ProjectAdmin invite for', target, ie);
          }
        }
      }

      // Attach access using effective role
      const role = await getEffectiveRole(db, created, email, user);
      const access = { role, packages: [], owner: String(created.userId) === String(user._id) };
      return NextResponse.json({ project: { ...created, access } });
    } catch (err) {
      console.error('Failed to insert project:', err, 'Project:', project);
      return NextResponse.json({ error: 'Failed to insert project', details: String(err), project }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
} 