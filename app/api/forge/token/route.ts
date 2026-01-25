import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for Forge token
interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

let tokenCache: CachedToken | null = null;

// Buffer time before token expiry (5 minutes in ms)
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

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

    // Check if cached token is still valid
    const now = Date.now();
    if (tokenCache && now < tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER) {
      console.log('🔐 Using cached Forge token (expires in', 
        Math.round((tokenCache.expiresAt - now) / 1000 / 60), 'minutes)');
      
      return NextResponse.json({
        access_token: tokenCache.accessToken,
        token_type: 'Bearer',
        expires_in: Math.round((tokenCache.expiresAt - now) / 1000),
        cached: true // For debugging
      }, {
        headers: {
          'X-Token-Source': 'cache',
          'Cache-Control': 'private, max-age=300' // Client can cache for 5 min
        }
      });
    }

    // Fetch new token from Autodesk
    console.log('🔄 Fetching new Forge token from Autodesk...');
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
    
    // Cache the new token
    tokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in * 1000) // Convert seconds to ms
    };
    
    console.log('🔐 New Forge token cached (expires in', tokenData.expires_in / 60, 'minutes)');
    
    return NextResponse.json(tokenData, {
      headers: {
        'X-Token-Source': 'fresh',
        'Cache-Control': 'private, max-age=300'
      }
    });
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