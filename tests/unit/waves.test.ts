import { describe, expect, it } from 'vitest';

import { getLevel } from '../../src/content';
import { Ev } from '../../src/game/sim/events';
import { step } from '../../src/game/sim/step';
import type { World } from '../../src/game/sim/world';
import { makeWorld, quietLevel, run } from './helpers/world';

const raiders = (count: number, interval: number, delay = 0) => ({
  type: 'raider',
  count,
  interval,
  delay,
});

/** Steps until an event of `type` fires and returns the time it fired at. */
function timeOf(w: World, type: number, maxSec = 60): number {
  for (let i = 0; i < maxSec * 60; i++) {
    step(w);
    for (let j = 0; j < w.events.count; j++) if (w.events.type[j] === type) return w.time;
  }
  throw new Error('event never fired');
}

describe('wave scheduler', () => {
  it('announces a wave 3 s before it starts', () => {
    const w = makeWorld(quietLevel({ waves: [{ at: 5, path: 'ne', groups: [raiders(1, 0)] }] }));
    expect(timeOf(w, Ev.WaveAnnounced)).toBeCloseTo(2, 1);
    expect(timeOf(w, Ev.WaveStarted)).toBeCloseTo(5, 1);
  });

  it('spawns a group at its interval, after its delay', () => {
    const w = makeWorld(
      quietLevel({
        waves: [
          { at: 1, path: 'ne', groups: [raiders(4, 0.5), { ...raiders(1, 0, 3), type: 'giant' }] },
        ],
      }),
    );
    // Park the squad's damage: nobody is in range of the spawn point.
    run(w, 1.1);
    expect(w.enemiesAlive).toBe(1);
    run(w, 1);
    expect(w.enemiesAlive).toBe(3);
    run(w, 1);
    expect(w.enemiesAlive).toBe(4);
    expect(w.waves[0].done).toBe(false);
    run(w, 1.1);
    expect(w.enemiesAlive).toBe(5);
    expect(w.waves[0].done).toBe(true);
  });

  it('spawns a zero-interval group all at once', () => {
    const w = makeWorld(quietLevel({ waves: [{ at: 1, path: 'ne', groups: [raiders(6, 0)] }] }));
    run(w, 1.1);
    expect(w.enemiesAlive).toBe(6);
  });

  it('starts a reactive wave N seconds after the previous one is cleared', () => {
    const w = makeWorld(
      quietLevel({
        waves: [
          { at: 1, path: 'ne', groups: [raiders(1, 0)] },
          { at: 'prevCleared+5', path: 'ne', groups: [raiders(1, 0)] },
        ],
      }),
    );
    run(w, 10);
    expect(w.wavesStarted).toBe(1); // first raider is still alive, so nothing is scheduled
    // Kill it; the next wave must start 5 s later.
    for (let e = 0; e < w.highWater; e++) if (w.kind[e] === 4) w.hp[e] = 0;
    w.enemiesAlive = 0;
    const clearedAt = w.time;
    expect(timeOf(w, Ev.WaveStarted) - clearedAt).toBeCloseTo(5, 1);
  });

  it('wins after the last wave is dead and the celebration has played', () => {
    const w = makeWorld(quietLevel({ waves: [{ at: 1, path: 'ne', groups: [raiders(1, 0)] }] }));
    run(w, 1.1);
    for (let e = 0; e < w.highWater; e++) if (w.kind[e] === 4) w.hp[e] = 0;
    w.enemiesAlive = 0;
    const cleared = timeOf(w, Ev.WavesCleared);
    expect(w.outcome).toBe('playing');
    expect(timeOf(w, Ev.LevelWon) - cleared).toBeCloseTo(1.5, 1);
    expect(w.outcome).toBe('won');
    expect(w.stats.rewardGold).toBe(100);
  });
});

describe('level 1', () => {
  it('is won by a king who builds the tower and holds the yard', () => {
    const w = makeWorld(getLevel(1));
    const pad = w.pads[0];
    for (let i = 0; i < 60 * 200 && w.outcome === 'playing'; i++) {
      const dx = pad.x - w.x[w.hero];
      const dy = pad.y - w.y[w.hero];
      const dist = Math.hypot(dx, dy);
      const going = pad.active && dist > 0.3;
      w.intent.moveX = going ? dx / dist : 0;
      w.intent.moveY = going ? dy / dist : 0;
      step(w);
    }
    expect(w.outcome).toBe('won');
    expect(w.stats.kills).toBe(24);
    expect(w.time).toBeLessThan(getLevel(1).parTimeSec);
  });

  it('is lost by a king who does nothing useful', () => {
    const w = makeWorld(getLevel(1));
    // Walk out of the gate and stand in a far corner; the squad follows him away.
    for (let i = 0; i < 60 * 600 && w.outcome === 'playing'; i++) {
      const [tx, ty] = w.y[w.hero] > 9 && w.x[w.hero] > 12 ? [29.5, 6] : [3, 3];
      const d = Math.hypot(tx - w.x[w.hero], ty - w.y[w.hero]);
      w.intent.moveX = d > 0.5 ? (tx - w.x[w.hero]) / d : 0;
      w.intent.moveY = d > 0.5 ? (ty - w.y[w.hero]) / d : 0;
      step(w);
    }
    expect(w.outcome).toBe('lost');
  });
});
