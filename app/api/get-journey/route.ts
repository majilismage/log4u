import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

interface JourneyDetails {
  journeyId: string;
  departureDate: string;
  arrivalDate: string;
  fromTown: string;
  fromCountry: string;
  toTown: string;
  toCountry: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const journeyId = searchParams.get('journeyId');

    if (!journeyId) {
      logger.error('Missing journeyId parameter');
      return NextResponse.json(
        { error: 'Journey ID is required' },
        { status: 400 }
      );
    }

    logger.info('Starting journey details fetch', { journeyId });

    // Get authenticated client using user's OAuth tokens
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      logger.error('User has no Google Sheet ID configured');
      return NextResponse.json(
        { error: 'Google Sheet not configured. Please set up your spreadsheet in settings.' },
        { status: 400 }
      );
    }

    logger.debug('Using user\'s Google Sheet', { googleSheetsId });

    // Create Sheets API client with user's OAuth token
    const sheets = google.sheets({ version: 'v4', auth });

    // Get all rows from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:R', // Assuming headers are in row 1, data starts from row 2
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      logger.info('No data found in user\'s sheet');
      return NextResponse.json(
        { error: 'No journey data found' },
        { status: 404 }
      );
    }

    logger.debug('Loaded sheet rows', { rowCount: rows.length });

    // Column headers based on your sheet structure
    const columnHeaders = [
      'Journey ID', 'Departure Date', 'Arrival Date', 'From Town', 'From Country',
      'From Latitude', 'From Longitude', 'To Town', 'To Country', 'To Latitude',
      'To Longitude', 'Distance', 'Average Speed', 'Max Speed', 'Notes',
      'Images Link', 'Videos Link', 'Timestamp'
    ];

    // Find the row with matching journey ID (assuming Journey ID is in column A, index 0)
    const journeyRowData = rows.find(row => row[0] === journeyId);

    if (!journeyRowData) {
      logger.error('Journey not found', { journeyId });
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    // Map the row data to the journey object
    const journey: JourneyDetails = {
      journeyId: journeyRowData[0] || '',
      departureDate: journeyRowData[1] || '',
      arrivalDate: journeyRowData[2] || '',
      fromTown: journeyRowData[3] || '',
      fromCountry: journeyRowData[4] || '',
      toTown: journeyRowData[7] || '',
      toCountry: journeyRowData[8] || '',
    };

    logger.info('Journey details fetch completed', { journeyId });

    return NextResponse.json({
      success: true,
      journey
    });
  } catch (error) {
    logger.error('Error fetching journey details:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });
    return NextResponse.json(
      { error: 'Failed to fetch journey details' },
      { status: 500 }
    );
  }
} 