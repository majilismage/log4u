"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Folder, FileIcon, Image, Video, Loader2 } from "lucide-react"
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

// New structure to hold media files grouped by journeyId
type GroupedMediaFiles = Record<string, MediaFile[]>;

function extractMediaFiles(nodes: DriveItem[]): GroupedMediaFiles {
  const mediaByJourney: GroupedMediaFiles = {};

  function traverse(currentNodes: DriveItem[]) {
    if (!currentNodes) return;

    for (const node of currentNodes) {
      if (node.mimeType === 'application/vnd.google-apps.folder' && node.children) {
        const potentialJourneyId = node.name;
        let isJourneyFolder = false;

        for (const child of node.children) {
          if ((child.name === 'images' || child.name === 'videos') && child.mimeType === 'application/vnd.google-apps.folder' && child.children) {
            isJourneyFolder = true; // Mark this node as a journey folder
            if (!mediaByJourney[potentialJourneyId]) {
              mediaByJourney[potentialJourneyId] = [];
            }
            for (const mediaFile of child.children) {
              if (mediaFile.thumbnailLink && !mediaFile.mimeType.includes('folder')) {
                mediaByJourney[potentialJourneyId].push({
                  id: mediaFile.id,
                  name: mediaFile.name,
                  mimeType: mediaFile.mimeType,
                  thumbnailLink: mediaFile.thumbnailLink,
                  webViewLink: mediaFile.webViewLink,
                  isVideo: mediaFile.mimeType.startsWith('video/'),
                });
              }
            }
          }
        }

        // If 'node' was not identified as a journey folder itself,
        // or if we want to find journeys nested deeper (policy decision: for now, assume journeys are not deeply nested in a way that this simple check misses)
        // recurse into its children that are NOT 'images' or 'videos' subfolders of an already processed journey.
        if (!isJourneyFolder) {
          traverse(node.children);
        } else {
          // If it IS a journey folder, we've processed its 'images'/'videos'.
          // We might still want to see if other subfolders within this journey folder could *themselves* be journeys,
          // though typically a journey folder would just contain media and other content, not sub-journeys.
          // For now, let's only recurse into children that are NOT the processed 'images'/'videos' folders
          // and are themselves folders, to find other unrelated journey folders that might be siblings deeper in the tree.
           for (const child of node.children) {
            if (child.mimeType === 'application/vnd.google-apps.folder' && !(child.name === 'images' || child.name === 'videos')) {
               // This is a deeper folder that isn't the images/videos we just processed.
               // It could potentially be another journey folder.
               traverse([child]);
            }
          }
        }
      }
    }
  }

  traverse(nodes);
  return mediaByJourney;
}

export function MediaGallery() {
  console.log('MediaGallery: Component rendering/re-rendering')
  const [items, setItems] = useState<DriveItem[]>([])
  const [mediaFiles, setMediaFiles] = useState<GroupedMediaFiles>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rawJsonResponse, setRawJsonResponse] = useState<object | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  console.log('MediaGallery: Initial state - isLoading:', isLoading, 'mediaFiles:', mediaFiles);

  useEffect(() => {
    if (items && items.length > 0) {
      console.log('MediaGallery: items useEffect - items changed, extracting media. Items:', items);
      const extracted = extractMediaFiles(items)
      console.log('MediaGallery: items useEffect - extracted media:', extracted);
      setMediaFiles(extracted)
      console.log('MediaGallery: items useEffect - setMediaFiles called.');
    } else {
      console.log('MediaGallery: items useEffect - items empty, clearing mediaFiles.');
      setMediaFiles({}); 
    }
  }, [items])

  const fetchRootFolder = useCallback(async () => {
    console.log('MediaGallery: fetchRootFolder - CALLED.');
    setIsLoading(true);
    setError(null);
    console.log('MediaGallery: fetchRootFolder - Set isLoading to true, cleared error.');
    
    let operationAborted = false;

    try {
      if (abortControllerRef.current) {
        console.log('MediaGallery: fetchRootFolder - Aborting previous fetch.');
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      console.log('MediaGallery: fetchRootFolder - Fetching /api/list-drive...');
      const response = await fetch('/api/list-drive', {
        signal: abortControllerRef.current.signal
      })
      console.log('MediaGallery: fetchRootFolder - API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('MediaGallery: fetchRootFolder - HTTP error! Status:', response.status, 'Text:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json()
      console.log('MediaGallery: fetchRootFolder - API response data:', data);
      if (data.success) {
        console.log('MediaGallery: fetchRootFolder - API success. Setting items.');
        setItems(data.items)
        setRawJsonResponse(data)
        console.log('MediaGallery: fetchRootFolder - setItems and setRawJsonResponse called.');
      } else {
        console.error('MediaGallery: fetchRootFolder - API call not successful. Error:', data.error);
        setRawJsonResponse(data)
        throw new Error(data.error || 'Failed to fetch Drive contents')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('MediaGallery: fetchRootFolder - Fetch aborted.');
        operationAborted = true;
      } else {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        console.error('MediaGallery: fetchRootFolder - Error caught:', errorMessage, error);
        setError(errorMessage)
      }
    } finally {
      console.log('MediaGallery: fetchRootFolder - finally block. operationAborted:', operationAborted);
      if (!operationAborted) {
        setIsLoading(false);
        console.log('MediaGallery: fetchRootFolder - finally - Setting isLoading to false (operation not aborted).');
      } else {
        console.log('MediaGallery: fetchRootFolder - finally - isLoading remains true (operation aborted).');
      }
    }
  }, [setItems, setError, setRawJsonResponse])

  console.log('MediaGallery: fetchRootFolder function (re)DEFINED')

  useEffect(() => {
    console.log('MediaGallery: fetchRootFolder useEffect - RUNNING. Calling fetchRootFolder.');
    fetchRootFolder()

    return () => {
      if (abortControllerRef.current) {
        console.log('MediaGallery: fetchRootFolder useEffect - Cleanup: Aborting fetch.');
        abortControllerRef.current.abort()
      }
    }
  }, [fetchRootFolder])

  const totalMediaFileCount = Object.values(mediaFiles).reduce((acc, files) => acc + files.length, 0);
  console.log('MediaGallery: Calculated totalMediaFileCount:', totalMediaFileCount);

  console.log('MediaGallery: Rendering - isLoading:', isLoading, 'totalMediaFileCount:', totalMediaFileCount, 'error:', error);

  if (error) {
    console.log('MediaGallery: Rendering - Showing ERROR message.');
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

  if (isLoading) {
    console.log('MediaGallery: Rendering - Showing LOADING SPINNER (isLoading is true).');
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
            <Loader2 className="h-12 w-12 mb-4 animate-spin" />
            <p>Retrieving media from Drive...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (totalMediaFileCount === 0) {
    console.log('MediaGallery: Rendering - Showing NO MEDIA FOUND message (isLoading false, no error, totalMediaFileCount 0).');
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

  console.log('MediaGallery: Rendering - Showing MEDIA GALLERY content.');
  return (
    <ScrollArea className="h-[calc(100vh-200px)] lg:h-[calc(100vh-150px)] pr-4">
      {Object.entries(mediaFiles).map(([journeyId, filesInJourney]) => {
        if (filesInJourney.length === 0) return null; // Don't render a section if there are no files for this journey
        return (
          <div key={journeyId} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 px-4 pt-4">{journeyId}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
              {filesInJourney.map((file) => {
                const thumbnailUrl = file.thumbnailLink 
                  ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/thumbnail-proxy?url=${encodeURIComponent(file.thumbnailLink)}` 
                  : 'https://via.placeholder.com/150?text=No+Thumbnail';
                return (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square relative group overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
                  >
                    <img
                      src={thumbnailUrl}
                      alt={file.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/150?text=Error';
                        target.onerror = null; // Prevent infinite loop if placeholder also fails
                      }}
                    />
                    {file.isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity duration-300">
                        <Video className="h-8 w-8 text-white opacity-80 group-hover:opacity-100" />
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </ScrollArea>
  );
} 