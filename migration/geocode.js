const fs = require('fs');
const https = require('https');

const entries = JSON.parse(fs.readFileSync(__dirname + '/parsed-entries.json', 'utf8'));
const cacheFile = __dirname + '/geocode-cache.json';
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

// Country code mapping for Nominatim
const countryCodes = {
  'USA': 'us', 'Bahamas': 'bs', 'Dominican Republic': 'do', 'Puerto Rico': 'pr',
  'USVI': 'vi', 'BVI': 'vg', 'TCI': 'tc', 'St Maarten': 'sx',
  'Panama': 'pa', 'Mexico': 'mx', 'Canada': 'ca', 'Portugal': 'pt',
  'Spain': 'es', 'France': 'fr', 'UK': 'gb', 'Italy': 'it'
};

function nominatimSearch(query, countryCode) {
  return new Promise((resolve, reject) => {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    if (countryCode) url += `&countrycodes=${countryCode}`;
    
    const req = https.get(url, { headers: { 'User-Agent': 'WanderNote-Migration/1.0 (arthur.knight@3g-international.com)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Collect unique locations
const locations = new Map();
entries.forEach(e => {
  const fromKey = `${e.from}|${e.country}`;
  const toKey = `${e.to}|${e.country}`;
  if (!locations.has(fromKey)) locations.set(fromKey, { name: e.from, country: e.country });
  if (!locations.has(toKey)) locations.set(toKey, { name: e.to, country: e.country });
});

async function geocodeAll() {
  const keys = [...locations.keys()];
  let done = 0, cached = 0, failed = 0;
  
  for (const key of keys) {
    if (cache[key]) { cached++; continue; }
    
    const loc = locations.get(key);
    const cc = countryCodes[loc.country] || '';
    
    try {
      // Try with country code first
      let results = await nominatimSearch(loc.name, cc);
      
      // If no results, try without country code
      if (results.length === 0) {
        await sleep(1100);
        results = await nominatimSearch(loc.name, '');
      }
      
      // If still no results, try adding country name to query
      if (results.length === 0) {
        await sleep(1100);
        results = await nominatimSearch(`${loc.name}, ${loc.country}`, '');
      }
      
      cache[key] = {
        query: loc.name,
        country: loc.country,
        results: results.map(r => ({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
          type: r.type,
          importance: r.importance
        })),
        candidateCount: results.length,
        timestamp: new Date().toISOString()
      };
      
      done++;
      if (done % 10 === 0) {
        console.log(`  Geocoded ${done}/${keys.length - cached} (${cached} cached, ${failed} failed)`);
        // Save periodically
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      }
    } catch (err) {
      console.log(`  FAILED: "${loc.name}" (${loc.country}): ${err.message}`);
      cache[key] = { query: loc.name, country: loc.country, results: [], candidateCount: 0, error: err.message };
      failed++;
    }
    
    await sleep(1100); // Nominatim rate limit
  }
  
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  console.log(`\nGeocoding complete: ${done} new, ${cached} cached, ${failed} failed out of ${keys.length} total`);
  
  // Report failures
  const failures = Object.entries(cache).filter(([k, v]) => v.candidateCount === 0);
  if (failures.length > 0) {
    console.log(`\nFailed locations (${failures.length}):`);
    failures.forEach(([k, v]) => console.log(`  - ${v.query} (${v.country})`));
  }
  
  // Report ambiguous (>1 candidate)
  const ambiguous = Object.entries(cache).filter(([k, v]) => v.candidateCount > 1);
  console.log(`\nAmbiguous locations (${ambiguous.length} with multiple candidates)`);
}

geocodeAll().catch(e => { console.error(e); process.exit(1); });
