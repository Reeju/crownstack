import { C, DT, EnemyState, Kind, NO_ENTITY } from '../components';
import { AGGRO_RADIUS, KNOCK_DECAY, SEPARATION_RADIUS } from '../constants';
import { applyDamage } from '../damage';
import { Ev, emit } from '../events';
import { pathSample, samplePath } from '../pathing';
import { cellX, cellY, nearest } from '../spatial';
import { spawnEnemy } from '../spawn';
import { place, setTarget, targetValid, type World } from '../world';

/** Enemies walk toward a point this far ahead of them on their path. */
const CARROT_LEAD = 0.9;
/** How often (in steps) an enemy re-evaluates which unit to chase. */
const RETARGET_STEPS = 10;

/** Separation looks this far beyond an enemy's own radius for neighbours (largest enemy radius). */
const SEPARATION_REACH = 1.6;

/** Scratch: closest point on the current target and the distance to its edge. */
const reach = { x: 0, y: 0, edge: 0 };

/** Distance from (x, y) to the edge of entity `t`, which may be a circle or a box. */
function measure(w: World, x: number, y: number, t: number): void {
  if ((w.mask[t] & C.Box) !== 0) {
    reach.x = Math.min(Math.max(x, w.x[t] - w.hw[t]), w.x[t] + w.hw[t]);
    reach.y = Math.min(Math.max(y, w.y[t] - w.hh[t]), w.y[t] + w.hh[t]);
    reach.edge = Math.hypot(reach.x - x, reach.y - y);
  } else {
    reach.x = w.x[t];
    reach.y = w.y[t];
    reach.edge = Math.hypot(reach.x - x, reach.y - y) - w.radius[t];
  }
}

/** Structure to attack once the path is done: its fence, else the nearest tower, else the keep. */
function siegeTarget(w: World, e: number): number {
  const fence = w.pathTargets[w.pathId[e]];
  if (w.hp[fence] > 0) return fence;
  let best = w.keep;
  let bestDist = Infinity;
  for (const plot of w.plots) {
    if (plot.tier === 0) continue;
    const dist = Math.hypot(plot.x - w.x[e], plot.y - w.y[e]);
    if (dist < bestDist) {
      bestDist = dist;
      best = plot.tower;
    }
  }
  return best;
}

function separate(w: World, e: number): void {
  const h = w.enemyHash;
  const x = w.x[e];
  const y = w.y[e];
  const r = w.radius[e];
  const cx0 = cellX(h, x - r - SEPARATION_REACH);
  const cx1 = cellX(h, x + r + SEPARATION_REACH);
  const cy0 = cellY(h, y - r - SEPARATION_REACH);
  const cy1 = cellY(h, y + r + SEPARATION_REACH);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let o = h.head[cy * h.cols + cx]; o !== -1; o = h.next[o]) {
        if (o === e || w.kind[o] !== Kind.Enemy) continue;
        const dx = w.x[e] - w.x[o];
        const dy = w.y[e] - w.y[o];
        const min = Math.max(SEPARATION_RADIUS, (r + w.radius[o]) * 0.9);
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        // Heavier (larger) enemies yield less.
        const push = (min - d) * (w.radius[o] / (r + w.radius[o])) * 0.5;
        w.x[e] += (dx / d) * push;
        w.y[e] += (dy / d) * push;
      }
    }
  }
}

function bossAbilities(w: World, e: number): void {
  const def = w.enemyDefs[w.def[e]];
  if (def.slam) {
    w.timer[e] -= DT;
    if (w.timer[e] <= 0) {
      w.timer[e] = def.slam.every;
      emit(w.events, Ev.Slam, w.x[e], w.y[e], def.slam.radius);
      for (let t = 0; t < w.highWater; t++) {
        const kind = w.kind[t];
        if (
          kind !== Kind.King &&
          kind !== Kind.Archer &&
          kind !== Kind.Tower &&
          kind !== Kind.Fence
        )
          continue;
        measure(w, w.x[e], w.y[e], t);
        if (reach.edge < def.slam.radius)
          applyDamage(w, t, def.slam.damage, w.x[e], w.y[e], def.knockback);
      }
    }
  }
  if (def.summon) {
    w.timer2[e] -= DT;
    if (w.timer2[e] <= 0) {
      w.timer2[e] = def.summon.every;
      const summonDef = w.enemyDefIndex.get(def.summon.type) ?? 0;
      for (let i = 0; i < def.summon.count; i++) {
        const s = spawnEnemy(w, summonDef, w.pathId[e]);
        if (s === NO_ENTITY) break;
        const angle = (i / def.summon.count) * Math.PI * 2;
        place(
          w,
          s,
          w.x[e] + Math.cos(angle) * (w.radius[e] + 0.6),
          w.y[e] + Math.sin(angle) * (w.radius[e] + 0.6),
        );
        w.pathS[s] = w.pathS[e];
        w.state[s] = w.state[e];
      }
    }
  }
}

/**
 * Enemy behaviour: follow the path, chase player units that come close, and
 * once the path ends lay siege to the fence, then towers, then the keep.
 * Whatever standing structure blocks an enemy becomes its target.
 */
export function enemyAI(w: World): void {
  for (let e = 0; e < w.highWater; e++) {
    if (w.kind[e] !== Kind.Enemy) continue;
    const def = w.enemyDefs[w.def[e]];
    w.cooldown[e] = Math.max(0, w.cooldown[e] - DT);
    if (def.boss) bossAbilities(w, e);

    let moveX = 0;
    let moveY = 0;
    if (w.stun[e] > 0) {
      w.stun[e] -= DT;
    } else {
      // Pick a unit to chase, if one is close; otherwise keep the structure target.
      if ((w.tick + e) % RETARGET_STEPS === 0 || !targetValid(w, e)) {
        const unit = nearest(w.friendHash, w.x, w.y, w.x[e], w.y[e], AGGRO_RADIUS + w.radius[e]);
        if (unit !== NO_ENTITY) setTarget(w, e, unit);
        else if (w.state[e] === EnemyState.Siege) setTarget(w, e, siegeTarget(w, e));
        else setTarget(w, e, NO_ENTITY);
      }
      // A standing structure in the way gets attacked instead.
      const blocker = w.slot[e];
      if (blocker !== NO_ENTITY && w.hp[blocker] > 0 && w.target[e] !== NO_ENTITY) {
        measure(w, w.x[e], w.y[e], w.target[e]);
        if (reach.edge > w.atkRange[e]) setTarget(w, e, blocker);
      }

      const target = w.target[e];
      if (target !== NO_ENTITY && targetValid(w, e)) {
        measure(w, w.x[e], w.y[e], target);
        const dx = reach.x - w.x[e];
        const dy = reach.y - w.y[e];
        const dist = Math.hypot(dx, dy) || 1;
        w.facing[e] = Math.atan2(dy, dx);
        if (reach.edge - w.radius[e] <= w.atkRange[e]) {
          if (w.cooldown[e] <= 0) {
            w.cooldown[e] = w.atkInterval[e];
            applyDamage(w, target, w.damage[e], w.x[e], w.y[e], def.knockback);
          }
        } else {
          moveX = dx / dist;
          moveY = dy / dist;
        }
      } else if (w.state[e] === EnemyState.Path) {
        const path = w.paths[w.pathId[e]];
        samplePath(path, w.pathS[e]);
        const cx = pathSample.x - pathSample.ty * w.pathOff[e];
        const cy = pathSample.y + pathSample.tx * w.pathOff[e];
        const dx = cx - w.x[e];
        const dy = cy - w.y[e];
        const dist = Math.hypot(dx, dy);
        // The carrot only advances while the enemy keeps up with it.
        if (dist < CARROT_LEAD) w.pathS[e] += def.speed * DT;
        if (dist > 1e-4) {
          moveX = dx / dist;
          moveY = dy / dist;
          w.facing[e] = Math.atan2(dy, dx);
        }
        if (w.pathS[e] >= path.length) w.state[e] = EnemyState.Siege;
      }
    }

    w.vx[e] = moveX * def.speed;
    w.vy[e] = moveY * def.speed;
    w.x[e] += (w.vx[e] + w.kx[e]) * DT;
    w.y[e] += (w.vy[e] + w.ky[e]) * DT;
    w.kx[e] *= KNOCK_DECAY;
    w.ky[e] *= KNOCK_DECAY;
    separate(w, e);
  }
}
