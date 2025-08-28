import { google } from 'googleapis';
import { db } from './db';
import { logger } from './logger';

/**
 * Ensures Google Drive folder exists for the user
 * Creates it if it doesn't exist and updates the database
 */
export async function ensureDriveFolderExists(auth: any, userId: string): Promise<string> {
  logger.info('Ensuring Google Drive folder exists for user:', userId);
  
  try {
    // First, check if we have a folder ID in the database
    const configQuery = await db.query(
      `SELECT "googleDriveFolderId" FROM user_google_config WHERE "userId" = $1`,
      [userId]
    );
    
    const existingFolderId = configQuery.rows[0]?.googleDriveFolderId;
    
    if (existingFolderId) {
      // Verify the folder still exists in Google Drive
      const drive = google.drive({ version: 'v3', auth });
      try {
        const folder = await drive.files.get({
          fileId: existingFolderId,
          fields: 'id, trashed'
        });
        
        if (!folder.data.trashed) {
          logger.info('Existing Google Drive folder verified:', existingFolderId);
          return existingFolderId;
        }
        
        logger.warn('Existing folder is trashed, creating new one');
      } catch (error: any) {
        if (error.code === 404) {
          logger.warn('Folder not found in Drive, creating new one');
        } else {
          logger.error('Error checking folder existence:', error);
        }
      }
    }
    
    // Create new folder if needed
    logger.info('Creating new Google Drive folder for WanderNote');
    const drive = google.drive({ version: 'v3', auth });
    
    const driveFolder = await drive.files.create({
      requestBody: {
        name: 'WanderNote App Data',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    
    const newFolderId = driveFolder.data.id;
    if (!newFolderId) {
      throw new Error('Failed to create Google Drive folder');
    }
    
    logger.info('Created new Google Drive folder:', newFolderId);
    
    // Update or insert the configuration
    await db.query(
      `
      INSERT INTO user_google_config ("userId", "googleDriveFolderId", "createdAt", "updatedAt")
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT ("userId")
      DO UPDATE SET
        "googleDriveFolderId" = EXCLUDED."googleDriveFolderId",
        "updatedAt" = NOW()
      `,
      [userId, newFolderId]
    );
    
    logger.info('Updated database with new folder ID');
    
    return newFolderId;
  } catch (error) {
    logger.error('Failed to ensure Drive folder exists:', error);
    throw error;
  }
}