import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import type { UnitPreferences } from '@/types/units';
import { DEFAULT_UNIT_PREFERENCES } from '@/types/units';
import { logger } from '@/lib/logger';

type UserSession = {
  user: {
    id: string;
  };
} | null;

export async function GET() {
  try {
    const session = (await getServerSession(authOptions)) as UserSession;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch unit preferences from user_google_config table
    const { rows } = await db.query(
      `SELECT "speedUnit", "distanceUnit", "mapZoomDistance" FROM user_google_config WHERE "userId" = $1`,
      [userId]
    );

    if (rows.length > 0 && rows[0].speedUnit && rows[0].distanceUnit) {
      const unitPreferences: UnitPreferences = {
        speedUnit: rows[0].speedUnit,
        distanceUnit: rows[0].distanceUnit,
        mapZoomDistance: rows[0].mapZoomDistance || 100,
      };
      
      logger.info('Retrieved unit preferences for user', { userId, unitPreferences });
      return NextResponse.json({ unitPreferences });
    } else {
      // Return default preferences if none are set
      logger.info('No unit preferences found for user, returning defaults', { userId });
      return NextResponse.json({ unitPreferences: DEFAULT_UNIT_PREFERENCES });
    }
  } catch (error) {
    logger.error("Error fetching unit preferences", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as UserSession;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { unitPreferences } = body;

    if (!unitPreferences || !unitPreferences.speedUnit || !unitPreferences.distanceUnit) {
      return NextResponse.json(
        { error: "Invalid unit preferences data" },
        { status: 400 }
      );
    }

    // Validate map zoom distance if provided
    if (unitPreferences.mapZoomDistance !== undefined) {
      if (typeof unitPreferences.mapZoomDistance !== 'number' || 
          unitPreferences.mapZoomDistance < 5 || 
          unitPreferences.mapZoomDistance > 500) {
        return NextResponse.json(
          { error: "Map zoom distance must be between 5 and 500" },
          { status: 400 }
        );
      }
    }

    // Validate unit values
    const validSpeedUnits = ['knots', 'mph', 'kmh'];
    const validDistanceUnits = ['miles', 'nautical_miles', 'kilometers'];

    if (!validSpeedUnits.includes(unitPreferences.speedUnit) ||
        !validDistanceUnits.includes(unitPreferences.distanceUnit)) {
      return NextResponse.json(
        { error: "Invalid unit values" },
        { status: 400 }
      );
    }

    // Update unit preferences in the database
    // First, check if user has a config record
    const { rows: existingRows } = await db.query(
      `SELECT "userId" FROM user_google_config WHERE "userId" = $1`,
      [userId]
    );

    if (existingRows.length > 0) {
      // Update existing record
      await db.query(
        `UPDATE user_google_config 
         SET "speedUnit" = $1, "distanceUnit" = $2, "mapZoomDistance" = $3, "updatedAt" = NOW()
         WHERE "userId" = $4`,
        [unitPreferences.speedUnit, unitPreferences.distanceUnit, unitPreferences.mapZoomDistance || 100, userId]
      );
    } else {
      // Create new record
      await db.query(
        `INSERT INTO user_google_config ("userId", "speedUnit", "distanceUnit", "mapZoomDistance")
         VALUES ($1, $2, $3, $4)`,
        [userId, unitPreferences.speedUnit, unitPreferences.distanceUnit, unitPreferences.mapZoomDistance || 100]
      );
    }

    logger.info('Updated unit preferences for user', { userId, unitPreferences });
    return NextResponse.json({ 
      message: "Unit preferences updated successfully",
      unitPreferences 
    });
  } catch (error) {
    logger.error("Error updating unit preferences", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
} 