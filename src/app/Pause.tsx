import { useSessionStore } from '../store/session';

export function Pause() {
  const resume = useSessionStore((s) => s.resume);
  const retry = useSessionStore((s) => s.retry);
  const open = useSessionStore((s) => s.open);
  const quit = useSessionStore((s) => s.quit);

  return (
    <div className="screen scrim" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="panel">
        <h2 id="pause-title" className="panel-title">
          Paused
        </h2>
        <button type="button" className="btn btn-primary" autoFocus onClick={resume}>
          Resume
        </button>
        <button type="button" className="btn" onClick={retry}>
          Restart
        </button>
        <button type="button" className="btn" onClick={() => open('settings')}>
          Settings
        </button>
        <button type="button" className="btn" onClick={quit}>
          Quit
        </button>
      </div>
    </div>
  );
}
