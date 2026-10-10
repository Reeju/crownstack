import { useSessionStore } from '../store/session';

/** Lose panel. Retry replays the same seed, so the waves are identical. */
export function Fallen() {
  const result = useSessionStore((s) => s.result);
  const retry = useSessionStore((s) => s.retry);
  const quit = useSessionStore((s) => s.quit);

  return (
    <div className="screen scrim" role="dialog" aria-modal="true" aria-labelledby="fallen-title">
      <div className="panel">
        <h2 id="fallen-title" className="panel-title fallen-title">
          The camp has fallen
        </h2>
        <button type="button" className="btn btn-primary" autoFocus onClick={retry}>
          Retry
        </button>
        <button type="button" className="btn" onClick={quit}>
          Levels
        </button>
        {result && <p className="seed">Seed {result.seed.toString(16)}</p>}
      </div>
    </div>
  );
}
