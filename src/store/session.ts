import { create } from 'zustand';

import type { Game, HudState } from '../game/Game';

export type Screen = 'title' | 'playing' | 'paused';

type SessionState = {
  screen: Screen;
  hud: HudState;
  levelId: number;
  attempt: number;
  game: Game | null;
  /** Set when a new service worker is waiting; calling it applies the update. */
  applyUpdate: (() => void) | null;

  attachGame: (game: Game | null) => void;
  setHud: (hud: HudState) => void;
  startLevel: (levelId: number) => void;
  pause: () => void;
  resume: () => void;
  quitToTitle: () => void;
  setUpdateReady: (apply: () => void) => void;
};

/** Transient UI state for the current browser session (never persisted). */
export const useSessionStore = create<SessionState>((set, get) => ({
  screen: 'title',
  hud: { levelName: '', gold: 0 },
  levelId: 1,
  attempt: 0,
  game: null,
  applyUpdate: null,

  attachGame: (game) => set({ game }),
  setHud: (hud) => set({ hud }),

  startLevel: (levelId) => {
    const { game, attempt } = get();
    game?.start({ levelId, attempt, difficulty: 'normal' });
    set({ screen: 'playing', levelId });
  },

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
}));
