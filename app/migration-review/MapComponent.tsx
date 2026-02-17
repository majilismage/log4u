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
  const currentPolylineRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const skipFitBoundsRef = useRef(false);
  // Refs for callbacks to avoid stale closures in Leaflet event handlers
  const editModeRef = useRef(editMode);
  const onMapClickRef = useRef(onMapClick);
  const onCoordsChangeRef = useRef(onCoordsChange);
  const onRouteUpdateRef = useRef(onRouteUpdate);
  const onEditModeChangeRef = useRef(onEditModeChange);
  const currentIndexRef = useRef(currentIndex);
  const routesRef = useRef(routes);
  const waypointMarkersRef = useRef<any[]>([]);
  const distanceLabelRef = useRef<any>(null);
  const hitAreaRef = useRef<any>(null);

  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onCoordsChangeRef.current = onCoordsChange; }, [onCoordsChange]);
  useEffect(() => { onRouteUpdateRef.current = onRouteUpdate; }, [onRouteUpdate]);
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

  const makeWaypointIcon = () => {
    if (!L) return null;
    return L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:#f59e0b;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  const clearLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    allLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    allLayersRef.current = [];
    currentPolylineRef.current = null;
    waypointMarkersRef.current = [];
    distanceLabelRef.current = null;
    hitAreaRef.current = null;
  };

  const addLayer = (layer: any) => {
    if (!mapRef.current || !layer) return;
    layer.addTo(mapRef.current);
    allLayersRef.current.push(layer);
    return layer;
  };

  // Update or create the distance label on the current route polyline
  const updateDistanceLabel = useCallback((latlngs: any[]) => {
    if (!L || !mapRef.current) return;
    const dist = totalDistanceNm(latlngs);
    const mid = midpointAlongLine(latlngs);
    const labelHtml = `<div style="display:flex;justify-content:center;align-items:center;width:100%;height:100%"><div style="background:rgba(0,0,0,0.8);color:#fff;padding:4px 14px;border-radius:6px;font-size:14px;font-weight:600;white-space:nowrap;pointer-events:none;line-height:1.4">${dist.toFixed(1)} nm</div></div>`;

    const iconOpts = {
      className: '',
      html: labelHtml,
      iconSize: [120, 30] as [number, number],
      iconAnchor: [60, 15] as [number, number],
    };

    if (distanceLabelRef.current && mapRef.current.hasLayer(distanceLabelRef.current)) {
      distanceLabelRef.current.setLatLng([mid.lat, mid.lng]);
      distanceLabelRef.current.setIcon(L.divIcon(iconOpts));
    } else {
      const marker = L.marker([mid.lat, mid.lng], {
        icon: L.divIcon(iconOpts),
        interactive: false,
        zIndexOffset: 1000,
      });
      marker.addTo(mapRef.current);
      allLayersRef.current.push(marker);
      distanceLabelRef.current = marker;
    }
  }, []);

  // Update polyline + persist route coordinates from current waypoint/endpoint positions
  const syncRouteFromMarkers = (
    fromLatLng: any,
    toLatLng: any,
    waypointMarkers: any[]
  ) => {
    const latlngs = [
      fromLatLng,
      ...waypointMarkers.map((m: any) => m.getLatLng()),
      toLatLng,
    ];
    if (currentPolylineRef.current) {
      currentPolylineRef.current.setLatLngs(latlngs);
    }
    if (hitAreaRef.current) {
      hitAreaRef.current.setLatLngs(latlngs);
    }
    updateDistanceLabel(latlngs);
    // Persist as GeoJSON [lng, lat]
    const coords = latlngs.map((ll: any) => [ll.lng, ll.lat]);
    onRouteUpdateRef.current(currentIndexRef.current, { type: 'LineString', coordinates: coords });
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

      // Esri Ocean basemap — clearly shows water vs land with nautical context
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Sources: GEBCO, NOAA, National Geographic',
        maxZoom: 16,
      }).addTo(map);
      // Labels overlay
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
      }).addTo(map);

      map.on('click', (e: any) => {
        if (editModeRef.current !== 'none') {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      // Add custom cursor styles for route interaction
      const style = document.createElement('style');
      style.textContent = `.route-hit-area { cursor: crosshair !important; }`;
      document.head.appendChild(style);

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

    const currentBounds = L.latLngBounds([]);

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

    // --- Previous route (grey dashed, full opacity) ---
    if (prevRoute?.route?.coordinates?.length && prevEntry) {
      const coords = prevRoute.route.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
      addLayer(L.polyline(coords, { color: '#94a3b8', weight: 6, opacity: 1, dashArray: '8,14' }));
      addLayer(L.circleMarker([prevEntry.fromLat, prevEntry.fromLng], { radius: 5, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 1, weight: 1 }));
      addLayer(L.circleMarker([prevEntry.toLat, prevEntry.toLng], { radius: 5, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 1, weight: 1 }));
    }

    // --- Current route (bright red, editable) ---
    if (currentEntry) {
      // Build coordinates: start + waypoints + end
      const routeCoords = currentRoute?.route?.coordinates?.length
        ? currentRoute.route.coordinates.map(([lng, lat]: number[]) => [lat, lng])
        : [[currentEntry.fromLat, currentEntry.fromLng], [currentEntry.toLat, currentEntry.toLng]];

      // Invisible fat polyline for easier click target
      const hitArea = addLayer(L.polyline(routeCoords, { color: 'transparent', weight: 40, interactive: true, className: 'route-hit-area' }));
      hitAreaRef.current = hitArea;
      const polyline = addLayer(L.polyline(routeCoords, { color: '#ef4444', weight: 4, interactive: false }));
      currentPolylineRef.current = polyline;
      routeCoords.forEach((c: number[]) => currentBounds.extend(c));

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

      fromMarker.on('drag', () => {
        syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
      });

      fromMarker.on('dragend', () => {
        isDraggingRef.current = false;
        skipFitBoundsRef.current = true;
        const ll = fromMarker.getLatLng();
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

      toMarker.on('drag', () => {
        syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
      });

      toMarker.on('dragend', () => {
        isDraggingRef.current = false;
        skipFitBoundsRef.current = true;
        const ll = toMarker.getLatLng();
        onCoordsChangeRef.current('to', ll.lat, ll.lng);
      });

      // --- Waypoint markers (intermediate points, draggable) ---
      // Skip first and last coords (those are the from/to endpoints)
      const waypointCoords = routeCoords.slice(1, -1);
      const wpMarkers: any[] = [];

      waypointCoords.forEach((coord: number[], _wpIdx: number) => {
        const wpMarker = addLayer(L.marker(coord, {
          icon: makeWaypointIcon(),
          draggable: true,
        }));

        wpMarker.on('dragstart', () => { isDraggingRef.current = true; });

        wpMarker.on('drag', () => {
          syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
        });

        wpMarker.on('dragend', () => {
          isDraggingRef.current = false;
          skipFitBoundsRef.current = true;
          syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
        });

        // Right-click to remove waypoint
        wpMarker.on('contextmenu', (e: any) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          const idx = waypointMarkersRef.current.indexOf(wpMarker);
          if (idx !== -1) {
            waypointMarkersRef.current.splice(idx, 1);
            if (mapRef.current?.hasLayer(wpMarker)) mapRef.current.removeLayer(wpMarker);
            skipFitBoundsRef.current = true;
            syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
          }
        });

        wpMarkers.push(wpMarker);
      });

      waypointMarkersRef.current = wpMarkers;

      // Show distance label on current route
      updateDistanceLabel(routeCoords.map((c: number[]) => ({ lat: c[0], lng: c[1] })));

      // Click on polyline to add a new waypoint
      hitArea.on('mousedown', (e: any) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        const clickLatLng = e.latlng;

        // Find which segment was clicked (closest segment)
        const allLatLngs = [
          fromMarker.getLatLng(),
          ...waypointMarkersRef.current.map((m: any) => m.getLatLng()),
          toMarker.getLatLng(),
        ];

        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < allLatLngs.length - 1; i++) {
          const d = distToSegment(clickLatLng, allLatLngs[i], allLatLngs[i + 1]);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }

        // Insert new waypoint after bestIdx
        const insertIdx = bestIdx;
        const newWp = L.marker([clickLatLng.lat, clickLatLng.lng], {
          icon: makeWaypointIcon(),
          draggable: true,
        });
        addLayer(newWp);

        newWp.on('dragstart', () => { isDraggingRef.current = true; });
        newWp.on('drag', () => {
          syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
        });
        newWp.on('dragend', () => {
          isDraggingRef.current = false;
          skipFitBoundsRef.current = true;
          syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
        });
        newWp.on('contextmenu', (ev: any) => {
          L.DomEvent.stopPropagation(ev);
          L.DomEvent.preventDefault(ev);
          const idx = waypointMarkersRef.current.indexOf(newWp);
          if (idx !== -1) {
            waypointMarkersRef.current.splice(idx, 1);
            if (mapRef.current?.hasLayer(newWp)) mapRef.current.removeLayer(newWp);
            skipFitBoundsRef.current = true;
            syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
          }
        });

        waypointMarkersRef.current.splice(insertIdx, 0, newWp);
        skipFitBoundsRef.current = true;
        syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);

        // Immediately start dragging: disable map drag, track mouse manually
        const map = mapRef.current;
        map.dragging.disable();
        isDraggingRef.current = true;

        const onMouseMove = (moveEvt: MouseEvent) => {
          const containerPoint = map.mouseEventToContainerPoint(moveEvt);
          const newLatLng = map.containerPointToLatLng(containerPoint);
          newWp.setLatLng(newLatLng);
          syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.dragging.enable();
          isDraggingRef.current = false;
          skipFitBoundsRef.current = true;
          syncRouteFromMarkers(fromMarker.getLatLng(), toMarker.getLatLng(), waypointMarkersRef.current);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }

    // --- Next route (blue dashed, full opacity) ---
    if (nextRoute?.route?.coordinates?.length && nextEntry) {
      const coords = nextRoute.route.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
      addLayer(L.polyline(coords, { color: '#60a5fa', weight: 6, opacity: 1, dashArray: '8,14' }));
      addLayer(L.circleMarker([nextEntry.fromLat, nextEntry.fromLng], { radius: 5, color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 1, weight: 1 }));
      addLayer(L.circleMarker([nextEntry.toLat, nextEntry.toLng], { radius: 5, color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 1, weight: 1 }));
    }

    // Fit bounds to current route only (skip after drag/edit to preserve user's zoom/pan)
    if (currentBounds.isValid() && !skipFitBoundsRef.current) {
      map.fitBounds(currentBounds, { padding: [60, 60], maxZoom: 14 });
    }
    skipFitBoundsRef.current = false;
  }, [mapReady, currentIndex, entries, routes, reviewState, editMode]);

  return <div ref={mapContainerRef} data-testid="leaflet-map" className="w-full h-full" />;
}

// Haversine distance between two lat/lng points in nautical miles
function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Total distance of a polyline in nautical miles
function totalDistanceNm(latlngs: any[]): number {
  let total = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    total += haversineNm(latlngs[i].lat, latlngs[i].lng, latlngs[i + 1].lat, latlngs[i + 1].lng);
  }
  return total;
}

// Find the geographic midpoint along a polyline (by cumulative distance)
function midpointAlongLine(latlngs: any[]): { lat: number; lng: number } {
  if (latlngs.length === 0) return { lat: 0, lng: 0 };
  if (latlngs.length === 1) return { lat: latlngs[0].lat, lng: latlngs[0].lng };
  const total = totalDistanceNm(latlngs);
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    const seg = haversineNm(latlngs[i].lat, latlngs[i].lng, latlngs[i + 1].lat, latlngs[i + 1].lng);
    if (acc + seg >= half) {
      const frac = seg > 0 ? (half - acc) / seg : 0;
      return {
        lat: latlngs[i].lat + frac * (latlngs[i + 1].lat - latlngs[i].lat),
        lng: latlngs[i].lng + frac * (latlngs[i + 1].lng - latlngs[i].lng),
      };
    }
    acc += seg;
  }
  return { lat: latlngs[latlngs.length - 1].lat, lng: latlngs[latlngs.length - 1].lng };
}

// Helper: distance from point to line segment (in lat/lng space, good enough for click detection)
function distToSegment(p: any, a: any, b: any): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((p.lng - a.lng) ** 2 + (p.lat - a.lat) ** 2);
  }
  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const projLng = a.lng + t * dx;
  const projLat = a.lat + t * dy;
  return Math.sqrt((p.lng - projLng) ** 2 + (p.lat - projLat) ** 2);
}
