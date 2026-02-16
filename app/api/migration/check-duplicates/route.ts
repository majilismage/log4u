import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      logger.warn('User has no Google Sheet ID configured.');
      return NextResponse.json({ duplicates: [] });
    }

    const body = await request.json();
    const { entries } = body;

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'entries must be an array' },
        { status: 400 }
      );
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:T', // Read existing data
    });

    const rows = response.data.values;
    const duplicates = new Set<string>();

    if (rows && rows.length > 0) {
      // Build existing entry keys from sheet data
      // Columns: A-journeyId, B-departureDate, C-arrivalDate, D-fromTown, ...
      rows.forEach(row => {
        const departureDate = row[1]; // Col B
        const fromTown = row[3]; // Col D  
        const toTown = row[7]; // Col H

        if (departureDate && fromTown && toTown) {
          const key = `${departureDate}|${fromTown}|${toTown}`;
          duplicates.add(key);
        }
      });
    }

    // Check each entry from the request against existing data
    const duplicateKeys: string[] = [];
    entries.forEach((entry: any) => {
      const { departureDate, fromTown, toTown } = entry;
      if (departureDate && fromTown && toTown) {
        const key = `${departureDate}|${fromTown}|${toTown}`;
        if (duplicates.has(key)) {
          duplicateKeys.push(key);
        }
      }
    });

    logger.info('Checked for duplicates', {
      totalEntries: entries.length,
      duplicatesFound: duplicateKeys.length
    });

    return NextResponse.json({ duplicates: duplicateKeys });

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    logger.error('Failed to check duplicates', { error: errorMessage });
    return NextResponse.json(
      { error: 'Failed to check duplicates', details: errorMessage },
      { status: 500 }
    );
  }
}