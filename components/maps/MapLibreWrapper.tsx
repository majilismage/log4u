'use client';

import dynamic from 'next/dynamic';
import type { JourneyState } from './MapLibreMap';

interface LocationInfo {
  city: string;
  country: string;
  displayName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface MapLibreWrapperProps {
  onLocationSelect?: (location: LocationInfo) => void;
  mode?: 'single' | 'journey';
  onJourneySelect?: (from: LocationInfo, to: LocationInfo) => void;
  onJourneyStateChange?: (state: JourneyState) => void;
}

// Dynamic import with no SSR and proper loading state
const MapLibreMap = dynamic(() => import('./MapLibreMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Loading map...</p>
      </div>
    </div>
  )
});

export default function MapLibreWrapper(props: MapLibreWrapperProps) {
  return <MapLibreMap {...props} />;
}

export type { JourneyState };