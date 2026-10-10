import { describe, expect, it } from 'vitest';

import { MAX_ENTITIES } from '../../src/game/sim/components';
import { hashWorld } from '../../src/game/sim/hash';
import { spawnEnemy } from '../../src/game/sim/spawn';
import { step } from '../../src/game/sim/step';
import { makeWorld, quietLevel } from './helpers/world';

/** A battle with ~300 live entities, as in the performance budget (SPEC §7.3). */
function crowdedWorld() {
  const w = makeWorld(quietLevel({ squad: { archers: 12, tier: 0 } }));
  const raider = w.enemyDefIndex.get('raider')!;
  for (let i = 0; i < 280; i++) {
    const e = spawnEnemy(w, raider, i % 2);
    w.pathS[e] = (i % 40) * 0.5;
  }
  return w;
}

describe('simulation budget', () => {
  it('steps 300 entities in well under 3 ms', () => {
    const w = crowdedWorld();
    for (let i = 0; i < 60; i++) step(w); // warm up the JIT
    const steps = 300;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) step(w);
    const perStep = (performance.now() - t0) / steps;
    console.log(`sim step with ${w.highWater} entities: ${perStep.toFixed(3)} ms`);
    expect(perStep).toBeLessThan(3);
  });

  it('never exceeds the entity pool in a crowded fight', () => {
    const w = crowdedWorld();
    for (let i = 0; i < 60 * 30; i++) step(w);
    expect(w.highWater).toBeLessThanOrEqual(MAX_ENTITIES);
    expect(Number.isFinite(hashWorld(w))).toBe(true);
  });
});
