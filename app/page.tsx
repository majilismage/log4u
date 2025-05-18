"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { generateMockJourneyData } from "@/lib/mockDataGenerator"
import { useLoading } from "@/lib/LoadingContext"
import { FilePreview } from "@/components/FilePreview"
import { MediaGallery } from "@/components/MediaGallery"
import HistoryEntryCard from "@/components/history/HistoryEntryCard"
import type { JourneyEntry } from "@/types/journey"

interface TravelLogEntryFromSheet {
  [key: string]: any; // Define a more specific type based on your sheet columns if possible
}

interface TravelEntry {
  id: string
  departureDate: Date
  arrivalDate: Date
  from: string
  to: string
  distance: number
  avgSpeed: number
  maxSpeed: number
  notes: string
  images: string[]
}

// Transformation function
const transformSheetEntryToJourneyEntry = (sheetEntry: TravelLogEntryFromSheet): JourneyEntry => {
  // Prefer specific 'journeyId' if available, then 'Journey ID', then fallbacks
  const id = sheetEntry["journeyId"] || sheetEntry["Journey ID"] || sheetEntry["id"] || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Helper to safely convert to string, providing a default if null/undefined
  const safeString = (value: any, defaultValue = ""): string => {
    return value !== null && value !== undefined ? String(value) : defaultValue;
  };

  return {
    id: safeString(id),
    fromTown: safeString(sheetEntry["From Town"] || sheetEntry["fromTown"]), // Check for common variations
    fromCountry: safeString(sheetEntry["From Country"] || sheetEntry["fromCountry"]),
    toTown: safeString(sheetEntry["To Town"] || sheetEntry["toTown"]),
    toCountry: safeString(sheetEntry["To Country"] || sheetEntry["toCountry"]),
    departureDate: safeString(sheetEntry["Departure Date"] || sheetEntry["departureDate"]), // Dates as strings
    arrivalDate: safeString(sheetEntry["Arrival Date"] || sheetEntry["arrivalDate"]),
    distance: safeString(sheetEntry["Distance"] || sheetEntry["distance"]), 
    averageSpeed: safeString(sheetEntry["Average Speed"] || sheetEntry["averageSpeed"]),
    maxSpeed: safeString(sheetEntry["Max Speed"] || sheetEntry["maxSpeed"]),
    notes: safeString(sheetEntry["Notes"] || sheetEntry["notes"]), 
  };
};

export default function TravelLog() {
  const [departureDate, setDepartureDate] = useState<Date>(new Date())
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date())
  const [journeyId, setJourneyId] = useState<string>("")
  const [fromTown, setFromTown] = useState("")
  const [fromCountry, setFromCountry] = useState("")
  const [fromLat, setFromLat] = useState("")
  const [fromLng, setFromLng] = useState("")
  const [toTown, setToTown] = useState("")
  const [toCountry, setToCountry] = useState("")
  const [toLat, setToLat] = useState("")
  const [toLng, setToLng] = useState("")
  const [distance, setDistance] = useState("")
  const [avgSpeed, setAvgSpeed] = useState("")
  const [maxSpeed, setMaxSpeed] = useState("")
  const [notes, setNotes] = useState("")
  const [entries, setEntries] = useState<TravelEntry[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const { setLoading, setProgress } = useLoading()

  // State for History tab
  const [activeTab, setActiveTab] = useState("new-entry")
  const [historyData, setHistoryData] = useState<TravelLogEntryFromSheet[]>([])
  const [historyRecordCount, setHistoryRecordCount] = useState<number>(0)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files and return the folder links (for images and videos)
  const uploadFiles = async (journeyId: string): Promise<{ imageFolderUrl?: string; videoFolderUrl?: string }> => {
    if (selectedFiles.length === 0) return {};

    console.log('Starting file upload process', {
      fileCount: selectedFiles.length,
      fileTypes: selectedFiles.map(f => f.type),
      fileSizes: selectedFiles.map(f => f.size)
    });

    let imageFolderUrl: string | undefined;
    let videoFolderUrl: string | undefined;
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;

    const uploadPromises = selectedFiles.map(async (file) => {
      console.log('Preparing to upload file:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('journeyId', journeyId);
      formData.append('town', toTown);
      formData.append('country', toCountry);
      formData.append('journeyDate', arrivalDate.toISOString());

      try {
        console.log('Sending upload request for:', file.name);
        const response = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          console.error('Upload failed for file:', file.name, result.error);
          throw new Error(result.error || 'Failed to upload file');
        }

        completedFiles++;
        const progress = (completedFiles / totalFiles) * 100;
        console.log('Upload progress:', {
          file: file.name,
          completed: completedFiles,
          total: totalFiles,
          progress: progress,
          mediaType: result.mediaType,
          folderLink: result.folderLink
        });
        setProgress(progress);

        // Save the folder links based on media type, preserving existing links
        if (result.mediaType === 'image' && result.folderLink) {
          imageFolderUrl = result.folderLink;
        } else if (result.mediaType === 'video' && result.folderLink) {
          videoFolderUrl = result.folderLink;
        }

        return {
          url: result.webViewLink,
          fileId: result.fileId,
          name: file.name,
          type: result.mediaType
        };
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);

    console.log('Upload process completed', {
      totalFiles,
      successfulUploads: results.filter(r => r !== null).length,
      imageFolderUrl,
      videoFolderUrl
    });

    return {
      imageFolderUrl,
      videoFolderUrl
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true, 'Processing your entry...');

    // Generate journey ID if not already set
    const currentJourneyId = journeyId || `J${Date.now()}`;
    if (!journeyId) {
      setJourneyId(currentJourneyId);
    }

    try {
      let imageFolderLink: string | undefined = undefined;
      let videoFolderLink: string | undefined = undefined;

      // First upload any files and get the folder links
      if (selectedFiles.length > 0) {
        setLoading(true, 'Uploading media files...');
        const { imageFolderUrl, videoFolderUrl } = await uploadFiles(currentJourneyId);
        imageFolderLink = imageFolderUrl;
        videoFolderLink = videoFolderUrl;
      }

      // Then save the entry with the folder links
      setLoading(true, 'Saving travel entry...');
      
      const entry = {
        journeyId: currentJourneyId,
        departureDate: format(departureDate, "yyyy-MM-dd"),
        arrivalDate: format(arrivalDate, "yyyy-MM-dd"),
        fromTown,
        fromCountry,
        fromLat: parseFloat(fromLat),
        fromLng: parseFloat(fromLng),
        toTown,
        toCountry,
        toLat: parseFloat(toLat),
        toLng: parseFloat(toLng),
        distance,
        avgSpeed,
        maxSpeed,
        notes,
        imageLinks: imageFolderLink || undefined,
        videoLinks: videoFolderLink || undefined,
      };

      console.log('Saving entry with data:', {
        journeyId: currentJourneyId,
        imageFolderLink: entry.imageLinks,
        videoFolderLink: entry.videoLinks
      });

      const response = await fetch('/api/save-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save entry');
      }

      // Add to local state only if save was successful
      const newEntry: TravelEntry = {
        id: currentJourneyId,
        departureDate,
        arrivalDate,
        from: `${fromTown}, ${fromCountry}`,
        to: `${toTown}, ${toCountry}`,
        distance: Number.parseFloat(distance),
        avgSpeed: Number.parseFloat(avgSpeed),
        maxSpeed: Number.parseFloat(maxSpeed),
        notes,
        images: imageFolderLink ? [imageFolderLink] : [],
      };

      setEntries([newEntry, ...entries]);

      // Reset form
      setJourneyId("");
      setFromTown("");
      setFromCountry("");
      setFromLat("");
      setFromLng("");
      setToTown("");
      setToCountry("");
      setToLat("");
      setToLng("");
      setDistance("");
      setAvgSpeed("");
      setMaxSpeed("");
      setNotes("");
      setSelectedFiles([]);

    } catch (error) {
      console.error('Error processing entry:', error);
      // Here you might want to show an error message to the user
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateData = () => {
    const mockData = generateMockJourneyData();
    setDepartureDate(mockData.departureDate ? new Date(mockData.departureDate) : new Date());
    setArrivalDate(mockData.arrivalDate ? new Date(mockData.arrivalDate) : new Date());
    setJourneyId(mockData.journeyId || `J${Date.now()}`);
    setFromTown(mockData.fromTown || "");
    setFromCountry(mockData.fromCountry || "");
    setFromLat(mockData.fromLat?.toString() || "");
    setFromLng(mockData.fromLng?.toString() || "");
    setToTown(mockData.toTown || "");
    setToCountry(mockData.toCountry || "");
    setToLat(mockData.toLat?.toString() || "");
    setToLng(mockData.toLng?.toString() || "");
    setDistance(mockData.distance?.toString() || "");
    setAvgSpeed(mockData.avgSpeed?.toString() || "");
    setMaxSpeed(mockData.maxSpeed?.toString() || "");
    setNotes(mockData.notes || "");
  };

  // Function to fetch history data
  const fetchHistoryData = async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch('/api/history');
      const result = await response.json();
      if (result.success) {
        setHistoryData(result.data);
        setHistoryRecordCount(result.recordCount);
      } else {
        setHistoryError(result.error || 'Failed to fetch history data.');
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'An unknown error occurred.');
    }
    setIsHistoryLoading(false);
  };

  // Effect to load history data when history tab is active
  useEffect(() => {
    if (activeTab === "history") {
      fetchHistoryData();
    }
  }, [activeTab]);

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-center flex-grow">Travel Log</h1>
        {process.env.NODE_ENV === 'development' && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleGenerateData}
            className="absolute top-4 right-4"
          >
            Generate Data
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new-entry">New Entry</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new-entry" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departureDate">Departure Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !departureDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {departureDate ? format(departureDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={departureDate}
                          onSelect={(date) => date && setDepartureDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="arrivalDate">Arrival Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !arrivalDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {arrivalDate ? format(arrivalDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={arrivalDate}
                          onSelect={(date) => date && setArrivalDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from">From</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="fromTown"
                        value={fromTown}
                        onChange={(e) => setFromTown(e.target.value)}
                        placeholder="Town/City"
                        required
                      />
                      <Input
                        id="fromCountry"
                        value={fromCountry}
                        onChange={(e) => setFromCountry(e.target.value)}
                        placeholder="Country"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="fromLat"
                        type="number"
                        step="any"
                        value={fromLat}
                        onChange={(e) => setFromLat(e.target.value)}
                        placeholder="Latitude"
                        required
                      />
                      <Input
                        id="fromLng"
                        type="number"
                        step="any"
                        value={fromLng}
                        onChange={(e) => setFromLng(e.target.value)}
                        placeholder="Longitude"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="to">To</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="toTown"
                        value={toTown}
                        onChange={(e) => setToTown(e.target.value)}
                        placeholder="Town/City"
                        required
                      />
                      <Input
                        id="toCountry"
                        value={toCountry}
                        onChange={(e) => setToCountry(e.target.value)}
                        placeholder="Country"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="toLat"
                        type="number"
                        step="any"
                        value={toLat}
                        onChange={(e) => setToLat(e.target.value)}
                        placeholder="Latitude"
                        required
                      />
                      <Input
                        id="toLng"
                        type="number"
                        step="any"
                        value={toLng}
                        onChange={(e) => setToLng(e.target.value)}
                        placeholder="Longitude"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="distance">Distance</Label>
                      <Input
                        id="distance"
                        type="number"
                        step="0.01"
                        min="0"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        placeholder="Distance"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avgSpeed">Avg Speed (knots)</Label>
                      <Input
                        id="avgSpeed"
                        type="number"
                        step="0.01"
                        min="0"
                        value={avgSpeed}
                        onChange={(e) => setAvgSpeed(e.target.value)}
                        placeholder="Avg speed"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxSpeed">Max Speed (knots)</Label>
                      <Input
                        id="maxSpeed"
                        type="number"
                        step="0.01"
                        min="0"
                        value={maxSpeed}
                        onChange={(e) => setMaxSpeed(e.target.value)}
                        placeholder="Max speed"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your travel notes here"
                    className="min-h-[120px]"
                  />
                </div>

                <div className="space-y-4">
                  <Label htmlFor="media">Upload Media (Images & Videos)</Label>
                  <Input
                    id="media"
                    type="file"
                    accept="image/*, video/*"
                    multiple
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                  {selectedFiles.length > 0 && (
                    <FilePreview
                      files={selectedFiles}
                      onRemove={removeFile}
                    />
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Save Entry
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gallery" className="mt-6">
          <MediaGallery />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
            <CardContent className="space-y-4 p-4 md:p-6 min-h-[300px]">
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-neutral-100">Travel History</h2>
              
              {isHistoryLoading && (
                <div className="flex flex-col items-center justify-center h-full py-10 text-slate-500 dark:text-neutral-400">
                  <Loader2 className="h-12 w-12 mb-4 animate-spin text-sky-500 dark:text-sky-400" />
                  <p>Loading history...</p>
                </div>
              )}
              {historyError && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-md" role="alert">
                  <strong className="font-bold">Error:</strong>
                  <span className="block sm:inline"> {historyError}</span>
                </div>
              )}

              {!isHistoryLoading && !historyError && (
                historyData.length > 0 ? (
                  <div className="space-y-6">
                    {historyData.map((entry, index) => {
                      const journey = transformSheetEntryToJourneyEntry(entry);
                      const uniqueKey = journey.id && journey.id !== "" && journey.id !== "undefined" ? journey.id : `journey-${index}`;
                      return <HistoryEntryCard key={uniqueKey} journey={journey} />;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M3.75 3h16.5M3.75 12h16.5m-16.5 3.75h16.5M3.75 6.75h16.5m-16.5 9.75h16.5" /> 
                    </svg>
                    <p className="mt-2 text-lg font-semibold text-slate-600 dark:text-neutral-300">No history records found.</p>
                    <p className="text-sm text-slate-500 dark:text-neutral-400">Looks like you haven't logged any journeys yet or there was an issue fetching them.</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
