import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HistoryEntryCard from '@/components/history/HistoryEntryCard'
import { UnitsProvider } from '@/lib/UnitsContext'
import type { JourneyEntryWithMedia } from '@/types/journey'

// Mock fetch
global.fetch = jest.fn()

const mockJourney: JourneyEntryWithMedia = {
  id: 'test-journey-123',
  fromTown: 'Paris',
  fromCountry: 'France',
  toTown: 'London',
  toCountry: 'UK',
  departureDate: '2024-01-01',
  arrivalDate: '2024-01-02',
  distance: '344',
  averageSpeed: '120',
  maxSpeed: '140',
  notes: 'Test journey',
  media: []
}

describe('Drag and Drop Media Upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        success: true,
        fileId: 'new-file-id',
        webViewLink: 'http://example.com/file'
      })
    })
  })

  const renderCard = (props = {}) => {
    return render(
      <UnitsProvider>
        <HistoryEntryCard 
          journey={mockJourney}
          isEditable={true}
          {...props}
        />
      </UnitsProvider>
    )
  }

  const createMockFile = (name: string, type: string) => {
    return new File(['test content'], name, { type })
  }

  const createDataTransfer = (files: File[]) => {
    return {
      dataTransfer: {
        files,
        items: files.map(file => ({
          kind: 'file',
          type: file.type,
          getAsFile: () => file
        })),
        types: ['Files']
      }
    }
  }

  it('should show drop zone in media gallery area when in edit mode', () => {
    renderCard()

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Drop zone should be present in media area
    const dropZone = screen.getByTestId('media-drop-zone')
    expect(dropZone).toBeInTheDocument()
  })

  it('should not show drop zone when not in edit mode', () => {
    renderCard()

    // Should not have drop zone in view mode
    expect(screen.queryByTestId('media-drop-zone')).not.toBeInTheDocument()
  })

  it('should handle single file drop', async () => {
    const onUpdate = jest.fn()
    renderCard({ onUpdate })

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Drop a file
    const dropZone = screen.getByTestId('media-drop-zone')
    const file = createMockFile('photo.jpg', 'image/jpeg')
    
    fireEvent.drop(dropZone, createDataTransfer([file]))

    // Should upload the file
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/upload-media',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )
    })

    // Verify FormData contains the file and journey ID
    const formData = (fetch as jest.Mock).mock.calls[0][1].body as FormData
    expect(formData.get('file')).toBe(file)
    expect(formData.get('journeyId')).toBe('test-journey-123')
  })

  it('should handle multiple files drop', async () => {
    renderCard()

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Drop multiple files
    const dropZone = screen.getByTestId('media-drop-zone')
    const files = [
      createMockFile('photo1.jpg', 'image/jpeg'),
      createMockFile('photo2.jpg', 'image/jpeg'),
      createMockFile('video.mp4', 'video/mp4')
    ]
    
    fireEvent.drop(dropZone, createDataTransfer(files))

    // Should upload each file
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    // Each call should have the correct journey ID
    for (let i = 0; i < 3; i++) {
      const formData = (fetch as jest.Mock).mock.calls[i][1].body as FormData
      expect(formData.get('journeyId')).toBe('test-journey-123')
    }
  })

  it('should show visual feedback during drag over', () => {
    renderCard()

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    const dropZone = screen.getByTestId('media-drop-zone')
    
    // Start dragging
    fireEvent.dragEnter(dropZone, createDataTransfer([]))
    
    // Should show overlay
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    expect(screen.getByText(/Drop images or videos/i)).toBeInTheDocument()
    
    // Stop dragging
    fireEvent.dragLeave(dropZone)
    
    // Overlay should be hidden
    expect(screen.queryByTestId('drag-overlay')).not.toBeInTheDocument()
  })

  it('should reject non-media files', async () => {
    const onError = jest.fn()
    renderCard({ onError })

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Drop invalid file
    const dropZone = screen.getByTestId('media-drop-zone')
    const file = createMockFile('document.pdf', 'application/pdf')
    
    fireEvent.drop(dropZone, createDataTransfer([file]))

    // Should not upload
    expect(fetch).not.toHaveBeenCalled()
    
    // Should show error
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file type')
      )
    })
  })

  it('should show upload progress indicators', async () => {
    renderCard()

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Mock slow upload
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        }), 100)
      )
    )

    // Drop a file
    const dropZone = screen.getByTestId('media-drop-zone')
    const file = createMockFile('photo.jpg', 'image/jpeg')
    
    fireEvent.drop(dropZone, createDataTransfer([file]))

    // Should show uploading state
    expect(screen.getByText(/Uploading/i)).toBeInTheDocument()
    expect(screen.getByTestId('upload-progress')).toBeInTheDocument()

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.queryByText(/Uploading/i)).not.toBeInTheDocument()
    })
  })

  it('should handle upload errors gracefully', async () => {
    const onError = jest.fn()
    renderCard({ onError })

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Mock upload failure
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Upload failed' })
    })

    // Drop a file
    const dropZone = screen.getByTestId('media-drop-zone')
    const file = createMockFile('photo.jpg', 'image/jpeg')
    
    fireEvent.drop(dropZone, createDataTransfer([file]))

    // Should show error
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to upload photo.jpg')
    })
  })

  it('should enforce file size limits', async () => {
    const onError = jest.fn()
    renderCard({ onError })

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Create a large file
    const largeFile = createMockFile('large.jpg', 'image/jpeg')
    Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 }) // 100MB

    const dropZone = screen.getByTestId('media-drop-zone')
    fireEvent.drop(dropZone, createDataTransfer([largeFile]))

    // Should show error without uploading
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('too large')
      )
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should update media gallery after successful upload', async () => {
    const onUpdate = jest.fn()
    renderCard({ onUpdate })

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Mock successful upload with media details
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        success: true,
        media: {
          id: 'new-media-id',
          name: 'photo.jpg',
          thumbnailLink: 'http://example.com/thumb.jpg',
          webViewLink: 'http://example.com/photo.jpg',
          mimeType: 'image/jpeg',
          journeyId: 'test-journey-123',
          createdTime: '2024-01-01T10:00:00Z'
        }
      })
    })

    // Drop a file
    const dropZone = screen.getByTestId('media-drop-zone')
    const file = createMockFile('photo.jpg', 'image/jpeg')
    
    fireEvent.drop(dropZone, createDataTransfer([file]))

    // Should update the media list
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        media: expect.arrayContaining([
          expect.objectContaining({
            id: 'new-media-id',
            name: 'photo.jpg'
          })
        ])
      })
    })
  })

  it('should work with existing media in gallery', async () => {
    const journeyWithMedia = {
      ...mockJourney,
      media: [{
        id: 'existing-media',
        name: 'existing.jpg',
        thumbnailLink: 'http://example.com/existing-thumb.jpg',
        webViewLink: 'http://example.com/existing.jpg',
        mimeType: 'image/jpeg',
        journeyId: 'test-journey-123',
        createdTime: '2024-01-01T09:00:00Z'
      }]
    }

    render(
      <UnitsProvider>
        <HistoryEntryCard 
          journey={journeyWithMedia}
          isEditable={true}
        />
      </UnitsProvider>
    )

    // Enable edit mode
    const editButton = screen.getByLabelText('Edit journey')
    fireEvent.click(editButton)

    // Should still have drop zone
    const dropZone = screen.getByTestId('media-drop-zone')
    expect(dropZone).toBeInTheDocument()

    // Drop a new file
    const file = createMockFile('new.jpg', 'image/jpeg')
    fireEvent.drop(dropZone, createDataTransfer([file]))

    // Should upload the new file
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/upload-media',
        expect.any(Object)
      )
    })
  })
})