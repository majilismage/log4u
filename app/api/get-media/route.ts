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
  journeyId: string;
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
    
    const query = `'${googleDriveFolderId}' in parents and appProperties has { key='isLog4uMedia' and value='true' } and trashed=false`;
    logger.info('Executing Google Drive search query', { query });

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink, thumbnailLink, mimeType, createdTime, appProperties)',
      orderBy: 'createdTime desc',
      pageSize: 1000,
    });
    
    const files = response.data.files || [];
    logger.info(`Google Drive API returned ${files.length} files.`);

    const mediaByJourneyId = files.reduce((acc, file) => {
      const journeyId = file.appProperties?.journeyId;

      if (journeyId && file.id && file.name && file.webViewLink && file.thumbnailLink) {
        if (!acc[journeyId]) {
          acc[journeyId] = [];
          logger.info('GET-MEDIA: Found new journey ID in media files', {
            journeyId,
            journeyIdType: typeof journeyId,
            journeyIdLength: journeyId.length,
            journeyIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journeyId) ? 'UUID' :
              /^J\d+$/.test(journeyId) ? 'J+timestamp' :
              'other',
            fileName: file.name,
            fileId: file.id
          });
        }

        acc[journeyId].push({
          id: file.id,
          name: file.name,
          webViewLink: file.webViewLink,
          thumbnailLink: file.thumbnailLink,
          mimeType: file.mimeType || 'application/octet-stream',
          createdTime: file.createdTime || new Date().toISOString(),
          journeyId: journeyId,
        });
      } else {
        logger.warn('GET-MEDIA: Skipping file with missing journeyId or other essential fields like thumbnailLink', { 
          fileId: file.id, 
          fileName: file.name,
          hasJourneyId: !!journeyId,
          hasThumbnail: !!file.thumbnailLink,
          journeyIdValue: journeyId
        });
      }
      return acc;
    }, {} as GroupedMedia);

    const foundJourneyIds = Object.keys(mediaByJourneyId);
    logger.info('GET-MEDIA: Media fetch and grouping completed successfully', {
      totalItems: files.length,
      journeyCount: foundJourneyIds.length,
      foundJourneyIds: foundJourneyIds,
      journeyIdPatterns: foundJourneyIds.map(id => ({
        id,
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? 'UUID' :
          /^J\d+$/.test(id) ? 'J+timestamp' :
          'other'
      }))
    });

    return NextResponse.json({
      success: true,
      mediaByJourneyId: mediaByJourneyId,
    });
  } catch (error) {
    logger.error('Error fetching media:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
        // It can be useful to see the full error object for some cases
        // @ts-ignore
        details: error.errors || error.response?.data
      } : JSON.stringify(error, null, 2)
    });
    return NextResponse.json(
      { error: 'Failed to fetch media',
        // Provide more detailed error info in development
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
       },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { mediaId?: string } | null
    const mediaId = body?.mediaId
    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
    }

    const { auth } = await getAuthenticatedClient()
    const drive = google.drive({ version: 'v3', auth })

    await drive.files.delete({ fileId: mediaId })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const status = (error?.code as number) || (error?.response?.status as number) || 500
    if (status === 404) {
      // Treat missing file as already deleted
      return NextResponse.json({ success: true, note: 'Already deleted' })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error deleting media', { error: message, status })
    return NextResponse.json({ error: 'Failed to delete media', details: message }, { status: 500 })
  }
}
