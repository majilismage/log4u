import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  
  if (!lat || !lng) {
    return NextResponse.json(
      { success: false, error: 'Latitude and longitude are required' },
      { status: 400 }
    );
  }

  try {
    // Use Nominatim reverse geocoding API
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'WanderNote/1.0 (Travel Log App)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.error) {
      return NextResponse.json({
        success: false,
        error: 'Location not found'
      });
    }

    // Extract city and country from the response
    const address = data.address || {};
    const city = address.city || 
                 address.town || 
                 address.village || 
                 address.municipality || 
                 address.hamlet || 
                 'Unknown';
    
    const country = address.country || 'Unknown';
    const displayName = data.display_name || `${city}, ${country}`;

    return NextResponse.json({
      success: true,
      data: {
        city,
        country,
        displayName,
        coordinates: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        }
      }
    });

  } catch (error) {
    logger.error('Reverse geocoding error', { lat, lng, error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get location information'
    }, { status: 500 });
  }
} 