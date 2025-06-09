import { NextResponse } from 'next/server';
import { google, drive_v3 } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { logger } from '@/lib/logger';

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
    const { auth, googleDriveFolderId } = await getAuthenticatedClient();

    if (!googleDriveFolderId) {
      logger.warn('User has no Google Drive Folder ID configured. Returning empty gallery.');
      return NextResponse.json({ success: true, media: {} });
    }

    const drive = google.drive({ version: 'v3', auth });
    
    // Efficiently get all descendant files and folders in two calls

    // 1. Get all folders
    const allFoldersRes = await drive.files.list({
        q: `'${googleDriveFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name, parents)',
        pageSize: 1000,
    });
    const folders = allFoldersRes.data.files || [];
    
    // 2. Get all files
    const allFilesRes = await drive.files.list({
        q: `'${googleDriveFolderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')`,
        fields: 'files(id, name, webViewLink, thumbnailLink, mimeType, createdTime, parents)',
        pageSize: 1000
    });
    const files = allFilesRes.data.files || [];

    // 3. Build a map of the folder hierarchy
    const folderMap = new Map<string, {name: string, parent: string | null}>();
    folders.forEach(f => folderMap.set(f.id!, { name: f.name!, parent: f.parents ? f.parents[0] : null }));

    // 4. Group media by journey ID by traversing the map
    const groupedMedia: GroupedMedia = {};
    for(const file of files) {
        let parentId = file.parents ? file.parents[0] : null;
        let journeyId: string | null = null;

        // Traverse up to find the journeyId (which is 2 levels up from the file)
        let currentFolder = parentId ? folderMap.get(parentId) : null; // 'images' or 'videos' folder
        if (currentFolder && currentFolder.parent) {
             let journeyFolder = folderMap.get(currentFolder.parent); // 'journeyId' folder
             if(journeyFolder) {
                journeyId = journeyFolder.name;
             }
        }

        if (journeyId) {
             if (!groupedMedia[journeyId]) {
                groupedMedia[journeyId] = [];
            }
            groupedMedia[journeyId].push({
                id: file.id!,
                name: file.name!,
                webViewLink: file.webViewLink!,
                thumbnailLink: file.thumbnailLink?.replace(/=s220$/, '=s400'),
                mimeType: file.mimeType!,
                createdTime: file.createdTime!,
            });
        }
    }
    
    // Sort media within each group
    for (const journeyId in groupedMedia) {
      groupedMedia[journeyId].sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
    }

    logger.info(`Successfully fetched and grouped ${files.length} media items.`);

    return NextResponse.json({
      success: true,
      media: groupedMedia,
    });
  } catch (error: any) {
    logger.error('Error fetching media:', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: 'Failed to fetch media from Google Drive' },
      { status: 500 }
    );
  }
} 