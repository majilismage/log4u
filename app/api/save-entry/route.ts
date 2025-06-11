import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { getAuthenticatedClient } = await import('@/lib/google-api-client');
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      return NextResponse.json(
        {
          error:
            'Google Sheet ID is not configured for this user. Please set it up in your settings.',
        },
        { status: 400 } // Bad Request
      );
    }
    const entry = await request.json();
    const sheets = google.sheets({ version: 'v4', auth });
    const journeyId = uuidv4();

    logger.info('SAVE-ENTRY: Generated journey ID', { 
      journeyId,
      journeyIdType: typeof journeyId,
      journeyIdLength: journeyId.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journeyId),
      timestamp: Date.now()
    });

    const values = [
      [
        journeyId,
        entry.departureDate,
        entry.arrivalDate,
        entry.fromTown,
        entry.fromCountry,
        entry.fromLat,
        entry.fromLng,
        entry.toTown,
        entry.toCountry,
        entry.toLat,
        entry.toLng,
        entry.distance,
        entry.avgSpeed,
        entry.maxSpeed,
        entry.notes,
        entry.imageLinks, // Assuming imageLinks is already a stringified array or a single link
        entry.videoLinks, // Assuming videoLinks is the same
        new Date().toISOString(),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: googleSheetsId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });

    logger.info('SAVE-ENTRY: Sheet updated successfully, returning journey ID', { 
      journeyId,
      returnedJourneyId: journeyId
    });

    return NextResponse.json({ success: true, journeyId: journeyId });
  } catch (error: any) {
    logger.error('SAVE-ENTRY: Unexpected error:', error);
    // Provide a more specific error message if available
    const errorMessage =
      error.message || 'An unexpected error occurred. Please try again.';
    const status = error.message.includes('authenticated') ? 401 : 500;
    
    return NextResponse.json({ error: errorMessage }, { status });
  }
} 