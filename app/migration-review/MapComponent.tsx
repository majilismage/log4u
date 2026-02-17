'use client'

import { useRef, useCallback, useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

let L: any;

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const allLayersRef = useRef<any[]>([]);
  // Keep refs for drag-interactive elements so we can update them without full rerender
  const currentPolylineRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  // Refs for callbacks to avoid stale closures in Leaflet event handlers
  const editModeRef = useRef(editMode);
  const onMapClickRef = useRef(onMapClick);
  const onCoordsChangeRef = useRef(onCoordsChange);
  const onEditModeChangeRef = useRef(onEditModeChange);
  const currentIndexRef = useRef(currentIndex);
  const routesRef = useRef(routes);

  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onCoordsChangeRef.current = onCoordsChange; }, [onCoordsChange]);
  useEffect(() => { onEditModeChangeRef.current = onEditModeChange; }, [onEditModeChange]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { routesRef.current = routes; }, [routes]);

  const makeIcon = (color: string, size = 20, highlighted = false) => {
    if (!L) return null;
    const border = highlighted ? '#fef08a' : 'white';
    const shadow = highlighted ? '0 0 12px rgba(250,204,21,0.7)' : '0 2px 6px rgba(0,0,0,0.4)';
    return L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:3px solid ${border};box-shadow:${shadow};cursor:grab"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Clear all layers from map
  const clearLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    allLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    allLayersRef.current = [];
    currentPolylineRef.current = null;
  };

  // Add a layer and track it
  const addLayer = (layer: any) => {
    if (!mapRef.current || !layer) return;
    layer.addTo(mapRef.current);
    allLayersRef.current.push(layer);
    return layer;
  };

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      L = (await import('leaflet')).default;

      const map = L.map(mapContainerRef.current, {
        center: [39, -76],
        zoom: 6,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      map.on('click', (e: any) => {
        if (editModeRef.current !== 'none') {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      mapRef.current = map;
      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Rebuild all layers when data changes (but NOT during drag)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !L || isDraggingRef.current) return;

    clearLayers();

    const map = mapRef.current;
    const currentEntry = entries[currentIndex];
    const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
    const nextEntry = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;
    const currentRoute = routes[currentIndex];
    const prevRoute = currentIndex > 0 ? routes[currentIndex - 1] : null;
    const nextRoute = currentIndex < routes.length - 1 ? routes[currentIndex + 1] : null;

    const bounds = L.latLngBounds([]);

    // --- Imported routes (thin, faded blue) ---
    Array.from(reviewState.imported).forEach(idx => {
      const route = routes[idx];
      if (route?.route?.coordinates?.length) {
        addLayer(L.polyline(
          route.route.coordinates.map(([lng, lat]: number[]) => [lat, lng]),
          { color: '#3b82f6', weight: 1, opacity: 0.3 }
        ));
      }
    });

    // --- Previous route (grey dashed, 50% opacity) ---
    if (prevRoute?.route?.coordinates?.length && prevEntry) {
      const coords = prevRoute.route.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
      addLayer(L.polyline(coords, { color: '#94a3b8', weight: 2, opacity: 1, dashArray: '5,10' }));
      addLayer(L.circleMarker([prevEntry.fromLat, prevEntry.fromLng], { radius: 5, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 1, weight: 1 }));
      addLayer(L.circleMarker([prevEntry.toLat, prevEntry.toLng], { radius: 5, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 1, weight: 1 }));
      coords.forEach((c: number[]) => bounds.extend(c));
    }

    // --- Current route (bright red) ---
    if (currentRoute?.route?.coordinates?.length && currentEntry) {
      const coords = currentRoute.route.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
      const polyline = addLayer(L.polyline(coords, { color: '#ef4444', weight: 4 }));
      currentPolylineRef.current = polyline;
      coords.forEach((c: number[]) => bounds.extend(c));

      // From marker (green, draggable)
      const fromMarker = addLayer(L.marker([currentEntry.fromLat, currentEntry.fromLng], {
        icon: makeIcon('#10b981', 20, editMode === 'from'),
        draggable: true,
      }));

      fromMarker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        onEditModeChangeRef.current(editModeRef.current === 'from' ? 'none' : 'from');
      });

      fromMarker.on('dragstart', () => { isDraggingRef.current = true; });

      fromMarker.on('drag', (e: any) => {
        const ll = e.target.getLatLng();
        // Only update the polyline visually — no state changes during drag
        if (currentPolylineRef.current) {
          const latlngs = currentPolylineRef.current.getLatLngs();
          latlngs[0] = L.latLng(ll.lat, ll.lng);
          currentPolylineRef.current.setLatLngs(latlngs);
        }
      });

      fromMarker.on('dragend', (e: any) => {
        isDraggingRef.current = false;
        const ll = e.target.getLatLng();
        onCoordsChangeRef.current('from', ll.lat, ll.lng);
      });

      // To marker (red, draggable)
      const toMarker = addLayer(L.marker([currentEntry.toLat, currentEntry.toLng], {
        icon: makeIcon('#ef4444', 20, editMode === 'to'),
        draggable: true,
      }));

      toMarker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        onEditModeChangeRef.current(editModeRef.current === 'to' ? 'none' : 'to');
      });

      toMarker.on('dragstart', () => { isDraggingRef.current = true; });

      toMarker.on('drag', (e: any) => {
        const ll = e.target.getLatLng();
        if (currentPolylineRef.current) {
          const latlngs = currentPolylineRef.current.getLatLngs();
          latlngs[latlngs.length - 1] = L.latLng(ll.lat, ll.lng);
          currentPolylineRef.current.setLatLngs(latlngs);
        }
      });

      toMarker.on('dragend', (e: any) => {
        isDraggingRef.current = false;
        const ll = e.target.getLatLng();
        onCoordsChangeRef.current('to', ll.lat, ll.lng);
      });
    }

    // --- Next route (blue dashed, 50% opacity) ---
    if (nextRoute?.route?.coordinates?.length && nextEntry) {
      const coords = nextRoute.route.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
      addLayer(L.polyline(coords, { color: '#60a5fa', weight: 2, opacity: 1, dashArray: '5,10' }));
      addLayer(L.circleMarker([nextEntry.fromLat, nextEntry.fromLng], { radius: 5, color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 1, weight: 1 }));
      addLayer(L.circleMarker([nextEntry.toLat, nextEntry.toLng], { radius: 5, color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 1, weight: 1 }));
      coords.forEach((c: number[]) => bounds.extend(c));
    }

    // Fit bounds
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [mapReady, currentIndex, entries, routes, reviewState, editMode]);

  return <div ref={mapContainerRef} data-testid="leaflet-map" className="w-full h-full" />;
}
