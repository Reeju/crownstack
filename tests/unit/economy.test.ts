import { describe, expect, it } from 'vitest';

import { Kind } from '../../src/game/sim/components';
import { repeatCost, totalGold } from '../../src/game/sim/economy';
import { spawnCoin } from '../../src/game/sim/spawn';
import { makeWorld, moveHero, quietLevel, run } from './helpers/world';

const towerPad = (w: ReturnType<typeof makeWorld>) => w.pads.find((p) => p.type === 'tower')!;

describe('repeatCost', () => {
  it('adds 30% per repeat purchase, rounded to 10', () => {
    expect([0, 1, 2].map((n) => repeatCost(50, n, 1.3))).toEqual([50, 70, 80]);
    expect([0, 1].map((n) => repeatCost(80, n, 1.3))).toEqual([80, 100]);
  });
});

describe('coin pickup', () => {
  it('starts with the level gold stacked on the king', () => {
    const w = makeWorld(quietLevel());
    expect(w.eco.stackCoins).toBe(6);
    expect(totalGold(w)).toBe(60);
  });

  it('collects a coin the king walks over', () => {
    const w = makeWorld(quietLevel());
    spawnCoin(w, w.x[w.hero] + 3, w.y[w.hero], 0, 0);
    run(w, 1, 1, 0);
    expect(w.eco.stackCoins).toBe(7);
    expect(w.eco.goldEarned).toBe(10);
  });

  it('banks coins above the carry cap', () => {
    const w = makeWorld(quietLevel({ coinCap: 6 }));
    spawnCoin(w, w.x[w.hero], w.y[w.hero], 0, 0);
    run(w, 1);
    expect(w.eco.stackCoins).toBe(6);
    expect(w.eco.bank).toBe(10);
  });

  it('despawns dropped coins after their lifetime', () => {
    const w = makeWorld(quietLevel());
    const coin = spawnCoin(w, 5, 5, 2, 0);
    run(w, 1.9);
    expect(w.kind[coin]).toBe(Kind.Coin);
    run(w, 0.2);
    expect(w.kind[coin]).toBe(Kind.None);
  });
});

describe('pay pads', () => {
  it('drains the stack at 100 gold per second and builds the tower', () => {
    const w = makeWorld(quietLevel());
    const pad = towerPad(w);
    moveHero(w, pad.x, pad.y);
    run(w, 0.45 + 0.25);
    expect(pad.paid).toBeGreaterThanOrEqual(20);
    expect(pad.paid).toBeLessThan(50);
    run(w, 0.5);
    expect(w.plots[pad.plot].tier).toBe(1);
    expect(w.kind[w.plots[pad.plot].tower]).toBe(Kind.Tower);
    expect(totalGold(w)).toBe(10);
  });

  it('does not charge a king who only runs across the pad', () => {
    const w = makeWorld(quietLevel());
    const pad = towerPad(w);
    moveHero(w, pad.x - 1.5, pad.y);
    run(w, 0.5, 1, 0);
    expect(pad.paid).toBe(0);
  });

  it('keeps partial payment when the king runs out of coins', () => {
    const w = makeWorld(quietLevel({ startGold: 30 }));
    const pad = towerPad(w);
    moveHero(w, pad.x, pad.y);
    run(w, 2);
    expect(pad.paid).toBe(30);
    expect(w.eco.stackCoins).toBe(0);
    expect(w.plots[pad.plot].tier).toBe(0);
  });

  it('only spends stacked coins, never the bank', () => {
    const w = makeWorld(quietLevel({ startGold: 200, coinCap: 2 }));
    const pad = towerPad(w);
    moveHero(w, pad.x, pad.y);
    run(w, 2);
    expect(pad.paid).toBe(20);
    expect(w.eco.bank).toBe(180);
  });

  it('retires a tower pad once the plot is at the level maximum', () => {
    const w = makeWorld(quietLevel({ startGold: 500 }));
    const pad = towerPad(w);
    moveHero(w, pad.x, pad.y);
    run(w, 3);
    expect(pad.active).toBe(false);
    expect(totalGold(w)).toBe(450);
  });
});
