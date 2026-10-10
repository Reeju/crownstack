import { C, DT } from '../components';
import { KNOCK_DECAY } from '../constants';
import { place, type World } from '../world';

const INNER_RING_SLOTS = 8;
const OUTER_RING_SCALE = 1.7;
const ARRIVE_GAIN = 6;
/** An archer left this far behind (stuck on a wall or cliff) rejoins the king directly. */
const REGROUP_DISTANCE = 12;

/** Squad archers steer toward their slot on a loose ring around the king. */
export function squadFollow(w: World): void {
  const hero = w.hero;
  const { speed, ringRadius } = w.cfg.units.archer;
  const total = w.archersAlive;
  const inner = Math.min(total, INNER_RING_SLOTS);
  const outer = total - inner;

  for (let e = 0; e < w.highWater; e++) {
    if ((w.mask[e] & C.Squad) === 0) continue;
    const slot = w.slot[e];
    const onInner = slot < inner;
    const ringCount = onInner ? inner : outer;
    const angle = ((onInner ? slot : slot - inner) / ringCount) * Math.PI * 2;
    const r = onInner ? ringRadius : ringRadius * OUTER_RING_SCALE;
    const dx = w.x[hero] + Math.cos(angle) * r - w.x[e];
    const dy = w.y[hero] + Math.sin(angle) * r - w.y[e];
    const dist = Math.hypot(dx, dy);

    if (dist > REGROUP_DISTANCE) {
      place(w, e, w.x[hero], w.y[hero]);
      continue;
    }
    if (dist > 0.05 && w.stun[e] <= 0) {
      const v = Math.min(speed, dist * ARRIVE_GAIN);
      w.vx[e] = (dx / dist) * v;
      w.vy[e] = (dy / dist) * v;
      if (v > 0.5) w.facing[e] = Math.atan2(dy, dx);
    } else {
      w.vx[e] = w.vy[e] = 0;
    }
    w.stun[e] = Math.max(0, w.stun[e] - DT);
    w.x[e] += (w.vx[e] + w.kx[e]) * DT;
    w.y[e] += (w.vy[e] + w.ky[e]) * DT;
    w.kx[e] *= KNOCK_DECAY;
    w.ky[e] *= KNOCK_DECAY;
  }
}

/** Renumbers squad slots 0..n-1 after an archer dies or joins, keeping relative order. */
export function reassignSlots(w: World): void {
  let next = 0;
  for (let e = 0; e < w.highWater; e++) {
    if ((w.mask[e] & C.Squad) !== 0) w.slot[e] = next++;
  }
  w.archersAlive = next;
}
