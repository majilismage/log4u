import React from 'react';
import type { JourneyEntry } from '@/types/journey'; // Adjust path if needed
import JourneyMetadata from './JourneyMetadata'; // Import the actual component
import JourneyContent from './JourneyContent'; // Import the actual JourneyContent component

// The JourneyContentProps interface and JourneyContent component definition below should be removed.
// // interface JourneyContentProps {
// //   notes?: string;
// // }
// // const JourneyContent: React.FC<JourneyContentProps> = ({ notes }) => {
// //   return (
// //     <div className="p-4 h-full">
// //       <h3 className="font-semibold text-md mb-2 text-slate-700">Notes</h3>
// //       {notes ? (
// //         <p className="text-sm text-slate-600 whitespace-pre-wrap">{notes}</p>
// //       ) : (
// //         <p className="text-sm text-slate-500 italic">No notes for this journey.</p>
// //       )}
// //       {/* Media gallery will go here in a future phase */}
// //     </div>
// //   );
// // };

interface HistoryEntryCardProps {
  journey: JourneyEntry;
}

const HistoryEntryCard: React.FC<HistoryEntryCardProps> = ({ journey }) => {
  return (
    <div className="bg-white dark:bg-neutral-800 shadow-lg dark:shadow-neutral-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 transition-shadow duration-300 ease-in-out">
      {/* Flex container: column on mobile, row on medium screens and up */}
      <div className="flex flex-col md:flex-row">
        {/* Metadata Section: Takes up defined portion of width on desktop, full width on mobile */}
        {/* On md screens, metadata takes 60% and notes 40% */}
        <div className="w-full md:w-[60%] md:flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-700">
          <JourneyMetadata 
            fromTown={journey.fromTown}
            fromCountry={journey.fromCountry}
            toTown={journey.toTown}
            toCountry={journey.toCountry}
            departureDate={journey.departureDate}
            arrivalDate={journey.arrivalDate}
            distance={journey.distance}
            averageSpeed={journey.averageSpeed}
            maxSpeed={journey.maxSpeed}
          />
        </div>

        {/* Content Section (Notes): Takes remaining space on desktop, full width on mobile */}
        <div className="w-full md:w-[40%]">
          <JourneyContent notes={journey.notes} />
        </div>
      </div>
    </div>
  );
};

export default HistoryEntryCard; 