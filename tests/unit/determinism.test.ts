import { describe, expect, it } from 'vitest';

import { getLevel } from '../../src/content';
import { consumeFrame } from '../../src/game/loop';
import { DT } from '../../src/game/sim/components';
import { hashWorld } from '../../src/game/sim/hash';
import { Rng, runSeed } from '../../src/game/sim/rng';
import { step } from '../../src/game/sim/step';
import { makeWorld } from './helpers/world';

/** A recorded intent log: one [moveX, moveY, dash] triple per step. */
function recordIntents(steps: number): Float32Array {
  const rng = new Rng(99);
  const log = new Float32Array(steps * 3);
  let mx = 0;
  let my = 0;
  for (let i = 0; i < steps; i++) {
    if (i % 45 === 0) {
      const angle = rng.range(0, Math.PI * 2);
      const moving = rng.next() > 0.2;
      mx = moving ? Math.cos(angle) : 0;
      my = moving ? Math.sin(angle) : 0;
    }
    log.set([mx, my, i % 200 === 0 ? 1 : 0], i * 3);
  }
  return log;
}

function replay(log: Float32Array, seed: number): number {
  const w = makeWorld(getLevel(1), { seed });
  for (let i = 0; i < log.length / 3; i++) {
    w.intent.moveX = log[i * 3];
    w.intent.moveY = log[i * 3 + 1];
    w.intent.dash = log[i * 3 + 2] === 1;
    step(w);
  }
  return hashWorld(w);
}

describe('determinism', () => {
  const log = recordIntents(60 * 90);

  it('replays an intent log to the same state hash', () => {
    expect(replay(log, runSeed(1, 0))).toBe(replay(log, runSeed(1, 0)));
  });

  it('diverges for a different seed', () => {
    expect(replay(log, runSeed(1, 0))).not.toBe(replay(log, runSeed(1, 1)));
  });

  it('diverges for different input', () => {
    expect(replay(log, 7)).not.toBe(replay(recordIntents(60 * 89), 7));
  });
});

describe('Rng', () => {
  it('is reproducible and stays in [0, 1)', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('fixed-step accumulator', () => {
  it('runs one step per 1/60 s and carries the remainder', () => {
    const state = { acc: 0 };
    expect(consumeFrame(state, DT * 2.5)).toBe(2);
    expect(state.acc).toBeCloseTo(DT * 0.5);
    expect(consumeFrame(state, DT * 0.6)).toBe(1);
  });

  it('caps a long frame at 5 steps and drops the backlog', () => {
    const state = { acc: 0 };
    expect(consumeFrame(state, 1)).toBe(5);
    expect(state.acc).toBe(0);
  });
});
