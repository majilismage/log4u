// Entry type discriminator
export type EntryType = 'journey' | 'event';

export interface JourneyEntry {
  entryType: 'journey';
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
}

export interface EventEntry {
  entryType: 'event';
  id: string;
  date: string;          // Single date for the event
  title: string;         // e.g., "Engine Service", "Oil Change"
  notes?: string;
  // Optional single location
  town?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Discriminated union of all entry types
export type Entry = JourneyEntry | EventEntry;

export interface MediaItem {
  id: string;
  name: string;
  thumbnailLink: string;
  webViewLink: string;
  mimeType: string;
  journeyId: string;
  createdTime: string;
}

export interface JourneyEntryWithMedia extends JourneyEntry {
  media: MediaItem[];
}

export interface EventEntryWithMedia extends EventEntry {
  media: MediaItem[];
}

// Union type for any entry with media
export type EntryWithMedia = JourneyEntryWithMedia | EventEntryWithMedia;

// Type guard functions
export function isJourneyEntry(entry: Entry): entry is JourneyEntry {
  return entry.entryType === 'journey';
}

export function isEventEntry(entry: Entry): entry is EventEntry {
  return entry.entryType === 'event';
} 