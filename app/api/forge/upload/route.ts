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
  console.log('🔐 Forge access token obtained successfully');
  return data.access_token;
}

async function ensureBucketExists(bucketKey: string, accessToken: string) {
  // First, check if the bucket exists (Optional, but good practice)
  const getBucketRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/details`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (getBucketRes.ok) {
    return; // Bucket exists
  }

  console.log(` Bucket ${bucketKey} not found. Creating it now...`);
  const createRes = await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bucketKey: bucketKey,
      policyKey: 'persistent' // Keeps models permanently
    })
  });
  
  if (!createRes.ok && createRes.status !== 409) {
    const errorDetails = await createRes.text();
    console.error(`❌ Failed to create bucket ${bucketKey}:`, errorDetails);
    throw new Error('Failed to create bucket');
  }
  
  console.log(`✅ Bucket ${bucketKey} is ready.`);
}

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting upload process...');
    const bucketKey = process.env.FORGE_BUCKET_KEY;
    if (!bucketKey) {
      console.log('❌ FORGE_BUCKET_KEY not found in environment');
      return NextResponse.json({ error: 'Bucket key not configured' }, { status: 500 });
    }

    const accessToken = await getAccessToken();
    await ensureBucketExists(bucketKey, accessToken);

    // Support JSON control flow for large files: init and complete
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const fileName = body.fileName as string | undefined;
      // INIT: return signed URL so browser can upload directly
      if (body.init && fileName) {
        console.log('🪪 INIT signed URL for', fileName);
        const signedUrlRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signeds3upload?minutesExpiration=60`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!signedUrlRes.ok) {
          const err = await signedUrlRes.text();
          console.log('❌ Failed to get signed URL:', err);
          return NextResponse.json({ error: 'Failed to get signed URL', details: err }, { status: 500 });
        }
        const signedUrlData = await signedUrlRes.json();
        return NextResponse.json({ uploadUrl: signedUrlData.urls[0], uploadKey: signedUrlData.uploadKey });
      }
      // COMPLETE: finalize the upload and return URN
      if (body.complete && fileName && body.uploadKey) {
        console.log('✅ COMPLETE upload for', fileName);
        const completeRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signeds3upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uploadKey: body.uploadKey }),
        });
        if (!completeRes.ok) {
          const err = await completeRes.text();
          console.log('❌ Complete upload failed:', err);
          return NextResponse.json({ error: 'Complete upload failed', details: err }, { status: 500 });
        }
        const completeData = await completeRes.json();
        const objectId = completeData.objectId;
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
        return NextResponse.json({ objectId, urn });
      }
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Backward-compatible small-file flow via multipart form-data (not recommended for large files)
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      console.log('❌ No file found in form data');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    console.log('📁 File received (compat mode):', file.name, 'Size:', file.size);

    const fileName = file.name;
    const fileBuffer = await file.arrayBuffer();

    const signedUrlRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signeds3upload?minutesExpiration=60`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!signedUrlRes.ok) {
      const err = await signedUrlRes.text();
      return NextResponse.json({ error: 'Failed to get signed URL', details: err }, { status: 500 });
    }
    const signedUrlData = await signedUrlRes.json();
    const uploadUrl = signedUrlData.urls[0];
    const uploadKey = signedUrlData.uploadKey;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBuffer,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return NextResponse.json({ error: 'S3 upload failed', details: err }, { status: 500 });
    }

    const completeRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signeds3upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadKey }),
    });
    if (!completeRes.ok) {
      const err = await completeRes.text();
      return NextResponse.json({ error: 'Complete upload failed', details: err }, { status: 500 });
    }
    const completeData = await completeRes.json();
    const objectId = completeData.objectId;
    const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
    return NextResponse.json({ objectId, urn });
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed',
      stack: error.stack 
    }, { status: 500 });
  }
}
