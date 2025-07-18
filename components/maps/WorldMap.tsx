'use client';

import { useEffect, useRef, useState } from 'react';
import L, { Map, Marker } from 'leaflet';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

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

interface JourneyState {
  step: 'from' | 'to' | 'complete';
  fromLocation: LocationInfo | null;
  toLocation: LocationInfo | null;
  markers: {
    from: Marker | null;
    to: Marker | null;
  };
}

interface WorldMapProps {
  onLocationSelect?: (location: LocationInfo) => void;
  mode?: 'single' | 'journey';
  onJourneySelect?: (from: LocationInfo, to: LocationInfo) => void;
}

// Create custom icons for journey markers
const createCustomIcon = (type: 'start' | 'stop') => {
  const color = type === 'start' ? '#22c55e' : '#ef4444'; // green-500 : red-500
  const emoji = type === 'start' ? '📍' : '🏁';
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        ${emoji}
      </div>
      <div style="
        position: absolute;
        top: 36px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      ">
        ${type === 'start' ? 'FROM' : 'TO'}
      </div>
    `,
    className: 'custom-journey-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const WorldMap = ({ onLocationSelect, mode = 'single', onJourneySelect }: WorldMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [isLoadingLastLocation, setIsLoadingLastLocation] = useState(true);
  
  // Journey mode state
  const [journeyState, setJourneyState] = useState<JourneyState>({
    step: 'from',
    fromLocation: null,
    toLocation: null,
    markers: { from: null, to: null }
  });

  // Journey mode functions
  const handleJourneyClick = async (lat: number, lng: number) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const result = await response.json();
      
      if (result.success) {
        const location = result.data;
        
        if (journeyState.step === 'from') {
          // Place FROM marker
          const fromMarker = L.marker([lat, lng], { 
            icon: createCustomIcon('start') 
          }).addTo(mapInstanceRef.current!);
          
          setJourneyState({
            step: 'to',
            fromLocation: location,
            toLocation: null,
            markers: { from: fromMarker, to: null }
          });
        } else if (journeyState.step === 'to') {
          // Place TO marker
          const toMarker = L.marker([lat, lng], { 
            icon: createCustomIcon('stop') 
          }).addTo(mapInstanceRef.current!);
          
          setJourneyState(prev => ({
            step: 'complete',
            fromLocation: prev.fromLocation,
            toLocation: location,
            markers: { from: prev.markers.from, to: toMarker }
          }));
        }
      } else {
        console.error('Reverse geocoding failed:', result.error);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptJourney = () => {
    if (journeyState.fromLocation && journeyState.toLocation && onJourneySelect) {
      onJourneySelect(journeyState.fromLocation, journeyState.toLocation);
    }
  };

  const handleRedoJourney = () => {
    // Clear markers
    if (journeyState.markers.from) {
      mapInstanceRef.current?.removeLayer(journeyState.markers.from);
    }
    if (journeyState.markers.to) {
      mapInstanceRef.current?.removeLayer(journeyState.markers.to);
    }
    
    // Reset state
    setJourneyState({
      step: 'from',
      fromLocation: null,
      toLocation: null,
      markers: { from: null, to: null }
    });
  };

  // Fetch user's last location for map centering
  useEffect(() => {
    const fetchLastLocation = async () => {
      try {
        const response = await fetch('/api/user/last-location');
        const result = await response.json();
        
        if (result.success && result.hasLocation) {
          setLastLocation(result.location);
        }
      } catch (error) {
        console.error('Error fetching last location:', error);
      } finally {
        setIsLoadingLastLocation(false);
      }
    };

    fetchLastLocation();
  }, []);

  useEffect(() => {
    // Prevent initialization if the container ref is not set or still loading last location
    if (!mapContainerRef.current || isLoadingLastLocation) {
      return;
    }

    // Initialize the map only if it hasn't been created yet
    if (!mapInstanceRef.current) {
      // Determine initial center and zoom based on last location
      let initialCenter: [number, number] = [20, 0]; // Global view default
      let initialZoom = 2; // Global zoom default
      
      if (lastLocation) {
        initialCenter = [lastLocation.lat, lastLocation.lng];
        // Zoom level 8 shows approximately 100-mile radius
        initialZoom = 8;
      }
      
      mapInstanceRef.current = L.map(mapContainerRef.current).setView(initialCenter, initialZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current);

      // Add click event listener based on mode
      mapInstanceRef.current.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        
        if (mode === 'journey') {
          handleJourneyClick(lat, lng);
        } else {
          // Single location mode (existing behavior)
          setIsLoading(true);
          setLocationInfo(null);

          try {
            const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
            const result = await response.json();
            
            if (result.success) {
              setLocationInfo(result.data);
            } else {
              console.error('Reverse geocoding failed:', result.error);
            }
          } catch (error) {
            console.error('Error fetching location:', error);
          } finally {
            setIsLoading(false);
          }
        }
      });
    }

    // Cleanup function to run when the component unmounts
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onLocationSelect, isLoadingLastLocation, lastLocation, mode, journeyState.step]);

  const closePopup = () => {
    setLocationInfo(null);
  };

  const handleYesClick = () => {
    if (locationInfo && onLocationSelect) {
      onLocationSelect(locationInfo);
    }
    closePopup();
  };

  const handleNoClick = () => {
    closePopup();
  };

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainerRef} 
        style={{ height: '100%', width: '100%', cursor: 'crosshair' }} 
      />
      
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
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000] max-w-sm">
          <p className="text-xs text-muted-foreground">
            Map centered on your last destination:
          </p>
          <p className="text-sm font-medium">
            {lastLocation.city}, {lastLocation.country}
          </p>
        </div>
      )}

      {/* Journey mode instruction banner */}
      {mode === 'journey' && !isLoading && (
        <div className="absolute top-4 left-4 right-4 bg-blue-500 text-white p-4 rounded-lg z-[1000] shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
              {journeyState.step === 'from' ? '1' : journeyState.step === 'to' ? '2' : '✓'}
            </div>
            <div className="flex-1">
              {journeyState.step === 'from' && (
                <p className="font-medium">Click on your departure location</p>
              )}
              {journeyState.step === 'to' && (
                <p className="font-medium">Click on your destination location</p>
              )}
              {journeyState.step === 'complete' && (
                <p className="font-medium">Review your journey and accept or redo</p>
              )}
            </div>
          </div>
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

export default WorldMap; 