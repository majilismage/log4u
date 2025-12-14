"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { RotateCw, AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import HistoryEntryCard from "@/components/history/HistoryEntryCard"
import EventEntryCard from "@/components/history/EventEntryCard"
import { EntryFilterToggle, type EntryFilter } from "@/components/history/EntryFilterToggle"
import type { JourneyEntry, JourneyEntryWithMedia, EventEntry, EventEntryWithMedia, MediaItem, EntryWithMedia, isJourneyEntry, isEventEntry } from "@/types/journey"
import { useUnits } from "@/lib/UnitsContext"
import { DEFAULT_UNIT_PREFERENCES } from "@/types/units"
import { convertJourneyToUserUnits } from "@/lib/unit-conversions"

// Define the expected structure of the media API response
interface MediaApiResponse {
  mediaByJourneyId: Record<string, MediaItem[]>;
}

export function HistoryTab() {
  const [entries, setEntries] = useState<EntryWithMedia[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { unitPreferences } = useUnits()
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10
  const [total, setTotal] = useState(0)
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all')

  const fetchData = async (pageIndex: number, filter: EntryFilter = 'all') => {
    console.log('[HistoryTab] fetchData called', { pageIndex, filter });
    setIsLoading(true);
    setError(null);
    try {
      const offset = pageIndex * PAGE_SIZE
      const filterParam = filter !== 'all' ? `&type=${filter}` : ''
      const [historyResponse, mediaResponse] = await Promise.all([
        fetch(`/api/history?offset=${offset}&limit=${PAGE_SIZE}${filterParam}`),
        fetch('/api/get-media')
      ]);

      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch history: ${historyResponse.status} ${historyResponse.statusText}`);
      }
      if (!mediaResponse.ok) {
        throw new Error(`Failed to fetch media: ${mediaResponse.status} ${mediaResponse.statusText}`);
      }
      
      const historyResult = await historyResponse.json();
      const mediaResult: MediaApiResponse = await mediaResponse.json();

      console.log('[HistoryTab] Raw API response for history:', historyResult);
      console.log('[HistoryTab] Raw API response for media:', mediaResult);

      const rawHistoryData = historyResult.data || [];
      const totalCount = historyResult.totalCount ?? rawHistoryData.length
      setTotal(totalCount)

      // Map raw data to appropriate entry types
      const historyData = rawHistoryData.map((j: any) => {
        const entryType = j.entryType || 'journey';

        if (entryType === 'event') {
          // Map to EventEntry
          return {
            entryType: 'event' as const,
            id: j.journeyId,
            date: j.date || j.departureDate, // Events use date field (mapped from departureDate)
            title: j.title || 'Untitled Event',
            town: j.town || j.fromTown,
            country: j.country || j.fromCountry,
            latitude: j.latitude ?? j.fromLat,
            longitude: j.longitude ?? j.fromLng,
            notes: j.notes,
          };
        } else {
          // Map to JourneyEntry with unit conversion
          const convertedData = convertJourneyToUserUnits(
            {
              distance: String(j.distance || '0'),
              averageSpeed: String(j.averageSpeed || '0'),
              maxSpeed: String(j.maxSpeed || '0'),
            },
            DEFAULT_UNIT_PREFERENCES,
            unitPreferences
          );

          return {
            entryType: 'journey' as const,
            id: j.journeyId,
            fromTown: j.fromTown,
            fromCountry: j.fromCountry,
            toTown: j.toTown,
            toCountry: j.toCountry,
            departureDate: j.departureDate,
            arrivalDate: j.arrivalDate,
            distance: convertedData.distance,
            averageSpeed: convertedData.averageSpeed,
            maxSpeed: convertedData.maxSpeed,
            notes: j.notes,
            fromLatitude: j.fromLat,
            fromLongitude: j.fromLng,
            toLatitude: j.toLat,
            toLongitude: j.toLng,
          };
        }
      });
      console.log('[HistoryTab] Mapped and converted history data:', historyData);

      const mediaByJourneyId = mediaResult.mediaByJourneyId || {};
      console.log('[HistoryTab] Media grouped by Entry ID from API:', mediaByJourneyId);

      // Combine entries with their media
      const combinedData: EntryWithMedia[] = historyData.map((entry: any) => ({
        ...entry,
        media: mediaByJourneyId[entry.id] || []
      }));

      setEntries(combinedData);
      console.log('[HistoryTab] State "entries" set with combined data:', combinedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[HistoryTab] Error fetching data:', err);
      setError(errorMessage);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to page 0 when filter changes
  const handleFilterChange = (newFilter: EntryFilter) => {
    setEntryFilter(newFilter);
    setPage(0);
  };

  useEffect(() => {
    fetchData(page, entryFilter);
  }, [unitPreferences, page, entryFilter]);

  return (
    <Card className="dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
      <CardContent className="space-y-4 p-4 md:p-6 min-h-[300px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-neutral-100">History</h1>
          <EntryFilterToggle value={entryFilter} onChange={handleFilterChange} disabled={isLoading} />
        </div>
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full py-10 text-slate-500 dark:text-neutral-400">
            <RotateCw className="h-12 w-12 mb-4 animate-spin text-sky-500 dark:text-sky-400" />
            <p>Loading history and media...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full py-10 p-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading Data</h2>
            <p className="text-slate-600 dark:text-neutral-400 text-center mb-4">{error}</p>
            <Button
              onClick={() => fetchData(page, entryFilter)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
            >
              <RotateCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          entries.length > 0 ? (
            <div className="space-y-6">
              <p className="text-lg text-slate-700 dark:text-neutral-300">
                Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + entries.length} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
              {entries.map((entry, index) => {
                const uniqueKey = entry.id && entry.id !== "" && entry.id !== "undefined" ? entry.id : `entry-${index}`;

                if (entry.entryType === 'event') {
                  // Render EventEntryCard for events
                  return (
                    <EventEntryCard
                      key={uniqueKey}
                      event={entry as EventEntryWithMedia}
                      isEditable={true}
                      onUpdate={(updatedEvent) => {
                        setEntries(prev => prev.map(e =>
                          e.id === entry.id ? { ...e, ...updatedEvent } as EventEntryWithMedia : e
                        ))
                      }}
                      onError={(error) => {
                        console.error('Error updating event:', error)
                        setError(error)
                      }}
                      onDelete={(eventId) => {
                        setEntries(prev => prev.filter(e => e.id !== eventId))
                        setTotal(t => Math.max(0, t - 1))
                        if (entries.length === 1 && page > 0) {
                          setPage(p => p - 1)
                        } else {
                          fetchData(page, entryFilter)
                        }
                      }}
                    />
                  );
                } else {
                  // Render HistoryEntryCard for journeys
                  return (
                    <HistoryEntryCard
                      key={uniqueKey}
                      journey={entry as JourneyEntryWithMedia}
                      isEditable={true}
                      onUpdate={(updates) => {
                        setEntries(prev => prev.map(e =>
                          e.id === entry.id ? { ...e, ...updates } as JourneyEntryWithMedia : e
                        ))
                      }}
                      onError={(error) => {
                        console.error('Error updating journey:', error)
                        setError(error)
                      }}
                      onDelete={(journeyId) => {
                        setEntries(prev => prev.filter(e => e.id !== journeyId))
                        setTotal(t => Math.max(0, t - 1))
                        if (entries.length === 1 && page > 0) {
                          setPage(p => p - 1)
                        } else {
                          fetchData(page, entryFilter)
                        }
                      }}
                    />
                  );
                }
              })}
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-10 p-4">
              <Info className="w-16 h-16 text-slate-500 mb-4" />
              <h2 className="text-xl font-semibold text-slate-700 dark:text-neutral-300 mb-2">No Entries Found</h2>
              <p className="text-slate-600 dark:text-neutral-400">
                {entryFilter === 'all'
                  ? "There are no entries recorded yet."
                  : entryFilter === 'journey'
                    ? "There are no journey entries recorded yet."
                    : "There are no event entries recorded yet."}
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
} 
