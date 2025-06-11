import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
  }

  try {
    logger.debug('THUMBNAIL-PROXY: Fetching thumbnail', { url });

    // For Google Drive thumbnails, we need to authenticate
    if (url.includes('googleusercontent.com') || url.includes('drive.google.com')) {
      try {
        const { auth } = await getAuthenticatedClient();
        
        // Use the authenticated Google client to fetch the image
        const imageResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${(auth as any).credentials.access_token}`,
            'User-Agent': 'WanderNote/1.0'
          }
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          logger.error('THUMBNAIL-PROXY: Failed to fetch authenticated image from Google', {
            status: imageResponse.status,
            statusText: imageResponse.statusText,
            error: errorText,
            url
          });
          return NextResponse.json({ 
            error: 'Failed to fetch image from Google', 
            details: errorText 
          }, { status: imageResponse.status });
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        logger.debug('THUMBNAIL-PROXY: Successfully fetched authenticated image', {
          contentType,
          size: imageBuffer.byteLength
        });

        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=600, must-revalidate', // Cache for 10 mins
            'Cross-Origin-Resource-Policy': 'cross-origin',
          },
        });
      } catch (authError) {
        logger.error('THUMBNAIL-PROXY: Authentication failed, trying direct fetch', { authError });
        // Fall back to direct fetch if authentication fails
      }
    }

    // Direct fetch for non-Google URLs or as fallback
    const imageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'WanderNote/1.0'
      }
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      logger.error('THUMBNAIL-PROXY: Failed to fetch image directly', {
        status: imageResponse.status,
        statusText: imageResponse.statusText,
        error: errorText,
        url
      });
      return NextResponse.json({ 
        error: 'Failed to fetch image', 
        details: errorText 
      }, { status: imageResponse.status });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    logger.debug('THUMBNAIL-PROXY: Successfully fetched image directly', {
      contentType,
      size: imageBuffer.byteLength
    });

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=600, must-revalidate',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });

  } catch (error) {
    logger.error('THUMBNAIL-PROXY: Error in thumbnail proxy', { error, url });
    return NextResponse.json({ 
      error: 'Internal server error proxying image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}