import { registerSW } from 'virtual:pwa-register';

import { useSessionStore } from '../store/session';

/**
 * Registers the service worker in "prompt" mode: a new version never reloads
 * the page on its own (it could interrupt a level); the UI shows a toast and
 * the player chooses when to update.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  const update = registerSW({
    onNeedRefresh() {
      useSessionStore.getState().setUpdateReady(() => void update(true));
    },
  });
}
