# WanderNote Migration Plan

## Goal
Migrate 283 journey entries from Jake's Google Sheets sailing log (CSV export) into WanderNote format, with accurate geocoded coordinates and sea-route visualisations.

## Source Data
- **File:** `migration/source.csv`
- **Entries:** 283 journeys (Sep 2019 → May 2025)
- **Countries:** USA, Bahamas, DR, Puerto Rico, USVI, BVI, TCI, St Maarten, Panama, Mexico, Canada, Portugal, Spain, France, UK, Italy
- **Columns:** Departure Date, From, To, Arrival Date, Distance (nm), Avg Speed, Max Speed, Total Distance (nm), Country, Fuel taken, Notes
- **Issues:** 1 missing "From" field (row 138, May 1 2021 → Culebra), some "not recorded" speed values, 12 trailing service-note rows

## Target Schema (WanderNote Google Sheet)
```
id, departureDate, arrivalDate, fromTown, fromCountry, fromLat, fromLng, toTown, toCountry, toLat, toLng, distance, avgSpeed, maxSpeed, notes, imageLinks, videoLinks, timestamp, entryType, title
```

## Approach

### Step 1: Parse & Clean CSV ⬜
- Proper CSV parser (handles quoted fields with commas)
- Filter out non-journey rows (trailing service notes)
- Normalise dates to YYYY-MM-DD
- Handle "not recorded" speed values → empty string
- Split "Town, Region" from "Country" (country is in col 8)
- Fill missing "From" on row 138 from previous entry's "To"
- Extract service-note rows as potential "event" entries (separate file)
- **Output:** `migration/parsed-entries.json`

### Step 2: Geocode All Locations ⬜
- Use Nominatim (free, same as WanderNote uses)
- Query: "{town}, {country}" for each unique From/To location
- Rate limit: 1 request/second (Nominatim policy)
- Cache results to avoid re-geocoding on reruns
- For ambiguous results (multiple candidates): store all candidates with scores
- **Output:** `migration/geocode-cache.json`

### Step 3: Disambiguate & Validate ⬜
- For each entry in sequence:
  - If geocode returned single confident match → use it
  - If multiple candidates → filter by:
    - Crow-flies distance from previous known location must be ≤ logged sailing distance
    - Prefer candidate where crow-flies is closest to (but not exceeding) logged distance
    - Crow-flies should typically be >40% of sailing distance
  - Assign confidence: green (>0.8), yellow (0.5-0.8), red (<0.5 or failed)
- **Output:** `migration/resolved-entries.json` (each entry with coords + confidence)

### Step 4: Generate Sea Routes ⬜
- Install `searoute-js` in migration directory
- For each sequential pair of entries, generate GeoJSON LineString
- Compare searoute distance to logged distance (additional validation)
- **Output:** `migration/routes.json` (GeoJSON features per entry)

### Step 5: Build Interactive Review Tool ⬜
- Single HTML page with MapLibre GL JS (CDN)
- Sequential review: one entry at a time, oldest first
- Shows:
  - All previously approved entries (faded lines on map)
  - Current entry highlighted with details panel
  - Sea-route line (blue for confident, yellow for uncertain, red for problems)
  - From/To markers
- Controls:
  - Approve (saves current, loads next)
  - Edit coordinates (click map to reposition from/to markers)
  - Skip (come back later)
  - Flag for manual review
- Approved entries POST back to a local server (Arthur's workspace)
- **Output:** `migration/review.html` + `migration/review-server.js`

### Step 6: Serve & Review ⬜
- Run review server in container
- Jake steps through each entry
- Approved entries saved to `migration/approved-entries.json`

### Step 7: Export ⬜
- Generate CSV matching WanderNote sheet schema exactly
- Generate UUIDs for each entry
- Include all approved coordinates
- **Output:** `migration/wandernote-import.csv`
- Jake copy-pastes into Google Sheet

## Files
```
log4u/migration/
├── PLAN.md                  # This file
├── source.csv               # Original CSV export
├── parsed-entries.json      # Step 1 output
├── geocode-cache.json       # Step 2 output
├── resolved-entries.json    # Step 3 output
├── routes.json              # Step 4 output
├── review.html              # Step 5 review UI
├── review-server.js         # Step 5 local server
├── approved-entries.json    # Step 6 output
└── wandernote-import.csv    # Step 7 final export
```

## Status
- [x] Source CSV received and analysed
- [x] Step 1: Parse & Clean — 283 entries, 0 issues, 283 unique locations
- [x] Step 2: Geocode — 283/283 cached, 0 API failures, 80 no-results, 102 ambiguous
- [x] Step 3: Disambiguate — 66 green, 141 yellow, 76 red
- [x] Step 4: Sea Routes — 189 success, 94 straight-line fallback. Routes recalculated during review.
- [ ] Step 5: Review Tool
- [ ] Step 6: Review
- [ ] Step 7: Export

## Decisions
- Use Nominatim for geocoding (free, same provider as app)
- Use searoute-js for water-following route lines
- Sequential review (one at a time, building up the journey)
- Approved entries saved to workspace, Arthur persists them
- Final output as CSV for manual paste into Google Sheet

## Notes
- Nominatim rate limit: ~566 unique locations ÷ 1/sec = ~10 min geocoding time
- Some locations are small cays/islands — may need fuzzy matching or manual coords
- Service note rows (12) could become "event" type entries — ask Jake
