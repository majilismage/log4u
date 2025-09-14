'use client'

import React, { useState } from 'react'
import type { JourneyEntryWithMedia, MediaItem } from '@/types/journey'
import JourneyMetadata from './JourneyMetadata'
import JourneyContent from './JourneyContent'
import { LazyImage } from '@/components/gallery/LazyImage'
import InlineEdit from '@/components/ui/inline-edit'
import DropZone from '@/components/ui/drop-zone'
import { useEditableJourney } from '@/hooks/useEditableJourney'
import { Button } from '@/components/ui/button'
import { Edit2, Save, X, Loader2, Trash2, Plus, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { format, parseISO, isValid } from 'date-fns'
import { useEnglishPlaceName } from '@/hooks/useEnglishPlaceName'

const PlayIcon = () => (
  <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
  </svg>
)

interface EditableMediaGridProps {
  media: MediaItem[]
  isEditing: boolean
  isUploading?: boolean
  uploadProgress?: string
  onDeleteMedia?: (mediaId: string) => void
  onAddMedia?: () => void
  onDropFiles?: (files: File[]) => void
  onDropError?: (error: string) => void
}

const EditableMediaGrid: React.FC<EditableMediaGridProps> = ({ 
  media, 
  isEditing, 
  isUploading = false,
  uploadProgress,
  onDeleteMedia,
  onAddMedia,
  onDropFiles,
  onDropError
}) => {
  const content = (
    <div className="p-4 border-t border-slate-200 dark:border-neutral-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-md text-slate-800 dark:text-neutral-200">Media Gallery</h3>
        {isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAddMedia}
            aria-label="Add media"
            disabled={isUploading}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Media
          </Button>
        )}
      </div>
      
      {/* Upload status */}
      {isUploading && uploadProgress && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" data-testid="upload-progress" />
          <span className="text-sm">Uploading: {uploadProgress}</span>
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {media.map((item) => {
          // For images, construct a Google Drive thumbnail URL
          // For videos or files without thumbnails, show a placeholder
          let thumbnailUrl = ''
          if (item.thumbnailLink && item.thumbnailLink.startsWith('https://drive.google.com/thumbnail?')) {
            // Direct Google Drive thumbnail URLs don't need proxy
            thumbnailUrl = item.thumbnailLink
          } else if (item.thumbnailLink) {
            // Other thumbnail URLs might need proxy
            thumbnailUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/thumbnail-proxy?url=${encodeURIComponent(item.thumbnailLink)}`
          } else if (item.mimeType?.startsWith('image/')) {
            // Use Google Drive's thumbnail service for images without thumbnails
            thumbnailUrl = `https://drive.google.com/thumbnail?id=${item.id}&sz=w200`
          } else {
            // Use data URI placeholder for videos or unknown types
            thumbnailUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"%3E%3Crect width="150" height="150" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="system-ui" font-size="14"%3E%3C/text%3E%3C/svg%3E'
          }
          
          return (
            <div key={item.id} className="aspect-square relative group bg-slate-100 dark:bg-neutral-700 rounded-md overflow-hidden">
              <LazyImage
                src={thumbnailUrl}
                alt={item.name}
                title={item.name}
                className="aspect-square"
                isVideo={item.mimeType.startsWith('video/')}
              />
              {isEditing && (
                <button
                  onClick={() => onDeleteMedia?.(item.id)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
        
        {/* Empty state for drag and drop hint */}
        {isEditing && media.length === 0 && !isUploading && (
          <div className="col-span-full flex flex-col items-center justify-center py-8 text-gray-400">
            <Upload className="h-12 w-12 mb-2" />
            <p className="text-sm">Drag and drop images or videos here</p>
            <p className="text-xs mt-1">or click "Add Media" to browse</p>
          </div>
        )}
      </div>
    </div>
  )

  // Wrap in DropZone only when editing
  if (isEditing && onDropFiles) {
    return (
      <DropZone
        onDrop={onDropFiles}
        onError={onDropError}
        accept="image/*,video/*"
        multiple={true}
        disabled={isUploading}
        className="media-drop-zone"
        overlayContent="Drop images or videos to add to journey"
        data-testid="media-drop-zone"
      >
        {content}
      </DropZone>
    )
  }

  return content
}

interface HistoryEntryCardProps {
  journey: JourneyEntryWithMedia
  isEditable?: boolean
  onUpdate?: (updates: Partial<JourneyEntryWithMedia>) => void
  onError?: (error: string) => void
  onDelete?: (journeyId: string) => void
}

const HistoryEntryCard: React.FC<HistoryEntryCardProps> = ({ 
  journey, 
  isEditable = false,
  onUpdate,
  onError,
  onDelete
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [localMedia, setLocalMedia] = useState(journey.media || [])
  const [hasMediaChanges, setHasMediaChanges] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const {
    isEditing,
    setIsEditing,
    isSaving,
    errors,
    updateField,
    save,
    cancel,
    getValue,
    hasChanges
  } = useEditableJourney(journey, { onUpdate, onError })

  // Ensure place names are displayed in English using reverse geocoding when needed
  const fromEnglish = useEnglishPlaceName(
    journey.fromTown,
    journey.fromCountry,
    journey.fromLatitude,
    journey.fromLongitude
  )
  const toEnglish = useEnglishPlaceName(
    journey.toTown,
    journey.toCountry,
    journey.toLatitude,
    journey.toLongitude
  )

  const formatDate = (dateString: string): string => {
    if (!dateString || dateString.trim() === '') return 'N/A'
    try {
      const date = parseISO(dateString)
      if (isValid(date)) {
        return format(date, 'MMM dd, yyyy')
      }
      return dateString
    } catch {
      return dateString
    }
  }

  const handleDeleteJourney = async () => {
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/journey/${journey.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || 'Failed to delete journey')
      }
      // Treat 404 as success (already deleted)
      onDelete?.(journey.id)
      setShowDeleteDialog(false)
      toast({ title: 'Journey deleted', description: 'The journey has been removed from history.' })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete journey'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSave = async () => {
    const result = await save()
    if (result.success) {
      setHasMediaChanges(false)
    } else if (result.error) {
      // Error is already handled by the hook
    }
  }

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      const response = await fetch('/api/get-media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId })
      })

      if (!response.ok) {
        throw new Error('Failed to delete media')
      }

      // Update local state
      const updatedMedia = localMedia.filter(m => m.id !== mediaId)
      setLocalMedia(updatedMedia)
      onUpdate?.({ media: updatedMedia })
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to delete media')
    }
  }

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true)
    const uploadedMedia: MediaItem[] = []
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`${file.name} (${i + 1}/${files.length})`)
        
        console.log('[Upload] Starting upload for file:', {
          name: file.name,
          type: file.type,
          size: file.size,
          journeyId: journey.id
        })
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('journeyId', journey.id)

        const response = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData
        })

        console.log('[Upload] Response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Upload] Error response:', errorText)
          let errorMessage = `Failed to upload ${file.name}`
          let errorDetails = null
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error || errorMessage
            errorDetails = errorJson.details
            if (errorDetails) {
              console.error('[Upload] Error details:', errorDetails)
            }
          } catch (e) {
            // If not JSON, use the text directly
            if (errorText) errorMessage = errorText
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        console.log('[Upload] Response data:', data)
        
        // Create a media item from the uploaded file
        if (data.success && data.fileId) {
          const newMediaItem: MediaItem = {
            id: data.fileId,
            name: file.name,
            thumbnailLink: data.thumbnailLink || '',
            webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.fileId}/view`,
            mimeType: file.type,
            journeyId: journey.id,
            createdTime: new Date().toISOString()
          }
          console.log('[Upload] Created media item:', newMediaItem)
          uploadedMedia.push(newMediaItem)
        } else {
          console.warn('[Upload] Unexpected response format:', data)
        }
      }
      
      // Always update local media state without reloading
      if (uploadedMedia.length > 0) {
        const updatedMedia = [...localMedia, ...uploadedMedia]
        setLocalMedia(updatedMedia)
        setHasMediaChanges(true)
        
        // Also update the parent component if callback provided
        if (onUpdate) {
          onUpdate({ media: updatedMedia })
        }
        
        // If in edit mode, update the journey's media links
        // Media is stored separately in Google Drive, not in the journey sheet
        // No need to update journey fields for media
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to upload files')
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }

  const handleDropFiles = async (files: File[]) => {
    // Validate file types
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    )
    
    if (validFiles.length !== files.length) {
      onError?.('Invalid file type. Only images and videos are allowed.')
    }
    
    // Check file sizes (50MB limit)
    const MAX_SIZE = 50 * 1024 * 1024
    const oversizedFiles = validFiles.filter(file => file.size > MAX_SIZE)
    
    if (oversizedFiles.length > 0) {
      onError?.(`Files too large: ${oversizedFiles.map(f => f.name).join(', ')}`)
      return
    }
    
    if (validFiles.length > 0) {
      await uploadFiles(validFiles)
    }
  }

  const handleAddMedia = () => {
    // Create hidden file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,video/*'
    input.multiple = true
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (files.length > 0) {
        await uploadFiles(files)
      }
    }
    input.click()
  }

  return (
    <>
    <div className="bg-white dark:bg-neutral-800 shadow-lg dark:shadow-neutral-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 transition-shadow duration-300 ease-in-out">
      {/* Edit controls */}
      {isEditable && (
        <div className="p-2 border-b border-slate-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-neutral-300">
            {formatDate(journey.departureDate)} — {formatDate(journey.arrivalDate)}
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                aria-label="Edit journey"
                data-testid="edit-toggle"
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
                disabled={isSaving || (!hasChanges() && !hasMediaChanges)}
                aria-label="Save changes"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" data-testid="save-loading" />
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
                onClick={() => {
                  cancel()
                  setHasMediaChanges(false)
                }}
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
              onClick={handleDeleteJourney}
              aria-label="Delete journey"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Error display */}
      {errors._form && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to save: {errors._form}
          </p>
        </div>
      )}

      <div className="flex flex-col">
        <div className="flex flex-col md:flex-row">
          {/* Metadata Section */}
          <div className="w-full md:w-[60%] md:flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-700">
            {isEditing ? (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Distance</label>
                    <InlineEdit
                      value={getValue('distance') as string}
                      type="number"
                      onChange={(val) => updateField('distance', val)}
                      aria-label="Distance"
                      validation={(val) => Number(val) > 0 ? null : 'Distance must be positive'}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Avg Speed</label>
                    <InlineEdit
                      value={getValue('averageSpeed') as string}
                      type="number"
                      onChange={(val) => updateField('averageSpeed', val)}
                      aria-label="Average speed"
                      validation={(val) => Number(val) >= 0 ? null : 'Speed must be non-negative'}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max Speed</label>
                    <InlineEdit
                      value={getValue('maxSpeed') as string}
                      type="number"
                      onChange={(val) => updateField('maxSpeed', val)}
                      aria-label="Max speed"
                      validation={(val) => Number(val) >= 0 ? null : 'Speed must be non-negative'}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <JourneyMetadata 
                fromTown={fromEnglish.city}
                fromCountry={fromEnglish.country}
                toTown={toEnglish.city}
                toCountry={toEnglish.country}
                departureDate={journey.departureDate}
                arrivalDate={journey.arrivalDate}
                distance={getValue('distance') as string}
                averageSpeed={getValue('averageSpeed') as string}
                maxSpeed={getValue('maxSpeed') as string}
                fromLatitude={journey.fromLatitude}
                fromLongitude={journey.fromLongitude}
                toLatitude={journey.toLatitude}
                toLongitude={journey.toLongitude}
              />
            )}
          </div>

          {/* Content Section (Notes) */}
          <div className="w-full md:w-[40%]">
            {isEditing ? (
              <div className="p-4">
                <label className="text-sm font-medium">Notes</label>
                <InlineEdit
                  value={getValue('notes') as string || ''}
                  onChange={(val) => updateField('notes', val)}
                  multiline
                  placeholder="Add journey notes..."
                  aria-label="Notes"
                />
              </div>
            ) : (
              <JourneyContent notes={getValue('notes') as string} />
            )}
          </div>
        </div>

        {/* Media Grid Section */}
        {(localMedia.length > 0 || isEditing) && (
          <EditableMediaGrid 
            media={localMedia} 
            isEditing={isEditing}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            onDeleteMedia={handleDeleteMedia}
            onAddMedia={handleAddMedia}
            onDropFiles={handleDropFiles}
            onDropError={onError}
          />
        )}
      </div>
    </div>

    {/* Delete confirmation modal */}
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete journey?</DialogTitle>
          <DialogDescription>
            This will permanently remove this journey and its metadata from your history. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} aria-label="Confirm delete journey" disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export default HistoryEntryCard
