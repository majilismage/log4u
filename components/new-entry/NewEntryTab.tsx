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

  return (
    <Card>
      <CardContent className="p-6">
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
            <div className="flex flex-col items-center justify-center w-full">
              <label
                htmlFor="media"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-4 text-muted-foreground" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                  </svg>
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">Images and videos up to 100MB</p>
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
  )
} 