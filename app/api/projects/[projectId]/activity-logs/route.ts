/**
 * Activity Logs API
 * GET /api/projects/[projectId]/activity-logs
 * Fetch activity logs for a ticket or work order
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { getDb } from '@/app/services/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { projectId } = await context.params;
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get('ticketId');
    const workOrderId = searchParams.get('work-orderId');

    if (!ticketId && !workOrderId) {
      return NextResponse.json({ error: 'Either ticketId or work-orderId is required' }, { status: 400 });
    }

    const db = await getDb();
    const logsCol = db.collection('activity_logs');

    const query: any = { projectId: new ObjectId(projectId) };
    
    if (ticketId) {
      query.ticketId = new ObjectId(ticketId);
    }
    
    if (workOrderId) {
      query.workOrderId = new ObjectId(workOrderId);
    }

    const logs = await logsCol
      .find(query)
      .sort({ timestamp: -1 }) // Most recent first
      .limit(100)
      .toArray();

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('[Activity Logs] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
