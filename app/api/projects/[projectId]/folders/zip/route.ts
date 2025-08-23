import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { ObjectId, GridFSBucket } from 'mongodb';
import JSZip from 'jszip';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { folderId } = await request.json();

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const db = await getDb();

    // Get all files in the folder recursively
    const files = await getAllFilesInFolder(db, folderId);
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found in folder' }, { status: 404 });
    }

    // Create ZIP
    const zip = new JSZip();

    // Add files to ZIP
    for (const file of files) {
      try {
        // Get file data from GridFS
        const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
        const downloadStream = bucket.openDownloadStream(new ObjectId(file.fileId));
        
        const chunks: Buffer[] = [];
        for await (const chunk of downloadStream) {
          chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);
        
        // Add to ZIP with folder structure
        zip.file(file.path, fileBuffer);
      } catch (error) {
        console.error(`Error adding file ${file.name} to ZIP:`, error);
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Get folder name for ZIP filename
    const folder = await db.collection('folders').findOne({ _id: new ObjectId(folderId) });
    const folderName = folder?.name || 'folder';

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      },
    });

  } catch (error) {
    console.error('Error creating folder ZIP:', error);
    return NextResponse.json({ error: 'Failed to create ZIP' }, { status: 500 });
  }
}

async function getAllFilesInFolder(db: any, folderId: string): Promise<Array<{ name: string; path: string; fileId: string }>> {
  const files: Array<{ name: string; path: string; fileId: string }> = [];
  
  async function collectFiles(currentFolderId: string, currentPath: string = '') {
    // Get files in current folder
    const folderFiles = await db.collection('files').find({ 
      folderId: new ObjectId(currentFolderId) 
    }).toArray();
    
    for (const file of folderFiles) {
      files.push({
        name: file.name,
        path: currentPath ? `${currentPath}/${file.name}` : file.name,
        fileId: file.fileId
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
