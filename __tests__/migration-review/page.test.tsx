import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock next/dynamic
jest.mock('next/dynamic', () => (fn: () => any) => {
  const Component = fn();
  return Component;
});

// Mock the MapComponent
jest.mock('@/app/migration-review/MapComponent', () => {
  return function MockMapComponent(props: any) {
    return (
      <div data-testid="map-component">
        <button onClick={() => props.onMapClick?.(38.0, -76.0)}>
          Mock Map Click
        </button>
        <button onClick={() => props.onCoordsChange?.('from', 38.1, -76.1)}>
          Mock Coords Change
        </button>
        <button onClick={() => props.onEditModeChange?.('from')}>
          Mock Edit Mode Change
        </button>
      </div>
    );
  };
});

// Import after mocks
import MigrationReviewPage from '@/app/migration-review/page';

// Mock data
const mockEntries = [
  {
    index: 0,
    departureDate: '2019-09-22',
    arrivalDate: '2019-09-22',
    from: 'Annapolis, MD',
    to: 'Wye River, MD',
    country: 'USA',
    distanceNm: '27',
    avgSpeed: '',
    maxSpeed: '',
    notes: '',
    fuel: '',
    fromLat: 38.97864,
    fromLng: -76.49279,
    fromConfidence: 'green',
    fromMethod: 'first-entry',
    toLat: 38.98562,
    toLng: -76.14305,
    toConfidence: 'yellow',
    toMethod: 'distance-ranked',
  },
  {
    index: 1,
    departureDate: '2019-09-23',
    arrivalDate: '2019-09-23',
    from: 'Bruffs Island, MD',
    to: 'St Michaels, MD',
    country: 'USA',
    distanceNm: '6',
    avgSpeed: '',
    maxSpeed: '',
    notes: '',
    fuel: '',
    fromLat: 38.85595,
    fromLng: -76.19106,
    fromConfidence: 'green',
    fromMethod: 'single-match',
    toLat: 38.78658,
    toLng: -76.22441,
    toConfidence: 'green',
    toMethod: 'single-match',
  },
  {
    index: 2,
    departureDate: '2019-09-25',
    arrivalDate: '2019-09-25',
    from: 'St Michaels, MD',
    to: 'Deltaville, VA',
    country: 'USA',
    distanceNm: '105',
    avgSpeed: '',
    maxSpeed: '',
    notes: '',
    fuel: '',
    fromLat: 38.78658,
    fromLng: -76.22441,
    fromConfidence: 'green',
    fromMethod: 'single-match',
    toLat: 37.54833,
    toLng: -76.32694,
    toConfidence: 'green',
    toMethod: 'single-match',
  },
];

const mockRoutes = [
  {
    index: 0,
    from: 'Annapolis, MD',
    to: 'Wye River, MD',
    route: {
      type: 'LineString',
      coordinates: [
        [-76.49279, 38.97864],
        [-76.14305, 38.98562],
      ],
    },
  },
  {
    index: 1,
    from: 'Bruffs Island, MD',
    to: 'St Michaels, MD',
    route: {
      type: 'LineString',
      coordinates: [
        [-76.19106, 38.85595],
        [-76.22441, 38.78658],
      ],
    },
  },
  {
    index: 2,
    from: 'St Michaels, MD',
    to: 'Deltaville, VA',
    route: {
      type: 'LineString',
      coordinates: [
        [-76.22441, 38.78658],
        [-76.32694, 37.54833],
      ],
    },
  },
];

// Mock server
const server = setupServer(
  rest.get('/migration/resolved-entries.json', (req, res, ctx) => {
    return res(ctx.json(mockEntries));
  }),
  rest.get('/migration/routes.json', (req, res, ctx) => {
    return res(ctx.json(mockRoutes));
  }),
  rest.post('/api/migration/check-duplicates', (req, res, ctx) => {
    return res(ctx.json({ duplicates: [] }));
  }),
  rest.post('/api/migration/save-approved', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  }),
  rest.post('/api/migration/calc-route', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      route: {
        type: 'LineString',
        coordinates: [[-76.0, 38.0], [-76.1, 38.1]],
      },
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MigrationReviewPage', () => {
  it('shows previous/current/next entry summaries in side panel', async () => {
    render(<MigrationReviewPage />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Migration Review')).toBeInTheDocument();
    });

    // Wait for entries to load and navigate to middle entry
    await waitFor(() => {
      expect(screen.getByText(/Entry \d+ of 3/)).toBeInTheDocument();
    });

    // Navigate to middle entry (index 1)
    const nextButton = screen.getByText(/▶️ Next/);
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Should show previous entry summary
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Annapolis, MD → Wye River, MD')).toBeInTheDocument();
      expect(screen.getByText('2019-09-22 · 27 nm')).toBeInTheDocument();

      // Should show current entry full details
      expect(screen.getByText('Bruffs Island, MD → St Michaels, MD')).toBeInTheDocument();

      // Should show next entry summary
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('St Michaels, MD → Deltaville, VA')).toBeInTheDocument();
      expect(screen.getByText('2019-09-25 · 105 nm')).toBeInTheDocument();
    });
  });

  it('approve calls save API and advances', async () => {
    const user = userEvent.setup();
    render(<MigrationReviewPage />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Migration Review')).toBeInTheDocument();
    });

    const approveButton = screen.getByText(/✅ Approve/);
    await user.click(approveButton);

    await waitFor(() => {
      // Should show saving state briefly, then advance
      expect(screen.getByText(/Approved/)).toBeInTheDocument();
    });
  });

  it('skip advances without saving', async () => {
    const user = userEvent.setup();
    render(<MigrationReviewPage />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Migration Review')).toBeInTheDocument();
    });

    const initialEntry = screen.getByText(/Entry 1 of 3/);
    expect(initialEntry).toBeInTheDocument();

    const skipButton = screen.getByText(/⏭️ Skip/);
    await user.click(skipButton);

    await waitFor(() => {
      // Should advance to next entry
      expect(screen.getByText(/Entry 2 of 3/)).toBeInTheDocument();
    });
  });

  it('keyboard shortcuts work', async () => {
    render(<MigrationReviewPage />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Migration Review')).toBeInTheDocument();
    });

    // Test 'a' for approve
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => {
      expect(screen.getByText(/Approved/)).toBeInTheDocument();
    });

    // Test 's' for skip
    fireEvent.keyDown(window, { key: 's' });
    await waitFor(() => {
      expect(screen.getByText(/Entry 2 of 3/)).toBeInTheDocument();
    });

    // Test 'f' for flag
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByPlaceholderText('Enter flag reason...')).toBeInTheDocument();

    // Test arrow keys for navigation
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText(/Entry 3 of 3/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText(/Entry 2 of 3/)).toBeInTheDocument();
    });
  });

  it('handles first entry edge case (no previous)', async () => {
    render(<MigrationReviewPage />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Migration Review')).toBeInTheDocument();
    });

    // Should be on first entry by default
    await waitFor(() => {
      expect(screen.getByText(/Entry 1 of 3/)).toBeInTheDocument();
    });

    // Should not show previous entry summary
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    
    // Should show next entry summary
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('handles last entry edge case (no next)', async () => {
    render(<MigrationReviewPage />);
    
    // Wait for data to load and navigate to last entry
    await waitFor(() => {
      expect(screen.getByText('Migration Review')).toBeInTheDocument();
    });

    // Navigate to last entry
    const nextButton = screen.getByText(/▶️ Next/);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Entry 3 of 3/)).toBeInTheDocument();
    });

    // Should show previous entry summary
    expect(screen.getByText('Previous')).toBeInTheDocument();
    
    // Should not show next entry summary
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});