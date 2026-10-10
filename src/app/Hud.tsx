import type { CSSProperties } from 'react';

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
        <span className="hud-chip hud-level">{hud.levelName}</span>
      </div>

      <div className="hud-centre">
        <span className="hud-chip" data-testid="hud-wave">
          Wave {Math.min(hud.wave, hud.waveCount)}/{hud.waveCount}
        </span>
        {hud.bannerWave > 0 && (
          <div className="wave-banner" role="status">
            Wave {hud.bannerWave} incoming
          </div>
        )}
      </div>

      <div className="hud-chip hud-gold" aria-label={`Gold: ${hud.gold}`} data-testid="hud-gold">
        <span className="coin-icon" aria-hidden="true" />
        <span>{hud.gold}</span>
      </div>

      {hud.bannerWave > 0 && (
        <div
          className="wave-arrow"
          aria-hidden="true"
          style={{ '--angle': `${hud.bannerAngle}deg` } as CSSProperties}
        />
      )}

      {hud.keepHp < 100 && (
        <div
          className="keep-hp"
          role="meter"
          aria-label="Keep health"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hud.keepHp}
        >
          <span className="keep-hp-label">Keep</span>
          <span className="keep-hp-track">
            <span className="keep-hp-fill" style={{ width: `${hud.keepHp}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}
