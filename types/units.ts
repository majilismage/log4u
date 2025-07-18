export type SpeedUnit = 'knots' | 'mph' | 'kmh';
export type DistanceUnit = 'miles' | 'nautical_miles' | 'kilometers';

export interface UnitPreferences {
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  mapZoomDistance?: number; // Distance in kilometers for map zoom (converted for display)
}

export interface UnitConfig {
  speed: {
    unit: SpeedUnit;
    label: string;
    symbol: string;
  };
  distance: {
    unit: DistanceUnit;
    label: string;
    symbol: string;
  };
}

export const SPEED_UNITS: Record<SpeedUnit, { label: string; symbol: string }> = {
  knots: { label: 'Knots', symbol: 'kn' },
  mph: { label: 'Miles per hour', symbol: 'mph' },
  kmh: { label: 'Kilometers per hour', symbol: 'km/h' }
};

export const DISTANCE_UNITS: Record<DistanceUnit, { label: string; symbol: string }> = {
  miles: { label: 'Miles', symbol: 'mi' },
  nautical_miles: { label: 'Nautical miles', symbol: 'nm' },
  kilometers: { label: 'Kilometers', symbol: 'km' }
};

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  speedUnit: 'knots',
  distanceUnit: 'nautical_miles',
  mapZoomDistance: 100 // Default 100km zoom distance
}; 