// Prints the bot results table used for level tuning:
//   pnpm bot                 every level
//   BOT_LEVELS=2,3 pnpm bot  only those levels
import { it } from 'vitest';

import { levels } from '../../src/content';
import type { Difficulty } from '../../src/content/schema';
import { runSeed } from '../../src/game/sim/rng';
import { makeWorld } from '../unit/helpers/world';
import { playBot, type BotStyle } from './bot';

const only = (process.env.BOT_LEVELS ?? '').split(',').map(Number).filter(Boolean);

it('prints the bot results table', { timeout: 600_000 }, () => {
  const rows: Record<string, string | number>[] = [];
  for (const level of levels) {
    if (only.length > 0 && !only.includes(level.id)) continue;
    for (const [style, difficulty] of [
      ['careful', 'normal'],
      ['naive', 'normal'],
      ['naive', 'hard'],
    ] as [BotStyle, Difficulty][]) {
      const r = playBot(makeWorld(level, { seed: runSeed(level.id, 1), difficulty }), style);
      rows.push({
        level: `${level.id} ${level.name}`,
        bot: style,
        difficulty,
        outcome: r.outcome,
        time: r.timeSec,
        'par+50%': Math.round(level.parTimeSec * 1.5),
        kills: r.kills,
        'keep%': r.keepHp,
        king: r.kingHp,
        archers: r.archers,
        gold: r.gold,
      });
    }
  }
  console.table(rows);
});
