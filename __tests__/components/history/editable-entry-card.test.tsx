import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistoryEntryCard from '@/components/history/HistoryEntryCard'
import { UnitsProvider } from '@/lib/UnitsContext'
import type { JourneyEntryWithMedia } from '@/types/journey'

// Mock the API calls
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
  notes: 'Original journey notes',
  fromLatitude: 48.8566,
  fromLongitude: 2.3522,
  toLatitude: 51.5074,
  toLongitude: -0.1278,
  media: []
}

describe('Editable HistoryEntryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  })

  const renderCard = (props = {}) => {
    return render(
      <UnitsProvider>
        <HistoryEntryCard 
          journey={mockJourney} 
          isEditable={false}
          {...props}
        />
      </UnitsProvider>
    )
  }

  it('should render in view mode by default', () => {
    renderCard()

    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText(/Original journey notes/)).toBeInTheDocument()
    
    // Should not show edit indicators
    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
  })

  it('should enable edit mode when isEditable prop is true', () => {
    renderCard({ isEditable: true })

    // Should show edit button or indicator
    expect(screen.getByTestId('edit-toggle')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit journey')).toBeInTheDocument()
  })

  it('should allow editing notes field', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    renderCard({ isEditable: true, onUpdate })

    // Click on notes to edit
    const notesElement = screen.getByText(/Original journey notes/)
    await user.click(notesElement)

    // Should show input field
    const input = screen.getByRole('textbox', { name: /notes/i })
    expect(input).toHaveValue('Original journey notes')

    // Update the notes
    await user.clear(input)
    await user.type(input, 'Updated journey notes')
    await user.keyboard('{Enter}')

    // Should call the update handler
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        notes: 'Updated journey notes'
      })
    })
  })

  it('should allow editing telemetry fields', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    renderCard({ isEditable: true, onUpdate })

    // Click on distance to edit
    const distanceElement = screen.getByText(/344/)
    await user.click(distanceElement)

    const input = screen.getByRole('spinbutton', { name: /distance/i })
    await user.clear(input)
    await user.type(input, '350')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        distance: '350'
      })
    })
  })

  it('should batch multiple field updates', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    renderCard({ isEditable: true, onUpdate })

    // Edit multiple fields
    const notesElement = screen.getByText(/Original journey notes/)
    await user.click(notesElement)
    const notesInput = screen.getByRole('textbox', { name: /notes/i })
    await user.clear(notesInput)
    await user.type(notesInput, 'New notes')
    fireEvent.blur(notesInput)

    const distanceElement = screen.getByText(/344/)
    await user.click(distanceElement)
    const distanceInput = screen.getByRole('spinbutton', { name: /distance/i })
    await user.clear(distanceInput)
    await user.type(distanceInput, '400')
    fireEvent.blur(distanceInput)

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Should batch updates in a single call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/journey/test-journey-123'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            notes: 'New notes',
            distance: '400'
          })
        })
      )
    })
  })

  it('should handle save errors gracefully', async () => {
    const user = userEvent.setup()
    const onError = jest.fn()
    
    // Mock API error
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' })
    })
    
    renderCard({ isEditable: true, onError })

    // Edit and save
    const notesElement = screen.getByText(/Original journey notes/)
    await user.click(notesElement)
    const input = screen.getByRole('textbox', { name: /notes/i })
    await user.clear(input)
    await user.type(input, 'New notes{Enter}')

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to save/i)).toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith('Server error')
    })
  })

  it('should show loading state during save', async () => {
    const user = userEvent.setup()
    
    // Mock slow API response
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      }), 100))
    )
    
    renderCard({ isEditable: true })

    const notesElement = screen.getByText(/Original journey notes/)
    await user.click(notesElement)
    const input = screen.getByRole('textbox', { name: /notes/i })
    await user.clear(input)
    await user.type(input, 'New notes{Enter}')

    // Should show loading indicator
    expect(screen.getByTestId('save-loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByTestId('save-loading')).not.toBeInTheDocument()
    })
  })

  it('should allow canceling edits', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    renderCard({ isEditable: true, onUpdate })

    // Start editing
    const notesElement = screen.getByText(/Original journey notes/)
    await user.click(notesElement)
    const input = screen.getByRole('textbox', { name: /notes/i })
    await user.clear(input)
    await user.type(input, 'Changed text')

    // Cancel with Escape
    await user.keyboard('{Escape}')

    // Should revert to original value
    expect(screen.getByText(/Original journey notes/)).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('should validate telemetry inputs', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    renderCard({ isEditable: true, onUpdate })

    // Try to enter invalid distance
    const distanceElement = screen.getByText(/344/)
    await user.click(distanceElement)
    const input = screen.getByRole('spinbutton', { name: /distance/i })
    await user.clear(input)
    await user.type(input, '-100') // Negative distance
    fireEvent.blur(input)

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/must be positive/i)).toBeInTheDocument()
    })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('should handle unit conversions in edit mode', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    // Render with imperial units
    render(
      <UnitsProvider initialUnits={{ distance: 'miles', speed: 'mph' }}>
        <HistoryEntryCard 
          journey={mockJourney} 
          isEditable={true}
          onUpdate={onUpdate}
        />
      </UnitsProvider>
    )

    // Distance should be displayed in miles
    expect(screen.getByText(/213.7/)).toBeInTheDocument() // 344 km = ~213.7 miles

    // Edit in miles
    const distanceElement = screen.getByText(/213.7/)
    await user.click(distanceElement)
    const input = screen.getByRole('spinbutton', { name: /distance/i })
    await user.clear(input)
    await user.type(input, '220') // Enter in miles
    await user.keyboard('{Enter}')

    // Should convert back to km for storage
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        distance: '354.1' // 220 miles = ~354.1 km
      })
    })
  })

  it('should not allow editing when disabled', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    renderCard({ isEditable: false, onUpdate })

    // Try to click on editable fields
    const notesElement = screen.getByText(/Original journey notes/)
    await user.click(notesElement)

    // Should not enter edit mode
    expect(screen.queryByRole('textbox', { name: /notes/i })).not.toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})