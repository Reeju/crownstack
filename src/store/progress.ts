import { create } from 'zustand';

import { levels, upgrades as upgradeDefs } from '../content';
import type { Difficulty } from '../content/schema';
import type { RunResult } from '../game/sim/score';
import { migrate } from './migrations';
import { defaultSave, readRawSave, writeSave, type SaveV1, type Settings } from './save';

const MAX_CROWNS_PER_LEVEL = 3;

type ProgressState = SaveV1 & {
  /** False until the stored save has been read; menus wait for it. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Records a finished run: stats always, crowns and best score on a win. */
  recordRun: (levelId: number, difficulty: Difficulty, won: boolean, result: RunResult) => void;
  buyUpgrade: (id: string) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetProgress: () => void;
};

function toSave(state: ProgressState): SaveV1 {
  const { version, levels, crownsSpent, upgrades, settings, stats } = state;
  return { version, levels, crownsSpent, upgrades, settings, stats };
}

/** Persistent progress: crowns, best scores, upgrades, settings and lifetime stats. */
export const useProgressStore = create<ProgressState>((set, get) => ({
  ...defaultSave(),
  hydrated: false,

  hydrate: async () => {
    const save = migrate(await readRawSave());
    set({ ...save, hydrated: true });
  },

  recordRun: (levelId, difficulty, won, result) => {
    const state = get();
    const stats = {
      kills: state.stats.kills + result.kills,
      goldEarned: state.stats.goldEarned + result.goldEarned + result.rewardGold,
      playtimeSec: state.stats.playtimeSec + result.timeSec,
    };
    if (!won) return set({ stats });

    const prev = state.levels[levelId] ?? {
      crowns: 0,
      bestScore: { easy: 0, normal: 0, hard: 0 },
      cleared: false,
    };
    const record = {
      crowns: Math.max(prev.crowns, result.crowns),
      bestScore: {
        ...prev.bestScore,
        [difficulty]: Math.max(prev.bestScore[difficulty], result.score),
      },
      cleared: true,
    };
    set({ stats, levels: { ...state.levels, [levelId]: record } });
  },

  buyUpgrade: (id) => {
    const state = get();
    const def = upgradeDefs.find((u) => u.id === id);
    const rank = state.upgrades[id] ?? 0;
    if (!def || rank >= def.ranks || crownsAvailable(state) < def.cost) return;
    set({
      upgrades: { ...state.upgrades, [id]: rank + 1 },
      crownsSpent: state.crownsSpent + def.cost,
    });
  },

  setSetting: (key, value) => set({ settings: { ...get().settings, [key]: value } }),

  resetProgress: () => set({ ...defaultSave(), settings: get().settings }),
}));

// Every change after hydration is written through to storage.
useProgressStore.subscribe((state, prev) => {
  if (state.hydrated && prev.hydrated) void writeSave(toSave(state));
});

export function crownsEarned(state: Pick<SaveV1, 'levels'>): number {
  return Object.values(state.levels).reduce((sum, l) => sum + l.crowns, 0);
}

export function crownsAvailable(state: Pick<SaveV1, 'levels' | 'crownsSpent'>): number {
  return crownsEarned(state) - state.crownsSpent;
}

/** Level N+1 unlocks when level N is cleared on any difficulty (SPEC §4.4). */
export function isUnlocked(state: Pick<SaveV1, 'levels'>, levelId: number): boolean {
  return levelId <= 1 || state.levels[levelId - 1]?.cleared === true;
}

export const MAX_CROWNS = levels.length * MAX_CROWNS_PER_LEVEL;
