# Review Tool V2 — Leaflet Rewrite

## Why
react-map-gl/MapLibre draggable markers are unreliable. Switching to Leaflet for the migration review page only (main app stays on MapLibre).

## Key Changes from V1

### Map: Leaflet + Plugins
- **Leaflet** (~40KB) for map rendering
- **Draggable markers** — native `L.marker({ draggable: true })` for From/To on current entry
- **Editable polyline** — allow user to drag waypoints on the route line to reshape it (for short hops where searoute can't find water paths)
- **Tile source:** OpenStreetMap raster tiles (same as before)

### 3-Route Context View
Display **previous, current, and next** entries simultaneously:
- **Previous route** (if exists): faded/muted color, non-interactive, gives "where we came from" context
- **Current route**: bright, fully interactive — draggable markers, editable line
- **Next route** (if exists): faded/muted different color, non-interactive, gives "where we're going" context
- First entry: show current + next only
- Last entry: show previous + current only

### Side Panel Updates
Show info for all 3 visible routes:
- **Previous** (collapsed/summary): From → To, date, distance
- **Current** (expanded/full): all details, confidence, coords, action buttons
- **Next** (collapsed/summary): From → To, date, distance

### Interaction Flow
1. Entry loads → map fits bounds to show all 3 routes
2. Click From marker (green) → enters edit mode, click map to reposition OR just drag it
3. Click To marker (red) → same
4. Drag a waypoint on the route line → reshapes the path
5. Approve → saves to Google Sheet, advances to next entry
6. Route recalculates via `/api/migration/calc-route` after marker drag ends

### Keyboard Shortcuts (unchanged)
- A = Approve, S = Skip, F = Flag, ← = Prev, → = Next

### Files to Modify
- `app/migration-review/MapComponent.tsx` — full rewrite using Leaflet
- `app/migration-review/page.tsx` — update for 3-route context in side panel
- `package.json` — add `leaflet`, `react-leaflet`, `@types/leaflet`

### Package Verification Required
- Check npm for latest `leaflet`, `react-leaflet`, `@types/leaflet` versions before adding

### Existing APIs (unchanged)
- `POST /api/migration/check-duplicates` — duplicate detection
- `POST /api/migration/save-approved` — save to Google Sheet
- `POST /api/migration/calc-route` — sea route recalculation

### TDD
- Write tests first for the new interactions
- Test: marker drag updates coordinates
- Test: route line editable
- Test: 3-route display logic (first/middle/last entry edge cases)
- Test: approve saves and advances correctly
