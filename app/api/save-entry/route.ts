import { NextResponse } from 'next/server';
import { saveToGoogleSheets } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    console.log('API Route: Received save request');
    const entry = await request.json();
    console.log('API Route: Entry data:', entry);
    
    // Log environment variables (without exposing sensitive data)
    console.log('API Route: Checking environment variables:');
    console.log('GOOGLE_SHEETS_CLIENT_EMAIL exists:', !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL);
    console.log('GOOGLE_SHEETS_PRIVATE_KEY exists:', !!process.env.GOOGLE_SHEETS_PRIVATE_KEY);
    console.log('GOOGLE_SHEETS_SHEET_ID exists:', !!process.env.GOOGLE_SHEETS_SHEET_ID);
    
    const result = await saveToGoogleSheets(entry);
    console.log('API Route: Save result:', result);
    
    if (!result.success) {
      console.error('API Route: Failed to save:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Route: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to save entry' },
      { status: 500 }
    );
  }
} 