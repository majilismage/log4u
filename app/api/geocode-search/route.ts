import { NextRequest, NextResponse } from 'next/server';
import { nominatimClient } from '@/lib/nominatim-client';
import { logger } from '@/lib/logger';
import { timeApiCall } from '@/lib/performance-monitor';
import type { GeocodeSearchRequest, GeocodeSearchResponse } from '@/types/location';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  // Fast validation - fail fast for invalid requests
  if (!query || query.trim().length < 3) {
    return NextResponse.json(
      {
        success: true,
        suggestions: [],
        error: null
      } as GeocodeSearchResponse,
      { status: 200 }
    );
  }

  try {
    const limit = searchParams.get('limit');
    const countrycodes = searchParams.get('countrycodes');
    const allowNonCity = searchParams.get('allowNonCity') === 'true';
    const debug = searchParams.get('debug') === 'true';

    // Build search request with minimal overhead
    const searchRequest: GeocodeSearchRequest = {
      query: query.trim(),
      limit: limit ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50) : 10,
      countrycodes: countrycodes || undefined,
      allowNonCity
    };

    // Only log in development or debug mode
    if (process.env.NODE_ENV === 'development' || debug) {
      logger.info('Geocode search request', {
        query: searchRequest.query,
        limit: searchRequest.limit,
        countrycodes: searchRequest.countrycodes
      });
    }

    // Perform the search with performance monitoring
    const suggestions = await timeApiCall(
      'geocode-search',
      () => nominatimClient.search(searchRequest),
      { query: searchRequest.query, limit: searchRequest.limit }
    );

    const totalDuration = performance.now() - startTime;

    // Minimal success logging
    if (process.env.NODE_ENV === 'development' || debug) {
      logger.info('Geocode search response', {
        query: searchRequest.query,
        resultCount: suggestions.length,
        totalDuration: Math.round(totalDuration),
        cached: suggestions.length > 0 && totalDuration < 100 // Assume cached if very fast
      });
    }

    // Debug mode: return additional information including performance data
    if (debug) {
      return NextResponse.json(
        {
          success: true,
          suggestions,
          debug: {
            query: searchRequest.query,
            searchStrategies: 'Optimized search enabled',
            resultCount: suggestions.length,
            cities: suggestions.map(s => s.city),
            performance: {
              totalDuration: Math.round(totalDuration),
              cached: totalDuration < 100
            }
          },
          error: null
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=60',
            'Content-Type': 'application/json',
            'X-Response-Time': Math.round(totalDuration).toString()
          }
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        suggestions,
        error: null
      } as GeocodeSearchResponse,
      { 
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'application/json',
          'X-Response-Time': Math.round(totalDuration).toString()
        }
      }
    );

  } catch (error) {
    const totalDuration = performance.now() - startTime;
    
    // Minimal error logging
    if (process.env.NODE_ENV === 'development') {
      logger.error('Geocode search API error', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Math.round(totalDuration)
      });
    }

    // Return graceful error response
    return NextResponse.json(
      {
        success: false,
        suggestions: [],
        error: 'Geocoding service temporarily unavailable. Please enter location manually.'
      } as GeocodeSearchResponse,
      { 
        status: 500,
        headers: {
          'X-Response-Time': Math.round(totalDuration).toString()
        }
      }
    );
  }
}

// Test endpoint for debugging specific cities
export async function POST(request: NextRequest) {
  try {
    const { testCities } = await request.json();
    
    if (!Array.isArray(testCities)) {
      return NextResponse.json(
        { error: 'testCities must be an array' },
        { status: 400 }
      );
    }

    const testResults = [];

    for (const cityQuery of testCities) {
      if (typeof cityQuery !== 'string') continue;
      
      try {
        const suggestions = await nominatimClient.search({
          query: cityQuery,
          limit: 5
        });

        testResults.push({
          query: cityQuery,
          found: suggestions.length > 0,
          count: suggestions.length,
          cities: suggestions.map(s => ({
            name: s.city,
            country: s.country,
            fullName: s.fullName,
            importance: s.importance
          }))
        });

        // Add delay to respect rate limiting
        await new Promise(resolve => setTimeout(resolve, 1100));
        
      } catch (error) {
        testResults.push({
          query: cityQuery,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      testResults,
      summary: {
        total: testCities.length,
        successful: testResults.filter(r => r.found).length,
        failed: testResults.filter(r => r.error).length
      }
    });

  } catch (error) {
    logger.error('City test API error', { error });
    return NextResponse.json(
      { error: 'Failed to run city tests' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const health = await nominatimClient.healthCheck();
    
    if (health.healthy) {
      return new NextResponse(null, { 
        status: 200,
        headers: {
          'X-Service-Health': 'healthy',
          'X-Response-Time': health.responseTime?.toString() || 'unknown'
        }
      });
    } else {
      return new NextResponse(null, { 
        status: 503,
        headers: {
          'X-Service-Health': 'unhealthy'
        }
      });
    }
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
} 
