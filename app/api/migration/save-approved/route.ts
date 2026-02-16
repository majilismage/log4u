import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      return NextResponse.json(
        {
          error: 'Google Sheet ID is not configured for this user. Please set it up in your settings.',
        },
        { status: 400 }
      );
    }

    const entry = await request.json();
    const sheets = google.sheets({ version: 'v4', auth });
    const entryId = uuidv4();

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

    // Check for duplicates before saving
    const duplicateKey = `${entry.departureDate}|${fromTown}|${toTown}`;
    
    // Read existing data to check for duplicates
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:T',
    });

    const existingRows = existingResponse.data.values;
    if (existingRows && existingRows.length > 0) {
      const isDuplicate = existingRows.some(row => {
        const existingDepartureDate = row[1]; // Col B
        const existingFromTown = row[3]; // Col D
        const existingToTown = row[7]; // Col H
        
        if (existingDepartureDate && existingFromTown && existingToTown) {
          const existingKey = `${existingDepartureDate}|${existingFromTown}|${existingToTown}`;
          return existingKey === duplicateKey;
        }
        return false;
      });

      if (isDuplicate) {
        return NextResponse.json(
          { error: 'Entry already exists with same departure date, from town, and to town' },
          { status: 409 }
        );
      }
    }

    // Map migration data format to WanderNote sheet format
    const values = [
      [
        entryId,                           // A: journeyId (UUID)
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

    logger.info('Migration entry saved successfully', {
      entryId,
      duplicateKey
    });

    return NextResponse.json({ success: true, entryId });

  } catch (error: any) {
    logger.error('Failed to save migration entry:', error);
    const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    const status = error.message?.includes('authenticated') ? 401 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}