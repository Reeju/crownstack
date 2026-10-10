import { DT } from '../components';
import { CELEBRATION_SEC } from '../constants';
import { Ev, emit } from '../events';
import type { World } from '../world';
import { allWavesSpawned } from './waves';

/** Win when the last wave is dead (after a short celebration); lose with the king or the keep. */
export function outcomeSystem(w: World): void {
  if (w.outcome !== 'playing') return;

  if (w.hp[w.hero] <= 0 || w.hp[w.keep] <= 0) {
    w.outcome = 'lost';
    emit(w.events, Ev.LevelLost, w.x[w.hero], w.y[w.hero]);
    return;
  }

  if (w.celebrate >= 0) {
    w.celebrate -= DT;
    if (w.celebrate <= 0) {
      w.outcome = 'won';
      w.stats.rewardGold = 100 * w.cfg.level.id;
      emit(w.events, Ev.LevelWon, w.x[w.hero], w.y[w.hero]);
    }
  } else if (w.enemiesAlive === 0 && allWavesSpawned(w)) {
    w.celebrate = CELEBRATION_SEC;
    emit(w.events, Ev.WavesCleared, w.x[w.hero], w.y[w.hero]);
  }
}
