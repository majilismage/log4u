'use client'

import React, { useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogClose } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { MediaItem } from '@/types/journey'

interface MediaModalProps {
  mediaItems: MediaItem[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
}

const getFullImageUrl = (fileId: string) =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`

const getVideoEmbedUrl = (fileId: string) =>
  `https://drive.google.com/file/d/${fileId}/preview`

export const MediaModal: React.FC<MediaModalProps> = ({
  mediaItems,
  initialIndex,
  isOpen,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex)

  // Reset index when modal opens with new initialIndex
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
    }
  }, [isOpen, initialIndex])

  const currentItem = mediaItems[currentIndex]
  const hasMultiple = mediaItems.length > 1
  const isVideo = currentItem?.mimeType?.startsWith('video/')

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1))
  }, [mediaItems.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1))
  }, [mediaItems.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, goToPrevious, goToNext])

  if (!currentItem) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95" />
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => {
            // Close when clicking backdrop (not the media content)
            if (e.target === e.currentTarget) {
              onClose()
            }
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6 text-white" />
          </button>

          {/* Navigation - Previous */}
          {hasMultiple && (
            <button
              onClick={goToPrevious}
              className="absolute left-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-8 w-8 text-white" />
            </button>
          )}

          {/* Media display */}
          <div className="w-[90vw] h-[90vh] flex items-center justify-center">
            {isVideo ? (
              <iframe
                src={getVideoEmbedUrl(currentItem.id)}
                className="w-full h-full max-w-[90vw] max-h-[90vh]"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={currentItem.name}
              />
            ) : (
              <img
                src={getFullImageUrl(currentItem.id)}
                alt={currentItem.name}
                className="max-w-full max-h-full object-contain"
                loading="eager"
              />
            )}
          </div>

          {/* Navigation - Next */}
          {hasMultiple && (
            <button
              onClick={goToNext}
              className="absolute right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-8 w-8 text-white" />
            </button>
          )}

          {/* Position indicator */}
          {hasMultiple && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-sm">
              {currentIndex + 1} of {mediaItems.length}
            </div>
          )}
        </div>
      </DialogPortal>
    </Dialog>
  )
}

export default MediaModal
