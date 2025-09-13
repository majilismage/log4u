"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

type EnglishName = { city: string; country: string }

// Simple in-memory cache keyed by "lat,lng" string
const cache = new Map<string, EnglishName>()

const hasNonAscii = (s?: string) => !!(s && /[^\u0000-\u007f]/.test(s))

export function useEnglishPlaceName(
  city: string,
  country: string,
  lat?: number,
  lng?: number
) {
  const [names, setNames] = useState<EnglishName>({ city: city || '', country: country || '' })

  const key = useMemo(() => {
    return typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(6)},${lng.toFixed(6)}` : undefined
  }, [lat, lng])

  const shouldLookup = useMemo(() => hasNonAscii(city) || hasNonAscii(country), [city, country])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    // If already English-looking or we lack coordinates, do nothing
    if (!shouldLookup || !key) {
      setNames({ city: city || '', country: country || '' })
      return
    }

    // Serve from cache if available
    const cached = cache.get(key)
    if (cached) {
      setNames(cached)
      return
    }

    const controller = new AbortController()
    ;(async () => {
      try {
        const url = `/api/reverse-geocode?lat=${encodeURIComponent(lat!)}&lng=${encodeURIComponent(lng!)}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`)
        const json = await res.json()
        if (json?.success && json?.data) {
          const english: EnglishName = {
            city: json.data.city || city || '',
            country: json.data.country || country || ''
          }
          cache.set(key, english)
          if (mounted.current) setNames(english)
        } else {
          if (mounted.current) setNames({ city: city || '', country: country || '' })
        }
      } catch {
        if (mounted.current) setNames({ city: city || '', country: country || '' })
      }
    })()

    return () => controller.abort()
  }, [city, country, key, lat, lng, shouldLookup])

  return names
}

