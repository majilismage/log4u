"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Folder, FileIcon, Image, Video } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DriveItem {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  thumbnailLink?: string
  children?: DriveItem[]
  createdTime?: string
  modifiedTime?: string
  size?: string
  videoMediaMetadata?: any
}

interface MediaFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  thumbnailLink?: string
  isVideo: boolean
}

function extractMediaFiles(nodes: DriveItem[]): MediaFile[] {
  const allMedia: MediaFile[] = []
  function traverse(currentNodes: DriveItem[]) {
    if (!currentNodes) return
    for (const node of currentNodes) {
      if ((node.name === 'images' || node.name === 'videos') && node.mimeType === 'application/vnd.google-apps.folder' && node.children) {
        for (const file of node.children) {
          if (file.thumbnailLink && !file.mimeType.includes('folder')) {
            allMedia.push({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              thumbnailLink: file.thumbnailLink,
              webViewLink: file.webViewLink,
              isVideo: file.mimeType.startsWith('video/'),
            })
          }
        }
      } else if (node.children) {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return allMedia
}

export function MediaGallery() {
  console.log('MediaGallery: Component rendering/re-rendering')
  const [items, setItems] = useState<DriveItem[]>([])
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rawJsonResponse, setRawJsonResponse] = useState<object | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (items && items.length > 0) {
      const extracted = extractMediaFiles(items)
      setMediaFiles(extracted)
      console.log('MediaGallery: Extracted media files for display', extracted)
    }
  }, [items])

  const fetchRootFolder = useCallback(async () => {
    console.log('MediaGallery: fetchRootFolder EXECUTING')
    setIsLoading(true)
    setError(null)
    setRawJsonResponse(null)

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/list-drive', {
        signal: abortControllerRef.current.signal
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        setItems(data.items)
        setRawJsonResponse(data)
      } else {
        setRawJsonResponse(data)
        throw new Error(data.error || 'Failed to fetch Drive contents')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      console.error('Error fetching Drive contents:', error)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [setIsLoading, setError, setRawJsonResponse, setItems])

  console.log('MediaGallery: fetchRootFolder function (re)DEFINED')

  useEffect(() => {
    console.log('MediaGallery: useEffect for fetchRootFolder RUNNING')
    fetchRootFolder()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchRootFolder])

  const getItemIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-6 w-6" />
    }
    if (mimeType.startsWith('video/')) {
      return <Video className="h-6 w-6" />
    }
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="h-6 w-6" />
    }
    return <FileIcon className="h-6 w-6" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
        {rawJsonResponse && (
          <ScrollArea className="mt-4 h-[300px] w-full rounded-md border p-4">
            <pre className="text-xs">{JSON.stringify(rawJsonResponse, null, 2)}</pre>
          </ScrollArea>
        )}
      </Alert>
    )
  }

  if (isLoading && mediaFiles.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
            <Folder className="h-12 w-12 mb-2" />
            <p>Loading media gallery...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isLoading && mediaFiles.length === 0 && !error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
            <Folder className="h-12 w-12 mb-2" />
            <p>No media files found to display.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)] lg:h-[calc(100vh-150px)] pr-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
        {mediaFiles.map((file) => (
          <a
            key={file.id}
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-square relative group overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
          >
            <img
              src={file.thumbnailLink}
              alt={file.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/150?text=Error';
                e.currentTarget.onerror = null;
              }}
            />
            {file.isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity duration-300">
                <Video className="h-8 w-8 text-white opacity-80 group-hover:opacity-100" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white text-xs truncate" title={file.name}>{file.name}</p>
            </div>
          </a>
        ))}
      </div>
    </ScrollArea>
  );
} 