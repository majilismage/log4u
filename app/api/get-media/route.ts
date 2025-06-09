import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';
import { getAuthenticatedClient } from '@/lib/google-api-client';

interface MediaItem {
  id: string;
  name: string;
  webViewLink: string;
  thumbnailLink?: string;
  mimeType: string;
  createdTime: string;
}

interface GroupedMedia {
  [journeyId: string]: MediaItem[];
}

export async function GET() {
  try {
    logger.info('Starting media fetch request');

    const { auth, googleDriveFolderId } = await getAuthenticatedClient();
    if (!googleDriveFolderId) {
      return NextResponse.json(
        { error: 'Google Drive folder is not configured for this user.' },
        { status: 400 }
      );
    }
    
    const drive = google.drive({ version: 'v3', auth });

    logger.debug('Fetching all media files from Drive root', { googleDriveFolderId });

    const response = await drive.files.list({
      q: `'${googleDriveFolderId}' in parents and appProperties has { key='journeyId' } and trashed=false`,
      fields: 'files(id, name, webViewLink, thumbnailLink, mimeType, createdTime, appProperties)',
      orderBy: 'createdTime desc',
      pageSize: 1000, // Fetch up to 1000 items in a single request
    });
    
    const files = response.data.files || [];
    logger.debug(`Found ${files.length} media files with journeyId property.`);

    const groupedMedia = files.reduce((acc, file) => {
      const journeyId = file.appProperties?.journeyId;

      if (journeyId && file.id && file.name && file.webViewLink) {
        if (!acc[journeyId]) {
          acc[journeyId] = [];
        }

        acc[journeyId].push({
          id: file.id,
          name: file.name,
          webViewLink: file.webViewLink,
          thumbnailLink: file.thumbnailLink || undefined,
          mimeType: file.mimeType || 'application/octet-stream',
          createdTime: file.createdTime || new Date().toISOString(),
        });
      } else {
        logger.warn('Skipping file with missing journeyId or essential fields', { fileId: file.id });
      }
      return acc;
    }, {} as GroupedMedia);

    logger.info('Media fetch and grouping completed', {
      totalItems: files.length,
      journeyCount: Object.keys(groupedMedia).length
    });

    return NextResponse.json({
      success: true,
      media: groupedMedia,
    });
  } catch (error) {
    logger.error('Error fetching media:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
} 