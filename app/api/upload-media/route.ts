import { NextResponse } from 'next/server';
import { google, drive_v3 } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { logger } from '@/lib/logger';
import { isValidMediaType, MAX_FILE_SIZE } from '@/lib/mediaUtils';
import { Readable } from 'stream';
import { ensureDriveFolderExists } from '@/lib/ensure-drive-setup';

// Helper function to convert a File to a Buffer
async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: Request) {
  try {
    console.log('UPLOAD-MEDIA: Received upload request');
    logger.info('UPLOAD-MEDIA: Received upload request');
    
    let auth, userId, existingFolderId;
    try {
      const authResult = await getAuthenticatedClient();
      auth = authResult.auth;
      userId = authResult.userId;
      existingFolderId = authResult.googleDriveFolderId;
      console.log('UPLOAD-MEDIA: Authentication successful', {
        userId,
        hasFolderId: !!existingFolderId
      });
      logger.info('UPLOAD-MEDIA: Authentication successful', {
        userId,
        hasFolderId: !!existingFolderId
      });
    } catch (authError: any) {
      console.error('UPLOAD-MEDIA: Authentication failed:', {
        message: authError.message,
        stack: authError.stack
      });
      logger.error('UPLOAD-MEDIA: Authentication failed:', {
        message: authError.message,
        stack: authError.stack
      });
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }
    
    // Ensure Drive folder exists (create if needed)
    let googleDriveFolderId = existingFolderId;
    if (!googleDriveFolderId) {
      console.log('UPLOAD-MEDIA: No Drive folder configured, creating one');
      logger.info('UPLOAD-MEDIA: No Drive folder configured, creating one');
      try {
        googleDriveFolderId = await ensureDriveFolderExists(auth, userId);
        console.log('UPLOAD-MEDIA: Drive folder ensured:', googleDriveFolderId);
        logger.info('UPLOAD-MEDIA: Drive folder ensured:', googleDriveFolderId);
      } catch (folderError: any) {
        console.error('UPLOAD-MEDIA: Failed to ensure Drive folder:', folderError);
        logger.error('UPLOAD-MEDIA: Failed to ensure Drive folder:', folderError);
        return NextResponse.json(
          { error: 'Failed to set up Google Drive storage. Please try again.' },
          { status: 500 }
        );
      }
    }
    
    logger.info('UPLOAD-MEDIA: Using Google Drive folder ID:', googleDriveFolderId);
    console.log('UPLOAD-MEDIA: Using Google Drive folder ID:', googleDriveFolderId);
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Verify the folder exists and we have access
    try {
      console.log('UPLOAD-MEDIA: Verifying folder access...');
      const folderCheck = await drive.files.get({
        fileId: googleDriveFolderId,
        fields: 'id, name, trashed'
      });
      console.log('UPLOAD-MEDIA: Folder verified:', {
        id: folderCheck.data.id,
        name: folderCheck.data.name,
        trashed: folderCheck.data.trashed
      });
    } catch (folderError: any) {
      console.error('UPLOAD-MEDIA: Folder verification failed:', {
        message: folderError.message,
        code: folderError.code,
        status: folderError.response?.status
      });
      // If folder doesn't exist or we don't have access, try to create a new one
      if (folderError.response?.status === 404) {
        console.log('UPLOAD-MEDIA: Folder not found, will create new one');
        try {
          googleDriveFolderId = await ensureDriveFolderExists(auth, userId);
          console.log('UPLOAD-MEDIA: New folder created:', googleDriveFolderId);
        } catch (createError) {
          console.error('UPLOAD-MEDIA: Failed to create new folder:', createError);
          return NextResponse.json({ error: 'Failed to access or create Drive folder' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ 
          error: `Cannot access Drive folder: ${folderError.message}` 
        }, { status: 500 });
      }
    }
    console.log('UPLOAD-MEDIA: About to parse form data');
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const journeyId = formData.get('journeyId') as string;
    
    console.log('UPLOAD-MEDIA: Form data parsed', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      journeyId: journeyId
    });
    
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
    if (!file) {
      logger.error('UPLOAD-MEDIA: No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!isValidMediaType(file.type)) {
      logger.error('UPLOAD-MEDIA: Invalid file type:', file.type);
      return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      logger.error('UPLOAD-MEDIA: File too large:', file.size);
      return NextResponse.json({ error: 'File too large.' }, { status: 400 });
    }
    if (!journeyId) {
      logger.error('UPLOAD-MEDIA: Missing journey information');
      return NextResponse.json({ error: 'Missing journey information' }, { status: 400 });
    }

    // 1. Upload the file with metadata
    console.log('UPLOAD-MEDIA: Converting file to buffer');
    logger.info('UPLOAD-MEDIA: Converting file to buffer');
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fileToBuffer(file);
      console.log('UPLOAD-MEDIA: Buffer created, size:', fileBuffer.length);
    } catch (error) {
      console.error('UPLOAD-MEDIA: Failed to convert file to buffer:', error);
      logger.error('UPLOAD-MEDIA: Failed to convert file to buffer:', error);
      return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }
    
    // Create stream exactly like the working endpoint
    const stream = Readable.from(fileBuffer);
    
    logger.info('UPLOAD-MEDIA: Calling Google Drive API to create file', {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      folderId: googleDriveFolderId,
      journeyId: journeyId
    });
    
    let response;
    try {
      console.log('UPLOAD-MEDIA: Uploading to Drive...');
      
      // Use EXACT pattern from working endpoint
      response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [googleDriveFolderId],
          appProperties: {
            journeyId: journeyId,
            isLog4uMedia: 'true'
          }
        },
        media: {
          mimeType: file.type,
          body: stream
        },
        fields: 'id, webViewLink'
      });
      logger.info('UPLOAD-MEDIA: Drive API response received', {
        fileId: response.data.id,
        hasWebViewLink: !!response.data.webViewLink,
        hasThumbnailLink: !!response.data.thumbnailLink
      });
    } catch (driveError: any) {
      console.error('UPLOAD-MEDIA: Google Drive API error:', {
        message: driveError.message,
        code: driveError.code,
        errors: driveError.errors,
        statusCode: driveError.response?.status,
        statusText: driveError.response?.statusText,
        data: driveError.response?.data,
        stack: driveError.stack
      });
      logger.error('UPLOAD-MEDIA: Google Drive API error:', {
        message: driveError.message,
        code: driveError.code,
        errors: driveError.errors,
        statusCode: driveError.response?.status,
        statusText: driveError.response?.statusText,
        data: driveError.response?.data
      });
      
      // Extract specific error message
      let errorDetail = 'Unknown error';
      if (driveError.response?.data?.error?.message) {
        errorDetail = driveError.response.data.error.message;
      } else if (driveError.message) {
        errorDetail = driveError.message;
      }
      
      return NextResponse.json({ 
        error: `Google Drive upload failed: ${errorDetail}`,
        details: process.env.NODE_ENV === 'development' ? {
          code: driveError.code,
          statusCode: driveError.response?.status,
          errors: driveError.errors
        } : undefined
      }, { status: 500 });
    }
    
    logger.info('UPLOAD-MEDIA: Upload completed successfully with metadata', { 
      fileId: response.data.id, 
      journeyId: journeyId
    });

    // For images without an immediate thumbnailLink, construct one
    let thumbnailLink = response.data.thumbnailLink;
    if (!thumbnailLink && file.type.startsWith('image/')) {
      // Use Google Drive's thumbnail service URL format
      thumbnailLink = `https://drive.google.com/thumbnail?id=${response.data.id}&sz=w200`;
    }
    
    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      thumbnailLink: thumbnailLink,
      mediaType: file.type.startsWith('image/') ? 'image' : 'video'
    });

  } catch (error: any) {
    console.error('UPLOAD-MEDIA: Unexpected error during upload:', error);
    console.error('UPLOAD-MEDIA: Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errors: error.errors,
      response: error.response?.data,
      name: error.name
    });
    logger.error('UPLOAD-MEDIA: Unexpected error during upload', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errors: error.errors,
      response: error.response?.data
    });
    
    // Extract meaningful error message
    let errorMessage = 'An unexpected error occurred during file upload.';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      errorMessage = error.errors.map((e: any) => e.message || e.reason).join(', ');
    }
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    }
    
    const status = error.message?.includes('authenticated') ? 401 : 500;
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        errors: error.errors,
        name: error.name
      } : undefined
    }, { status });
  }
} 