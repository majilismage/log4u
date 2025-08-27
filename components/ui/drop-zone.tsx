'use client'

import React, { useState, useRef, DragEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'

interface DropZoneProps {
  children: ReactNode
  onDrop: (files: File[]) => void
  onError?: (error: string) => void
  accept?: string
  multiple?: boolean
  maxSize?: number
  disabled?: boolean
  className?: string
  overlayContent?: string
  'data-testid'?: string
}

export default function DropZone({
  children,
  onDrop,
  onError,
  accept,
  multiple = true,
  maxSize = 50 * 1024 * 1024, // 50MB default
  disabled = false,
  className,
  overlayContent = 'Drop files to upload',
  'data-testid': dataTestId
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const validateFiles = (fileList: FileList): File[] => {
    const files = Array.from(fileList)
    const validFiles: File[] = []
    const rejectedFiles: string[] = []
    const tooLargeFiles: string[] = []

    // Take only first file if not multiple
    const filesToProcess = multiple ? files : files.slice(0, 1)

    filesToProcess.forEach(file => {
      // Check file type
      if (accept) {
        const acceptTypes = accept.split(',').map(t => t.trim())
        const isValidType = acceptTypes.some(type => {
          if (type.endsWith('/*')) {
            const category = type.replace('/*', '')
            return file.type.startsWith(category + '/')
          }
          return file.type === type
        })

        if (!isValidType) {
          rejectedFiles.push(file.name)
          return
        }
      }

      // Check file size
      if (file.size > maxSize) {
        tooLargeFiles.push(file.name)
        return
      }

      validFiles.push(file)
    })

    // Report errors
    if (rejectedFiles.length > 0) {
      onError?.(`Some files were rejected: ${rejectedFiles.join(', ')}`)
    }
    if (tooLargeFiles.length > 0) {
      onError?.(`Some files were too large: ${tooLargeFiles.join(', ')}`)
    }

    return validFiles
  }

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return
    
    dragCounter.current++
    // Check for files being dragged
    if (dragCounter.current === 1 && e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(false)
    dragCounter.current = 0

    if (disabled) return

    const validFiles = validateFiles(e.dataTransfer.files)
    if (validFiles.length > 0) {
      onDrop(validFiles)
    }
  }

  return (
    <div
      data-testid={dataTestId || "drop-zone"}
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      
      {isDragging && (
        <div
          data-testid="drag-overlay"
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg"
        >
          <div className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <Upload className="h-12 w-12 text-blue-500 animate-pulse" />
            <p className="text-lg font-medium">{overlayContent}</p>
          </div>
        </div>
      )}
    </div>
  )
}