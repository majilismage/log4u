'use client'

import { useRef, useCallback, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

// Leaflet imports - must be dynamic to avoid SSR issues
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
  const layersRef = useRef<{
    importedRoutes?: any[];
    previousRoute?: any;
    previousMarkers?: any[];
    currentRoute?: any;
    currentFromMarker?: any;
    currentToMarker?: any;
    nextRoute?: any;
    nextMarkers?: any[];
  }>({});

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Dynamic import of Leaflet to avoid SSR issues
    const initMap = async () => {
      L = (await import('leaflet')).default;
      
      // Fix for missing marker icons in webpack/Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzNiODJmNiIvPgo8L3N2Zz4K',
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzNiODJmNiIvPgo8L3N2Zz4K',
        shadowUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzNiODJmNiIvPgo8L3N2Zz4K',
      });

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [39, -76],
        zoom: 6,
        zoomControl: true,
      });

      // Add tile layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      // Handle map clicks for edit mode
      map.on('click', (e: any) => {
        if (editMode !== 'none') {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });

      mapRef.current = map;
      updateMapLayers();
    };

    initMap();

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update layers when data changes
  useEffect(() => {
    if (mapRef.current && L) {
      updateMapLayers();
    }
  }, [currentIndex, entries, routes, reviewState, editMode]);

  const createCustomIcon = useCallback((color: string, isHighlighted = false) => {
    if (!L) return null;
    
    const shadowStyle = isHighlighted 
      ? '0 0 12px rgba(250, 204, 21, 0.7)' 
      : '0 2px 6px rgba(0,0,0,0.4)';
    const borderColor = isHighlighted ? '#fef08a' : 'white';
    
    return L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;background:${color};border-radius:50%;border:3px solid ${borderColor};box-shadow:${shadowStyle}"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, [L]);

  const updateMapLayers = useCallback(() => {
    if (!mapRef.current || !L) return;

    const map = mapRef.current;
    const layers = layersRef.current;

    // Clear existing layers
    Object.values(layers).flat().forEach((layer: any) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // Reset layers reference
    layersRef.current = {};

    const currentEntry = entries[currentIndex];
    const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
    const nextEntry = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;
    
    const currentRoute = routes[currentIndex];
    const prevRoute = currentIndex > 0 ? routes[currentIndex - 1] : null;
    const nextRoute = currentIndex < routes.length - 1 ? routes[currentIndex + 1] : null;

    // Calculate bounds for fit
    const bounds = L.latLngBounds([]);
    
    // Add imported routes (all previously approved routes)
    const importedRouteLayers: any[] = [];
    Array.from(reviewState.imported).forEach(idx => {
      const route = routes[idx];
      if (route && route.route.coordinates) {
        const polyline = L.polyline(
          route.route.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
          { color: '#3b82f6', weight: 1, opacity: 0.3 }
        ).addTo(map);
        importedRouteLayers.push(polyline);
      }
    });
    layers.importedRoutes = importedRouteLayers;

    // Add previous route (grey dashed)
    if (prevRoute && prevEntry) {
      const prevPolyline = L.polyline(
        prevRoute.route.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        { color: '#94a3b8', weight: 2, opacity: 0.5, dashArray: '5,10' }
      ).addTo(map);
      layers.previousRoute = prevPolyline;

      // Add to bounds
      prevRoute.route.coordinates.forEach(([lng, lat]: [number, number]) => {
        bounds.extend([lat, lng]);
      });

      // Previous markers (small grey circles)
      const prevFromMarker = L.circleMarker([prevEntry.fromLat, prevEntry.fromLng], {
        radius: 5,
        color: '#94a3b8',
        fillColor: '#94a3b8',
        fillOpacity: 0.8,
      }).addTo(map);

      const prevToMarker = L.circleMarker([prevEntry.toLat, prevEntry.toLng], {
        radius: 5,
        color: '#94a3b8',
        fillColor: '#94a3b8',
        fillOpacity: 0.8,
      }).addTo(map);

      layers.previousMarkers = [prevFromMarker, prevToMarker];
    }

    // Add current route (bright red)
    if (currentRoute && currentEntry) {
      const currentPolyline = L.polyline(
        currentRoute.route.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        { color: '#ef4444', weight: 4 }
      ).addTo(map);
      layers.currentRoute = currentPolyline;

      // Add to bounds
      currentRoute.route.coordinates.forEach(([lng, lat]: [number, number]) => {
        bounds.extend([lat, lng]);
      });

      // Try to add draggable lines plugin
      try {
        // This will only work if leaflet-draggable-lines is properly loaded
        if (typeof window !== 'undefined' && (window as any).L && (window as any).L.EditableDraggableLines) {
          const editableLine = new (window as any).L.EditableDraggableLines(currentPolyline);
          editableLine.on('edited', (e: any) => {
            const newCoords = e.target.getLatLngs().map((latlng: any) => [latlng.lng, latlng.lat]);
            onRouteUpdate(currentIndex, {
              type: 'LineString',
              coordinates: newCoords,
            });
          });
        }
      } catch (e) {
        console.debug('Draggable lines plugin not available:', e);
      }

      // Current From marker (green, draggable)
      const greenIcon = createCustomIcon('#10b981', editMode === 'from');
      const fromMarker = L.marker([currentEntry.fromLat, currentEntry.fromLng], {
        icon: greenIcon,
        draggable: true,
      }).addTo(map);

      fromMarker.on('click', () => {
        onEditModeChange(editMode === 'from' ? 'none' : 'from');
      });

      fromMarker.on('drag', (e: any) => {
        const newLatLng = e.target.getLatLng();
        onCoordsChange('from', newLatLng.lat, newLatLng.lng);
        
        // Update route polyline immediately during drag
        if (layers.currentRoute) {
          const coords = currentRoute.route.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
          coords[0] = [newLatLng.lat, newLatLng.lng]; // Update first coordinate
          layers.currentRoute.setLatLngs(coords);
        }
      });

      fromMarker.on('dragend', (e: any) => {
        const newLatLng = e.target.getLatLng();
        onCoordsChange('from', newLatLng.lat, newLatLng.lng);
      });

      layers.currentFromMarker = fromMarker;

      // Current To marker (red, draggable)
      const redIcon = createCustomIcon('#ef4444', editMode === 'to');
      const toMarker = L.marker([currentEntry.toLat, currentEntry.toLng], {
        icon: redIcon,
        draggable: true,
      }).addTo(map);

      toMarker.on('click', () => {
        onEditModeChange(editMode === 'to' ? 'none' : 'to');
      });

      toMarker.on('drag', (e: any) => {
        const newLatLng = e.target.getLatLng();
        onCoordsChange('to', newLatLng.lat, newLatLng.lng);
        
        // Update route polyline immediately during drag
        if (layers.currentRoute) {
          const coords = currentRoute.route.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
          coords[coords.length - 1] = [newLatLng.lat, newLatLng.lng]; // Update last coordinate
          layers.currentRoute.setLatLngs(coords);
        }
      });

      toMarker.on('dragend', (e: any) => {
        const newLatLng = e.target.getLatLng();
        onCoordsChange('to', newLatLng.lat, newLatLng.lng);
      });

      layers.currentToMarker = toMarker;
    }

    // Add next route (blue dashed)
    if (nextRoute && nextEntry) {
      const nextPolyline = L.polyline(
        nextRoute.route.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        { color: '#60a5fa', weight: 2, opacity: 0.5, dashArray: '5,10' }
      ).addTo(map);
      layers.nextRoute = nextPolyline;

      // Add to bounds
      nextRoute.route.coordinates.forEach(([lng, lat]: [number, number]) => {
        bounds.extend([lat, lng]);
      });

      // Next markers (small blue circles)
      const nextFromMarker = L.circleMarker([nextEntry.fromLat, nextEntry.fromLng], {
        radius: 5,
        color: '#60a5fa',
        fillColor: '#60a5fa',
        fillOpacity: 0.8,
      }).addTo(map);

      const nextToMarker = L.circleMarker([nextEntry.toLat, nextEntry.toLng], {
        radius: 5,
        color: '#60a5fa',
        fillColor: '#60a5fa',
        fillOpacity: 0.8,
      });

      layers.nextMarkers = [nextFromMarker, nextToMarker];
    }

    // Fit bounds to show all visible routes
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [currentIndex, entries, routes, reviewState, editMode, onCoordsChange, onEditModeChange, onRouteUpdate, createCustomIcon, L]);

  return <div ref={mapContainerRef} data-testid="leaflet-map" className="w-full h-full" />;
}