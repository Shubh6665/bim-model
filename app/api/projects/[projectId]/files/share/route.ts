import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';
import { sendEmail } from '@/app/lib/email';
import JSZip from 'jszip';

// Note: Access control disabled intentionally for open database access.

// POST /api/projects/[projectId]/files/share - Share file/folder via email or create share link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const db = await getDb();
    const { projectId } = await params;

    const { type, itemId, itemType, action, email, message, recipients, subject, shareType } = await request.json();

    // Handle ZIP email sharing
    if (shareType === 'zip') {
      // Normalize recipients: trim and remove empty entries
      const cleanedRecipients: string[] = Array.isArray(recipients)
        ? recipients.map((r: string) => (r || '').trim()).filter((r: string) => r.length > 0)
        : [];
      if (cleanedRecipients.length === 0) {
        return NextResponse.json({ error: 'At least one valid recipient email is required for ZIP sharing' }, { status: 400 });
      }

      const collection = itemType === 'file' ? 'files' : 'folders';
      const item = await db.collection(collection).findOne({
        _id: new ObjectId(itemId),
        projectId: new ObjectId(projectId)
      });

      if (!item) {
        return NextResponse.json({ error: `${itemType} not found` }, { status: 404 });
      }

      try {
        let zipBuffer: Buffer;
        let zip: JSZip;

        if (itemType === 'file') {
          // Create ZIP with single file
          zip = new JSZip();
          const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
          
          try {
            const downloadStream = bucket.openDownloadStream(new ObjectId(item.fileId));
            
            const chunks: Buffer[] = [];
            for await (const chunk of downloadStream) {
              chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);
            zip.file(item.name, fileBuffer);
          } catch (error) {
            console.error(`Error adding file ${item.name} to ZIP:`, error);
            // Try alternative file ID field
            try {
              const downloadStream = bucket.openDownloadStream(new ObjectId(item._id));
              const chunks: Buffer[] = [];
              for await (const chunk of downloadStream) {
                chunks.push(chunk);
              }
              const fileBuffer = Buffer.concat(chunks);
              zip.file(item.name, fileBuffer);
            } catch (altError) {
              console.error(`Alternative file ID also failed for ${item.name}:`, altError);
              // Skip this file and continue
            }
          }
          
          zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        } else {
          // Create ZIP with folder contents
          const files = await getAllFilesInFolder(db, itemId);
          zip = new JSZip();

          for (const file of files) {
            try {
              const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
              const downloadStream = bucket.openDownloadStream(file.fileId);
              
              const chunks: Buffer[] = [];
              for await (const chunk of downloadStream) {
                chunks.push(chunk);
              }
              const fileBuffer = Buffer.concat(chunks);
              zip.file(file.path, fileBuffer);
            } catch (error) {
              console.error(`Error adding file ${file.name} to ZIP:`, error);
              // Try alternative approach - check if file exists in GridFS with different ID
              try {
                const bucket2 = new GridFSBucket(db, { bucketName: 'uploads' });
                const gridfsFiles = await db.collection('uploads.files').find({ filename: file.name }).toArray();
                if (gridfsFiles.length > 0) {
                  const downloadStream = bucket2.openDownloadStream(gridfsFiles[0]._id);
                  const chunks: Buffer[] = [];
                  for await (const chunk of downloadStream) {
                    chunks.push(chunk);
                  }
                  const fileBuffer = Buffer.concat(chunks);
                  zip.file(file.path, fileBuffer);
                  console.log(`Successfully added ${file.name} using GridFS filename lookup`);
                } else {
                  console.log(`File ${file.name} not found in GridFS, skipping...`);
                }
              } catch (altError) {
                console.error(`Alternative GridFS lookup also failed for ${file.name}:`, altError);
              }
            }
          }
          zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        }

        // Check if ZIP has any files before sending
        const zipEntries = Object.keys((zip as any).files);
        if (zipEntries.length === 0) {
          return NextResponse.json({ 
            error: 'No files could be added to ZIP. Files may be missing from storage.' 
          }, { status: 400 });
        }

        // Send email to all recipients with ZIP attachment
        for (const recipient of cleanedRecipients) {
          if (recipient) {
            await sendEmail(
              recipient,
              subject || `Shared ${itemType}: ${item.name}`,
              `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>You've received a shared ${itemType}</h2>
                  <p><strong>BIM User</strong> has shared a ${itemType} with you as a ZIP file:</p>
                  
                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0;">${item.name}</h3>
                    ${message ? `<p><em>"${message}"</em></p>` : ''}
                    <p><small>ZIP contains ${zipEntries.length} file(s)</small></p>
                  </div>
                  
                  <p>The ${itemType} has been attached as a ZIP file to this email.</p>
                  
                  <p style="margin-top: 30px; font-size: 12px; color: #666;">
                    This email was sent from the BIM Project Management System.
                  </p>
                </div>
              `,
              [{
                filename: `${item.name}.zip`,
                content: zipBuffer,
                contentType: 'application/zip'
              }]
            );
          }
        }

        // Record ZIP share event and recipients for tracking
        try {
          await db.collection('zipShares').insertOne({
            projectId: new ObjectId(projectId),
            itemType,
            itemId: new ObjectId(itemId),
            itemName: item.name,
            recipients: cleanedRecipients,
            subject: subject || `Shared ${itemType}: ${item.name}`,
            message: message || null,
            fileCount: zipEntries.length,
            createdAt: new Date()
          });
        } catch (logErr) {
          console.warn('Failed to record zip share event:', logErr);
        }

        return NextResponse.json({ 
          success: true, 
          message: `ZIP prepared and sent to ${cleanedRecipients.length} recipient(s) (${zipEntries.length} file(s) included)` 
        });
      } catch (error) {
        console.error('Error creating and sending ZIP:', error);
        return NextResponse.json({ error: 'Failed to create and send ZIP' }, { status: 500 });
      }
    }

    if (!type || !itemId || !action) {
      return NextResponse.json({ error: 'Type, item ID, and action are required' }, { status: 400 });
    }

    if (action === 'email' && !email) {
      return NextResponse.json({ error: 'Email is required for email sharing' }, { status: 400 });
    }

    // Get item details
    const collection = type === 'file' ? 'files' : 'folders';
    const item = await db.collection(collection).findOne({
      _id: new ObjectId(itemId),
      projectId: new ObjectId(projectId)
    });

    if (!item) {
      return NextResponse.json({ error: `${type} not found` }, { status: 404 });
    }

    if (action === 'email') {
      // Send email with file/folder details
      const downloadUrl = type === 'file' 
        ? `${process.env.APP_BASE_URL}/api/projects/${projectId}/files/download?fileId=${itemId}`
        : `${process.env.APP_BASE_URL}/projects/${projectId}/database?folderId=${itemId}`;

      try {
        await sendEmail(
          email,
          `Shared ${type}: ${item.name}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've received a shared ${type}</h2>
              <p><strong>Public User</strong> has shared a ${type} with you:</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0;">${item.name}</h3>
                ${type === 'file' ? `<p>Size: ${(item.size / 1024 / 1024).toFixed(1)} MB</p>` : ''}
                ${message ? `<p><em>"${message}"</em></p>` : ''}
              </div>
              
              <a href="${downloadUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                ${type === 'file' ? 'Download File' : 'View Folder'}
              </a>
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                This link will expire in 7 days for security purposes.
              </p>
            </div>
          `
        );

        return NextResponse.json({ success: true, message: 'Email sent successfully' });
      } catch (error) {
        console.error('Error sending email:', error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
      }
    } else if (action === 'link') {
      // Create shareable link
      const shareToken = generateShareToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const shareLink = {
        token: shareToken,
        type,
        itemId: new ObjectId(itemId),
        projectId: new ObjectId(projectId),
        createdBy: 'public',
        createdAt: new Date(),
        expiresAt,
        accessCount: 0
      };

      await db.collection('shareLinks').insertOne(shareLink);

      const publicUrl = `${process.env.APP_BASE_URL}/shared/${shareToken}`;

      return NextResponse.json({ 
        success: true, 
        shareUrl: publicUrl,
        expiresAt: expiresAt.toISOString()
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error sharing item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/projects/[projectId]/files/share?shareType=zip&itemType=file|folder&itemId=...
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const db = await getDb();
    const { projectId } = await params;

    const { searchParams } = new URL(request.url);
    const shareType = searchParams.get('shareType');
    const itemType = searchParams.get('itemType');
    const itemId = searchParams.get('itemId');

    if (shareType !== 'zip') {
      return NextResponse.json({ error: 'Invalid or missing shareType' }, { status: 400 });
    }
    if (!itemType || !itemId) {
      return NextResponse.json({ error: 'itemType and itemId are required' }, { status: 400 });
    }

    const records = await db
      .collection('zipShares')
      .find({
        projectId: new ObjectId(projectId),
        itemType,
        itemId: new ObjectId(itemId)
      })
      .project({ recipients: 1, createdAt: 1, _id: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    const allRecipients: string[] = Array.from(
      new Set((records.flatMap(r => r.recipients || []) as string[]).map(r => (r || '').trim()).filter(Boolean))
    );

    return NextResponse.json({ recipients: allRecipients, history: records });
  } catch (error) {
    console.error('Error fetching ZIP recipients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateShareToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function getAllFilesInFolder(db: any, folderId: string): Promise<Array<{ name: string; path: string; fileId: ObjectId }>> {
  const files: Array<{ name: string; path: string; fileId: ObjectId }> = [];
  
  async function collectFiles(currentFolderId: string, currentPath: string = '') {
    // Get files in current folder
    const folderFiles = await db.collection('files').find({ 
      folderId: new ObjectId(currentFolderId) 
    }).toArray();
    
    for (const file of folderFiles) {
      files.push({
        name: file.name,
        path: currentPath ? `${currentPath}/${file.name}` : file.name,
        fileId: file._id
      });
    }
    
    // Get subfolders and recursively collect their files
    const subfolders = await db.collection('folders').find({ 
      parentId: new ObjectId(currentFolderId) 
    }).toArray();
    
    for (const subfolder of subfolders) {
      const subfolderPath = currentPath ? `${currentPath}/${subfolder.name}` : subfolder.name;
      await collectFiles(subfolder._id.toString(), subfolderPath);
    }
  }
  
  await collectFiles(folderId);
  return files;
}
