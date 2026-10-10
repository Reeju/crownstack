import { BUILDING_HALF } from './constants';
import { baseCoinCap, repeatCost } from './economy';
import { buildPath } from './pathing';
import { spawnArcher, spawnChest, spawnCoin, spawnFence, spawnKeep, spawnKing } from './spawn';
import { compileWaves } from './waves';
import {
  createEmptyWorld,
  type PadState,
  type RunConfig,
  type StaticBox,
  type World,
} from './world';

/** Builds the initial world for a run from validated content. */
export function createWorld(cfg: RunConfig): World {
  const { level, map, units, meta } = cfg;

  const paths = map.paths.map((p) => buildPath(p.id, p.points));
  const pathIndex = new Map(map.paths.map((p, i) => [p.id, i]));
  const enemyIndex = new Map(Object.keys(units.enemies).map((id, i) => [id, i]));
  const plots = map.plots.map((p) => ({ id: p.id, x: p.pos[0], y: p.pos[1], tier: 0, tower: -1 }));
  const plotIndex = new Map(map.plots.map((p, i) => [p.id, i]));

  const walls: StaticBox[] = [
    ...map.blockers.walls.map((r) => ({
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      hw: r.w / 2,
      hh: r.h / 2,
    })),
    ...map.blockers.buildings.map((b) => {
      const [hw, hh] = BUILDING_HALF[b.type];
      return { x: b.pos[0], y: b.pos[1], hw, hh };
    }),
  ];

  const pads: PadState[] = level.pads.map((lp) => {
    const mp = map.pads.find((m) => m.type === lp.type && m.plot === lp.plot);
    if (!mp) throw new Error(`Level ${level.id}: no ${lp.type} pad in map ${map.id}`);
    const base = lp.type === 'tower' ? repeatCost(lp.cost * meta.towerCostMult, 0, 1) : lp.cost;
    return {
      id: mp.id,
      type: lp.type,
      x: mp.pos[0],
      y: mp.pos[1],
      plot: mp.plot === undefined ? -1 : (plotIndex.get(mp.plot) ?? -1),
      baseCost: base,
      gear: lp.produces?.gear ?? 0,
      cost: base,
      paid: 0,
      active: true,
      paying: false,
      dwell: 0,
      drawAcc: 0,
      latched: false,
    };
  });

  const w = createEmptyWorld(cfg, {
    paths,
    walls,
    rocks: map.blockers.rocks.map((r) => ({ x: r.pos[0], y: r.pos[1], r: r.r })),
    pads,
    plots,
    waves: compileWaves(level, pathIndex, enemyIndex),
    fenceCount: map.blockers.fences.length,
  });

  map.blockers.fences.forEach((f, i) => {
    w.fences[i] = spawnFence(w, f.a[0], f.a[1], f.b[0], f.b[1]);
  });
  map.paths.forEach((p, i) => {
    w.pathTargets[i] = w.fences[map.blockers.fences.findIndex((f) => f.id === p.targetFence)];
  });
  w.keep = spawnKeep(w, map.keep.x, map.keep.y, map.keep.w, map.keep.h);
  w.hero = spawnKing(w, map.heroStart[0], map.heroStart[1]);

  const archers = level.squad.archers + meta.extraArchers;
  for (let i = 0; i < archers; i++) {
    const angle = (i / Math.max(archers, 1)) * Math.PI * 2;
    spawnArcher(
      w,
      map.heroStart[0] + Math.cos(angle) * units.archer.ringRadius,
      map.heroStart[1] + Math.sin(angle) * units.archer.ringRadius,
      level.squad.tier,
    );
  }

  for (const pile of level.looseCoins) {
    for (let i = 0; i < pile.count; i++) {
      spawnCoin(
        w,
        pile.pos[0] + w.rng.range(-0.7, 0.7),
        pile.pos[1] + w.rng.range(-0.7, 0.7),
        0,
        0,
      );
    }
  }
  for (const chest of level.chests) spawnChest(w, chest.pos[0], chest.pos[1], chest.coins);

  w.eco.coinCap = baseCoinCap(w);
  const startCoins = Math.floor(level.startGold / units.economy.coinValue);
  w.eco.stackCoins = Math.min(startCoins, w.eco.coinCap);
  w.eco.bank = level.startGold - w.eco.stackCoins * units.economy.coinValue;
  w.events.count = 0;
  return w;
}
