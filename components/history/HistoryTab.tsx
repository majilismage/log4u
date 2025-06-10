"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { RotateCw, AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import HistoryEntryCard from "@/components/history/HistoryEntryCard"
import type { JourneyEntry, JourneyEntryWithMedia, MediaItem } from "@/types/journey"

// Define the expected structure of the media API response
interface MediaApiResponse {
  mediaByJourneyId: Record<string, MediaItem[]>;
}

export function HistoryTab() {
  const [journeys, setJourneys] = useState<JourneyEntryWithMedia[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    console.log('[HistoryTab] fetchData called');
    setIsLoading(true);
    setError(null);
    try {
      const [historyResponse, mediaResponse] = await Promise.all([
        fetch('/api/history'),
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

      const historyData: JourneyEntry[] = historyResult.data || [];
      const mediaByJourneyId = mediaResult.mediaByJourneyId || {};

      const combinedData: JourneyEntryWithMedia[] = historyData.map(journey => ({
        ...journey,
        media: mediaByJourneyId[journey.id] || []
      }));
      
      setJourneys(combinedData);
      console.log('[HistoryTab] State "journeys" set with combined data:', combinedData);

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
    fetchData();
  }, []);

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
                Successfully loaded {journeys.length} journey entries.
              </p>
              {journeys.map((journey, index) => {
                const uniqueKey = journey.id && journey.id !== "" && journey.id !== "undefined" ? journey.id : `journey-${index}`;
                return <HistoryEntryCard key={uniqueKey} journey={journey} />;
              })}
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