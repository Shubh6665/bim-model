import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';

// Helper to get user email (replace with real auth/session in production)
async function getUserEmail(req: NextRequest): Promise<string> {
  // TODO: Replace with real session extraction
  return 'demo-user@gmail.com';
}

// GET: List projects for user
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const email = await getUserEmail(req);
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
    let user = await db.collection('users').findOne({ email });
    if (!user) {
      // Create user if not exists
      const result = await db.collection('users').insertOne({ email, createdAt: new Date() });
      user = { _id: result.insertedId, email };
    }

    // Parse JSON body
    const { name, urn, lat, lng, description } = await req.json();
    if (!name || !urn || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save project to DB
    const project = {
      userId: user._id,
      name,
      urn,
      location: { lat, lng },
      description: description || '',
      createdAt: new Date(),
    };
    const result = await db.collection('projects').insertOne(project);
    return NextResponse.json({ project: { ...project, _id: result.insertedId } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 