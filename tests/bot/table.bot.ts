// Prints the bot results table used for level tuning:
//   pnpm bot                 every level, 3 seeds each
//   BOT_LEVELS=2,3 pnpm bot  only those levels
//   BOT_SEEDS=5 pnpm bot     more seeds per row
import { it } from 'vitest';

import { levels } from '../../src/content';
import type { Difficulty } from '../../src/content/schema';
import { runSeed } from '../../src/game/sim/rng';
import { makeWorld } from '../unit/helpers/world';
import { playBot, type BotStyle } from './bot';

const only = (process.env.BOT_LEVELS ?? '').split(',').map(Number).filter(Boolean);
const seeds = Number(process.env.BOT_SEEDS ?? 3);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

it('prints the bot results table', { timeout: 1_800_000 }, () => {
  const rows: Record<string, string | number>[] = [];
  for (const level of levels) {
    if (only.length > 0 && !only.includes(level.id)) continue;
    for (const [style, difficulty] of [
      ['careful', 'normal'],
      ['naive', 'normal'],
      ['naive', 'hard'],
    ] as [BotStyle, Difficulty][]) {
      const runs = Array.from({ length: seeds }, (_, attempt) =>
        playBot(makeWorld(level, { seed: runSeed(level.id, attempt + 1), difficulty }), style),
      );
      const wins = runs.filter((r) => r.outcome === 'won');
      rows.push({
        level: `${level.id} ${level.name}`,
        bot: style,
        difficulty,
        wins: `${wins.length}/${seeds}`,
        'win time': wins.length > 0 ? median(wins.map((r) => r.timeSec)) : '-',
        'par+50%': Math.round(level.parTimeSec * 1.5),
        'keep%': median(runs.map((r) => r.keepHp)),
        archers: median(runs.map((r) => r.archers)),
        'peak entities': Math.max(...runs.map((r) => r.peakEntities)),
      });
    }
  }
  console.table(rows);
});
