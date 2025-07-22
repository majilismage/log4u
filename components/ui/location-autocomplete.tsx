import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import MapLibreWrapper, { type JourneyState } from '@/components/maps/MapLibreWrapper';
import type { LocationSuggestion } from '@/types/location';

interface LocationInfo {
  city: string;
  country: string;
  displayName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface LocationAutocompleteProps {
  label: string;
  cityValue: string;
  countryValue: string;
  latValue: string;
  lngValue: string;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onLocationSelect?: (location: LocationSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  showMapButton?: boolean;
  mapButtonText?: string;
  // Journey mode props
  enableJourneyMode?: boolean;
  siblingProps?: {
    cityValue: string;
    countryValue: string;
    latValue: string;
    lngValue: string;
    onCityChange: (value: string) => void;
    onCountryChange: (value: string) => void;
    onLatChange: (value: string) => void;
    onLngChange: (value: string) => void;
  };
}

export function LocationAutocomplete({
  label,
  cityValue,
  countryValue,
  latValue,
  lngValue,
  onCityChange,
  onCountryChange,
  onLatChange,
  onLngChange,
  onLocationSelect,
  placeholder = "Town/City",
  required = false,
  className,
  showMapButton = false,
  mapButtonText = "Map View",
  enableJourneyMode = false,
  siblingProps
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [journeyState, setJourneyState] = useState<JourneyState>({
    step: 'from',
    fromLocation: null,
    toLocation: null,
    markers: { from: false, to: false, crosshair: false },
    lines: { dynamic: null, static: null }
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function for map dialog close
  const cleanupMapDialog = () => {
    // Reset journey state to fresh state
    setJourneyState({
      step: 'from',
      fromLocation: null,
      toLocation: null,
      markers: { from: false, to: false, crosshair: false },
      lines: { dynamic: null, static: null }
    });
  };

  const handleDialogClose = () => {
    setIsMapModalOpen(false);
    cleanupMapDialog();
  };

  // Debounced search function
  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/geocode-search?q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions);
        setShowSuggestions(data.suggestions.length > 0);
        setSelectedIndex(-1);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onCityChange(value);

    // Clear debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce timer
    debounceRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300); // 300ms debounce
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    onCityChange(suggestion.city);
    onCountryChange(suggestion.country);
    onLatChange(suggestion.lat.toString());
    onLngChange(suggestion.lng.toString());
    
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    if (onLocationSelect) {
      onLocationSelect(suggestion);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Handle location selection from map
  const handleLocationSelect = (location: LocationInfo) => {
    onCityChange(location.city);
    onCountryChange(location.country);
    onLatChange(location.coordinates.lat.toString());
    onLngChange(location.coordinates.lng.toString());
    setIsMapModalOpen(false);
  };

  // Handle journey selection from map (both locations at once)
  const handleJourneySelect = (from: LocationInfo, to: LocationInfo) => {
    if (label === "From") {
      // This is the FROM field, populate it and the TO field
      onCityChange(from.city);
      onCountryChange(from.country);
      onLatChange(from.coordinates.lat.toString());
      onLngChange(from.coordinates.lng.toString());
      
      // Populate the TO field using sibling props
      if (siblingProps) {
        siblingProps.onCityChange(to.city);
        siblingProps.onCountryChange(to.country);
        siblingProps.onLatChange(to.coordinates.lat.toString());
        siblingProps.onLngChange(to.coordinates.lng.toString());
      }
    } else {
      // This is the TO field, populate it and the FROM field
      onCityChange(to.city);
      onCountryChange(to.country);
      onLatChange(to.coordinates.lat.toString());
      onLngChange(to.coordinates.lng.toString());
      
      // Populate the FROM field using sibling props
      if (siblingProps) {
        siblingProps.onCityChange(from.city);
        siblingProps.onCountryChange(from.country);
        siblingProps.onLatChange(from.coordinates.lat.toString());
        siblingProps.onLngChange(from.coordinates.lng.toString());
      }
    }
    setIsMapModalOpen(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${label.toLowerCase()}-city`} className="text-base font-medium">{label}</Label>
        {showMapButton && (
          <Dialog open={isMapModalOpen} onOpenChange={(open) => {
            if (!open) {
              handleDialogClose();
            } else {
              setIsMapModalOpen(open);
            }
          }}>
            <DialogTrigger asChild>
              <button 
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsMapModalOpen(true);
                }}
              >
                (use map view)
              </button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-6xl w-[95vw] h-[90vh] p-0"
              onEscapeKeyDown={handleDialogClose}
              onPointerDownOutside={handleDialogClose}
            >
              <DialogHeader className="p-6 pb-2">
                <DialogTitle>
                  {enableJourneyMode ? "Journey Selection" : `Map View - Select ${label}`}
                </DialogTitle>
                <DialogDescription>
                  {enableJourneyMode 
                    ? "Click on the map to select your start point for your journey."
                    : `Interactive world map for selecting your ${label.toLowerCase()} location.`
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 p-6 pt-2">
                {/* Starting point display */}
                {enableJourneyMode && journeyState.fromLocation && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                      Starting point: {journeyState.fromLocation.city}, {journeyState.fromLocation.country}, {journeyState.fromLocation.coordinates.lat.toFixed(4)}, {journeyState.fromLocation.coordinates.lng.toFixed(4)}
                    </p>
                  </div>
                )}
                <div className="w-full h-[calc(90vh-120px)]">
                  <MapLibreWrapper 
                    mode={enableJourneyMode ? "journey" : "single"}
                    onLocationSelect={enableJourneyMode ? undefined : handleLocationSelect}
                    onJourneySelect={enableJourneyMode ? handleJourneySelect : undefined}
                    onJourneyStateChange={enableJourneyMode ? setJourneyState : undefined}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      {/* City Input with Autocomplete */}
      <div className="relative">
        <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
          <div className="relative">
            <Input
              ref={inputRef}
              id={`${label.toLowerCase()}-city`}
              value={cityValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder={placeholder}
              required={required}
              className="pr-10 h-12 px-4 text-base"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
          
          <div>
            <Input
              id={`${label.toLowerCase()}-country`}
              value={countryValue}
              onChange={(e) => onCountryChange(e.target.value)}
              placeholder="Country"
              required={required}
              className="h-12 px-4 text-base"
            />
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-2 bg-background border border-border rounded-lg shadow-xl max-h-64 overflow-auto"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={cn(
                  "px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-muted transition-colors touch-manipulation",
                  selectedIndex === index && "bg-muted"
                )}
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base truncate">
                    {suggestion.fullName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {suggestion.lat.toFixed(4)}, {suggestion.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latitude and Longitude Inputs */}
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
        <Input
          id={`${label.toLowerCase()}-lat`}
          type="number"
          step="any"
          value={latValue}
          onChange={(e) => onLatChange(e.target.value)}
          placeholder="Latitude"
          required={required}
          className="h-12 px-4 text-base"
        />
        <Input
          id={`${label.toLowerCase()}-lng`}
          type="number"
          step="any"
          value={lngValue}
          onChange={(e) => onLngChange(e.target.value)}
          placeholder="Longitude"
          required={required}
          className="h-12 px-4 text-base"
        />
      </div>
    </div>
  );
} 