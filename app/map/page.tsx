'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FilePreview } from "@/components/FilePreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

interface LocationInfo {
  city: string;
  country: string;
  displayName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

// Dynamically import the map component to avoid SSR issues
const WorldMap = dynamic(
  () => import('@/components/maps/WorldMap'),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full">Loading map...</div>
  }
);

export default function MapPage() {
  const [departureDate, setDepartureDate] = useState<Date>(new Date());
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [departureDateOpen, setDepartureDateOpen] = useState(false);
  const [arrivalDateOpen, setArrivalDateOpen] = useState(false);
  const [fromTown, setFromTown] = useState("");
  const [fromCountry, setFromCountry] = useState("");
  const [fromLat, setFromLat] = useState("");
  const [fromLng, setFromLng] = useState("");
  const [toTown, setToTown] = useState("");
  const [toCountry, setToCountry] = useState("");
  const [toLat, setToLat] = useState("");
  const [toLng, setToLng] = useState("");
  const [distance, setDistance] = useState("");
  const [avgSpeed, setAvgSpeed] = useState("");
  const [maxSpeed, setMaxSpeed] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isToMapModalOpen, setIsToMapModalOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocationSelect = (location: LocationInfo) => {
    const newFromLat = location.coordinates.lat.toString();
    const newFromLng = location.coordinates.lng.toString();
    
    setFromTown(location.city);
    setFromCountry(location.country);
    setFromLat(newFromLat);
    setFromLng(newFromLng);
    setIsMapModalOpen(false);
    
    // Calculate distance if to coordinates are available
    updateDistanceIfPossible(newFromLat, newFromLng, toLat, toLng);
  };

  // Haversine formula to calculate distance between two points on Earth
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  const updateDistanceIfPossible = (fromLat: string, fromLng: string, toLat: string, toLng: string) => {
    if (fromLat && fromLng && toLat && toLng) {
      const lat1 = parseFloat(fromLat);
      const lng1 = parseFloat(fromLng);
      const lat2 = parseFloat(toLat);
      const lng2 = parseFloat(toLng);
      
      if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
        const distanceKm = calculateDistance(lat1, lng1, lat2, lng2);
        const distanceNm = distanceKm * 0.539957; // Convert to nautical miles
        setDistance(distanceNm.toFixed(2));
      }
    }
  };

  const handleToLocationSelect = (location: LocationInfo) => {
    const newToLat = location.coordinates.lat.toString();
    const newToLng = location.coordinates.lng.toString();
    
    setToTown(location.city);
    setToCountry(location.country);
    setToLat(newToLat);
    setToLng(newToLng);
    setIsToMapModalOpen(false);
    
    // Calculate distance if from coordinates are available
    updateDistanceIfPossible(fromLat, fromLng, newToLat, newToLng);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted (demo only)');
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex w-full flex-col items-center">
        <div className="w-full max-w-4xl">
          <h1 className="text-2xl font-bold mb-6">Journey Entry Demo (Map Hidden)</h1>
          
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
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="fromTown" className="text-base font-medium">From</Label>
                        <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
                          <DialogTrigger asChild>
                            <button 
                              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
                              onClick={(e) => {
                                e.currentTarget.blur(); // Remove focus from button before opening modal
                                setIsMapModalOpen(true);
                              }}
                            >
                              (use map view)
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0">
                            <DialogHeader className="p-6 pb-2">
                              <DialogTitle>Map View</DialogTitle>
                              <DialogDescription>
                                Interactive world map for visualizing journey locations and routes.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 p-6 pt-2">
                              <div className="w-full h-[calc(90vh-120px)]">
                                <WorldMap onLocationSelect={handleLocationSelect} />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="space-y-2">
                        <Input
                          id="fromTown"
                          value={fromTown}
                          onChange={(e) => setFromTown(e.target.value)}
                          placeholder="Town/City"
                          className="h-12 px-4 text-base"
                        />
                        <Input
                          id="fromCountry"
                          value={fromCountry}
                          onChange={(e) => setFromCountry(e.target.value)}
                          placeholder="Country"
                          className="h-12 px-4 text-base"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="fromLat"
                            value={fromLat}
                            onChange={(e) => setFromLat(e.target.value)}
                            placeholder="Latitude"
                            className="h-12 px-4 text-base"
                            type="number"
                            step="any"
                          />
                          <Input
                            id="fromLng"
                            value={fromLng}
                            onChange={(e) => setFromLng(e.target.value)}
                            placeholder="Longitude"
                            className="h-12 px-4 text-base"
                            type="number"
                            step="any"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="toTown" className="text-base font-medium">To</Label>
                        <Dialog open={isToMapModalOpen} onOpenChange={setIsToMapModalOpen}>
                          <DialogTrigger asChild>
                            <button 
                              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
                              onClick={(e) => {
                                e.currentTarget.blur(); // Remove focus from button before opening modal
                                setIsToMapModalOpen(true);
                              }}
                            >
                              (use map view)
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0">
                            <DialogHeader className="p-6 pb-2">
                              <DialogTitle>Map View - Select Destination</DialogTitle>
                              <DialogDescription>
                                Interactive world map for selecting your destination location.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 p-6 pt-2">
                              <div className="w-full h-[calc(90vh-120px)]">
                                <WorldMap onLocationSelect={handleToLocationSelect} />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="space-y-2">
                        <Input
                          id="toTown"
                          value={toTown}
                          onChange={(e) => setToTown(e.target.value)}
                          placeholder="Town/City"
                          className="h-12 px-4 text-base"
                        />
                        <Input
                          id="toCountry"
                          value={toCountry}
                          onChange={(e) => setToCountry(e.target.value)}
                          placeholder="Country"
                          className="h-12 px-4 text-base"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="toLat"
                            value={toLat}
                            onChange={(e) => setToLat(e.target.value)}
                            placeholder="Latitude"
                            className="h-12 px-4 text-base"
                            type="number"
                            step="any"
                          />
                          <Input
                            id="toLng"
                            value={toLng}
                            onChange={(e) => setToLng(e.target.value)}
                            placeholder="Longitude"
                            className="h-12 px-4 text-base"
                            type="number"
                            step="any"
                          />
                        </div>
                      </div>
                    </div>
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
                    <div>
                      <Input
                        id="distance"
                        type="number"
                        step="0.01"
                        min="0"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        placeholder="Distance (nautical miles) - auto-calculated from coordinates"
                        className="h-12 px-4 text-base"
                      />
                    </div>
                    
                    <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                      <Input
                        id="avgSpeed"
                        type="number"
                        step="0.01"
                        min="0"
                        value={avgSpeed}
                        onChange={(e) => setAvgSpeed(e.target.value)}
                        placeholder="Average speed (knots)"
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
                          <p className="text-sm text-muted-foreground text-center">Images and videos up to 100MB (Demo only)</p>
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
                    Save Journey Entry (Demo Only)
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 