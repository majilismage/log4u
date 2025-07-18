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
    console.log('🔄 [DEBUG] POST /api/user/unit-preferences started');
    
    const session = (await getServerSession(authOptions)) as UserSession;
    console.log('🔄 [DEBUG] Session:', { hasSession: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      console.log('❌ [DEBUG] Unauthorized - no session or user ID');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log('🔄 [DEBUG] Processing for userId:', userId);
    
    const body = await req.json();
    console.log('🔄 [DEBUG] Request body received:', body);
    
    const { unitPreferences } = body;
    console.log('🔄 [DEBUG] Extracted unitPreferences:', unitPreferences);

    if (!unitPreferences || !unitPreferences.speedUnit || !unitPreferences.distanceUnit) {
      console.log('❌ [DEBUG] Invalid unit preferences data:', {
        hasUnitPreferences: !!unitPreferences,
        hasSpeedUnit: !!unitPreferences?.speedUnit,
        hasDistanceUnit: !!unitPreferences?.distanceUnit,
        unitPreferences
      });
      return NextResponse.json(
        { error: "Invalid unit preferences data" },
        { status: 400 }
      );
    }

    // Validate map zoom distance if provided
    console.log('🔄 [DEBUG] Validating map zoom distance:', {
      mapZoomDistance: unitPreferences.mapZoomDistance,
      type: typeof unitPreferences.mapZoomDistance,
      isDefined: unitPreferences.mapZoomDistance !== undefined
    });
    
    if (unitPreferences.mapZoomDistance !== undefined) {
      if (typeof unitPreferences.mapZoomDistance !== 'number' || 
          unitPreferences.mapZoomDistance < 5 || 
          unitPreferences.mapZoomDistance > 500) {
        console.log('❌ [DEBUG] Invalid map zoom distance:', {
          value: unitPreferences.mapZoomDistance,
          type: typeof unitPreferences.mapZoomDistance,
          isNumber: typeof unitPreferences.mapZoomDistance === 'number',
          tooSmall: unitPreferences.mapZoomDistance < 5,
          tooLarge: unitPreferences.mapZoomDistance > 500
        });
        return NextResponse.json(
          { error: "Map zoom distance must be between 5 and 500" },
          { status: 400 }
        );
      }
    }

    // Validate unit values
    const validSpeedUnits = ['knots', 'mph', 'kmh'];
    const validDistanceUnits = ['miles', 'nautical_miles', 'kilometers'];
    
    console.log('🔄 [DEBUG] Validating unit values:', {
      speedUnit: unitPreferences.speedUnit,
      distanceUnit: unitPreferences.distanceUnit,
      validSpeedUnits,
      validDistanceUnits,
      speedUnitValid: validSpeedUnits.includes(unitPreferences.speedUnit),
      distanceUnitValid: validDistanceUnits.includes(unitPreferences.distanceUnit)
    });

    if (!validSpeedUnits.includes(unitPreferences.speedUnit) ||
        !validDistanceUnits.includes(unitPreferences.distanceUnit)) {
      console.log('❌ [DEBUG] Invalid unit values detected');
      return NextResponse.json(
        { error: "Invalid unit values" },
        { status: 400 }
      );
    }

    // Update unit preferences in the database
    console.log('🔄 [DEBUG] Starting database operations');
    
    // First, check if user has a config record
    const { rows: existingRows } = await db.query(
      `SELECT "userId" FROM user_google_config WHERE "userId" = $1`,
      [userId]
    );
    
    console.log('🔄 [DEBUG] Existing config check:', {
      existingRowsCount: existingRows.length,
      hasExistingConfig: existingRows.length > 0
    });
    
    const finalMapZoomDistance = unitPreferences.mapZoomDistance || 100;
    console.log('🔄 [DEBUG] Final values for database:', {
      speedUnit: unitPreferences.speedUnit,
      distanceUnit: unitPreferences.distanceUnit,
      mapZoomDistance: finalMapZoomDistance,
      userId
    });

    if (existingRows.length > 0) {
      // Update existing record
      console.log('🔄 [DEBUG] Updating existing config record');
      const updateResult = await db.query(
        `UPDATE user_google_config 
         SET "speedUnit" = $1, "distanceUnit" = $2, "mapZoomDistance" = $3, "updatedAt" = NOW()
         WHERE "userId" = $4`,
        [unitPreferences.speedUnit, unitPreferences.distanceUnit, finalMapZoomDistance, userId]
      );
      console.log('🔄 [DEBUG] Update query result:', { rowCount: updateResult.rowCount });
    } else {
      // Create new record
      console.log('🔄 [DEBUG] Creating new config record');
      const insertResult = await db.query(
        `INSERT INTO user_google_config ("userId", "speedUnit", "distanceUnit", "mapZoomDistance")
         VALUES ($1, $2, $3, $4)`,
        [userId, unitPreferences.speedUnit, unitPreferences.distanceUnit, finalMapZoomDistance]
      );
      console.log('🔄 [DEBUG] Insert query result:', { rowCount: insertResult.rowCount });
    }

    console.log('✅ [DEBUG] Database operations completed successfully');
    logger.info('Updated unit preferences for user', { userId, unitPreferences });
    
    const successResponse = { 
      message: "Unit preferences updated successfully",
      unitPreferences 
    };
    console.log('✅ [DEBUG] Sending success response:', successResponse);
    
    return NextResponse.json(successResponse);
  } catch (error) {
    console.error('❌ [DEBUG] Exception in POST handler:', error);
    console.error('❌ [DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    logger.error("Error updating unit preferences", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
} 