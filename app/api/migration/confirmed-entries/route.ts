import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      return NextResponse.json({ entries: [] });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:U',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ entries: [] });
    }

    // Map sheet rows back to entry format
    // Columns: A-journeyId, B-departureDate, C-arrivalDate, D-fromTown, E-fromCountry,
    //          F-fromLat, G-fromLng, H-toTown, I-toCountry, J-toLat, K-toLng,
    //          L-distance, M-avgSpeed, N-maxSpeed, O-notes
    const entries = rows.map(row => ({
      departureDate: row[1] || '',
      arrivalDate: row[2] || '',
      fromTown: row[3] || '',
      fromCountry: row[4] || '',
      fromLat: parseFloat(row[5]) || 0,
      fromLng: parseFloat(row[6]) || 0,
      toTown: row[7] || '',
      toCountry: row[8] || '',
      toLat: parseFloat(row[9]) || 0,
      toLng: parseFloat(row[10]) || 0,
      distanceNm: row[11] || '',
      avgSpeed: row[12] || '',
      maxSpeed: row[13] || '',
      notes: row[14] || '',
      routePolyline: row[20] || '',
      // Build a duplicate key for matching
      key: `${row[1]}|${row[3]}|${row[7]}`,
    }));

    logger.info('Fetched confirmed entries', { count: entries.length });

    return NextResponse.json({ entries });
  } catch (error: any) {
    logger.error('Failed to fetch confirmed entries', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to fetch confirmed entries' },
      { status: 500 }
    );
  }
}
