const fs = require('fs');

// CSV parser handling quoted fields
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field.trim()); field = ''; }
      else if (c === '\n' || (c === '\r' && text[i+1] === '\n')) {
        if (c === '\r') i++;
        row.push(field.trim()); rows.push(row); row = []; field = '';
      } else field += c;
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

// Normalise date: MM/DD/YY or MM/DD/YYYY -> YYYY-MM-DD
function normaliseDate(d) {
  if (!d) return '';
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return d;
  const month = m[1].padStart(2, '0');
  const day = m[2].padStart(2, '0');
  let year = m[3];
  if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year;
  return `${year}-${month}-${day}`;
}

// Clean speed/distance values
function cleanNumber(v) {
  if (!v || v === 'not recorded' || v === 'speed not recorded') return '';
  // Remove commas from numbers like "1,068.70"
  return v.replace(/,/g, '');
}

const text = fs.readFileSync(__dirname + '/source.csv', 'utf8');
const rows = parseCSV(text);
const header = rows[0];

// Filter to journey rows (have a valid date in column 0)
const journeyRows = rows.slice(1).filter(r => r[0] && r[0].match(/\d{1,2}\/\d{1,2}\/\d{2,4}/));

console.log(`Parsed ${journeyRows.length} journey entries`);

const entries = [];
let prevTo = null;

for (let i = 0; i < journeyRows.length; i++) {
  const r = journeyRows[i];
  
  let from = r[1] || '';
  const to = r[2] || '';
  const country = r[8] || '';
  
  // Fix missing "From" — row 138 (0-indexed) 
  if (!from && prevTo) {
    from = prevTo;
    console.log(`  Fixed missing From at entry ${i}: using "${from}" from previous To`);
  }
  
  const entry = {
    index: i,
    departureDate: normaliseDate(r[0]),
    arrivalDate: normaliseDate(r[3]),
    from: from,
    to: to,
    country: country,
    distanceNm: cleanNumber(r[4]),
    avgSpeed: cleanNumber(r[5]),
    maxSpeed: cleanNumber(r[6]),
    totalDistance: cleanNumber(r[7]),
    fuel: r[9] || '',
    notes: r[10] || '',
  };
  
  entries.push(entry);
  prevTo = to;
}

// Validate
let issues = 0;
entries.forEach((e, i) => {
  if (!e.from) { console.log(`  ISSUE: Entry ${i} missing From`); issues++; }
  if (!e.to) { console.log(`  ISSUE: Entry ${i} missing To`); issues++; }
  if (!e.departureDate) { console.log(`  ISSUE: Entry ${i} missing departure date`); issues++; }
  if (!e.distanceNm) { console.log(`  ISSUE: Entry ${i} missing distance`); issues++; }
});

console.log(`Issues found: ${issues}`);
console.log(`Date range: ${entries[0].departureDate} to ${entries[entries.length-1].departureDate}`);

// Collect unique locations for geocoding
const locations = new Set();
entries.forEach(e => {
  locations.add(`${e.from}|${e.country}`);
  locations.add(`${e.to}|${e.country}`);
});
console.log(`Unique locations to geocode: ${locations.size}`);

fs.writeFileSync(__dirname + '/parsed-entries.json', JSON.stringify(entries, null, 2));
console.log('Written parsed-entries.json');
