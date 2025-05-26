import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { logger } from '@/lib/logger';

// Define an interface for the expected row structure
// This should align with your Google Sheet columns
interface TravelLogEntry {
  'Journey ID': string;
  'Departure Date': string;
  'Arrival Date': string;
  'From Town': string;
  'From Country': string;
  'From Latitude': string; // Keep as string, will be parsed if needed
  'From Longitude': string; // Keep as string, will be parsed if needed
  'To Town': string;
  'To Country': string;
  'To Latitude': string; // Keep as string, will be parsed if needed
  'To Longitude': string; // Keep as string, will be parsed if needed
  'Distance': string; // Keep as string
  'Average Speed': string; // Keep as string
  'Max Speed': string; // Keep as string
  'Notes': string;
  'Images Link': string;
  'Videos Link': string;
  'Timestamp': string;
  [key: string]: string; // Allow for any other columns
}

export async function GET() {
  try {
    logger.info('API Route: Starting history fetch from Google Sheets');

    // Create JWT client for authentication
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.split('\\n').join('\n'), // Ensure newline characters are correctly interpreted
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Read-only scope
    });

    logger.debug('API Route: Created JWT client for Google Sheets');

    // Initialize the Google Spreadsheet document
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SHEET_ID!, serviceAccountAuth);

    // Load document properties and sheets
    await doc.loadInfo();
    logger.debug('API Route: Loaded Google Sheet document', { sheetTitle: doc.title });

    // Get the first sheet (assuming data is in the first sheet)
    const sheet = doc.sheetsByIndex[0];
    logger.debug('API Route: Accessed sheet', { sheetTitle: sheet.title });

    // Load all rows from the sheet
    // Note: getRows() automatically skips the header row for data processing,
    // but it uses the header row to determine property names.
    const rows = await sheet.getRows<TravelLogEntry>();
    logger.debug('API Route: Loaded sheet rows', { rowCount: rows.length });

    // The number of records is simply the length of the 'rows' array,
    // as getRows() does not include the header in its count.
    const recordCount = rows.length;

    // Transform rows into a plain array of objects
    // Each object's keys will be the header names from the sheet
    const data = rows.map(row => {
      // Log all headers and their raw values for the first row for detailed inspection
      if (rows.indexOf(row) === 0) { 
        logger.debug("API Route: Raw headers and values from sheet (first row only):");
        sheet.headerValues.forEach(header => {
          logger.debug(`Header: '${header}', Raw Value: '${row.get(header)}'`, { header, value: row.get(header) });
        });
      }

      // Directly construct the object to be returned
      const journeyObject = {
        id: row.get('Journey ID') || undefined,
        fromTown: row.get('From Town') || undefined,
        fromCountry: row.get('From Country') || undefined,
        fromLatitude: row.get('From Latitude') ? parseFloat(row.get('From Latitude')) : undefined,
        fromLongitude: row.get('From Longitude') ? parseFloat(row.get('From Longitude')) : undefined,
        toTown: row.get('To Town') || undefined,
        toCountry: row.get('To Country') || undefined,
        toLatitude: row.get('To Latitude') ? parseFloat(row.get('To Latitude')) : undefined,
        toLongitude: row.get('To Longitude') ? parseFloat(row.get('To Longitude')) : undefined,
        departureDate: row.get('Departure Date') || undefined,
        arrivalDate: row.get('Arrival Date') || undefined,
        distance: row.get('Distance') || undefined,
        averageSpeed: row.get('Average Speed') || undefined,
        maxSpeed: row.get('Max Speed') || undefined,
        notes: row.get('Notes') || undefined,
        imagesLink: row.get('Images Link') || undefined,
        videosLink: row.get('Videos Link') || undefined,
        timestamp: row.get('Timestamp') || undefined,
      };
      
      logger.debug('API Route: Transformed row data (direct construction)', journeyObject);
      return journeyObject;
    });

    logger.info('API Route: Successfully fetched history data', { recordCount });
    // Log the entire data array before sending it in the response
    logger.debug('API Route: Data array being sent to client', data);

    return NextResponse.json({
      success: true,
      recordCount,
      data,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('API Route: Failed to fetch history from Google Sheets', {
      error: errorMessage,
      details: error
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch history data', details: errorMessage },
      { status: 500 }
    );
  }
} 