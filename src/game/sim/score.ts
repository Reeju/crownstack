import type { World } from './world';

const KILL_SCORE = 50;
const MAX_TIME_BONUS = 1000;

export interface RunResult {
  score: number;
  crowns: 1 | 2 | 3;
  kills: number;
  goldEarned: number;
  rewardGold: number;
  timeSec: number;
  seed: number;
}

/** Crowns by keep HP remaining: > 80% = 3, > 40% = 2, else 1 (SPEC §3.4). */
export function crownsFor(keepHpRatio: number): 1 | 2 | 3 {
  if (keepHpRatio > 0.8) return 3;
  return keepHpRatio > 0.4 ? 2 : 1;
}

/** Score = gold earned + 50/kill + 500/giant + a time bonus that decays over par time (SPEC §3.6). */
export function runResult(w: World): RunResult {
  const timeBonus = Math.round(MAX_TIME_BONUS * Math.max(0, 1 - w.time / w.cfg.level.parTimeSec));
  return {
    score: w.eco.goldEarned + w.stats.kills * KILL_SCORE + w.stats.bonusScore + timeBonus,
    crowns: crownsFor(w.hp[w.keep] / w.maxHp[w.keep]),
    kills: w.stats.kills,
    goldEarned: w.eco.goldEarned,
    rewardGold: w.stats.rewardGold,
    timeSec: w.time,
    seed: w.cfg.seed,
  };
}
