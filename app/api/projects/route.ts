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

// GET: List projects for user
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
    if (!email) return NextResponse.json({ projects: [] });
    const user = await db.collection('users').findOne({ email });
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
    [...ownedProjects, ...invitedProjects].forEach((p: any) => {
      const key = String(p._id);
      if (!byId.has(key)) {
        // attach access
        const isOwner = user && String(p.userId) === String(user._id);
        let access = { 
          role: 'Owner', 
          packages: ['BIM', 'IoT', 'Database', 'AI', 'FM'] as string[],
          owner: true
        };
        if (!isOwner) {
          const inv = inviteByProject.get(key);
          if (inv) {
            access = {
              role: inv?.invitee?.role || 'General',
              packages: Array.isArray(inv?.invitee?.packages) ? inv.invitee.packages : [],
              owner: false
            };
          } else {
            access = {
              role: 'General',
              packages: [],
              owner: false
            };
          }
        }
        byId.set(key, { ...p, access });
      }
    });
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
      user = { _id: result.insertedId, email };
    }

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
      models
    } = body;
    console.log('POST /api/projects body:', body);
    // Validation: allow either (legacy) single urn OR (new) models array
    const hasLegacyUrn = typeof urn === 'string' && urn.length > 0;
    const hasModelsArray = Array.isArray(models) && models.length > 0;
    if (!name || isNaN(lat) || isNaN(lng) || (!hasLegacyUrn && !hasModelsArray)) {
      console.error('Missing required fields:', { name, urn, modelsCount: hasModelsArray ? models.length : 0, lat, lng });
      return NextResponse.json({ error: 'Missing required fields: require name, lat, lng, and either urn or models[]' }, { status: 400 });
    }

    // Save project to DB
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
      return NextResponse.json({ project: { ...project, _id: result.insertedId } });
    } catch (err) {
      console.error('Failed to insert project:', err, 'Project:', project);
      return NextResponse.json({ error: 'Failed to insert project', details: String(err), project }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
} 