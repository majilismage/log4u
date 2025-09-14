"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'
import { format, parseISO, isValid } from 'date-fns'

interface ImportCandidate {
  id: string
  sourceRowIndex: number
  departureDate: string
  arrivalDate: string
  fromTown: string
  toTown: string
  fromCountry: string
  toCountry: string
  fromCoordinates?: { lat: number; lng: number }
  toCoordinates?: { lat: number; lng: number }
  distance: string
  averageSpeed: string
  maxSpeed: string
  notes?: string
}

export default function LegacyImportWizard() {
  const [file, setFile] = useState<File | null>(null)
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [index, setIndex] = useState(0)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [lastKnownSeed, setLastKnownSeed] = useState<{ lat: number; lng: number } | undefined>(undefined)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()
  const [existingDatePairs, setExistingDatePairs] = useState<Set<string>>(new Set())

  const current = candidates[index]

  const formatDisplayDate = (value?: string): string => {
    if (!value) return '—'
    // If numeric-like (Excel serial as string), convert
    const numeric = /^[0-9]+(\.[0-9]+)?$/.test(value) ? Number(value) : NaN
    let d: Date | null = null
    if (!Number.isNaN(numeric)) {
      // Excel serial date to JS Date: (serial - 25569) days since Unix epoch
      d = new Date(Math.round((numeric - 25569) * 86400 * 1000))
    } else {
      // Try ISO first
      try {
        const iso = parseISO(value)
        if (isValid(iso)) d = iso
      } catch {}
      // Fallback to Date parse
      if (!d) {
        const nd = new Date(value)
        if (!isNaN(nd.getTime())) d = nd
      }
    }
    return d ? format(d, 'dd MMM yyyy') : value
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null)
  }

  const loadBatch = async (nextOffset: number, seed?: { lat: number; lng: number }) => {
    if (!file) return
    setIsUploading(true)
    try {
      if (existingDatePairs.size === 0) {
        try {
          const hist = await fetch('/api/history')
          if (hist.ok) {
            const json = await hist.json()
            const pairs = new Set<string>()
            const entries = json?.data || []
            entries.forEach((j: any) => {
              const dep = String(j.departureDate || '')
              const arr = String(j.arrivalDate || '')
              if (dep && arr) pairs.add(`${dep}|${arr}`)
            })
            setExistingDatePairs(pairs)
          }
        } catch {}
      }
      const form = new FormData()
      form.append('file', file)
      form.append('offset', String(nextOffset))
      form.append('count', '10')
      if (seed) {
        form.append('seedLat', String(seed.lat))
        form.append('seedLng', String(seed.lng))
      }
      const res = await fetch('/api/import-legacy', { method: 'POST', body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to parse file')
      setCandidates(json.candidates || [])
      setIndex(0)
      setOffset(json.offset || nextOffset)
      setTotal(typeof json.total === 'number' ? json.total : null)
      setLastKnownSeed(json.lastKnown || undefined)
    } catch (e: any) {
      toast({ title: 'Import failed', description: e?.message || 'Could not parse file', variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = async () => {
    await loadBatch(0)
  }

  const approve = async () => {
    if (!current) return
    try {
      const payload = {
        departureDate: current.departureDate,
        arrivalDate: current.arrivalDate,
        fromTown: current.fromTown,
        fromCountry: current.fromCountry,
        fromLat: current.fromCoordinates?.lat,
        fromLng: current.fromCoordinates?.lng,
        toTown: current.toTown,
        toCountry: current.toCountry,
        toLat: current.toCoordinates?.lat,
        toLng: current.toCoordinates?.lng,
        distance: current.distance,
        avgSpeed: current.averageSpeed,
        maxSpeed: current.maxSpeed,
        notes: current.notes || ''
      }
      const res = await fetch('/api/save-entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.status === 401) {
        toast({ title: 'Session expired', description: 'Please sign in again to import.', variant: 'destructive' })
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent('/import')}`
        return
      }
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save entry')
      }
      toast({ title: 'Imported', description: `${current.fromTown} → ${current.toTown}` })
      setIndex(i => Math.min(i + 1, candidates.length))
    } catch (e: any) {
      const message = e?.message || 'Could not save entry'
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    }
  }

  const skip = () => setIndex(i => Math.min(i + 1, candidates.length))

  const isDuplicateByDate = (dep?: string, arr?: string): boolean => {
    if (!dep || !arr) return false
    return existingDatePairs.has(`${dep}|${arr}`)
  }

  // Refinement handlers
  const updateCurrent = (updates: Partial<ImportCandidate>) => {
    setCandidates(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
  }

  return (
    <Card className="dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
      <CardContent className="space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Legacy Import</h1>

        {/* Upload */}
        <div className="flex items-center gap-3">
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="max-w-md" />
          <Button onClick={handleUpload} disabled={!file || isUploading}>{isUploading ? 'Processing…' : 'Upload & Parse'}</Button>
        </div>

        {candidates.length > 0 && index < candidates.length && (
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">
              Reviewing {offset + index + 1} of {total ?? candidates.length}
            </div>

            {isDuplicateByDate(current?.departureDate, current?.arrivalDate) && (
              <div className="p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
                <div className="text-sm font-medium">Potential duplicate</div>
                <div className="text-xs">
                  A journey with the same start and end dates already exists in your history: {formatDisplayDate(current.departureDate)} — {formatDisplayDate(current.arrivalDate)}. You may want to skip this entry.
                </div>
              </div>
            )}

            {/* Map Preview */}
            <div className="bg-muted/30 rounded-md border border-border/50 p-3">
              <div className="text-sm text-muted-foreground mb-2">
                Use the map button in the fields below to review and adjust both locations.
              </div>
              <div className="text-xs text-muted-foreground">
                From: {current.fromTown}, {current.fromCountry}
                {current.fromCoordinates ? ` (${current.fromCoordinates.lat.toFixed(4)}, ${current.fromCoordinates.lng.toFixed(4)})` : ''}
              </div>
              <div className="text-xs text-muted-foreground">
                To: {current.toTown}, {current.toCountry}
                {current.toCoordinates ? ` (${current.toCoordinates.lat.toFixed(4)}, ${current.toCoordinates.lng.toFixed(4)})` : ''}
              </div>
            </div>

            {/* Details and refinement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <LocationAutocomplete
                  label="From"
                  cityValue={current.fromTown}
                  countryValue={current.fromCountry}
                  latValue={current.fromCoordinates?.lat?.toString() || ''}
                  lngValue={current.fromCoordinates?.lng?.toString() || ''}
                  onCityChange={(v) => updateCurrent({ fromTown: v })}
                  onCountryChange={(v) => updateCurrent({ fromCountry: v })}
                  onLatChange={(v) => setCandidates(prev => prev.map((c, i) => {
                    if (i !== index) return c;
                    const lat = parseFloat(v || '0');
                    const prevLng = c.fromCoordinates?.lng ?? 0;
                    return { ...c, fromCoordinates: { lat, lng: prevLng } };
                  }))}
                  onLngChange={(v) => setCandidates(prev => prev.map((c, i) => {
                    if (i !== index) return c;
                    const lng = parseFloat(v || '0');
                    const prevLat = c.fromCoordinates?.lat ?? 0;
                    return { ...c, fromCoordinates: { lat: prevLat, lng } };
                  }))}
                  showMapButton
                  centerOnCurrentValue
                  singleSelectOnly
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <LocationAutocomplete
                  label="To"
                  cityValue={current.toTown}
                  countryValue={current.toCountry}
                  latValue={current.toCoordinates?.lat?.toString() || ''}
                  lngValue={current.toCoordinates?.lng?.toString() || ''}
                  onCityChange={(v) => updateCurrent({ toTown: v })}
                  onCountryChange={(v) => updateCurrent({ toCountry: v })}
                  onLatChange={(v) => setCandidates(prev => prev.map((c, i) => {
                    if (i !== index) return c;
                    const lat = parseFloat(v || '0');
                    const prevLng = c.toCoordinates?.lng ?? 0;
                    return { ...c, toCoordinates: { lat, lng: prevLng } };
                  }))}
                  onLngChange={(v) => setCandidates(prev => prev.map((c, i) => {
                    if (i !== index) return c;
                    const lng = parseFloat(v || '0');
                    const prevLat = c.toCoordinates?.lat ?? 0;
                    return { ...c, toCoordinates: { lat: prevLat, lng } };
                  }))}
                  showMapButton
                  centerOnCurrentValue
                  singleSelectOnly
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Departure</Label>
                <div className="text-sm">{formatDisplayDate(current.departureDate)}</div>
              </div>
              <div>
                <Label>Arrival</Label>
                <div className="text-sm">{formatDisplayDate(current.arrivalDate)}</div>
              </div>
              <div>
                <Label>Distance (nm)</Label>
                <div className="text-sm">{current.distance || '—'}</div>
              </div>
              <div>
                <Label>Avg Speed</Label>
                <div className="text-sm">{current.averageSpeed || '—'}</div>
              </div>
              <div>
                <Label>Max Speed</Label>
                <div className="text-sm">{current.maxSpeed || '—'}</div>
              </div>
              <div className="md:col-span-3">
                <Label>Notes</Label>
                <div className="text-sm whitespace-pre-wrap">{current.notes || '—'}</div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={skip}>Skip</Button>
              <Button onClick={approve} disabled={!current.fromCoordinates || !current.toCoordinates}>Approve & Save</Button>
            </div>
          </div>
        )}

        {candidates.length > 0 && index >= candidates.length && (
          <div className="text-center py-8">
            {total !== null && offset + candidates.length < total ? (
              <>
                <h2 className="text-xl font-semibold mb-2">Batch Complete</h2>
                <p className="text-muted-foreground mb-4">Processed {offset + candidates.length} of {total} entries.</p>
                <Button onClick={() => loadBatch(offset + candidates.length, lastKnownSeed)} disabled={isUploading}>
                  {isUploading ? 'Loading…' : 'Load Next 10'}
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-2">Import Complete</h2>
                <p className="text-muted-foreground">You have reviewed all entries.</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
