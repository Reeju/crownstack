import { useProgressStore } from '../store/progress';
import { useSessionStore } from '../store/session';
import { useEscape } from './useEscape';

function formatPlaytime(sec: number): string {
  const minutes = Math.floor(sec / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function About() {
  const stats = useProgressStore((s) => s.stats);
  const back = useSessionStore((s) => s.back);
  useEscape(back);

  return (
    <div className="screen scrim" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="panel panel-wide">
        <h2 id="about-title" className="panel-title">
          About
        </h2>
        <p className="prose">
          Crownstack is an original hero-defense game. Walk over gold to stack it, spend it on
          towers and forged bows, and hold the palisade.
        </p>
        <p className="prose">
          It works offline once loaded, keeps your progress on this device only, and has no ads,
          accounts or trackers. All art and sound are generated in code. MIT licensed; the Fredoka
          font is under the SIL Open Font License.
        </p>
        <dl className="stats">
          <dt>Raiders defeated</dt>
          <dd>{stats.kills}</dd>
          <dt>Gold earned</dt>
          <dd>{stats.goldEarned}</dd>
          <dt>Time played</dt>
          <dd>{formatPlaytime(stats.playtimeSec)}</dd>
        </dl>
        <p className="seed">Version {__APP_VERSION__}</p>
        <button type="button" className="btn btn-primary" autoFocus onClick={back}>
          Done
        </button>
      </div>
    </div>
  );
}
