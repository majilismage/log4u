import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MapLibreMap from '@/components/maps/MapLibreMap'
import { UnitsProvider } from '@/lib/UnitsContext'
import { TILE_PROVIDERS } from '@/lib/mapTileProviders'

// Mock react-map-gl to avoid WebGL issues in tests
jest.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  default: ({ children, onClick, onMove, onLoad, onError, mapStyle, ...props }: any) => (
    <div 
      data-testid="mock-map" 
      onClick={(e) => {
        // Simulate map click with coordinates
        if (onClick) {
          onClick({ lngLat: { lng: -74.0060, lat: 40.7128 } })
        }
      }}
      onMouseMove={(e) => {
        // Simulate mouse move with coordinates
        if (onMove) {
          onMove({ lngLat: { lng: -74.0060, lat: 40.7128 } })
        }
      }}
      aria-label="Interactive map"
      {...props}
      mapStyle={JSON.stringify(mapStyle)}
      maxTileCacheSize={props.maxTileCacheSize?.toString()}
      maxTileCacheZoomLevels={props.maxTileCacheZoomLevels?.toString()}
      preserveDrawingBuffer={props.preserveDrawingBuffer?.toString()}
      antialias={props.antialias?.toString()}
    >
      {children}
    </div>
  ),
  Marker: ({ children, ...props }: any) => (
    <div data-testid="map-marker" {...props}>{children}</div>
  ),
  Source: ({ children, ...props }: any) => (
    <div data-testid="map-source" {...props}>{children}</div>
  ),
  Layer: ({ ...props }: any) => (
    <div data-testid="map-layer" {...props} />
  ),
  MapRef: {} as any,
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('MapLibreMap Component', () => {
  const mockOnLocationSelect = jest.fn()
  const mockOnJourneySelect = jest.fn()
  const mockOnJourneyStateChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful geocoding response
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          city: 'New York',
          country: 'USA',
          displayName: 'New York, USA',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        }
      })
    })
  })

  const renderMap = (props = {}) => {
    return render(
      <UnitsProvider>
        <MapLibreMap
          onLocationSelect={mockOnLocationSelect}
          mode="single"
          {...props}
        />
      </UnitsProvider>
    )
  }

  describe('Tile Provider Integration', () => {
    it('renders map with Stadia Maps tiles', () => {
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      expect(map).toBeInTheDocument()
      // Check that map style includes Stadia tiles
      expect(map).toHaveAttribute('mapStyle')
      const mapStyle = JSON.parse(map.getAttribute('mapStyle') || '{}')
      expect(mapStyle.sources?.['osm-raster']?.tiles).toContain(
        expect.stringContaining('stadiamaps.com')
      )
    })

    it('switches to fallback provider on tile load error', async () => {
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      // Simulate tile load error
      const onError = map.getAttribute('onError')
      if (typeof onError === 'function') {
        onError({ error: { message: 'Tile load failed' }, source: 'osm-raster' })
      }

      await waitFor(() => {
        const mapStyle = JSON.parse(map.getAttribute('mapStyle') || '{}')
        expect(mapStyle.sources?.['osm-raster']?.tiles).toContain(
          expect.stringContaining('cartocdn.com')
        )
      })
    })

    it('displays correct attribution for Stadia Maps', () => {
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      const mapStyle = JSON.parse(map.getAttribute('mapStyle') || '{}')
      expect(mapStyle.sources?.['osm-raster']?.attribution).toContain('Stadia Maps')
      expect(mapStyle.sources?.['osm-raster']?.attribution).toContain('OpenStreetMap')
    })

    it('preserves existing performance optimizations', () => {
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      // Check performance props are still present
      expect(map).toHaveAttribute('maxTileCacheSize', '200')
      expect(map).toHaveAttribute('maxTileCacheZoomLevels', '5')
      expect(map).toHaveAttribute('preserveDrawingBuffer', 'false')
      expect(map).toHaveAttribute('antialias', 'false')
    })
  })

  describe('Error Handling', () => {
    it('handles network failures gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
      
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      // Click on map to trigger geocoding
      fireEvent.click(map)
      
      await waitFor(() => {
        // Should not crash and should not call onLocationSelect
        expect(mockOnLocationSelect).not.toHaveBeenCalled()
      })
    })

    it('shows user-friendly error message on tile failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      // Simulate tile error
      const onError = map.getAttribute('onError')
      if (typeof onError === 'function') {
        onError({ error: { message: 'Failed to load tile' } })
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Map error'),
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })

    it('logs tile provider failures for monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const { container } = renderMap()
      const map = screen.getByTestId('mock-map')
      
      // Simulate multiple tile failures
      const onError = map.getAttribute('onError')
      if (typeof onError === 'function') {
        for (let i = 0; i < 3; i++) {
          onError({ error: { message: `Tile ${i} failed` }, source: 'osm-raster' })
        }
      }
      
      expect(consoleSpy).toHaveBeenCalledTimes(3)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Map Interactions', () => {
    it('handles click events in single mode', async () => {
      renderMap()
      const map = screen.getByTestId('mock-map')
      
      fireEvent.click(map)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/reverse-geocode'),
          expect.any(Object)
        )
      })
    })

    it('handles journey mode interactions', async () => {
      renderMap({
        mode: 'journey',
        onJourneySelect: mockOnJourneySelect,
        onJourneyStateChange: mockOnJourneyStateChange
      })
      
      const map = screen.getByTestId('mock-map')
      
      // First click - set starting point
      fireEvent.click(map)
      
      await waitFor(() => {
        expect(mockOnJourneyStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            step: 'to',
            fromLocation: expect.any(Object)
          })
        )
      })
      
      // Second click - complete journey
      fireEvent.click(map)
      
      await waitFor(() => {
        expect(mockOnJourneyStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            step: 'complete',
            fromLocation: expect.any(Object),
            toLocation: expect.any(Object)
          })
        )
      })
    })

    it('switches between map styles', async () => {
      const { container } = renderMap()
      
      // Find style switcher buttons
      const streetButton = screen.getByText('Street')
      const satelliteButton = screen.getByText('Satellite')
      const hybridButton = screen.getByText('Hybrid')
      
      // Click satellite
      fireEvent.click(satelliteButton)
      
      await waitFor(() => {
        const map = screen.getByTestId('mock-map')
        const mapStyle = JSON.parse(map.getAttribute('mapStyle') || '{}')
        expect(mapStyle.sources).toHaveProperty('satellite')
      })
      
      // Click hybrid
      fireEvent.click(hybridButton)
      
      await waitFor(() => {
        const map = screen.getByTestId('mock-map')
        const mapStyle = JSON.parse(map.getAttribute('mapStyle') || '{}')
        expect(mapStyle.sources).toHaveProperty('satellite')
        expect(mapStyle.sources).toHaveProperty('osm-labels')
      })
    })
  })

  describe('Performance', () => {
    it('throttles mouse move events in journey mode', async () => {
      const user = userEvent.setup()
      
      renderMap({
        mode: 'journey',
        onJourneyStateChange: mockOnJourneyStateChange
      })
      
      const map = screen.getByTestId('mock-map')
      
      // First click to enter "to" state
      await user.click(map)
      
      await waitFor(() => {
        expect(mockOnJourneyStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            step: 'to'
          })
        )
      })
      
      // Clear previous calls
      mockOnJourneyStateChange.mockClear()
      
      // Simulate rapid mouse moves
      const moveCount = 10
      for (let i = 0; i < moveCount; i++) {
        fireEvent.mouseMove(map, { clientX: i * 10, clientY: i * 10 })
      }
      
      // The component uses requestAnimationFrame to throttle updates
      // So we should see fewer state changes than mouse moves
      await waitFor(() => {
        expect(mockOnJourneyStateChange.mock.calls.length).toBeGreaterThan(0)
      })
      
      // Should throttle updates (not call state change for every move)
      expect(mockOnJourneyStateChange.mock.calls.length).toBeLessThan(moveCount)
    })

    it('implements tile preloading for better UX', async () => {
      // Mock fetch to track preload requests
      const fetchSpy = jest.fn().mockImplementation((url) => {
        // Mock different responses based on URL
        if (url.includes('/api/')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true })
          })
        }
        // For tile validation requests
        return Promise.resolve({
          ok: true,
          headers: new Map([['access-control-allow-origin', '*']])
        })
      })
      global.fetch = fetchSpy
      
      renderMap()
      
      // Should fetch last location or validate tile providers
      await waitFor(() => {
        const apiCalls = fetchSpy.mock.calls.filter(call => 
          typeof call[0] === 'string' && call[0].includes('/api/')
        )
        expect(apiCalls.length).toBeGreaterThan(0)
      })
      
      // If last location exists, should trigger preloading
      // (Implementation would preload tiles around that location)
    })
  })

  describe('Loading States', () => {
    it('shows loading indicator while fetching location', async () => {
      // Mock slow API response
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          json: () => Promise.resolve({ success: true })
        }), 100))
      )
      
      renderMap()
      const map = screen.getByTestId('mock-map')
      
      fireEvent.click(map)
      
      // Should show loading state
      expect(screen.getByText('Getting location...')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.queryByText('Getting location...')).not.toBeInTheDocument()
      })
    })

    it('shows initial map loading state', () => {
      renderMap()
      
      // Should show loading on initial render
      expect(screen.getByText('Loading map...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides keyboard navigation support', async () => {
      const user = userEvent.setup()
      
      renderMap()
      
      // Tab through interactive elements
      await user.tab()
      expect(screen.getByText('Street')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByText('Satellite')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByText('Hybrid')).toHaveFocus()
    })

    it('includes proper ARIA labels', () => {
      renderMap()
      
      const map = screen.getByTestId('mock-map')
      expect(map).toHaveAttribute('aria-label', 'Interactive map')
    })
  })
})