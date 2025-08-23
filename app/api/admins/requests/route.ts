import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ensurePendingAdminForCompanyByEmail } from '@/app/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email;
    if (!sessionEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const company: string | undefined = (body?.company || '').trim();
    const email: string = (body?.email || sessionEmail).trim();

    if (!company) {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
    }

    const db = await getDb();
    await ensurePendingAdminForCompanyByEmail(db, email, company);

    return NextResponse.json({ success: true, email, company, status: 'pending' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
