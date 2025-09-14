/**
 * Map Tile Provider Configuration
 * Provides CORS-enabled tile servers with automatic fallback
 */

export interface TileProviderConfig {
  urls: string[]
  attribution: string
  maxZoom: number
  name: string
}

// Tile provider configurations
export const TILE_PROVIDERS = {
  stadia: {
    name: 'Stadia Maps',
    urls: [
      'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png',
      'https://tiles-eu.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png',
      'https://tiles-us.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png'
    ],
    attribution: '© Stadia Maps, © OpenStreetMap contributors',
    maxZoom: 20  // Increased max zoom for better detail
  },
  cartoFallback: {
    name: 'Carto',
    urls: [
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
    ],
    attribution: '© CARTO, © OpenStreetMap contributors',
    maxZoom: 19
  }
} as const

// Cache for provider selection
let cachedProvider: TileProviderConfig | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

/**
 * Generate a tile URL for a specific tile coordinate
 * Uses round-robin selection for CDN load balancing
 */
export function getTileUrl(provider: TileProviderConfig, x: number, y: number, z: number): string {
  // Round-robin CDN selection based on tile coordinates
  const cdnIndex = (x + y) % provider.urls.length
  const template = provider.urls[cdnIndex]
  
  return template
    .replace('{x}', x.toString())
    .replace('{y}', y.toString())
    .replace('{z}', z.toString())
}

/**
 * Validate CORS headers for a tile provider
 * Returns true if provider supports CORS
 */
export async function validateCORS(provider: TileProviderConfig, timeout = 5000): Promise<boolean> {
  try {
    // Test with a sample tile URL
    const testUrl = getTileUrl(provider, 0, 0, 0)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
      mode: 'cors',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Check for CORS headers
    const allowOrigin = response.headers.get('access-control-allow-origin')
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    return response.ok && (allowOrigin === '*' || (allowOrigin?.includes(origin) ?? false))
  } catch (error) {
    console.error(`CORS validation failed for ${provider.name}:`, error)
    return false
  }
}

/**
 * Select the best available tile provider
 * Tests providers in order and caches the result
 */
export async function selectTileProvider(options: {
  maxRetries?: number
  timeout?: number
} = {}): Promise<TileProviderConfig> {
  const { maxRetries = 3, timeout = 5000 } = options

  // Check cache
  if (cachedProvider && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedProvider
  }

  const providers = [TILE_PROVIDERS.stadia, TILE_PROVIDERS.cartoFallback]

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const provider of providers) {
      try {
        const isValid = await validateCORS(provider, timeout)
        if (isValid) {
          // Cache the successful provider
          cachedProvider = provider
          cacheTimestamp = Date.now()
          console.log(`Selected tile provider: ${provider.name}`)
          return provider
        }
      } catch (error) {
        console.error(`Tile provider ${provider.name} failed (attempt ${attempt + 1}):`, error)
      }
    }

    // Exponential backoff before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  // Fallback to Stadia even if validation failed
  console.warn('All tile provider validations failed, using default')
  return TILE_PROVIDERS.stadia
}

/**
 * Get MapLibre style configuration for a tile provider
 */
export function getTileProviderStyle(provider: TileProviderConfig) {
  return {
    version: 8,
    sources: {
      'osm-raster': {
        type: 'raster' as const,
        tiles: provider.urls,
        tileSize: 256,
        minzoom: 0,
        maxzoom: provider.maxZoom,
        attribution: provider.attribution,
        scheme: 'xyz'  // Ensure correct tile scheme
      }
    },
    layers: [
      {
        id: 'osm-raster-layer',
        type: 'raster' as const,
        source: 'osm-raster',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': 1,
          'raster-fade-duration': 0  // Disable fade for clearer tiles
        }
      }
    ]
  }
}

/**
 * Get satellite imagery configuration (uses Esri as it's generally CORS-enabled)
 */
export function getSatelliteStyle() {
  return {
    version: 8,
    sources: {
      'satellite': {
        type: 'raster' as const,
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri, Maxar, Earthstar Geographics'
      }
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster' as const,
        source: 'satellite'
      }
    ]
  }
}

/**
 * Get hybrid style (satellite + labels)
 */
export function getHybridStyle() {
  return {
    version: 8,
    sources: {
      'satellite': {
        type: 'raster' as const,
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri, Maxar, Earthstar Geographics'
      },
      'osm-labels': {
        type: 'raster' as const,
        tiles: [
          'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution: '© Stadia Maps, © Stamen Design, © OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster' as const,
        source: 'satellite'
      },
      {
        id: 'labels-layer',
        type: 'raster' as const,
        source: 'osm-labels'
      }
    ]
  }
}
