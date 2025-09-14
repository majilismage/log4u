"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { RotateCw, AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import HistoryEntryCard from "@/components/history/HistoryEntryCard"
import type { JourneyEntry, JourneyEntryWithMedia, MediaItem } from "@/types/journey"
import { useUnits } from "@/lib/UnitsContext"
import { DEFAULT_UNIT_PREFERENCES } from "@/types/units"
import { convertJourneyToUserUnits } from "@/lib/unit-conversions"

// Define the expected structure of the media API response
interface MediaApiResponse {
  mediaByJourneyId: Record<string, MediaItem[]>;
}

export function HistoryTab() {
  const [journeys, setJourneys] = useState<JourneyEntryWithMedia[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { unitPreferences } = useUnits()
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10
  const [total, setTotal] = useState(0)

  const fetchData = async (pageIndex: number) => {
    console.log('[HistoryTab] fetchData called');
    setIsLoading(true);
    setError(null);
    try {
      const offset = pageIndex * PAGE_SIZE
      const [historyResponse, mediaResponse] = await Promise.all([
        fetch(`/api/history?offset=${offset}&limit=${PAGE_SIZE}`),
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
      const historyData: JourneyEntry[] = rawHistoryData.map((j: any) => {
        // Convert journey data from stored units (default) to user's preferred units
        const convertedData = convertJourneyToUserUnits(
          {
            distance: String(j.distance || '0'),
            averageSpeed: String(j.averageSpeed || '0'),
            maxSpeed: String(j.maxSpeed || '0'),
          },
          DEFAULT_UNIT_PREFERENCES, // Data stored in default units
          unitPreferences // User's preferred units
        );

        return {
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
      });
      console.log('[HistoryTab] Mapped and converted history data:', historyData);

      const mediaByJourneyId = mediaResult.mediaByJourneyId || {};
      console.log('[HistoryTab] Media grouped by Journey ID from API:', mediaByJourneyId);

      const combinedData: JourneyEntryWithMedia[] = historyData.map(journey => ({
        ...journey,
        media: mediaByJourneyId[journey.id] || []
      }));

      setJourneys(combinedData);
      console.log('[HistoryTab] State "journeys" set with combined data (server-sorted by departureDate desc):', combinedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[HistoryTab] Error fetching data:', err);
      setError(errorMessage);
      setJourneys([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page);
  }, [unitPreferences, page]);

  return (
    <Card className="dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
      <CardContent className="space-y-4 p-4 md:p-6 min-h-[300px]">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-neutral-100 mb-8">Journey History</h1>
        
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
              onClick={fetchData} 
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
            >
              <RotateCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          journeys.length > 0 ? (
            <div className="space-y-6">
              <p className="text-lg text-slate-700 dark:text-neutral-300">
                Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + journeys.length} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
              {journeys.map((journey, index) => {
                const uniqueKey = journey.id && journey.id !== "" && journey.id !== "undefined" ? journey.id : `journey-${index}`;
                return (
                  <HistoryEntryCard 
                    key={uniqueKey} 
                    journey={journey}
                    isEditable={true}
                    onUpdate={(updates) => {
                      // Update local state optimistically
                      setJourneys(prev => prev.map(j => 
                        j.id === journey.id ? { ...j, ...updates } : j
                      ))
                    }}
                    onError={(error) => {
                      console.error('Error updating journey:', error)
                      setError(error) // Use existing error state
                    }}
                    onDelete={(journeyId) => {
                      setJourneys(prev => prev.filter(j => j.id !== journeyId))
                      setTotal(t => Math.max(0, t - 1))
                      // If page becomes empty and not first page, move back a page
                      if (journeys.length === 1 && page > 0) {
                        setPage(p => p - 1)
                      } else {
                        // Refresh current page to keep counts accurate
                        fetchData(page)
                      }
                    }}
                  />
                );
              })}
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-10 p-4">
              <Info className="w-16 h-16 text-slate-500 mb-4" />
              <h2 className="text-xl font-semibold text-slate-700 dark:text-neutral-300 mb-2">No History Entries</h2>
              <p className="text-slate-600 dark:text-neutral-400">There are no journey entries recorded yet.</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
} 
