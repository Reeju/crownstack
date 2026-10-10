import { needsIosInstallHint } from '../pwa/install';
import { useSessionStore } from '../store/session';

/** "Install" where the browser offers it; on iOS, the Add to Home Screen hint. */
export function InstallButton() {
  const installPrompt = useSessionStore((s) => s.installPrompt);
  const install = useSessionStore((s) => s.install);

  if (installPrompt) {
    return (
      <button type="button" className="btn" onClick={install}>
        Install
      </button>
    );
  }
  if (needsIosInstallHint()) {
    return <p className="install-hint">To install: tap Share, then “Add to Home Screen”.</p>;
  }
  return null;
}
