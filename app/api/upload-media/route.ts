import { NextResponse } from 'next/server';
import { google, drive_v3 } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { logger } from '@/lib/logger';
import { isValidMediaType, MAX_FILE_SIZE } from '@/lib/mediaUtils';
import { Readable } from 'stream';

// Helper function to convert a File to a Buffer
async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// This helper function finds or creates a folder and returns its ID.
async function findOrCreateFolder(
  drive: drive_v3.Drive,
  folderName: string,
  parentId: string
): Promise<string> {
  // Check if folder already exists
  const query = `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const { data } = await drive.files.list({
    q: query,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (data.files && data.files.length > 0) {
    return data.files[0].id!;
  }

  // If not, create it
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };
  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });
  return folder.data.id!;
}

export async function POST(request: Request) {
  try {
    const { auth, googleDriveFolderId } = await getAuthenticatedClient();
    if (!googleDriveFolderId) {
      return NextResponse.json(
        { error: 'Google Drive folder is not configured. Please set it up in your settings.' },
        { status: 400 }
      );
    }
    
    const drive = google.drive({ version: 'v3', auth });
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const journeyId = formData.get('journeyId') as string;
    const journeyDate = new Date(formData.get('journeyDate') as string);
    
    // Basic validations
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!isValidMediaType(file.type)) return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large.' }, { status: 400 });
    if (!journeyId || !journeyDate) return NextResponse.json({ error: 'Missing journey information' }, { status: 400 });

    // 1. Define folder structure
    const year = journeyDate.getFullYear().toString();
    const month = (journeyDate.getMonth() + 1).toString().padStart(2, '0');
    const mediaType = file.type.startsWith('image/') ? 'images' : 'videos';

    // 2. Create folder hierarchy sequentially
    const yearFolderId = await findOrCreateFolder(drive, year, googleDriveFolderId);
    const monthFolderId = await findOrCreateFolder(drive, month, yearFolderId);
    const journeyFolderId = await findOrCreateFolder(drive, journeyId, monthFolderId);
    const mediaTypeFolderId = await findOrCreateFolder(drive, mediaType, journeyFolderId);
    
    // 3. Upload the file
    const fileBuffer = await fileToBuffer(file);
    const fileStream = Readable.from(fileBuffer);
    
    const fileMetadata = {
      name: file.name,
      parents: [mediaTypeFolderId],
    };
    
    const media = {
      mimeType: file.type,
      body: fileStream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });
    
    // 4. Get the public URL for the folder
    const folderDetails = await drive.files.get({
        fileId: journeyFolderId,
        fields: 'webViewLink'
    });
    const folderLink = folderDetails.data.webViewLink;

    logger.info('Upload completed successfully', { fileId: response.data.id, path: mediaTypeFolderId });

    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      folderLink: folderLink,
      mediaType: file.type.startsWith('image/') ? 'image' : 'video'
    });

  } catch (error: any) {
    logger.error('Unexpected error during upload', error);
    const errorMessage = error.message || 'An unexpected error occurred during file upload.';
    const status = error.message.includes('authenticated') ? 401 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
} 