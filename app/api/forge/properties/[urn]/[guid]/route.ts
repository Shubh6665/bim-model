import { NextRequest, NextResponse } from 'next/server';

/**
 * GET All Properties - Extract all properties from a model using Model Derivative API
 * Endpoint: /api/forge/properties/[urn]/[guid]
 * 
 * This uses the official APS Model Derivative API endpoint:
 * GET /modelderivative/v2/designdata/:urn/metadata/:guid/properties
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ urn: string; guid: string }> }
) {
  try {
    const { urn, guid } = await params;
    const { searchParams } = new URL(request.url);
    const objectid = searchParams.get('objectid'); // Optional: filter by specific object ID
    const forceget = searchParams.get('forceget') || 'true'; // Handle large responses

    if (!urn || !guid) {
      return NextResponse.json(
        { error: 'URN and GUID are required' },
        { status: 400 }
      );
    }

    // Get Forge token
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/forge/token`);
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Build properties URL
    let propertiesUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/metadata/${guid}/properties`;
    
    const queryParams = new URLSearchParams();
    if (forceget) queryParams.append('forceget', forceget);
    if (objectid) queryParams.append('objectid', objectid);
    
    if (queryParams.toString()) {
      propertiesUrl += `?${queryParams.toString()}`;
    }

    console.log(`🔍 Fetching properties from: ${propertiesUrl}`);
    
    const response = await fetch(propertiesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Properties API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Failed to fetch properties: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const properties = await response.json();
    
    // Log statistics
    const objectCount = properties.data?.collection?.length || 0;
    console.log(`✅ Properties fetched successfully: ${objectCount} objects`);

    return NextResponse.json(properties);
  } catch (error) {
    console.error('❌ Error fetching properties:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
