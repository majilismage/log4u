"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight, ImageIcon, Upload } from "lucide-react"
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
  const [images, setImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showAllImages, setShowAllImages] = useState(false)
  const { setLoading, setProgress } = useLoading()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log('Starting file upload process', {
        fileCount: e.target.files.length,
        fileTypes: Array.from(e.target.files).map(f => f.type),
        fileSizes: Array.from(e.target.files).map(f => f.size)
      });
      
      setLoading(true, 'Uploading media files...');
      
      // Generate journey ID if not already set
      const currentJourneyId = journeyId || Date.now().toString();
      console.log('Journey ID for upload:', currentJourneyId);
      
      if (!journeyId) {
        setJourneyId(currentJourneyId);
      }

      const uploadedFiles = Array.from(e.target.files);
      const totalFiles = uploadedFiles.length;
      let completedFiles = 0;

      const uploadPromises = uploadedFiles.map(async (file) => {
        console.log('Preparing to upload file:', {
          name: file.name,
          type: file.type,
          size: file.size
        });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('journeyId', currentJourneyId);
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
            progress: progress
          });
          setProgress(progress);

          return {
            url: result.webViewLink,
            fileId: result.fileId,
            name: file.name,
          };
        } catch (error) {
          console.error('Error uploading file:', file.name, error);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((result): result is { url: string; fileId: string; name: string } => result !== null);
      
      console.log('Upload process completed', {
        totalFiles,
        successfulUploads: successfulUploads.length,
        failedUploads: totalFiles - successfulUploads.length
      });
      
      if (successfulUploads.length > 0) {
        setImages(prev => [...prev, ...successfulUploads.map(upload => upload.url)]);
      }

      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files and return the folder link (for images or videos)
  const uploadFiles = async (journeyId: string): Promise<string | undefined> => {
    if (selectedFiles.length === 0) return undefined;

    console.log('Starting file upload process', {
      fileCount: selectedFiles.length,
      fileTypes: selectedFiles.map(f => f.type),
      fileSizes: selectedFiles.map(f => f.size)
    });

    let folderLink: string | undefined = undefined;
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
          progress: progress
        });
        setProgress(progress);

        // Save the folder link from the first successful upload
        if (!folderLink && result.folderLink) {
          folderLink = result.folderLink;
          console.log('Captured folder link:', folderLink);
        }

        return result.webViewLink;
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        return null;
      }
    });

    await Promise.all(uploadPromises);

    console.log('Upload process completed', {
      totalFiles,
      folderLink
    });

    return folderLink;
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
      let folderLink: string | undefined = undefined;

      // First upload any files and get the folder link
      if (selectedFiles.length > 0) {
        setLoading(true, 'Uploading media files...');
        folderLink = await uploadFiles(currentJourneyId);
      }

      // Then save the entry with the folder link as the imageLinks value
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
        imageLinks: folderLink || undefined,
      };

      console.log('Saving entry with data:', {
        journeyId: currentJourneyId,
        imageFolderLink: entry.imageLinks
      });

      console.log('About to save entry:', entry, typeof entry.imageLinks, entry.imageLinks);

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
        images: folderLink ? [folderLink] : [],
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
      setImages([]);
      setSelectedFiles([]);

    } catch (error) {
      console.error('Error processing entry:', error);
      // Here you might want to show an error message to the user
    } finally {
      setLoading(false);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1))
  }

  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1))
  }

  // Group entries by month and year
  const groupedEntries = entries.reduce(
    (groups, entry) => {
      const dateKey = format(entry.departureDate, "MMMM yyyy")
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(entry)
      return groups
    },
    {} as Record<string, TravelEntry[]>,
  )

  // Get recent images (last 10)
  const recentImages = entries.flatMap((entry) => entry.images).slice(0, 10)

  const handleGenerateData = () => {
    const mockData = generateMockJourneyData();
    setDepartureDate(new Date(mockData.departureDate));
    setArrivalDate(new Date(mockData.arrivalDate));
    setJourneyId(mockData.journeyId);
    setFromTown(mockData.fromTown);
    setFromCountry(mockData.fromCountry);
    setFromLat(mockData.fromLat.toString());
    setFromLng(mockData.fromLng.toString());
    setToTown(mockData.toTown);
    setToCountry(mockData.toCountry);
    setToLat(mockData.toLat.toString());
    setToLng(mockData.toLng.toString());
    setDistance(mockData.distance);
    setAvgSpeed(mockData.avgSpeed);
    setMaxSpeed(mockData.maxSpeed);
    setNotes(mockData.notes);
  };

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

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="form">New Entry</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-6">
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
                  <Label htmlFor="images">Images</Label>
                  <Input
                    id="images"
                    type="file"
                    accept="image/*"
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
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Recent Images</h3>
                  <Button variant="ghost" onClick={() => setShowAllImages(!showAllImages)}>
                    {showAllImages ? "Show Recent" : "Show All"}
                  </Button>
                </div>

                {(showAllImages ? entries.flatMap((entry) => entry.images) : recentImages).length > 0 ? (
                  <div className="relative">
                    <div className="overflow-hidden rounded-md aspect-video bg-muted">
                      {(showAllImages ? entries.flatMap((entry) => entry.images) : recentImages).length > 0 && (
                        <img
                          src={
                            (showAllImages ? entries.flatMap((entry) => entry.images) : recentImages)[currentImageIndex]
                          }
                          alt="Travel photo"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {(showAllImages ? entries.flatMap((entry) => entry.images) : recentImages).length > 1 && (
                      <div className="absolute inset-0 flex items-center justify-between p-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={prevImage}
                          className="rounded-full bg-background/80 backdrop-blur-sm"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={nextImage}
                          className="rounded-full bg-background/80 backdrop-blur-sm"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] bg-muted rounded-md">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No images uploaded yet</p>
                  </div>
                )}

                {(showAllImages ? entries.flatMap((entry) => entry.images) : recentImages).length > 0 && (
                  <div className="flex overflow-x-auto gap-2 py-2">
                    {(showAllImages ? entries.flatMap((entry) => entry.images) : recentImages).map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={cn(
                          "flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2",
                          currentImageIndex === index ? "border-primary" : "border-transparent",
                        )}
                      >
                        <img
                          src={img || "/placeholder.svg"}
                          alt={`Thumbnail ${index}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {entries.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                  {Object.entries(groupedEntries).map(([monthYear, monthEntries]) => (
                    <div key={monthYear} className="mb-6">
                      <h3 className="text-lg font-medium mb-2">{monthYear}</h3>
                      <div className="space-y-4">
                        {monthEntries.map((entry) => (
                          <div key={entry.id} className="p-4 border rounded-md">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium">
                                  {entry.from} → {entry.to}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {format(entry.departureDate, "MMM d, yyyy")} -{" "}
                                  {format(entry.arrivalDate, "MMM d, yyyy")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm">{entry.distance} miles</p>
                                <p className="text-sm text-muted-foreground">
                                  Avg: {entry.avgSpeed} knots • Max: {entry.maxSpeed} knots
                                </p>
                              </div>
                            </div>

                            {entry.notes && (
                              <>
                                <Separator className="my-2" />
                                <p className="text-sm">{entry.notes}</p>
                              </>
                            )}

                            {entry.images.length > 0 && (
                              <div className="mt-2 flex gap-2 overflow-x-auto py-2">
                                {entry.images.map((img, index) => (
                                  <div key={index} className="flex-shrink-0 w-16 h-16 rounded overflow-hidden">
                                    <img
                                      src={img || "/placeholder.svg"}
                                      alt={`Entry image ${index}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px]">
                  <p className="text-muted-foreground">No travel entries yet</p>
                  <Button variant="link" onClick={() => (document.querySelector('[data-value="form"]') as HTMLElement)?.click()}>
                    Create your first entry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
