import { NextResponse } from 'next/server';
import { uploadToGoogleDrive } from '@/lib/googleDrive';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    logger.info('Starting media upload request');
    
    const formData = await request.formData();
    logger.debug('Form data received', {
      fields: Array.from(formData.keys())
    });

    const file = formData.get('file') as File;
    const journeyId = formData.get('journeyId') as string;
    const town = formData.get('town') as string;
    const country = formData.get('country') as string;
    const journeyDate = formData.get('journeyDate') as string;

    logger.debug('Parsed form fields', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      journeyId,
      town,
      country,
      journeyDate
    });
    
    if (!file) {
      logger.error('No file provided in request');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!journeyId || !town || !country || !journeyDate) {
      logger.error('Missing required fields', {
        journeyId,
        town,
        country,
        journeyDate
      });
      return NextResponse.json(
        { error: 'Missing required journey information' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    logger.debug('Converting file to buffer', {
      fileName: file.name,
      fileSize: file.size
    });
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to Google Drive
    logger.info('Starting Google Drive upload', {
      fileName: file.name,
      journeyId
    });
    
    const result = await uploadToGoogleDrive({
      file: buffer,
      fileName: file.name,
      mimeType: file.type,
      journeyDate: new Date(journeyDate),
      journeyId,
      location: {
        town,
        country
      }
    });

    if (!result.success) {
      logger.error('Google Drive upload failed', result);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    logger.info('Upload completed successfully', {
      fileId: result.fileId,
      path: result.path,
      folderLink: result.folderLink
    });

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      path: result.path,
      folderLink: result.folderLink
    });
  } catch (error) {
    logger.error('Unexpected error during upload', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 