import { TILE_PROVIDERS, getTileUrl, validateCORS, selectTileProvider, TileProviderConfig } from '@/lib/mapTileProviders'

// Mock fetch for CORS testing
global.fetch = jest.fn()

describe('Map Tile Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear any cached providers
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  describe('Tile URL Generation', () => {
    it('generates correct Stadia Maps URLs', () => {
      const url = getTileUrl(TILE_PROVIDERS.stadia, 10, 5, 3)
      expect(url).toMatch(/https:\/\/tiles.*\.stadiamaps\.com\/tiles\/osm_bright\/3\/10\/5\.png/)
    })

    it('generates correct Carto fallback URLs', () => {
      const url = getTileUrl(TILE_PROVIDERS.cartoFallback, 10, 5, 3)
      expect(url).toMatch(/https:\/\/[abc]\.basemaps\.cartocdn\.com\/rastertiles\/voyager\/3\/10\/5\.png/)
    })

    it('includes proper attribution for Stadia Maps', () => {
      expect(TILE_PROVIDERS.stadia.attribution).toContain('Stadia Maps')
      expect(TILE_PROVIDERS.stadia.attribution).toContain('OpenStreetMap')
    })

    it('includes proper attribution for Carto', () => {
      expect(TILE_PROVIDERS.cartoFallback.attribution).toContain('CARTO')
      expect(TILE_PROVIDERS.cartoFallback.attribution).toContain('OpenStreetMap')
    })

    it('handles multiple CDN endpoints for load balancing', () => {
      const urls = new Set()
      // Generate multiple URLs to test CDN rotation
      for (let i = 0; i < 10; i++) {
        urls.add(getTileUrl(TILE_PROVIDERS.stadia, i, i, 3))
      }
      // Should use multiple CDN endpoints
      expect(urls.size).toBeGreaterThan(1)
    })

    it('respects max zoom levels', () => {
      expect(TILE_PROVIDERS.stadia.maxZoom).toBe(19)
      expect(TILE_PROVIDERS.cartoFallback.maxZoom).toBe(19)
    })
  })

  describe('CORS Validation', () => {
    it('validates CORS headers from Stadia Maps', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([
          ['access-control-allow-origin', '*'],
          ['access-control-allow-methods', 'GET, OPTIONS']
        ])
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const isValid = await validateCORS(TILE_PROVIDERS.stadia)
      expect(isValid).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('stadiamaps.com'),
        expect.objectContaining({
          method: 'HEAD',
          mode: 'cors'
        })
      )
    })

    it('validates CORS headers from Carto fallback', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([
          ['access-control-allow-origin', '*'],
          ['access-control-allow-methods', 'GET, OPTIONS']
        ])
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const isValid = await validateCORS(TILE_PROVIDERS.cartoFallback)
      expect(isValid).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('cartocdn.com'),
        expect.objectContaining({
          method: 'HEAD',
          mode: 'cors'
        })
      )
    })

    it('handles CORS preflight requests', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([
          ['access-control-allow-origin', '*'],
          ['access-control-allow-headers', 'Content-Type'],
          ['access-control-max-age', '86400']
        ])
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const isValid = await validateCORS(TILE_PROVIDERS.stadia)
      expect(isValid).toBe(true)
    })

    it('returns false for providers without CORS headers', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map() // No CORS headers
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const isValid = await validateCORS(TILE_PROVIDERS.stadia)
      expect(isValid).toBe(false)
    })
  })

  describe('Fallback Logic', () => {
    it('falls back to Carto when Stadia fails', async () => {
      // Mock Stadia failing
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([['access-control-allow-origin', '*']])
        })

      const provider = await selectTileProvider()
      expect(provider).toBe(TILE_PROVIDERS.cartoFallback)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('retries with exponential backoff on failure', async () => {
      jest.useFakeTimers()
      
      // Mock all attempts failing initially
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([['access-control-allow-origin', '*']])
        })

      const providerPromise = selectTileProvider({ maxRetries: 3 })
      
      // Fast-forward through backoff delays
      jest.advanceTimersByTime(1000) // First retry after 1s
      jest.advanceTimersByTime(2000) // Second retry after 2s
      
      const provider = await providerPromise
      expect(provider).toBeTruthy()
      expect(fetch).toHaveBeenCalledTimes(3)
      
      jest.useRealTimers()
    })

    it('caches successful tile provider selection', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['access-control-allow-origin', '*']])
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      // First selection
      const provider1 = await selectTileProvider()
      expect(fetch).toHaveBeenCalledTimes(1)

      // Second selection should use cache
      const provider2 = await selectTileProvider()
      expect(provider1).toBe(provider2)
      expect(fetch).toHaveBeenCalledTimes(1) // No additional fetch
    })

    it('invalidates cache after timeout', async () => {
      jest.useFakeTimers()
      
      const mockResponse = {
        ok: true,
        headers: new Map([['access-control-allow-origin', '*']])
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      // First selection
      await selectTileProvider()
      expect(fetch).toHaveBeenCalledTimes(1)

      // Advance time past cache timeout (1 hour)
      jest.advanceTimersByTime(60 * 60 * 1000 + 1)

      // Should fetch again
      await selectTileProvider()
      expect(fetch).toHaveBeenCalledTimes(2)
      
      jest.useRealTimers()
    })

    it('handles all providers failing gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const provider = await selectTileProvider({ maxRetries: 1 })
      // Should return a default provider even if validation fails
      expect(provider).toBe(TILE_PROVIDERS.stadia)
    })
  })

  describe('Performance', () => {
    it('returns tile URLs quickly without blocking', () => {
      const start = performance.now()
      const url = getTileUrl(TILE_PROVIDERS.stadia, 100, 200, 15)
      const duration = performance.now() - start
      
      expect(url).toBeTruthy()
      expect(duration).toBeLessThan(1) // Should be instant
    })

    it('handles high-volume tile requests efficiently', () => {
      const urls = []
      const start = performance.now()
      
      // Generate 1000 tile URLs
      for (let z = 0; z < 10; z++) {
        for (let x = 0; x < 10; x++) {
          for (let y = 0; y < 10; y++) {
            urls.push(getTileUrl(TILE_PROVIDERS.stadia, x, y, z))
          }
        }
      }
      
      const duration = performance.now() - start
      expect(urls.length).toBe(1000)
      expect(duration).toBeLessThan(50) // Should handle 1000 URLs in < 50ms
    })
  })

  describe('Error Handling', () => {
    it('handles network timeouts gracefully', async () => {
      jest.useFakeTimers()
      
      // Mock a hanging request
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const providerPromise = selectTileProvider({ timeout: 5000 })
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(5001)
      
      const provider = await providerPromise
      expect(provider).toBe(TILE_PROVIDERS.stadia) // Falls back to default
      
      jest.useRealTimers()
    })

    it('logs errors for monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Test error'))
      
      await selectTileProvider({ maxRetries: 1 })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tile provider'),
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })
})