import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/google-api-client'
import { google } from 'googleapis'
import { z } from 'zod'

// Validation schema for journey updates
const updateSchema = z.object({
  departureDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  fromTown: z.string().optional(),
  fromCountry: z.string().optional(),
  fromLatitude: z.number().optional(),
  fromLongitude: z.number().optional(),
  toTown: z.string().optional(),
  toCountry: z.string().optional(),
  toLatitude: z.number().optional(),
  toLongitude: z.number().optional(),
  distance: z.string().refine(val => !val || Number(val) > 0, 'Distance must be positive').optional(),
  averageSpeed: z.string().refine(val => !val || Number(val) >= 0, 'Speed must be non-negative').optional(),
  maxSpeed: z.string().refine(val => !val || Number(val) >= 0, 'Speed must be non-negative').optional(),
  notes: z.string().optional()
}).strict() // Reject unknown fields like journeyId

// Column mapping for Google Sheets
const COLUMN_MAP: Record<string, string> = {
  departureDate: 'B',
  arrivalDate: 'C',
  fromTown: 'D',
  fromCountry: 'E',
  fromLatitude: 'F',
  fromLongitude: 'G',
  toTown: 'H',
  toCountry: 'I',
  toLatitude: 'J',
  toLongitude: 'K',
  distance: 'L',
  averageSpeed: 'M',
  maxSpeed: 'N',
  notes: 'O'
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const journeyId = params.id
    const body = await request.json()

    // Validate input
    const validationResult = updateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validationResult.error.message}` },
        { status: 400 }
      )
    }

    const updates = validationResult.data
    
    // Get authenticated client
    const { auth, googleSheetsId } = await getAuthenticatedClient()
    if (!googleSheetsId) {
      return NextResponse.json(
        { error: 'Google Sheet not configured' },
        { status: 400 }
      )
    }

    const sheets = google.sheets({ version: 'v4', auth })

    // Find the row with the journey ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:R' // Skip header row
    })

    const rows = response.data.values || []
    const rowIndex = rows.findIndex(row => row[0] === journeyId)
    
    if (rowIndex === -1) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      )
    }

    // Prepare batch update request
    const updateData = []
    for (const [field, value] of Object.entries(updates)) {
      const column = COLUMN_MAP[field]
      if (column) {
        const rowNumber = rowIndex + 2 // +1 for 0-index, +1 for header row
        updateData.push({
          range: `${column}${rowNumber}`,
          values: [[value]]
        })
      }
    }

    // Execute batch update
    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: googleSheetsId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      updated: Object.keys(updates)
    })
  } catch (error) {
    console.error('Error updating journey:', error)
    return NextResponse.json(
      { error: 'Failed to update journey' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const journeyId = params.id

    // Get authenticated client
    const { auth, googleSheetsId } = await getAuthenticatedClient()
    if (!googleSheetsId) {
      return NextResponse.json(
        { error: 'Google Sheet not configured' },
        { status: 400 }
      )
    }

    const sheets = google.sheets({ version: 'v4', auth })

    // Find the row with the journey ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsId,
      range: 'A2:R'
    })

    const rows = response.data.values || []
    const rowIndex = rows.findIndex(row => row[0] === journeyId)
    
    if (rowIndex === -1) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      )
    }

    // Delete the row using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: googleSheetsId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0, // Default first sheet
              dimension: 'ROWS',
              startIndex: rowIndex + 1, // +1 for header row
              endIndex: rowIndex + 2
            }
          }
        }]
      }
    })

    return NextResponse.json({ 
      success: true,
      deleted: journeyId
    })
  } catch (error) {
    console.error('Error deleting journey:', error)
    return NextResponse.json(
      { error: 'Failed to delete journey' },
      { status: 500 }
    )
  }
}