import { NextRequest, NextResponse } from 'next/server';

/**
 * GET Model Metadata - Get all viewables/model GUIDs from a URN
 * Endpoint: /api/forge/metadata/[urn]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ urn: string }> }
) {
  try {
    const { urn } = await params;

    if (!urn) {
      return NextResponse.json(
        { error: 'URN is required' },
        { status: 400 }
      );
    }

    // Get Forge token
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/forge/token`);
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch metadata from Model Derivative API
    const metadataUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/metadata`;
    
    console.log(`🔍 Fetching metadata for URN: ${urn}`);
    
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Metadata API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Failed to fetch metadata: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const metadata = await response.json();
    console.log(`✅ Metadata fetched successfully:`, metadata);

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('❌ Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
