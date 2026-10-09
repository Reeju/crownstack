import { C, CoinState, EnemyState, Kind, NO_ENTITY, Team } from './components';
import {
  COIN_PICKUP_DELAY_SEC,
  COIN_RADIUS,
  CHEST_RADIUS,
  FENCE_HALF_THICKNESS,
} from './constants';
import { Ev, emit } from './events';
import { samplePath, pathSample } from './pathing';
import { alloc, place, type World } from './world';

const UNIT = C.Transform | C.Velocity | C.Health;

export function spawnKing(w: World, x: number, y: number): number {
  const e = alloc(w, Kind.King, UNIT, Team.Player);
  const { king } = w.cfg.units;
  place(w, e, x, y);
  w.radius[e] = king.radius;
  w.hp[e] = w.maxHp[e] = king.hp + w.cfg.meta.kingHp;
  w.facing[e] = Math.PI / 4;
  return e;
}

/** Sets an archer's stats for `tier`, healing it to the new maximum. */
export function applyArcherTier(w: World, e: number, tier: number): void {
  const t = w.cfg.units.archer.tiers[tier];
  w.def[e] = tier;
  w.hp[e] = w.maxHp[e] = t.hp;
  w.damage[e] = t.damage;
  w.atkInterval[e] = t.attackInterval;
  w.atkRange[e] = t.range;
}

export function spawnArcher(w: World, x: number, y: number, tier: number): number {
  const e = alloc(w, Kind.Archer, UNIT | C.Attack | C.Squad, Team.Player);
  if (e === NO_ENTITY) return e;
  place(w, e, x, y);
  w.radius[e] = w.cfg.units.archer.radius;
  applyArcherTier(w, e, tier);
  w.slot[e] = w.archersAlive++;
  return e;
}

/** Sets a tower's stats for `tier` (1-based), healing it to the new maximum. */
export function applyTowerTier(w: World, e: number, tier: number): void {
  const t = w.cfg.units.tower.tiers[tier - 1];
  w.hp[e] = w.maxHp[e] = t.hp;
  w.damage[e] = t.damage;
  w.atkInterval[e] = t.attackInterval;
  w.atkRange[e] = t.range;
}

export function spawnTower(w: World, plot: number, tier: number): number {
  const e = alloc(w, Kind.Tower, C.Transform | C.Health | C.Attack, Team.Player);
  if (e === NO_ENTITY) return e;
  const p = w.plots[plot];
  place(w, e, p.x, p.y);
  w.radius[e] = w.cfg.units.tower.radius;
  w.def[e] = plot;
  applyTowerTier(w, e, tier);
  return e;
}

/** Spawns an enemy at the start of a path with a small lateral offset. */
export function spawnEnemy(w: World, def: number, path: number): number {
  const e = alloc(w, Kind.Enemy, UNIT | C.Attack | C.PathFollower | C.Loot, Team.Enemy);
  if (e === NO_ENTITY) return e;
  const d = w.enemyDefs[def];
  const off = w.rng.range(-0.6, 0.6);
  samplePath(w.paths[path], 0);
  place(w, e, pathSample.x - pathSample.ty * off, pathSample.y + pathSample.tx * off);
  w.radius[e] = d.radius;
  w.hp[e] = w.maxHp[e] = Math.round(d.hp * w.cfg.units.difficulty[w.cfg.difficulty].enemyHpMult);
  w.damage[e] = d.damage;
  w.atkInterval[e] = d.attackInterval;
  w.atkRange[e] = d.range;
  w.cooldown[e] = d.attackInterval * 0.5;
  w.def[e] = def;
  w.state[e] = EnemyState.Path;
  w.pathId[e] = path;
  w.pathOff[e] = off;
  w.value[e] = d.coins;
  w.slot[e] = NO_ENTITY;
  w.timer[e] = d.slam?.every ?? 0;
  w.timer2[e] = d.summon?.every ?? 0;
  w.facing[e] = Math.atan2(pathSample.ty, pathSample.tx);
  w.enemiesAlive++;
  return e;
}

/**
 * Drops a coin near (x, y). `lifetime` <= 0 means it never despawns (coins
 * placed by the level). Dropped coins slide outwards before they settle.
 */
export function spawnCoin(
  w: World,
  x: number,
  y: number,
  lifetime: number,
  scatter: number,
): number {
  const e = alloc(
    w,
    Kind.Coin,
    C.Transform | C.Velocity | (lifetime > 0 ? C.Lifetime : 0),
    Team.Neutral,
  );
  if (e === NO_ENTITY) return e;
  place(w, e, x, y);
  if (scatter > 0) {
    const angle = w.rng.range(0, Math.PI * 2);
    const speed = w.rng.range(0.4, 1) * scatter;
    w.vx[e] = Math.cos(angle) * speed;
    w.vy[e] = Math.sin(angle) * speed;
  }
  w.radius[e] = COIN_RADIUS;
  w.timer[e] = lifetime;
  w.timer2[e] = COIN_PICKUP_DELAY_SEC;
  w.state[e] = CoinState.Idle;
  emit(w.events, Ev.CoinDropped, x, y);
  return e;
}

export function spawnChest(w: World, x: number, y: number, coins: number): number {
  const e = alloc(w, Kind.Chest, C.Transform | C.Loot, Team.Neutral);
  if (e === NO_ENTITY) return e;
  place(w, e, x, y);
  w.radius[e] = CHEST_RADIUS;
  w.value[e] = coins;
  return e;
}

export function spawnFence(w: World, ax: number, ay: number, bx: number, by: number): number {
  const e = alloc(w, Kind.Fence, C.Transform | C.Health | C.Box, Team.Player);
  place(w, e, (ax + bx) / 2, (ay + by) / 2);
  w.hw[e] = Math.abs(bx - ax) / 2 + FENCE_HALF_THICKNESS;
  w.hh[e] = Math.abs(by - ay) / 2 + FENCE_HALF_THICKNESS;
  w.hp[e] = w.maxHp[e] = w.cfg.units.fence.hp;
  return e;
}

export function spawnKeep(w: World, x: number, y: number, width: number, height: number): number {
  const e = alloc(w, Kind.Keep, C.Transform | C.Health | C.Box, Team.Player);
  place(w, e, x + width / 2, y + height / 2);
  w.hw[e] = width / 2;
  w.hh[e] = height / 2;
  w.hp[e] = w.maxHp[e] = w.cfg.units.keep.hp;
  return e;
}
