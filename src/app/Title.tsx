import { useSessionStore } from '../store/session';

export function Title() {
  const open = useSessionStore((s) => s.open);

  return (
    <main className="screen scrim title-screen">
      <h1 className="logo">Crownstack</h1>
      <p className="tagline">Stack gold. Arm your archers. Hold the palisade.</p>
      <button type="button" className="btn btn-primary" autoFocus onClick={() => open('levels')}>
        Play
      </button>
      <div className="row">
        <button type="button" className="btn" onClick={() => open('settings')}>
          Settings
        </button>
        <button type="button" className="btn" onClick={() => open('about')}>
          About
        </button>
      </div>
    </main>
  );
}
