import * as XLSX from 'xlsx'
import { parse as parseDateFns, isValid as isValidDateFns, format as formatDateFns } from 'date-fns'
import { toIso2 } from './country-codes'
import { nominatimClient } from '@/lib/nominatim-client'

export interface LegacySheetRow {
  departureDate: string
  from: string
  to: string
  arrivalDate: string
  distanceNm?: string | number
  avgSpeed?: string | number
  maxSpeed?: string | number
  totalDistance?: string | number
  country?: string
  notes?: string
  migrated?: string
}

export interface GeoPoint { lat: number; lng: number }

export interface ImportCandidate {
  id: string
  sourceRowIndex: number
  raw: LegacySheetRow
  departureDate: string
  arrivalDate: string
  fromTown: string
  toTown: string
  fromCountry: string
  toCountry: string
  fromCoordinates?: GeoPoint
  toCoordinates?: GeoPoint
  distance: string
  averageSpeed: string
  maxSpeed: string
  notes?: string
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeDateToIso(value: any): string {
  if (value === undefined || value === null) return ''
  const s = String(value).trim()
  // Already ISO yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = Number(s)
    if (num > 20000 && num < 60000) {
      const ms = Math.round((num - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    }
  }
  // Try common US formats
  const tryFormats = ['M/d/yy', 'MM/dd/yy', 'M/d/yyyy', 'MM/dd/yyyy']
  for (const fmt of tryFormats) {
    try {
      const d = parseDateFns(s, fmt, new Date())
      if (isValidDateFns(d)) return formatDateFns(d, 'yyyy-MM-dd')
    } catch {}
  }
  // Fallback Date parsing
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return s // last resort, return original
}

export function parseLegacyWorkbook(buffer: Buffer): LegacySheetRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

  // Attempt to map flexible headers
  return json.map((row, idx) => {
    const mapped: Record<string, any> = {}
    for (const [key, val] of Object.entries(row)) {
      mapped[normalizeHeader(String(key))] = val
    }
    const rec: LegacySheetRow = {
      departureDate: mapped['departure date'] ?? mapped['start date'] ?? mapped['depart'] ?? '',
      from: mapped['from'] ?? mapped['start'] ?? '',
      to: mapped['to'] ?? mapped['destination'] ?? '',
      arrivalDate: mapped['arrival date'] ?? mapped['end date'] ?? mapped['arrive'] ?? '',
      distanceNm: mapped['distance (nm)'] ?? mapped['distance nm'] ?? mapped['distance'] ?? '',
      avgSpeed: mapped['avg speed'] ?? mapped['average speed'] ?? '',
      maxSpeed: mapped['max speed'] ?? '',
      totalDistance: mapped['total distance'] ?? '',
      country: mapped['country'] ?? '',
      notes: mapped['notes'] ?? '',
      migrated: mapped['migrated'] ?? ''
    }
    return rec
  })
}

export async function geocodePlace(
  name: string,
  country?: string,
  lastKnown?: GeoPoint
): Promise<GeoPoint | undefined> {
  if (!name || name.trim() === '') return undefined
  const iso2 = toIso2(country || '')
  try {
    const results = await nominatimClient.search({ query: name, limit: 5, countrycodes: iso2 })
    if (!results || results.length === 0) return undefined
    if (lastKnown) {
      // pick the closest to lastKnown
      const withDist = results.map(r => ({
        lat: r.lat,
        lng: r.lng,
        dist: Math.hypot(r.lat - lastKnown.lat, r.lng - lastKnown.lng)
      }))
      withDist.sort((a, b) => a.dist - b.dist)
      const best = withDist[0]
      return { lat: best.lat, lng: best.lng }
    }
    return { lat: results[0].lat, lng: results[0].lng }
  } catch (e) {
    return undefined
  }
}

export async function buildImportCandidates(
  rows: LegacySheetRow[],
  seedLastKnown?: GeoPoint
): Promise<{ candidates: ImportCandidate[]; lastKnown?: GeoPoint }> {
  const candidates: ImportCandidate[] = []
  let lastKnown: GeoPoint | undefined = seedLastKnown

  const isYes = (v?: string) => typeof v === 'string' && v.trim().toLowerCase() === 'yes'
  const eligibleRows = rows.filter(r => !isYes(r.migrated))

  for (let i = 0; i < eligibleRows.length; i++) {
    const r = eligibleRows[i]
    const fromTown = String(r.from || '').trim()
    const toTown = String(r.to || '').trim()
    const country = String(r.country || '').trim()
    const fromCountry = country || ''
    const toCountry = country || ''

    const fromCoordinates = await geocodePlace(fromTown, country, lastKnown)
    const toCoordinates = await geocodePlace(toTown, country, fromCoordinates || lastKnown)

    if (toCoordinates) lastKnown = toCoordinates

    const distance = String(r.distanceNm ?? '')
    const avg = String(r.avgSpeed ?? '')
    const max = String(r.maxSpeed ?? '')

    candidates.push({
      id: `import-${i}`,
      sourceRowIndex: i,
      raw: r,
      departureDate: normalizeDateToIso(r.departureDate),
      arrivalDate: normalizeDateToIso(r.arrivalDate),
      fromTown,
      toTown,
      fromCountry,
      toCountry,
      fromCoordinates,
      toCoordinates,
      distance,
      averageSpeed: avg,
      maxSpeed: max,
      notes: r.notes || ''
    })
  }
  return { candidates, lastKnown }
}
