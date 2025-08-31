import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { canCreateProject } from '@/app/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || null;
    if (!email) return NextResponse.json({ canCreate: false });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ canCreate: false });

    const allowed = await canCreateProject(db, email, user);
    
    // Debug logging to help identify the issue
    console.log('[can-create] Debug:', {
      email,
      userId: user._id,
      adminCompanies: user.adminCompanies,
      allowed
    });
    
    // Add cache headers to prevent caching of this endpoint
    const response = NextResponse.json({ canCreate: !!allowed });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (err: any) {
    console.error('[can-create] Error:', err);
    return NextResponse.json({ canCreate: false, error: err?.message || 'Error' }, { status: 500 });
  }
}
