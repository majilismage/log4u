import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import type { EntryType } from '@/types/journey';

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
    const entryId = uuidv4();

    // Determine entry type (default to 'journey' for backward compatibility)
    const entryType: EntryType = entry.entryType || 'journey';

    logger.info('SAVE-ENTRY: Generated entry ID', {
      entryId,
      entryType,
      entryIdType: typeof entryId,
      entryIdLength: entryId.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId),
      timestamp: Date.now()
    });

    // Validate required fields based on entry type
    if (entryType === 'event') {
      if (!entry.date) {
        return NextResponse.json(
          { error: 'Date is required for events' },
          { status: 400 }
        );
      }
      if (!entry.title) {
        return NextResponse.json(
          { error: 'Title is required for events' },
          { status: 400 }
        );
      }
    } else {
      // Journey validation
      if (!entry.departureDate || !entry.arrivalDate) {
        return NextResponse.json(
          { error: 'Departure and arrival dates are required for journeys' },
          { status: 400 }
        );
      }
    }

    // Build row values based on entry type
    // Columns: A-R (existing) + S (entryType) + T (title)
    let values: (string | number | undefined)[][];

    if (entryType === 'event') {
      // Event: use date in departureDate column, location fields optional
      values = [
        [
          entryId,
          entry.date,              // B: date (using departureDate column)
          '',                      // C: arrivalDate (empty for events)
          entry.town || '',        // D: fromTown (single location for events)
          entry.country || '',     // E: fromCountry
          entry.lat || '',         // F: fromLat
          entry.lng || '',         // G: fromLng
          '',                      // H: toTown (empty for events)
          '',                      // I: toCountry
          '',                      // J: toLat
          '',                      // K: toLng
          '',                      // L: distance (empty for events)
          '',                      // M: avgSpeed
          '',                      // N: maxSpeed
          entry.notes || '',       // O: notes
          entry.imageLinks || '',  // P: imageLinks
          entry.videoLinks || '',  // Q: videoLinks
          new Date().toISOString(), // R: timestamp
          entryType,               // S: entryType
          entry.title,             // T: title
        ],
      ];
    } else {
      // Journey: existing structure plus entryType column
      values = [
        [
          entryId,
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
          entry.imageLinks,
          entry.videoLinks,
          new Date().toISOString(),
          entryType,               // S: entryType
          '',                      // T: title (empty for journeys)
        ],
      ];
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: googleSheetsId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });

    logger.info('SAVE-ENTRY: Sheet updated successfully, returning entry ID', {
      entryId,
      entryType,
      returnedEntryId: entryId
    });

    // Return entryId (also as journeyId for backward compatibility)
    return NextResponse.json({ success: true, journeyId: entryId, entryId: entryId });
  } catch (error: any) {
    logger.error('SAVE-ENTRY: Unexpected error:', error);
    // Provide a more specific error message if available
    const errorMessage =
      error.message || 'An unexpected error occurred. Please try again.';
    const status = error.message?.includes('authenticated') ? 401 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
} 