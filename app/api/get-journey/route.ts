import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
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

    // Create JWT client
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.split('\\n').join('\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
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

    // Load all rows
    const rows = await sheet.getRows();
    logger.debug('Loaded sheet rows', { rowCount: rows.length });

    // Find the row with matching journey ID
    const journeyRow = rows.find(row => row.get('Journey ID') === journeyId);

    if (!journeyRow) {
      logger.error('Journey not found', { journeyId });
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    const journey: JourneyDetails = {
      journeyId: journeyRow.get('Journey ID'),
      departureDate: journeyRow.get('Departure Date'),
      arrivalDate: journeyRow.get('Arrival Date'),
      fromTown: journeyRow.get('From Town'),
      fromCountry: journeyRow.get('From Country'),
      toTown: journeyRow.get('To Town'),
      toCountry: journeyRow.get('To Country'),
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