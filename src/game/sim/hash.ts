import type { World } from './world';

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

function mix(h: number, n: number): number {
  return Math.imul(h ^ (n >>> 0), 0x01000193) >>> 0;
}

function mixFloat(h: number, v: number): number {
  f32[0] = v;
  return mix(h, u32[0]);
}

/** FNV-style hash of everything that defines the simulation state, for determinism tests. */
export function hashWorld(w: World): number {
  let h = 0x811c9dc5;
  h = mix(h, w.tick);
  h = mix(h, w.rng.state);
  h = mix(h, w.eco.stackCoins);
  h = mix(h, w.eco.bank);
  h = mix(h, w.eco.gear);
  h = mix(h, w.eco.goldEarned);
  h = mix(h, w.stats.kills);
  for (const pad of w.pads) h = mix(mix(h, pad.paid), pad.cost);
  for (let e = 0; e < w.highWater; e++) {
    h = mix(h, w.kind[e]);
    if (w.kind[e] === 0) continue;
    h = mixFloat(h, w.x[e]);
    h = mixFloat(h, w.y[e]);
    h = mixFloat(h, w.hp[e]);
  }
  return h;
}
