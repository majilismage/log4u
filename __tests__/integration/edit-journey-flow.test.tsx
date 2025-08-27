import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitsProvider } from '@/lib/UnitsContext'
import HistoryTab from '@/components/history/HistoryTab'
import type { JourneyEntryWithMedia } from '@/types/journey'

// Mock API responses
global.fetch = jest.fn()

const mockJourneys: JourneyEntryWithMedia[] = [
  {
    id: 'journey-1',
    fromTown: 'Paris',
    fromCountry: 'France',
    toTown: 'London',
    toCountry: 'UK',
    departureDate: '2024-01-01',
    arrivalDate: '2024-01-02',
    distance: '344',
    averageSpeed: '120',
    maxSpeed: '140',
    notes: 'First journey',
    fromLatitude: 48.8566,
    fromLongitude: 2.3522,
    toLatitude: 51.5074,
    toLongitude: -0.1278,
    media: [
      {
        id: 'media-1',
        name: 'photo.jpg',
        thumbnailLink: 'http://example.com/thumb.jpg',
        webViewLink: 'http://example.com/photo.jpg',
        mimeType: 'image/jpeg',
        journeyId: 'journey-1',
        createdTime: '2024-01-01T10:00:00Z'
      }
    ]
  },
  {
    id: 'journey-2',
    fromTown: 'Berlin',
    fromCountry: 'Germany',
    toTown: 'Prague',
    toCountry: 'Czech Republic',
    departureDate: '2024-02-01',
    arrivalDate: '2024-02-02',
    distance: '350',
    averageSpeed: '110',
    maxSpeed: '130',
    notes: 'Second journey',
    media: []
  }
]

describe('Edit Journey Flow - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock initial data fetch
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/history')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockJourneys.map(j => ({
              journeyId: j.id,
              fromTown: j.fromTown,
              fromCountry: j.fromCountry,
              toTown: j.toTown,
              toCountry: j.toCountry,
              departureDate: j.departureDate,
              arrivalDate: j.arrivalDate,
              distance: j.distance,
              averageSpeed: j.averageSpeed,
              maxSpeed: j.maxSpeed,
              notes: j.notes,
              fromLatitude: j.fromLatitude,
              fromLongitude: j.fromLongitude,
              toLatitude: j.toLatitude,
              toLongitude: j.toLongitude
            }))
          })
        })
      }
      
      if (url.includes('/api/get-media')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            mediaByJourneyId: {
              'journey-1': mockJourneys[0].media
            }
          })
        })
      }
      
      if (url.includes('/api/journey/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      }
      
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
  })

  it('should complete full edit workflow', async () => {
    const user = userEvent.setup()
    
    render(
      <UnitsProvider>
        <HistoryTab />
      </UnitsProvider>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })

    // Enable edit mode for first journey
    const editButton = screen.getAllByLabelText('Edit journey')[0]
    await user.click(editButton)

    // Edit the notes field
    const notesField = screen.getByText('First journey')
    await user.click(notesField)
    
    const notesInput = screen.getByRole('textbox', { name: /notes/i })
    await user.clear(notesInput)
    await user.type(notesInput, 'Updated first journey notes')
    
    // Edit the distance field
    const distanceField = screen.getByText(/344/)
    await user.click(distanceField)
    
    const distanceInput = screen.getByRole('spinbutton', { name: /distance/i })
    await user.clear(distanceInput)
    await user.type(distanceInput, '350')
    
    // Save changes
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Verify API call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/journey/journey-1'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            notes: 'Updated first journey notes',
            distance: '350'
          })
        })
      )
    })

    // Verify UI updates
    expect(screen.getByText('Updated first journey notes')).toBeInTheDocument()
    expect(screen.getByText(/350/)).toBeInTheDocument()
    
    // Verify edit mode is exited
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('should handle media upload to existing journey', async () => {
    const user = userEvent.setup()
    
    render(
      <UnitsProvider>
        <HistoryTab />
      </UnitsProvider>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })

    // Enable edit mode for first journey
    const editButton = screen.getAllByLabelText('Edit journey')[0]
    await user.click(editButton)

    // Find add media button
    const addMediaButton = screen.getByRole('button', { name: /add media/i })
    await user.click(addMediaButton)

    // Create a mock file
    const file = new File(['test'], 'test-photo.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/upload/i)
    
    // Mock successful upload
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true,
          fileId: 'new-media-id',
          webViewLink: 'http://example.com/new-photo.jpg'
        })
      })
    )
    
    // Upload file
    await user.upload(fileInput, file)

    // Verify upload API call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload-media'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )
    })

    // Verify the FormData contains journey ID
    const uploadCall = (fetch as jest.Mock).mock.calls.find(
      call => call[0].includes('/api/upload-media')
    )
    const formData = uploadCall[1].body as FormData
    expect(formData.get('journeyId')).toBe('journey-1')
  })

  it('should handle concurrent edit conflicts', async () => {
    const user = userEvent.setup()
    
    render(
      <UnitsProvider>
        <HistoryTab />
      </UnitsProvider>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
      expect(screen.getByText('Berlin')).toBeInTheDocument()
    })

    // Enable edit mode for both journeys
    const editButtons = screen.getAllByLabelText('Edit journey')
    await user.click(editButtons[0])
    await user.click(editButtons[1])

    // Edit first journey
    const firstNotes = screen.getByText('First journey')
    await user.click(firstNotes)
    const firstInput = screen.getAllByRole('textbox', { name: /notes/i })[0]
    await user.clear(firstInput)
    await user.type(firstInput, 'Updated first')

    // Edit second journey
    const secondNotes = screen.getByText('Second journey')
    await user.click(secondNotes)
    const secondInput = screen.getAllByRole('textbox', { name: /notes/i })[1]
    await user.clear(secondInput)
    await user.type(secondInput, 'Updated second')

    // Save both
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    await user.click(saveButtons[0])
    await user.click(saveButtons[1])

    // Verify both API calls are made
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/journey/journey-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ notes: 'Updated first' })
        })
      )
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/journey/journey-2'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ notes: 'Updated second' })
        })
      )
    })
  })

  it('should handle delete journey workflow', async () => {
    const user = userEvent.setup()
    
    // Mock window.confirm
    window.confirm = jest.fn(() => true)
    
    render(
      <UnitsProvider>
        <HistoryTab />
      </UnitsProvider>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })

    // Find delete button for first journey
    const deleteButton = screen.getAllByLabelText('Delete journey')[0]
    await user.click(deleteButton)

    // Confirm deletion
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('delete this journey')
    )

    // Mock successful deletion
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    )

    // Verify delete API call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/journey/journey-1'),
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })

    // Journey should be removed from UI
    await waitFor(() => {
      expect(screen.queryByText('First journey')).not.toBeInTheDocument()
    })
  })

  it('should handle API errors during edit', async () => {
    const user = userEvent.setup()
    
    render(
      <UnitsProvider>
        <HistoryTab />
      </UnitsProvider>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })

    // Enable edit mode
    const editButton = screen.getAllByLabelText('Edit journey')[0]
    await user.click(editButton)

    // Edit notes
    const notesField = screen.getByText('First journey')
    await user.click(notesField)
    const notesInput = screen.getByRole('textbox', { name: /notes/i })
    await user.clear(notesInput)
    await user.type(notesInput, 'Updated notes')

    // Mock API error
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ 
          error: 'Internal server error' 
        })
      })
    )

    // Try to save
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })

    // Original value should be preserved
    expect(screen.getByText('First journey')).toBeInTheDocument()
  })

  it('should handle media deletion', async () => {
    const user = userEvent.setup()
    
    render(
      <UnitsProvider>
        <HistoryTab />
      </UnitsProvider>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
      expect(screen.getByAltText('photo.jpg')).toBeInTheDocument()
    })

    // Enable edit mode
    const editButton = screen.getAllByLabelText('Edit journey')[0]
    await user.click(editButton)

    // Find delete button on media item
    const deleteMediaButton = screen.getByLabelText('Delete photo.jpg')
    await user.click(deleteMediaButton)

    // Mock successful deletion
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    )

    // Verify delete API call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/get-media'),
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ mediaId: 'media-1' })
        })
      )
    })

    // Media should be removed from UI
    await waitFor(() => {
      expect(screen.queryByAltText('photo.jpg')).not.toBeInTheDocument()
    })
  })
})