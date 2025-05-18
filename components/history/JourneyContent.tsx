import React from 'react';
import type { JourneyEntry } from '@/types/journey'; // Adjust path if needed

interface JourneyContentProps {
  notes?: JourneyEntry['notes'];
  // In future phases, this could also accept media links:
  // imagesLink?: JourneyEntry['imagesLink']; 
  // videosLink?: JourneyEntry['videosLink'];
  // or a structured mediaItems array
}

const JourneyContent: React.FC<JourneyContentProps> = ({ notes }) => {
  return (
    <div className="p-4 md:p-6 h-full">
      <h3 className="font-semibold text-lg mb-2 text-slate-800 dark:text-neutral-100">Notes</h3>
      {notes && notes.trim() !== '' ? (
        <p className="text-sm text-slate-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{notes}</p>
      ) : (
        <p className="text-sm text-slate-500 dark:text-neutral-400 italic">No notes provided for this journey.</p>
      )}
      {/* Placeholder for EntryMediaGallery in Phase 4 */}
      {/* <EntryMediaGallery journeyId={journey.id} imagesLink={journey.imagesLink} videosLink={journey.videosLink} /> */}
    </div>
  );
};

export default JourneyContent; 