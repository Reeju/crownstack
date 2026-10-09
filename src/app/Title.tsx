import { useSessionStore } from '../store/session';

export function Title() {
  const setScreen = useSessionStore((s) => s.setScreen);

  return (
    <main className="screen title-screen">
      <h1 className="logo">Crownstack</h1>
      <p className="tagline">Stack gold. Arm your archers. Hold the palisade.</p>
      <button
        type="button"
        className="btn btn-primary"
        autoFocus
        onClick={() => setScreen('playing')}
      >
        Play
      </button>
    </main>
  );
}
