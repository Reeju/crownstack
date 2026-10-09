import { C, CoinState, DT, Kind } from '../components';
import { COIN_ATTRACT_SPEED, GEAR_HANDOUT_INTERVAL_SEC, GEAR_HANDOUT_RADIUS } from '../constants';
import { gainCoin } from '../economy';
import { Ev, emit } from '../events';
import { applyArcherTier, spawnCoin } from '../spawn';
import { free, type World } from '../world';

const COIN_FRICTION = 0.88;
const COLLECT_DISTANCE = 0.4;
const CHEST_SCATTER = 3.5;

/** Ground coins (drift, despawn, magnet, pickup), chests, and forge gear hand-out. */
export function lootSystem(w: World): void {
  const hero = w.hero;
  const heroAlive = w.hp[hero] > 0;
  const hx = w.x[hero];
  const hy = w.y[hero];
  const magnet = w.cfg.units.king.magnetRadius + w.cfg.meta.magnetRadius;

  for (let e = 0; e < w.highWater; e++) {
    const kind = w.kind[e];
    if (kind === Kind.Coin) {
      if ((w.mask[e] & C.Lifetime) !== 0 && w.state[e] === CoinState.Idle) {
        w.timer[e] -= DT;
        if (w.timer[e] <= 0) {
          free(w, e);
          continue;
        }
      }
      w.timer2[e] = Math.max(0, w.timer2[e] - DT);
      const dx = hx - w.x[e];
      const dy = hy - w.y[e];
      const dist = Math.hypot(dx, dy);

      if (w.state[e] === CoinState.Idle) {
        w.x[e] += w.vx[e] * DT;
        w.y[e] += w.vy[e] * DT;
        w.vx[e] *= COIN_FRICTION;
        w.vy[e] *= COIN_FRICTION;
        if (heroAlive && w.timer2[e] <= 0 && dist < magnet) w.state[e] = CoinState.Attracted;
      } else if (dist < COLLECT_DISTANCE || !heroAlive) {
        if (heroAlive) {
          gainCoin(w);
          emit(w.events, Ev.CoinPicked, hx, hy);
        }
        free(w, e);
      } else {
        const stepLen = Math.min(dist, COIN_ATTRACT_SPEED * DT);
        w.x[e] += (dx / dist) * stepLen;
        w.y[e] += (dy / dist) * stepLen;
      }
    } else if (kind === Kind.Chest && heroAlive) {
      if (Math.hypot(hx - w.x[e], hy - w.y[e]) < w.radius[e] + w.radius[hero]) {
        const lifetime = w.cfg.level.coinDespawnSec ?? w.cfg.units.economy.coinLifetimeSec;
        for (let i = 0; i < w.value[e]; i++) spawnCoin(w, w.x[e], w.y[e], lifetime, CHEST_SCATTER);
        emit(w.events, Ev.ChestOpened, w.x[e], w.y[e]);
        free(w, e);
      }
    }
  }

  handOutGear(w);
}

/** Carried bows go to nearby squad archers one at a time; undelivered gear expires. */
function handOutGear(w: World): void {
  const eco = w.eco;
  if (eco.gear <= 0) return;
  eco.gearTimer -= DT;
  if (eco.gearTimer <= 0) {
    eco.gear = 0;
    return;
  }
  eco.gearHandoutTimer -= DT;
  if (eco.gearHandoutTimer > 0) return;

  const hero = w.hero;
  const maxTier = w.cfg.level.maxArcherTier;
  let best = -1;
  let bestDist = GEAR_HANDOUT_RADIUS;
  for (let e = 0; e < w.highWater; e++) {
    if ((w.mask[e] & C.Squad) === 0 || w.def[e] >= maxTier) continue;
    const dist = Math.hypot(w.x[e] - w.x[hero], w.y[e] - w.y[hero]);
    if (dist < bestDist) {
      best = e;
      bestDist = dist;
    }
  }
  if (best < 0) return;
  applyArcherTier(w, best, w.def[best] + 1);
  eco.gear--;
  eco.gearHandoutTimer = GEAR_HANDOUT_INTERVAL_SEC;
  emit(w.events, Ev.GearDelivered, w.x[best], w.y[best], w.def[best]);
}
