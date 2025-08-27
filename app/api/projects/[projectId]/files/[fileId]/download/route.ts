import { NextRequest } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';

// GET /api/projects/[projectId]/files/[fileId]/download
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;
    const db = await getDb();

    // Look up file record to get GridFS fileId and metadata
    const fileDoc = await db.collection('files').findOne({
      _id: new ObjectId(fileId),
      projectId: new ObjectId(projectId)
    });

    if (!fileDoc) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const gridId = fileDoc.fileId as ObjectId | undefined;
    if (!gridId) {
      return new Response(JSON.stringify({ error: 'Missing GridFS fileId for this record' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });

    // Open a download stream from GridFS
    const stream = bucket.openDownloadStream(gridId);

    // Set headers. Default to application/octet-stream if unknown.
    const contentType = fileDoc.mimeType || 'application/octet-stream';
    const fileName = fileDoc.name || 'download';

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    
    // Determine if file should be displayed inline based on type
    const inlineTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'text/html'];
    const shouldBeInline = inlineTypes.includes(contentType);
    
    headers.set('Content-Disposition', shouldBeInline 
      ? `inline; filename="${encodeURIComponent(fileName)}"` 
      : `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    // Add debug logging
    console.log(`[Download] File: ${fileName}, Type: ${contentType}, Inline: ${shouldBeInline}`);

    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('[Download] Error streaming file:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
