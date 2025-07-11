import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.FORGE_CLIENT_ID;
    const clientSecret = process.env.FORGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log('⚠️ No Forge credentials found, using demo token');
      return NextResponse.json({
        access_token: 'demo-token-fallback',
        token_type: 'Bearer',
        expires_in: 3600
      });
    }

    const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'viewables:read data:read bucket:read'
      })
    });

    if (!response.ok) {
      throw new Error(`Forge API error: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json();
    console.log('🔐 Forge token obtained successfully');
    
    return NextResponse.json(tokenData);
  } catch (error) {
    console.error('❌ Failed to get Forge token:', error);
    
    // Return demo token as fallback
    return NextResponse.json({
      access_token: 'demo-token-fallback',
      token_type: 'Bearer',
      expires_in: 3600
    });
  }
}