# WanderNote (Travel Log) Project Status

## Current Architecture & Deployment
- **Application Name:** WanderNote
- **Live URL:** https://wandernote.vercel.app/
- **Platform:** Vercel (with automatic deployments)
- **Database:** Neon Postgres (Serverless) with environment-specific branches
- **Authentication:** NextAuth.js with Google OAuth 2.0

## Major Architectural Decisions

### Multi-User Support Implementation (In Progress)
**Decision:** Transitioned from single-user (developer-only) to multi-user architecture where each user connects their own Google services.

**Approach:** Google OAuth 2.0 with NextAuth.js
- **Why OAuth 2.0:** More secure and user-friendly than asking users for service account keys
- **Why NextAuth.js:** Handles OAuth flow, token management, and security best practices automatically
- **Database:** Neon Postgres to store encrypted user-specific refresh tokens and configuration

**Google Cloud Configuration:**
- OAuth consent screen configured for external users
- Required scopes: `spreadsheets`, `drive.file`
- Authorized redirect URIs: 
  - Local: `http://localhost:3000/api/auth/callback/google`
  - Production: `https://wandernote.vercel.app/api/auth/callback/google`

**Database Architecture:**
- Environment-specific branches (Development/Preview/Production)
- Stores user sessions, encrypted OAuth refresh tokens, and user configurations
- Each user's Google API interactions use their own authenticated tokens

## To Do Next (Updated Priorities)
- **[HIGH PRIORITY]** Complete OAuth 2.0 implementation:
  - Install and configure NextAuth.js
  - Create database schema for user sessions and configurations
  - Implement Google OAuth provider configuration
  - Create user settings page for Google integration
  - Modify existing Google API calls to use user-specific tokens
- Add error toast notifications for better user feedback
- Add loading states for individual form fields during API calls
- Implement proper error handling for file upload failures
- Show state in UI

## Completed Features

### Core Application
- Next.js 15.2.4 application with TypeScript
- Modern UI using Tailwind CSS and Radix UI components
- Three main tabs: New Entry, Gallery, and History
- Accessible modal dialogs with proper ARIA labels and descriptions

### Form Implementation
- Basic travel log entry form with:
  - Departure and Arrival dates
  - Location details (town, country, latitude, longitude) for both departure and arrival
  - Distance, Average Speed, and Max Speed inputs
  - Notes field
  - Image upload with preview functionality
  - Ability to remove selected files before upload
  - Progress tracking during file upload

### Media Management
- File preview grid with hover-to-remove functionality
- Support for multiple file selection
- Delayed upload until form submission
- Progress tracking during upload
- Enhanced Media Gallery:
  - Displays all media (images and videos) from Google Drive.
  - Responsive, lazy-loaded grid using direct thumbnail links for efficient loading.
  - Media grouped by journey, with journey ID headings.
  - Robust loading state indicator during initial media retrieval.
  - Filename overlay removed from thumbnails for a cleaner look.
- Proper error handling and logging
- Improved Google Drive folder structure management:
  - Singleton pattern for folder management to prevent duplicates
  - Promise-based caching to prevent race conditions
  - Atomic folder structure creation
  - Organized media files by type (images/videos) under journey folders
  - Consistent folder hierarchy: year/month/journeyId/(images|videos)/filename
  - Thread-safe folder operations
  - Comprehensive logging and error tracking
- Organized file storage in Google Drive with structured directory naming
- Secure file naming with location, date, and hash components

### Google Sheets Integration
- Service account authentication
- Automatic saving of entries to Google Sheets
- Extended data structure to include:
  - Departure/Arrival dates
  - Location details (town, country, coordinates)
  - Journey metrics (distance, speeds)
  - Timestamps for record keeping
- Media folder links (images for now) from Google Drive are reliably saved to Google Sheets with each record

### History Page (Phase 1 Foundation)
- Fetches and displays journey history within the existing "History" tab.
- **Responsive Journey Cards:**
  - Each journey entry is displayed in a card with a responsive layout (two-column on desktop, single-column on mobile).
  - Dark mode support for all new history components.
- **Journey Metadata Display:**
  - Shows "From: {Town} ({Country}) -> To: {Town} ({Country})".
  - Displays formatted Departure and Arrival dates (e.g., "July 20, 2024").
  - Shows Distance, Average Speed, and Max Speed with icons.
  - Uses icons for locations, dates, and travel stats, matching the desired modern UI.
- **Journey Content Display:**
  - Displays journey notes within the card.
- **Loading and States:**
  - Implements loading state with a spinner consistent with other app areas (e.g., Gallery).
  - Handles error states if data fetching fails.
  - Displays a "No history entries found" message when applicable.

## Planned Features

### Multi-User Authentication & Configuration
- **User Authentication:** NextAuth.js with Google OAuth 2.0
- **User Settings Page:** Interface for users to manage their Google integrations
- **Per-User Data Isolation:** Each user's travel logs, media, and settings are completely separate
- **Secure Token Management:** Encrypted storage of user-specific Google API refresh tokens

### Enhanced User Experience
- **Onboarding Flow:** Guide new users through Google account connection
- **Account Management:** Allow users to disconnect/reconnect Google services
- **Data Export:** Users can export their travel log data
- **Privacy Controls:** Users control their own data and Google permissions

### Enhanced History View
- **Interactive Journey Display:**
  - Minimap plotting start/end points with a connecting arrow.
- **Supporting API Endpoints:**
  - API for updating notes in Google Sheets.
  - APIs for deleting and adding media to Google Drive and updating Google Sheets.
  - Refined `/api/history` to provide detailed data for each journey, including individual media item details.

### Location Auto-Complete
- Integration with OpenStreetMap's Nominatim API
- Auto-complete suggestions for town/city names
- Automatic population of:
  - Country information
  - Latitude/Longitude coordinates
- Caching of API responses for performance

### Smart Form Population
- Auto-populate "From" location with previous entry's "To" location
- Clear button for manual override
- Maintain location data structure in form state
- Allow user overrides while keeping data integrity

### Rich Text Editor
- Ability to add text style and formatting
- Ability to add hyperlinks and horizontal dividers
- Blog post style formatting
- Ordered and unordered lists
- Block quotes

### Distance Analytics
- Add total distance traveled counter in UI
- Implement distance aggregation by:
  - Time periods (weekly, monthly, yearly)
  - Countries visited
  - Routes (global map of all routes, animated, TravelBoast (https://travelboast.com/#/) style)
- Add visual representation of distance metrics
- Calculate and display:
  - Average journey length
  - Average speed

## Technical Debt & Improvements
- Implement input validation for all form fields
- Improve error handling in Google Sheets integration
- Add retry mechanism for failed saves
- Implement proper type checking throughout the application
- Implement more sophisticated Google Drive security model:
  - Replace 'anyone with link' permissions with proper access control
  - Consider implementing domain-restricted access
  - Add file access auditing
  - Implement role-based access control for media files
- Add comprehensive error handling for network failures
- Implement file upload resume capability for large files
- Add file type validation and size limits
- Implement client-side image optimization before upload
- Consider implementing folder structure cleanup for failed uploads
- Add periodic cache cleanup for the folder manager
- Implement folder structure validation and repair utilities

## Environment Setup (Updated)

### Local Development (`.env.local`):
```
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret-key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Database Configuration (automatically provided by Neon)
DATABASE_URL=your-neon-database-url

# Legacy (for backward compatibility during transition)
GOOGLE_SHEETS_PRIVATE_KEY="your-private-key"
GOOGLE_SHEETS_CLIENT_EMAIL="your-service-account-email"
GOOGLE_SHEETS_SHEET_ID="your-sheet-id"
GOOGLE_DRIVE_PRIVATE_KEY="your-private-key"
GOOGLE_DRIVE_CLIENT_EMAIL="your-service-account-email"
```

### Vercel Production Environment Variables:
```
NEXTAUTH_URL=https://wandernote.vercel.app
NEXTAUTH_SECRET=your-generated-secret-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
DATABASE_URL=automatically-provided-by-neon
```

## Database Schema (New)
### User Sessions (NextAuth.js tables):
- `users` - User profile information
- `accounts` - OAuth account linking (Google)
- `sessions` - Active user sessions
- `verification_tokens` - Email verification tokens

### User Configurations:
- `user_google_config` - Encrypted Google API tokens and user-specific settings
  - `user_id` (FK to users table)
  - `encrypted_refresh_token` (Google OAuth refresh token)
  - `google_sheets_id` (user's specific Google Sheet ID)
  - `google_drive_folder_id` (user's specific Drive folder)
  - `created_at`, `updated_at`

## Google Sheet Structure
Column headers used in the Google Sheet:
`Journey ID	Departure Date	Arrival Date	From Town	From Country	From Latitude	From Longitude	To Town	To Country	To Latitude	To Longitude	Distance	Average Speed	Max Speed	Notes	Images Link	Videos Link	Timestamp`

Original list of columns (for reference, ensure the list above is the source of truth for headers):
- Departure Date
- Arrival Date
- From Town
- From Country
- From Latitude
- From Longitude
- To Town
- To Country
- To Latitude
- To Longitude
- Distance
- Average Speed
- Max Speed
- Notes
- Images Link
- Videos Link
- Timestamp 