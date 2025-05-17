import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

// Initialize Google Drive client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

interface MediaItem {
  id: string;
  name: string;
  webViewLink: string;
  thumbnailLink?: string;
  mimeType: string;
  createdTime: string;
  journeyId: string;
}

export async function GET() {
  try {
    logger.info('Starting media fetch request');

    // Get the base folder where all journey media is stored
    const baseFolder = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
    if (!baseFolder) {
      logger.error('Base folder ID not configured');
      return NextResponse.json(
        { error: 'Drive configuration missing' },
        { status: 500 }
      );
    }

    logger.debug('Listing journey folders', { baseFolder });

    // List all journey folders
    const journeyFolders = await drive.files.list({
      q: `'${baseFolder}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
      orderBy: 'createdTime desc',
    });

    logger.debug('Found journey folders', { 
      count: journeyFolders.data.files?.length || 0,
      folders: journeyFolders.data.files?.map(f => ({ id: f.id, name: f.name }))
    });

    const mediaItems: MediaItem[] = [];

    // For each journey folder, get its media files
    for (const folder of journeyFolders.data.files || []) {
      const journeyId = folder.name || 'unknown';
      logger.debug('Processing journey folder', { journeyId, folderId: folder.id });
      
      // List all files in this journey's folder
      const files = await drive.files.list({
        q: `'${folder.id}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')`,
        fields: 'files(id, name, webViewLink, thumbnailLink, mimeType, createdTime)',
        orderBy: 'createdTime desc',
      });

      logger.debug('Found media files in journey', { 
        journeyId, 
        count: files.data.files?.length || 0,
        files: files.data.files?.map(f => ({ 
          id: f.id, 
          name: f.name,
          mimeType: f.mimeType,
          hasWebViewLink: !!f.webViewLink,
          hasThumbnail: !!f.thumbnailLink
        }))
      });

      // Add each file to our results
      for (const file of files.data.files || []) {
        if (file.id && file.name && file.webViewLink) {
          mediaItems.push({
            id: file.id,
            name: file.name,
            webViewLink: file.webViewLink,
            thumbnailLink: file.thumbnailLink || undefined,
            mimeType: file.mimeType || 'application/octet-stream',
            createdTime: file.createdTime || new Date().toISOString(),
            journeyId,
          });
        } else {
          logger.warn('Skipping invalid media file', {
            journeyId,
            fileId: file.id,
            fileName: file.name,
            hasWebViewLink: !!file.webViewLink
          });
        }
      }
    }

    // Sort all media items by creation time (newest first)
    mediaItems.sort((a, b) => {
      return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
    });

    logger.info('Media fetch completed', {
      totalItems: mediaItems.length,
      journeyCount: journeyFolders.data.files?.length || 0,
      itemsPerJourney: mediaItems.reduce((acc, item) => {
        acc[item.journeyId] = (acc[item.journeyId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    return NextResponse.json({
      success: true,
      media: mediaItems,
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