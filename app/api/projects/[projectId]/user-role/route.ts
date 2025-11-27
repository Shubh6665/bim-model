/**
 * User Role API Endpoint
 * GET /api/projects/[projectId]/user-role
 * Returns current user's maintenance role
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { getUserMaintenanceRole } from '@/app/lib/maintenance-roles';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ role: null }, { status: 200 });
    }

    const { projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const db = await getDb();
    const role = await getUserMaintenanceRole(db, projectId, userEmail);

    return NextResponse.json({ role, email: userEmail });
  } catch (error: any) {
    console.error('[User Role] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
