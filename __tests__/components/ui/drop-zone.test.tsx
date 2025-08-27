import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DropZone from '@/components/ui/drop-zone'

describe('DropZone Component', () => {
  const mockOnDrop = jest.fn()
  const mockOnError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockFile = (name: string, type: string, size: number = 1024) => {
    const file = new File(['test'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  const createMockDataTransfer = (files: File[]) => {
    return {
      dataTransfer: {
        files,
        items: files.map(file => ({
          kind: 'file',
          type: file.type,
          getAsFile: () => file
        })),
        types: ['Files'],
        effectAllowed: 'all',
        dropEffect: 'copy'
      }
    }
  }

  it('should render children content', () => {
    render(
      <DropZone onDrop={mockOnDrop}>
        <div>Drop files here</div>
      </DropZone>
    )

    expect(screen.getByText('Drop files here')).toBeInTheDocument()
  })

  it('should show drag overlay when dragging over', () => {
    render(
      <DropZone onDrop={mockOnDrop}>
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    
    fireEvent.dragEnter(dropZone, createMockDataTransfer([]))
    
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    expect(screen.getByText(/Drop files to upload/i)).toBeInTheDocument()
  })

  it('should hide drag overlay when dragging leaves', () => {
    render(
      <DropZone onDrop={mockOnDrop}>
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    
    fireEvent.dragEnter(dropZone, createMockDataTransfer([]))
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    
    fireEvent.dragLeave(dropZone)
    expect(screen.queryByTestId('drag-overlay')).not.toBeInTheDocument()
  })

  it('should handle file drop for valid media files', async () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        accept="image/*,video/*"
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const validFiles = [
      createMockFile('photo.jpg', 'image/jpeg'),
      createMockFile('video.mp4', 'video/mp4')
    ]
    
    fireEvent.dragEnter(dropZone, createMockDataTransfer([]))
    fireEvent.drop(dropZone, createMockDataTransfer(validFiles))

    await waitFor(() => {
      expect(mockOnDrop).toHaveBeenCalledWith(validFiles)
    })
    
    // Overlay should be hidden after drop
    expect(screen.queryByTestId('drag-overlay')).not.toBeInTheDocument()
  })

  it('should reject invalid file types', async () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        onError={mockOnError}
        accept="image/*"
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const mixedFiles = [
      createMockFile('photo.jpg', 'image/jpeg'),
      createMockFile('document.pdf', 'application/pdf') // Invalid
    ]
    
    fireEvent.drop(dropZone, createMockDataTransfer(mixedFiles))

    await waitFor(() => {
      // Should only call onDrop with valid files
      expect(mockOnDrop).toHaveBeenCalledWith([mixedFiles[0]])
      // Should report error for invalid files
      expect(mockOnError).toHaveBeenCalledWith('Some files were rejected: document.pdf')
    })
  })

  it('should enforce max file size limit', async () => {
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    render(
      <DropZone 
        onDrop={mockOnDrop}
        onError={mockOnError}
        maxSize={maxSize}
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const files = [
      createMockFile('small.jpg', 'image/jpeg', 1024), // 1KB - valid
      createMockFile('large.jpg', 'image/jpeg', 10 * 1024 * 1024) // 10MB - too large
    ]
    
    fireEvent.drop(dropZone, createMockDataTransfer(files))

    await waitFor(() => {
      expect(mockOnDrop).toHaveBeenCalledWith([files[0]])
      expect(mockOnError).toHaveBeenCalledWith('Some files were too large: large.jpg')
    })
  })

  it('should handle multiple files when multiple prop is true', async () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        multiple={true}
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const files = [
      createMockFile('photo1.jpg', 'image/jpeg'),
      createMockFile('photo2.jpg', 'image/jpeg'),
      createMockFile('photo3.jpg', 'image/jpeg')
    ]
    
    fireEvent.drop(dropZone, createMockDataTransfer(files))

    await waitFor(() => {
      expect(mockOnDrop).toHaveBeenCalledWith(files)
    })
  })

  it('should only accept first file when multiple is false', async () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        multiple={false}
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const files = [
      createMockFile('photo1.jpg', 'image/jpeg'),
      createMockFile('photo2.jpg', 'image/jpeg')
    ]
    
    fireEvent.drop(dropZone, createMockDataTransfer(files))

    await waitFor(() => {
      expect(mockOnDrop).toHaveBeenCalledWith([files[0]])
    })
  })

  it('should prevent default drag behaviors', () => {
    render(
      <DropZone onDrop={mockOnDrop}>
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    
    const dragOverEvent = new Event('dragover', { bubbles: true })
    const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault')
    
    fireEvent(dropZone, dragOverEvent)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should be disabled when prop is set', () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        disabled={true}
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const file = createMockFile('photo.jpg', 'image/jpeg')
    
    fireEvent.drop(dropZone, createMockDataTransfer([file]))
    
    expect(mockOnDrop).not.toHaveBeenCalled()
  })

  it('should show custom overlay content', () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        overlayContent="Custom drop message"
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    
    fireEvent.dragEnter(dropZone, createMockDataTransfer([]))
    
    expect(screen.getByText('Custom drop message')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <DropZone 
        onDrop={mockOnDrop}
        className="custom-class"
      >
        <div>Content</div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    expect(dropZone).toHaveClass('custom-class')
  })

  it('should handle drag counter correctly for nested elements', () => {
    render(
      <DropZone onDrop={mockOnDrop}>
        <div>
          <span>Nested content</span>
        </div>
      </DropZone>
    )

    const dropZone = screen.getByTestId('drop-zone')
    const nestedElement = screen.getByText('Nested content')
    
    // Enter parent
    fireEvent.dragEnter(dropZone, createMockDataTransfer([]))
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    
    // Enter nested element (shouldn't hide overlay)
    fireEvent.dragEnter(nestedElement, createMockDataTransfer([]))
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    
    // Leave nested element (shouldn't hide overlay)
    fireEvent.dragLeave(nestedElement)
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    
    // Leave parent (should hide overlay)
    fireEvent.dragLeave(dropZone)
    expect(screen.queryByTestId('drag-overlay')).not.toBeInTheDocument()
  })
})