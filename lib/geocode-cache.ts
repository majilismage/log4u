import type { CacheEntry, LocationSuggestion } from '@/types/location';

/**
 * Simple in-memory cache for geocoding results
 * Implements LRU-style eviction and TTL-based expiration
 */
class GeocodeCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 60 * 60 * 1000) { // 1 hour default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key from search query
   */
  private getCacheKey(query: string, countrycodes?: string): string {
    const normalizedQuery = query.toLowerCase().trim();
    return countrycodes ? `${normalizedQuery}:${countrycodes}` : normalizedQuery;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() < (entry.timestamp + entry.ttl);
  }

  /**
   * Evict expired entries and enforce max size
   */
  private evictStale(): void {
    const now = Date.now();
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now >= (entry.timestamp + entry.ttl)) {
        this.cache.delete(key);
      }
    }

    // If still over max size, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Get cached results for a query
   */
  get(query: string, countrycodes?: string): LocationSuggestion[] | null {
    const key = this.getCacheKey(query, countrycodes);
    const entry = this.cache.get(key);

    if (!entry || !this.isValid(entry)) {
      if (entry) {
        this.cache.delete(key); // Remove expired entry
      }
      return null;
    }

    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Store results in cache
   */
  set(query: string, data: LocationSuggestion[], countrycodes?: string, ttl?: number): void {
    this.evictStale();

    const key = this.getCacheKey(query, countrycodes);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    this.evictStale();
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// Export singleton instance
export const geocodeCache = new GeocodeCache(); 