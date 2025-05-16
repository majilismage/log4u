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
      hasImageLinks: !!entry.imageLinks,
      hasVideoLinks: !!entry.videoLinks
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

    // Prepare the row data
    const newRow = {
      'Journey ID': entry.journeyId || '',  // Ensure non-null
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
      'Image Links': entry.imageLinks || '',
      'Video Links': entry.videoLinks || '',
      'Timestamp': new Date().toISOString(),
    };

    logger.debug('Prepared row data for sheet', { 
      journeyId: entry.journeyId,
      hasImageLinks: !!entry.imageLinks,
      hasVideoLinks: !!entry.videoLinks,
      imageLinksValue: entry.imageLinks || 'none',
      videoLinksValue: entry.videoLinks || 'none'
    });

    // Add the row to the sheet
    await sheet.addRow(newRow);
    logger.info('Successfully added row to sheet', { 
      journeyId: entry.journeyId,
      timestamp: newRow.Timestamp,
      imageLinks: !!entry.imageLinks,
      videoLinks: !!entry.videoLinks
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to save entry to Google Sheets', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save entry' };
  }
} 