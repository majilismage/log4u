import { drive_v3, google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';
import crypto from 'crypto';
import { format } from 'date-fns';
import { logger } from './logger';

interface FolderStructure {
  yearId: string;
  monthId: string;
  journeyId: string;
  mediaTypeId: string;
}

interface UploadParams {
  file: Buffer;
  fileName: string;
  mimeType: string;
  journeyDate: Date;
  journeyId: string;
  location: {
    town: string;
    country: string;
  };
}

interface UploadResponse {
  success: true;
  fileId: string;
  webViewLink: string;
  path: string;
  mediaType: 'image' | 'video';
}

interface UploadError {
  success: false;
  error: string;
}

type UploadResult = UploadResponse | UploadError;

export async function uploadToGoogleDrive({
  file,
  fileName,
  mimeType,
  journeyDate,
  journeyId,
  location
}: UploadParams): Promise<UploadResult> {
  try {
    logger.info('Starting Google Drive upload', { 
      journeyId,
      fileName,
      mimeType 
    });

    // Create JWT client
    const auth = new JWT({
      email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.split('\\n').join('\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    logger.debug('Created JWT client for Google Drive');

    // Create Drive client
    const drive = google.drive({ version: 'v3', auth });

    // Get or create folder structure
    const folders = await ensureFolderStructure(drive, journeyDate, journeyId, mimeType);
    logger.debug('Created/retrieved folder structure', { folders });
    
    // Generate secure filename
    const locationPart = `${location.town}-${location.country}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const datePart = format(journeyDate, 'dd-MMM-yyyy');
    const fileNamePart = fileName.split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const fileHash = crypto.createHash('sha256')
      .update(fileName + Date.now().toString())
      .digest('hex')
      .slice(0, 6);
    const extension = fileName.split('.').pop();
    const secureFileName = `${locationPart}_${datePart}_${fileNamePart}_${fileHash}.${extension}`;

    // Convert Buffer to Readable Stream
    const stream = new Readable();
    stream.push(file);
    stream.push(null);

    // Upload file to Drive in the correct folder
    const response = await drive.files.create({
      requestBody: {
        name: secureFileName,
        mimeType: mimeType,
        parents: [folders.mediaTypeId],
        properties: {
          journeyId: journeyId,
          uploadDate: new Date().toISOString(),
          originalFileName: fileName,
          location: `${location.town}, ${location.country}`
        }
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
    });

    if (response.data.id) {
      logger.debug('File uploaded successfully', { fileId: response.data.id });

      // Set permissions - anyone with the link can view
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      logger.debug('File permissions set to anyone with link');

      // Get the web view link
      const fileData = await drive.files.get({
        fileId: response.data.id,
        fields: 'webViewLink,id',
      });

      if (!fileData.data.webViewLink) {
        throw new Error('Failed to get web view link');
      }

      const result = {
        success: true as const,
        fileId: response.data.id,
        webViewLink: fileData.data.webViewLink,
        path: `${journeyDate.getFullYear()}/${(journeyDate.getMonth() + 1).toString().padStart(2, '0')}/${journeyId}/${mimeType.includes('image') ? 'images' : 'videos'}/${secureFileName}`,
        mediaType: mimeType.includes('image') ? 'image' as const : 'video' as const
      };

      logger.info('Successfully uploaded media to Drive', {
        journeyId,
        mediaType: result.mediaType,
        path: result.path
      });

      return result;
    }

    throw new Error('Failed to upload file');
  } catch (error) {
    logger.error('Google Drive upload error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    };
  }
}

async function ensureFolderStructure(
  drive: drive_v3.Drive,
  journeyDate: Date,
  journeyId: string,
  mimeType: string
): Promise<FolderStructure> {
  const baseFolder = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
  if (!baseFolder) {
    throw new Error('Base folder ID not configured');
  }

  const year = journeyDate.getFullYear().toString();
  const month = (journeyDate.getMonth() + 1).toString().padStart(2, '0');
  
  // Create or get year folder
  const yearFolder = await getOrCreateFolder(drive, year, baseFolder);
  
  // Create or get month folder
  const monthFolder = await getOrCreateFolder(drive, month, yearFolder);
  
  // Create or get journey folder
  const journeyFolder = await getOrCreateFolder(drive, journeyId, monthFolder);
  
  // Create or get media type folders
  const mediaTypeFolder = await getOrCreateFolder(
    drive,
    mimeType.includes('image') ? 'images' : 'videos',
    journeyFolder
  );

  return {
    yearId: yearFolder,
    monthId: monthFolder,
    journeyId: journeyFolder,
    mediaTypeId: mediaTypeFolder
  };
}

async function getOrCreateFolder(
  drive: drive_v3.Drive,
  folderName: string,
  parentId: string
): Promise<string> {
  // Check if folder exists
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  // Create folder if it doesn't exist
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