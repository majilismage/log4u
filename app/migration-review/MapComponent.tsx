'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

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
}

const MapComponent = forwardRef<any, MapComponentProps>(({ 
  entries, 
  routes, 
  currentIndex, 
  reviewState, 
  editMode, 
  onMapClick 
}, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapLibreGLRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const editModeRef = useRef(editMode);
  const onMapClickRef = useRef(onMapClick);

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useImperativeHandle(ref, () => ({
    getMap: () => mapInstanceRef.current,
  }));

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
          // Add sources
          map.addSource('imported-routes', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addSource('current-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          // Imported routes layer (faded blue)
          map.addLayer({
            id: 'imported-routes-line',
            type: 'line',
            source: 'imported-routes',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.4 },
          });

          // Current route layer (bright red, thicker)
          map.addLayer({
            id: 'current-route-line',
            type: 'line',
            source: 'current-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#ef4444', 'line-width': 4 },
          });

          setMapLoaded(true);
        });

        // Handle map clicks — use ref to get current editMode
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

      // From marker (green, larger)
      const fromEl = document.createElement('div');
      fromEl.style.cssText = 'width:18px;height:18px;background:#10b981;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
      const fromMarker = new mapLibreGL.Marker({ element: fromEl })
        .setLngLat([currentEntry.fromLng, currentEntry.fromLat])
        .addTo(map);

      // To marker (red, larger)
      const toEl = document.createElement('div');
      toEl.style.cssText = 'width:18px;height:18px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
      const toMarker = new mapLibreGL.Marker({ element: toEl })
        .setLngLat([currentEntry.toLng, currentEntry.toLat])
        .addTo(map);

      markersRef.current.push(fromMarker, toMarker);

      // Fit bounds to current entry with good zoom
      const bounds = new mapLibreGL.LngLatBounds()
        .extend([currentEntry.fromLng, currentEntry.fromLat])
        .extend([currentEntry.toLng, currentEntry.toLat]);

      map.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        maxZoom: 13,
        minZoom: 4,
      });
    }
  }, [entries, routes, currentIndex, reviewState, mapLoaded]);

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
