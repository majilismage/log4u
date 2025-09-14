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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0)
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '10', 10) || 10))
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
    const excelSerialToIso = (val: any): string | undefined => {
      if (val === undefined || val === null) return undefined
      // If already looks like an ISO date string, return as-is
      const s = String(val)
      // Basic YYYY-MM-DD check
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
      // Try to parse as date string
      const d1 = new Date(s)
      if (!isNaN(d1.getTime())) {
        return d1.toISOString().slice(0, 10)
      }
      // Numeric-like: possible Excel serial date
      if (/^\d+(\.\d+)?$/.test(s)) {
        const num = Number(s)
        // Heuristic: treat values in reasonable Excel serial range
        if (num > 20000 && num < 60000) {
          const ms = Math.round((num - 25569) * 86400 * 1000)
          const d = new Date(ms)
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
        }
      }
      return undefined
    }

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
      // Normalize date fields to ISO (yyyy-MM-dd) for consistent display
      const dep = excelSerialToIso(journeyObject['departureDate'])
      const arr = excelSerialToIso(journeyObject['arrivalDate'])
      if (dep) journeyObject['departureDate'] = dep
      if (arr) journeyObject['arrivalDate'] = arr
      return journeyObject;
    }).sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime()); // Sort by most recent start

    const totalCount = data.length;
    const pageData = data.slice(offset, Math.min(offset + limit, totalCount))

    const sheetJourneyIds = data.map(entry => entry.journeyId).filter(id => id);
    logger.info('HISTORY: Successfully fetched history entries', {
      recordCount: data.length,
      sheetJourneyIds: sheetJourneyIds,
      journeyIdPatterns: sheetJourneyIds.map(id => ({
        id,
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? 'UUID' :
          /^J\d+$/.test(id) ? 'J+timestamp' :
          'other'
      }))
    });

    logger.info(`Successfully fetched ${pageData.length}/${totalCount} history entries for the user.`, { offset, limit });

    return NextResponse.json({
      success: true,
      recordCount: pageData.length,
      totalCount,
      offset,
      limit,
      data: pageData,
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
