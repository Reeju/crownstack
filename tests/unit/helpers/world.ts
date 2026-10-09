import { getLevel, getMap, units } from '../../../src/content';
import type { LevelDef } from '../../../src/content/schema';
import { createWorld } from '../../../src/game/sim/load';
import { step } from '../../../src/game/sim/step';
import { NO_META, type RunConfig, type World } from '../../../src/game/sim/world';

/** A level with no waves and no loose coins, for testing one system at a time. */
export function quietLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    ...getLevel(1),
    looseCoins: [],
    waves: [
      { at: 9999, path: 'ne', groups: [{ type: 'raider', count: 1, interval: 0, delay: 0 }] },
    ],
    ...overrides,
  };
}

export function makeWorld(level: LevelDef = getLevel(1), config: Partial<RunConfig> = {}): World {
  return createWorld({
    level,
    map: getMap(level.map),
    units,
    seed: 1234,
    difficulty: 'normal',
    meta: NO_META,
    ...config,
  });
}

export function run(w: World, seconds: number, moveX = 0, moveY = 0): void {
  w.intent.moveX = moveX;
  w.intent.moveY = moveY;
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w);
}

/** Teleports the king (and his interpolation history). */
export function moveHero(w: World, x: number, y: number): void {
  w.x[w.hero] = w.px[w.hero] = x;
  w.y[w.hero] = w.py[w.hero] = y;
}
