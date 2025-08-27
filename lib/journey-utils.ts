import { google } from 'googleapis'
import type { JourneyEntry } from '@/types/journey'

// Column headers matching the sheet structure
export const SHEET_COLUMNS = [
  'journeyId', 'departureDate', 'arrivalDate', 'fromTown', 'fromCountry',
  'fromLatitude', 'fromLongitude', 'toTown', 'toCountry', 'toLatitude',
  'toLongitude', 'distance', 'averageSpeed', 'maxSpeed', 'notes',
  'imagesLink', 'videosLink', 'timestamp'
] as const

// Type-safe column index mapping
export const getColumnIndex = (field: keyof JourneyEntry): number => {
  const index = SHEET_COLUMNS.indexOf(field as any)
  return index !== -1 ? index : -1
}

// Convert column index to letter (0 = A, 1 = B, etc.)
export const getColumnLetter = (index: number): string => {
  return String.fromCharCode(65 + index)
}

/**
 * Update a journey row in Google Sheets
 * Reusable for both create and update operations
 */
export async function updateJourneyRow(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  journeyId: string,
  updates: Partial<JourneyEntry>,
  rowNumber?: number
) {
  // If no row number provided, find it
  if (!rowNumber) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:A' // Just get journey IDs
    })
    
    const ids = response.data.values?.map(row => row[0]) || []
    const rowIndex = ids.indexOf(journeyId)
    
    if (rowIndex === -1) {
      throw new Error('Journey not found')
    }
    
    rowNumber = rowIndex + 2 // +1 for 0-index, +1 for header
  }

  // Build batch update data
  const updateData = []
  for (const [field, value] of Object.entries(updates)) {
    if (field === 'id' || field === 'journeyId') continue // Skip ID updates
    
    const columnIndex = getColumnIndex(field as keyof JourneyEntry)
    if (columnIndex !== -1) {
      const column = getColumnLetter(columnIndex)
      updateData.push({
        range: `${column}${rowNumber}`,
        values: [[value]]
      })
    }
  }

  // Execute batch update
  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateData
      }
    })
  }

  return { success: true, updatedFields: updateData.length }
}

/**
 * Format journey data for display with units
 */
export function formatJourneyDisplay(
  journey: JourneyEntry,
  units: { distance: string; speed: string }
): JourneyEntry {
  // Already handled by unit conversion utilities
  // This is just a placeholder for any additional formatting needs
  return journey
}

/**
 * Validate journey data before save
 */
export function validateJourneyData(data: Partial<JourneyEntry>): string[] {
  const errors: string[] = []
  
  // Check numeric fields
  if (data.distance !== undefined) {
    const dist = Number(data.distance)
    if (isNaN(dist) || dist < 0) {
      errors.push('Distance must be a positive number')
    }
  }
  
  if (data.averageSpeed !== undefined) {
    const speed = Number(data.averageSpeed)
    if (isNaN(speed) || speed < 0) {
      errors.push('Average speed must be a positive number')
    }
  }
  
  if (data.maxSpeed !== undefined) {
    const speed = Number(data.maxSpeed)
    if (isNaN(speed) || speed < 0) {
      errors.push('Max speed must be a positive number')
    }
  }
  
  // Check date formats
  if (data.departureDate && !isValidDate(data.departureDate)) {
    errors.push('Invalid departure date format')
  }
  
  if (data.arrivalDate && !isValidDate(data.arrivalDate)) {
    errors.push('Invalid arrival date format')
  }
  
  // Check date logic
  if (data.departureDate && data.arrivalDate) {
    const dep = new Date(data.departureDate)
    const arr = new Date(data.arrivalDate)
    if (arr < dep) {
      errors.push('Arrival date must be after departure date')
    }
  }
  
  return errors
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Merge updates with existing journey data
 */
export function mergeJourneyUpdates(
  existing: JourneyEntry,
  updates: Partial<JourneyEntry>
): JourneyEntry {
  return {
    ...existing,
    ...updates,
    id: existing.id // Never update ID
  }
}