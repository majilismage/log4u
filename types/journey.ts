export interface JourneyEntry {
  id: string;
  fromTown: string;
  fromCountry: string;
  toTown: string;
  toCountry: string;
  departureDate: string; // Keep as string for now, formatting can occur in component or be pre-formatted
  arrivalDate: string;   // Keep as string for now
  distance: string;      // e.g., "100 km"
  averageSpeed: string;  // e.g., "50 km/h"
  maxSpeed: string;      // e.g., "80 km/h"
  notes?: string;
  // Coordinates for the journey start and end points
  fromLatitude?: number;
  fromLongitude?: number;
  toLatitude?: number;
  toLongitude?: number;
  // Optional fields for future phases, not used in Phase 1 UI directly by these components yet
  // startLat?: number;
  // startLng?: number;
  // endLat?: number;
  // endLng?: number;
  // mediaItems?: Array<{ 
  //   id: string; 
  //   thumbnailUrl: string; 
  //   webViewLink: string; 
  //   mimeType: string; 
  // }>;
}

export interface MediaItem {
  id: string;
  name: string;
  thumbnailLink: string;
  webViewLink: string;
  mimeType: string;
  journeyId: string;
}

export interface JourneyEntryWithMedia extends JourneyEntry {
  media: MediaItem[];
} 