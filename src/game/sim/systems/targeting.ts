import { C, Kind, NO_ENTITY } from '../components';
import { NIGHT_TOWER_RANGE_MULT } from '../constants';
import { clearHash, insert, nearest } from '../spatial';
import { setTarget, targetValid, type World } from '../world';

/** How often (in steps) a shooter with a live target looks for a closer one. */
const RETARGET_STEPS = 12;

/** Rebuilds the spatial hashes for this step. Runs before any range query. */
export function rebuildSpatial(w: World): void {
  clearHash(w.enemyHash);
  clearHash(w.friendHash);
  for (let e = 0; e < w.highWater; e++) {
    const kind = w.kind[e];
    if (kind === Kind.Enemy) insert(w.enemyHash, e, w.x[e], w.y[e]);
    else if ((kind === Kind.King || kind === Kind.Archer) && w.hp[e] > 0)
      insert(w.friendHash, e, w.x[e], w.y[e]);
  }
}

/** Effective attack range of a shooter; towers see less far at night until the brazier is lit. */
export function shooterRange(w: World, e: number): number {
  const dimmed = w.kind[e] === Kind.Tower && w.cfg.level.night && !w.eco.brazierLit;
  return dimmed ? w.atkRange[e] * NIGHT_TOWER_RANGE_MULT : w.atkRange[e];
}

/** Archers and towers lock on to the nearest enemy in range. */
export function targeting(w: World): void {
  for (let e = 0; e < w.highWater; e++) {
    const kind = w.kind[e];
    if ((kind !== Kind.Archer && kind !== Kind.Tower) || (w.mask[e] & C.Attack) === 0) continue;
    const range = shooterRange(w, e);

    let keep = targetValid(w, e);
    if (keep) {
      const t = w.target[e];
      keep = Math.hypot(w.x[t] - w.x[e], w.y[t] - w.y[e]) <= range + w.radius[t];
    }
    if (keep && (w.tick + e) % RETARGET_STEPS !== 0) continue;
    const found = nearest(w.enemyHash, w.x, w.y, w.x[e], w.y[e], range);
    setTarget(w, e, found === NO_ENTITY && keep ? w.target[e] : found);
  }
}
