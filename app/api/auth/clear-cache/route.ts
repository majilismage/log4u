import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { authLogger } from "@/lib/auth-logger";
import { geocodeCache } from "@/lib/geocode-cache";

/**
 * API endpoint to clear user-specific caches and perform logout cleanup
 * This should be called during logout to ensure clean session termination
 */
export async function POST(req: NextRequest) {
  try {
    authLogger.info("Logout cache clearing requested", {
      timestamp: Date.now()
    }, 'LOGOUT_CLEANUP');

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    authLogger.info("Processing logout cleanup", {
      hasSession: !!session,
      userId: userId || 'anonymous',
      timestamp: Date.now()
    }, 'LOGOUT_CLEANUP');

    // Clear geocoding cache (shared cache, but good practice on logout)
    try {
      const cacheStats = geocodeCache.getStats();
      geocodeCache.clear();
      authLogger.info("Geocode cache cleared", {
        userId: userId || 'anonymous',
        previousCacheSize: cacheStats.size,
        timestamp: Date.now()
      }, 'LOGOUT_CLEANUP');
    } catch (error) {
      authLogger.warn("Failed to clear geocode cache", error, 'LOGOUT_CLEANUP');
    }

    // Note: Google Drive folder manager cache is per-instance, so it will be 
    // naturally cleared when the server processes end. In a production environment
    // with persistent processes, you might want to add specific cache clearing here.

    authLogger.info("Logout cleanup completed successfully", {
      userId: userId || 'anonymous',
      timestamp: Date.now()
    }, 'LOGOUT_CLEANUP');

    return NextResponse.json({ 
      success: true, 
      message: "Logout cleanup completed",
      timestamp: Date.now()
    });

  } catch (error) {
    authLogger.error("Logout cleanup failed", error, 'LOGOUT_CLEANUP');
    
    return NextResponse.json({ 
      success: false, 
      error: "Cleanup failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 