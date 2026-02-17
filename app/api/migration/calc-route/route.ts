import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const searoute = require('searoute-js');

export async function POST(request: Request) {
  try {
    const { fromLat, fromLng, toLat, toLng } = await request.json();

    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return NextResponse.json(
        { error: 'fromLat, fromLng, toLat, toLng are all required' },
        { status: 400 }
      );
    }

    const origin = [fromLng, fromLat]; // GeoJSON is [lng, lat]
    const destination = [toLng, toLat];

    const result = searoute(origin, destination, 'nm');

    if (result && result.geometry) {
      return NextResponse.json({
        success: true,
        route: result.geometry,
        distanceNm: result.properties?.length || null,
      });
    }

    // Fallback to straight line if searoute can't find a path
    return NextResponse.json({
      success: true,
      route: {
        type: 'LineString',
        coordinates: [origin, destination],
      },
      distanceNm: null,
      fallback: true,
    });
  } catch (error: any) {
    console.error('calc-route error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to calculate route', detail: error?.message },
      { status: 500 }
    );
  }
}
