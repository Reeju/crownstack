import { create } from 'zustand';

import { levels, upgrades } from '../content';
import type { Game, HudState } from '../game/Game';
import { metaBonuses } from '../game/sim/meta';
import type { RunResult } from '../game/sim/score';
import { useProgressStore } from './progress';

export type Screen =
  | 'title'
  | 'levels'
  | 'upgrades'
  | 'settings'
  | 'about'
  | 'playing'
  | 'paused'
  | 'countdown'
  | 'results'
  | 'fallen';

type SessionState = {
  screen: Screen;
  /** Where Settings returns to (it opens from both the title and the pause menu). */
  settingsFrom: Screen;
  hud: HudState;
  levelId: number;
  /** Bumped when a level is started fresh; Retry keeps it so the waves repeat (SPEC §3.6). */
  attempt: number;
  result: RunResult | null;
  game: Game | null;
  /** Set when a new service worker is waiting; calling it applies the update. */
  applyUpdate: (() => void) | null;
  /** Set when the browser has offered to install the app (`beforeinstallprompt`). */
  installPrompt: (() => Promise<void>) | null;
  /** A level chosen before the engine finished loading. */
  pendingStart: { levelId: number; attempt: number } | null;

  attachGame: (game: Game | null) => void;
  setHud: (hud: HudState) => void;
  open: (screen: Screen) => void;
  /** Leaves a menu screen for the one it was opened from. */
  back: () => void;
  startLevel: (levelId: number) => void;
  retry: () => void;
  nextLevel: () => void;
  finish: (won: boolean, result: RunResult) => void;
  pause: () => void;
  /** Starts the 3-2-1 countdown that leads back into play. */
  resume: () => void;
  /** Called when the countdown ends. */
  finishCountdown: () => void;
  /** Asks the browser to install the app, when it has offered to. */
  install: () => void;
  setInstallPrompt: (prompt: (() => Promise<void>) | null) => void;
  quit: () => void;
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
  keyboard: false,
  dash: false,
};

/** Transient UI state for the current browser session (never persisted). */
export const useSessionStore = create<SessionState>((set, get) => {
  const run = (levelId: number, attempt: number): void => {
    const game = get().game;
    if (!game) {
      // The engine chunk is still loading: start as soon as it attaches.
      set({ pendingStart: { levelId, attempt } });
      return;
    }
    const progress = useProgressStore.getState();
    game.start({
      levelId,
      attempt,
      difficulty: progress.settings.difficulty,
      meta: metaBonuses(upgrades, progress.upgrades),
    });
    set({ screen: 'playing', levelId, attempt, result: null, hud: EMPTY_HUD, pendingStart: null });
  };

  return {
    screen: 'title',
    settingsFrom: 'title',
    hud: EMPTY_HUD,
    levelId: 1,
    attempt: 0,
    result: null,
    game: null,
    applyUpdate: null,
    installPrompt: null,
    pendingStart: null,

    attachGame: (game) => {
      set({ game });
      const pending = get().pendingStart;
      if (game && pending) run(pending.levelId, pending.attempt);
    },
    setHud: (hud) => set({ hud }),

    open: (screen) =>
      set({ screen, settingsFrom: screen === 'settings' ? get().screen : get().settingsFrom }),
    back: () => {
      const { screen, settingsFrom } = get();
      if (screen === 'settings') set({ screen: settingsFrom });
      else if (screen === 'upgrades') set({ screen: 'levels' });
      else set({ screen: 'title' });
    },

    startLevel: (levelId) => run(levelId, get().attempt + 1),
    retry: () => run(get().levelId, get().attempt),
    nextLevel: () => {
      const next = get().levelId + 1;
      if (levels.some((l) => l.id === next)) run(next, get().attempt + 1);
      else get().quit();
    },

    finish: (won, result) => {
      const { levelId } = get();
      const progress = useProgressStore.getState();
      progress.recordRun(levelId, progress.settings.difficulty, won, result);
      set({ screen: won ? 'results' : 'fallen', result });
    },

    pause: () => {
      if (get().screen !== 'playing') return;
      get().game?.pause();
      set({ screen: 'paused' });
    },

    resume: () => {
      if (get().screen !== 'paused') return;
      set({ screen: 'countdown' });
    },

    finishCountdown: () => {
      if (get().screen !== 'countdown') return;
      get().game?.resume();
      set({ screen: 'playing' });
    },

    install: () => {
      void get().installPrompt?.();
      set({ installPrompt: null });
    },
    setInstallPrompt: (installPrompt) => set({ installPrompt }),

    quit: () => {
      get().game?.pause();
      set({ screen: 'levels' });
    },

    setUpdateReady: (applyUpdate) => set({ applyUpdate }),
  };
});
