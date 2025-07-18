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

#### Authentication System
- NextAuth.js with Google OAuth using database sessions (30-day expiry)
- Custom secure token management prevents account conflation
- Comprehensive authentication logging via `lib/auth-logger.ts`
- OAuth scope validation ensures required Google permissions
- Session stored in PostgreSQL with automatic token refresh

#### Database Migrations
- PostgreSQL migrations in `/database/migrations/`
- Current migration: `add-unit-preferences.sql` for units system
- Use `psql -d database_url -f migration_file.sql` for manual migration

## Development Guidelines

### Critical Patterns
- **React 18 Strict Mode**: Avoid react-leaflet library - use manual Leaflet instance management
- **Context Isolation**: Wrap client providers in `ClientProviders.tsx` to prevent ChunkLoadError
- **Form Validation**: Use React Hook Form with Zod validation for all forms
- **Error Boundaries**: Implement proper error boundaries for all API calls

### API Design
- RESTful endpoints with proper HTTP methods and error handling
- Session-based authentication validation using NextAuth
- Rate limiting for external APIs (especially Nominatim geocoding)
- Comprehensive request/response logging with `authLogger`

### Environment Variables Required
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET` - NextAuth configuration
- `SMTP_*` - Email configuration (optional)

### Performance Considerations
- Client-side geocoding cache with LRU implementation
- Debounced user inputs for API calls (especially location search)
- Image optimization disabled for better compatibility
- Efficient database queries with proper indexing