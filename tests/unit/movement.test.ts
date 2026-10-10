import { describe, expect, it } from 'vitest';

import { Kind } from '../../src/game/sim/components';
import { makeWorld, moveHero, quietLevel, run } from './helpers/world';

describe('hero movement', () => {
  it('walks at 5 units per second', () => {
    const w = makeWorld(quietLevel());
    const x0 = w.x[w.hero];
    run(w, 1, 1, 0);
    expect(w.x[w.hero] - x0).toBeCloseTo(5, 1);
  });

  it('normalises diagonal input', () => {
    const w = makeWorld(quietLevel());
    const [x0, y0] = [w.x[w.hero], w.y[w.hero]];
    run(w, 1, 1, 1);
    expect(Math.hypot(w.x[w.hero] - x0, w.y[w.hero] - y0)).toBeCloseTo(5, 1);
  });

  it('is stopped by a standing fence', () => {
    const w = makeWorld(quietLevel());
    moveHero(w, 20, 26);
    run(w, 2, 0, 1); // walk south into the fence at y = 28
    expect(w.y[w.hero]).toBeLessThan(28);
    expect(w.y[w.hero]).toBeGreaterThan(27);
  });

  it('can leave the yard through the gate', () => {
    const w = makeWorld(quietLevel());
    moveHero(w, 29.5, 12); // gate is the gap in the north fence at x 28..31
    run(w, 1.5, 0, -1);
    expect(w.y[w.hero]).toBeLessThan(9);
  });

  it('stays inside the map', () => {
    const w = makeWorld(quietLevel());
    moveHero(w, 2, 2);
    run(w, 2, -1, -1);
    expect(w.x[w.hero]).toBeGreaterThanOrEqual(w.radius[w.hero]);
    expect(w.y[w.hero]).toBeGreaterThanOrEqual(w.radius[w.hero]);
  });

  it('keeps the squad in a ring around the king', () => {
    const w = makeWorld(quietLevel());
    run(w, 1, 1, 0);
    run(w, 1);
    for (let e = 0; e < w.highWater; e++) {
      if (w.kind[e] !== Kind.Archer) continue;
      const dist = Math.hypot(w.x[e] - w.x[w.hero], w.y[e] - w.y[w.hero]);
      expect(dist).toBeCloseTo(w.cfg.units.archer.ringRadius, 1);
    }
  });
});

describe('squad', () => {
  it('follows the king out through the gate and back without being stranded', () => {
    const w = makeWorld(quietLevel());
    moveHero(w, 29.5, 12);
    run(w, 1.5, 0, -1); // out of the gate
    run(w, 2, 1, 0); // along the outside of the north fence
    moveHero(w, 22, 18); // back in the yard
    run(w, 4);
    for (let e = 0; e < w.highWater; e++) {
      if (w.kind[e] !== Kind.Archer) continue;
      expect(Math.hypot(w.x[e] - w.x[w.hero], w.y[e] - w.y[w.hero])).toBeLessThan(2);
    }
  });
});
