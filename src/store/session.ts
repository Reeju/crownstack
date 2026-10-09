import { create } from 'zustand';

export type Screen = 'title' | 'playing';

type SessionState = {
  screen: Screen;
  /** Set when a new service worker is waiting; calling it applies the update. */
  applyUpdate: (() => void) | null;
  setScreen: (screen: Screen) => void;
  setUpdateReady: (apply: () => void) => void;
};

/** Transient UI state for the current browser session (never persisted). */
export const useSessionStore = create<SessionState>((set) => ({
  screen: 'title',
  applyUpdate: null,
  setScreen: (screen) => set({ screen }),
  setUpdateReady: (applyUpdate) => set({ applyUpdate }),
}));
