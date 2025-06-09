import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

// Based on the previous implementation and expected frontend structure
const columnHeaders = [
  'journeyId', 'departureDate', 'arrivalDate', 'fromTown', 'fromCountry', 'fromLat', 'fromLng',
  'toTown', 'toCountry', 'toLat', 'toLng', 'distance', 'averageSpeed', 'maxSpeed',
  'notes', 'imagesLink', 'videosLink', 'timestamp'
];

export async function GET() {
  try {
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      logger.warn('User has no Google Sheet ID configured. Returning empty history.');
      return NextResponse.json({ success: true, recordCount: 0, data: [] });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      // Assuming data is in the first sheet and starts at A2 to skip headers
      range: 'A2:R', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      logger.info('No history entries found in the user\'s sheet.');
      return NextResponse.json({ success: true, recordCount: 0, data: [] });
    }
    
    // Transform rows into a plain array of objects
    const data = rows.map(row => {
      const journeyObject: { [key: string]: any } = {};
      columnHeaders.forEach((header, index) => {
        // Handle numeric conversions
        if (['fromLat', 'fromLng', 'toLat', 'toLng', 'distance', 'averageSpeed', 'maxSpeed'].includes(header)) {
            journeyObject[header] = row[index] ? parseFloat(row[index]) : undefined;
        } else {
            journeyObject[header] = row[index] || undefined;
        }
      });
      return journeyObject;
    }).sort((a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime()); // Sort by most recent arrival

    logger.info(`Successfully fetched ${data.length} history entries for the user.`);

    return NextResponse.json({
      success: true,
      recordCount: data.length,
      data,
    });

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    logger.error('API Route: Failed to fetch history from Google Sheets', { error: errorMessage });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch history data', details: errorMessage },
      { status: 500 }
    );
  }
}