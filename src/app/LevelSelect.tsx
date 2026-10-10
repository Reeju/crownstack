import { levels } from '../content';
import type { Difficulty } from '../content/schema';
import {
  crownsAvailable,
  crownsEarned,
  isUnlocked,
  MAX_CROWNS,
  useProgressStore,
} from '../store/progress';
import { useSessionStore } from '../store/session';
import { Crowns } from './Crowns';
import { useEscape } from './useEscape';

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];

/** The 12 level nodes with crowns and best scores, plus difficulty and the way into Upgrades. */
export function LevelSelect() {
  const progress = useProgressStore();
  const startLevel = useSessionStore((s) => s.startLevel);
  const open = useSessionStore((s) => s.open);
  const back = useSessionStore((s) => s.back);
  useEscape(back);
  const difficulty = progress.settings.difficulty;

  return (
    <main className="screen scrim menu">
      <header className="menu-header">
        <button type="button" className="btn btn-small" onClick={back}>
          Back
        </button>
        <h2 className="menu-title">Choose a level</h2>
        <button type="button" className="btn btn-small" onClick={() => open('upgrades')}>
          Upgrades <span className="pill">♛ {crownsAvailable(progress)}</span>
        </button>
      </header>

      <div className="segmented" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={difficulty === d.id}
            className={difficulty === d.id ? 'segment selected' : 'segment'}
            onClick={() => progress.setSetting('difficulty', d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <ol className="level-grid">
        {levels.map((level, i) => {
          const unlocked = isUnlocked(progress, level.id);
          const record = progress.levels[level.id];
          const best = record?.bestScore[difficulty] ?? 0;
          return (
            <li key={level.id}>
              <button
                type="button"
                className="level-node"
                disabled={!unlocked}
                autoFocus={i === 0}
                aria-label={
                  unlocked
                    ? `Level ${level.id}: ${level.name}, ${record?.crowns ?? 0} of 3 crowns`
                    : `Level ${level.id}: locked`
                }
                onClick={() => startLevel(level.id)}
              >
                <span className="level-number">{unlocked ? level.id : '🔒'}</span>
                <span className="level-name">{level.name}</span>
                <Crowns earned={record?.crowns ?? 0} small />
                <span className="level-best">{best > 0 ? `Best ${best}` : ' '}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="menu-footnote">
        ♛ {crownsEarned(progress)} / {MAX_CROWNS} crowns earned
      </p>
    </main>
  );
}
