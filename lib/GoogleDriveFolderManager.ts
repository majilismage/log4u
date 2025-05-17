import { drive_v3 } from 'googleapis';
import { logger } from './logger';

export interface FolderStructure {
  yearId: string;
  monthId: string;
  journeyId: string;
  imagesId: string;
  videosId: string;
  exists: boolean;
}

export class GoogleDriveFolderManager {
  private static instance: GoogleDriveFolderManager;
  private folderCache: Map<string, Promise<FolderStructure>>;
  private drive: drive_v3.Drive;
  private baseFolder: string;

  private constructor(drive: drive_v3.Drive, baseFolder: string) {
    this.drive = drive;
    this.baseFolder = baseFolder;
    this.folderCache = new Map();
  }

  public static getInstance(drive: drive_v3.Drive, baseFolder: string): GoogleDriveFolderManager {
    if (!GoogleDriveFolderManager.instance) {
      GoogleDriveFolderManager.instance = new GoogleDriveFolderManager(drive, baseFolder);
    }
    return GoogleDriveFolderManager.instance;
  }

  private generateCacheKey(year: string, month: string, journeyId: string): string {
    return `${year}/${month}/${journeyId}`;
  }

  private async createFolder(name: string, parentId: string): Promise<string> {
    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };

    const folder = await this.drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    logger.debug('Created new folder', { name, id: folder.data.id });
    return folder.data.id!;
  }

  private async findFolder(name: string, parentId: string): Promise<string | null> {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`;
    const response = await this.drive.files.list({ q: query, fields: 'files(id, name)' });
    return response.data.files?.[0]?.id || null;
  }

  private async createOrGetFolder(name: string, parentId: string): Promise<string> {
    const existingId = await this.findFolder(name, parentId);
    if (existingId) {
      return existingId;
    }
    return this.createFolder(name, parentId);
  }

  public async ensureFolderStructure(
    year: string,
    month: string,
    journeyId: string
  ): Promise<FolderStructure> {
    const cacheKey = this.generateCacheKey(year, month, journeyId);
    
    // Check if there's a pending or completed folder structure creation
    let structurePromise = this.folderCache.get(cacheKey);
    if (structurePromise) {
      return structurePromise;
    }

    // Create new promise for folder structure
    structurePromise = (async () => {
      try {
        logger.info('Creating/validating folder structure', { year, month, journeyId });

        // Check if complete structure exists first
        const yearFolder = await this.findFolder(year, this.baseFolder);
        if (!yearFolder) {
          return this.createCompleteStructure(year, month, journeyId);
        }

        const monthFolder = await this.findFolder(month, yearFolder);
        if (!monthFolder) {
          return this.createCompleteStructure(year, month, journeyId);
        }

        const journeyFolder = await this.findFolder(journeyId, monthFolder);
        if (!journeyFolder) {
          return this.createCompleteStructure(year, month, journeyId);
        }

        // Check for media folders
        const imagesFolder = await this.findFolder('images', journeyFolder);
        const videosFolder = await this.findFolder('videos', journeyFolder);

        if (!imagesFolder || !videosFolder) {
          return this.createCompleteStructure(year, month, journeyId);
        }

        // Complete structure exists
        return {
          yearId: yearFolder,
          monthId: monthFolder,
          journeyId: journeyFolder,
          imagesId: imagesFolder,
          videosId: videosFolder,
          exists: true
        };
      } catch (error) {
        logger.error('Error ensuring folder structure', error);
        throw error;
      }
    })();

    // Store in cache
    this.folderCache.set(cacheKey, structurePromise);

    return structurePromise;
  }

  private async createCompleteStructure(
    year: string,
    month: string,
    journeyId: string
  ): Promise<FolderStructure> {
    // Create all folders in sequence
    const yearId = await this.createOrGetFolder(year, this.baseFolder);
    const monthId = await this.createOrGetFolder(month, yearId);
    const journeyFolderId = await this.createOrGetFolder(journeyId, monthId);
    const imagesId = await this.createOrGetFolder('images', journeyFolderId);
    const videosId = await this.createOrGetFolder('videos', journeyFolderId);

    return {
      yearId,
      monthId,
      journeyId: journeyFolderId,
      imagesId,
      videosId,
      exists: false
    };
  }

  public clearCache(): void {
    this.folderCache.clear();
  }
} 