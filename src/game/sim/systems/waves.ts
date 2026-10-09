import { DT } from '../components';
import { WAVE_ANNOUNCE_SEC } from '../constants';
import { Ev, emit } from '../events';
import { pathSample, samplePath } from '../pathing';
import { spawnEnemy } from '../spawn';
import type { World } from '../world';

/**
 * Timed spawn groups (SPEC §3.5). Fixed waves start at their `at` time;
 * reactive waves ("prevCleared+N") start N seconds after the previous wave
 * has fully spawned and the field is clear. Each is announced 3 s ahead.
 */
export function waveSystem(w: World): void {
  if (w.outcome !== 'playing') return;

  for (let i = 0; i < w.waves.length; i++) {
    const wave = w.waves[i];
    if (wave.done) continue;

    if (wave.at < 0) {
      const prevDone = i === 0 || w.waves[i - 1].done;
      if (!prevDone || w.enemiesAlive > 0) continue;
      wave.at = w.time + wave.afterClear;
    }

    if (!wave.announced && w.time >= wave.at - WAVE_ANNOUNCE_SEC) {
      wave.announced = true;
      samplePath(w.paths[wave.path], 0);
      emit(w.events, Ev.WaveAnnounced, pathSample.x, pathSample.y, i, wave.path);
    }
    if (!wave.started && w.time >= wave.at) {
      wave.started = true;
      w.wavesStarted++;
      samplePath(w.paths[wave.path], 0);
      emit(w.events, Ev.WaveStarted, pathSample.x, pathSample.y, i, wave.path);
    }
    if (!wave.started) continue;

    let remaining = 0;
    for (const group of wave.groups) {
      if (group.spawned < group.count) {
        group.next -= DT;
        while (group.next <= 0 && group.spawned < group.count) {
          spawnEnemy(w, group.def, wave.path);
          group.spawned++;
          group.next += group.interval;
          if (group.interval <= 0) group.next = 0;
        }
      }
      remaining += group.count - group.spawned;
    }
    if (remaining === 0) wave.done = true;
  }
}

/** True once every wave has finished spawning. */
export function allWavesSpawned(w: World): boolean {
  for (const wave of w.waves) if (!wave.done) return false;
  return true;
}
