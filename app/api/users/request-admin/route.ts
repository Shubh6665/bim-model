import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ensurePendingAdminForCompany, isPlatformOwnerEmail } from '@/app/lib/rbac';

// POST /api/users/request-admin
// Allows a user to request Administrator access for a specific company
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { company } = await req.json();
    // Accept empty company; map to global '(unspecified)'
    const rawCompany = typeof company === 'string' ? company : '';
    const sanitizedCompany = (rawCompany.trim().length === 0
      ? '(unspecified)'
      : rawCompany.trim()
    ).substring(0, 100); // Limit length

    // Platform Owner cannot request admin access (they already have full access)
    if (isPlatformOwnerEmail(session.user.email)) {
      return NextResponse.json({ error: 'Platform Owner already has full access' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has pending or approved admin for this company
    const existingAdminEntries = Array.isArray(user.adminCompanies) ? user.adminCompanies : [];
    const normalizedCompany = sanitizedCompany.toLowerCase();
    const existingEntry = existingAdminEntries.find((entry: any) => 
      String(entry.company || '').trim().toLowerCase() === normalizedCompany
    );

    if (existingEntry) {
      if (existingEntry.status === 'approved') {
        return NextResponse.json({ error: 'You are already an Administrator for this company' }, { status: 400 });
      } else if (existingEntry.status === 'pending') {
        return NextResponse.json({ error: 'You already have a pending Administrator request for this company' }, { status: 400 });
      }
    }

    // Rate limiting: Check for recent requests (last 24 hours)
    const recentRequests = existingAdminEntries.filter((entry: any) => {
      const entryDate = entry.requestedAt || new Date(0);
      const timeDiff = Date.now() - new Date(entryDate).getTime();
      return timeDiff < 24 * 60 * 60 * 1000; // 24 hours
    });

    if (recentRequests.length >= 3) {
      return NextResponse.json({ error: 'Too many requests. Please wait 24 hours before requesting again.' }, { status: 429 });
    }

    // Add pending admin request
    await ensurePendingAdminForCompany(db, user, sanitizedCompany);

    return NextResponse.json({ 
      message: 'Administrator access request submitted successfully. Please wait for Platform Owner approval.',
      company: sanitizedCompany,
      status: 'pending'
    });

  } catch (error: any) {
    console.error('Error requesting admin access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/users/request-admin
// Get current admin requests status for the user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ adminRequests: [] });
    }

    const adminRequests = Array.isArray(user.adminCompanies) ? user.adminCompanies : [];
    
    return NextResponse.json({ adminRequests });

  } catch (error: any) {
    console.error('Error getting admin requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
