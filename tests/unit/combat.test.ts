import { describe, expect, it } from 'vitest';

import { EnemyState, Kind } from '../../src/game/sim/components';
import { applyDamage } from '../../src/game/sim/damage';
import { Ev } from '../../src/game/sim/events';
import { crownsFor, runResult } from '../../src/game/sim/score';
import { spawnEnemy, spawnTower } from '../../src/game/sim/spawn';
import { step } from '../../src/game/sim/step';
import type { World } from '../../src/game/sim/world';
import { makeWorld, moveHero, quietLevel, run } from './helpers/world';

const def = (w: World, id: string) => w.enemyDefIndex.get(id)!;
const count = (w: World, kind: number) => {
  let n = 0;
  for (let e = 0; e < w.highWater; e++) if (w.kind[e] === kind) n++;
  return n;
};
/** Removes the squad so a test can study enemies undisturbed. */
function dismissSquad(w: World): void {
  for (let e = 0; e < w.highWater; e++)
    if (w.kind[e] === Kind.Archer) applyDamage(w, e, 9999, 0, 0);
}
/** Runs until `done` returns true, failing after `maxSec` simulated seconds. */
function runUntil(w: World, maxSec: number, done: () => boolean): void {
  for (let i = 0; i < maxSec * 60; i++) {
    if (done()) return;
    step(w);
  }
  throw new Error(`condition not met within ${maxSec}s`);
}

describe('enemies', () => {
  it('follow their path, break the fence across it and carry on to the keep', () => {
    const w = makeWorld(quietLevel());
    dismissSquad(w);
    moveHero(w, 13, 25); // far from the east fence
    const raider = spawnEnemy(w, def(w, 'raider'), 0);
    const fence = w.pathTargets[0];

    // It stops at the fence its path crosses and hacks it down...
    runUntil(w, 40, () => w.hp[fence] < w.maxHp[fence]);
    expect(Math.abs(w.x[raider] - 34)).toBeLessThan(2);
    runUntil(w, 30, () => w.hp[fence] <= 0);
    expect(w.kind[fence]).toBe(Kind.Fence); // stays allocated so it can be repaired

    // ...then walks the rest of the path and starts on the keep.
    runUntil(w, 30, () => w.state[raider] === EnemyState.Siege);
    runUntil(w, 10, () => w.hp[w.keep] < w.maxHp[w.keep]);
  });

  it('are held by a closed gate and walk through once it opens', () => {
    const level = { ...quietLevel(), map: 'river-c', pads: [{ type: 'gate' as const, cost: 40 }] };
    const w = makeWorld({
      ...level,
      waves: [{ at: 9999, path: 's', groups: quietLevel().waves[0].groups }],
    });
    dismissSquad(w);
    const gate = w.gates[0];
    expect(w.hp[gate]).toBe(0); // gates start open

    const pad = w.pads[0];
    moveHero(w, pad.x, pad.y);
    run(w, 2);
    expect(w.hp[gate]).toBe(w.maxHp[gate]);
    expect(w.eco.gateTimer).toBeGreaterThan(17);

    // The king cannot cross a closed gate either.
    moveHero(w, 26, 20);
    run(w, 1.5, 1, 0);
    expect(w.x[w.hero]).toBeLessThan(28);

    run(w, 20);
    expect(w.hp[gate]).toBe(0);
    run(w, 1.5, 1, 0);
    expect(w.x[w.hero]).toBeGreaterThan(29);
  });

  it('march on the keep once the fence is down and lose the level', () => {
    const w = makeWorld(quietLevel());
    dismissSquad(w);
    moveHero(w, 20, 4); // outside the yard, out of the way
    for (let i = 0; i < 12; i++) spawnEnemy(w, def(w, 'brute'), 0);
    runUntil(w, 400, () => w.outcome !== 'playing');
    expect(w.outcome).toBe('lost');
    expect(w.hp[w.keep]).toBe(0);
  });

  it('chase a king who comes close and respect his i-frames', () => {
    const w = makeWorld(quietLevel());
    dismissSquad(w);
    const raider = spawnEnemy(w, def(w, 'raider'), 0);
    moveHero(w, w.x[raider] + 1.5, w.y[raider] + 1.5);
    run(w, 1.2);
    expect(w.hp[w.hero]).toBe(190);
    run(w, 0.5); // second swing lands inside the 1 s i-frame window? it must not
    expect(w.hp[w.hero]).toBeGreaterThanOrEqual(180);
  });

  it('keep apart from each other', () => {
    const w = makeWorld(quietLevel());
    dismissSquad(w);
    moveHero(w, 13, 25);
    const a = spawnEnemy(w, def(w, 'raider'), 0);
    const b = spawnEnemy(w, def(w, 'raider'), 0);
    w.x[b] = w.x[a] + 0.01;
    w.y[b] = w.y[a];
    run(w, 1);
    expect(Math.hypot(w.x[a] - w.x[b], w.y[a] - w.y[b])).toBeGreaterThan(0.4);
  });
});

describe('archers and towers', () => {
  it('squad archers kill a raider that comes into range, dropping a coin', () => {
    const w = makeWorld(quietLevel());
    const raider = spawnEnemy(w, def(w, 'raider'), 0);
    moveHero(w, w.x[raider], w.y[raider] + 6);
    for (let e = 0; e < w.highWater; e++) {
      if (w.kind[e] === Kind.Archer) {
        w.x[e] = w.x[w.hero];
        w.y[e] = w.y[w.hero];
      }
    }
    run(w, 2);
    expect(w.stats.kills).toBe(1);
    expect(w.enemiesAlive).toBe(0);
    expect(count(w, Kind.Coin) + w.eco.goldEarned / 10).toBe(1);
  });

  it('a tower shoots enemies within its range only', () => {
    const w = makeWorld(quietLevel());
    dismissSquad(w);
    moveHero(w, 13, 25);
    w.plots[1].tier = 1;
    w.plots[1].tower = spawnTower(w, 1, 1);
    const giant = spawnEnemy(w, def(w, 'giant'), 0);
    run(w, 1);
    expect(w.hp[giant]).toBe(600); // spawn point is beyond range 9
    runUntil(w, 20, () => w.hp[giant] < 600);
  });

  it('archers die and the squad closes ranks', () => {
    const w = makeWorld(quietLevel());
    const before = w.archersAlive;
    let victim = -1;
    for (let e = 0; e < w.highWater; e++) if (w.kind[e] === Kind.Archer) victim = e;
    applyDamage(w, victim, 40, 0, 0);
    expect(w.archersAlive).toBe(before - 1);
    const slots: number[] = [];
    for (let e = 0; e < w.highWater; e++) if (w.kind[e] === Kind.Archer) slots.push(w.slot[e]);
    expect(slots.sort()).toEqual([0, 1, 2]);
  });
});

describe('giants', () => {
  it('knock the king back about 2 units and shake the screen', () => {
    const w = makeWorld(quietLevel());
    dismissSquad(w);
    const giant = spawnEnemy(w, def(w, 'giant'), 0);
    w.cooldown[giant] = 0;
    moveHero(w, w.x[giant], w.y[giant] + 2);
    const y0 = w.y[w.hero];
    let heavy = false;
    for (let i = 0; i < 30 && !heavy; i++) {
      step(w);
      for (let j = 0; j < w.events.count; j++) heavy ||= w.events.type[j] === Ev.HeavyHit;
    }
    expect(heavy).toBe(true);
    expect(w.hp[w.hero]).toBe(140);
    const yHit = w.y[w.hero];
    for (let i = 0; i < 20; i++) step(w);
    expect(w.y[w.hero] - Math.min(y0, yHit)).toBeGreaterThan(1.2);
  });

  it('stagger after 30 hits', () => {
    const w = makeWorld(quietLevel());
    const giant = spawnEnemy(w, def(w, 'giant'), 0);
    for (let i = 0; i < 29; i++) applyDamage(w, giant, 1, 0, 0);
    expect(w.stun[giant]).toBe(0);
    applyDamage(w, giant, 1, 0, 0);
    expect(w.stun[giant]).toBeGreaterThan(0);
  });
});

describe('king', () => {
  it('regenerates 5 HP/s after 4 s without damage', () => {
    const w = makeWorld(quietLevel());
    applyDamage(w, w.hero, 50, 0, 0);
    run(w, 3.9);
    expect(w.hp[w.hero]).toBe(150);
    run(w, 2.1);
    expect(w.hp[w.hero]).toBeCloseTo(160, 0);
  });

  it('dying loses the level', () => {
    const w = makeWorld(quietLevel());
    applyDamage(w, w.hero, 9999, 0, 0);
    step(w);
    expect(w.outcome).toBe('lost');
  });
});

describe('difficulty', () => {
  it('scales enemy HP', () => {
    const easy = makeWorld(quietLevel(), { difficulty: 'easy' });
    const hard = makeWorld(quietLevel(), { difficulty: 'hard' });
    expect(easy.maxHp[spawnEnemy(easy, def(easy, 'giant'), 0)]).toBe(420);
    expect(hard.maxHp[spawnEnemy(hard, def(hard, 'giant'), 0)]).toBe(840);
    expect(hard.eco.coinCap).toBe(40);
  });
});

describe('scoring', () => {
  it('awards crowns by keep HP', () => {
    expect([1, 0.81, 0.8, 0.41, 0.4, 0.01].map(crownsFor)).toEqual([3, 3, 2, 2, 1, 1]);
  });

  it('adds kills, bonuses, gold and a time bonus that decays over par', () => {
    const w = makeWorld(quietLevel({ parTimeSec: 100 }));
    w.stats.kills = 4;
    w.stats.bonusScore = 500;
    w.eco.goldEarned = 120;
    w.time = 25;
    expect(runResult(w).score).toBe(120 + 200 + 500 + 750);
  });
});
