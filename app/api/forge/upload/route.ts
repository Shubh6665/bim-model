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

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting upload process...');
    
    // Parse the form data using Next.js App Router compatible method
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('❌ No file found in form data');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('📁 File received:', file.name, 'Size:', file.size);

    const bucketKey = process.env.FORGE_BUCKET_KEY;
    if (!bucketKey) {
      console.log('❌ FORGE_BUCKET_KEY not found in environment');
      return NextResponse.json({ error: 'Bucket key not configured' }, { status: 500 });
    }

    const fileName = file.name;
    const fileBuffer = await file.arrayBuffer();
    console.log('📦 File buffer created, size:', fileBuffer.byteLength);

    // Get access token
    console.log('🔐 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained');

    // Use signed URL approach for OSS v2
    console.log('📤 Getting signed upload URL...');
    
    // Step 1: Get signed upload URL
    const signedUrlRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signeds3upload`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    console.log('📡 Signed URL response status:', signedUrlRes.status);
    
    if (!signedUrlRes.ok) {
      const err = await signedUrlRes.text();
      console.log('❌ Failed to get signed URL:', err);
      return NextResponse.json({ error: 'Failed to get signed URL', details: err }, { status: 500 });
    }
    
    const signedUrlData = await signedUrlRes.json();
    console.log('📋 Signed URL data:', signedUrlData);
    
    const uploadUrl = signedUrlData.urls[0];
    const uploadKey = signedUrlData.uploadKey;
    
    // Step 2: Upload file to S3
    console.log('📤 Uploading file to S3...');
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });
    
    console.log('📡 S3 upload response status:', uploadRes.status);
    
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.log('❌ S3 upload failed:', err);
      return NextResponse.json({ error: 'S3 upload failed', details: err }, { status: 500 });
    }
    
    // Step 3: Complete the upload
    console.log('🔄 Completing upload...');
    const completeRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(fileName)}/signeds3upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadKey: uploadKey
      }),
    });
    
    console.log('📡 Complete upload response status:', completeRes.status);
    
    if (!completeRes.ok) {
      const err = await completeRes.text();
      console.log('❌ Complete upload failed:', err);
      return NextResponse.json({ error: 'Complete upload failed', details: err }, { status: 500 });
    }
    
    const completeData = await completeRes.json();
    console.log('📋 Complete upload data:', completeData);
    
    console.log('✅ Forge upload successful');
    
    const objectId = completeData.objectId;
    const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
    
    console.log('🎯 Generated URN:', urn);
    
    return NextResponse.json({ objectId, urn });
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed',
      stack: error.stack 
    }, { status: 500 });
  }
}
