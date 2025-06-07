"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { RotateCw, AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import HistoryEntryCard from "@/components/history/HistoryEntryCard"
import type { JourneyEntry } from "@/types/journey"

export function HistoryTab() {
  const [historyJourneys, setHistoryJourneys] = useState<JourneyEntry[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const fetchAndSetHistoryJourneys = async () => {
    console.log('[HistoryTab] fetchAndSetHistoryJourneys called');
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch('/api/history');
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      console.log('[HistoryTab] Raw API response for history (result):', result);

      if (result && result.data && Array.isArray(result.data)) {
        const clientSideJourneys: JourneyEntry[] = result.data.map((j: any) => ({
          id: j.id,
          fromTown: j.fromTown,
          fromCountry: j.fromCountry,
          fromLatitude: j.fromLatitude,
          fromLongitude: j.fromLongitude,
          toTown: j.toTown,
          toCountry: j.toCountry,
          toLatitude: j.toLatitude,
          toLongitude: j.toLongitude,
          departureDate: j.departureDate,
          arrivalDate: j.arrivalDate,
          distance: j.distance,
          averageSpeed: j.averageSpeed,
          maxSpeed: j.maxSpeed,
          notes: j.notes,
          imagesLink: j.imagesLink,
          videosLink: j.videosLink,
          timestamp: j.timestamp,
        }));
        setHistoryJourneys(clientSideJourneys);
        console.log('[HistoryTab] State "historyJourneys" set with:', clientSideJourneys);
      } else {
        console.error("API response did not contain expected data array for history:", result);
        setHistoryJourneys([]);
        setHistoryError('Received unexpected data format from server.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[HistoryTab] Error fetching history:', err);
      setHistoryError(errorMessage);
      setHistoryJourneys([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchAndSetHistoryJourneys();
  }, []);

  return (
    <Card className="dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
      <CardContent className="space-y-4 p-4 md:p-6 min-h-[300px]">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-neutral-100 mb-8">Journey History</h1>
        
        {isHistoryLoading && (
          <div className="flex flex-col items-center justify-center h-full py-10 text-slate-500 dark:text-neutral-400">
            <RotateCw className="h-12 w-12 mb-4 animate-spin text-sky-500 dark:text-sky-400" />
            <p>Loading history...</p>
          </div>
        )}

        {historyError && (
          <div className="flex flex-col items-center justify-center h-full py-10 p-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading History</h2>
            <p className="text-slate-600 dark:text-neutral-400 text-center mb-4">{historyError}</p>
            <Button 
              onClick={fetchAndSetHistoryJourneys} 
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
            >
              <RotateCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}

        {!isHistoryLoading && !historyError && (
          historyJourneys.length > 0 ? (
            <div className="space-y-6">
              <p className="text-lg text-slate-700 dark:text-neutral-300">
                Successfully loaded {historyJourneys.length} journey entries.
              </p>
              {historyJourneys.map((journey, index) => {
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