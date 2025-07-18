'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { MapPin } from 'lucide-react';
import WorldMap from '@/components/maps/WorldMap';

interface LocationInfo {
  city: string;
  country: string;
  displayName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface JourneyLocationSelectorProps {
  onJourneySelect: (from: LocationInfo, to: LocationInfo) => void;
  triggerText?: string;
  disabled?: boolean;
  className?: string;
}

export function JourneyLocationSelector({ 
  onJourneySelect, 
  triggerText = "Select Journey on Map",
  disabled = false,
  className = ""
}: JourneyLocationSelectorProps) {
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const handleJourneySelect = (from: LocationInfo, to: LocationInfo) => {
    onJourneySelect(from, to);
    setIsMapModalOpen(false);
  };

  return (
    <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={`w-full ${className}`}
          disabled={disabled}
        >
          <MapPin className="mr-2 h-4 w-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Journey Selection</DialogTitle>
          <DialogDescription>
            Select your departure and destination locations on the map. First click will set your departure location, second click will set your destination.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 p-6 pt-2">
          <div className="w-full h-[calc(90vh-120px)]">
            <WorldMap 
              mode="journey" 
              onJourneySelect={handleJourneySelect} 
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}