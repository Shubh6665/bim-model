import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';

// Ensure Node.js runtime for GridFS and Buffer support
export const runtime = 'nodejs';

async function getForgeAccessToken(scopes: string) {
  const clientId = process.env.FORGE_CLIENT_ID;
  const clientSecret = process.env.FORGE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Forge credentials not configured');
  const res = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: scopes,
    }),
  });
  if (!res.ok) throw new Error(`Failed to get Forge token: ${res.status}`);
  return res.json();
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (e) => reject(e));
  });
}

// GET will also work as idempotent fetch: returns existing forgeUrn if present
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;
    const db = await getDb();

    const fileDoc = await db.collection('files').findOne({
      _id: new ObjectId(fileId),
      projectId: new ObjectId(projectId),
    });
    if (!fileDoc) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    if (fileDoc.forgeUrn) {
      return NextResponse.json({ urn: fileDoc.forgeUrn, cached: true });
    }

    // Only allow DWG/DXF (can be extended later)
    const name: string = fileDoc.name || 'file.dwg';
    const ext = name.split('.').pop()?.toLowerCase();
    if (!['dwg', 'dxf'].includes(ext || '')) {
      return NextResponse.json({ error: 'Unsupported type for Forge translation' }, { status: 400 });
    }

    const gridId = fileDoc.fileId as ObjectId | undefined;
    if (!gridId) return NextResponse.json({ error: 'Missing GridFS fileId' }, { status: 400 });

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    const download = bucket.openDownloadStream(gridId);
    const buffer = await streamToBuffer(download as unknown as NodeJS.ReadableStream);

    // Step 1: get token with OSS scopes
    const tokenData = await getForgeAccessToken('data:read data:write data:create bucket:create bucket:read');
    const accessToken = tokenData.access_token as string;
    const bucketKey = process.env.FORGE_BUCKET_KEY as string;
    if (!bucketKey) return NextResponse.json({ error: 'FORGE_BUCKET_KEY not configured' }, { status: 500 });

    const objectName = name; // keep original

    // Step 2: create signed upload URL
    const signedUrlRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!signedUrlRes.ok) {
      const t = await signedUrlRes.text();
      return NextResponse.json({ error: 'Failed to get signed URL', details: t }, { status: 500 });
    }
    const signed = await signedUrlRes.json();
    const uploadUrl = signed.urls[0];
    const uploadKey = signed.uploadKey;

    // Step 3: upload bytes to S3
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      // Use Uint8Array to satisfy Fetch BodyInit types across runtimes
      body: new Uint8Array(buffer),
    });
    if (!putRes.ok) {
      const t = await putRes.text();
      return NextResponse.json({ error: 'S3 upload failed', details: t }, { status: 500 });
    }

    // Step 4: complete upload to Forge OSS
    const completeRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadKey }),
    });
    if (!completeRes.ok) {
      const t = await completeRes.text();
      return NextResponse.json({ error: 'Complete upload failed', details: t }, { status: 500 });
    }
    const completeData = await completeRes.json();
    const objectId = completeData.objectId as string;
    const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

    // Step 5: request translation (SVF2 preferred but SVF fallback used by existing route)
    const baseUrl = req.nextUrl?.origin || process.env.NEXT_PUBLIC_BASE_URL;
    const translateEndpoint = baseUrl
      ? `${baseUrl}/api/forge/translate`
      : undefined;

    let translateOk = false;
    if (translateEndpoint) {
      const translateRes = await fetch(translateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urn })
      });
      translateOk = translateRes.ok;
      if (!translateOk) {
        const txt = await translateRes.text().catch(() => '');
        console.warn('Forge translate request failed:', txt);
      }
    } else {
      console.warn('[forge-urn] Missing base URL for internal translate call; skipping');
    }

    // Cache URN in DB
    await db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { forgeUrn: urn } }
    );

    return NextResponse.json({ urn, cached: false });
  } catch (error: any) {
    console.error('[forge-urn] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
