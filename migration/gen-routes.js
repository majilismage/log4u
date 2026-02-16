const fs = require('fs');
const searoute = require('searoute-js');

const resolved = JSON.parse(fs.readFileSync(__dirname + '/resolved-entries.json', 'utf8'));

const routes = [];
let success = 0, failed = 0;

for (let i = 0; i < resolved.length; i++) {
  const e = resolved[i];
  
  const origin = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [e.fromLng, e.fromLat] }
  };
  
  const destination = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [e.toLng, e.toLat] }
  };
  
  let route = null;
  let searouteDistNm = null;
  
  try {
    route = searoute(origin, destination);
    searouteDistNm = route.properties?.length 
      ? Math.round(route.properties.length * 10) / 10 
      : null;
    success++;
  } catch (err) {
    // Some very short routes or land-to-land may fail
    // Fall back to straight line
    route = {
      type: "Feature",
      properties: { length: null, fallback: true },
      geometry: {
        type: "LineString",
        coordinates: [[e.fromLng, e.fromLat], [e.toLng, e.toLat]]
      }
    };
    failed++;
    if (i < 10 || failed <= 5) {
      console.log(`  Failed route ${i}: ${e.from} → ${e.to}: ${err.message}`);
    }
  }
  
  const loggedDist = parseFloat(e.distanceNm) || 0;
  const distRatio = (searouteDistNm && loggedDist > 0) 
    ? Math.round((searouteDistNm / loggedDist) * 100) / 100 
    : null;
  
  routes.push({
    index: e.index,
    from: e.from,
    to: e.to,
    loggedDistNm: loggedDist,
    searouteDistNm,
    distRatio,
    confidence: e.overallConfidence,
    route: route.geometry
  });
  
  if ((i + 1) % 50 === 0) console.log(`  Processed ${i + 1}/${resolved.length}`);
}

fs.writeFileSync(__dirname + '/routes.json', JSON.stringify(routes, null, 2));

console.log(`\nRoutes complete: ${success} success, ${failed} fallback-to-straight-line`);
console.log(`Written routes.json (${routes.length} entries)`);

// Distance ratio stats
const withRatio = routes.filter(r => r.distRatio !== null);
const closeMatch = withRatio.filter(r => r.distRatio >= 0.5 && r.distRatio <= 1.5);
const farOff = withRatio.filter(r => r.distRatio < 0.5 || r.distRatio > 1.5);
console.log(`\nDistance validation:`);
console.log(`  With sea-route distance: ${withRatio.length}`);
console.log(`  Close match (0.5-1.5x logged): ${closeMatch.length}`);
console.log(`  Far off (<0.5x or >1.5x): ${farOff.length}`);
if (farOff.length > 0 && farOff.length <= 20) {
  console.log(`\n  Far-off entries:`);
  farOff.forEach(r => console.log(`    ${r.index}: ${r.from} → ${r.to} | logged: ${r.loggedDistNm}nm, searoute: ${r.searouteDistNm}nm, ratio: ${r.distRatio}`));
}
