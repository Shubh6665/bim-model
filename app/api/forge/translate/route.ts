import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  try {
    const { urn } = await req.json();
    if (!urn) {
      return NextResponse.json({ error: 'URN is required' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // Start translation job
    const translationResponse = await fetch('https://developer.api.autodesk.com/modelderivative/v2/designdata/job', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-force': 'true', // Force translation even if already translated
      },
      body: JSON.stringify({
        input: {
          urn: urn,
        },
        output: {
          formats: [
            {
              type: 'svf',
              views: ['2d', '3d'],
            },
          ],
        },
      }),
    });

    if (translationResponse.status === 409) {
      // Conflict: translation already in progress
      return NextResponse.json({ success: true, conflict: true, urn });
    }

    if (!translationResponse.ok) {
      const errorText = await translationResponse.text();
      console.error('Translation failed:', errorText);
      return NextResponse.json({ 
        error: 'Failed to start translation', 
        details: errorText 
      }, { status: 500 });
    }

    const translationData = await translationResponse.json();
    console.log('Translation started:', translationData);

    return NextResponse.json({
      success: true,
      urn: urn,
      result: translationData.result,
      jobId: translationData.result,
    });

  } catch (error: any) {
    console.error('Translation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Translation failed' 
    }, { status: 500 });
  }
}
