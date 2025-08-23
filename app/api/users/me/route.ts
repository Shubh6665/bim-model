import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';

// GET /api/users/me -> returns platform-level profile for the logged-in user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    const profile = {
      name: user?.name || '',
      surname: user?.surname || '',
      email,
      society: user?.society || '',
      telephone: user?.telephone || '',
      avatarUrl: user?.avatarUrl || '',
    };

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error('GET /api/users/me error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/users/me -> upsert platform-level profile for the logged-in user
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { name = '', surname = '', society = '', telephone = '', avatarUrl = '' } = body || {};

    if (telephone && !/^\+?[0-9]{7,15}$/.test(telephone)) {
      return NextResponse.json({ error: 'Invalid telephone number. Use digits with optional leading +country code.' }, { status: 400 });
    }

    const db = await getDb();

    await db.collection('users').updateOne(
      { email },
      {
        $set: {
          email,
          name: String(name || ''),
          surname: String(surname || ''),
          society: String(society || ''),
          telephone: String(telephone || ''),
          avatarUrl: String(avatarUrl || ''),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    const saved = await db.collection('users').findOne({ email });

    const profile = {
      name: saved?.name || '',
      surname: saved?.surname || '',
      email,
      society: saved?.society || '',
      telephone: saved?.telephone || '',
      avatarUrl: saved?.avatarUrl || '',
    };

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    console.error('PUT /api/users/me error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
