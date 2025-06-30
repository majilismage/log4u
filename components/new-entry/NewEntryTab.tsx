"use client"

import type React from "react"
import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { useLoading } from "@/lib/LoadingContext"
import { FilePreview } from "@/components/FilePreview"
import { LocationAutocomplete } from "@/components/ui/location-autocomplete"
import type { JourneyEntry } from "@/types/journey"

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

export function NewEntryTab() {
  const [departureDate, setDepartureDate] = useState<Date>(new Date())
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date())
  const [departureDateOpen, setDepartureDateOpen] = useState(false)
  const [arrivalDateOpen, setArrivalDateOpen] = useState(false)
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

    console.log('CLIENT-UPLOAD: Starting file upload process', {
      journeyId,
      journeyIdType: typeof journeyId,
      journeyIdLength: journeyId.length,
      journeyIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journeyId) ? 'UUID' :
        /^J\d+$/.test(journeyId) ? 'J+timestamp' :
        'other',
      fileCount: selectedFiles.length,
      fileTypes: selectedFiles.map(f => f.type),
      fileSizes: selectedFiles.map(f => f.size),
      timestamp: Date.now()
    });

    let imageFolderUrl: string | undefined;
    let videoFolderUrl: string | undefined;
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;

    const uploadPromises = selectedFiles.map(async (file) => {
      console.log('CLIENT-UPLOAD: Preparing to upload file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        journeyIdForThisFile: journeyId,
        timestamp: Date.now()
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('journeyId', journeyId);
      formData.append('town', toTown);
      formData.append('country', toCountry);
      formData.append('journeyDate', arrivalDate.toISOString());

      console.log('CLIENT-UPLOAD: FormData created with journey ID:', {
        fileName: file.name,
        journeyIdAppended: journeyId,
        formDataJourneyId: formData.get('journeyId'),
        timestamp: Date.now()
      });

      try {
        console.log('CLIENT-UPLOAD: Sending upload request for:', file.name);
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
    setLoading(true, 'Saving your travel entry...');

    try {
      // 1. Save the core journey details to get the official journeyId
      const entryToSave = {
        departureDate: format(departureDate, "yyyy-MM-dd"),
        arrivalDate: format(arrivalDate, "yyyy-MM-dd"),
        fromTown, fromCountry,
        fromLat: parseFloat(fromLat), fromLng: parseFloat(fromLng),
        toTown, toCountry,
        toLat: parseFloat(toLat), toLng: parseFloat(toLng),
        distance, avgSpeed, maxSpeed,
        notes,
      };

      console.log('CLIENT: About to save entry to get journey ID', { timestamp: Date.now() });
      const saveResponse = await fetch('/api/save-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryToSave),
      });

      const saveResult = await saveResponse.json();
      if (!saveResult.success || !saveResult.journeyId) {
        throw new Error(saveResult.error || 'Failed to save entry and get a journey ID.');
      }
      
      const officialJourneyId = saveResult.journeyId;
      console.log('CLIENT: Successfully saved entry, received official Journey ID:', {
        officialJourneyId,
        journeyIdType: typeof officialJourneyId,
        journeyIdLength: officialJourneyId.length,
        journeyIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(officialJourneyId) ? 'UUID' :
          /^J\d+$/.test(officialJourneyId) ? 'J+timestamp' :
          'other',
        timestamp: Date.now()
      });

      // 2. If there are files, upload them using the official journeyId
      if (selectedFiles.length > 0) {
        setLoading(true, `Uploading ${selectedFiles.length} media file(s)...`);
        console.log('CLIENT: About to upload files with journey ID:', {
          journeyIdToUse: officialJourneyId,
          fileCount: selectedFiles.length,
          timestamp: Date.now()
        });
        // Note: The uploadFiles function is now fire-and-forget in the background
        // as the main record is already saved. We don't need the folder links back.
        await uploadFiles(officialJourneyId);
      }

      // 3. Reset form state on successful submission
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
      // TODO: Show a user-friendly error message in the UI
      setLoading(false, 'An error occurred. Please try again.');
    } finally {
      // Set a success message and turn off loading state
      setLoading(false, 'Entry saved successfully!');
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Journey Dates Section */}
          <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Dates</h3>
            </div>
            
            <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="departureDate" className="text-base font-medium">Departure Date</Label>
                <Popover open={departureDateOpen} onOpenChange={setDepartureDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-12 px-4 text-base",
                        !departureDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-3 h-5 w-5" />
                      {departureDate ? format(departureDate, "PPP") : <span>Pick departure date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={departureDate}
                      onSelect={(date) => {
                        if (date) {
                          setDepartureDate(date)
                          setDepartureDateOpen(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="arrivalDate" className="text-base font-medium">Arrival Date</Label>
                <Popover open={arrivalDateOpen} onOpenChange={setArrivalDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-12 px-4 text-base",
                        !arrivalDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-3 h-5 w-5" />
                      {arrivalDate ? format(arrivalDate, "PPP") : <span>Pick arrival date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={arrivalDate}
                      onSelect={(date) => {
                        if (date) {
                          setArrivalDate(date)
                          setArrivalDateOpen(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Journey Route Section */}
          <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Route</h3>
            </div>
            
            <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
              <LocationAutocomplete
                label="From"
                cityValue={fromTown}
                countryValue={fromCountry}
                latValue={fromLat}
                lngValue={fromLng}
                onCityChange={setFromTown}
                onCountryChange={setFromCountry}
                onLatChange={setFromLat}
                onLngChange={setFromLng}
                placeholder="Town/City"
                required
                className="space-y-3"
              />

              <LocationAutocomplete
                label="To"
                cityValue={toTown}
                countryValue={toCountry}
                latValue={toLat}
                lngValue={toLng}
                onCityChange={setToTown}
                onCountryChange={setToCountry}
                onLatChange={setToLat}
                onLngChange={setToLng}
                placeholder="Town/City"
                required
                className="space-y-3"
              />
            </div>
          </div>

          {/* Journey Telemetry Section */}
          <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-green-50 dark:bg-green-950 rounded-lg">
                <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Telemetry</h3>
            </div>
            
            <div className="space-y-4">
              {/* Distance - full width on mobile */}
              <div>
                <Input
                  id="distance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="Distance"
                  required
                  className="h-12 px-4 text-base"
                />
              </div>
              
              {/* Speed inputs - stack on mobile, side by side on larger screens */}
              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                <Input
                  id="avgSpeed"
                  type="number"
                  step="0.01"
                  min="0"
                  value={avgSpeed}
                  onChange={(e) => setAvgSpeed(e.target.value)}
                  placeholder="Average speed (knots)"
                  required
                  className="h-12 px-4 text-base"
                />

                <Input
                  id="maxSpeed"
                  type="number"
                  step="0.01"
                  min="0"
                  value={maxSpeed}
                  onChange={(e) => setMaxSpeed(e.target.value)}
                  placeholder="Maximum speed (knots)"
                  required
                  className="h-12 px-4 text-base"
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Notes</h3>
            </div>
            
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your travel notes here..."
              className="min-h-[120px] p-4 text-base resize-none"
            />
          </div>

          {/* Media Upload Section */}
          <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Media</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center w-full">
                <label
                  htmlFor="media"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors touch-manipulation"
                >
                  <div className="flex flex-col items-center justify-center py-6 px-4">
                    <svg className="w-10 h-10 mb-4 text-muted-foreground" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-base text-muted-foreground text-center">
                      <span className="font-semibold">Tap to upload</span> or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground text-center">Images and videos up to 100MB</p>
                  </div>
                  <Input
                    id="media"
                    type="file"
                    accept="image/*, video/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="pt-2">
                  <FilePreview
                    files={selectedFiles}
                    onRemove={removeFile}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button type="submit" className="w-full h-12 text-base font-semibold">
              Save Journey Entry
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
} 