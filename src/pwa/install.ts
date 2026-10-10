import { useSessionStore } from '../store/session';

/** The non-standard event Chromium fires when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari has no install prompt; the UI shows an "Add to Home Screen" hint instead. */
export function needsIosInstallHint(): boolean {
  const ua = navigator.userAgent;
  const iOS =
    /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return iOS && !isStandalone();
}

/** Captures `beforeinstallprompt` so the game can offer its own Install button (SPEC §7.1). */
export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    const event = ev as BeforeInstallPromptEvent;
    useSessionStore.getState().setInstallPrompt(() => event.prompt());
  });
  window.addEventListener('appinstalled', () => useSessionStore.getState().setInstallPrompt(null));
}
