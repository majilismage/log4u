'use client';

import React, { useEffect, useState } from 'react';
import HistoryEntryCard from '@/components/history/HistoryEntryCard'; // Actual import
import type { JourneyEntry } from '@/types/journey'; // Import shared type

// Placeholder for a loading skeleton or spinner component
const LoadingSkeleton = () => (
  <div className="border border-gray-200 shadow rounded-md p-4 w-full mx-auto my-4">
    <div className="animate-pulse flex space-x-4">
      <div className="rounded-full bg-slate-200 h-10 w-10"></div>
      <div className="flex-1 space-y-6 py-1">
        <div className="h-2 bg-slate-200 rounded"></div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-2 bg-slate-200 rounded col-span-2"></div>
            <div className="h-2 bg-slate-200 rounded col-span-1"></div>
          </div>
          <div className="h-2 bg-slate-200 rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

const HistoryPage = () => {
  const [journeys, setJourneys] = useState<JourneyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Simulate API delay for loading state visualization
        // await new Promise(resolve => setTimeout(resolve, 1500)); 
        const response = await fetch('/api/history');
        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Adjust data access as per actual API response structure e.g. data.journeys or just data if it's an array
        setJourneys(data.journeys || data); 
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred while fetching history data.');
        }
        console.error("Error fetching history:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-slate-800">Journey History</h1>
      </header>

      {isLoading && (
        <div className="space-y-6">
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {!isLoading && !error && journeys.length === 0 && (
        <div className="text-center text-gray-500 py-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-lg font-semibold">No history entries found.</p>
          <p className="text-sm">Looks like you haven't logged any journeys yet!</p>
        </div>
      )}

      {!isLoading && !error && journeys.length > 0 && (
        <div className="space-y-6">
          {journeys.map((journey) => (
            <HistoryEntryCard key={journey.id} journey={journey} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage; 