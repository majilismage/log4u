# Changelog

All notable changes to WanderNote are documented here.

## [Unreleased]

### 2025-01-19
**Media Modal for History View** (`fac760c`)
- Created `/components/gallery/MediaModal.tsx` - full-screen modal for viewing photos/videos
  - Displays images at 1600px via Google Drive thumbnail API
  - Embeds videos via Google Drive preview iframe
  - Navigation arrows for multi-item galleries
  - Keyboard support: Arrow keys to navigate, Escape to close
  - Position indicator ("2 of 5")
  - Dark background, responsive design
- Updated `/components/history/HistoryEntryCard.tsx`:
  - Added `onMediaClick` prop to `EditableMediaGrid`
  - Media thumbnails now clickable (disabled during edit mode)
  - Integrated MediaModal component
- Updated `/components/history/EventEntryCard.tsx`:
  - Media thumbnails now clickable buttons
  - Integrated MediaModal component

---

## Previous Releases

### 2025-01-18
**Event Logging Feature** (`9961e58`)
- Added single event logging separate from journeys

**Upload Fix** (`db68d96`)
- Fixed passing correct files and metadata to uploadFiles for events

### 2025-01-17
**Dependency Fix** (`9539351`)
- Added `.npmrc` with `legacy-peer-deps=true` for Vercel build compatibility

**Security Updates** (`3bb9b0d`)
- Fixed CVE-2025-55182 and CVE-2025-66478: upgraded Next.js and React

**Import UX Improvements** (`845b644`)
- Added loading state to "Approve & Save" with spinner
- Disabled "Skip" button during save operation
