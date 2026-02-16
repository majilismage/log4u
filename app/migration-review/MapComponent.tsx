'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';

interface MigrationEntry {
  index: number;
  departureDate: string;
  arrivalDate: string;
  from: string;
  to: string;
  country: string;
  distanceNm: string;
  avgSpeed: string;
  maxSpeed: string;
  notes: string;
  fuel: string;
  fromLat: number;
  fromLng: number;
  fromConfidence: string;
  fromMethod: string;
  toLat: number;
  toLng: number;
  toConfidence: string;
  toMethod: string;
}

interface RouteData {
  index: number;
  from: string;
  to: string;
  route: {
    type: string;
    coordinates: number[][];
  };
}

interface ReviewState {
  imported: Set<number>;
  skipped: Set<number>;
  flagged: Map<number, string>;
}

interface MapComponentProps {
  entries: MigrationEntry[];
  routes: RouteData[];
  currentIndex: number;
  reviewState: ReviewState;
  editMode: 'none' | 'from' | 'to';
  onMapClick: (lat: number, lng: number) => void;
  onCoordsChange: (type: 'from' | 'to', lat: number, lng: number) => void;
  onRouteUpdate: (index: number, route: { type: string; coordinates: number[][] }) => void;
}

const MapComponent = forwardRef<any, MapComponentProps>(({ 
  entries, 
  routes, 
  currentIndex, 
  reviewState, 
  editMode, 
  onMapClick,
  onCoordsChange,
  onRouteUpdate,
}, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapLibreGLRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const editModeRef = useRef(editMode);
  const onMapClickRef = useRef(onMapClick);
  const recalcAbortRef = useRef<AbortController | null>(null);

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useImperativeHandle(ref, () => ({
    getMap: () => mapInstanceRef.current,
  }));

  const recalcRoute = useCallback(async (fromLat: number, fromLng: number, toLat: number, toLng: number, index: number) => {
    // Cancel any pending recalc
    if (recalcAbortRef.current) recalcAbortRef.current.abort();
    const controller = new AbortController();
    recalcAbortRef.current = controller;

    try {
      const res = await fetch('/api/migration/calc-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromLat, fromLng, toLat, toLng }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.route) {
          onRouteUpdate(index, data.route);
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('Route recalc failed:', e);
    }
  }, [onRouteUpdate]);

  // Initialize map once
  useEffect(() => {
    const initMap = async () => {
      try {
        const mapLibreGL = await import('maplibre-gl');
        mapLibreGLRef.current = mapLibreGL;
        
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const map = new mapLibreGL.Map({
          container: mapContainerRef.current,
          style: {
            version: 8,
            sources: {
              'raster-tiles': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'simple-tiles',
                type: 'raster',
                source: 'raster-tiles',
              },
            ],
          },
          center: [-76, 39],
          zoom: 6,
        });

        map.on('load', () => {
          map.addSource('imported-routes', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addSource('current-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer({
            id: 'imported-routes-line',
            type: 'line',
            source: 'imported-routes',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.4 },
          });

          map.addLayer({
            id: 'current-route-line',
            type: 'line',
            source: 'current-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#ef4444', 'line-width': 4 },
          });

          setMapLoaded(true);
        });

        // Handle map clicks for edit mode
        map.on('click', (e: any) => {
          if (editModeRef.current !== 'none') {
            onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
          }
        });

        mapInstanceRef.current = map;
      } catch (error) {
        console.error('Failed to initialize map:', error);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update cursor based on edit mode
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getCanvas().style.cursor = editMode !== 'none' ? 'crosshair' : '';
    }
  }, [editMode]);

  // Update map whenever data or current entry changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mapLibreGL = mapLibreGLRef.current;
    if (!map || !mapLoaded || entries.length === 0 || !mapLibreGL) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Build imported route features
    const importedFeatures = Array.from(reviewState.imported)
      .map(index => routes[index])
      .filter(Boolean)
      .map(route => ({
        type: 'Feature' as const,
        geometry: route.route,
        properties: { index: route.index },
      }));

    const importedSource = map.getSource('imported-routes');
    if (importedSource) {
      importedSource.setData({
        type: 'FeatureCollection',
        features: importedFeatures,
      });
    }

    // Small markers for imported entries
    Array.from(reviewState.imported).forEach(index => {
      const entry = entries[index];
      if (!entry) return;

      [
        [entry.fromLng, entry.fromLat],
        [entry.toLng, entry.toLat],
      ].forEach(([lng, lat]) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:8px;height:8px;background:#3b82f6;border-radius:50%;border:1px solid white;';
        const marker = new mapLibreGL.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
      });
    });

    // Current entry
    const currentEntry = entries[currentIndex];
    const currentRoute = routes[currentIndex];

    if (currentEntry) {
      // Current route line
      const currentSource = map.getSource('current-route');
      if (currentSource && currentRoute) {
        currentSource.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: currentRoute.route,
            properties: { index: currentRoute.index },
          }],
        });
      }

      // From marker (green, draggable)
      const fromEl = document.createElement('div');
      fromEl.style.cssText = 'width:20px;height:20px;background:#10b981;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab;';
      fromEl.title = 'Drag to reposition departure point';
      const fromMarker = new mapLibreGL.Marker({ element: fromEl, draggable: true })
        .setLngLat([currentEntry.fromLng, currentEntry.fromLat])
        .addTo(map);

      fromMarker.on('dragend', () => {
        const lngLat = fromMarker.getLngLat();
        onCoordsChange('from', lngLat.lat, lngLat.lng);
        // Recalculate sea route with new position
        const toEntry = entries[currentIndex];
        if (toEntry) {
          recalcRoute(lngLat.lat, lngLat.lng, toEntry.toLat, toEntry.toLng, currentIndex);
        }
      });

      // To marker (red, draggable)
      const toEl = document.createElement('div');
      toEl.style.cssText = 'width:20px;height:20px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab;';
      toEl.title = 'Drag to reposition arrival point';
      const toMarker = new mapLibreGL.Marker({ element: toEl, draggable: true })
        .setLngLat([currentEntry.toLng, currentEntry.toLat])
        .addTo(map);

      toMarker.on('dragend', () => {
        const lngLat = toMarker.getLngLat();
        onCoordsChange('to', lngLat.lat, lngLat.lng);
        // Recalculate sea route with new position
        const fromEntry = entries[currentIndex];
        if (fromEntry) {
          recalcRoute(fromEntry.fromLat, fromEntry.fromLng, lngLat.lat, lngLat.lng, currentIndex);
        }
      });

      markersRef.current.push(fromMarker, toMarker);

      // Fit bounds to current entry
      const bounds = new mapLibreGL.LngLatBounds()
        .extend([currentEntry.fromLng, currentEntry.fromLat])
        .extend([currentEntry.toLng, currentEntry.toLat]);

      map.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        maxZoom: 13,
        minZoom: 4,
      });
    }
  }, [entries, routes, currentIndex, reviewState, mapLoaded, onCoordsChange, recalcRoute]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ minHeight: '100vh' }}
    />
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;
