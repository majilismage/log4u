import { NextRequest, NextResponse } from 'next/server';
import { nominatimClient } from '@/lib/nominatim-client';
import { logger } from '@/lib/logger';
import type { GeocodeSearchRequest, GeocodeSearchResponse } from '@/types/location';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = searchParams.get('limit');
    const countrycodes = searchParams.get('countrycodes');
    const debug = searchParams.get('debug') === 'true';

    // Validate required parameters
    if (!query) {
      return NextResponse.json(
        {
          success: false,
          suggestions: [],
          error: 'Query parameter "q" is required'
        } as GeocodeSearchResponse,
        { status: 400 }
      );
    }

    // Validate query length (minimum 3 characters)
    if (query.trim().length < 3) {
      return NextResponse.json(
        {
          success: true,
          suggestions: [],
          error: null
        } as GeocodeSearchResponse,
        { status: 200 }
      );
    }

    // Build search request
    const searchRequest: GeocodeSearchRequest = {
      query: query.trim(),
      limit: limit ? parseInt(limit, 10) : 10,
      countrycodes: countrycodes || undefined
    };

    // Validate limit parameter
    if (searchRequest.limit && (searchRequest.limit < 1 || searchRequest.limit > 50)) {
      return NextResponse.json(
        {
          success: false,
          suggestions: [],
          error: 'Limit must be between 1 and 50'
        } as GeocodeSearchResponse,
        { status: 400 }
      );
    }

    logger.info('Geocode search request', {
      query: searchRequest.query,
      limit: searchRequest.limit,
      countrycodes: searchRequest.countrycodes,
      debug,
      userAgent: request.headers.get('user-agent')
    });

    // Perform the search
    const suggestions = await nominatimClient.search(searchRequest);

    // Log results
    logger.info('Geocode search response', {
      query: searchRequest.query,
      resultCount: suggestions.length,
      success: true
    });

    // Debug mode: return additional information
    if (debug) {
      return NextResponse.json(
        {
          success: true,
          suggestions,
          debug: {
            query: searchRequest.query,
            searchStrategies: 'Enhanced fuzzy search enabled',
            resultCount: suggestions.length,
            cities: suggestions.map(s => s.city)
          },
          error: null
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=60', // Shorter cache for debug
            'Content-Type': 'application/json'
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
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    logger.error('Geocode search API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return graceful error response
    return NextResponse.json(
      {
        success: false,
        suggestions: [],
        error: 'Geocoding service temporarily unavailable. Please enter location manually.'
      } as GeocodeSearchResponse,
      { status: 500 }
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
    logger.error('Geocode health check failed', { error });
    return new NextResponse(null, { status: 503 });
  }
} 