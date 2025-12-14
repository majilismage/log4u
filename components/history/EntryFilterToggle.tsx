"use client"

import { Ship, Wrench, LayoutList } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { EntryType } from "@/types/journey"

export type EntryFilter = 'all' | EntryType

interface EntryFilterToggleProps {
  value: EntryFilter
  onChange: (value: EntryFilter) => void
  disabled?: boolean
}

export function EntryFilterToggle({ value, onChange, disabled }: EntryFilterToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        // Prevent deselection - must always have a value
        if (newValue) {
          onChange(newValue as EntryFilter)
        }
      }}
      className="justify-start"
      disabled={disabled}
    >
      <ToggleGroupItem
        value="all"
        aria-label="Show all entries"
        className="flex items-center gap-2 px-3"
      >
        <LayoutList className="h-4 w-4" />
        <span>All</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="journey"
        aria-label="Show only journeys"
        className="flex items-center gap-2 px-3"
      >
        <Ship className="h-4 w-4" />
        <span>Journeys</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="event"
        aria-label="Show only events"
        className="flex items-center gap-2 px-3"
      >
        <Wrench className="h-4 w-4" />
        <span>Events</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
