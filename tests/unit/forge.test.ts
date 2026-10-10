import { describe, expect, it } from 'vitest';

import { getLevel } from '../../src/content';
import { Kind } from '../../src/game/sim/components';
import { applyDamage } from '../../src/game/sim/damage';
import { totalGold } from '../../src/game/sim/economy';
import type { World } from '../../src/game/sim/world';
import { Tutorial } from '../../src/game/tutorial';
import { makeWorld, moveHero, quietLevel, run } from './helpers/world';

const level2 = () => quietLevel({ ...getLevel(2), looseCoins: [], waves: quietLevel().waves });
const level3 = () => quietLevel({ ...getLevel(3), looseCoins: [], waves: quietLevel().waves });
const pad = (w: World, type: string, plot = -1) =>
  w.pads.find((p) => p.type === type && (plot < 0 || p.plot === plot))!;
const archers = (w: World) => {
  const ids: number[] = [];
  for (let e = 0; e < w.highWater; e++) if (w.kind[e] === Kind.Archer) ids.push(e);
  return ids;
};
/** Stands the king on a pad until it has been paid (or two seconds pass). */
function pay(w: World, p: { x: number; y: number }): void {
  moveHero(w, p.x, p.y);
  run(w, 3);
}

describe('forge', () => {
  it('turns 80 gold into a stack of six bows', () => {
    const w = makeWorld(level2());
    pay(w, pad(w, 'forge'));
    expect(totalGold(w)).toBe(0);
    expect(w.eco.purchases.forge).toBe(1);
    // Four archers took a bow each; the other two are still carried.
    expect(archers(w).every((e) => w.def[e] === 1)).toBe(true);
    expect(w.eco.gear).toBe(2);
  });

  it('upgrades archers to tier 1 stats and heals them', () => {
    const w = makeWorld(level2());
    const [first] = archers(w);
    applyDamage(w, first, 10, 0, 0);
    pay(w, pad(w, 'forge'));
    expect(w.maxHp[first]).toBe(70);
    expect(w.hp[first]).toBe(70);
    expect(w.damage[first]).toBe(30);
    expect(w.atkRange[first]).toBe(8);
  });

  it('charges 30% more for the next batch', () => {
    const w = makeWorld(level2());
    const forge = pad(w, 'forge');
    expect(forge.cost).toBe(80);
    w.eco.stackCoins = 8;
    pay(w, forge);
    run(w, 0.1);
    expect(forge.cost).toBe(100);
  });

  it('does not upgrade archers past the level cap', () => {
    const w = makeWorld(level2());
    w.eco.stackCoins = 30;
    const forge = pad(w, 'forge');
    pay(w, forge);
    moveHero(w, 20, 15);
    run(w, 0.5);
    pay(w, forge);
    expect(w.eco.purchases.forge).toBe(2);
    expect(archers(w).every((e) => w.def[e] === 1)).toBe(true);
  });

  it('loses gear that is not delivered within 30 s', () => {
    const w = makeWorld(level2());
    for (const e of archers(w)) applyDamage(w, e, 999, 0, 0);
    pay(w, pad(w, 'forge'));
    expect(w.eco.gear).toBe(6);
    run(w, 29);
    expect(w.eco.gear).toBe(0);
  });
});

describe('keep upgrade', () => {
  it('spends the bank first, then the stack', () => {
    const w = makeWorld(level3());
    w.eco.bank = 150;
    w.eco.stackCoins = 10;
    pay(w, pad(w, 'keep'));
    expect(w.eco.keepTier).toBe(1);
    expect(w.eco.bank).toBe(0);
    expect(w.eco.stackCoins).toBe(5);
  });

  it('raises the carry cap, heals and strengthens the keep, and recruits archers', () => {
    const w = makeWorld(level3());
    applyDamage(w, w.keep, 400, 0, 0);
    w.eco.bank = 200;
    const before = w.archersAlive;
    pay(w, pad(w, 'keep'));
    expect(w.eco.coinCap).toBe(70);
    expect(w.maxHp[w.keep]).toBe(1250);
    expect(w.hp[w.keep]).toBe(1250);
    expect(w.archersAlive).toBe(before + 2);
    expect(
      archers(w)
        .map((e) => w.slot[e])
        .sort(),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('pads', () => {
  it('do not roll into the next purchase until the king steps off', () => {
    const w = makeWorld(level2());
    w.eco.stackCoins = 30;
    const forge = pad(w, 'forge');
    pay(w, forge);
    expect(w.eco.purchases.forge).toBe(1);
    expect(forge.paid).toBe(0);
    expect(w.eco.stackCoins).toBe(22);
  });
});

describe('fence repair', () => {
  it('is only payable while a fence is damaged', () => {
    const w = makeWorld(level3());
    const repair = pad(w, 'repair');
    pay(w, repair);
    expect(repair.paid).toBe(0);
    expect(totalGold(w)).toBe(100);
  });

  it('restores broken and damaged segments', () => {
    const w = makeWorld(level3());
    applyDamage(w, w.fences[0], 999, 0, 0);
    applyDamage(w, w.fences[1], 50, 0, 0);
    pay(w, pad(w, 'repair'));
    expect(w.hp[w.fences[0]]).toBe(150);
    expect(w.hp[w.fences[1]]).toBe(150);
    expect(totalGold(w)).toBe(70);
  });
});

describe('towers', () => {
  it('share a rising price across plots', () => {
    const w = makeWorld(level3());
    w.eco.stackCoins = 20;
    pay(w, pad(w, 'tower', 1));
    run(w, 0.1);
    expect(pad(w, 'tower', 3).cost).toBe(70);
  });

  it('free their plot and pad when destroyed', () => {
    const w = makeWorld(level3());
    const p = pad(w, 'tower', 1);
    pay(w, p);
    expect(p.active).toBe(false);
    applyDamage(w, w.plots[1].tower, 999, 0, 0);
    expect(w.plots[1].tier).toBe(0);
    expect(p.active).toBe(true);
  });
});

describe('tutorial', () => {
  it('shows hints in order as their triggers fire, and expires them', () => {
    const w = makeWorld(level2());
    const tutorial = new Tutorial(w.cfg.level);
    const first = tutorial.update(w);
    expect(first?.text).toMatch(/Build the tower/);
    expect(w.pads[first!.pad].type).toBe('tower');

    // The next hint waits for its trigger, and for the first one to be readable.
    w.eco.stackCoins = 13;
    pay(w, pad(w, 'tower'));
    run(w, 1);
    expect(tutorial.update(w)?.text).toMatch(/gate/);
    run(w, 1);
    expect(tutorial.update(w)?.text).toMatch(/gate/); // gold >= 80 already, but too soon
    run(w, 3);
    const forgeHint = tutorial.update(w);
    expect(forgeHint?.text).toMatch(/forge pad/);
    expect(w.pads[forgeHint!.pad].type).toBe('forge');

    run(w, 8);
    expect(tutorial.update(w)).toBeNull();
  });
});
