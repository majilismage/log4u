import type { NominatimSearchResult, LocationSuggestion, GeocodeSearchRequest } from '@/types/location';
import { geocodeCache } from './geocode-cache';
import { logger } from './logger';

/**
 * Nominatim API client for OpenStreetMap geocoding
 * Free service with fair use policy - 1 request per second
 */
class NominatimClient {
  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'WanderNote/1.0 (Travel Log App)';
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 1 second between requests

  /**
   * Enforce rate limiting - Nominatim requires max 1 request per second
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
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
  private convertToLocationSuggestion(result: NominatimSearchResult): LocationSuggestion | null {
    const city = this.extractCityName(result.address);
    const country = this.extractCountryName(result.address);
    
    // Skip if we can't extract city or country
    if (!city || !country) {
      return null;
    }

    // Prefer city-level results over address-level results
    if (!this.isCityLevelResult(result)) {
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
   * Enhanced search with fuzzy matching capabilities
   */
  async search(request: GeocodeSearchRequest): Promise<LocationSuggestion[]> {
    const { query, limit = 10, countrycodes } = request;
    
    // Check cache first
    const cached = geocodeCache.get(query, countrycodes);
    if (cached) {
      logger.debug('Geocode cache hit', { query, resultCount: cached.length });
      return cached;
    }

    try {
      // Enforce rate limiting
      await this.enforceRateLimit();

      // Strategy 1: Exact search (current implementation)
      const exactResults = await this.performSearch(query, limit, countrycodes);
      
      // Strategy 2: Strategic fuzzy search for high-value cities only
      let fuzzyResults: LocationSuggestion[] = [];
      if (query.length >= 3) {
        // Always run strategic search for known patterns, regardless of exact result count
        const targetCities = this.getTargetCitiesForQuery(query);
        if (targetCities.length > 0) {
          fuzzyResults = await this.performStrategicFuzzySearch(query, limit, countrycodes);
        }
      }

      // Combine and deduplicate results
      const combinedResults = this.combineAndDeduplicateResults(exactResults, fuzzyResults, limit);

      logger.info('Enhanced geocode search completed', { 
        query, 
        exactCount: exactResults.length,
        fuzzyCount: fuzzyResults.length,
        finalCount: combinedResults.length,
        fromCache: false
      });

      // Cache the results
      geocodeCache.set(query, combinedResults, countrycodes);

      return combinedResults;

    } catch (error) {
      logger.error('Nominatim API error', { 
        query, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      // Return empty array on error (graceful degradation)
      return [];
    }
  }

  /**
   * Perform standard exact search
   */
  private async performSearch(query: string, limit: number, countrycodes?: string): Promise<LocationSuggestion[]> {
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

    // Focus on city-level results
    params.append('featureType', 'city');

    const url = `${this.baseUrl}/search?${params.toString()}`;
    
    logger.debug('Nominatim exact search', { url, query });

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 seconds
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data: NominatimSearchResult[] = await response.json();
    
    logger.debug('Nominatim exact search response', { 
      query, 
      rawResultCount: data.length 
    });

    // Convert and filter results
    return data
      .map(result => this.convertToLocationSuggestion(result))
      .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Strategic fuzzy search focusing on high-value city matches
   */
  private async performStrategicFuzzySearch(query: string, limit: number, countrycodes?: string): Promise<LocationSuggestion[]> {
    const targetCities = this.getTargetCitiesForQuery(query);
    const allResults: LocationSuggestion[] = [];

    // Only search for the most likely high-value targets (max 2-3 to avoid rate limits)
    const priorityCities = targetCities.slice(0, 3);
    
    if (priorityCities.length === 0) {
      return [];
    }

    logger.info('Strategic fuzzy search', {
      originalQuery: query,
      targetCities: priorityCities
    });

    // Search for each target city
    for (const targetCity of priorityCities) {
      if (allResults.length >= limit) break;
      
      try {
        await this.enforceRateLimit();
        const results = await this.performSearch(targetCity, 2, countrycodes);
        
        // Accept all results from high-value city searches
        allResults.push(...results);
        
        logger.info('Strategic search result', {
          originalQuery: query,
          targetCity,
          resultCount: results.length,
          results: results.map(r => ({ city: r.city, country: r.country, importance: r.importance }))
        });
        
      } catch (error) {
        logger.warn('Strategic search failed', {
          originalQuery: query,
          targetCity,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return allResults.slice(0, limit);
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
   * Combine and deduplicate results from multiple search strategies
   * Prioritize by importance score rather than search type
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
   * Get API health status
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime?: number }> {
    try {
      const startTime = Date.now();
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      });

      const responseTime = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        responseTime
      };
    } catch (error) {
      logger.error('Nominatim health check failed', { error });
      return { healthy: false };
    }
  }
}

// Export singleton instance
export const nominatimClient = new NominatimClient(); 