# WanderNote Migration Review Tool

This is the Step 5 review tool for manually reviewing and correcting the migration data.

## Quick Start

```bash
cd /home/node/.openclaw/workspace/log4u/migration
node review-server.js
```

Then open http://localhost:8111 in your browser.

## Features

### Map View
- **Full-screen map** with OpenStreetMap tiles
- **Approved entries** shown as faded blue routes and small markers
- **Current entry** highlighted with bright blue route and large From (green) / To (red) markers
- **Sequential discovery** - upcoming entries are hidden until approved

### Side Panel
- **Entry details**: journey info, dates, distances, coordinates, confidence levels
- **Real-time coordinate updates** when editing positions
- **Progress tracking** with color-coded status

### Controls
- **✅ Approve** - Save entry and move to next
- **✏️ Edit From/To** - Click map to reposition markers (auto-recalculates routes)
- **⏭️ Skip** - Mark as skipped and move on
- **🚩 Flag** - Flag entry with reason
- **◀️ Prev / ▶️ Next** - Navigate without approval

### Keyboard Shortcuts
- `A` = Approve
- `S` = Skip  
- `F` = Flag
- `←` = Previous entry
- `→` = Next entry

## Data Files

- **Input**: `resolved-entries.json`, `routes.json`
- **Output**: `approved-entries.json` - contains all review state
- **Structure**: `{ approved: [indices], skipped: [indices], flagged: [{index, reason}] }`

## Editing Workflow

1. Click "Edit From" or "Edit To" button
2. Button highlights, cursor changes to crosshair
3. Click anywhere on map to set new position
4. Route automatically recalculates using searoute-js
5. Click "Approve" to save the corrected coordinates

## Technical Details

- **Server**: Pure Node.js HTTP server on port 8111
- **Route calculation**: Uses `searoute-js` for sea routes
- **Map**: MapLibre GL JS with OpenStreetMap tiles
- **State persistence**: All changes saved to `approved-entries.json`
- **Fallback**: Straight line routes if searoute fails

## Progress Tracking

The progress bar shows:
- **Green**: Approved entries
- **Yellow**: Skipped entries  
- **Red**: Flagged entries
- **Grey**: Remaining entries

The tool automatically finds the next unprocessed entry when approving/skipping.