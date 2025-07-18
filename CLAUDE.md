# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### No Test Suite
This project does not include a test suite. Manual testing should be performed through the development server.

## Project Architecture

### Technology Stack
- **Framework**: Next.js 15 with App Router and TypeScript
- **Styling**: Tailwind CSS with Shadcn/UI components
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: PostgreSQL for user sessions
- **APIs**: Google Drive/Sheets, Nominatim geocoding

### Core Data Flow
WanderNote stores user travel data in their own Google account (Google Sheets for logs, Google Drive for media). The app itself only stores authentication sessions in PostgreSQL.

### Key Architecture Patterns

#### Client/Server Component Organization
- Server Components: Pages, layouts, API routes
- Client Components: Interactive UI, forms, providers
- **Important**: Use `components/ClientProviders.tsx` pattern to isolate client-side logic from server layouts to prevent ChunkLoadError

#### Units System
- Context-based state management via `lib/UnitsContext.tsx`
- Real-time conversion utilities in `lib/unit-conversions.ts`
- Database storage in `user_google_config` table
- Retroactive display conversion (no data migration required)

#### Geocoding Integration
- Custom Nominatim client with rate limiting (`lib/nominatim-client.ts`)
- In-memory LRU cache for performance (`lib/geocode-cache.ts`)
- Debounced autocomplete component for location search

### Critical Implementation Notes

#### Leaflet Maps
When using Leaflet with React, avoid react-leaflet due to React 18 Strict Mode conflicts. Use manual Leaflet instance management:

```tsx
const mapInstanceRef = useRef<Map | null>(null);

useEffect(() => {
  if (!mapContainerRef.current || mapInstanceRef.current) return;
  
  mapInstanceRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
  
  return () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };
}, []);
```

#### Google API Integration
- All Google API calls use service account authentication
- Media uploads go directly to user's Google Drive folders
- Travel logs stored in user's Google Sheets
- Folder structure: `/WanderNote/[year]/[journey-id]/`

## File Structure

### Key Directories
- `app/api/` - Backend API routes
- `components/` - React components (organized by feature)
- `lib/` - Utility functions, contexts, and API clients
- `types/` - TypeScript type definitions

### Important Files
- `lib/google-api-client.ts` - Google API integration
- `lib/nominatim-client.ts` - Geocoding service
- `lib/UnitsContext.tsx` - Units preferences system
- `components/ClientProviders.tsx` - Client-side provider wrapper
- `components/ui/location-autocomplete.tsx` - Location search component

## Development Guidelines

### Code Patterns
- Use TypeScript strict mode
- Follow existing component patterns from Shadcn/UI
- Implement proper error boundaries for API calls
- Use React Hook Form with Zod validation for forms

### API Design
- RESTful endpoints with proper HTTP methods
- Consistent error handling and logging
- Rate limiting for external APIs (especially Nominatim)
- Session-based authentication validation

### Performance Considerations
- Client-side caching for geocoding results
- Debounced user inputs for API calls
- Optimized image handling for media uploads
- Efficient database queries with proper indexing