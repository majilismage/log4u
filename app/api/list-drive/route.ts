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

logger.debug('Drive auth initialized', { 
  isAuthSet: !!auth,
  clientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.substring(0, 8) + '...'
});

const drive = google.drive({ version: 'v3', auth });

// Helper function to recursively get folders and then files
async function getFoldersRecursive(parentId: string, depthOfListedItems: number): Promise<any[]> {
  let listQuery: string;
  let listFields: string;
  let isListingFiles = false;

  if (depthOfListedItems === 4) { // Depth 4: Listing files inside "images" or "videos" folders
    listQuery = `'${parentId}' in parents AND NOT mimeType = 'application/vnd.google-apps.folder'`;
    listFields = 'files(id, name, mimeType, webViewLink, thumbnailLink, createdTime, modifiedTime, size, videoMediaMetadata)';
    isListingFiles = true;
    logger.debug('Listing media files for parent', { parentId, childrenDepth: depthOfListedItems });
  } else { // Depths 0-3: Listing folders (Year, Month, JourneyID, or Images/Videos folders themselves)
    listQuery = `'${parentId}' in parents AND mimeType = 'application/vnd.google-apps.folder'`;
    listFields = 'files(id, name, mimeType)';
    logger.debug('Listing folders for parent', { parentId, childrenDepth: depthOfListedItems });
  }

  const response = await drive.files.list({
    q: listQuery,
    fields: listFields,
    orderBy: 'name',
    pageSize: 1000, // Max page size for folders/files within a directory
  });

  const items = response.data.files || [];
  if (items.length === 0) {
    return [];
  }

  if (isListingFiles) {
    // If listing files, just return their details, no further recursion for them.
    return items.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      thumbnailLink: file.thumbnailLink,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      size: file.size,
      videoMediaMetadata: file.videoMediaMetadata,
    }));
  }

  // If we are here, items are folders.
  const processedFolders = await Promise.all(
    items.map(async (folder) => {
      let childrenContent: any[] | undefined;

      if (depthOfListedItems === 3) { // Current items are "images" or "videos" folders (depth 3)
        if (folder.name === 'images' || folder.name === 'videos') {
          // For these specific folders, their children are files (depth 4)
          childrenContent = await getFoldersRecursive(folder.id!, depthOfListedItems + 1);
        }
        // Other folders at depth 3 (if any) won't have children fetched by this logic.
      } else if (depthOfListedItems < 3) { // Current items are Year (0), Month (1), or Journey_ID (2) folders
        // Fetch their sub-folder children.
        childrenContent = await getFoldersRecursive(folder.id!, depthOfListedItems + 1);
      }
      // For folders at depth > 3, or depth 3 not matching images/videos, childrenContent remains undefined.

      return {
        id: folder.id,
        name: folder.name,
        mimeType: folder.mimeType,
        children: childrenContent && childrenContent.length > 0 ? childrenContent : undefined,
      };
    })
  );
  return processedFolders;
}

export async function GET() {
  try {
    logger.info('Starting recursive Drive folder and file list request');

    const baseFolder = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
    if (!baseFolder) {
      logger.error('Base folder ID not configured');
      return NextResponse.json(
        { error: 'Drive configuration missing' },
        { status: 500 }
      );
    }

    logger.debug('Starting recursive listing from base folder', { baseFolder });

    const folderTree = await getFoldersRecursive(baseFolder, 0); // Initial call: items under baseFolder are at depth 0 (Years)

    logger.info('Recursive Drive folder and file list completed', {
      topLevelFolderCount: folderTree.length
    });

    return NextResponse.json({
      success: true,
      items: folderTree // The root of your folder tree
    });
  } catch (error) {
    logger.error('Error listing Drive folders recursively:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });
    return NextResponse.json(
      { error: 'Failed to list Drive contents' },
      { status: 500 }
    );
  }
} 