'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { loadWaterGrid, snapToWater, findSeaRoute } from '@/lib/sea-router';

import dynamic from 'next/dynamic';

interface MigrationEntry {
  index: number;
  departureDate: string;
  arrivalDate: string;
  from: string;
  to: string;
  country: string;
  distanceNm: string;
  avgSpeed: string;
  maxSpeed: string;
  notes: string;
  fuel: string;
  fromLat: number;
  fromLng: number;
  fromConfidence: string;
  fromMethod: string;
  toLat: number;
  toLng: number;
  toConfidence: string;
  toMethod: string;
}

interface RouteData {
  index: number;
  from: string;
  to: string;
  route: {
    type: string;
    coordinates: number[][];
  };
}

interface ReviewState {
  imported: Set<number>;
  skipped: Set<number>;
  flagged: Map<number, string>;
}

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="flex-1 bg-gray-100 flex items-center justify-center">Loading map...</div>
});

export default function MigrationReviewPage() {
  const [entries, setEntries] = useState<MigrationEntry[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({
    imported: new Set(),
    skipped: new Set(),
    flagged: new Map(),
  });
  const [editMode, setEditMode] = useState<'none' | 'from' | 'to'>('none');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [flagText, setFlagText] = useState('');
  const [showFlagInput, setShowFlagInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<any>(null);

  const [waterGridReady, setWaterGridReady] = useState(false);
  const routedIndicesRef = useRef<Set<number>>(new Set());

  // Load water grid + data on mount
  useEffect(() => {
    loadWaterGrid().then(() => setWaterGridReady(true)).catch(console.error);
    loadData();
  }, []);

  // When current entry changes, snap endpoints to water and compute sea route if needed
  useEffect(() => {
    if (!waterGridReady || !dataLoaded || entries.length === 0) return;

    // Process current + prev + next
    const indicesToRoute = [currentIndex];
    if (currentIndex > 0) indicesToRoute.push(currentIndex - 1);
    if (currentIndex < entries.length - 1) indicesToRoute.push(currentIndex + 1);

    for (const idx of indicesToRoute) {
      // Skip already-routed entries and confirmed (imported) entries
      if (routedIndicesRef.current.has(idx) || reviewState.imported.has(idx)) continue;
      routedIndicesRef.current.add(idx);

      const entry = entries[idx];
      if (!entry) continue;

      // Snap endpoints to water
      const [snappedFromLat, snappedFromLng] = snapToWater(entry.fromLat, entry.fromLng);
      const [snappedToLat, snappedToLng] = snapToWater(entry.toLat, entry.toLng);

      const coordsChanged = snappedFromLat !== entry.fromLat || snappedFromLng !== entry.fromLng ||
        snappedToLat !== entry.toLat || snappedToLng !== entry.toLng;

      if (coordsChanged) {
        setEntries(prev => {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            fromLat: snappedFromLat,
            fromLng: snappedFromLng,
            toLat: snappedToLat,
            toLng: snappedToLng,
          };
          return updated;
        });
      }

      // Compute sea route via A*
      console.log(`[review] Computing sea route for entry ${idx}: (${snappedFromLat.toFixed(4)}, ${snappedFromLng.toFixed(4)}) → (${snappedToLat.toFixed(4)}, ${snappedToLng.toFixed(4)})`);
      const seaRoute = findSeaRoute(snappedFromLat, snappedFromLng, snappedToLat, snappedToLng);
      console.log(`[review] Sea route result for entry ${idx}: ${seaRoute ? seaRoute.length + ' points' : 'NULL (falling back to straight line)'}`);
      if (seaRoute && seaRoute.length >= 2) {
        setRoutes(prev => {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            route: {
              type: 'LineString',
              coordinates: seaRoute.map(([lat, lng]) => [lng, lat]), // GeoJSON [lng, lat]
            },
          };
          return updated;
        });
      }
    }
  }, [waterGridReady, dataLoaded, currentIndex, entries.length, reviewState.imported]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 's':
          e.preventDefault();
          handleSkip();
          break;
        case 'f':
          e.preventDefault();
          handleFlag();
          break;
        case 'arrowleft':
          e.preventDefault();
          handlePrev();
          break;
        case 'arrowright':
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, entries, reviewState]);

  // Extract town from "Town, State/Region" — everything before last comma
  const extractTown = (location: string): string => {
    const lastCommaIndex = location.lastIndexOf(',');
    if (lastCommaIndex === -1) return location.trim();
    return location.substring(0, lastCommaIndex).trim();
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load migration data
      const [entriesRes, routesRes] = await Promise.all([
        fetch('/migration/resolved-entries.json'),
        fetch('/migration/routes.json')
      ]);

      if (!entriesRes.ok || !routesRes.ok) {
        throw new Error('Failed to load migration data');
      }

      const entriesData = await entriesRes.json();
      const routesData = await routesRes.json();

      setEntries(entriesData);
      setRoutes(routesData);

      // Fetch confirmed entries from Google Sheet + check duplicates in parallel
      const [checkDuplicatesRes, confirmedRes] = await Promise.all([
        fetch('/api/migration/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: entriesData.map((entry: MigrationEntry) => ({
              departureDate: entry.departureDate,
              fromTown: extractTown(entry.from),
              toTown: extractTown(entry.to),
            }))
          })
        }),
        fetch('/api/migration/confirmed-entries')
      ]);

      if (checkDuplicatesRes.ok) {
        const { duplicates: duplicateList } = await checkDuplicatesRes.json();
        setDuplicates(new Set(duplicateList));

        // Build lookup of confirmed entries by key
        let confirmedByKey: Record<string, any> = {};
        if (confirmedRes.ok) {
          const { entries: confirmedEntries } = await confirmedRes.json();
          confirmedEntries.forEach((ce: any) => {
            confirmedByKey[ce.key] = ce;
          });
        }

        // Mark duplicates as imported + overlay confirmed coords
        const importedIndices = new Set<number>();
        const updatedEntries = [...entriesData];
        const updatedRoutes = [...routesData];

        entriesData.forEach((entry: MigrationEntry, index: number) => {
          const key = `${entry.departureDate}|${extractTown(entry.from)}|${extractTown(entry.to)}`;
          if (duplicateList.includes(key)) {
            importedIndices.add(index);

            // Overlay confirmed sheet data (coords may have been edited before approval)
            const confirmed = confirmedByKey[key];
            if (confirmed && confirmed.fromLat && confirmed.toLat) {
              updatedEntries[index] = {
                ...entry,
                fromLat: confirmed.fromLat,
                fromLng: confirmed.fromLng,
                toLat: confirmed.toLat,
                toLng: confirmed.toLng,
              };
              // Update route endpoints to match confirmed coords
              if (updatedRoutes[index]?.route?.coordinates?.length) {
                const coords = [...updatedRoutes[index].route.coordinates];
                coords[0] = [confirmed.fromLng, confirmed.fromLat];
                coords[coords.length - 1] = [confirmed.toLng, confirmed.toLat];
                updatedRoutes[index] = {
                  ...updatedRoutes[index],
                  route: { ...updatedRoutes[index].route, coordinates: coords }
                };
              }
            }
          }
        });

        setEntries(updatedEntries);
        setRoutes(updatedRoutes);

        setReviewState(prev => ({
          ...prev,
          imported: importedIndices
        }));

        // Find first non-imported entry
        const firstAvailable = entriesData.findIndex((_: any, index: number) => 
          !importedIndices.has(index)
        );
        if (firstAvailable !== -1) {
          setCurrentIndex(firstAvailable);
        }
      }

      setLoading(false);
      setDataLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  const getCurrentEntry = () => entries[currentIndex];
  const getCurrentRoute = () => routes[currentIndex];

  const isCurrentEntryDuplicate = () => {
    if (!getCurrentEntry()) return false;
    const entry = getCurrentEntry();
    const key = `${entry.departureDate}|${extractTown(entry.from)}|${extractTown(entry.to)}`;
    return duplicates.has(key);
  };

  const handleApprove = async () => {
    if (saving || !getCurrentEntry() || isCurrentEntryDuplicate()) return;

    setSaving(true);
    try {
      const entry = getCurrentEntry();
      
      const response = await fetch('/api/migration/save-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to save entries');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save entry');
      }

      // Mark as imported and move to next
      setReviewState(prev => ({
        ...prev,
        imported: new Set([...prev.imported, currentIndex])
      }));

      moveToNextAvailable();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve entry');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setReviewState(prev => ({
      ...prev,
      skipped: new Set([...prev.skipped, currentIndex])
    }));
    moveToNextAvailable();
  };

  const handleFlag = () => {
    setShowFlagInput(true);
  };

  const submitFlag = () => {
    if (flagText.trim()) {
      setReviewState(prev => ({
        ...prev,
        flagged: new Map([...prev.flagged, [currentIndex, flagText.trim()]])
      }));
    }
    setFlagText('');
    setShowFlagInput(false);
    moveToNextAvailable();
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditMode('none');
    }
  };

  const handleNext = () => {
    if (currentIndex < entries.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditMode('none');
    }
  };

  const moveToNextAvailable = () => {
    const nextIndex = findNextAvailableIndex(currentIndex);
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex);
    }
    setEditMode('none');
  };

  const findNextAvailableIndex = (fromIndex: number): number => {
    for (let i = fromIndex + 1; i < entries.length; i++) {
      if (!reviewState.imported.has(i)) return i;
    }
    // Wrap around
    for (let i = 0; i <= fromIndex; i++) {
      if (!reviewState.imported.has(i)) return i;
    }
    return -1; // All processed
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (editMode === 'none' || !getCurrentEntry()) return;

    const entry = getCurrentEntry();
    const updatedEntry = { ...entry };

    if (editMode === 'from') {
      updatedEntry.fromLat = lat;
      updatedEntry.fromLng = lng;
    } else if (editMode === 'to') {
      updatedEntry.toLat = lat;
      updatedEntry.toLng = lng;
    }

    const updatedEntries = [...entries];
    updatedEntries[currentIndex] = updatedEntry;
    setEntries(updatedEntries);

    // Update route endpoint to match
    setRoutes(prev => {
      const updated = [...prev];
      const route = updated[currentIndex];
      if (route?.route?.coordinates?.length) {
        const coords = [...route.route.coordinates];
        if (editMode === 'from') {
          coords[0] = [lng, lat];
        } else {
          coords[coords.length - 1] = [lng, lat];
        }
        updated[currentIndex] = { ...route, route: { ...route.route, coordinates: coords } };
      }
      return updated;
    });

    setEditMode('none');
  };

  const handleCoordsChange = useCallback((type: 'from' | 'to', lat: number, lng: number) => {
    setEntries(prev => {
      const updated = [...prev];
      const entry = { ...updated[currentIndex] };
      if (type === 'from') {
        entry.fromLat = lat;
        entry.fromLng = lng;
      } else {
        entry.toLat = lat;
        entry.toLng = lng;
      }
      updated[currentIndex] = entry;
      return updated;
    });
  }, [currentIndex]);

  const handleRouteUpdate = useCallback((index: number, route: { type: string; coordinates: number[][] }) => {
    setRoutes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], route };
      return updated;
    });
  }, []);

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500', 
      red: 'bg-red-500'
    };
    const color = colors[confidence as keyof typeof colors] || 'bg-gray-500';
    return <div className={`w-3 h-3 rounded-full ${color} inline-block mr-2`} />;
  };

  const getProgressCounts = () => {
    const imported = reviewState.imported.size;
    const skipped = reviewState.skipped.size;
    const flagged = reviewState.flagged.size;
    const remaining = entries.length - imported - (duplicates.size - imported);
    return { imported, skipped, flagged, remaining };
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading migration data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const currentEntry = getCurrentEntry();
  const currentRoute = getCurrentRoute();
  const isDuplicate = isCurrentEntryDuplicate();
  const progressCounts = getProgressCounts();

  // 3-route context
  const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const nextEntry = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  return (
    <div className="h-screen flex">
        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent
            entries={entries}
            routes={routes}
            currentIndex={currentIndex}
            reviewState={reviewState}
            editMode={editMode}
            onMapClick={handleMapClick}
            onCoordsChange={handleCoordsChange}
            onRouteUpdate={handleRouteUpdate}
            onEditModeChange={setEditMode}
          />
          
          {/* Edit mode banner */}
          {editMode !== 'none' && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
                Click map to set {editMode === 'from' ? 'From' : 'To'} position
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="w-96 bg-[#1a1a2e] text-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <h1 className="text-xl font-bold">Migration Review</h1>
            <div className="text-sm text-gray-300 mt-1">
              Entry {currentIndex + 1} of {entries.length}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {currentEntry && (
              <>
                {/* Previous entry summary */}
                {prevEntry && (
                  <div className="p-3 border-b border-gray-700 opacity-60">
                    <div className="text-xs text-gray-400">Previous</div>
                    <div className="text-sm">{prevEntry.from} → {prevEntry.to}</div>
                    <div className="text-xs text-gray-500">{prevEntry.departureDate} · {prevEntry.distanceNm} nm</div>
                  </div>
                )}

                {/* Current entry details */}
                <div className="p-3">
                {/* Status + Journey header */}
                <div className="flex items-center gap-2 mb-2">
                  {getConfidenceBadge(isDuplicate ? 'grey' : reviewState.imported.has(currentIndex) ? 'green' : reviewState.skipped.has(currentIndex) ? 'yellow' : reviewState.flagged.has(currentIndex) ? 'red' : currentEntry.fromConfidence)}
                  <span className="font-semibold text-sm">{currentEntry.from} → {currentEntry.to}</span>
                </div>

                {/* Compact info grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-300 mb-2">
                  <div>{currentEntry.departureDate} → {currentEntry.arrivalDate || 'same'}</div>
                  <div>{currentEntry.distanceNm} nm · {currentEntry.country}</div>
                  <div className="text-gray-500">From: {currentEntry.fromLat.toFixed(4)}, {currentEntry.fromLng.toFixed(4)}</div>
                  <div className="text-gray-500">To: {currentEntry.toLat.toFixed(4)}, {currentEntry.toLng.toFixed(4)}</div>
                  <div className="text-gray-500">{getConfidenceBadge(currentEntry.fromConfidence)} {currentEntry.fromMethod}</div>
                  <div className="text-gray-500">{getConfidenceBadge(currentEntry.toConfidence)} {currentEntry.toMethod}</div>
                </div>
                {currentEntry.notes && (
                  <div className="text-xs text-gray-400 mb-2">Notes: {currentEntry.notes}</div>
                )}

                {/* Flag Input */}
                {showFlagInput && (
                  <div className="mb-4">
                    <input
                      type="text"
                      value={flagText}
                      onChange={(e) => setFlagText(e.target.value)}
                      placeholder="Enter flag reason..."
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={submitFlag}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                      >
                        Flag
                      </button>
                      <button
                        onClick={() => {
                          setShowFlagInput(false);
                          setFlagText('');
                        }}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 mb-6">
                  <button
                    onClick={handleApprove}
                    disabled={saving || isDuplicate || reviewState.imported.has(currentIndex)}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded flex items-center justify-center"
                  >
                    {saving ? 'Saving...' : '✅ Approve (A)'}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditMode('from')}
                      className={`flex-1 px-3 py-2 rounded ${
                        editMode === 'from' 
                          ? 'bg-blue-700' 
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      ✏️ Edit From
                    </button>
                    <button
                      onClick={() => setEditMode('to')}
                      className={`flex-1 px-3 py-2 rounded ${
                        editMode === 'to' 
                          ? 'bg-blue-700' 
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      ✏️ Edit To
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSkip}
                      className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
                    >
                      ⏭️ Skip (S)
                    </button>
                    <button
                      onClick={handleFlag}
                      disabled={showFlagInput}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded"
                    >
                      🚩 Flag (F)
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded"
                    >
                      ◀️ Prev (←)
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentIndex >= entries.length - 1}
                      className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded"
                    >
                      ▶️ Next (→)
                    </button>
                  </div>
                </div>

                </div>
                {/* Next entry summary */}
                {nextEntry && (
                  <div className="p-3 border-t border-gray-700 opacity-60">
                    <div className="text-xs text-gray-400">Next</div>
                    <div className="text-sm">{nextEntry.from} → {nextEntry.to}</div>
                    <div className="text-xs text-gray-500">{nextEntry.departureDate} · {nextEntry.distanceNm} nm</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Progress Footer */}
          <div className="p-4 border-t border-gray-700">
            <div className="mb-2">
              <div className="h-2 bg-gray-700 rounded overflow-hidden">
                <div 
                  className="h-full bg-green-500"
                  style={{ width: `${(progressCounts.imported / entries.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-300">
              {progressCounts.imported} imported, {progressCounts.skipped} skipped, {progressCounts.flagged} flagged, {progressCounts.remaining} remaining
            </div>
          </div>
        </div>
    </div>
  );
}