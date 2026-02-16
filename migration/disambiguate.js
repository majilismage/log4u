const fs = require('fs');

const entries = JSON.parse(fs.readFileSync(__dirname + '/parsed-entries.json', 'utf8'));
const cache = JSON.parse(fs.readFileSync(__dirname + '/geocode-cache.json', 'utf8'));

// Haversine distance in nautical miles
function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nm
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Estimate a point at given distance (nm) and bearing from a start point
function estimatePoint(lat, lng, distanceNm, bearingDeg) {
  const R = 3440.065;
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const d = distanceNm / R;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lng);
  const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
  return { lat: toDeg(lat2), lng: toDeg(lon2) };
}

// Bearing from point 1 to point 2 in degrees
function bearing(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Country centroids for rough bearing estimates when no geocode results
const countryCentroids = {
  'USA': { lat: 37.0, lng: -95.7 }, 'Bahamas': { lat: 24.2, lng: -76.0 },
  'Dominican Republic': { lat: 18.7, lng: -70.2 }, 'Puerto Rico': { lat: 18.2, lng: -66.5 },
  'USVI': { lat: 18.3, lng: -64.9 }, 'BVI': { lat: 18.4, lng: -64.6 },
  'TCI': { lat: 21.7, lng: -71.8 }, 'St Maarten': { lat: 18.0, lng: -63.1 },
  'Panama': { lat: 9.0, lng: -79.5 }, 'Mexico': { lat: 23.6, lng: -102.5 },
  'Canada': { lat: 44.6, lng: -63.6 }, 'Portugal': { lat: 39.4, lng: -8.2 },
  'Spain': { lat: 40.5, lng: -3.7 }, 'France': { lat: 46.2, lng: 2.2 },
  'UK': { lat: 50.7, lng: -1.9 }, 'Italy': { lat: 41.9, lng: 12.5 }
};

// Pick best candidate from geocode results given a reference point and sailing distance
function pickCandidate(cacheEntry, refLat, refLng, sailingDistNm) {
  if (!cacheEntry || cacheEntry.candidateCount === 0) return null;
  
  const candidates = cacheEntry.results;
  if (candidates.length === 1) {
    return { ...candidates[0], confidence: 'green', method: 'single-match' };
  }
  
  // Multiple candidates — filter and rank
  const scored = candidates.map(c => {
    const crowFlies = haversineNm(refLat, refLng, c.lat, c.lng);
    const ratio = sailingDistNm > 0 ? crowFlies / sailingDistNm : 0;
    return { ...c, crowFlies, ratio };
  });
  
  // Filter: crow-flies must be <= sailing distance (with 20% tolerance for GPS/rounding)
  const valid = scored.filter(c => c.crowFlies <= sailingDistNm * 1.2);
  
  if (valid.length === 0) {
    // No candidate fits distance constraint — pick closest to sailing distance anyway
    scored.sort((a, b) => Math.abs(a.crowFlies - sailingDistNm) - Math.abs(b.crowFlies - sailingDistNm));
    return { ...scored[0], confidence: 'yellow', method: 'best-of-bad-options' };
  }
  
  if (valid.length === 1) {
    return { ...valid[0], confidence: 'green', method: 'distance-filtered-single' };
  }
  
  // Multiple valid — prefer highest ratio (closest to sailing distance without exceeding)
  valid.sort((a, b) => b.ratio - a.ratio);
  
  // If top two are very close (within 10nm), mark yellow
  const gap = Math.abs(valid[0].crowFlies - valid[1].crowFlies);
  const conf = gap < 10 ? 'yellow' : 'green';
  
  return { ...valid[0], confidence: conf, method: 'distance-ranked' };
}

// Process entries sequentially
const resolved = [];
let prevLat = null, prevLng = null;
let stats = { green: 0, yellow: 0, red: 0 };

for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const sailDist = parseFloat(e.distanceNm) || 0;
  const fromKey = `${e.from}|${e.country}`;
  const toKey = `${e.to}|${e.country}`;
  
  let fromResult = null, toResult = null;
  
  // Resolve FROM
  if (i === 0 || prevLat === null) {
    // First entry — just pick first/best geocode result
    const fc = cache[fromKey];
    if (fc && fc.candidateCount > 0) {
      fromResult = { lat: fc.results[0].lat, lng: fc.results[0].lng, confidence: fc.candidateCount === 1 ? 'green' : 'yellow', method: 'first-entry' };
    }
  } else {
    // Use previous To as From (they should match since we're sailing sequentially)
    // But verify against geocode
    const fc = cache[fromKey];
    if (fc && fc.candidateCount > 0) {
      fromResult = pickCandidate(fc, prevLat, prevLng, 20); // From should be very close to prev To
      // If the picked candidate is far from prevTo, just use prevTo coords
      if (fromResult) {
        const distFromPrev = haversineNm(prevLat, prevLng, fromResult.lat, fromResult.lng);
        if (distFromPrev > 30) {
          // Geocode gave us something far from where we should be — trust prev position
          fromResult = { lat: prevLat, lng: prevLng, confidence: 'yellow', method: 'inherited-from-prev-to' };
        }
      }
    } else {
      // No geocode — inherit from previous To
      fromResult = { lat: prevLat, lng: prevLng, confidence: 'yellow', method: 'inherited-no-geocode' };
    }
  }
  
  // If FROM still null, estimate from country centroid
  if (!fromResult) {
    const cc = countryCentroids[e.country];
    if (cc) {
      fromResult = { lat: cc.lat, lng: cc.lng, confidence: 'red', method: 'country-centroid' };
    } else {
      fromResult = { lat: 0, lng: 0, confidence: 'red', method: 'unknown' };
    }
  }
  
  // Resolve TO
  const tc = cache[toKey];
  if (tc && tc.candidateCount > 0) {
    toResult = pickCandidate(tc, fromResult.lat, fromResult.lng, sailDist);
  }
  
  if (!toResult) {
    // No geocode for To — estimate from From + distance
    // Use bearing toward country centroid or next entry's country as rough direction
    const cc = countryCentroids[e.country] || { lat: fromResult.lat, lng: fromResult.lng };
    const brng = bearing(fromResult.lat, fromResult.lng, cc.lat, cc.lng);
    // Use 70% of sailing distance as crow-flies estimate
    const est = estimatePoint(fromResult.lat, fromResult.lng, sailDist * 0.7, brng);
    toResult = { lat: est.lat, lng: est.lng, confidence: 'red', method: 'estimated-from-distance' };
  }
  
  // Overall confidence = worst of from and to
  const confOrder = { green: 2, yellow: 1, red: 0 };
  const overallConf = confOrder[fromResult.confidence] <= confOrder[toResult.confidence] ? fromResult.confidence : toResult.confidence;
  stats[overallConf]++;
  
  resolved.push({
    index: e.index,
    departureDate: e.departureDate,
    arrivalDate: e.arrivalDate,
    from: e.from,
    to: e.to,
    country: e.country,
    distanceNm: e.distanceNm,
    avgSpeed: e.avgSpeed,
    maxSpeed: e.maxSpeed,
    notes: e.notes,
    fuel: e.fuel,
    fromLat: Math.round(fromResult.lat * 100000) / 100000,
    fromLng: Math.round(fromResult.lng * 100000) / 100000,
    fromConfidence: fromResult.confidence,
    fromMethod: fromResult.method,
    toLat: Math.round(toResult.lat * 100000) / 100000,
    toLng: Math.round(toResult.lng * 100000) / 100000,
    toConfidence: toResult.confidence,
    toMethod: toResult.method,
    overallConfidence: overallConf
  });
  
  // Chain: this To becomes next From reference
  prevLat = toResult.lat;
  prevLng = toResult.lng;
}

fs.writeFileSync(__dirname + '/resolved-entries.json', JSON.stringify(resolved, null, 2));

console.log(`Resolved ${resolved.length} entries`);
console.log(`  Green: ${stats.green} | Yellow: ${stats.yellow} | Red: ${stats.red}`);

// List reds
const reds = resolved.filter(r => r.overallConfidence === 'red');
if (reds.length > 0) {
  console.log(`\nRed entries (${reds.length}):`);
  reds.forEach(r => console.log(`  ${r.index}: ${r.from} → ${r.to} (${r.fromMethod} / ${r.toMethod})`));
}
