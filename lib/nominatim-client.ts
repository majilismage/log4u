import type { NominatimSearchResult, LocationSuggestion, GeocodeSearchRequest } from '@/types/location';
import { geocodeCache } from './geocode-cache';
import { logger } from './logger';

/**
 * Token bucket rate limiter for Nominatim API
 * Allows burst requests while respecting long-term rate limits
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity = 5, refillRate = 1) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity; // Start with full bucket
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to consume a token, returns delay needed in ms
   */
  consume(): number {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    // Refill tokens based on time passed
    const tokensToAdd = Math.floor(timePassed / 1000 * this.refillRate);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }

    // If we have tokens, consume one
    if (this.tokens > 0) {
      this.tokens--;
      return 0; // No delay needed
    }

    // Calculate how long to wait for next token
    const timeUntilNextToken = Math.ceil(1000 / this.refillRate);
    return timeUntilNextToken;
  }
}

/**
 * Nominatim API client for OpenStreetMap geocoding
 * Free service with fair use policy - 1 request per second with burst allowance
 */
class NominatimClient {
  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'WanderNote/1.0 (Travel Log App)';
  private readonly rateLimiter = new TokenBucket(5, 1); // 5 token burst, 1 token/sec refill

  /**
   * Smart rate limiting with burst allowance
   */
  private async enforceRateLimit(): Promise<void> {
    const delay = this.rateLimiter.consume();
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Extract city name from various Nominatim address fields
   */
  private extractCityName(address?: NominatimSearchResult['address']): string {
    if (!address) return '';
    
    // Try different address fields in order of preference
    return address.city || 
           address.town || 
           address.village || 
           address.municipality || 
           '';
  }

  /**
   * Extract country name from address
   */
  private extractCountryName(address?: NominatimSearchResult['address']): string {
    return address?.country || '';
  }

  /**
   * Determine if result represents a city/town/village (not a street address)
   */
  private isCityLevelResult(result: NominatimSearchResult): boolean {
    const cityTypes = ['city', 'town', 'village', 'municipality', 'borough', 'suburb'];
    
    // Get the class/category value (Nominatim uses both)
    const resultClass = result.class || result.category;
    
    // Check the type field
    if (cityTypes.includes(result.type)) {
      return true;
    }
    
    // For place class, check the type
    if (resultClass === 'place' && cityTypes.includes(result.type)) {
      return true;
    }
    
    // For administrative boundaries, check if they represent cities by looking at address components
    if (resultClass === 'boundary' && result.type === 'administrative' && result.address) {
      // Check if address contains city-level components
      const hasCityComponent = result.address.city || 
                               result.address.town || 
                               result.address.village || 
                               result.address.municipality;
      
      return !!hasCityComponent;
    }
    return false;
  }

  /**
   * Convert Nominatim result to our LocationSuggestion format
   */
  private convertToLocationSuggestion(result: NominatimSearchResult, allowNonCity?: boolean): LocationSuggestion | null {
    let city = this.extractCityName(result.address);
    const country = this.extractCountryName(result.address);
    
    if (allowNonCity) {
      // If not a city, try to derive a label from display_name
      if (!city && result.display_name) {
        city = result.display_name.split(',')[0]?.trim() || '';
      }
    }
    
    // Skip if we can't extract names
    if (!city || !country) {
      return null;
    }

    // Prefer city-level results; if not allowed, return null for non-city
    if (!allowNonCity && !this.isCityLevelResult(result)) {
      return null;
    }

    return {
      id: result.place_id,
      city,
      country,
      fullName: `${city}, ${country}`,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      importance: result.importance || 0
    };
  }

  /**
   * Optimized search with intelligent strategy selection
   */
  async search(request: GeocodeSearchRequest): Promise<LocationSuggestion[]> {
    const { query, limit = 10, countrycodes, allowNonCity } = request;
    
    // Check cache first - most performance critical path
    const cached = geocodeCache.get(query, countrycodes);
    if (cached) {
      return cached;
    }

    try {
      // Smart strategy selection to minimize API calls and processing time
      const cleanQuery = query.trim().toLowerCase();
      const targetCities = this.getTargetCitiesForQuery(cleanQuery);
      
      let results: LocationSuggestion[];
      
      // If we have high-confidence fuzzy matches, try fuzzy first (often better results)
      if (targetCities.length > 0 && this.shouldPrioritizeFuzzySearch(cleanQuery)) {
        const fuzzyResults = await this.performOptimizedFuzzySearch(query, limit, countrycodes, targetCities);
        
        // If fuzzy search yielded good results, skip exact search to save time
        if (fuzzyResults.length >= Math.min(3, limit)) {
          geocodeCache.set(query, fuzzyResults, countrycodes);
          return fuzzyResults;
        }
        
        // If fuzzy didn't yield enough, combine with exact search
        const exactResults = await this.performSearch(query, limit, countrycodes, allowNonCity);
        results = this.combineAndDeduplicateResults(exactResults, fuzzyResults, limit);
      } else {
        // Perform exact search
        const exactResults = await this.performSearch(query, limit, countrycodes, allowNonCity);
        
        // Only do additional fuzzy search if exact search was insufficient
        if (exactResults.length < Math.min(3, limit) && targetCities.length > 0) {
          const fuzzyResults = await this.performOptimizedFuzzySearch(query, limit - exactResults.length, countrycodes, targetCities);
          results = this.combineAndDeduplicateResults(exactResults, fuzzyResults, limit);
        } else {
          results = exactResults;
        }
      }

      // Cache the results
      geocodeCache.set(query, results, countrycodes);
      return results;

    } catch (error) {
      // Minimal error logging for performance
      if (process.env.NODE_ENV === 'development') {
        logger.error('Nominatim API error', { query, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      
      // Return empty array on error (graceful degradation)
      return [];
    }
  }

  /**
   * Determine if fuzzy search should be prioritized based on query patterns
   */
  private shouldPrioritizeFuzzySearch(cleanQuery: string): boolean {
    // Prioritize fuzzy for short, high-value abbreviations
    const highValuePatterns = ['johan', 'joburg', 'cape', 'sao', 'são', 'rio', 'las', 'los', 'san', 'nyc', 'sf', 'la'];
    return highValuePatterns.includes(cleanQuery);
  }

  /**
   * Optimized fuzzy search with minimal API calls
   */
  private async performOptimizedFuzzySearch(
    originalQuery: string, 
    limit: number, 
    countrycodes?: string, 
    targetCities?: string[]
  ): Promise<LocationSuggestion[]> {
    const cities = targetCities || this.getTargetCitiesForQuery(originalQuery.trim().toLowerCase());
    const allResults: LocationSuggestion[] = [];

    // Limit to top 2 targets to minimize API calls
    const priorityCities = cities.slice(0, 2);
    
    if (priorityCities.length === 0) {
      return [];
    }

    // Search for each target city
    for (const targetCity of priorityCities) {
      if (allResults.length >= limit) break;
      
      try {
        const results = await this.performSearch(targetCity, 2, countrycodes);
        allResults.push(...results);
        
        // Early exit if we have enough good results
        if (allResults.length >= limit) break;
        
      } catch (error) {
        // Silent fail for fuzzy search to maintain performance
        continue;
      }
    }

    return allResults.slice(0, limit);
  }

  /**
   * Optimized exact search with minimal logging
   */
  private async performSearch(query: string, limit: number, countrycodes?: string, allowNonCity?: boolean): Promise<LocationSuggestion[]> {
    // Build query parameters
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: limit.toString(),
      dedupe: '1', // Remove duplicate results
      'accept-language': 'en', // Prefer English results
    });

    // Add country filtering if specified
    if (countrycodes) {
      params.append('countrycodes', countrycodes);
    }

    // Focus on city-level results unless non-city is allowed
    if (!allowNonCity) {
      params.append('featureType', 'city');
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;
    
    // Enforce rate limiting
    await this.enforceRateLimit();

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000) // Reduced timeout for better performance
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data: NominatimSearchResult[] = await response.json();

    // Streamlined conversion and filtering
    return data
      .map(result => this.convertToLocationSuggestion(result, allowNonCity))
      .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get target cities for strategic search based on query
   */
  private getTargetCitiesForQuery(query: string): string[] {
    const cleanQuery = query.trim().toLowerCase();
    
    // High-value city mappings with strategic priorities
    const cityMappings: Record<string, string[]> = {
      // Major problematic cases - prioritize most important cities
      'johan': ['johannesburg'],
      'joburg': ['johannesburg'],
      'cape': ['cape town'],
      'sao': ['sao paulo', 'são paulo'],
      'são': ['são paulo', 'sao paulo'],
      'rio': ['rio de janeiro'],
      'las': ['las vegas'],
      'los': ['los angeles'],
      'san': ['san francisco', 'san diego'],
      'new': ['new york', 'new delhi'],
      'saint': ['saint petersburg'],
      'st': ['saint petersburg'],
      
      // Major city abbreviations
      'nyc': ['new york'],
      'sf': ['san francisco'],
      'la': ['los angeles'],
      'spb': ['saint petersburg'],
      'bombay': ['mumbai'],
      'philly': ['philadelphia'],
      
      // Tokyo special case
      'tokyo': ['tokyo'],
      'tokio': ['tokyo'],
    };

    return cityMappings[cleanQuery] || [];
  }

  /**
   * Optimized combine and deduplicate results
   */
  private combineAndDeduplicateResults(
    exactResults: LocationSuggestion[], 
    fuzzyResults: LocationSuggestion[], 
    limit: number
  ): LocationSuggestion[] {
    const seen = new Set<string>();
    const allResults: LocationSuggestion[] = [];

    // Mark fuzzy results with slightly lower importance to prefer exact matches when scores are close
    const adjustedFuzzyResults = fuzzyResults.map(result => ({
      ...result,
      importance: result.importance * 0.95 // Small penalty for fuzzy matches
    }));

    // Combine all results and sort by importance first
    const combinedUnsorted = [...exactResults, ...adjustedFuzzyResults];
    combinedUnsorted.sort((a, b) => b.importance - a.importance);

    // Deduplicate while maintaining importance order
    for (const result of combinedUnsorted) {
      if (allResults.length >= limit) break;
      
      const key = `${result.lat.toFixed(4)}-${result.lng.toFixed(4)}-${result.city.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(result);
      }
    }

    return allResults;
  }

  /**
   * Lightweight health check
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime?: number }> {
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(3000) // Faster timeout for health check
      });

      const responseTime = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        responseTime
      };
    } catch (error) {
      return { healthy: false };
    }
  }
}

// Export singleton instance
export const nominatimClient = new NominatimClient(); 
