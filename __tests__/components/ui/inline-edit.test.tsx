import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InlineEdit from '@/components/ui/inline-edit'

describe('InlineEdit Component', () => {
  const mockOnChange = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should display value in view mode by default', () => {
    render(
      <InlineEdit 
        value="Test Value" 
        onChange={mockOnChange}
      />
    )

    expect(screen.getByText('Test Value')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('should enter edit mode on click', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Test Value" 
        onChange={mockOnChange}
      />
    )

    const viewElement = screen.getByText('Test Value')
    await user.click(viewElement)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Test Value')
  })

  it('should save on blur', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Original" 
        onChange={mockOnChange}
      />
    )

    // Enter edit mode
    await user.click(screen.getByText('Original'))
    
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated')
    
    // Blur the input
    fireEvent.blur(input)

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('Updated')
    })
  })

  it('should save on Enter key', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Original" 
        onChange={mockOnChange}
      />
    )

    await user.click(screen.getByText('Original'))
    
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated{Enter}')

    expect(mockOnChange).toHaveBeenCalledWith('Updated')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('should cancel on Escape key', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Original" 
        onChange={mockOnChange}
        onCancel={mockOnCancel}
      />
    )

    await user.click(screen.getByText('Original'))
    
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Changed')
    await user.keyboard('{Escape}')

    expect(mockOnChange).not.toHaveBeenCalled()
    expect(mockOnCancel).toHaveBeenCalled()
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  it('should validate input based on type', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="100" 
        type="number"
        onChange={mockOnChange}
        validation={(val) => Number(val) > 0 ? null : 'Must be positive'}
      />
    )

    await user.click(screen.getByText('100'))
    
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '-50')
    
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText('Must be positive')).toBeInTheDocument()
    })
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('should show loading state during save', async () => {
    const user = userEvent.setup()
    
    // Mock async onChange
    const slowOnChange = jest.fn(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )
    
    render(
      <InlineEdit 
        value="Original" 
        onChange={slowOnChange}
      />
    )

    await user.click(screen.getByText('Original'))
    
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated{Enter}')

    // Should show loading indicator
    expect(screen.getByTestId('inline-edit-loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByTestId('inline-edit-loading')).not.toBeInTheDocument()
    })
  })

  it('should handle different input types', () => {
    const { rerender } = render(
      <InlineEdit 
        value="2024-01-01" 
        type="date"
        onChange={mockOnChange}
      />
    )

    fireEvent.click(screen.getByText('2024-01-01'))
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'date')

    rerender(
      <InlineEdit 
        value="100" 
        type="number"
        onChange={mockOnChange}
      />
    )

    fireEvent.click(screen.getByText('100'))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
  })

  it('should display placeholder when value is empty', () => {
    render(
      <InlineEdit 
        value="" 
        placeholder="Click to edit"
        onChange={mockOnChange}
      />
    )

    expect(screen.getByText('Click to edit')).toBeInTheDocument()
    expect(screen.getByText('Click to edit')).toHaveClass('text-muted-foreground')
  })

  it('should be disabled when prop is set', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Test" 
        disabled={true}
        onChange={mockOnChange}
      />
    )

    await user.click(screen.getByText('Test'))
    
    // Should not enter edit mode
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('should handle multiline text with textarea', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Line 1\nLine 2" 
        multiline={true}
        onChange={mockOnChange}
      />
    )

    await user.click(screen.getByText(/Line 1/))
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.value).toBe('Line 1\nLine 2')
  })

  it('should not save if value has not changed', async () => {
    const user = userEvent.setup()
    
    render(
      <InlineEdit 
        value="Original" 
        onChange={mockOnChange}
      />
    )

    await user.click(screen.getByText('Original'))
    
    const input = screen.getByRole('textbox')
    fireEvent.blur(input)

    expect(mockOnChange).not.toHaveBeenCalled()
  })
})