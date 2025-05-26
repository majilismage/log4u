import React from 'react';
import type { JourneyEntry } from '@/types/journey';
import {
  MapPin,
  // ArrowRight, // No longer used
  Ruler,
  Gauge,
  TrendingUp,
  CalendarDays
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns'; // Import date-fns functions
// import MiniMap from './MiniMap'; // Comment out MiniMap import

// Props for JourneyMetadata should accept the fields it needs to display
interface JourneyMetadataProps {
  fromTown: JourneyEntry['fromTown'];
  fromCountry: JourneyEntry['fromCountry'];
  toTown: JourneyEntry['toTown'];
  toCountry: JourneyEntry['toCountry'];
  departureDate: JourneyEntry['departureDate'];
  arrivalDate: JourneyEntry['arrivalDate'];
  distance: JourneyEntry['distance'];
  averageSpeed: JourneyEntry['averageSpeed'];
  maxSpeed: JourneyEntry['maxSpeed'];
  // Add new props for coordinates
  fromLatitude: JourneyEntry['fromLatitude'];
  fromLongitude: JourneyEntry['fromLongitude'];
  toLatitude: JourneyEntry['toLatitude'];
  toLongitude: JourneyEntry['toLongitude'];
}

const iconSize = "h-4 w-4"; // For stats icons
const locationIconSize = "h-5 w-5"; // For location icons

// Helper function to format date strings
const formatDate = (dateString: string): string => {
  if (!dateString || dateString.trim() === "") return 'N/A';
  try {
    // Attempt to parse common date-like patterns first if not strictly ISO
    // This is a basic check; for more robust parsing, a more comprehensive library or strategy might be needed
    // For now, relying on parseISO which is quite flexible for YYYY-MM-DD and other ISO formats.
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, 'MMMM dd, yyyy');
    }
    // If parseISO fails for a non-ISO string that might still be a date, 
    // you might add more parsing attempts here or simply return original.
    return dateString; // Return original if parsing fails or invalid
  } catch (error) {
    // console.warn(`Failed to parse date: ${dateString}`, error); // Optional: for debugging
    return dateString; // Return original on error
  }
};

const JourneyMetadata: React.FC<JourneyMetadataProps> = ({
  fromTown,
  fromCountry,
  toTown,
  toCountry,
  departureDate,
  arrivalDate,
  distance,
  averageSpeed,
  maxSpeed,
  // Destructure new coordinate props
  fromLatitude,
  fromLongitude,
  toLatitude,
  toLongitude,
}) => {
  // Log received coordinate props and their types
  console.log('[JourneyMetadata] Received Props:', {
    fromLatitude,
    fromLongitude,
    toLatitude,
    toLongitude,
    isFromLatNumber: typeof fromLatitude === 'number',
    isFromLngNumber: typeof fromLongitude === 'number',
    isToLatNumber: typeof toLatitude === 'number',
    isToLngNumber: typeof toLongitude === 'number',
  });

  return (
    <div className="bg-slate-100 dark:bg-neutral-800 p-4 md:p-5 text-slate-700 dark:text-neutral-300 h-full">
      {/* NEW From/Arrow/To Structure */}
      <div className="flex items-start justify-between mb-4">

        {/* FROM section */}
        <div className="flex-1 min-w-0 pr-2"> {/* pr-2 for spacing from arrow */}
          <div className="flex items-start">
            <MapPin className={`${locationIconSize} text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5`} /> {/* mt-0.5 for slight visual adjustment */}
            <div className="ml-2 text-left">
              <div className="font-medium text-sm text-slate-800 dark:text-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap md:overflow-visible md:whitespace-normal">
                {fromTown}, {fromCountry}
              </div>
              <div className="text-xs text-slate-500 dark:text-neutral-400">
                {typeof fromLatitude === 'number' && typeof fromLongitude === 'number' ? `Lat: ${fromLatitude.toFixed(4)}, Lng: ${fromLongitude.toFixed(4)}` : 'Coords N/A'}
              </div>
              <div className="flex items-center text-xs text-slate-500 dark:text-neutral-400 mt-1">
                <CalendarDays className="mr-1.5 h-4 w-4 flex-shrink-0" />
                <span>{formatDate(departureDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow SVG */}
        <div className="flex items-center justify-center px-1 md:px-2 flex-shrink-0 pt-1"> {/* pt-1 to vertically center arrow more with first line text */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="w-5 h-5 text-slate-400 dark:text-neutral-500"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
          </svg>
        </div>

        {/* TO section */}
        <div className="flex-1 min-w-0 pl-2"> {/* pl-2 for spacing from arrow */}
          <div className="flex items-start">
            <MapPin className={`${locationIconSize} text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5`} /> {/* mt-0.5 */}
            <div className="ml-2 text-left">
              <div className="font-medium text-sm text-slate-800 dark:text-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap md:overflow-visible md:whitespace-normal">
                {toTown}, {toCountry}
              </div>
              <div className="text-xs text-slate-500 dark:text-neutral-400">
                {typeof toLatitude === 'number' && typeof toLongitude === 'number' ? `Lat: ${toLatitude.toFixed(4)}, Lng: ${toLongitude.toFixed(4)}` : 'Coords N/A'}
              </div>
              <div className="flex items-center text-xs text-slate-500 dark:text-neutral-400 mt-1">
                <CalendarDays className="mr-1.5 h-4 w-4 flex-shrink-0" />
                <span>{formatDate(arrivalDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* END OF NEW From/Arrow/To Structure */}

      {/* MiniMap Integration - Commented out */}
      {((): React.ReactNode => {
        const hasAllCoordinates = 
          typeof fromLatitude === 'number' && typeof fromLongitude === 'number' &&
          typeof toLatitude === 'number' && typeof toLongitude === 'number';
        
        // console.log('[JourneyMetadata] Coordinate Props for MiniMap:', {
        //   fromLatitude, fromLongitude, toLatitude, toLongitude,
        //   isFromLatNumber: typeof fromLatitude === 'number',
        //   isFromLngNumber: typeof fromLongitude === 'number',
        //   isToLatNumber: typeof toLatitude === 'number',
        //   isToLngNumber: typeof toLongitude === 'number',
        //   hasAllCoordinates
        // });

        if (hasAllCoordinates) {
          // return (
          //   <div className="my-3">
          //     <MiniMap 
          //       startLat={fromLatitude!} 
          //       startLng={fromLongitude!} 
          //       endLat={toLatitude!} 
          //       endLng={toLongitude!} 
          //     />
          //   </div>
          // );
        }
        return null;
      })()} {/* Restored closing parenthesis and brace, and comment for MiniMap IIFE */}

      {/* Separator */}
      <hr className="border-slate-200 dark:border-neutral-700 my-3" />

      {/* Stats Row */}
      <div className="flex items-center justify-around text-sm">
        <div className="flex items-center space-x-1.5">
          <Ruler className={`${iconSize} text-slate-500 dark:text-neutral-400 flex-shrink-0`} />
          <span className="text-slate-700 dark:text-neutral-200">{distance}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Gauge className={`${iconSize} text-slate-500 dark:text-neutral-400 flex-shrink-0`} />
          <span className="text-slate-700 dark:text-neutral-200">{averageSpeed}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <TrendingUp className={`${iconSize} text-slate-500 dark:text-neutral-400 flex-shrink-0`} />
          <span className="text-slate-700 dark:text-neutral-200">{maxSpeed}</span>
        </div>
      </div>
    </div>
  );
};

export default JourneyMetadata; 