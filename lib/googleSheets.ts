import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Types for our travel log entry
interface LocationData {
  town: string;
  country: string;
  lat: number;
  lng: number;
}

interface TravelLogEntry {
  departureDate: string;
  arrivalDate: string;
  fromTown: string;
  fromCountry: string;
  fromLat: number;
  fromLng: number;
  toTown: string;
  toCountry: string;
  toLat: number;
  toLng: number;
  distance: string;
  avgSpeed: string;
  maxSpeed: string;
  notes: string;
  mediaLinks?: string; // JSON string of media links
}

export async function saveToGoogleSheets(entry: TravelLogEntry) {
  try {
    console.log('GoogleSheets: Starting save operation');
    
    // Create JWT client
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.split('\\n').join('\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    console.log('GoogleSheets: Created JWT client');

    // Initialize the sheet
    console.log('GoogleSheets: Initializing with Sheet ID:', process.env.GOOGLE_SHEETS_SHEET_ID);
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SHEET_ID!, serviceAccountAuth);
    
    // Load the document properties and sheets
    console.log('GoogleSheets: Loading document info');
    await doc.loadInfo();
    console.log('GoogleSheets: Document title:', doc.title);

    // Get the first sheet
    const sheet = doc.sheetsByIndex[0];
    console.log('GoogleSheets: Accessed first sheet:', sheet.title);

    // Prepare the row data
    const newRow = {
      'Departure Date': entry.departureDate,
      'Arrival Date': entry.arrivalDate,
      'From Town': entry.fromTown,
      'From Country': entry.fromCountry,
      'From Latitude': entry.fromLat,
      'From Longitude': entry.fromLng,
      'To Town': entry.toTown,
      'To Country': entry.toCountry,
      'To Latitude': entry.toLat,
      'To Longitude': entry.toLng,
      'Distance': entry.distance,
      'Average Speed': entry.avgSpeed,
      'Max Speed': entry.maxSpeed,
      'Notes': entry.notes,
      'Media Links': entry.mediaLinks || '',
      'Timestamp': new Date().toISOString(),
    };

    console.log('GoogleSheets: Prepared row data:', newRow);

    // Add the row to the sheet
    console.log('GoogleSheets: Attempting to add row');
    await sheet.addRow(newRow);
    console.log('GoogleSheets: Successfully added row');

    return { success: true };
  } catch (error) {
    console.error('GoogleSheets: Error details:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save entry' };
  }
} 