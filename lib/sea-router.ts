/**
 * Client-side sea routing using a pre-computed water/land grid + A* pathfinding.
 * 
 * Grid format (water-grid.bin):
 *   Header: "WGRD" (4 bytes) + cols (uint16 BE) + rows (uint16 BE) + resolution (float32 BE)
 *   Data: 1 bit per cell, row-major, MSB first. 0=water, 1=land.
 *   Grid origin: top-left = (90°N, 180°W), row 0 = northernmost
 */

// Singleton grid data
let gridData: Uint8Array | null = null;
let gridCols = 0;
let gridRows = 0;
let gridRes = 0;
let loadPromise: Promise<void> | null = null;

/** Load the water grid binary file */
export async function loadWaterGrid(url = '/migration/water-grid.bin'): Promise<void> {
  if (gridData) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Parse header
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== 'WGRD') throw new Error('Invalid water grid file');

    gridCols = view.getUint16(4);
    gridRows = view.getUint16(6);
    gridRes = view.getFloat32(8);

    gridData = new Uint8Array(arrayBuffer, 12);
  })();

  return loadPromise;
}

/** Check if a grid cell is water (0) or land (1) */
function isLand(row: number, col: number): boolean {
  if (!gridData || row < 0 || row >= gridRows || col < 0 || col >= gridCols) return true; // out of bounds = land
  const bitIndex = row * gridCols + col;
  const byteIndex = Math.floor(bitIndex / 8);
  const bitOffset = 7 - (bitIndex % 8);
  return (gridData[byteIndex] & (1 << bitOffset)) !== 0;
}

/** Convert lat/lng to grid row/col */
function toGrid(lat: number, lng: number): [number, number] {
  const row = Math.floor((90 - lat) / gridRes);
  const col = Math.floor((lng + 180) / gridRes);
  return [
    Math.max(0, Math.min(gridRows - 1, row)),
    Math.max(0, Math.min(gridCols - 1, col)),
  ];
}

/** Convert grid row/col to lat/lng (cell center) */
function toLatLng(row: number, col: number): [number, number] {
  return [
    90 - (row + 0.5) * gridRes,
    -180 + (col + 0.5) * gridRes,
  ];
}

/** Check if a lat/lng point is on water */
export function isWater(lat: number, lng: number): boolean {
  if (!gridData) return true; // assume water if grid not loaded
  const [row, col] = toGrid(lat, lng);
  return !isLand(row, col);
}

/** Snap a lat/lng to nearest water cell (spiral search) */
export function snapToWater(lat: number, lng: number, maxRadius = 50): [number, number] {
  if (!gridData) return [lat, lng];
  const [startRow, startCol] = toGrid(lat, lng);

  if (!isLand(startRow, startCol)) return [lat, lng]; // already on water

  // Spiral outward
  for (let r = 1; r <= maxRadius; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue; // only check perimeter
        const nr = startRow + dr;
        const nc = startCol + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && !isLand(nr, nc)) {
          return toLatLng(nr, nc);
        }
      }
    }
  }

  return [lat, lng]; // fallback
}

/**
 * A* pathfinding on the water grid.
 * Returns array of [lat, lng] waypoints, or null if no path found.
 */
export function findSeaRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  maxIterations = 200000
): [number, number][] | null {
  if (!gridData) return null;

  const [startRow, startCol] = toGrid(fromLat, fromLng);
  const [endRow, endCol] = toGrid(toLat, toLng);

  // If start or end is on land, snap them
  let sr = startRow, sc = startCol, er = endRow, ec = endCol;
  if (isLand(sr, sc)) {
    const snapped = snapToWater(fromLat, fromLng);
    [sr, sc] = toGrid(snapped[0], snapped[1]);
  }
  if (isLand(er, ec)) {
    const snapped = snapToWater(toLat, toLng);
    [er, ec] = toGrid(snapped[0], snapped[1]);
  }

  if (isLand(sr, sc) || isLand(er, ec)) return null;

  // A* with 8-directional movement
  const key = (r: number, c: number) => r * gridCols + c;
  const heuristic = (r: number, c: number) => {
    const dr = Math.abs(r - er);
    const dc = Math.abs(c - ec);
    return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc); // octile distance
  };

  // Priority queue (simple binary heap)
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const startKey = key(sr, sc);
  const endKey = key(er, ec);

  gScore.set(startKey, 0);

  // Binary min-heap for priority queue
  const heap: [number, number][] = []; // [fScore, key]
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
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  heapPush([heuristic(sr, sc), startKey]);
  const closed = new Set<number>();

  const dirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1],       // cardinal
    [-1, -1], [-1, 1], [1, -1], [1, 1],      // diagonal
  ];
  const costs = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

  let iterations = 0;

  while (heap.length > 0 && iterations < maxIterations) {
    iterations++;

    const [, currentKey] = heapPop();

    if (currentKey === endKey) {
      // Reconstruct path
      const path: [number, number][] = [];
      let k = endKey;
      while (k !== undefined) {
        const r = Math.floor(k / gridCols);
        const c = k % gridCols;
        path.unshift(toLatLng(r, c));
        k = cameFrom.get(k)!;
        if (k === startKey) {
          path.unshift(toLatLng(sr, sc));
          break;
        }
      }
      return simplifyPath(path);
    }

    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    const cr = Math.floor(currentKey / gridCols);
    const cc = currentKey % gridCols;
    const currentG = gScore.get(currentKey)!;

    for (let d = 0; d < 8; d++) {
      const nr = cr + dirs[d][0];
      const nc = cc + dirs[d][1];
      if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;
      if (isLand(nr, nc)) continue;

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

  return null; // no path found
}

/**
 * Simplify path using Douglas-Peucker to reduce waypoint count.
 * Keeps route shape but removes redundant collinear points.
 */
function simplifyPath(path: [number, number][], tolerance = 0.15): [number, number][] {
  if (path.length <= 2) return path;

  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIdx = 0;

  const [startLat, startLng] = path[0];
  const [endLat, endLng] = path[path.length - 1];

  for (let i = 1; i < path.length - 1; i++) {
    const d = pointToLineDist(path[i][0], path[i][1], startLat, startLng, endLat, endLng);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(path.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(path.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [path[0], path[path.length - 1]];
}

function pointToLineDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
}
