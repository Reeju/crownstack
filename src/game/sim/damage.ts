import { C, DT, Kind, NO_ENTITY } from './components';
import { HIT_FLASH_SEC, KNOCK_DECAY, STAGGER_SEC } from './constants';
import { currentPadCost } from './economy';
import { Ev, emit } from './events';
import { spawnCoin } from './spawn';
import { reassignSlots } from './systems/squadFollow';
import { free, type World } from './world';

const COIN_DROP_SCATTER = 2.4;

/** Initial knockback speed that travels `distance` units under KNOCK_DECAY. */
function knockSpeed(distance: number): number {
  return (distance * (1 - KNOCK_DECAY)) / DT;
}

function killEnemy(w: World, e: number): void {
  const def = w.enemyDefs[w.def[e]];
  const lifetime = w.cfg.level.coinDespawnSec ?? w.cfg.units.economy.coinLifetimeSec;
  for (let i = 0; i < w.value[e]; i++) spawnCoin(w, w.x[e], w.y[e], lifetime, COIN_DROP_SCATTER);
  w.stats.kills++;
  w.stats.bonusScore += def.scoreBonus;
  w.enemiesAlive--;
  emit(w.events, Ev.EnemyKilled, w.x[e], w.y[e], w.def[e], def.scoreBonus > 0 ? 1 : 0);
  free(w, e);
}

function killTower(w: World, e: number): void {
  const plotIndex = w.def[e];
  const plot = w.plots[plotIndex];
  plot.tier = 0;
  plot.tower = NO_ENTITY;
  // The plot can be rebuilt: its pad comes back at the current tower price.
  for (const pad of w.pads) {
    if (pad.type === 'tower' && pad.plot === plotIndex) {
      pad.active = true;
      pad.paid = 0;
      pad.cost = currentPadCost(w, pad);
    }
  }
  emit(w.events, Ev.UnitDied, w.x[e], w.y[e], Kind.Tower);
  free(w, e);
}

function kill(w: World, e: number): void {
  switch (w.kind[e]) {
    case Kind.Enemy:
      killEnemy(w, e);
      break;
    case Kind.Archer:
      emit(w.events, Ev.UnitDied, w.x[e], w.y[e], Kind.Archer);
      free(w, e);
      reassignSlots(w);
      break;
    case Kind.Tower:
      killTower(w, e);
      break;
    case Kind.Fence:
      // Fences stay allocated at 0 HP so the repair pad can restore them.
      emit(w.events, Ev.FenceBroken, w.x[e], w.y[e]);
      break;
    case Kind.King:
    case Kind.Keep:
      // Detected by the outcome system.
      emit(w.events, Ev.UnitDied, w.x[e], w.y[e], w.kind[e]);
      break;
  }
}

/**
 * Applies damage to anything with Health. `knockback` (world units) pushes
 * walking player units away from (fromX, fromY).
 */
export function applyDamage(
  w: World,
  target: number,
  amount: number,
  fromX: number,
  fromY: number,
  knockback = 0,
): void {
  if ((w.mask[target] & C.Health) === 0 || w.hp[target] <= 0) return;
  const kind = w.kind[target];

  if (kind === Kind.King) {
    if (w.king.iframes > 0) return;
    w.king.iframes = w.cfg.units.king.iframesSec;
    w.king.sinceHit = 0;
    emit(w.events, Ev.KingHit, w.x[target], w.y[target], amount);
  }

  w.hp[target] = Math.max(0, w.hp[target] - amount);
  w.flash[target] = HIT_FLASH_SEC;
  emit(w.events, Ev.Damage, w.x[target], w.y[target], amount, kind);

  if (knockback > 0 && (kind === Kind.King || kind === Kind.Archer)) {
    const dx = w.x[target] - fromX;
    const dy = w.y[target] - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    w.kx[target] = (dx / dist) * knockSpeed(knockback);
    w.ky[target] = (dy / dist) * knockSpeed(knockback);
    emit(w.events, Ev.HeavyHit, w.x[target], w.y[target]);
  }

  if (kind === Kind.Enemy) {
    const staggerHits = w.enemyDefs[w.def[target]].staggerHits;
    if (staggerHits > 0 && ++w.hits[target] >= staggerHits) {
      w.hits[target] = 0;
      w.stun[target] = STAGGER_SEC;
    }
  }

  if (w.hp[target] <= 0) kill(w, target);
}
