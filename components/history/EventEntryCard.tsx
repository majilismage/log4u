'use client'

import React, { useState } from 'react'
import type { EventEntryWithMedia, MediaItem } from '@/types/journey'
import { LazyImage } from '@/components/gallery/LazyImage'
import InlineEdit from '@/components/ui/inline-edit'
import DropZone from '@/components/ui/drop-zone'
import { Button } from '@/components/ui/button'
import { Edit2, Save, X, Loader2, Trash2, Plus, Wrench, MapPin, Calendar } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { format, parseISO, isValid } from 'date-fns'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'

const PlayIcon = () => (
  <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
  </svg>
)

interface EventEntryCardProps {
  event: EventEntryWithMedia
  isEditable?: boolean
  onUpdate?: (updatedEvent: EventEntryWithMedia) => void
  onError?: (message: string) => void
  onDelete?: (eventId: string) => void
}

export const EventEntryCard: React.FC<EventEntryCardProps> = ({
  event,
  isEditable = false,
  onUpdate,
  onError,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedEvent, setEditedEvent] = useState(event)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr)
      if (isValid(parsed)) {
        return format(parsed, 'MMM dd, yyyy')
      }
    } catch (e) {
      // Fall through
    }
    return dateStr
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/journey/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editedEvent.date,
          title: editedEvent.title,
          town: editedEvent.town,
          country: editedEvent.country,
          latitude: editedEvent.latitude,
          longitude: editedEvent.longitude,
          notes: editedEvent.notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update event')
      }

      toast({
        title: "Event updated",
        description: `${editedEvent.title} has been updated.`,
      })

      onUpdate?.(editedEvent)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating event:', error)
      toast({
        title: "Failed to update event",
        description: "Please try again.",
        variant: "destructive",
      })
      onError?.('Failed to update event')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/journey/${event.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete event')
      }

      toast({
        title: "Event deleted",
        description: `${event.title} has been deleted.`,
      })

      onDelete?.(event.id)
    } catch (error) {
      console.error('Error deleting event:', error)
      toast({
        title: "Failed to delete event",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleCancel = () => {
    setEditedEvent(event)
    setIsEditing(false)
  }

  return (
    <>
      <div className="bg-white dark:bg-neutral-800 shadow-lg dark:shadow-neutral-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 transition-shadow duration-300 ease-in-out">
        {/* Edit controls - matches HistoryEntryCard header */}
        {isEditable && (
          <div className="p-2 border-b border-slate-200 dark:border-neutral-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-300">
              <Wrench className="h-4 w-4 text-amber-500" />
              <span>{formatDateDisplay(event.date)}</span>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit event"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleSave}
                    disabled={isSaving}
                    aria-label="Save changes"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isSaving}
                    aria-label="Cancel editing"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                aria-label="Delete event"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <div className="flex flex-col md:flex-row">
            {/* Left section - Event details (60%) */}
            <div className="w-full md:w-[60%] md:flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-700">
              <div className="p-4 space-y-4">
                {/* Title */}
                <div>
                  {isEditing ? (
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <InlineEdit
                        value={editedEvent.title}
                        onChange={(value) => setEditedEvent(prev => ({ ...prev, title: value }))}
                        placeholder="Event title"
                        aria-label="Event title"
                      />
                    </div>
                  ) : (
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-neutral-100">
                      {event.title}
                    </h3>
                  )}
                </div>

                {/* Location */}
                {(event.town || event.country || isEditing) && (
                  <div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Location</label>
                        <LocationAutocomplete
                          label=""
                          cityValue={editedEvent.town || ''}
                          countryValue={editedEvent.country || ''}
                          latValue={editedEvent.latitude?.toString() || ''}
                          lngValue={editedEvent.longitude?.toString() || ''}
                          onCityChange={(town) => setEditedEvent(prev => ({ ...prev, town }))}
                          onCountryChange={(country) => setEditedEvent(prev => ({ ...prev, country }))}
                          onLatChange={(lat) => setEditedEvent(prev => ({ ...prev, latitude: lat ? parseFloat(lat) : undefined }))}
                          onLngChange={(lng) => setEditedEvent(prev => ({ ...prev, longitude: lng ? parseFloat(lng) : undefined }))}
                          placeholder="Location (optional)"
                          required={false}
                          showMapButton={true}
                        />
                      </div>
                    ) : (event.town || event.country) && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-neutral-400">
                        <MapPin className="h-4 w-4" />
                        <span>{[event.town, event.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Date display when not in header (non-editable view without controls) */}
                {!isEditable && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-neutral-400">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateDisplay(event.date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right section - Notes (40%) */}
            <div className="w-full md:w-[40%]">
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-500 dark:text-neutral-500 mb-2">Notes</h4>
                {isEditing ? (
                  <InlineEdit
                    value={editedEvent.notes || ''}
                    onChange={(value) => setEditedEvent(prev => ({ ...prev, notes: value }))}
                    placeholder="Add event notes..."
                    multiline
                    aria-label="Notes"
                  />
                ) : (
                  <p className="text-slate-700 dark:text-neutral-300 whitespace-pre-wrap text-sm leading-relaxed">
                    {event.notes || 'No notes provided for this event.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Media Gallery - matches HistoryEntryCard style */}
          {event.media && event.media.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-neutral-700">
              <h3 className="font-semibold text-md text-slate-800 dark:text-neutral-200 mb-3">Media Gallery</h3>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {event.media.map((item) => {
                  let thumbnailUrl = ''
                  if (item.thumbnailLink && item.thumbnailLink.startsWith('https://drive.google.com/thumbnail?')) {
                    thumbnailUrl = item.thumbnailLink
                  } else if (item.thumbnailLink) {
                    thumbnailUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/thumbnail-proxy?url=${encodeURIComponent(item.thumbnailLink)}`
                  } else if (item.mimeType?.startsWith('image/')) {
                    thumbnailUrl = `https://drive.google.com/thumbnail?id=${item.id}&sz=w200`
                  } else {
                    thumbnailUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"%3E%3Crect width="150" height="150" fill="%23e5e7eb"/%3E%3C/svg%3E'
                  }

                  return (
                    <div key={item.id} className="aspect-square relative group bg-slate-100 dark:bg-neutral-700 rounded-md overflow-hidden">
                      <LazyImage
                        src={thumbnailUrl}
                        alt={item.name}
                        title={item.name}
                        className="aspect-square"
                        isVideo={item.mimeType?.startsWith('video/')}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{event.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default EventEntryCard
