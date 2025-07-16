import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

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
    if (!user) return NextResponse.json({ projects: [] });
    const projects = await db.collection('projects').find({ userId: user._id }).toArray();
    return NextResponse.json({ projects });
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
      company, surname, clientName, lat, lng, urn, fileType, description
    } = body;
    console.log('POST /api/projects body:', body);
    if (!name || !urn || isNaN(lat) || isNaN(lng)) {
      console.error('Missing required fields:', { name, urn, lat, lng });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      urn,
      fileType: fileType || '',
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