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

interface WorldMapProps {
  onLocationSelect?: (location: LocationInfo) => void;
}

const WorldMap = ({ onLocationSelect }: WorldMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Prevent initialization if the container ref is not set
    if (!mapContainerRef.current) {
      return;
    }

    // Initialize the map only if it hasn't been created yet
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);

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
  }, [onLocationSelect]);

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
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000]">
          <p className="text-sm">Getting location...</p>
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