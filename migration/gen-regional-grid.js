#!/usr/bin/env node
/**
 * Generate regional water/land grids at 0.005° (~550m) resolution.
 * Uses Natural Earth 10m land polygons, exploded into individual polygons
 * for efficient bbox filtering.
 */

const shapefile = require('shapefile');
const turf = require('@turf/turf');
const fs = require('fs');
const path = require('path');

const RESOLUTION = 0.005;

const REGIONS = [
  { name: 'americas', minLat: 20, maxLat: 45, minLng: -89, maxLng: -53 },
  { name: 'europe', minLat: 35, maxLat: 52, minLng: -11, maxLng: 17 },
];

async function main() {
  console.log('Loading Natural Earth 10m land polygons...');
  const source = await shapefile.open(
    path.join(__dirname, 'ne_10m_land', 'ne_10m_land.shp')
  );

  // Explode multipolygons into individual polygons, then simplify
  // Simplify to half the grid resolution — preserves features at grid scale
  const SIMPLIFY_TOL = RESOLUTION / 2; // 0.0025°
  const allPolygons = [];
  let totalVertsBefore = 0, totalVertsAfter = 0;
  let result;
  while (!(result = await source.read()).done) {
    const feature = result.value;
    const polys = feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates.map(c => turf.polygon(c))
      : [feature];
    for (const poly of polys) {
      totalVertsBefore += turf.coordAll(poly).length;
      const simplified = turf.simplify(poly, { tolerance: SIMPLIFY_TOL, highQuality: false });
      // Skip degenerate polygons after simplification
      const coords = turf.coordAll(simplified);
      totalVertsAfter += coords.length;
      if (coords.length >= 4) {
        allPolygons.push(simplified);
      }
    }
  }
  console.log(`Exploded into ${allPolygons.length} polygons`);
  console.log(`Simplified: ${totalVertsBefore} → ${totalVertsAfter} vertices (${((1 - totalVertsAfter/totalVertsBefore)*100).toFixed(0)}% reduction)`);

  // Pre-compute bboxes
  const allBboxes = allPolygons.map(f => turf.bbox(f));

  const regionMeta = [];
  const buffers = [];
  let totalOffset = 0;

  for (let r = 0; r < REGIONS.length; r++) {
    const region = REGIONS[r];

    // Filter polygons that overlap this region
    const features = [];
    const bboxes = [];
    for (let i = 0; i < allPolygons.length; i++) {
      const bb = allBboxes[i];
      if (bb[2] < region.minLng || bb[0] > region.maxLng ||
          bb[3] < region.minLat || bb[1] > region.maxLat) continue;
      features.push(allPolygons[i]);
      bboxes.push(bb);
    }

    const cols = Math.round((region.maxLng - region.minLng) / RESOLUTION);
    const rows = Math.round((region.maxLat - region.minLat) / RESOLUTION);
    const totalBits = cols * rows;
    const buffer = Buffer.alloc(Math.ceil(totalBits / 8), 0);

    console.log(`\nRegion: ${region.name} — ${cols}x${rows} = ${(totalBits/1e6).toFixed(1)}M cells, ${features.length} polygons`);

    let landCount = 0;
    const startTime = Date.now();

    for (let row = 0; row < rows; row++) {
      if (row % 50 === 0) {
        const pct = ((row / rows) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  Row ${row}/${rows} (${pct}%) - ${elapsed}s - land: ${landCount}`);
      }

      const lat = region.maxLat - (row + 0.5) * RESOLUTION;

      // Pre-filter: only check polygons whose lat range includes this row
      const rowFeatures = [];
      const rowBboxes = [];
      for (let i = 0; i < features.length; i++) {
        const bb = bboxes[i];
        if (lat < bb[1] || lat > bb[3]) continue;
        rowFeatures.push(features[i]);
        rowBboxes.push(bb);
      }

      for (let col = 0; col < cols; col++) {
        const lng = region.minLng + (col + 0.5) * RESOLUTION;

        let isLand = false;
        for (let i = 0; i < rowFeatures.length; i++) {
          const bb = rowBboxes[i];
          if (lng < bb[0] || lng > bb[2]) continue;
          if (turf.booleanPointInPolygon([lng, lat], rowFeatures[i])) {
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
      minLat: region.minLat, maxLat: region.maxLat,
      minLng: region.minLng, maxLng: region.maxLng,
      cols, rows,
      offset: totalOffset,
      bytes: buffer.length,
    });

    buffers.push(buffer);
    totalOffset += buffer.length;
  }

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
