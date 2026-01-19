# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Recent Changes:** See [CHANGELOG.md](./CHANGELOG.md) for development history and recent updates.

## Project Overview

WanderNote is a privacy-first travel journal app built with Next.js 15 and React 19. Users log journeys and events, with all data stored in their own Google Drive/Sheets accounts (zero server-side storage of user content). PostgreSQL stores only authentication tokens and user preferences.

## Common Commands

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run Jest tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

**Database migrations:**
```bash
psql -d wandernote -f database/migrations/add-unit-preferences.sql
```

## Architecture

### Data Flow
```
Browser (React) → Next.js API Routes → Google APIs (Sheets/Drive)
                         ↓
                    PostgreSQL (auth tokens + preferences only)
```

- **All journey/event data** lives in user's Google Sheets (referenced by `googleSheetsId` in `user_google_config` table)
- **Media files** stored in user's Google Drive
- **Authentication** via NextAuth with Google OAuth2

### Key Directories
- `/app/api` - API endpoints (journey CRUD, media upload, auth, geocoding)
- `/components` - React components; `/components/ui` contains ShadCN components
- `/lib` - Utilities: `google-api-client.ts` (auth), `unit-conversions.ts` (distance/speed), `UnitsContext.tsx` (preferences)
- `/types` - TypeScript definitions; `journey.ts` has core data models

### Core Data Types
```typescript
// Two entry types discriminated by entryType field
type JourneyEntry = { entryType: 'journey'; from; to; departureDate; arrivalDate; distance; avgSpeed; maxSpeed; ... }
type EventEntry = { entryType: 'event'; date; title; location?; notes?; ... }

// Type guards: isJourneyEntry(), isEventEntry()
```

### Authentication Pattern
All protected API endpoints must:
1. Call `getServerSession(authOptions)` to verify user
2. Extract `userId` from session
3. Use `getAuthenticatedClient()` from `lib/google-api-client.ts` to get Google API client

### Units System
- Speed: knots | mph | kmh
- Distance: miles | nautical_miles | kilometers
- Conversions are client-side; historical data converted on display only
- Use `useUnits()` hook for preferences and `lib/unit-conversions.ts` for conversions

## Testing

- **Framework:** Jest with jsdom + React Testing Library
- **API mocking:** MSW (Mock Service Worker)
- **MapLibre GL** is mocked in tests
- Tests live in `__tests__` directories

## Key Configuration

- `.npmrc` has `legacy-peer-deps=true` for Vercel compatibility
- `next.config.mjs` disables ESLint/TypeScript errors at build time
- Path alias `@/*` maps to project root

## External Services

- **Google OAuth2** - Authentication
- **Google Sheets API** - Journey/event data storage
- **Google Drive API** - Media file storage
- **Nominatim (OpenStreetMap)** - Location autocomplete via `/api/geocode-search`
