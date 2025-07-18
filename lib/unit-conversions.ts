import type { SpeedUnit, DistanceUnit, UnitPreferences } from '@/types/units';

/**
 * Convert distance from kilometers to the specified unit
 */
export function convertDistanceFromKm(distanceKm: number, toUnit: DistanceUnit): number {
  switch (toUnit) {
    case 'kilometers':
      return distanceKm;
    case 'miles':
      return distanceKm * 0.621371; // 1 km = 0.621371 miles
    case 'nautical_miles':
      return distanceKm * 0.539957; // 1 km = 0.539957 nautical miles
    default:
      return distanceKm;
  }
}

/**
 * Convert distance from any unit to kilometers (base unit for calculations)
 */
export function convertDistanceToKm(distance: number, fromUnit: DistanceUnit): number {
  switch (fromUnit) {
    case 'kilometers':
      return distance;
    case 'miles':
      return distance / 0.621371; // 1 mile = 1.609344 km
    case 'nautical_miles':
      return distance / 0.539957; // 1 nautical mile = 1.852 km
    default:
      return distance;
  }
}

/**
 * Convert speed from km/h to the specified unit
 */
export function convertSpeedFromKmh(speedKmh: number, toUnit: SpeedUnit): number {
  switch (toUnit) {
    case 'kmh':
      return speedKmh;
    case 'mph':
      return speedKmh * 0.621371; // 1 km/h = 0.621371 mph
    case 'knots':
      return speedKmh * 0.539957; // 1 km/h = 0.539957 knots
    default:
      return speedKmh;
  }
}

/**
 * Convert speed from any unit to km/h (base unit for calculations)
 */
export function convertSpeedToKmh(speed: number, fromUnit: SpeedUnit): number {
  switch (fromUnit) {
    case 'kmh':
      return speed;
    case 'mph':
      return speed / 0.621371; // 1 mph = 1.609344 km/h
    case 'knots':
      return speed / 0.539957; // 1 knot = 1.852 km/h
    default:
      return speed;
  }
}

/**
 * Format distance with appropriate unit label
 */
export function formatDistance(distance: number, unit: DistanceUnit, decimals: number = 2): string {
  const unitLabels = {
    kilometers: 'km',
    miles: 'mi',
    nautical_miles: 'nm'
  };
  
  return `${distance.toFixed(decimals)} ${unitLabels[unit]}`;
}

/**
 * Format speed with appropriate unit label
 */
export function formatSpeed(speed: number, unit: SpeedUnit, decimals: number = 1): string {
  const unitLabels = {
    kmh: 'km/h',
    mph: 'mph',
    knots: 'kn'
  };
  
  return `${speed.toFixed(decimals)} ${unitLabels[unit]}`;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers (base unit)
 */
export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate distance between two points in user's preferred unit
 */
export function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number, 
  unit: DistanceUnit
): number {
  const distanceKm = calculateDistanceKm(lat1, lng1, lat2, lng2);
  return convertDistanceFromKm(distanceKm, unit);
}

/**
 * Convert journey data to user's preferred units
 */
export function convertJourneyToUserUnits(
  journeyData: {
    distance: string;
    averageSpeed: string;
    maxSpeed: string;
  },
  fromUnits: UnitPreferences,
  toUnits: UnitPreferences
) {
  const distance = parseFloat(journeyData.distance);
  const avgSpeed = parseFloat(journeyData.averageSpeed);
  const maxSpeed = parseFloat(journeyData.maxSpeed);

  // Convert distance
  const distanceKm = convertDistanceToKm(distance, fromUnits.distanceUnit);
  const convertedDistance = convertDistanceFromKm(distanceKm, toUnits.distanceUnit);

  // Convert speeds
  const avgSpeedKmh = convertSpeedToKmh(avgSpeed, fromUnits.speedUnit);
  const maxSpeedKmh = convertSpeedToKmh(maxSpeed, fromUnits.speedUnit);
  const convertedAvgSpeed = convertSpeedFromKmh(avgSpeedKmh, toUnits.speedUnit);
  const convertedMaxSpeed = convertSpeedFromKmh(maxSpeedKmh, toUnits.speedUnit);

  return {
    distance: convertedDistance.toFixed(2),
    averageSpeed: convertedAvgSpeed.toFixed(1),
    maxSpeed: convertedMaxSpeed.toFixed(1)
  };
} 