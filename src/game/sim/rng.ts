/** Seeded mulberry32 PRNG. The only source of randomness allowed in `sim/`. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Internal state, exposed for state hashing. */
  get state(): number {
    return this.s;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

/** Run seed from level id and attempt number, so Retry can reproduce a run (SPEC §3.6). */
export function runSeed(levelId: number, attempt: number): number {
  let h = 0x811c9dc5;
  for (const n of [levelId, attempt]) {
    h = Math.imul(h ^ n, 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  return h;
}
