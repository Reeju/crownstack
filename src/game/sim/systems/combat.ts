import { DT, Kind } from '../components';
import { applyDamage } from '../damage';
import { spawnArrow } from '../spawn';
import { free, targetValid, type World } from '../world';

/** Shooters fire at their target on cooldown; arrows home in and deal damage on arrival. */
export function combat(w: World): void {
  const arrowSpeed = w.cfg.units.archer.arrowSpeed;
  const fighting = w.outcome === 'playing';

  for (let e = 0; e < w.highWater; e++) {
    const kind = w.kind[e];

    if (kind === Kind.Archer || kind === Kind.Tower) {
      w.cooldown[e] = Math.max(0, w.cooldown[e] - DT);
      if (!fighting || !targetValid(w, e)) continue;
      const t = w.target[e];
      w.facing[e] = Math.atan2(w.y[t] - w.y[e], w.x[t] - w.x[e]);
      if (w.cooldown[e] <= 0) {
        w.cooldown[e] = w.atkInterval[e];
        spawnArrow(w, e, t);
      }
    } else if (kind === Kind.Arrow) {
      w.timer[e] -= DT;
      if (w.timer[e] <= 0 || !targetValid(w, e)) {
        free(w, e);
        continue;
      }
      const t = w.target[e];
      const dx = w.x[t] - w.x[e];
      const dy = w.y[t] - w.y[e];
      const dist = Math.hypot(dx, dy);
      const travel = arrowSpeed * DT;
      if (dist <= travel + w.radius[t]) {
        applyDamage(w, t, w.damage[e], w.x[e], w.y[e]);
        free(w, e);
      } else {
        w.vx[e] = (dx / dist) * arrowSpeed;
        w.vy[e] = (dy / dist) * arrowSpeed;
        w.x[e] += w.vx[e] * DT;
        w.y[e] += w.vy[e] * DT;
        w.facing[e] = Math.atan2(dy, dx);
      }
    }
  }
}
