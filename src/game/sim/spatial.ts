import { SPATIAL_CELL } from './constants';

/** Enemies spawn slightly outside the map, so the grid extends past its edges. */
const MARGIN = 6;

/**
 * Uniform grid of intrusive linked lists: no allocation after construction.
 * Rebuilt every step for the unit sets that are queried by range.
 */
export interface SpatialHash {
  readonly cols: number;
  readonly rows: number;
  readonly head: Int32Array;
  readonly next: Int32Array;
}

export function createSpatialHash(mapW: number, mapH: number, maxEntities: number): SpatialHash {
  const cols = Math.ceil((mapW + MARGIN * 2) / SPATIAL_CELL);
  const rows = Math.ceil((mapH + MARGIN * 2) / SPATIAL_CELL);
  return {
    cols,
    rows,
    head: new Int32Array(cols * rows).fill(-1),
    next: new Int32Array(maxEntities).fill(-1),
  };
}

export function cellX(h: SpatialHash, x: number): number {
  return Math.min(Math.max(Math.floor((x + MARGIN) / SPATIAL_CELL), 0), h.cols - 1);
}

export function cellY(h: SpatialHash, y: number): number {
  return Math.min(Math.max(Math.floor((y + MARGIN) / SPATIAL_CELL), 0), h.rows - 1);
}

export function clearHash(h: SpatialHash): void {
  h.head.fill(-1);
}

export function insert(h: SpatialHash, e: number, x: number, y: number): void {
  const cell = cellY(h, y) * h.cols + cellX(h, x);
  h.next[e] = h.head[cell];
  h.head[cell] = e;
}

/**
 * Nearest entity in the hash whose centre is within `range` of (x, y), or -1.
 * Ties resolve to the entity visited first, which is deterministic.
 */
export function nearest(
  h: SpatialHash,
  xs: Float32Array,
  ys: Float32Array,
  x: number,
  y: number,
  range: number,
): number {
  let best = -1;
  let bestD2 = range * range;
  const x0 = cellX(h, x - range);
  const x1 = cellX(h, x + range);
  const y0 = cellY(h, y - range);
  const y1 = cellY(h, y + range);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (let e = h.head[cy * h.cols + cx]; e !== -1; e = h.next[e]) {
        const dx = xs[e] - x;
        const dy = ys[e] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = e;
        }
      }
    }
  }
  return best;
}
