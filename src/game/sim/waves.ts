import type { LevelDef } from '../../content/schema';

/** One spawn group inside a wave, with its own countdown. */
export interface GroupState {
  readonly def: number;
  readonly count: number;
  readonly interval: number;
  readonly delay: number;
  spawned: number;
  /** Seconds until this group's next spawn once the wave has started. */
  next: number;
}

export interface WaveState {
  readonly path: number;
  /** Fixed start time, or -1 when the wave is reactive ("prevCleared+N"). */
  readonly fixedAt: number;
  readonly afterClear: number;
  readonly groups: GroupState[];
  /** Resolved start time; -1 until a reactive wave has been scheduled. */
  at: number;
  announced: boolean;
  started: boolean;
  done: boolean;
}

/** Turns a level's wave list into scheduler state. Ids are resolved to indices once, here. */
export function compileWaves(
  level: LevelDef,
  pathIndex: ReadonlyMap<string, number>,
  enemyIndex: ReadonlyMap<string, number>,
): WaveState[] {
  return level.waves.map((wave) => {
    const reactive = typeof wave.at === 'string';
    const fixedAt = reactive ? -1 : (wave.at as number);
    return {
      path: pathIndex.get(wave.path) ?? 0,
      fixedAt,
      afterClear: reactive ? Number((wave.at as string).slice('prevCleared+'.length)) : 0,
      groups: wave.groups.map((g) => ({
        def: enemyIndex.get(g.type) ?? 0,
        count: g.count,
        interval: g.interval,
        delay: g.delay,
        spawned: 0,
        next: g.delay,
      })),
      at: fixedAt,
      announced: false,
      started: false,
      done: false,
    };
  });
}
