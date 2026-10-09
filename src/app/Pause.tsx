import { useSessionStore } from '../store/session';

export function Pause() {
  const resume = useSessionStore((s) => s.resume);
  const quitToTitle = useSessionStore((s) => s.quitToTitle);

  return (
    <div className="screen scrim" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="panel">
        <h2 id="pause-title" className="panel-title">
          Paused
        </h2>
        <button type="button" className="btn btn-primary" autoFocus onClick={resume}>
          Resume
        </button>
        <button type="button" className="btn" onClick={quitToTitle}>
          Quit
        </button>
      </div>
    </div>
  );
}
