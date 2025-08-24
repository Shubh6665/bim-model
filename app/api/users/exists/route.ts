import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';

// GET /api/users/exists?email=...
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: { $regex: `^${email}$`, $options: 'i' } });

    return NextResponse.json({ exists: !!user });
  } catch (err: any) {
    console.error('Error checking user existence:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
