# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Testing
- **Test Framework**: Jest with React Testing Library
- **Test-First Approach**: Write tests before implementing features
- **Run Tests**: `npm test`
- **Test Coverage**: `npm run test:coverage`

## Project Architecture

### Technology Stack
- **Framework**: Next.js 15.2.4 with App Router and TypeScript
- **Styling**: Tailwind CSS with Shadcn/UI components (Radix UI primitives)
- **Authentication**: NextAuth.js with Google OAuth using database sessions
- **Database**: PostgreSQL (Neon) for user sessions and preferences
- **APIs**: Google Drive/Sheets, Nominatim geocoding, MapLibre GL JS
- **Maps**: Currently Leaflet (migrating to MapLibre GL JS)

### Core Data Flow
**WanderNote** is a personal travel journal app where user travel data stays in their own Google account:
- **Travel logs**: Stored in user's Google Sheets
- **Media files**: Stored in user's Google Drive with folder structure `/WanderNote/[year]/[journey-id]/`
- **App database**: Only stores authentication sessions, user preferences, and configuration

### Current State & Planned Enhancements
The app currently has a single-form new entry interface. **PROJECT-ENHANCEMENT.md** contains a comprehensive plan for implementing a dual-tab interface:
- **Journey Tab**: Enhanced route-based travel logging (current functionality)  
- **Moment Tab**: Single experience capture (meals, attractions, encounters)
This enhancement leverages 2025 UX trends including AI-driven features, bento box layouts, and modern morphism styling.

### Key Architecture Patterns

#### Client/Server Component Organization
- Server Components: Pages, layouts, API routes
- Client Components: Interactive UI, forms, providers
- **Important**: Use `components/ClientProviders.tsx` pattern to isolate client-side logic from server layouts to prevent ChunkLoadError

#### Current Form Structure
The main entry interface is `components/new-entry/NewEntryTab.tsx` with these sections:
- **Dates Section**: Departure and arrival dates with calendar pickers
- **Route Section**: From/To locations with autocomplete and map integration  
- **Telemetry Section**: Distance, average speed, maximum speed
- **Notes Section**: Free-text area for journey notes
- **Media Upload Section**: File upload for images and videos with preview

#### Units System
- Context-based state management via `lib/UnitsContext.tsx`
- Real-time conversion utilities in `lib/unit-conversions.ts`
- Database storage in `user_google_config` table
- Retroactive display conversion (no data migration required)

#### Geocoding Integration
- Custom Nominatim client with rate limiting (`lib/nominatim-client.ts`)
- In-memory LRU cache for performance (`lib/geocode-cache.ts`)
- Debounced autocomplete component for location search (`components/ui/location-autocomplete.tsx`)

### Critical Implementation Notes

#### Google Drive API Upload Pattern
**CRITICAL**: When uploading files to Google Drive, you MUST inline the request objects directly in the `drive.files.create()` call. Do NOT create separate variables for `requestBody` or `media` objects.

**✅ CORRECT - This works:**
```javascript
const response = await drive.files.create({
  requestBody: {
    name: file.name,
    parents: [folderId],
    appProperties: { journeyId: 'abc' }
  },
  media: {
    mimeType: file.type,
    body: stream
  },
  fields: 'id, webViewLink'
});
```

**❌ INCORRECT - This causes 500 "Unknown Error":**
```javascript
const fileMetadata = {
  name: file.name,
  parents: [folderId],
  appProperties: { journeyId: 'abc' }
};
const media = {
  mimeType: file.type,
  body: stream
};
// This will fail with 500 error!
const response = await drive.files.create({
  requestBody: fileMetadata,
  media: media,
  fields: 'id, webViewLink'
});
```

This issue was discovered after extensive debugging - the Google Drive API returns a cryptic "Unknown Error" when objects are passed as variables rather than inlined.

#### MapLibre GL JS Maps
**MIGRATION IN PROGRESS**: Migrating from Leaflet to MapLibre GL JS for better performance and React integration.

**Current Status**: Using Leaflet with manual instance management due to React 18 Strict Mode conflicts.
**Target**: Complete migration to MapLibre GL JS with react-map-gl wrapper.

See `MAPLIBRE_MIGRATION_PLAN.md` for comprehensive migration details.

**Current Leaflet Implementation** (temporary):
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

**Known Issues with Current Implementation**:
- Map container height problems (extends beyond dialog boundaries)
- Marker/line visibility issues (z-index conflicts)
- Performance bottlenecks with dynamic line drawing
- React rendering conflicts with Leaflet DOM manipulation

#### Google API Integration
- All Google API calls use service account authentication
- Media uploads go directly to user's Google Drive folders
- Travel logs stored in user's Google Sheets
- Folder structure: `/WanderNote/[year]/[journey-id]/`

#### Recent Changes: Logging Cleanup
**Verbose session tracking logs have been removed** to reduce terminal noise:
- `lib/auth-logger.ts`: Now only logs errors and critical authentication failures
- `components/auth/UserMenu.tsx`: Removed verbose logout process logging
- `components/auth/AuthWrapper.tsx`: Eliminated route evaluation and session change tracking
- `lib/google-auth.ts`: Removed database query and OAuth client creation logging
- `app/api/auth/[...nextauth]/route.ts`: Simplified OAuth flow logging to errors only
- **Result**: ~95% reduction in terminal output while preserving error tracking

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
- **Minimal logging**: `lib/auth-logger.ts` now only logs errors and critical failures (verbose session tracking removed)
- OAuth scope validation ensures required Google permissions (`https://www.googleapis.com/auth/drive.file`)
- Session stored in PostgreSQL with automatic token refresh

#### Database Migrations
- PostgreSQL migrations in `/database/migrations/`
- Current migration: `add-unit-preferences.sql` for units system
- Use `psql -d database_url -f migration_file.sql` for manual migration

## Development Guidelines

### Development Philosophy
- **Lean Code First**: Prioritize simple, maintainable solutions over complex features
- **Test-Driven Development (TDD)**: Write tests before implementation for all new features
- **Single Responsibility**: Each component/function should do one thing well
- **DRY Principle**: Reuse existing utilities and components wherever possible
- **Minimal API Surface**: Fewer, more flexible endpoints over many specific ones
- **Progressive Enhancement**: Start with core functionality, add features incrementally
- **Code Metrics**: Functions < 20 lines, files < 200 lines, test coverage > 90%

### Critical Patterns
- **Mapping**: Currently using Leaflet with manual instance management (migrating to MapLibre GL JS)
- **Context Isolation**: Wrap client providers in `ClientProviders.tsx` to prevent ChunkLoadError  
- **Form Validation**: Use React Hook Form with Zod validation for all forms
- **Error Boundaries**: Implement proper error boundaries for all API calls
- **Git Commits**: DO NOT commit to git until changes have been manually tested end-to-end

### API Design
- RESTful endpoints with proper HTTP methods and error handling
- Session-based authentication validation using NextAuth
- Rate limiting for external APIs (especially Nominatim geocoding)
- **Error-only logging**: Only critical authentication failures are logged (verbose logging removed)

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