import { NextResponse } from 'next/server';
import { uploadToGoogleDrive } from '@/lib/googleDrive';

export async function GET() {
  try {
    // Create a simple test buffer (a small text file)
    const testBuffer = Buffer.from('This is a test file for Google Drive integration');
    
    console.log('Test Drive: Starting upload test');
    console.log('Test Drive: Checking environment variables:');
    console.log('GOOGLE_DRIVE_CLIENT_EMAIL exists:', !!process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
    console.log('GOOGLE_DRIVE_PRIVATE_KEY exists:', !!process.env.GOOGLE_DRIVE_PRIVATE_KEY);
    console.log('GOOGLE_DRIVE_BASE_FOLDER_ID exists:', !!process.env.GOOGLE_DRIVE_BASE_FOLDER_ID);
    
    // Try to upload the test file
    const result = await uploadToGoogleDrive({
      file: testBuffer,
      fileName: 'test-upload.txt',
      mimeType: 'text/plain',
      journeyDate: new Date(),
      journeyId: 'test-journey-001',
      location: {
        town: 'Amsterdam',
        country: 'Netherlands'
      }
    });
    
    console.log('Test Drive: Upload result:', result);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Test file uploaded successfully',
      fileUrl: result.webViewLink,
      filePath: result.path
    });
  } catch (error) {
    console.error('Test Drive: Error during test:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Test upload failed',
        details: error
      },
      { status: 500 }
    );
  }
} 