import { create } from 'zustand';

import { levels } from '../content';
import type { Game, HudState } from '../game/Game';
import type { RunResult } from '../game/sim/score';

export type Screen = 'title' | 'playing' | 'paused' | 'results' | 'fallen';

type SessionState = {
  screen: Screen;
  hud: HudState;
  levelId: number;
  /** Bumped when a level is started fresh; Retry keeps it so the waves repeat (SPEC §3.6). */
  attempt: number;
  result: RunResult | null;
  game: Game | null;
  /** Set when a new service worker is waiting; calling it applies the update. */
  applyUpdate: (() => void) | null;

  attachGame: (game: Game | null) => void;
  setHud: (hud: HudState) => void;
  startLevel: (levelId: number) => void;
  retry: () => void;
  nextLevel: () => void;
  finish: (won: boolean, result: RunResult) => void;
  pause: () => void;
  resume: () => void;
  quitToTitle: () => void;
  setUpdateReady: (apply: () => void) => void;
};

const EMPTY_HUD: HudState = {
  levelName: '',
  gold: 0,
  wave: 0,
  waveCount: 0,
  keepHp: 100,
  bannerWave: 0,
  bannerAngle: 0,
  hint: '',
};

/** Transient UI state for the current browser session (never persisted). */
export const useSessionStore = create<SessionState>((set, get) => {
  const run = (levelId: number, attempt: number): void => {
    get().game?.start({ levelId, attempt, difficulty: 'normal' });
    set({ screen: 'playing', levelId, attempt, result: null, hud: EMPTY_HUD });
  };

  return {
    screen: 'title',
    hud: EMPTY_HUD,
    levelId: 1,
    attempt: 0,
    result: null,
    game: null,
    applyUpdate: null,

    attachGame: (game) => set({ game }),
    setHud: (hud) => set({ hud }),

    startLevel: (levelId) => run(levelId, get().attempt + 1),
    retry: () => run(get().levelId, get().attempt),
    nextLevel: () => {
      const next = get().levelId + 1;
      if (levels.some((l) => l.id === next)) run(next, get().attempt + 1);
      else get().quitToTitle();
    },

    finish: (won, result) => set({ screen: won ? 'results' : 'fallen', result }),

    pause: () => {
      if (get().screen !== 'playing') return;
      get().game?.pause();
      set({ screen: 'paused' });
    },

    resume: () => {
      if (get().screen !== 'paused') return;
      get().game?.resume();
      set({ screen: 'playing' });
    },

    quitToTitle: () => {
      get().game?.pause();
      set({ screen: 'title' });
    },

    setUpdateReady: (applyUpdate) => set({ applyUpdate }),
  };
});
