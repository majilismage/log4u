"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Video } from 'lucide-react'

interface LazyImageProps {
  src: string
  alt: string
  title?: string
  className?: string
  isVideo?: boolean
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
}

export function LazyImage({ 
  src, 
  alt, 
  title, 
  className = "", 
  isVideo = false, 
  onError 
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px 0px', // Start loading when image is 50px away from viewport
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true)
    setIsLoaded(true) // Consider it "loaded" even if it errored
    if (onError) {
      onError(e)
    } else {
      const target = e.currentTarget as HTMLImageElement
      target.src = 'https://via.placeholder.com/150?text=Error'
      target.onerror = null
    }
  }

  return (
    <div 
      ref={imgRef}
      className={`relative ${className}`}
      title={title}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-neutral-700 animate-pulse rounded-lg">
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-slate-300 dark:border-neutral-600 border-t-slate-500 dark:border-t-neutral-400 rounded-full animate-spin"></div>
          </div>
        </div>
      )}
      
      {/* Actual image - only load when in view */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`w-full h-full object-cover transition-all duration-300 ${
            isLoaded 
              ? 'opacity-100 group-hover:scale-105' 
              : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {/* Video overlay */}
      {isVideo && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity duration-300">
          <Video className="h-8 w-8 text-white opacity-80 group-hover:opacity-100" />
        </div>
      )}
    </div>
  )
} 