import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { isPlatformOwnerEmail } from '@/app/lib/rbac';

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

// GET /api/admins -> list pending admin entries (Platform Owner only)
export async function GET() {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isPlatformOwnerEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await getDb();
    // Return users with any pending adminCompanies entries
    const users = await db
      .collection('users')
      .find({ 'adminCompanies.status': 'pending' })
      .project({ email: 1, adminCompanies: 1 })
      .toArray();

    // Expand into flattened list (email, company, status)
    const pending: Array<{ email: string; company: string; status: 'pending' }> = [];
    for (const u of users) {
      const arr = Array.isArray(u.adminCompanies) ? u.adminCompanies : [];
      for (const entry of arr) {
        if (entry?.status === 'pending' && entry?.company) {
          pending.push({ email: u.email, company: entry.company, status: 'pending' });
        }
      }
    }

    return NextResponse.json({ pending });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/admins -> approve or reject an admin entry
// body: { email: string, company: string, action: 'approve' | 'reject' }
export async function PATCH(req: NextRequest) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isPlatformOwnerEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { email: targetEmail, company, action } = body || {};
    if (!targetEmail || !company || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'email, company and action (approve|reject) are required' }, { status: 400 });
    }

    const db = await getDb();
    const status = action === 'approve' ? 'approved' : 'rejected';

    // Case-insensitive match on company when updating the array element
    const res = await db.collection('users').updateOne(
      { email: targetEmail },
      { $set: { 'adminCompanies.$[elem].status': status } },
      { arrayFilters: [ { 'elem.company': { $regex: `^${company}$`, $options: 'i' } } ] }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: 'No pending admin entry found for this email/company' }, { status: 404 });
    }

    return NextResponse.json({ success: true, email: targetEmail, company, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
