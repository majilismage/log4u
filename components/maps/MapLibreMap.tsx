'use client';

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import { Button } from '@/components/ui/button';
import { useUnits } from '@/lib/UnitsContext';
import { distanceToZoomLevel } from '@/lib/unit-conversions';
import { 
  TILE_PROVIDERS, 
  selectTileProvider, 
  getTileProviderStyle,
  getSatelliteStyle,
  getHybridStyle 
} from '@/lib/mapTileProviders';
import 'maplibre-gl/dist/maplibre-gl.css';

interface LocationInfo {
  city: string;
  country: string;
  displayName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface LastLocation {
  lat: number;
  lng: number;
  city: string;
  country: string;
  arrivalDate: string;
}

export interface JourneyState {
  step: 'from' | 'to' | 'complete';
  fromLocation: LocationInfo | null;
  toLocation: LocationInfo | null;
  markers: {
    from: boolean;
    to: boolean;
    crosshair: boolean;
  };
  lines: {
    dynamic: GeoJSON.Feature<GeoJSON.LineString> | null;
    static: GeoJSON.Feature<GeoJSON.LineString> | null;
  };
}

interface MapLibreMapProps {
  onLocationSelect?: (location: LocationInfo) => void;
  mode?: 'single' | 'journey';
  onJourneySelect?: (from: LocationInfo, to: LocationInfo) => void;
  onJourneyStateChange?: (state: JourneyState) => void;
  initialCenter?: { lat: number; lng: number; zoom?: number };
  disableLastLocation?: boolean;
  forceTileProvider?: 'stadia' | 'carto';
}

const MapLibreMap = ({ onLocationSelect, mode = 'single', onJourneySelect, onJourneyStateChange, initialCenter, disableLastLocation, forceTileProvider }: MapLibreMapProps) => {
  const mapRef = useRef<MapRef>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [isLoadingLastLocation, setIsLoadingLastLocation] = useState(true);
  const [currentMousePos, setCurrentMousePos] = useState<[number, number] | null>(null);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'hybrid'>('street');
  const [currentTileProvider, setCurrentTileProvider] = useState(
    forceTileProvider === 'carto' ? TILE_PROVIDERS.cartoFallback : TILE_PROVIDERS.stadia
  );
  const [viewState, setViewState] = useState({
    longitude: initialCenter?.lng ?? 0,
    latitude: initialCenter?.lat ?? 20,
    zoom: initialCenter?.zoom ?? 2
  });
  
  // Performance monitoring state
  const [loadMetrics, setLoadMetrics] = useState({
    mapLoadStart: 0,
    mapLoadEnd: 0,
    tilesLoaded: 0,
    lastLocationLoadTime: 0
  });
  
  // Get user's unit preferences for map zoom distance
  const { unitPreferences } = useUnits();
  
  // Journey mode state
  const [journeyState, setJourneyState] = useState<JourneyState>({
    step: 'from',
    fromLocation: null,
    toLocation: null,
    markers: { from: false, to: false, crosshair: false },
    lines: { dynamic: null, static: null }
  });

  // Initialize tile provider on component mount
  useEffect(() => {
    const initializeTileProvider = async () => {
      try {
        if (forceTileProvider === 'carto') {
          setCurrentTileProvider(TILE_PROVIDERS.cartoFallback);
          console.log('Initialized with forced tile provider: Carto');
          return;
        }
        const provider = await selectTileProvider();
        setCurrentTileProvider(provider);
        console.log('Initialized with tile provider:', provider.name);
      } catch (error) {
        console.error('Failed to select tile provider:', error);
      }
    };
    initializeTileProvider();
  }, [forceTileProvider]);

  // Memoized map style configurations based on current tile provider
  const mapStyleConfigs = useMemo(() => ({
    street: getTileProviderStyle(currentTileProvider),
    satellite: getSatelliteStyle(),
    hybrid: getHybridStyle()
  }), [currentTileProvider]);

  // Custom tile preloading function
  const preloadTilesForLocation = useCallback((lng: number, lat: number, zoom: number) => {
    if (!mapRef.current) return;
    
    console.log('🚀 Preloading tiles for location:', { lng, lat, zoom });
    
    // Calculate tile bounds for the target location
    const paddingZooms = [zoom - 1, zoom, zoom + 1].filter(z => z >= 0 && z <= 19);
    const radius = 0.01; // Preload area radius in degrees
    
    paddingZooms.forEach(z => {
      // Create invisible source to trigger tile requests
      const sourceId = `preload-${z}-${Date.now()}`;
      
      try {
        const source = mapStyleConfigs[mapStyle].sources[
          mapStyle === 'satellite' ? 'satellite' : 'osm-raster'
        ];
        if (source && 'tiles' in source) {
          mapRef.current?.addSource(sourceId, {
            type: 'raster',
            tiles: source.tiles,
            tileSize: 256,
            bounds: [lng - radius, lat - radius, lng + radius, lat + radius]
          });
        }
        
        // Remove preload source after brief moment
        setTimeout(() => {
          try {
            if (mapRef.current?.getSource(sourceId)) {
              mapRef.current.removeSource(sourceId);
            }
          } catch (e) {
            // Source might already be removed
          }
        }, 2000);
      } catch (e) {
        // Source creation might fail, continue silently
      }
    });
  }, [mapStyle, mapStyleConfigs]);

  // Fetch user's last location for map centering (with preloading)
  useEffect(() => {
    const fetchLastLocation = async () => {
      const startTime = performance.now();
      setLoadMetrics(prev => ({ ...prev, mapLoadStart: startTime }));
      
      try {
        // console.log('🗺️ Fetching last location from API...');
        const response = await fetch('/api/user/last-location');
        const result = await response.json();
        
        const loadTime = performance.now() - startTime;
        setLoadMetrics(prev => ({ ...prev, lastLocationLoadTime: loadTime }));
        
        // console.log('🗺️ Last location API response:', result, `(${loadTime.toFixed(2)}ms)`);
        
        if (result.success && result.hasLocation) {
          console.log('🗺️ Setting last location:', result.location);
          setLastLocation(result.location);
          
          // Preload tiles for the destination
          const zoomDistanceKm = unitPreferences.mapZoomDistance || 100;
          const targetZoom = distanceToZoomLevel(zoomDistanceKm);
          preloadTilesForLocation(result.location.lng, result.location.lat, targetZoom);
        } else {
          console.log('🗺️ No last location available:', result.message);
        }
      } catch (error) {
        console.error('Error fetching last location:', error);
      } finally {
        setIsLoadingLastLocation(false);
      }
    };

    if (!disableLastLocation && !initialCenter) {
      fetchLastLocation();
    }
  }, [unitPreferences.mapZoomDistance, preloadTilesForLocation, disableLastLocation, initialCenter]);

  // Update map view when lastLocation becomes available (with smooth transition)
  useEffect(() => {
    console.log('🗺️ lastLocation state changed:', {
      lastLocation,
      isLoadingLastLocation,
      hasLocation: !!lastLocation
    });
    
    if (lastLocation && !isLoadingLastLocation && mapRef.current) {
      const zoomDistanceKm = unitPreferences.mapZoomDistance || 100;
      const zoom = distanceToZoomLevel(zoomDistanceKm);
      const newViewState = {
        longitude: lastLocation.lng,
        latitude: lastLocation.lat,
        zoom: zoom
      };
      
      console.log('🗺️ Flying to last location with smooth transition:', {
        ...newViewState,
        zoomDistanceKm,
        lastLocationDetails: lastLocation
      });
      
      // Use flyTo for smooth transition instead of immediate jump
      mapRef.current.flyTo({
        center: [lastLocation.lng, lastLocation.lat],
        zoom: zoom,
        duration: 1500, // 1.5 second animation
        essential: true // This animation is considered essential for accessibility
      });
    }
  }, [lastLocation, isLoadingLastLocation, unitPreferences.mapZoomDistance]);

  // If initialCenter becomes available after mount, move the map there
  useEffect(() => {
    if (initialCenter && mapRef.current) {
      const zoom = typeof initialCenter.zoom === 'number' ? initialCenter.zoom : 12;
      mapRef.current.flyTo({
        center: [initialCenter.lng, initialCenter.lat],
        zoom,
        duration: 0,
        essential: true
      });
    }
  }, [initialCenter]);

  // Update parent with journey state changes
  useEffect(() => {
    if (onJourneyStateChange) {
      onJourneyStateChange(journeyState);
    }
  }, [journeyState, onJourneyStateChange]);


  // Create dynamic line GeoJSON
  const createDynamicLineGeoJSON = useCallback((from: LocationInfo, to: [number, number]): GeoJSON.Feature<GeoJSON.LineString> => {
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [from.coordinates.lng, from.coordinates.lat],
          [to[0], to[1]]
        ]
      }
    };
  }, []);

  // Throttled mouse move handler with requestAnimationFrame for 60fps performance
  const throttledMouseMove = useMemo(() => {
    let rafId: number | null = null;
    
    return (event: any) => {
      if (mode === 'journey' && journeyState.step === 'to' && journeyState.fromLocation) {
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            const { lng, lat } = event.lngLat;
            setCurrentMousePos([lng, lat]);
            
            const dynamicLine = createDynamicLineGeoJSON(journeyState.fromLocation, [lng, lat]);
            setJourneyState(prev => ({
              ...prev,
              lines: { ...prev.lines, dynamic: dynamicLine }
            }));
            
            rafId = null;
          });
        }
      }
    };
  }, [mode, journeyState.step, journeyState.fromLocation, createDynamicLineGeoJSON]);

  // Map event handlers for performance monitoring
  const handleMapLoad = useCallback(() => {
    const loadEnd = performance.now();
    setLoadMetrics(prev => ({
      ...prev,
      mapLoadEnd: loadEnd
    }));
    
    console.log('🗺️ Map loaded:', {
      totalLoadTime: `${(loadEnd - loadMetrics.mapLoadStart).toFixed(2)}ms`,
      lastLocationTime: `${loadMetrics.lastLocationLoadTime.toFixed(2)}ms`,
      tileProvider: currentTileProvider.name
    });
    
    // Ensure map renders properly and tiles are loaded
    if (mapRef.current) {
      const map = mapRef.current;
      
      // Force a resize and repaint to ensure proper rendering
      setTimeout(() => {
        map.resize();
        map.triggerRepaint();
      }, 100);
      
      // Set up tile load monitoring
      map.on('sourcedata', (e) => {
        if (e.sourceDataType === 'metadata') {
          setLoadMetrics(prev => ({
            ...prev,
            tilesLoaded: prev.tilesLoaded + 1
          }));
        }
      });
    }
  }, [loadMetrics.mapLoadStart, loadMetrics.lastLocationLoadTime, currentTileProvider]);

  const handleMapError = useCallback(async (error: any) => {
    // Extract error details properly
    const errorDetails = error?.error || error?.target?.error || error;
    const errorMessage = errorDetails?.message || errorDetails?.statusText || 'Unknown error';
    const errorSource = error?.source || error?.target?.src || '';
    
    // Only log meaningful errors (not empty objects)
    if (errorMessage !== 'Unknown error' || errorSource) {
      console.error('🗺️ Map error:', {
        message: errorMessage,
        source: errorSource,
        type: error?.type || 'unknown'
      });
    }
    
    // If tile loading fails, try switching to fallback provider
    if (errorMessage.includes('tile') || 
        errorMessage.includes('404') ||
        errorMessage.includes('Failed to fetch') ||
        errorSource.includes('.png') ||
        error?.source === 'osm-raster') {
      console.warn('Tile loading error detected, attempting fallback...');
      
      // Switch to Carto if we're on Stadia, otherwise keep trying
      if (currentTileProvider.name === 'Stadia Maps') {
        setCurrentTileProvider(TILE_PROVIDERS.cartoFallback);
        console.log('Switched to fallback tile provider: Carto');
      }
    }
  }, [currentTileProvider]);

  // Handle map click
  const handleMapClick = useCallback(async (event: any) => {
    const { lng, lat } = event.lngLat;
    
    if (mode === 'journey') {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        const result = await response.json();
        
        if (result.success) {
          const location = result.data;
          
          if (journeyState.step === 'from') {
            // First click - set starting point
            setJourneyState(prev => ({
              ...prev,
              step: 'to',
              fromLocation: location,
              markers: { ...prev.markers, crosshair: true }
            }));
          } else if (journeyState.step === 'to') {
            // Second click - complete journey
            const staticLine = createDynamicLineGeoJSON(journeyState.fromLocation!, [lng, lat]);
            
            setJourneyState(prev => ({
              ...prev,
              step: 'complete',
              toLocation: location,
              markers: { from: true, to: true, crosshair: false },
              lines: { dynamic: null, static: staticLine }
            }));
            
            // Preload tiles along the journey path for better UX
            if (journeyState.fromLocation) {
              preloadJourneyPath(journeyState.fromLocation, location);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching location:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Single location mode
      setIsLoading(true);
      setLocationInfo(null);

      try {
        const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        const result = await response.json();
        
        if (result.success) {
          setLocationInfo(result.data);
        }
      } catch (error) {
        console.error('Error fetching location:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [mode, journeyState, createDynamicLineGeoJSON]);

  // Journey action handlers
  const handleAcceptJourney = () => {
    if (journeyState.fromLocation && journeyState.toLocation && onJourneySelect) {
      onJourneySelect(journeyState.fromLocation, journeyState.toLocation);
    }
  };

  const handleRedoJourney = () => {
    setJourneyState({
      step: 'from',
      fromLocation: null,
      toLocation: null,
      markers: { from: false, to: false, crosshair: false },
      lines: { dynamic: null, static: null }
    });
    setCurrentMousePos(null);
  };

  // Intelligent tile preloading for journey paths
  const preloadJourneyPath = useCallback((from: LocationInfo, to: LocationInfo) => {
    if (!mapRef.current) return;
    
    console.log('🛣️ Preloading tiles along journey path');
    
    // Calculate intermediate points along the path using Bresenham-like algorithm
    const steps = 10;
    const latStep = (to.coordinates.lat - from.coordinates.lat) / steps;
    const lngStep = (to.coordinates.lng - from.coordinates.lng) / steps;
    
    for (let i = 0; i <= steps; i++) {
      const lat = from.coordinates.lat + (latStep * i);
      const lng = from.coordinates.lng + (lngStep * i);
      
      // Delay preloading to avoid overwhelming the browser
      setTimeout(() => {
        const zoomDistanceKm = unitPreferences.mapZoomDistance || 100;
        const zoom = distanceToZoomLevel(zoomDistanceKm);
        preloadTilesForLocation(lng, lat, zoom);
      }, i * 100); // 100ms delay between each preload
    }
  }, [unitPreferences.mapZoomDistance, preloadTilesForLocation]);

  // Single mode handlers
  const handleYesClick = () => {
    if (locationInfo && onLocationSelect) {
      onLocationSelect(locationInfo);
    }
    setLocationInfo(null);
  };

  const handleNoClick = () => {
    setLocationInfo(null);
  };

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleConfigs[mapStyle]}
        onClick={handleMapClick}
        onMouseMove={throttledMouseMove}
        cursor={mode === 'journey' ? 'crosshair' : 'pointer'}
        aria-label="Interactive map"
        // Performance optimizations
        maxTileCacheSize={500}  // Increased for better caching
        maxTileCacheZoomLevels={8}  // Cache more zoom levels
        localIdeographFontFamily={false}
        // Advanced performance optimizations
        onLoad={handleMapLoad}
        onError={handleMapError}
        transformRequest={(url, resourceType) => {
          // Don't add custom headers for tiles to avoid CORS preflight
          // Let the browser handle caching naturally
          return { url };
        }}
        // Additional performance settings
        preserveDrawingBuffer={false}
        antialias={false}
        failIfMajorPerformanceCaveat={false}
        crossSourceCollisions={false}
        optimizeForTerrain={false}
        // Fix for blurry tiles
        refreshExpiredTiles={true}
        collectResourceTiming={true}
        fadeDuration={0}  // Disable fade-in animation for tiles
      >
        {/* Crosshair marker for first click */}
        {mode === 'journey' && journeyState.markers.crosshair && journeyState.fromLocation && (
          <Marker
            longitude={journeyState.fromLocation.coordinates.lng}
            latitude={journeyState.fromLocation.coordinates.lat}
          >
            <div className="w-5 h-5 relative">
              <div className="absolute w-5 h-0.5 bg-black top-1/2 left-0 transform -translate-y-1/2"></div>
              <div className="absolute w-0.5 h-5 bg-black left-1/2 top-0 transform -translate-x-1/2"></div>
            </div>
          </Marker>
        )}

        {/* Start marker */}
        {mode === 'journey' && journeyState.markers.from && journeyState.fromLocation && (
          <Marker
            longitude={journeyState.fromLocation.coordinates.lng}
            latitude={journeyState.fromLocation.coordinates.lat}
          >
            <div className="w-8 h-8 bg-green-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
              📍
            </div>
          </Marker>
        )}

        {/* End marker */}
        {mode === 'journey' && journeyState.markers.to && journeyState.toLocation && (
          <Marker
            longitude={journeyState.toLocation.coordinates.lng}
            latitude={journeyState.toLocation.coordinates.lat}
          >
            <div className="w-8 h-8 bg-red-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
              🏁
            </div>
          </Marker>
        )}

        {/* Dynamic line */}
        {mode === 'journey' && journeyState.lines.dynamic && (
          <Source id="dynamic-line" type="geojson" data={journeyState.lines.dynamic}>
            <Layer
              id="dynamic-line-layer"
              type="line"
              paint={{
                'line-color': '#000000',
                'line-width': 1,
                'line-opacity': 1.0
              }}
            />
          </Source>
        )}

        {/* Static line */}
        {mode === 'journey' && journeyState.lines.static && (
          <Source id="static-line" type="geojson" data={journeyState.lines.static}>
            <Layer
              id="static-line-layer"
              type="line"
              paint={{
                'line-color': '#000000',
                'line-width': 1,
                'line-opacity': 1.0
              }}
            />
          </Source>
        )}
      </Map>

      {/* Map style switcher */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-[1000]">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setMapStyle('street')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              mapStyle === 'street'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Street
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              mapStyle === 'satellite'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapStyle('hybrid')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              mapStyle === 'hybrid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Hybrid
          </button>
        </div>
      </div>

      {/* Performance metrics display (development only) */}
      {process.env.NODE_ENV === 'development' && loadMetrics.mapLoadEnd > 0 && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white text-xs p-2 rounded z-[1000]">
          <div>Map Load: {(loadMetrics.mapLoadEnd - loadMetrics.mapLoadStart).toFixed(0)}ms</div>
          <div>API: {loadMetrics.lastLocationLoadTime.toFixed(0)}ms</div>
          <div>Tiles: {loadMetrics.tilesLoaded}</div>
        </div>
      )}

      {/* Loading indicators */}
      {isLoadingLastLocation && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000]">
          <p className="text-sm">Loading map...</p>
        </div>
      )}
      
      {isLoading && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000]">
          <p className="text-sm">Getting location...</p>
        </div>
      )}

      {/* Last location info - only show in single mode */}
      {mode === 'single' && lastLocation && !isLoadingLastLocation && !isLoading && !locationInfo && (
        <div className="absolute top-20 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000] max-w-sm">
          <p className="text-xs text-muted-foreground">
            Map centered on your last destination:
          </p>
          <p className="text-sm font-medium">
            {lastLocation.city}, {lastLocation.country}
          </p>
        </div>
      )}

      {/* Journey summary and actions */}
      {mode === 'journey' && journeyState.step === 'complete' && journeyState.fromLocation && journeyState.toLocation && (
        <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-[1000]">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Journey Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                    📍
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">From</p>
                  <p className="text-xs text-muted-foreground">
                    {journeyState.fromLocation.city}, {journeyState.fromLocation.country}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
                    🏁
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">To</p>
                  <p className="text-xs text-muted-foreground">
                    {journeyState.toLocation.city}, {journeyState.toLocation.country}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAcceptJourney} className="flex-1">
                Accept Journey
              </Button>
              <Button onClick={handleRedoJourney} variant="outline" className="flex-1">
                Redo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Location popup - only show in single mode */}
      {mode === 'single' && locationInfo && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-[1000] max-w-sm">
          <div className="space-y-4">
            <div>
              <p className="text-sm">
                You have chosen <span className="font-semibold">{locationInfo.city}</span> in <span className="font-semibold">{locationInfo.country}</span> - is that correct?
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {locationInfo.coordinates.lat.toFixed(4)}, {locationInfo.coordinates.lng.toFixed(4)}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={handleYesClick}
              >
                Yes
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleNoClick}
              >
                No
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLibreMap;
