'use client';

import { useEffect, useRef, useState } from 'react';
import L, { Map } from 'leaflet';
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

interface WorldMapProps {
  onLocationSelect?: (location: LocationInfo) => void;
}

const WorldMap = ({ onLocationSelect }: WorldMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [isLoadingLastLocation, setIsLoadingLastLocation] = useState(true);

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

      // Add click event listener
      mapInstanceRef.current.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        
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
      });
    }

    // Cleanup function to run when the component unmounts
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onLocationSelect, isLoadingLastLocation, lastLocation]);

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
      
      {/* Last location info */}
      {lastLocation && !isLoadingLastLocation && !isLoading && !locationInfo && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000] max-w-sm">
          <p className="text-xs text-muted-foreground">
            Map centered on your last destination:
          </p>
          <p className="text-sm font-medium">
            {lastLocation.city}, {lastLocation.country}
          </p>
        </div>
      )}

      {/* Location popup */}
      {locationInfo && (
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