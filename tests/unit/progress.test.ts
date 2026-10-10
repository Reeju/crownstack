import { beforeEach, describe, expect, it } from 'vitest';

import { upgrades } from '../../src/content';
import { padCost } from '../../src/game/sim/economy';
import { metaBonuses } from '../../src/game/sim/meta';
import type { RunResult } from '../../src/game/sim/score';
import { migrate } from '../../src/store/migrations';
import {
  crownsAvailable,
  crownsEarned,
  isUnlocked,
  useProgressStore,
} from '../../src/store/progress';
import { BACKUP_KEY, defaultSave } from '../../src/store/save';
import { makeWorld, quietLevel } from './helpers/world';

const result = (over: Partial<RunResult> = {}): RunResult => ({
  score: 1500,
  crowns: 2,
  kills: 24,
  goldEarned: 240,
  rewardGold: 100,
  timeSec: 60,
  seed: 1,
  ...over,
});

// A minimal localStorage for the node test environment.
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  storage.clear();
  useProgressStore.setState({ ...defaultSave(), hydrated: false });
});

describe('progress', () => {
  it('unlocks the next level when one is cleared', () => {
    const store = useProgressStore.getState();
    expect(isUnlocked(store, 1)).toBe(true);
    expect(isUnlocked(store, 2)).toBe(false);
    store.recordRun(1, 'easy', true, result());
    expect(isUnlocked(useProgressStore.getState(), 2)).toBe(true);
    expect(isUnlocked(useProgressStore.getState(), 3)).toBe(false);
  });

  it('keeps the best crowns and the best score per difficulty', () => {
    const { recordRun } = useProgressStore.getState();
    recordRun(1, 'normal', true, result({ crowns: 3, score: 1500 }));
    recordRun(1, 'normal', true, result({ crowns: 1, score: 900 }));
    recordRun(1, 'hard', true, result({ crowns: 2, score: 2000 }));
    const level = useProgressStore.getState().levels[1];
    expect(level.crowns).toBe(3);
    expect(level.bestScore).toEqual({ easy: 0, normal: 1500, hard: 2000 });
  });

  it('counts stats for losses but awards nothing', () => {
    useProgressStore.getState().recordRun(1, 'normal', false, result({ rewardGold: 0 }));
    const state = useProgressStore.getState();
    expect(state.stats).toEqual({ kills: 24, goldEarned: 240, playtimeSec: 60 });
    expect(state.levels[1]).toBeUndefined();
  });

  it('spends crowns on upgrades, up to each upgrade maximum', () => {
    const store = useProgressStore.getState();
    store.buyUpgrade('coinCap');
    expect(useProgressStore.getState().upgrades.coinCap).toBeUndefined(); // no crowns yet

    for (const id of [1, 2, 3]) store.recordRun(id, 'normal', true, result({ crowns: 3 }));
    expect(crownsEarned(useProgressStore.getState())).toBe(9);
    for (let i = 0; i < 5; i++) useProgressStore.getState().buyUpgrade('coinCap');
    const state = useProgressStore.getState();
    expect(state.upgrades.coinCap).toBe(3);
    expect(crownsAvailable(state)).toBe(3);
  });

  it('offers at most 36 crowns worth of upgrades', () => {
    expect(upgrades.reduce((sum, u) => sum + u.cost * u.ranks, 0)).toBeLessThanOrEqual(36);
  });
});

describe('meta bonuses', () => {
  it('sum the owned ranks and ignore ranks beyond the maximum', () => {
    const meta = metaBonuses(upgrades, {
      coinCap: 2,
      kingHp: 9,
      archers: 1,
      towerCost: 2,
      magnet: 1,
    });
    expect(meta).toEqual({
      coinCap: 20,
      kingHp: 150,
      extraArchers: 1,
      towerCostMult: 0.8,
      magnetRadius: 0.5,
    });
  });

  it('apply to a run', () => {
    const meta = metaBonuses(upgrades, { coinCap: 1, kingHp: 1, archers: 2, towerCost: 1 });
    const w = makeWorld(quietLevel(), { meta });
    expect(w.eco.coinCap).toBe(70);
    expect(w.maxHp[w.hero]).toBe(250);
    expect(w.archersAlive).toBe(6);
    expect(w.pads[0].cost).toBe(45);
  });

  it('discount towers after the repeat mark-up, to the nearest 5', () => {
    expect([0, 1, 2].map((n) => padCost(50, n, 1.3, 0.9))).toEqual([45, 65, 70]);
    expect(padCost(50, 1, 1.3, 1)).toBe(70);
  });
});

describe('save migration', () => {
  it('returns defaults for a missing save', () => {
    expect(migrate(undefined)).toEqual(defaultSave());
  });

  it('accepts a valid version 1 save unchanged', () => {
    const save = { ...defaultSave(), crownsSpent: 4, upgrades: { coinCap: 2 } };
    expect(migrate(structuredClone(save))).toEqual(save);
  });

  it('backs up and resets a save from an unknown version', () => {
    const alien = { version: 99, treasure: 'keep me' };
    expect(migrate(alien)).toEqual(defaultSave());
    expect(JSON.parse(storage.get(BACKUP_KEY)!)).toEqual(alien);
  });

  it('backs up and resets a corrupt save', () => {
    expect(migrate({ version: 1, levels: 'nope' })).toEqual(defaultSave());
    expect(storage.has(BACKUP_KEY)).toBe(true);
  });
});

describe('save durability', () => {
  it('keeps a synchronous copy until the asynchronous write has landed', async () => {
    const { readRawSave, writeSave } = await import('../../src/store/save');
    const save = { ...defaultSave(), crownsSpent: 7 };
    // There is no IndexedDB in the test environment, so the write falls back to localStorage...
    const pending = writeSave(save);
    // ...but the newest save is readable before that has even resolved.
    expect(await readRawSave()).toEqual(save);
    await pending;
    expect(await readRawSave()).toEqual(save);
  });
});
