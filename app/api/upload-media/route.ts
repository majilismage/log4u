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
    
    logger.info('UPLOAD-MEDIA: Received request with journey ID', {
      journeyId,
      journeyIdType: typeof journeyId,
      journeyIdLength: journeyId ? journeyId.length : 0,
      journeyIdPattern: journeyId ? (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journeyId) ? 'UUID' :
        /^J\d+$/.test(journeyId) ? 'J+timestamp' :
        'other'
      ) : 'null',
      fileName: file?.name,
      timestamp: Date.now()
    });
    
    // Basic validations
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!isValidMediaType(file.type)) return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large.' }, { status: 400 });
    if (!journeyId) return NextResponse.json({ error: 'Missing journey information' }, { status: 400 });

    // 1. Upload the file with metadata
    const fileBuffer = await fileToBuffer(file);
    const fileStream = Readable.from(fileBuffer);
    
    const fileMetadata = {
      name: file.name,
      parents: [googleDriveFolderId],
      appProperties: {
        journeyId,
        isLog4uMedia: 'true'
      },
    };
    
    logger.debug("UPLOAD-MEDIA: Creating file with metadata:", fileMetadata);

    const media = {
      mimeType: file.type,
      body: fileStream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });
    
    logger.info('UPLOAD-MEDIA: Upload completed successfully with metadata', { 
      fileId: response.data.id, 
      journeyId: journeyId,
      finalJourneyIdUsed: fileMetadata.appProperties.journeyId
    });

    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      mediaType: file.type.startsWith('image/') ? 'image' : 'video'
    });

  } catch (error: any) {
    logger.error('UPLOAD-MEDIA: Unexpected error during upload', error);
    const errorMessage = error.message || 'An unexpected error occurred during file upload.';
    const status = error.message.includes('authenticated') ? 401 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
} 