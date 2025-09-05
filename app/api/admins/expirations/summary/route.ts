import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { isPlatformOwnerEmail } from '@/app/lib/rbac';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || '';
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isPlatformOwnerEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await getDb();
    const users = await db.collection('users')
      .find({ 'adminCompanies': { $elemMatch: { status: 'approved', expiresAt: { $exists: true } } } })
      .project({ email: 1, name: 1, adminCompanies: 1 })
      .toArray();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const dueToday: Array<{ email: string; name?: string; company: string; date: string }> = [];
    const dueTomorrow: Array<{ email: string; name?: string; company: string; date: string }> = [];

    for (const u of users) {
      const arr = Array.isArray(u.adminCompanies) ? u.adminCompanies : [];
      for (const entry of arr) {
        if (entry?.status !== 'approved' || !entry?.expiresAt) continue;
        const exp = new Date(entry.expiresAt);
        const expStart = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
        if (expStart.getTime() === startOfToday.getTime()) {
          dueToday.push({ email: u.email, name: u.name, company: entry.company, date: expStart.toISOString() });
        } else if (expStart.getTime() === startOfTomorrow.getTime()) {
          dueTomorrow.push({ email: u.email, name: u.name, company: entry.company, date: expStart.toISOString() });
        }
      }
    }

    return NextResponse.json({ dueToday, dueTomorrow });
  } catch (err: any) {
    console.error('[expirations/summary] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
