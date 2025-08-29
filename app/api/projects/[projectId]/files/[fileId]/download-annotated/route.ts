import { NextRequest } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { PDFDocument, rgb } from 'pdf-lib';

// GET /api/projects/[projectId]/files/[fileId]/download-annotated
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;
    const db = await getDb();

    // Get file record
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

    // Get annotations for this file
    const annotations = await db
      .collection('annotations')
      .find({ projectId, fileId })
      .sort({ createdAt: 1 })
      .toArray();

    const gridId = fileDoc.fileId as ObjectId | undefined;
    if (!gridId) {
      return new Response(JSON.stringify({ error: 'Missing GridFS fileId' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    
    // Get original PDF as buffer
    const chunks: Uint8Array[] = [];
    const stream = bucket.openDownloadStream(gridId);
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const pdfBuffer = Buffer.concat(chunks);
    
    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    // Add annotations to PDF
    for (const annotation of annotations) {
      const pageIndex = annotation.pageIndex;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        for (const quad of annotation.quads || []) {
          // Convert normalized coordinates (0-1) to PDF coordinates
          const x = quad.x * pageWidth;
          const y = pageHeight - (quad.y * pageHeight) - (quad.height * pageHeight); // PDF y-axis is bottom-up
          const width = quad.width * pageWidth;
          const height = quad.height * pageHeight;

          if (annotation.type === 'highlight') {
            // Add yellow highlight rectangle
            page.drawRectangle({
              x,
              y,
              width,
              height,
              color: rgb(1, 1, 0), // Yellow
              opacity: 0.3,
            });
          } else if (annotation.type === 'underline') {
            // Add red underline
            page.drawRectangle({
              x,
              y: y - 2,
              width,
              height: 4,
              color: rgb(1, 0, 0), // Red
              opacity: 0.8,
            });
          } else if (annotation.type === 'comment' && annotation.comment) {
            // Add comment box
            page.drawRectangle({
              x,
              y,
              width,
              height,
              color: rgb(0, 0.4, 1), // Blue
              opacity: 0.2,
            });
            
            // Add comment text (if it fits)
            if (annotation.comment && annotation.comment.length < 50) {
              page.drawText(annotation.comment, {
                x: x + 5,
                y: y + height + 5,
                size: 10,
                color: rgb(0, 0, 0),
              });
            }
          }
        }
      }
    }

    // Generate annotated PDF
    const annotatedPdfBytes = await pdfDoc.save();
    
    const fileName = fileDoc.name || 'annotated-document.pdf';
    const annotatedFileName = fileName.replace(/\.pdf$/i, '-annotated.pdf');

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(annotatedFileName)}"`);
    headers.set('Content-Length', annotatedPdfBytes.length.toString());
    
    console.log(`[Download Annotated] File: ${annotatedFileName}, Annotations: ${annotations.length}`);

    return new Response(annotatedPdfBytes, {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('[Download Annotated] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
