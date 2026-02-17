import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let fromLat: number, fromLng: number, toLat: number, toLng: number;

  try {
    ({ fromLat, fromLng, toLat, toLng } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return NextResponse.json(
      { error: 'fromLat, fromLng, toLat, toLng are all required' },
      { status: 400 }
    );
  }

  const origin = [fromLng, fromLat]; // GeoJSON is [lng, lat]
  const destination = [toLng, toLat];

  try {
    // Dynamic require to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const searoute = require('searoute-js');
    const result = searoute(origin, destination, 'nm');

    if (result?.geometry) {
      return NextResponse.json({
        success: true,
        route: result.geometry,
        distanceNm: result.properties?.length || null,
      });
    }

    // searoute returned null — no path found
    return NextResponse.json({
      success: true,
      route: { type: 'LineString', coordinates: [origin, destination] },
      distanceNm: null,
      fallback: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    // Log even with removeConsole (use process.stdout directly)
    process.stdout.write(`calc-route error: ${message}\n${stack || ''}\n`);

    return NextResponse.json({
      success: true,
      route: { type: 'LineString', coordinates: [origin, destination] },
      distanceNm: null,
      fallback: true,
      error: message,
    });
  }
}
