import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getApprovedAdminCompanies, isPlatformOwnerEmail } from '@/app/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || null;
    if (!email) return NextResponse.json({ match: false, reason: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const company = (searchParams.get('company') || searchParams.get('name') || '').trim();

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ match: false, approvedCompanies: [], isOwner: false });

    const isOwner = isPlatformOwnerEmail(email);
    const approved = getApprovedAdminCompanies(user);

    if (!company) {
      return NextResponse.json({ match: false, approvedCompanies: approved, isOwner });
    }

    // Platform owner can proceed regardless; still return approved list for UI hints
    if (isOwner) {
      return NextResponse.json({ match: true, approvedCompanies: approved, isOwner });
    }

    const match = approved.map(c => c.toLowerCase()).includes(company.toLowerCase());
    return NextResponse.json({ match, approvedCompanies: approved, isOwner });
  } catch (err: any) {
    return NextResponse.json({ match: false, error: err?.message || 'Error' }, { status: 500 });
  }
}
