"use client"

import { Ship, Wrench } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { EntryType } from "@/types/journey"

interface EntryTypeToggleProps {
  value: EntryType
  onChange: (value: EntryType) => void
  disabled?: boolean
}

export function EntryTypeToggle({ value, onChange, disabled }: EntryTypeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        // Prevent deselection - must always have a value
        if (newValue) {
          onChange(newValue as EntryType)
        }
      }}
      className="justify-start"
      disabled={disabled}
    >
      <ToggleGroupItem
        value="journey"
        aria-label="Log a journey"
        className="flex items-center gap-2 px-4"
      >
        <Ship className="h-4 w-4" />
        <span>Journey</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="event"
        aria-label="Log an event"
        className="flex items-center gap-2 px-4"
      >
        <Wrench className="h-4 w-4" />
        <span>Event</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
