import { useSessionStore } from '../store/session';

export function Hud() {
  const hud = useSessionStore((s) => s.hud);
  const pause = useSessionStore((s) => s.pause);

  return (
    <div className="hud">
      <div className="hud-left">
        <button type="button" className="hud-btn" aria-label="Pause" onClick={pause}>
          <span aria-hidden="true">II</span>
        </button>
        <span className="hud-level">{hud.levelName}</span>
      </div>
      <div className="hud-gold" aria-label={`Gold: ${hud.gold}`} data-testid="hud-gold">
        <span className="coin-icon" aria-hidden="true" />
        <span>{hud.gold}</span>
      </div>
    </div>
  );
}
