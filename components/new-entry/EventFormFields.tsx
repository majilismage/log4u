"use client"

import type React from "react"
import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronDownIcon, Wrench, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FilePreview } from "@/components/FilePreview"
import { LocationAutocomplete } from "@/components/ui/location-autocomplete"

interface EventFormFieldsProps {
  // Date
  date: Date
  onDateChange: (date: Date) => void
  // Title
  title: string
  onTitleChange: (title: string) => void
  // Location (optional)
  town: string
  country: string
  lat: string
  lng: string
  onTownChange: (town: string) => void
  onCountryChange: (country: string) => void
  onLatChange: (lat: string) => void
  onLngChange: (lng: string) => void
  // Notes
  notes: string
  onNotesChange: (notes: string) => void
  // Media
  selectedFiles: File[]
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
}

export function EventFormFields({
  date,
  onDateChange,
  title,
  onTitleChange,
  town,
  country,
  lat,
  lng,
  onTownChange,
  onCountryChange,
  onLatChange,
  onLngChange,
  notes,
  onNotesChange,
  selectedFiles,
  onFileSelect,
  onRemoveFile,
}: EventFormFieldsProps) {
  const [dateOpen, setDateOpen] = useState(false)

  return (
    <>
      {/* Event Date and Title Section */}
      <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
            <CalendarIcon className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Event Details</h3>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="eventDate" className="text-base font-medium">Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between text-left font-normal h-12 px-4 text-base",
                    !date && "text-muted-foreground",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5" />
                    {date ? format(date, "dd MMMM yyyy") : <span>Pick event date</span>}
                  </span>
                  <ChevronDownIcon className="h-4 w-4 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  captionLayout="dropdown"
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                  components={{ IconLeft: () => null, IconRight: () => null }}
                  classNames={{ caption_label: "hidden" }}
                  onSelect={(newDate) => {
                    if (newDate) {
                      onDateChange(newDate)
                      setDateOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="eventTitle" className="text-base font-medium">Event Title</Label>
            <div className="relative">
              <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="eventTitle"
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g., Engine Service, Oil Change, Annual Inspection"
                required
                className="h-12 pl-10 pr-4 text-base"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Location Section (Optional) */}
      <div className="bg-muted/30 rounded-lg p-4 sm:p-5 border border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Location</h3>
            <p className="text-sm text-muted-foreground">Optional - where did this event occur?</p>
          </div>
        </div>

        <LocationAutocomplete
          label=""
          cityValue={town}
          countryValue={country}
          latValue={lat}
          lngValue={lng}
          onCityChange={onTownChange}
          onCountryChange={onCountryChange}
          onLatChange={onLatChange}
          onLngChange={onLngChange}
          placeholder="Town/City (optional)"
          required={false}
          className="space-y-3"
          showMapButton={true}
        />
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
          id="eventNotes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add details about this event..."
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
              htmlFor="eventMedia"
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
                id="eventMedia"
                type="file"
                accept="image/*, video/*"
                multiple
                onChange={onFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="pt-2">
              <FilePreview
                files={selectedFiles}
                onRemove={onRemoveFile}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
