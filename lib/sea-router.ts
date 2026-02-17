/**
 * Client-side sea routing using pre-computed water/land grids + A* pathfinding.
 * 
 * Supports two grid layers:
 * 1. Global grid (0.1°, water-grid.bin) — fallback for areas outside regions
 * 2. Regional grids (0.01°, water-grid-regional.bin) — high-res for Americas + Europe
 */

// --- Grid types ---
interface GridRegion {
  name: string;
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
  cols: number; rows: number;
  offset: number; bytes: number;
}

interface RegionalGrid {
  resolution: number;
  regions: GridRegion[];
  data: Uint8Array;
}

// --- Singleton state ---
let globalData: Uint8Array | null = null;
let globalCols = 0, globalRows = 0, globalRes = 0;
let regional: RegionalGrid | null = null;
let loadPromise: Promise<void> | null = null;

/** Load both grid files */
export async function loadWaterGrid(): Promise<void> {
  if (globalData && regional) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [globalResp, regionalResp] = await Promise.all([
      fetch('/migration/water-grid.bin'),
      fetch('/migration/water-grid-regional.bin'),
    ]);

    // Parse global grid
    const globalBuf = await globalResp.arrayBuffer();
    const gView = new DataView(globalBuf);
    const magic = String.fromCharCode(gView.getUint8(0), gView.getUint8(1), gView.getUint8(2), gView.getUint8(3));
    if (magic !== 'WGRD') throw new Error('Invalid global water grid');
    globalCols = gView.getUint16(4);
    globalRows = gView.getUint16(6);
    globalRes = gView.getFloat32(8);
    globalData = new Uint8Array(globalBuf, 12);

    // Parse regional grid (JSON header null-terminated + binary data)
    const regionalBuf = await regionalResp.arrayBuffer();
    const bytes = new Uint8Array(regionalBuf);
    let nullIdx = 0;
    while (nullIdx < bytes.length && bytes[nullIdx] !== 0) nullIdx++;
    const headerStr = new TextDecoder().decode(bytes.slice(0, nullIdx));
    const header = JSON.parse(headerStr);
    regional = {
      resolution: header.resolution,
      regions: header.regions,
      data: new Uint8Array(regionalBuf, nullIdx + 1),
    };

    console.log(`[sea-router] Global grid: ${globalCols}x${globalRows} @ ${globalRes}°`);
    console.log(`[sea-router] Regional grids: ${regional.regions.map((r: GridRegion) => r.name).join(', ')} @ ${regional.resolution}°`);
  })();

  return loadPromise;
}

/** Find which regional grid contains a point, or null */
function findRegion(lat: number, lng: number): GridRegion | null {
  if (!regional) return null;
  for (const r of regional.regions) {
    if (lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng) return r;
  }
  return null;
}

/** Check if a point is land using the best available grid */
function isLandAt(lat: number, lng: number): boolean {
  // Try regional first
  const region = findRegion(lat, lng);
  if (region && regional) {
    const row = Math.floor((region.maxLat - lat) / regional.resolution);
    const col = Math.floor((lng - region.minLng) / regional.resolution);
    if (row >= 0 && row < region.rows && col >= 0 && col < region.cols) {
      const bitIndex = row * region.cols + col;
      const byteIndex = region.offset + Math.floor(bitIndex / 8);
      const bitOffset = 7 - (bitIndex % 8);
      return (regional.data[byteIndex] & (1 << bitOffset)) !== 0;
    }
  }
  // Fall back to global
  return isLandGlobal(lat, lng);
}

function isLandGlobal(lat: number, lng: number): boolean {
  if (!globalData) return false;
  const row = Math.floor((90 - lat) / globalRes);
  const col = Math.floor((lng + 180) / globalRes);
  if (row < 0 || row >= globalRows || col < 0 || col >= globalCols) return true;
  const bitIndex = row * globalCols + col;
  const byteIndex = Math.floor(bitIndex / 8);
  const bitOffset = 7 - (bitIndex % 8);
  return (globalData[byteIndex] & (1 << bitOffset)) !== 0;
}

/** Check if a lat/lng point is on water */
export function isWater(lat: number, lng: number): boolean {
  return !isLandAt(lat, lng);
}

/** Snap a lat/lng to nearest water (spiral search using best grid) */
export function snapToWater(lat: number, lng: number, maxRadius = 50): [number, number] {
  if (!isLandAt(lat, lng)) {
    console.log(`[sea-router] snapToWater(${lat.toFixed(4)}, ${lng.toFixed(4)}): already on water`);
    return [lat, lng];
  }

  const region = findRegion(lat, lng);
  const res = region && regional ? regional.resolution : globalRes;
  console.log(`[sea-router] snapToWater(${lat.toFixed(4)}, ${lng.toFixed(4)}): ON LAND, searching (res=${res}°, region=${region?.name || 'global'})...`);

  for (let r = 1; r <= maxRadius; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;
        const testLat = lat + dr * res;
        const testLng = lng + dc * res;
        if (!isLandAt(testLat, testLng)) {
          console.log(`[sea-router] snapToWater: snapped to (${testLat.toFixed(4)}, ${testLng.toFixed(4)}) at radius ${r}`);
          return [testLat, testLng];
        }
      }
    }
  }
  console.warn(`[sea-router] snapToWater: FAILED to find water within radius ${maxRadius}!`);
  return [lat, lng];
}

/**
 * A* pathfinding on the water grid.
 * Uses the best available resolution for the route area.
 */
export function findSeaRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  maxIterations = 500000
): [number, number][] | null {
  if (!globalData) {
    console.warn('[sea-router] findSeaRoute called but grid not loaded!');
    return null;
  }

  // Snap endpoints to water
  const [sLat, sLng] = snapToWater(fromLat, fromLng);
  const [eLat, eLng] = snapToWater(toLat, toLng);

  console.log(`[sea-router] findSeaRoute: snapped (${fromLat.toFixed(4)},${fromLng.toFixed(4)})→(${sLat.toFixed(4)},${sLng.toFixed(4)}), (${toLat.toFixed(4)},${toLng.toFixed(4)})→(${eLat.toFixed(4)},${eLng.toFixed(4)})`);

  if (isLandAt(sLat, sLng) || isLandAt(eLat, eLng)) {
    console.warn(`[sea-router] findSeaRoute: endpoints still on land after snap!`);
    return null;
  }

  // Determine grid resolution: use regional if both endpoints are in the same region
  const startRegion = findRegion(sLat, sLng);
  const endRegion = findRegion(eLat, eLng);
  const useRegional = startRegion && endRegion && startRegion.name === endRegion.name && regional;
  const res = useRegional ? regional!.resolution : globalRes;

  // Convert to grid coordinates
  const toRow = (lat: number) => useRegional
    ? Math.floor((startRegion!.maxLat - lat) / res)
    : Math.floor((90 - lat) / res);
  const toCol = (lng: number) => useRegional
    ? Math.floor((lng - startRegion!.minLng) / res)
    : Math.floor((lng + 180) / res);
  const maxRow = useRegional ? startRegion!.rows : globalRows;
  const maxCol = useRegional ? startRegion!.cols : globalCols;
  const toLatLng = (row: number, col: number): [number, number] => useRegional
    ? [startRegion!.maxLat - (row + 0.5) * res, startRegion!.minLng + (col + 0.5) * res]
    : [90 - (row + 0.5) * res, -180 + (col + 0.5) * res];

  const isLandCell = (row: number, col: number): boolean => {
    if (row < 0 || row >= maxRow || col < 0 || col >= maxCol) return true;
    const [lat, lng] = toLatLng(row, col);
    return isLandAt(lat, lng);
  };

  const sr = toRow(sLat), sc = toCol(sLng);
  const er = toRow(eLat), ec = toCol(eLng);

  if (isLandCell(sr, sc) || isLandCell(er, ec)) return null;

  // A* with 8-directional movement + binary heap
  const key = (r: number, c: number) => r * maxCol + c;
  const heuristic = (r: number, c: number) => {
    const dr = Math.abs(r - er), dc = Math.abs(c - ec);
    return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc);
  };

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const startKey = key(sr, sc);
  const endKey = key(er, ec);
  gScore.set(startKey, 0);

  // Binary min-heap
  const heap: [number, number][] = [];
  const heapPush = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const heapPop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let sm = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l][0] < heap[sm][0]) sm = l;
        if (r < heap.length && heap[r][0] < heap[sm][0]) sm = r;
        if (sm === i) break;
        [heap[sm], heap[i]] = [heap[i], heap[sm]];
        i = sm;
      }
    }
    return top;
  };

  heapPush([heuristic(sr, sc), startKey]);
  const closed = new Set<number>();

  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const costs = [1,1,1,1,Math.SQRT2,Math.SQRT2,Math.SQRT2,Math.SQRT2];

  let iterations = 0;
  while (heap.length > 0 && iterations < maxIterations) {
    iterations++;
    const [, currentKey] = heapPop();

    if (currentKey === endKey) {
      const path: [number, number][] = [];
      let k = endKey;
      while (k !== undefined) {
        const r = Math.floor(k / maxCol), c = k % maxCol;
        path.unshift(toLatLng(r, c));
        k = cameFrom.get(k)!;
        if (k === startKey) { path.unshift(toLatLng(sr, sc)); break; }
      }
      console.log(`[sea-router] A* found path: ${path.length} raw points, ${iterations} iterations, res=${res}°`);
      return simplifyPath(path, res * 1.5);
    }

    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    const cr = Math.floor(currentKey / maxCol), cc = currentKey % maxCol;
    const currentG = gScore.get(currentKey)!;

    for (let d = 0; d < 8; d++) {
      const nr = cr + dirs[d][0], nc = cc + dirs[d][1];
      if (nr < 0 || nr >= maxRow || nc < 0 || nc >= maxCol) continue;
      if (isLandCell(nr, nc)) continue;
      const nk = key(nr, nc);
      if (closed.has(nk)) continue;
      const tentG = currentG + costs[d];
      const prevG = gScore.get(nk);
      if (prevG === undefined || tentG < prevG) {
        gScore.set(nk, tentG);
        cameFrom.set(nk, currentKey);
        heapPush([tentG + heuristic(nr, nc), nk]);
      }
    }
  }

  console.log(`[sea-router] A* exhausted after ${iterations} iterations`);
  return null;
}

/** Douglas-Peucker path simplification */
function simplifyPath(path: [number, number][], tolerance: number): [number, number][] {
  if (path.length <= 2) return path;
  let maxDist = 0, maxIdx = 0;
  const [sLat, sLng] = path[0];
  const [eLat, eLng] = path[path.length - 1];
  for (let i = 1; i < path.length - 1; i++) {
    const d = ptLineDist(path[i][0], path[i][1], sLat, sLng, eLat, eLng);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tolerance) {
    const left = simplifyPath(path.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(path.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [path[0], path[path.length - 1]];
}

function ptLineDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
}
