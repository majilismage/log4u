import React from 'react';
import type { JourneyEntryWithMedia, MediaItem } from '@/types/journey'; // Adjust path if needed
import JourneyMetadata from './JourneyMetadata'; // Import the actual component
import JourneyContent from './JourneyContent'; // Import the actual JourneyContent component

const PlayIcon = () => (
  <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
  </svg>
);

const JourneyMediaGrid: React.FC<{ media: MediaItem[] }> = ({ media }) => (
  <div className="p-4 border-t border-slate-200 dark:border-neutral-700">
    <h3 className="font-semibold text-md mb-3 text-slate-800 dark:text-neutral-200">Media Gallery</h3>
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {media.map((item) => {
        const thumbnailUrl = item.thumbnailLink 
          ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/thumbnail-proxy?url=${encodeURIComponent(item.thumbnailLink)}` 
          : 'https://via.placeholder.com/150?text=No+Thumbnail';
        
        return (
          <div key={item.id} className="aspect-square relative group bg-slate-100 dark:bg-neutral-700 rounded-md overflow-hidden">
            <img
              src={thumbnailUrl}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = 'https://via.placeholder.com/150?text=Error';
                target.onerror = null; // Prevent infinite loop if placeholder also fails
              }}
            />
            {item.mimeType.startsWith('video/') && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <PlayIcon />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

interface HistoryEntryCardProps {
  journey: JourneyEntryWithMedia;
}

const HistoryEntryCard: React.FC<HistoryEntryCardProps> = ({ journey }) => {
  return (
    <div className="bg-white dark:bg-neutral-800 shadow-lg dark:shadow-neutral-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 transition-shadow duration-300 ease-in-out">
      <div className="flex flex-col"> {/* Main container is now always a column */}
        {/* Top section with metadata and notes */}
        <div className="flex flex-col md:flex-row">
          {/* Metadata Section */}
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
              fromLatitude={journey.fromLatitude}
              fromLongitude={journey.fromLongitude}
              toLatitude={journey.toLatitude}
              toLongitude={journey.toLongitude}
            />
          </div>

          {/* Content Section (Notes) */}
          <div className="w-full md:w-[40%]">
            <JourneyContent notes={journey.notes} />
          </div>
        </div>

        {/* Media Grid Section - rendered conditionally */}
        {journey.media && journey.media.length > 0 && (
          <JourneyMediaGrid media={journey.media} />
        )}
      </div>
    </div>
  );
};

export default HistoryEntryCard; 