/** Catmull-Rom enemy paths, pre-sampled into arc-length-indexed polylines at load. */

const SAMPLES_PER_SEGMENT = 12;

export interface PathData {
  readonly id: string;
  readonly length: number;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  /** Cumulative distance at each sample. */
  readonly cum: Float32Array;
}

/** Scratch output of `samplePath` (position and unit tangent). */
export const pathSample = { x: 0, y: 0, tx: 1, ty: 0 };

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (3 * p1 - p0 - 3 * p2 + p3) * t3)
  );
}

export function buildPath(id: string, points: readonly (readonly [number, number])[]): PathData {
  const n = (points.length - 1) * SAMPLES_PER_SEGMENT + 1;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const cum = new Float32Array(n);
  const at = (i: number) => points[Math.min(Math.max(i, 0), points.length - 1)]!;

  for (let i = 0; i < n; i++) {
    const seg = Math.min(Math.floor(i / SAMPLES_PER_SEGMENT), points.length - 2);
    const t = i / SAMPLES_PER_SEGMENT - seg;
    const [p0, p1, p2, p3] = [at(seg - 1), at(seg), at(seg + 1), at(seg + 2)];
    xs[i] = catmullRom(p0[0], p1[0], p2[0], p3[0], t);
    ys[i] = catmullRom(p0[1], p1[1], p2[1], p3[1], t);
    cum[i] = i === 0 ? 0 : cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  return { id, length: cum[n - 1], xs, ys, cum };
}

/** Writes the point and tangent at distance `s` along the path into `pathSample`. */
export function samplePath(path: PathData, s: number): void {
  const { xs, ys, cum } = path;
  const last = cum.length - 1;
  const d = Math.min(Math.max(s, 0), path.length);

  // Binary search for the sample interval containing d.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const t = span > 0 ? (d - cum[lo]) / span : 0;
  const dx = xs[hi] - xs[lo];
  const dy = ys[hi] - ys[lo];
  const len = Math.hypot(dx, dy) || 1;
  pathSample.x = xs[lo] + dx * t;
  pathSample.y = ys[lo] + dy * t;
  pathSample.tx = dx / len;
  pathSample.ty = dy / len;
}
