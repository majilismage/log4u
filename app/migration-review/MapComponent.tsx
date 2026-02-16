'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

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
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapLibreGLRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    getMap: () => mapInstanceRef.current,
  }));

  // Initialize map
  useEffect(() => {
    let mapLibreGL: any;
    
    const initMap = async () => {
      try {
        mapLibreGL = await import('maplibre-gl');
        mapLibreGLRef.current = mapLibreGL;
        
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = new mapLibreGL.Map({
          container: mapRef.current,
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
          center: [-76, 39], // Roughly centered on US East Coast
          zoom: 6,
        });

        map.on('load', () => {
          // Add route line sources/layers
          map.addSource('imported-routes', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          map.addSource('current-route', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Add imported routes layer (faded blue)
          map.addLayer({
            id: 'imported-routes-line',
            type: 'line',
            source: 'imported-routes',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 2,
              'line-opacity': 0.4,
            },
          });

          // Add current route layer (bright color)
          map.addLayer({
            id: 'current-route-line',
            type: 'line',
            source: 'current-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ef4444',
              'line-width': 3,
            },
          });

          updateMap();
        });

        // Handle map clicks for editing
        map.on('click', (e) => {
          if (editMode !== 'none') {
            onMapClick(e.lngLat.lat, e.lngLat.lng);
          }
        });

        // Update cursor based on edit mode
        map.on('mouseenter', () => {
          if (editMode !== 'none') {
            map.getCanvas().style.cursor = 'crosshair';
          }
        });

        map.on('mouseleave', () => {
          map.getCanvas().style.cursor = '';
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

  // Update map cursor based on edit mode
  useEffect(() => {
    if (mapInstanceRef.current) {
      const canvas = mapInstanceRef.current.getCanvas();
      canvas.style.cursor = editMode !== 'none' ? 'crosshair' : '';
    }
  }, [editMode]);

  // Update map data when entries/routes change
  const updateMap = () => {
    const map = mapInstanceRef.current;
    const mapLibreGL = mapLibreGLRef.current;
    if (!map || !map.isStyleLoaded() || entries.length === 0 || !mapLibreGL) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add imported route lines
    const importedFeatures = Array.from(reviewState.imported)
      .map(index => routes[index])
      .filter(Boolean)
      .map(route => ({
        type: 'Feature',
        geometry: route.route,
        properties: { index: route.index },
      }));

    map.getSource('imported-routes').setData({
      type: 'FeatureCollection',
      features: importedFeatures,
    });

    // Add small markers for imported entries
    Array.from(reviewState.imported).forEach(index => {
      const entry = entries[index];
      if (!entry) return;

      // From marker (small blue) - using custom DOM element
      const fromEl = document.createElement('div');
      fromEl.style.width = '8px';
      fromEl.style.height = '8px';
      fromEl.style.backgroundColor = '#3b82f6';
      fromEl.style.borderRadius = '50%';
      fromEl.style.border = '1px solid white';
      
      const fromMarker = new mapLibreGL.Marker(fromEl)
        .setLngLat([entry.fromLng, entry.fromLat])
        .addTo(map);

      // To marker (small blue)
      const toEl = document.createElement('div');
      toEl.style.width = '8px';
      toEl.style.height = '8px';
      toEl.style.backgroundColor = '#3b82f6';
      toEl.style.borderRadius = '50%';
      toEl.style.border = '1px solid white';
      
      const toMarker = new mapLibreGL.Marker(toEl)
        .setLngLat([entry.toLng, entry.toLat])
        .addTo(map);

      markersRef.current.push(fromMarker, toMarker);
    });

    // Current entry
    const currentEntry = entries[currentIndex];
    const currentRoute = routes[currentIndex];

    if (currentEntry) {
      // Current route line
      if (currentRoute) {
        map.getSource('current-route').setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: currentRoute.route,
            properties: { index: currentRoute.index },
          }],
        });
      }

      // Current entry markers (larger, green for From, red for To)
      const currentFromEl = document.createElement('div');
      currentFromEl.style.width = '16px';
      currentFromEl.style.height = '16px';
      currentFromEl.style.backgroundColor = '#10b981';
      currentFromEl.style.borderRadius = '50%';
      currentFromEl.style.border = '2px solid white';
      currentFromEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      
      const fromMarker = new mapLibreGL.Marker(currentFromEl)
        .setLngLat([currentEntry.fromLng, currentEntry.fromLat])
        .addTo(map);

      const currentToEl = document.createElement('div');
      currentToEl.style.width = '16px';
      currentToEl.style.height = '16px';
      currentToEl.style.backgroundColor = '#ef4444';
      currentToEl.style.borderRadius = '50%';
      currentToEl.style.border = '2px solid white';
      currentToEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      
      const toMarker = new mapLibreGL.Marker(currentToEl)
        .setLngLat([currentEntry.toLng, currentEntry.toLat])
        .addTo(map);

      markersRef.current.push(fromMarker, toMarker);

      // Fit bounds to show both markers
      const bounds = new mapLibreGL.LngLatBounds()
        .extend([currentEntry.fromLng, currentEntry.fromLat])
        .extend([currentEntry.toLng, currentEntry.toLat]);

      map.fitBounds(bounds, { padding: 50 });
    }
  };

  // Update map when data changes
  useEffect(() => {
    updateMap();
  }, [entries, routes, currentIndex, reviewState]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full"
      style={{ minHeight: '100vh' }}
    />
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;