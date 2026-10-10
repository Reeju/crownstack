import type { CSSProperties } from 'react';

import { useProgressStore } from '../store/progress';
import { useSessionStore } from '../store/session';
import { useTween } from './useTween';

export function Hud() {
  const hud = useSessionStore((s) => s.hud);
  const screen = useSessionStore((s) => s.screen);
  const pause = useSessionStore((s) => s.pause);
  const reducedMotion = useProgressStore((s) => s.settings.reducedMotion);
  const gold = useTween(hud.gold, !reducedMotion);

  return (
    <div className="hud">
      <div className="hud-left">
        <button
          type="button"
          className="hud-btn"
          aria-label="Pause"
          disabled={screen !== 'playing'}
          onClick={pause}
        >
          <span aria-hidden="true">II</span>
        </button>
        <span className="hud-chip hud-level">{hud.levelName}</span>
      </div>

      <div className="hud-centre">
        <span className="hud-chip hud-wave" data-testid="hud-wave">
          Wave {Math.min(hud.wave, hud.waveCount)}/{hud.waveCount}
        </span>
        {hud.bannerWave > 0 && (
          <div className="wave-banner" role="status">
            Wave {hud.bannerWave} incoming
          </div>
        )}
      </div>

      {/* The label carries the true value; the visible number is a short count-up animation. */}
      <div
        className="hud-chip hud-gold"
        aria-label={`Gold: ${hud.gold}`}
        data-testid="hud-gold"
        data-gold={hud.gold}
      >
        <span className="crown-icon" aria-hidden="true">
          ♛
        </span>
        <span>{gold}</span>
      </div>

      {hud.bannerWave > 0 && (
        <div
          className="wave-arrow"
          aria-hidden="true"
          style={{ '--angle': `${hud.bannerAngle}deg` } as CSSProperties}
        />
      )}

      {hud.hint && (
        <p className="hint" role="status">
          {hud.hint}
        </p>
      )}

      {hud.keyboard && screen === 'playing' && (
        <p className="key-hints">
          <kbd>WASD</kbd> move
          {hud.dash && (
            <>
              {' '}
              · <kbd>Space</kbd> dash
            </>
          )}{' '}
          · <kbd>Esc</kbd> pause
        </p>
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
