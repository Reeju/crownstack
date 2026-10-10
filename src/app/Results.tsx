import { levels } from '../content';
import { useSessionStore } from '../store/session';

function formatTime(sec: number): string {
  const whole = Math.floor(sec);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Win panel: crowns, score breakdown and the run seed for bug reports. */
export function Results() {
  const result = useSessionStore((s) => s.result);
  const levelId = useSessionStore((s) => s.levelId);
  const nextLevel = useSessionStore((s) => s.nextLevel);
  const retry = useSessionStore((s) => s.retry);
  const quitToTitle = useSessionStore((s) => s.quitToTitle);
  if (!result) return null;
  const hasNext = levels.some((l) => l.id === levelId + 1);

  return (
    <div className="screen scrim" role="dialog" aria-modal="true" aria-labelledby="results-title">
      <div className="panel">
        <h2 id="results-title" className="panel-title">
          Camp defended!
        </h2>
        <div className="crowns" role="img" aria-label={`${result.crowns} of 3 crowns`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={n <= result.crowns ? 'crown earned' : 'crown'}
              aria-hidden="true"
            >
              ♛
            </span>
          ))}
        </div>
        <dl className="stats">
          <dt>Score</dt>
          <dd data-testid="result-score">{result.score}</dd>
          <dt>Kills</dt>
          <dd>{result.kills}</dd>
          <dt>Gold earned</dt>
          <dd>{result.goldEarned}</dd>
          <dt>Reward</dt>
          <dd>+{result.rewardGold} gold</dd>
          <dt>Time</dt>
          <dd>{formatTime(result.timeSec)}</dd>
        </dl>
        {hasNext && (
          <button type="button" className="btn btn-primary" autoFocus onClick={nextLevel}>
            Next level
          </button>
        )}
        <button type="button" className="btn" autoFocus={!hasNext} onClick={retry}>
          Play again
        </button>
        <button type="button" className="btn" onClick={quitToTitle}>
          Menu
        </button>
        <p className="seed">Seed {result.seed.toString(16)}</p>
      </div>
    </div>
  );
}
