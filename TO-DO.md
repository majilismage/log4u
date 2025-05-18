# Travel Log Project: TO-DO - Enhanced History View

This document outlines the steps to refactor the History page for a more user-friendly and interactive experience.

## Phase 1: Foundational UI/UX for History Page (Desktop & Mobile) - COMPLETED
[DONE] 1.  **Main History Page (`HistoryPage.tsx`):
[DONE]     *   Fetch history data from the existing `/api/history` endpoint.
[DONE]     *   Map over the journey entries and render a `HistoryEntryCard` for each.
[DONE]     *   Implement a loading state while data is being fetched.
[DONE]     *   Implement an error state if data fetching fails.
[DONE]     *   Implement a "No history entries found" state.
[DONE] 2.  **History Entry Card (`HistoryEntryCard.tsx`):
[DONE]     *   **Layout:**
[DONE]         *   Desktop: Two-column layout (metadata on left, content on right).
[DONE]         *   Mobile: Single-column, two-row layout (metadata on top, content on bottom).
[DONE]         *   Use responsive Tailwind CSS classes.
[DONE]     *   Accept a single journey entry object as a prop.
[DONE] 3.  **Journey Metadata Display (`JourneyMetadata.tsx`):
[DONE]     *   **Content:**
[DONE]         *   Display "From: {From Town} ({From Country}) -> {To Town} ({To Country})".
[DONE]         *   Display "Departed on: {Departure Date}".
[DONE]         *   Display "Arrived on: {Arrival Date}".
[DONE]         *   Display "Distance traveled: {Distance}".
[DONE]         *   Display "Average Speed: {Average Speed}".
[DONE]         *   Display "Maximum Speed: {Max Speed}".
[DONE]     *   Accept relevant parts of the journey entry as props.
[DONE] 4.  **Journey Content Display (`JourneyContent.tsx`):
[DONE]     *   **Layout:** Container for Notes and Media Gallery.
[DONE]     *   Accept relevant parts of the journey entry (notes, media links) as props.

## Phase 2: Minimap Implementation
1.  **Minimap Component (`MiniMap.tsx`):**
    *   Accept `startLat`, `startLng`, `endLat`, `endLng` as props.
    *   Choose and integrate a mapping solution (e.g., Leaflet, Mapbox GL JS, or a static map API like Google Static Maps API or OpenStreetMap static image API).
    *   Plot the starting point marker.
    *   Plot the ending point marker.
    *   Draw a line or arrow connecting the two points.
    *   Ensure it's lightweight and fits within the metadata section.
2.  **Integration:** Add the `MiniMap` component to `JourneyMetadata.tsx`.

## Phase 3: Editable Notes
1.  **Editable Notes Component (`EditableNotes.tsx`):**
    *   Accept `initialNotes` and `journeyId` as props.
    *   Display notes text.
    *   Include an "Edit" button.
    *   On "Edit" click:
        *   Switch to an edit mode (e.g., replace text display with a `textarea`).
        *   Show "Save" and "Cancel" buttons.
    *   On "Save" click:
        *   Call an API to update the notes for the given `journeyId` in the Google Sheet.
        *   Update the local display with the new notes.
        *   Handle API errors and provide feedback.
    *   On "Cancel" click: Revert to display mode with original notes.
2.  **API Endpoint for Notes Update:**
    *   Create a new API route (e.g., `PUT /api/history/[journeyId]/notes`).
    *   This endpoint will receive the updated notes and `journeyId`.
    *   It should update the corresponding row in the Google Sheet.
3.  **Integration:** Add the `EditableNotes` component to `JourneyContent.tsx`.

## Phase 4: Entry-Specific Media Gallery
1.  **Entry Media Gallery Component (`EntryMediaGallery.tsx`):**
    *   Accept `journeyId`, `imagesLink`, and `videosLink` (or a combined media array if the API provides it) as props.
    *   **Fetch Media:**
        *   If `imagesLink`/`videosLink` are folder URLs, this component might need to trigger a fetch to a new API endpoint that lists files specifically for *that journey's* media folders.
        *   Alternatively, `/api/history` could be enhanced to return a list of individual media items (thumbnail, full view link, type) for each journey. This is preferable.
    *   **Display:**
        *   Render a grid of small thumbnails.
        *   Thumbnails should be clickable, opening the media (e.g., in a modal lightbox or new tab).
        *   Indicate media type (image/video icon overlay).
    *   **Delete Functionality:**
        *   On thumbnail hover, show an 'X' icon in the top right corner.
        *   On 'X' click:
            *   Confirm deletion.
            *   Call an API to delete the specific media file from Google Drive.
            *   Call an API or update the Google Sheet to remove/update the link in the journey record.
            *   Remove the thumbnail from the view.
    *   **"Add More" Button:**
        *   When clicked, open a file input dialog.
        *   Handle file selection.
        *   Call an API to upload the new file(s) to the appropriate journey folder in Google Drive.
        *   Update the Google Sheet record with the new media link(s).
        *   Add the new thumbnail(s) to the gallery view.
2.  **API Endpoints for Media Management (per journey):**
    *   **List Media for Journey:** `GET /api/journeys/[journeyId]/media` (if not included in main history API).
    *   **Delete Media Item:** `DELETE /api/media/[mediaId]` (requires media to have unique IDs and a way to link them back to the journey and sheet row). The API should handle deletion from Drive and updating the Sheet.
    *   **Add Media Item:** `POST /api/journeys/[journeyId]/media` (handles upload to Drive, updating Sheet).
3.  **Integration:** Add the `EntryMediaGallery` component to `JourneyContent.tsx`.

## Phase 5: API Refinements and Backend Logic
1.  **Refine `/api/history` Endpoint:**
    *   Ensure it returns all necessary data for the new UI, including:
        *   Clear identifiers for each journey (e.g., `Journey ID`).
        *   Structured data for `From Town`, `From Country`, `To Town`, `To Country`, `Departure Date`, `Arrival Date`, `Distance`, `Average Speed`, `Max Speed`, `Notes`.
        *   Latitude and Longitude for start and end points.
        *   A list of media items associated with the journey, each with:
            *   `id` (unique media identifier)
            *   `thumbnailUrl`
            *   `webViewLink` (or full view link)
            *   `mimeType` (or simply `isVideo` boolean)
2.  **Implement Backend Logic for Google Sheet Updates:**
    *   Ensure robust functions to find specific rows by `Journey ID` for updates (notes, media links).
    *   Handle array-like fields (e.g., if multiple media links are stored in a single cell, or if new media items need to be added).
3.  **Implement Backend Logic for Google Drive Interactions:**
    *   Functions to delete specific files by ID/path within a journey folder.
    *   Functions to upload new files to the correct journey folder (images or videos subfolder). 