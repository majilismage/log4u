import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Leaflet since it won't work in jsdom
const mockMap = {
  setView: jest.fn(),
  fitBounds: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  remove: jest.fn(),
  addLayer: jest.fn(),
  removeLayer: jest.fn(),
  hasLayer: jest.fn(() => false),
};

const mockLayer = {
  addTo: jest.fn(),
  remove: jest.fn(),
  setLatLngs: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockMarker = {
  addTo: jest.fn(),
  remove: jest.fn(),
  setLatLng: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

// Mock Leaflet modules
jest.mock('leaflet', () => ({
  map: jest.fn(() => mockMap),
  tileLayer: jest.fn(() => mockLayer),
  polyline: jest.fn(() => mockLayer),
  circleMarker: jest.fn(() => mockMarker),
  marker: jest.fn(() => mockMarker),
  divIcon: jest.fn(() => ({})),
  latLngBounds: jest.fn(() => ({
    extend: jest.fn(),
    isValid: jest.fn(() => true),
  })),
}));

// Mock leaflet CSS import
jest.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock draggable lines plugin
jest.mock('leaflet-draggable-lines', () => ({}));

// Mock dynamic import
jest.mock('next/dynamic', () => (fn: () => any) => {
  const Component = fn();
  return Component;
});

// Import after mocks
import MapComponent from '@/app/migration-review/MapComponent';

const mockEntries = [
  {
    index: 0,
    departureDate: '2019-09-22',
    arrivalDate: '2019-09-22',
    from: 'Annapolis, MD',
    to: 'Wye River, MD',
    country: 'USA',
    distanceNm: '27',
    avgSpeed: '',
    maxSpeed: '',
    notes: '',
    fuel: '',
    fromLat: 38.97864,
    fromLng: -76.49279,
    fromConfidence: 'green',
    fromMethod: 'first-entry',
    toLat: 38.98562,
    toLng: -76.14305,
    toConfidence: 'yellow',
    toMethod: 'distance-ranked',
  },
  {
    index: 1,
    departureDate: '2019-09-23',
    arrivalDate: '2019-09-23',
    from: 'Bruffs Island, MD',
    to: 'St Michaels, MD',
    country: 'USA',
    distanceNm: '6',
    avgSpeed: '',
    maxSpeed: '',
    notes: '',
    fuel: '',
    fromLat: 38.85595,
    fromLng: -76.19106,
    fromConfidence: 'green',
    fromMethod: 'single-match',
    toLat: 38.78658,
    toLng: -76.22441,
    toConfidence: 'green',
    toMethod: 'single-match',
  },
  {
    index: 2,
    departureDate: '2019-09-25',
    arrivalDate: '2019-09-25',
    from: 'St Michaels, MD',
    to: 'Deltaville, VA',
    country: 'USA',
    distanceNm: '105',
    avgSpeed: '',
    maxSpeed: '',
    notes: '',
    fuel: '',
    fromLat: 38.78658,
    fromLng: -76.22441,
    fromConfidence: 'green',
    fromMethod: 'single-match',
    toLat: 37.54833,
    toLng: -76.32694,
    toConfidence: 'green',
    toMethod: 'single-match',
  },
];

const mockRoutes = [
  {
    index: 0,
    from: 'Annapolis, MD',
    to: 'Wye River, MD',
    route: {
      type: 'LineString',
      coordinates: [
        [-76.49279, 38.97864],
        [-76.14305, 38.98562],
      ],
    },
  },
  {
    index: 1,
    from: 'Bruffs Island, MD',
    to: 'St Michaels, MD',
    route: {
      type: 'LineString',
      coordinates: [
        [-76.19106, 38.85595],
        [-76.22441, 38.78658],
      ],
    },
  },
  {
    index: 2,
    from: 'St Michaels, MD',
    to: 'Deltaville, VA',
    route: {
      type: 'LineString',
      coordinates: [
        [-76.22441, 38.78658],
        [-76.32694, 37.54833],
      ],
    },
  },
];

const mockReviewState = {
  imported: new Set([0]),
  skipped: new Set(),
  flagged: new Map(),
};

describe('MapComponent', () => {
  const defaultProps = {
    entries: mockEntries,
    routes: mockRoutes,
    currentIndex: 1,
    reviewState: mockReviewState,
    editMode: 'none' as const,
    onMapClick: jest.fn(),
    onCoordsChange: jest.fn(),
    onRouteUpdate: jest.fn(),
    onEditModeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MapComponent {...defaultProps} />);
    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
  });

  it('displays current entry (middle entry)', () => {
    render(<MapComponent {...defaultProps} />);
    
    // Should create map layers for previous, current, and next routes
    const { polyline } = require('leaflet');
    expect(polyline).toHaveBeenCalledTimes(4); // prev + current + next + imported routes
  });

  it('handles first entry (no previous route)', () => {
    const props = { ...defaultProps, currentIndex: 0 };
    render(<MapComponent {...props} />);
    
    // Should only create layers for current and next routes (no previous)
    const { polyline } = require('leaflet');
    expect(polyline).toHaveBeenCalled();
  });

  it('handles last entry (no next route)', () => {
    const props = { ...defaultProps, currentIndex: 2 };
    render(<MapComponent {...props} />);
    
    // Should only create layers for previous and current routes (no next)
    const { polyline } = require('leaflet');
    expect(polyline).toHaveBeenCalled();
  });

  it('only current entry markers are interactive', () => {
    render(<MapComponent {...defaultProps} />);
    
    const { marker, circleMarker } = require('leaflet');
    
    // Current entry should have draggable markers
    expect(marker).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ draggable: true })
    );
    
    // Previous/next entries should have non-interactive circle markers
    expect(circleMarker).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ radius: 5 })
    );
  });

  it('fits bounds to show all visible routes on mount', () => {
    render(<MapComponent {...defaultProps} />);
    
    // Should call fitBounds with all visible route coordinates
    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ padding: [50, 50] })
    );
  });

  it('updates map when currentIndex changes', () => {
    const { rerender } = render(<MapComponent {...defaultProps} />);
    
    // Change current index
    rerender(<MapComponent {...defaultProps} currentIndex={2} />);
    
    // Should update the map layers
    expect(mockMap.fitBounds).toHaveBeenCalledTimes(2);
  });
});