import { describe, expect, it } from 'vitest';

import { getMap, levels } from '../../src/content';
import { runSeed } from '../../src/game/sim/rng';
import { playBot } from '../bot/bot';
import { makeWorld } from './helpers/world';

/** Live entities allowed at once; the frame budget in SPEC §7.3 is specified at 300. */
const ENTITY_BUDGET = 300;

/** Enemy totals from the level table in SPEC §4.1: [raiders, brutes, giants, bosses]. */
const TABLE: Record<number, [number, number, number, number]> = {
  1: [24, 0, 0, 0],
  2: [40, 0, 1, 0],
  3: [60, 0, 2, 0],
  4: [70, 0, 2, 0],
  5: [70, 10, 2, 0],
  6: [80, 12, 2, 1],
  7: [100, 16, 3, 0],
  8: [120, 20, 4, 0],
  9: [120, 24, 4, 2],
  10: [160, 30, 6, 0],
  11: [200, 40, 8, 0],
  12: [220, 48, 8, 1],
};

describe('levels', () => {
  it('ship all twelve', () => {
    expect(levels).toHaveLength(12);
  });

  it.each(levels.map((l) => [l.id, l.name, l] as const))(
    'level %i (%s) matches the spec table',
    (id, _n, level) => {
      const count = (match: (type: string) => boolean) =>
        level.waves.reduce(
          (sum, w) => sum + w.groups.filter((g) => match(g.type)).reduce((s, g) => s + g.count, 0),
          0,
        );
      expect([
        count((t) => t === 'raider'),
        count((t) => t === 'brute'),
        count((t) => t === 'giant'),
        count((t) => t.startsWith('chieftain')),
      ]).toEqual(TABLE[id]);
      // Every path the level uses crosses the fence or gate it names.
      const map = getMap(level.map);
      for (const wave of level.waves) expect(map.paths.some((p) => p.id === wave.path)).toBe(true);
    },
  );

  it.each(levels.map((l) => [l.id, l.name, l] as const))(
    'level %i (%s) is winnable on Normal within par + 50%% and inside the entity budget',
    { timeout: 120_000 },
    (id, _n, level) => {
      const run = playBot(makeWorld(level, { seed: runSeed(id, 1) }), 'careful');
      expect(run.outcome).toBe('won');
      expect(run.timeSec).toBeLessThanOrEqual(level.parTimeSec * 1.5);
      expect(run.peakEntities).toBeLessThanOrEqual(ENTITY_BUDGET);
    },
  );
});

describe('paths', () => {
  it.each([...new Set(levels.map((l) => l.map))])('on %s cross the barrier they name', (mapId) => {
    const map = getMap(mapId);
    const barriers = [...map.blockers.fences, ...map.blockers.gates];
    for (const path of map.paths) {
      const barrier = barriers.find((b) => b.id === path.targetFence)!;
      const vertical = barrier.a[0] === barrier.b[0];
      // Some pair of consecutive control points must straddle the barrier's line within its span.
      const crosses = path.points.some(([x, y], i) => {
        const next = path.points[i + 1];
        if (!next) return false;
        const [along0, along1, across0, across1] = vertical
          ? [y, next[1], x, next[0]]
          : [x, next[0], y, next[1]];
        const line = vertical ? barrier.a[0] : barrier.a[1];
        const [lo, hi] = vertical ? [barrier.a[1], barrier.b[1]] : [barrier.a[0], barrier.b[0]];
        const straddles = (across0 - line) * (across1 - line) <= 0 && across0 !== across1;
        const mid = (along0 + along1) / 2;
        return straddles && mid >= Math.min(lo, hi) - 0.5 && mid <= Math.max(lo, hi) + 0.5;
      });
      expect(crosses, `${mapId}: path "${path.id}" should cross "${path.targetFence}"`).toBe(true);
    }
  });
});
