'use client'

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  onEditModeChange: (mode: 'none' | 'from' | 'to') => void;
}

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    'osm-raster': {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster' as const,
      source: 'osm-raster',
    },
  ],
};

export default function MapComponent({
  entries,
  routes,
  currentIndex,
  reviewState,
  editMode,
  onMapClick,
  onCoordsChange,
  onRouteUpdate,
  onEditModeChange,
}: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const recalcAbortRef = useRef<AbortController | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const currentEntry = entries[currentIndex];
  const currentRoute = routes[currentIndex];

  // Fit bounds when current entry changes
  useEffect(() => {
    if (!mapReady || !currentEntry || !mapRef.current) return;

    const map = mapRef.current;
    const bounds: [[number, number], [number, number]] = [
      [Math.min(currentEntry.fromLng, currentEntry.toLng), Math.min(currentEntry.fromLat, currentEntry.toLat)],
      [Math.max(currentEntry.fromLng, currentEntry.toLng), Math.max(currentEntry.fromLat, currentEntry.toLat)],
    ];

    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 100, left: 100, right: 100 },
      maxZoom: 13,
      minZoom: 4,
      duration: 500,
    });
  }, [currentIndex, mapReady]); // Only refit on index change, not coord edits

  // Build imported routes GeoJSON
  const importedRoutesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: Array.from(reviewState.imported)
      .map(idx => routes[idx])
      .filter(Boolean)
      .map(route => ({
        type: 'Feature' as const,
        geometry: route.route,
        properties: { index: route.index },
      })),
  }), [reviewState.imported, routes]);

  // Build current route GeoJSON
  const currentRouteGeoJSON = useMemo(() => {
    if (!currentRoute) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: currentRoute.route,
        properties: { index: currentRoute.index },
      }],
    };
  }, [currentRoute]);

  // Recalculate sea route via API
  const recalcRoute = useCallback(async (fromLat: number, fromLng: number, toLat: number, toLng: number, index: number) => {
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

  // Map click handler for edit mode
  const handleClick = useCallback((e: any) => {
    if (editMode !== 'none') {
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    }
  }, [editMode, onMapClick]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: -76,
        latitude: 39,
        zoom: 6,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      cursor={editMode !== 'none' ? 'crosshair' : undefined}
      onClick={handleClick}
      onLoad={() => setMapReady(true)}
    >
      {/* Imported routes (faded blue) */}
      <Source id="imported-routes" type="geojson" data={importedRoutesGeoJSON}>
        <Layer
          id="imported-routes-line"
          type="line"
          paint={{
            'line-color': '#3b82f6',
            'line-width': 2,
            'line-opacity': 0.4,
          }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </Source>

      {/* Small markers for imported entries */}
      {Array.from(reviewState.imported).map(idx => {
        const entry = entries[idx];
        if (!entry) return null;
        return (
          <span key={`imported-${idx}`}>
            <Marker longitude={entry.fromLng} latitude={entry.fromLat}>
              <div style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: '50%', border: '1px solid white' }} />
            </Marker>
            <Marker longitude={entry.toLng} latitude={entry.toLat}>
              <div style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: '50%', border: '1px solid white' }} />
            </Marker>
          </span>
        );
      })}

      {/* Current route (bright red) */}
      <Source id="current-route" type="geojson" data={currentRouteGeoJSON}>
        <Layer
          id="current-route-line"
          type="line"
          paint={{
            'line-color': '#ef4444',
            'line-width': 4,
          }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </Source>

      {/* Current From marker (green, clickable to edit) */}
      {currentEntry && (
        <Marker
          longitude={currentEntry.fromLng}
          latitude={currentEntry.fromLat}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onEditModeChange(editMode === 'from' ? 'none' : 'from');
            }}
            style={{
              width: 22,
              height: 22,
              background: editMode === 'from' ? '#facc15' : '#10b981',
              borderRadius: '50%',
              border: editMode === 'from' ? '3px solid #fef08a' : '3px solid white',
              boxShadow: editMode === 'from'
                ? '0 0 12px rgba(250, 204, 21, 0.7)'
                : '0 2px 6px rgba(0,0,0,0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Click to reposition departure"
          />
        </Marker>
      )}

      {/* Current To marker (red, clickable to edit) */}
      {currentEntry && (
        <Marker
          longitude={currentEntry.toLng}
          latitude={currentEntry.toLat}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onEditModeChange(editMode === 'to' ? 'none' : 'to');
            }}
            style={{
              width: 22,
              height: 22,
              background: editMode === 'to' ? '#facc15' : '#ef4444',
              borderRadius: '50%',
              border: editMode === 'to' ? '3px solid #fef08a' : '3px solid white',
              boxShadow: editMode === 'to'
                ? '0 0 12px rgba(250, 204, 21, 0.7)'
                : '0 2px 6px rgba(0,0,0,0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Click to reposition arrival"
          />
        </Marker>
      )}
    </Map>
  );
}
