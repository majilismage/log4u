"use client"

import { Ship, Wrench, LayoutList } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EntryType } from "@/types/journey"

export type EntryFilter = 'all' | EntryType

interface EntryFilterToggleProps {
  value: EntryFilter
  onChange: (value: EntryFilter) => void
  disabled?: boolean
}

const filterOptions: { value: EntryFilter; label: string; icon: typeof Ship }[] = [
  { value: 'all', label: 'All', icon: LayoutList },
  { value: 'journey', label: 'Journeys', icon: Ship },
  { value: 'event', label: 'Events', icon: Wrench },
]

export function EntryFilterToggle({ value, onChange, disabled }: EntryFilterToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md p-0.5",
        "bg-slate-100 dark:bg-neutral-700/50",
        "border border-slate-200 dark:border-neutral-600",
        disabled && "opacity-50 pointer-events-none"
      )}
      role="tablist"
      aria-label="Filter entries"
    >
      {filterOptions.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-medium",
              "transition-all duration-150 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1",
              isSelected
                ? "bg-white dark:bg-neutral-600 text-slate-800 dark:text-neutral-100 shadow-sm"
                : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
