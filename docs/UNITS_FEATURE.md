# Units Preferences Feature

This document provides a comprehensive overview of the new units preferences feature in WanderNote.

## Overview

The units preferences feature allows users to customize how distances and speeds are displayed throughout the application. Users can choose their preferred units for:

- **Speed**: Knots, Miles per hour (mph), or Kilometers per hour (km/h)
- **Distance**: Miles, Nautical miles, or Kilometers

## Features

### ✨ What's New

- **Personal Unit Preferences**: Each user can set their own preferred units
- **Real-time Conversion**: Automatic distance calculation in user's preferred units
- **Retroactive Display**: Historical data is converted and displayed in current preferred units
- **Seamless UI Integration**: Unit labels are displayed throughout the interface
- **Persistent Settings**: Preferences are saved to the database and preserved across sessions

### 🎯 User Experience Improvements

- **Clear Unit Labels**: All distance and speed values show their units (e.g., "15.2 nm", "25.5 kn")
- **Settings Integration**: Units preferences are accessible via the Settings page
- **Preview**: Real-time preview of how units will be displayed
- **Auto-calculation**: Distance is automatically calculated in the user's preferred units
- **Form Labels**: Input fields clearly indicate the expected units

## Technical Implementation

### Database Schema

New columns added to `user_google_config` table:
```sql
"speedUnit" VARCHAR(10) DEFAULT 'knots'
"distanceUnit" VARCHAR(20) DEFAULT 'nautical_miles'
```

### API Endpoints

- `GET /api/user/unit-preferences` - Retrieve user's unit preferences
- `POST /api/user/unit-preferences` - Update user's unit preferences

### React Context

The `UnitsContext` provides:
- Current unit preferences
- Unit configuration (labels, symbols)
- Methods to update preferences
- Loading states

### Key Components

1. **UnitsSettings** (`components/settings/UnitsSettings.tsx`)
   - Radio button interface for unit selection
   - Save/reset functionality
   - Preview of unit formatting

2. **Unit Conversion Utilities** (`lib/unit-conversions.ts`)
   - Conversion functions between all supported units
   - Distance calculation using Haversine formula
   - Formatting utilities with unit labels

3. **Updated Form Components**
   - NewEntryTab: Shows unit labels on inputs, calculates in user's preferred units
   - HistoryTab: Converts historical data to user's preferred units
   - JourneyMetadata: Displays distance/speed with appropriate unit labels

## Installation & Setup

### 1. Database Migration

Run the SQL migration to add unit preference support:

```bash
psql -d your_database -f database/migrations/add-unit-preferences.sql
```

### 2. No Additional Dependencies

The feature uses existing dependencies and doesn't require any new packages.

### 3. Environment Variables

No new environment variables are required.

## Usage Guide

### For Users

1. **Accessing Settings**
   - Navigate to Settings page from the dashboard
   - Scroll to "Units Preferences" section

2. **Changing Units**
   - Select preferred speed unit (Knots, MPH, or KM/H)
   - Select preferred distance unit (Miles, Nautical Miles, or Kilometers)
   - Click "Save Changes"

3. **Using the App**
   - New journey entries will use your preferred units
   - Distance is auto-calculated in your preferred units
   - Historical data is displayed in your current preferred units
   - All units are clearly labeled throughout the interface

### For Developers

#### Accessing Unit Preferences

```tsx
import { useUnits } from '@/lib/UnitsContext';

function MyComponent() {
  const { unitPreferences, unitConfig } = useUnits();
  
  // Current preferences
  console.log(unitPreferences.speedUnit); // 'knots' | 'mph' | 'kmh'
  console.log(unitPreferences.distanceUnit); // 'miles' | 'nautical_miles' | 'kilometers'
  
  // Formatted labels and symbols
  console.log(unitConfig.speed.label); // "Knots"
  console.log(unitConfig.speed.symbol); // "kn"
}
```

#### Converting Units

```tsx
import { 
  calculateDistance, 
  convertDistanceFromKm, 
  formatDistance 
} from '@/lib/unit-conversions';

// Calculate distance in user's preferred unit
const distance = calculateDistance(lat1, lng1, lat2, lng2, userDistanceUnit);

// Convert between units
const distanceInMiles = convertDistanceFromKm(100, 'miles'); // 62.14

// Format with unit label
const formatted = formatDistance(15.2, 'nautical_miles'); // "15.20 nm"
```

#### Updating Preferences

```tsx
const { updateUnitPreferences } = useUnits();

// Update speed unit only
await updateUnitPreferences({ speedUnit: 'mph' });

// Update both units
await updateUnitPreferences({ 
  speedUnit: 'kmh', 
  distanceUnit: 'kilometers' 
});
```

## Data Flow

1. **User sets preferences** in Settings page
2. **Preferences saved** to database via API
3. **Context updated** throughout app
4. **New entries** use preferred units for calculations
5. **Historical data** converted on display
6. **UI shows** appropriate unit labels

## Backward Compatibility

- **Existing data**: Historical journey data remains unchanged in the database
- **Default units**: New users default to nautical miles and knots (original behavior)
- **Display conversion**: Historical data is converted for display only, not modified in storage
- **API compatibility**: Existing API endpoints continue to work unchanged

## Performance Considerations

- **Client-side conversion**: Unit conversions happen in the browser for optimal performance
- **Caching**: Unit preferences are cached in React context
- **Minimal API calls**: Preferences are loaded once and updated only when changed
- **Database indexing**: Optional index on unit columns for faster queries

## Future Enhancements

Potential future improvements:
- Additional units (feet, meters, etc.)
- Temperature units for weather data
- Fuel consumption units
- Custom unit combinations
- Bulk conversion tools for existing data

## Testing

The feature has been designed with testing in mind:
- Pure conversion functions for easy unit testing
- React context with clear state management
- API endpoints with proper validation
- Error handling throughout the stack

## Support

For issues or questions regarding the units feature:
1. Check the console for any error messages
2. Verify database migration was run successfully
3. Ensure unit preferences API endpoints are accessible
4. Check that the UnitsProvider is properly wrapped around the app 