// Location-related type definitions for autocomplete functionality

export interface LocationSuggestion {
  id: string;          // Unique identifier from Nominatim
  city: string;        // City name
  country: string;     // Country name
  fullName: string;    // Display name like "Paris, France"
  lat: number;         // Latitude coordinates
  lng: number;         // Longitude coordinates
  importance: number;  // Relevance score for sorting (0-1)
}

export interface NominatimSearchResult {
  place_id: string;
  osm_type: string;
  osm_id: string;
  lat: string;
  lon: string;
  display_name: string;
  class?: string;        // Sometimes called 'class'
  category?: string;     // Sometimes called 'category' 
  type: string;
  importance: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

export interface GeocodeSearchRequest {
  query: string;
  limit?: number;
  countrycodes?: string; // ISO 3166-1 alpha2 codes, comma-separated
  allowNonCity?: boolean;
}

export interface GeocodeSearchResponse {
  success: boolean;
  suggestions: LocationSuggestion[];
  error?: string | null;
  debug?: {
    query: string;
    searchStrategies: string;
    resultCount: number;
    cities: string[];
  };
}

export interface CacheEntry {
  data: LocationSuggestion[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
} 
