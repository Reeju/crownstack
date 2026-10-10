import type { PadState, World } from './world';

/** Cost of the n-th repeat purchase: +30% each time, rounded to the nearest 10 (SPEC §3.4). */
export function repeatCost(base: number, purchases: number, mult: number): number {
  return Math.max(10, Math.round((base * mult ** purchases) / 10) * 10);
}

/**
 * Current price of a pad. Tower pads may carry a meta-upgrade discount, which
 * is applied after the repeat mark-up and rounded to the nearest 5.
 */
export function padCost(
  base: number,
  purchases: number,
  repeatMult: number,
  discount: number,
): number {
  const cost = repeatCost(base, purchases, repeatMult);
  return discount === 1 ? cost : Math.max(5, Math.round((cost * discount) / 5) * 5);
}

/** What `pad` costs right now, given how many of its kind have been bought this level. */
export function currentPadCost(w: World, pad: PadState): number {
  const { repeatCostMult } = w.cfg.units.economy;
  return padCost(pad.baseCost, w.eco.purchases[pad.type], repeatCostMult, pad.discount);
}

/** Total gold shown on the HUD: the stack on the king's head plus the bank. */
export function totalGold(w: World): number {
  return w.eco.stackCoins * w.cfg.units.economy.coinValue + w.eco.bank;
}

/** Adds one coin: onto the stack if there is room, otherwise into the bank. */
export function gainCoin(w: World): void {
  const value = w.cfg.units.economy.coinValue;
  if (w.eco.stackCoins < w.eco.coinCap) w.eco.stackCoins++;
  else w.eco.bank += value;
  w.eco.goldEarned += value;
}

/** Stack capacity for a level before keep upgrades, never below one coin. */
export function baseCoinCap(w: World): number {
  const { level, units, difficulty, meta } = w.cfg;
  return Math.max(1, level.coinCap + meta.coinCap + units.difficulty[difficulty].coinCapDelta);
}
