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
        imageLinksType: typeof entry.imageLinks,
        videoLinksType: typeof entry.videoLinks
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
    
    try {
      await sheet.loadHeaderRow();
    } catch (error) {
      logger.error('Failed to load sheet headers', { error });
      throw new Error('Failed to load sheet headers: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    // Check for required columns and log if missing
    const requiredColumns = ['Images Link', 'Videos Link'];
    const sheetHeaders = sheet.headerValues || [];
    const missingColumns = requiredColumns.filter(col => !sheetHeaders.includes(col));
    if (missingColumns.length > 0) {
      logger.error('Missing required columns in sheet', { missingColumns, availableColumns: sheetHeaders });
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Parse and validate media links
    let parsedImageLinks = '';
    let parsedVideoLinks = '';
    
    if (entry.imageLinks && typeof entry.imageLinks === 'string' && entry.imageLinks.startsWith('https://drive.google.com/drive/folders/')) {
      parsedImageLinks = entry.imageLinks;
      logger.info('Using image folder link', { imageFolderLink: parsedImageLinks });
    } else if (entry.imageLinks) {
      try {
        const links = JSON.parse(entry.imageLinks);
        parsedImageLinks = Array.isArray(links) ? JSON.stringify(links) : '';
        logger.debug('Parsed image links from JSON', { parsedLinks: parsedImageLinks });
      } catch (e) {
        logger.error('Failed to parse image links', { error: e, value: entry.imageLinks });
        throw new Error('Invalid image links format');
      }
    }

    if (entry.videoLinks && typeof entry.videoLinks === 'string' && entry.videoLinks.startsWith('https://drive.google.com/drive/folders/')) {
      parsedVideoLinks = entry.videoLinks;
      logger.info('Using video folder link', { videoFolderLink: parsedVideoLinks });
    } else if (entry.videoLinks) {
      try {
        const links = JSON.parse(entry.videoLinks);
        parsedVideoLinks = Array.isArray(links) ? JSON.stringify(links) : '';
        logger.debug('Parsed video links from JSON', { parsedLinks: parsedVideoLinks });
      } catch (e) {
        logger.error('Failed to parse video links', { error: e, value: entry.videoLinks });
        throw new Error('Invalid video links format');
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