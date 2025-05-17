import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { logger } from './logger';

// Types for our travel log entry
interface LocationData {
  town: string;
  country: string;
  lat: number;
  lng: number;
}

interface TravelLogEntry {
  journeyId: string;
  departureDate: string;
  arrivalDate: string;
  fromTown: string;
  fromCountry: string;
  fromLat: number;
  fromLng: number;
  toTown: string;
  toCountry: string;
  toLat: number;
  toLng: number;
  distance: string;
  avgSpeed: string;
  maxSpeed: string;
  notes: string;
  imageLinks?: string; // JSON string of image links
  videoLinks?: string; // JSON string of video links
}

export async function saveToGoogleSheets(entry: TravelLogEntry) {
  logger.error('DEBUG: Entered saveToGoogleSheets', { entry, typeofImageLinks: typeof entry.imageLinks, imageLinks: entry.imageLinks });
  try {
    // Validate required fields
    if (!entry.journeyId) {
      logger.error('Missing journeyId in sheet entry');
      throw new Error('Journey ID is required');
    }

    logger.info('Starting Google Sheets entry save', { 
      journeyId: entry.journeyId,
      mediaInfo: {
        hasImages: !!entry.imageLinks,
        hasVideos: !!entry.videoLinks,
        imageLinksLength: typeof entry.imageLinks === 'string' ? entry.imageLinks.length : 0,
        videoLinksLength: typeof entry.videoLinks === 'string' ? entry.videoLinks.length : 0
      }
    });
    
    // Create JWT client
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.split('\\n').join('\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    logger.debug('Created JWT client for Google Sheets');

    // Initialize the sheet
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SHEET_ID!, serviceAccountAuth);
    
    // Load the document properties and sheets
    await doc.loadInfo();
    logger.debug('Loaded Google Sheet', { sheetTitle: doc.title });

    // Get the first sheet
    const sheet = doc.sheetsByIndex[0];
    logger.debug('Accessed sheet', { sheetTitle: sheet.title });
    await sheet.loadHeaderRow();

    // Check for required columns and log if missing
    const requiredColumns = ['Images Link', 'Videos Link'];
    const sheetHeaders = sheet.headerValues || [];
    for (const col of requiredColumns) {
      if (!sheetHeaders.includes(col)) {
        logger.error('Google Sheets column missing', { column: col, availableColumns: sheetHeaders });
      }
    }

    // Debug: log the raw value and type before parsing
    logger.debug('Raw imageLinks value', { value: entry.imageLinks, type: typeof entry.imageLinks });
    logger.debug('Raw videoLinks value', { value: entry.videoLinks, type: typeof entry.videoLinks });

    // Parse and validate media links
    let parsedImageLinks = '';
    let parsedVideoLinks = '';
    
    // Only one of these branches should run for each field
    if (entry.imageLinks && typeof entry.imageLinks === 'string' && entry.imageLinks.startsWith('https://drive.google.com/drive/folders/')) {
      logger.debug('Branch: imageLinks is a folder link');
      parsedImageLinks = entry.imageLinks;
      logger.info('Saving image folder link to sheet', { imageFolderLink: parsedImageLinks });
    } else if (entry.imageLinks) {
      logger.debug('Branch: imageLinks is being parsed as JSON');
      try {
        const links = JSON.parse(entry.imageLinks);
        parsedImageLinks = Array.isArray(links) ? JSON.stringify(links) : '';
      } catch (e) {
        logger.error('Failed to parse image links', { error: e, value: entry.imageLinks });
      }
    }

    if (entry.videoLinks && typeof entry.videoLinks === 'string' && entry.videoLinks.startsWith('https://drive.google.com/drive/folders/')) {
      logger.debug('Branch: videoLinks is a folder link');
      parsedVideoLinks = entry.videoLinks;
      logger.info('Saving video folder link to sheet', { videoFolderLink: parsedVideoLinks });
    } else if (entry.videoLinks) {
      logger.debug('Branch: videoLinks is being parsed as JSON');
      try {
        const links = JSON.parse(entry.videoLinks);
        parsedVideoLinks = Array.isArray(links) ? JSON.stringify(links) : '';
      } catch (e) {
        logger.error('Failed to parse video links', { error: e, value: entry.videoLinks });
      }
    }

    // Prepare the row data with correct column names
    const newRow = {
      'Journey ID': entry.journeyId,
      'Departure Date': entry.departureDate,
      'Arrival Date': entry.arrivalDate,
      'From Town': entry.fromTown,
      'From Country': entry.fromCountry,
      'From Latitude': entry.fromLat,
      'From Longitude': entry.fromLng,
      'To Town': entry.toTown,
      'To Country': entry.toCountry,
      'To Latitude': entry.toLat,
      'To Longitude': entry.toLng,
      'Distance': entry.distance,
      'Average Speed': entry.avgSpeed,
      'Max Speed': entry.maxSpeed,
      'Notes': entry.notes,
      'Images Link': parsedImageLinks,
      'Videos Link': parsedVideoLinks,
      'Timestamp': new Date().toISOString(),
    };

    logger.debug('Prepared row data for sheet', { 
      journeyId: entry.journeyId,
      imageLinks: parsedImageLinks,
      videoLinks: parsedVideoLinks
    });

    // Add the row to the sheet
    await sheet.addRow(newRow);
    logger.info('Successfully added row to sheet', { 
      journeyId: entry.journeyId,
      timestamp: newRow.Timestamp,
      mediaInfo: {
        hasImages: !!parsedImageLinks,
        hasVideos: !!parsedVideoLinks
      }
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to save entry to Google Sheets', {
      error: error instanceof Error ? error.message : 'Unknown error',
      journeyId: entry.journeyId
    });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save entry' };
  }
} 