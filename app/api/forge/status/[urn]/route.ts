import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';

async function getAccessToken() {
  const clientId = process.env.FORGE_CLIENT_ID;
  const clientSecret = process.env.FORGE_CLIENT_SECRET;
  const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'client_credentials',
      scope: 'data:read data:write data:create bucket:create bucket:read',
    }),
  });
  if (!response.ok) throw new Error('Failed to get Forge access token');
  const data = await response.json();
  return data.access_token;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ urn: string }> }
) {
  try {
    const { urn } = await context.params;
    if (!urn) {
      return NextResponse.json({ error: 'URN is required' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // Check translation status
    const statusResponse = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        return NextResponse.json({ 
          status: 'pending',
          message: 'Translation job not found or still processing'
        });
      }
      const errorText = await statusResponse.text();
      return NextResponse.json({ 
        error: 'Failed to check status', 
        details: errorText 
      }, { status: 500 });
    }

    const statusData = await statusResponse.json();
    console.log('Translation status:', statusData);

    // Check if translation is complete
    const progress = statusData.progress || '0%';
    const status = statusData.status || 'pending';

    if (status === 'success' && (progress === '100%' || progress === 'complete')) {
      // Record success in Mongo (best-effort)
      try {
        const db = await getDb();
        await db.collection('forge_models').updateOne(
          { urn },
          { $set: { urn, status: 'success', updatedAt: Date.now() }, $setOnInsert: { createdAt: Date.now(), cacheHits: 0 } },
          { upsert: true }
        );
      } catch {}
      return NextResponse.json({
        status: 'success',
        urn: urn,
        progress: progress,
        message: 'Translation completed successfully'
      });
    } else if (status === 'failed') {
      try {
        const db = await getDb();
        await db.collection('forge_models').updateOne(
          { urn },
          { $set: { urn, status: 'failed', updatedAt: Date.now(), manifest: statusData } },
          { upsert: true }
        );
      } catch {}
      return NextResponse.json({
        status: 'failed',
        urn: urn,
        progress: progress,
        message: 'Translation failed',
        details: statusData
      });
    } else {
      try {
        const db = await getDb();
        await db.collection('forge_models').updateOne(
          { urn },
          { $set: { urn, status: 'pending', updatedAt: Date.now() } },
          { upsert: true }
        );
      } catch {}
      return NextResponse.json({
        status: 'pending',
        urn: urn,
        progress: progress,
        message: 'Translation in progress'
      });
    }

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json({ 
      error: error.message || 'Status check failed' 
    }, { status: 500 });
  }
} 