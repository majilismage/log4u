import { NextRequest } from 'next/server'
import { PUT, DELETE } from '@/app/api/journey/[id]/route'
import { getAuthenticatedClient } from '@/lib/google-api-client'
import { google } from 'googleapis'

// Mock dependencies
jest.mock('@/lib/google-api-client')
jest.mock('googleapis')

describe('Journey Update API', () => {
  const mockAuth = {}
  const mockSheetsId = 'test-sheet-id'
  const mockJourneyId = 'test-journey-id'
  const mockSheets = {
    spreadsheets: {
      values: {
        get: jest.fn(),
        batchUpdate: jest.fn()
      }
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedClient as jest.Mock).mockResolvedValue({
      auth: mockAuth,
      googleSheetsId: mockSheetsId
    })
    ;(google.sheets as jest.Mock).mockReturnValue(mockSheets)
  })

  describe('PUT - Update Journey', () => {
    it('should update a single field successfully', async () => {
      // Arrange
      const mockRow = [
        mockJourneyId, '2024-01-01', '2024-01-02', 'Paris', 'France',
        '48.8566', '2.3522', 'London', 'UK', '51.5074', '-0.1278',
        '344', '120', '140', 'Original notes', '', '', '2024-01-01T10:00:00Z'
      ]
      
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [mockRow] }
      })
      
      mockSheets.spreadsheets.values.batchUpdate.mockResolvedValue({
        data: { responses: [{ updatedCells: 1 }] }
      })

      const request = new NextRequest('http://localhost:3000/api/journey/test-journey-id', {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Updated notes' })
      })

      // Act
      const response = await PUT(request, { params: { id: mockJourneyId } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockSheets.spreadsheets.values.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: mockSheetsId,
          requestBody: expect.objectContaining({
            data: expect.arrayContaining([
              expect.objectContaining({
                range: expect.stringMatching(/O\d+/), // Notes column
                values: [['Updated notes']]
              })
            ])
          })
        })
      )
    })

    it('should update multiple fields in a single request', async () => {
      // Arrange
      const mockRow = [
        mockJourneyId, '2024-01-01', '2024-01-02', 'Paris', 'France',
        '48.8566', '2.3522', 'London', 'UK', '51.5074', '-0.1278',
        '344', '120', '140', 'Original notes', '', '', '2024-01-01T10:00:00Z'
      ]
      
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [mockRow] }
      })
      
      const updates = {
        notes: 'Updated notes',
        distance: '350',
        averageSpeed: '125'
      }

      const request = new NextRequest('http://localhost:3000/api/journey/test-journey-id', {
        method: 'PUT',
        body: JSON.stringify(updates)
      })

      // Act
      const response = await PUT(request, { params: { id: mockJourneyId } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockSheets.spreadsheets.values.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            data: expect.arrayContaining([
              expect.objectContaining({ values: [['350']] }),     // Distance
              expect.objectContaining({ values: [['125']] }),     // Avg Speed
              expect.objectContaining({ values: [['Updated notes']] }) // Notes
            ])
          })
        })
      )
    })

    it('should return 404 for non-existent journey ID', async () => {
      // Arrange
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] }
      })

      const request = new NextRequest('http://localhost:3000/api/journey/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Test' })
      })

      // Act
      const response = await PUT(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toBe('Journey not found')
    })

    it('should validate field types', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/journey/test-journey-id', {
        method: 'PUT',
        body: JSON.stringify({ 
          distance: 'invalid-number',
          averageSpeed: -50 // Negative speed
        })
      })

      // Act
      const response = await PUT(request, { params: { id: mockJourneyId } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('validation')
    })

    it('should maintain data integrity by not updating journey ID', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/journey/test-journey-id', {
        method: 'PUT',
        body: JSON.stringify({ 
          journeyId: 'new-id', // Should be ignored
          notes: 'Updated notes'
        })
      })

      const mockRow = [mockJourneyId, '2024-01-01', '2024-01-02']
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [mockRow] }
      })

      // Act
      const response = await PUT(request, { params: { id: mockJourneyId } })

      // Assert
      expect(response.status).toBe(200)
      // Verify journeyId field was not included in update
      expect(mockSheets.spreadsheets.values.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            data: expect.not.arrayContaining([
              expect.objectContaining({
                range: expect.stringMatching(/A\d+/) // Journey ID column
              })
            ])
          })
        })
      )
    })

    it('should handle Google API errors gracefully', async () => {
      // Arrange
      mockSheets.spreadsheets.values.get.mockRejectedValue(
        new Error('Google API error')
      )

      const request = new NextRequest('http://localhost:3000/api/journey/test-journey-id', {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Test' })
      })

      // Act
      const response = await PUT(request, { params: { id: mockJourneyId } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update journey')
    })
  })

  describe('DELETE - Delete Journey', () => {
    it('should delete a journey successfully', async () => {
      // Arrange
      const mockRows = [
        [mockJourneyId, '2024-01-01', '2024-01-02'],
        ['other-id', '2024-01-03', '2024-01-04']
      ]
      
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockRows }
      })
      
      mockSheets.spreadsheets.values.batchUpdate.mockResolvedValue({
        data: { responses: [{ updatedRows: 1 }] }
      })

      const request = new NextRequest('http://localhost:3000/api/journey/test-journey-id', {
        method: 'DELETE'
      })

      // Act
      const response = await DELETE(request, { params: { id: mockJourneyId } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockSheets.spreadsheets.values.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            data: expect.arrayContaining([
              expect.objectContaining({
                deleteDimension: expect.objectContaining({
                  range: expect.objectContaining({
                    dimension: 'ROWS',
                    startIndex: 1, // Row 2 (0-indexed + header)
                    endIndex: 2
                  })
                })
              })
            ])
          })
        })
      )
    })

    it('should return 404 when deleting non-existent journey', async () => {
      // Arrange
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] }
      })

      const request = new NextRequest('http://localhost:3000/api/journey/non-existent', {
        method: 'DELETE'
      })

      // Act
      const response = await DELETE(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toBe('Journey not found')
    })
  })
})