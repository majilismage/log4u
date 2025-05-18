import React from 'react';
import type { JourneyEntry } from '@/types/journey';
import {
  MapPin,
  ArrowRight,
  Ruler,
  Gauge,
  TrendingUp,
  CalendarDays
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns'; // Import date-fns functions

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
}) => {
  return (
    <div className="bg-slate-100 dark:bg-neutral-800 p-4 md:p-5 text-slate-700 dark:text-neutral-300 h-full">
      {/* Locations and Dates Row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2 min-w-0 pr-1"> {/* min-w-0 for text truncation/wrapping */}
          <MapPin className={`${locationIconSize} text-sky-600 dark:text-sky-400 flex-shrink-0`} />
          <span className="font-medium text-sm text-slate-800 dark:text-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap md:overflow-visible md:whitespace-normal">{fromTown}, {fromCountry}</span>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 dark:text-neutral-500 mx-1 md:mx-2 flex-shrink-0" />
        <div className="flex items-center space-x-2 min-w-0 pl-1"> {/* min-w-0 for text truncation/wrapping */}
          <MapPin className={`${locationIconSize} text-red-600 dark:text-red-400 flex-shrink-0`} />
          <span className="font-medium text-sm text-slate-800 dark:text-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap md:overflow-visible md:whitespace-normal">{toTown}, {toCountry}</span>
        </div>
      </div>

      {/* Dates aligned under locations */}
      <div className="flex justify-between text-xs text-slate-500 dark:text-neutral-400 mb-3">
        <div className="flex items-center space-x-1 pl-7"> 
          <CalendarDays className="h-3 w-3 flex-shrink-0" />
          <span>{formatDate(departureDate)}</span>
        </div>
        <div className="flex items-center space-x-1 pr-1 md:pr-7"> {/* Adjusted padding for To date */}
          <CalendarDays className="h-3 w-3 flex-shrink-0" />
          <span>{formatDate(arrivalDate)}</span>
        </div>
      </div>

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