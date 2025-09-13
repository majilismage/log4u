import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-api-client';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { auth, googleSheetsId } = await getAuthenticatedClient();

    if (!googleSheetsId) {
      logger.info('User has no Google Sheet ID configured. No last location available.');
      return NextResponse.json({ 
        success: true, 
        hasLocation: false,
        message: 'No journey history found'
      });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      // Get destination coordinates and arrival dates (columns H, I, J for toTown, toCountry, toLat, toLng, and column C for arrivalDate)
      range: 'C2:K', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      logger.info('No journey history found in user\'s sheet.');
      return NextResponse.json({ 
        success: true, 
        hasLocation: false,
        message: 'No journey history found'
      });
    }

    // Find the most recent journey with valid destination coordinates
    // Sort by arrival date (column C = index 0 in our range), most recent first
    const validJourneys = rows
      .map((row, index) => ({
        arrivalDate: row[0], // Column C
        toTown: row[5], // Column H
        toCountry: row[6], // Column I  
        toLat: row[7], // Column J
        toLng: row[8], // Column K
        originalIndex: index
      }))
      .filter(journey => 
        journey.arrivalDate && 
        journey.toLat && 
        journey.toLng && 
        !isNaN(parseFloat(journey.toLat)) && 
        !isNaN(parseFloat(journey.toLng))
      )
      .sort((a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime());

    if (validJourneys.length === 0) {
      logger.info('No journeys with valid destination coordinates found.');
      return NextResponse.json({ 
        success: true, 
        hasLocation: false,
        message: 'No journeys with location data found'
      });
    }

    const mostRecentJourney = validJourneys[0];
    const lat = parseFloat(mostRecentJourney.toLat);
    const lng = parseFloat(mostRecentJourney.toLng);

    logger.info('Found last location from most recent journey', {
      arrivalDate: mostRecentJourney.arrivalDate,
      location: `${mostRecentJourney.toTown}, ${mostRecentJourney.toCountry}`,
      coordinates: { lat, lng }
    });

    // Attempt to resolve English city/country using Nominatim
    let cityEn = mostRecentJourney.toTown;
    let countryEn = mostRecentJourney.toCountry;
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'WanderNote/1.0 (Travel Log App)',
          'Accept-Language': 'en'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const address = data?.address || {};
        const city = address.city || address.town || address.village || address.municipality || address.hamlet || '';
        const country = address.country || '';
        cityEn = city || cityEn;
        countryEn = country || countryEn;
      }
    } catch (e) {
      // On failure, fall back to sheet-provided names
    }

    return NextResponse.json({
      success: true,
      hasLocation: true,
      location: {
        lat,
        lng,
        city: cityEn,
        country: countryEn,
        arrivalDate: mostRecentJourney.arrivalDate
      }
    });

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    logger.error('Failed to fetch user\'s last location', { error: errorMessage });
    return NextResponse.json(
      { 
        success: false, 
        hasLocation: false,
        error: 'Failed to fetch last location', 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
