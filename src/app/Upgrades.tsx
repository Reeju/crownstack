import { upgrades } from '../content';
import { crownsAvailable, useProgressStore } from '../store/progress';
import { useSessionStore } from '../store/session';
import { useEscape } from './useEscape';

/** The crown shop (SPEC §4.4): a short list of ranked, permanent bonuses. */
export function Upgrades() {
  const progress = useProgressStore();
  const back = useSessionStore((s) => s.back);
  useEscape(back);
  const available = crownsAvailable(progress);

  return (
    <main className="screen scrim menu">
      <header className="menu-header">
        <button type="button" className="btn btn-small" autoFocus onClick={back}>
          Back
        </button>
        <h2 className="menu-title">Upgrades</h2>
        <span className="pill pill-large" aria-label={`${available} crowns to spend`}>
          ♛ {available}
        </span>
      </header>

      <ul className="upgrade-list">
        {upgrades.map((def) => {
          const rank = progress.upgrades[def.id] ?? 0;
          const maxed = rank >= def.ranks;
          return (
            <li key={def.id} className="upgrade">
              <div className="upgrade-text">
                <span className="upgrade-name">{def.name}</span>
                <span className="upgrade-desc">{def.description}</span>
                <span className="pips" role="img" aria-label={`Rank ${rank} of ${def.ranks}`}>
                  {Array.from({ length: def.ranks }, (_, i) => (
                    <span key={i} className={i < rank ? 'pip filled' : 'pip'} />
                  ))}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-small btn-buy"
                disabled={maxed || available < def.cost}
                onClick={() => progress.buyUpgrade(def.id)}
              >
                {maxed ? 'Max' : `♛ ${def.cost}`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="menu-footnote">
        Earn up to three crowns per level by keeping the keep healthy.
      </p>
    </main>
  );
}
