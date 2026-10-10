import type { UpgradeDef } from '../../content/schema';
import type { MetaBonuses } from './world';

/** Turns owned upgrade ranks into the bonuses a run starts with (SPEC §4.4). */
export function metaBonuses(
  defs: readonly UpgradeDef[],
  ranks: Readonly<Record<string, number>>,
): MetaBonuses {
  const meta: MetaBonuses = {
    coinCap: 0,
    kingHp: 0,
    extraArchers: 0,
    towerCostMult: 1,
    magnetRadius: 0,
  };
  for (const def of defs) {
    const rank = Math.min(Math.max(ranks[def.id] ?? 0, 0), def.ranks);
    meta[def.bonus] += def.perRank * rank;
  }
  return meta;
}
