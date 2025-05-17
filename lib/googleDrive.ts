import { drive_v3, google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';
import crypto from 'crypto';
import { format } from 'date-fns';
import { logger } from './logger';
import { GoogleDriveFolderManager } from './GoogleDriveFolderManager';

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
  folderId: string;
  folderLink: string;
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

    const baseFolder = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID;
    if (!baseFolder) {
      throw new Error('Base folder ID not configured');
    }

    // Get folder manager instance
    const folderManager = GoogleDriveFolderManager.getInstance(drive, baseFolder);

    // Format year and month
    const year = journeyDate.getFullYear().toString();
    const month = (journeyDate.getMonth() + 1).toString().padStart(2, '0');

    // Get or create folder structure
    const folders = await folderManager.ensureFolderStructure(year, month, journeyId);
    logger.debug('Retrieved folder structure', { folders });
    
    // Determine media type and target folder
    const mediaType = mimeType.includes('image') ? 'image' : 'video';
    const targetFolderId = mediaType === 'image' ? folders.imagesId : folders.videosId;
    const folderLink = `https://drive.google.com/drive/folders/${targetFolderId}`;

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
        parents: [targetFolderId],
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
        path: `${year}/${month}/${journeyId}/${mediaType === 'image' ? 'images' : 'videos'}/${secureFileName}`,
        mediaType: mediaType as 'image' | 'video',
        folderId: targetFolderId,
        folderLink
      };

      logger.info('Successfully uploaded media to Drive', {
        journeyId,
        mediaType: result.mediaType,
        path: result.path,
        folderLink: result.folderLink
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