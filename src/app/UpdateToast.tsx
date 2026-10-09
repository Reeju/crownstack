import { useSessionStore } from '../store/session';

/** "Update available" prompt; never shown mid-level so play is not interrupted. */
export function UpdateToast() {
  const applyUpdate = useSessionStore((s) => s.applyUpdate);
  const screen = useSessionStore((s) => s.screen);
  if (!applyUpdate || screen === 'playing') return null;

  return (
    <div className="toast" role="status">
      <span>Update available</span>
      <button type="button" className="btn btn-small" onClick={applyUpdate}>
        Reload
      </button>
    </div>
  );
}
