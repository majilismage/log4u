#!/usr/bin/env node
/**
 * Generate a binary water/land grid from Natural Earth 50m land polygons.
 * Output: compact binary file, 1 bit per cell (0=water, 1=land).
 * 
 * Grid: 0.1° resolution = 3600 cols x 1800 rows (~11km cells)
 * Size: 3600*1800/8 = 810 KB uncompressed
 */

const shapefile = require('shapefile');
const turf = require('@turf/turf');
const fs = require('fs');
const path = require('path');

const RESOLUTION = 0.1; // degrees per cell
const COLS = Math.round(360 / RESOLUTION); // 3600
const ROWS = Math.round(180 / RESOLUTION); // 1800

async function main() {
  console.log(`Grid: ${COLS}x${ROWS} (${RESOLUTION}° resolution)`);
  console.log('Loading Natural Earth 50m land polygons...');

  const source = await shapefile.open(
    path.join(__dirname, 'ne_50m_land', 'ne_50m_land.shp')
  );

  const landFeatures = [];
  let result;
  while (!(result = await source.read()).done) {
    landFeatures.push(result.value);
  }
  console.log(`Loaded ${landFeatures.length} land features`);

  // Pre-compute bounding boxes for fast rejection
  const featureBboxes = landFeatures.map(f => turf.bbox(f));

  // Allocate bit array
  const totalBits = COLS * ROWS;
  const buffer = Buffer.alloc(Math.ceil(totalBits / 8), 0);

  console.log('Generating grid...');
  
  let landCount = 0;
  const startTime = Date.now();

  for (let row = 0; row < ROWS; row++) {
    if (row % 100 === 0) {
      const pct = ((row / ROWS) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  Row ${row}/${ROWS} (${pct}%) - ${elapsed}s - land: ${landCount}`);
    }

    const lat = 90 - (row + 0.5) * RESOLUTION;

    for (let col = 0; col < COLS; col++) {
      const lng = -180 + (col + 0.5) * RESOLUTION;

      let isLand = false;
      for (let i = 0; i < landFeatures.length; i++) {
        const bb = featureBboxes[i];
        // Quick bbox check: [minLng, minLat, maxLng, maxLat]
        if (lng < bb[0] || lng > bb[2] || lat < bb[1] || lat > bb[3]) continue;

        if (turf.booleanPointInPolygon([lng, lat], landFeatures[i])) {
          isLand = true;
          break;
        }
      }

      if (isLand) {
        const bitIndex = row * COLS + col;
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        buffer[byteIndex] |= (1 << bitOffset);
        landCount++;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const waterCount = totalBits - landCount;
  console.log(`Done in ${elapsed}s. Land: ${landCount}, Water: ${waterCount}`);

  // Header: "WGRD" + uint16 cols + uint16 rows + float32 resolution
  const header = Buffer.alloc(12);
  header.write('WGRD', 0, 4, 'ascii');
  header.writeUInt16BE(COLS, 4);
  header.writeUInt16BE(ROWS, 6);
  header.writeFloatBE(RESOLUTION, 8);

  const output = Buffer.concat([header, buffer]);
  const outPath = path.join(__dirname, '..', 'public', 'migration', 'water-grid.bin');
  fs.writeFileSync(outPath, output);
  console.log(`Written to ${outPath} (${(output.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
