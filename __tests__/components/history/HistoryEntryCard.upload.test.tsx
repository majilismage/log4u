import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import HistoryEntryCard from '@/components/history/HistoryEntryCard'
import type { JourneyEntry } from '@/types/journey'

// Mock window.location.reload before component imports
delete (window as any).location
;(window as any).location = { reload: jest.fn() }

// Mock the API calls
global.fetch = jest.fn()

// Mock the media upload functionality
jest.mock('@/hooks/useEditableJourney', () => ({
  useEditableJourney: jest.fn((journey, options) => ({
    isEditing: true,
    setIsEditing: jest.fn(),
    isSaving: false,
    errors: {},
    updateField: jest.fn(),
    save: jest.fn(),
    cancel: jest.fn(),
    getValue: jest.fn((field) => journey[field]),
    hasChanges: jest.fn(),
    pendingUpdates: {}
  }))
}))

describe('HistoryEntryCard - Sequential Media Upload', () => {
  const mockJourney: JourneyEntry = {
    id: 'test-123',
    journeyId: 'journey-123',
    departureDate: '2024-01-01',
    arrivalDate: '2024-01-02',
    fromTown: 'Paris',
    fromCountry: 'France',
    fromLatitude: '48.8566',
    fromLongitude: '2.3522',
    toTown: 'London',
    toCountry: 'UK',
    toLatitude: '51.5074',
    toLongitude: '-0.1278',
    distance: '450',
    averageSpeed: '85',
    maxSpeed: '120',
    notes: 'Test journey',
    imagesLink: '',
    videosLink: '',
    timestamp: '2024-01-01T12:00:00Z'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockReset()
  })

  it('should stay in edit mode after successful media upload', async () => {
    // Mock successful upload
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        images: ['https://example.com/image1.jpg'],
        videos: []
      })
    })

    const { container } = render(
      <HistoryEntryCard 
        journey={mockJourney}
        units={{ distance: 'km', speed: 'km/h' }}
      />
    )

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Find drop zone
    const dropZone = screen.getByTestId('media-drop-zone')
    expect(dropZone).toBeInTheDocument()

    // Create test file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const dataTransfer = {
      files: [file],
      types: ['Files']
    }

    // Simulate drag and drop
    await act(async () => {
      fireEvent.dragEnter(dropZone, { dataTransfer })
      fireEvent.dragOver(dropZone, { dataTransfer })
      fireEvent.drop(dropZone, { dataTransfer })
    })

    // Verify upload was called
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/media/upload/${mockJourney.id}`,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )
    })

    // Verify still in edit mode
    await waitFor(() => {
      expect(screen.getByTestId('media-drop-zone')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    // Verify no page reload occurred
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('should allow sequential uploads of multiple files', async () => {
    // Mock multiple successful uploads
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: ['https://example.com/image1.jpg'],
          videos: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
          videos: []
        })
      })

    render(
      <HistoryEntryCard 
        journey={mockJourney}
        units={{ distance: 'km', speed: 'km/h' }}
      />
    )

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const dropZone = screen.getByTestId('media-drop-zone')

    // First upload
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const dataTransfer1 = {
      files: [file1],
      types: ['Files']
    }

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: dataTransfer1 })
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    // Verify still in edit mode after first upload
    expect(screen.getByTestId('media-drop-zone')).toBeInTheDocument()

    // Second upload
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    const dataTransfer2 = {
      files: [file2],
      types: ['Files']
    }

    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: dataTransfer2 })
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Verify still in edit mode after second upload
    expect(screen.getByTestId('media-drop-zone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('should update media gallery without page reload', async () => {
    const mockImages = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg'
    ]

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        images: mockImages,
        videos: []
      })
    })

    render(
      <HistoryEntryCard 
        journey={mockJourney}
        units={{ distance: 'km', speed: 'km/h' }}
      />
    )

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Upload file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const dropZone = screen.getByTestId('media-drop-zone')

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      })
    })

    // Wait for media gallery to update
    await waitFor(() => {
      // Verify media is displayed (implementation specific)
      expect(screen.queryByText(/2 images/i)).toBeInTheDocument()
    })

    // Verify no page reload
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('should preserve edit state during upload', async () => {
    ;(fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          images: ['https://example.com/image1.jpg'],
          videos: []
        })
      }), 100))
    )

    render(
      <HistoryEntryCard 
        journey={mockJourney}
        units={{ distance: 'km', speed: 'km/h' }}
      />
    )

    // Enter edit mode and make a change
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Change notes field
    const notesField = screen.getByTestId('notes-edit')
    fireEvent.click(notesField)
    const notesInput = screen.getByRole('textbox', { name: /edit text field/i })
    fireEvent.change(notesInput, { target: { value: 'Updated notes' } })
    fireEvent.blur(notesInput)

    // Upload file while notes change is pending
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const dropZone = screen.getByTestId('media-drop-zone')

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      })
    })

    // Verify upload indicator is shown
    expect(screen.getByTestId('upload-loading')).toBeInTheDocument()

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.queryByTestId('upload-loading')).not.toBeInTheDocument()
    })

    // Verify notes change is preserved
    expect(screen.getByText('Updated notes')).toBeInTheDocument()
    
    // Verify still in edit mode
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('should handle upload errors gracefully', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'))

    render(
      <HistoryEntryCard 
        journey={mockJourney}
        units={{ distance: 'km', speed: 'km/h' }}
      />
    )

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Try to upload file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const dropZone = screen.getByTestId('media-drop-zone')

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      })
    })

    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument()
    })

    // Verify still in edit mode
    expect(screen.getByTestId('media-drop-zone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()

    // Verify no page reload
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('should support batch upload of multiple files', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg'
        ],
        videos: []
      })
    })

    render(
      <HistoryEntryCard 
        journey={mockJourney}
        units={{ distance: 'km', speed: 'km/h' }}
      />
    )

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Upload multiple files at once
    const files = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      new File(['test3'], 'test3.jpg', { type: 'image/jpeg' })
    ]

    const dropZone = screen.getByTestId('media-drop-zone')

    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: files,
          types: ['Files']
        }
      })
    })

    // Verify single batch upload call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      const formData = (fetch as jest.Mock).mock.calls[0][1].body as FormData
      expect(formData.getAll('files')).toHaveLength(3)
    })

    // Verify media count updated
    await waitFor(() => {
      expect(screen.getByText(/3 images/i)).toBeInTheDocument()
    })

    // Verify still in edit mode
    expect(screen.getByTestId('media-drop-zone')).toBeInTheDocument()
  })
})