import { useSessionStore } from '../store/session';

export function Title() {
  const startLevel = useSessionStore((s) => s.startLevel);

  return (
    <main className="screen scrim title-screen">
      <h1 className="logo">Crownstack</h1>
      <p className="tagline">Stack gold. Arm your archers. Hold the palisade.</p>
      <button type="button" className="btn btn-primary" autoFocus onClick={() => startLevel(1)}>
        Play
      </button>
    </main>
  );
}
