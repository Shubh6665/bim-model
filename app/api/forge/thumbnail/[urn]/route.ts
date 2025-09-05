import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ urn: string }> }) {
  const { urn } = await params;

  try {
    // Get a Forge/APS access token from our existing token route
    const origin = request.nextUrl.origin;
    const tokenRes = await fetch(`${origin}/api/forge/token`, { cache: 'no-store' });
    if (!tokenRes.ok) {
      return new Response('Failed to obtain token', { status: 500 });
    }
    const { access_token } = await tokenRes.json();

    // Fetch model thumbnail from APS
    const apsRes = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/thumbnail?size=200`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!apsRes.ok) {
      return new Response('Thumbnail not available', { status: 404 });
    }

    const arrayBuf = await apsRes.arrayBuffer();
    return new Response(Buffer.from(arrayBuf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[APS Thumbnail] Error:', err);
    return new Response('Internal error', { status: 500 });
  }
}
