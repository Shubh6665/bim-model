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
    const companyRaw: string = (body?.company || '').trim();
    const email: string = (body?.email || sessionEmail).trim();

    // Normalize empty company to a placeholder so it appears in pending list and can be approved
    const normalizedCompany = companyRaw || '(unspecified)';

    const db = await getDb();
    await ensurePendingAdminForCompanyByEmail(db, email, normalizedCompany);

    return NextResponse.json({ success: true, email, company: normalizedCompany, status: 'pending' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
