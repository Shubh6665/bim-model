import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { isPlatformOwnerEmail } from '@/app/lib/rbac';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

// GET /api/admins -> list pending and approved admin entries (Platform Owner only)
// Query param: ?type=pending|approved (defaults to pending for backward compatibility)
export async function GET(req: NextRequest) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isPlatformOwnerEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'pending';

    const db = await getDb();
    
    if (type === 'approved') {
      // Return users with approved adminCompanies entries
      const users = await db
        .collection('users')
        .find({ 'adminCompanies.status': 'approved' })
        .project({ email: 1, adminCompanies: 1, name: 1 })
        .toArray();

      // Expand into flattened list (email, company, status, name)
      const approved: Array<{ email: string; company: string; status: 'approved'; name?: string }> = [];
      for (const u of users) {
        // Skip platform owners - they cannot be removed as administrators
        if (isPlatformOwnerEmail(u.email)) continue;
        
        const arr = Array.isArray(u.adminCompanies) ? u.adminCompanies : [];
        for (const entry of arr) {
          if (entry?.status === 'approved' && entry?.company) {
            approved.push({ 
              email: u.email, 
              company: entry.company, 
              status: 'approved',
              name: u.name 
            });
          }
        }
      }

      return NextResponse.json({ approved });
    } else {
      // Return users with any pending adminCompanies entries (existing behavior)
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
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/admins -> approve/reject pending admin or remove approved admin
// body: { email: string, company: string, action: 'approve' | 'reject' | 'remove' }
export async function PATCH(req: NextRequest) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isPlatformOwnerEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { email: targetEmail, company, action } = body || {};
    if (!targetEmail || !company || !['approve', 'reject', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'email, company and action (approve|reject|remove) are required' }, { status: 400 });
    }

    const db = await getDb();

    // Normalize company for comparison
    const normalizedCompany = String(company).trim().toLowerCase();

    // Fetch user to find the exact stored company string for the entry
    const userDoc = await db.collection('users').findOne({ email: { $regex: `^${escapeRegExp(String(targetEmail))}$`, $options: 'i' } });
    const adminCompanies = Array.isArray(userDoc?.adminCompanies) ? userDoc.adminCompanies : [];
    const matchingEntry = adminCompanies.find((e: any) =>
      e && typeof e.company === 'string'
      && e.company.trim().toLowerCase() === normalizedCompany
    );

    if (!matchingEntry) {
      return NextResponse.json({ error: 'No admin entry found for this email/company' }, { status: 404 });
    }

    const companyKey = matchingEntry.company; // exact stored value
    const currentStatus = String(matchingEntry.status || '').toLowerCase();

    if (action === 'remove') {
      // Prevent removing platform owners
      if (isPlatformOwnerEmail(targetEmail)) {
        return NextResponse.json({ error: 'Cannot remove platform owner administrator access' }, { status: 400 });
      }
      
      // Remove approved administrator
      if (currentStatus !== 'approved') {
        return NextResponse.json({ error: 'Can only remove approved administrators' }, { status: 400 });
      }

      // Remove the admin entry entirely
      const res = await db.collection('users').updateOne(
        { email: { $regex: `^${escapeRegExp(String(targetEmail))}$`, $options: 'i' } },
        { $pull: { adminCompanies: { company: companyKey, status: 'approved' } } } as any
      );

      if (res.matchedCount === 0 || res.modifiedCount === 0) {
        return NextResponse.json({ error: 'Failed to remove administrator' }, { status: 404 });
      }

      return NextResponse.json({ success: true, email: targetEmail, company: companyKey, action: 'removed' });
    } else {
      // Handle approve/reject for pending admins
      const status = action === 'approve' ? 'approved' : 'rejected';
      const desiredStatus = String(status).toLowerCase();

      // If already in desired status, respond idempotently
      if (currentStatus === desiredStatus) {
        return NextResponse.json({ success: true, email: targetEmail, company: companyKey, status });
      }

      // If not pending and different status, conflict
      if (currentStatus !== 'pending' && currentStatus !== desiredStatus) {
        return NextResponse.json({ error: `Entry already ${currentStatus}` }, { status: 409 });
      }

      // Update only the matching PENDING entry using exact stored company string
      let res = await db.collection('users').updateOne(
        { email: { $regex: `^${escapeRegExp(String(targetEmail))}$`, $options: 'i' } },
        { $set: { 'adminCompanies.$[elem].status': status } },
        { arrayFilters: [ { 'elem.company': companyKey, 'elem.status': { $regex: '^pending$', $options: 'i' } } ] }
      );

      // Fallback: trim-tolerant, case-insensitive company match if no modification
      if (res.modifiedCount === 0) {
        const companyPattern = `^\\s*${escapeRegExp(String(companyKey).trim())}\\s*$`;
        res = await db.collection('users').updateOne(
          { email: { $regex: `^${escapeRegExp(String(targetEmail))}$`, $options: 'i' } },
          { $set: { 'adminCompanies.$[elem].status': status } },
          { arrayFilters: [ { 'elem.company': { $regex: companyPattern, $options: 'i' }, 'elem.status': { $regex: '^pending$', $options: 'i' } } ] }
        );
      }

      if (res.matchedCount === 0 || res.modifiedCount === 0) {
        return NextResponse.json({ error: 'No pending admin entry found for this email/company' }, { status: 404 });
      }

      return NextResponse.json({ success: true, email: targetEmail, company: companyKey, status });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
