import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

import type { EntryType } from '@/types/journey';

// Based on the previous implementation and expected frontend structure
// Columns A-R (existing) + S (entryType) + T (title)
const columnHeaders = [
  'journeyId', 'departureDate', 'arrivalDate', 'fromTown', 'fromCountry', 'fromLat', 'fromLng',
  'toTown', 'toCountry', 'toLat', 'toLng', 'distance', 'averageSpeed', 'maxSpeed',
  'notes', 'imagesLink', 'videosLink', 'timestamp', 'entryType', 'title'
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0)
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '10', 10) || 10))
    // Filter by entry type: 'all', 'journey', or 'event'
    const typeFilter = (url.searchParams.get('type') || 'all') as 'all' | EntryType
    // Sort parameters
    const sortField = (url.searchParams.get('sortField') || 'journeyDate') as 'journeyDate' | 'dateAdded'
    const sortDirection = (url.searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      logger.warn('User has no Google Sheet ID configured. Returning empty history.');
      return NextResponse.json({ success: true, recordCount: 0, data: [] });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      // Assuming data is in the first sheet and starts at A2 to skip headers
      // Columns A-T (extended for entryType and title)
      range: 'A2:T', 
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
      const entryObject: { [key: string]: any } = {};
      columnHeaders.forEach((header, index) => {
        // Handle numeric conversions
        if (['fromLat', 'fromLng', 'toLat', 'toLng', 'distance', 'averageSpeed', 'maxSpeed', 'latitude', 'longitude'].includes(header)) {
            entryObject[header] = row[index] ? parseFloat(row[index]) : undefined;
        } else {
            entryObject[header] = row[index] || undefined;
        }
      });
      // Normalize date fields to ISO (yyyy-MM-dd) for consistent display
      const dep = excelSerialToIso(entryObject['departureDate'])
      const arr = excelSerialToIso(entryObject['arrivalDate'])
      if (dep) entryObject['departureDate'] = dep
      if (arr) entryObject['arrivalDate'] = arr

      // Default entryType to 'journey' for backward compatibility with existing data
      if (!entryObject['entryType']) {
        entryObject['entryType'] = 'journey';
      }

      // For events, copy departureDate to 'date' field for convenience
      if (entryObject['entryType'] === 'event') {
        entryObject['date'] = entryObject['departureDate'];
        // Map location fields for events (fromTown/fromCountry -> town/country)
        entryObject['town'] = entryObject['fromTown'];
        entryObject['country'] = entryObject['fromCountry'];
        entryObject['latitude'] = entryObject['fromLat'];
        entryObject['longitude'] = entryObject['fromLng'];
      }

      return entryObject;
    });

    // Helper to get sort value based on field
    const getSortValue = (entry: any, field: string): number => {
      if (field === 'journeyDate') {
        // For journeys use departureDate, for events use date
        const date = entry.departureDate || entry.date;
        return date ? new Date(date).getTime() : 0;
      }
      // dateAdded - uses timestamp field
      return entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
    };

    // Sort based on field and direction
    const sortedData = data.sort((a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // Apply type filter
    const filteredData = typeFilter === 'all'
      ? sortedData
      : sortedData.filter(entry => entry.entryType === typeFilter);

    const totalCount = filteredData.length;
    const pageData = filteredData.slice(offset, Math.min(offset + limit, totalCount))

    const entryIds = filteredData.map(entry => entry.journeyId).filter(id => id);
    logger.info('HISTORY: Successfully fetched history entries', {
      totalRecords: sortedData.length,
      filteredRecords: filteredData.length,
      typeFilter,
      sortField,
      sortDirection,
      entryIds: entryIds.slice(0, 10), // Log first 10 IDs only
    });

    logger.info(`Successfully fetched ${pageData.length}/${totalCount} history entries for the user.`, { offset, limit, typeFilter, sortField, sortDirection });

    return NextResponse.json({
      success: true,
      recordCount: pageData.length,
      totalCount,
      offset,
      limit,
      typeFilter,
      sortField,
      sortDirection,
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
