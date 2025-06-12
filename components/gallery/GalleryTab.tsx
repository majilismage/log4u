"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { RotateCw, AlertTriangle, Image as ImageIcon, Video, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LazyImage } from "@/components/gallery/LazyImage"
import type { MediaItem } from "@/types/journey"

// Define the expected structure of the media API response
interface MediaApiResponse {
  mediaByJourneyId: Record<string, MediaItem[]>;
}

export function GalleryTab() {
  const [allMedia, setAllMedia] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMediaData = async () => {
    console.log('[GalleryTab] fetchMediaData called');
    setIsLoading(true);
    setError(null);
    
    try {
      const mediaResponse = await fetch('/api/get-media');

      if (!mediaResponse.ok) {
        throw new Error(`Failed to fetch media: ${mediaResponse.status} ${mediaResponse.statusText}`);
      }
      
      const mediaResult: MediaApiResponse = await mediaResponse.json();
      console.log('[GalleryTab] Raw API response for media:', mediaResult);

      const mediaByJourneyId = mediaResult.mediaByJourneyId || {};
      console.log('[GalleryTab] Media grouped by Journey ID from API:', mediaByJourneyId);

      // Flatten all media items from all journeys into a single array
      const flattenedMedia: MediaItem[] = Object.values(mediaByJourneyId).flat();
      
      // Sort by creation time (newest first) if available
      flattenedMedia.sort((a, b) => {
        const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return timeB - timeA;
      });
      
      setAllMedia(flattenedMedia);
      console.log('[GalleryTab] State "allMedia" set with flattened data:', flattenedMedia);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[GalleryTab] Error fetching data:', err);
      setError(errorMessage);
      setAllMedia([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaData();
  }, []);

  return (
    <Card className="dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
      <CardContent className="space-y-4 p-4 md:p-6 min-h-[300px]">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-neutral-100 mb-8">Media Gallery</h1>
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full py-10 text-slate-500 dark:text-neutral-400">
            <RotateCw className="h-12 w-12 mb-4 animate-spin text-sky-500 dark:text-sky-400" />
            <p>Loading media gallery...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full py-10 p-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading Gallery</h2>
            <p className="text-slate-600 dark:text-neutral-400 text-center mb-4">{error}</p>
            <Button 
              onClick={fetchMediaData} 
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
            >
              <RotateCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          allMedia.length > 0 ? (
            <div className="space-y-6">
              <p className="text-lg text-slate-700 dark:text-neutral-300">
                {allMedia.length} media files found across all journeys.
              </p>
              <ScrollArea className="h-[calc(100vh-300px)] lg:h-[calc(100vh-250px)] pr-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
                  {allMedia.map((media) => {
                    const thumbnailUrl = media.thumbnailLink 
                      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/thumbnail-proxy?url=${encodeURIComponent(media.thumbnailLink)}` 
                      : 'https://via.placeholder.com/150?text=No+Thumbnail';
                    
                    return (
                      <a
                        key={media.id}
                        href={media.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square relative group overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
                        title={media.name}
                      >
                        <LazyImage
                          src={thumbnailUrl}
                          alt={media.name}
                          title={media.name}
                          className="aspect-square"
                          isVideo={media.mimeType.startsWith('video/')}
                        />
                        {/* Optional: Show media name on hover */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="truncate">{media.name}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-10 p-4">
              <Folder className="w-16 h-16 text-slate-500 mb-4" />
              <h2 className="text-xl font-semibold text-slate-700 dark:text-neutral-300 mb-2">No Media Found</h2>
              <p className="text-slate-600 dark:text-neutral-400">Upload some images or videos to see them in your gallery.</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
} 