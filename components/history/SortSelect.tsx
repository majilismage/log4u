"use client"

import { Calendar, Clock, ArrowUpDown, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type SortField = 'journeyDate' | 'dateAdded'
export type SortDirection = 'asc' | 'desc'

interface SortSelectProps {
  sortField: SortField
  sortDirection: SortDirection
  onSortFieldChange: (field: SortField) => void
  onSortDirectionChange: (direction: SortDirection) => void
  disabled?: boolean
}

const sortOptions: {
  field: SortField
  direction: SortDirection
  label: string
  shortLabel: string
  icon: typeof Calendar
}[] = [
  { field: 'journeyDate', direction: 'desc', label: 'Newest first', shortLabel: 'Newest', icon: Calendar },
  { field: 'journeyDate', direction: 'asc', label: 'Oldest first', shortLabel: 'Oldest', icon: Calendar },
  { field: 'dateAdded', direction: 'desc', label: 'Recently added', shortLabel: 'Recent', icon: Clock },
  { field: 'dateAdded', direction: 'asc', label: 'First added', shortLabel: 'First', icon: Clock },
]

export function SortSelect({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
  disabled,
}: SortSelectProps) {
  const currentOption = sortOptions.find(
    opt => opt.field === sortField && opt.direction === sortDirection
  ) || sortOptions[0]

  const CurrentIcon = currentOption.icon

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split(':') as [SortField, SortDirection]
    if (field !== sortField) onSortFieldChange(field)
    if (direction !== sortDirection) onSortDirectionChange(direction)
  }

  return (
    <div className="relative inline-flex items-center">
      <div className={cn(
        "flex items-center gap-1.5 pl-2.5 pr-7 py-1.5 rounded-md text-sm",
        "bg-slate-100 dark:bg-neutral-700/50",
        "border border-slate-200 dark:border-neutral-600",
        "text-slate-700 dark:text-neutral-200",
        "transition-colors duration-150",
        "hover:bg-slate-200/70 dark:hover:bg-neutral-600/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 dark:text-neutral-400 flex-shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">{currentOption.label}</span>
        <span className="sm:hidden whitespace-nowrap">{currentOption.shortLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 absolute right-2" />
      </div>
      <select
        value={`${sortField}:${sortDirection}`}
        onChange={handleChange}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        aria-label="Sort entries"
      >
        {sortOptions.map((option) => (
          <option
            key={`${option.field}:${option.direction}`}
            value={`${option.field}:${option.direction}`}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
