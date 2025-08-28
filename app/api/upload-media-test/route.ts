import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/google-api-client';

export async function POST(request: Request) {
  try {
    console.log('TEST-UPLOAD: Starting test upload');
    
    // Get auth
    const { auth, userId, googleDriveFolderId } = await getAuthenticatedClient();
    console.log('TEST-UPLOAD: Auth obtained', { userId, hasFolderId: !!googleDriveFolderId });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log('TEST-UPLOAD: File info', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Convert to base64 instead of stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    console.log('TEST-UPLOAD: Converted to base64, length:', base64.length);
    
    // Try creating file with base64 data
    try {
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          mimeType: file.type
        },
        media: {
          mimeType: file.type,
          body: buffer.toString('base64')
        },
        fields: 'id'
      });
      
      console.log('TEST-UPLOAD: Upload successful', response.data);
      
      return NextResponse.json({
        success: true,
        fileId: response.data.id
      });
    } catch (uploadError: any) {
      console.error('TEST-UPLOAD: Upload failed', {
        message: uploadError.message,
        code: uploadError.code,
        status: uploadError.response?.status,
        data: uploadError.response?.data
      });
      throw uploadError;
    }
  } catch (error: any) {
    console.error('TEST-UPLOAD: Error', error);
    return NextResponse.json({ 
      error: error.message || 'Upload failed',
      details: error.response?.data
    }, { status: 500 });
  }
}