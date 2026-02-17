#!/usr/bin/env node
/**
 * Generate regional water/land grids at 0.01° (~1.1km) resolution.
 * Two regions: Americas/Caribbean + Europe/Med.
 * 
 * Output format: JSON header + concatenated bit arrays
 * Header: { regions: [{name, minLat, maxLat, minLng, maxLng, cols, rows, offset}], resolution }
 * Data: bit arrays packed sequentially, 0=water, 1=land
 */

const shapefile = require('shapefile');
const turf = require('@turf/turf');
const fs = require('fs');
const path = require('path');

const RESOLUTION = 0.01;

const REGIONS = [
  {
    name: 'americas',
    minLat: 20, maxLat: 45,
    minLng: -89, maxLng: -53,
  },
  {
    name: 'europe',
    minLat: 35, maxLat: 52,
    minLng: -11, maxLng: 17,
  },
];

async function main() {
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

  const featureBboxes = landFeatures.map(f => turf.bbox(f));

  // Pre-filter features per region (only check features whose bbox overlaps)
  const regionFeatures = REGIONS.map(region => {
    const filtered = [];
    const filteredBboxes = [];
    for (let i = 0; i < landFeatures.length; i++) {
      const bb = featureBboxes[i];
      // bbox: [minLng, minLat, maxLng, maxLat]
      if (bb[2] < region.minLng || bb[0] > region.maxLng ||
          bb[3] < region.minLat || bb[1] > region.maxLat) continue;
      filtered.push(landFeatures[i]);
      filteredBboxes.push(bb);
    }
    return { features: filtered, bboxes: filteredBboxes };
  });

  const regionMeta = [];
  const buffers = [];
  let totalOffset = 0;

  for (let r = 0; r < REGIONS.length; r++) {
    const region = REGIONS[r];
    const { features, bboxes } = regionFeatures[r];
    const cols = Math.round((region.maxLng - region.minLng) / RESOLUTION);
    const rows = Math.round((region.maxLat - region.minLat) / RESOLUTION);
    const totalBits = cols * rows;
    const buffer = Buffer.alloc(Math.ceil(totalBits / 8), 0);

    console.log(`\nRegion: ${region.name} — ${cols}x${rows} = ${(totalBits/1e6).toFixed(1)}M cells, ${features.length} land features`);

    let landCount = 0;
    const startTime = Date.now();

    for (let row = 0; row < rows; row++) {
      if (row % 500 === 0) {
        const pct = ((row / rows) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  Row ${row}/${rows} (${pct}%) - ${elapsed}s - land: ${landCount}`);
      }

      // Top-to-bottom: row 0 = maxLat
      const lat = region.maxLat - (row + 0.5) * RESOLUTION;

      for (let col = 0; col < cols; col++) {
        const lng = region.minLng + (col + 0.5) * RESOLUTION;

        let isLand = false;
        for (let i = 0; i < features.length; i++) {
          const bb = bboxes[i];
          if (lng < bb[0] || lng > bb[2] || lat < bb[1] || lat > bb[3]) continue;
          if (turf.booleanPointInPolygon([lng, lat], features[i])) {
            isLand = true;
            break;
          }
        }

        if (isLand) {
          const bitIndex = row * cols + col;
          const byteIndex = Math.floor(bitIndex / 8);
          const bitOffset = 7 - (bitIndex % 8);
          buffer[byteIndex] |= (1 << bitOffset);
          landCount++;
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Done in ${elapsed}s. Land: ${landCount}, Water: ${totalBits - landCount}`);

    regionMeta.push({
      name: region.name,
      minLat: region.minLat,
      maxLat: region.maxLat,
      minLng: region.minLng,
      maxLng: region.maxLng,
      cols,
      rows,
      offset: totalOffset,
      bytes: buffer.length,
    });

    buffers.push(buffer);
    totalOffset += buffer.length;
  }

  // Write: JSON header (null-terminated) + binary data
  const header = JSON.stringify({ resolution: RESOLUTION, regions: regionMeta });
  const headerBuf = Buffer.from(header + '\0', 'utf-8');
  const output = Buffer.concat([headerBuf, ...buffers]);

  const outPath = path.join(__dirname, '..', 'public', 'migration', 'water-grid-regional.bin');
  fs.writeFileSync(outPath, output);
  console.log(`\nWritten to ${outPath} (${(output.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
