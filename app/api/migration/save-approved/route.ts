import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { encodePolyline } from '@/lib/polyline';

export async function POST(request: Request) {
  try {
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured for this user. Please set it up in your settings.' },
        { status: 400 }
      );
    }

    const entry = await request.json();
    const sheets = google.sheets({ version: 'v4', auth });

    // Validate required fields
    if (!entry.departureDate || !entry.from || !entry.to) {
      return NextResponse.json(
        { error: 'departureDate, from, and to are required' },
        { status: 400 }
      );
    }

    // Extract town from "Town, State/Region" format
    const extractTown = (location: string): string => {
      const lastCommaIndex = location.lastIndexOf(',');
      if (lastCommaIndex === -1) return location.trim();
      return location.substring(0, lastCommaIndex).trim();
    };

    const fromTown = extractTown(entry.from);
    const toTown = extractTown(entry.to);
    const duplicateKey = `${entry.departureDate}|${fromTown}|${toTown}`;

    // Encode route polyline
    const routePolyline = entry.routeCoordinates?.length >= 2
      ? encodePolyline(entry.routeCoordinates)
      : '';

    // Read existing data
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:U',
    });
    const existingRows = existingResponse.data.values || [];

    // Find existing row index (if updating)
    let existingRowIndex = -1;
    for (let i = 0; i < existingRows.length; i++) {
      const row = existingRows[i];
      const rowDate = row[1]; // Col B
      const rowFrom = row[3]; // Col D
      const rowTo = row[7];   // Col H
      if (rowDate && rowFrom && rowTo) {
        const rowKey = `${rowDate}|${rowFrom}|${rowTo}`;
        if (rowKey === duplicateKey) {
          existingRowIndex = i;
          break;
        }
      }
    }

    if (entry.isUpdate && existingRowIndex !== -1) {
      // UPDATE: only touch coords (F/G/J/K) and polyline (U)
      const sheetRow = existingRowIndex + 2; // +1 header, +1 for 1-indexed

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: googleSheetsId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `F${sheetRow}:G${sheetRow}`,
              values: [[entry.fromLat || '', entry.fromLng || '']],
            },
            {
              range: `J${sheetRow}:K${sheetRow}`,
              values: [[entry.toLat || '', entry.toLng || '']],
            },
            {
              range: `U${sheetRow}`,
              values: [[routePolyline]],
            },
          ],
        },
      });

      logger.info('Migration entry updated', { duplicateKey });
      return NextResponse.json({ success: true, updated: true });
    }

    if (existingRowIndex !== -1 && !entry.isUpdate) {
      return NextResponse.json(
        { error: 'Entry already exists with same departure date, from town, and to town' },
        { status: 409 }
      );
    }

    // INSERT new entry
    const entryId = uuidv4();
    const values = [
      [
        entryId,                           // A: journeyId
        entry.departureDate,               // B: departureDate
        entry.arrivalDate || '',           // C: arrivalDate
        fromTown,                          // D: fromTown
        entry.country || '',               // E: fromCountry
        entry.fromLat || '',               // F: fromLat
        entry.fromLng || '',               // G: fromLng
        toTown,                            // H: toTown
        entry.country || '',               // I: toCountry
        entry.toLat || '',                 // J: toLat
        entry.toLng || '',                 // K: toLng
        entry.distanceNm || '',            // L: distance
        entry.avgSpeed || '',              // M: avgSpeed
        entry.maxSpeed || '',              // N: maxSpeed
        entry.notes || '',                 // O: notes
        '',                                // P: imageLinks
        '',                                // Q: videoLinks
        new Date().toISOString(),          // R: timestamp
        'journey',                         // S: entryType
        '',                                // T: title
        routePolyline,                     // U: routePolyline
      ],
    ];

    // Find correct insertion point (date order, oldest first)
    const newDate = entry.departureDate;
    let insertRowIndex = -1;

    for (let i = 0; i < existingRows.length; i++) {
      const rowDate = existingRows[i][1] || '';
      if (rowDate > newDate) {
        insertRowIndex = i;
        break;
      }
    }

    if (insertRowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: googleSheetsId,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    } else {
      const sheetRowIndex = insertRowIndex + 1;

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: googleSheetsId,
        fields: 'sheets.properties.sheetId',
      });
      const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId || 0;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: googleSheetsId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: sheetRowIndex,
                  endIndex: sheetRowIndex + 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: googleSheetsId,
        range: `A${sheetRowIndex + 1}:U${sheetRowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    }

    logger.info('Migration entry saved', { entryId, duplicateKey });
    return NextResponse.json({ success: true, entryId });

  } catch (error: any) {
    logger.error('Failed to save migration entry:', error);
    const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    const status = error.message?.includes('authenticated') ? 401 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
