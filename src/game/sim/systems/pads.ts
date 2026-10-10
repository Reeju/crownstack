import { DT } from '../components';
import { PAD_DWELL_SEC, PAD_RADIUS } from '../constants';
import { currentPadCost } from '../economy';
import { Ev, emit } from '../events';
import { applyTowerTier, spawnArcher, spawnTower } from '../spawn';
import type { PadState, World } from '../world';
import { reassignSlots } from './squadFollow';

/** The keep-upgrade pad may spend banked gold; every other pad only takes stacked coins. */
function availableGold(w: World, pad: PadState): number {
  const stack = w.eco.stackCoins * w.cfg.units.economy.coinValue;
  return pad.type === 'keep' ? stack + w.eco.bank : stack;
}

function anyFenceDamaged(w: World): boolean {
  for (let i = 0; i < w.fences.length; i++) {
    const f = w.fences[i];
    if (w.hp[f] < w.maxHp[f]) return true;
  }
  return false;
}

/**
 * A pad accepts coins only while its purchase would do something, and not
 * straight after it triggered (the king has to step off first).
 */
export function padUsable(w: World, pad: PadState): boolean {
  if (!pad.active || pad.latched) return false;
  if (pad.type === 'repair') return anyFenceDamaged(w);
  if (pad.type === 'gate') return w.eco.gateTimer <= 0;
  return true;
}

/** Moves up to one coin's worth of gold into the pad. Change from a coin goes to the bank. */
function drawCoin(w: World, pad: PadState): void {
  const eco = w.eco;
  const value = w.cfg.units.economy.coinValue;
  const amount = Math.min(value, pad.cost - pad.paid);
  if (pad.type === 'keep' && eco.bank >= amount) {
    eco.bank -= amount;
  } else {
    eco.stackCoins--;
    eco.bank += value - amount;
  }
  pad.paid += amount;
}

function triggerPad(w: World, pad: PadState, index: number): void {
  const { units, level } = w.cfg;
  const eco = w.eco;
  let more = true;

  switch (pad.type) {
    case 'tower': {
      const plot = w.plots[pad.plot];
      plot.tier++;
      if (plot.tier === 1) plot.tower = spawnTower(w, pad.plot, 1);
      else applyTowerTier(w, plot.tower, plot.tier);
      more = plot.tier < level.maxTowerTier;
      break;
    }
    case 'forge':
      eco.gear += pad.gear;
      eco.gearTimer = units.economy.gearLifetimeSec;
      emit(w.events, Ev.GearForged, pad.x, pad.y, pad.gear);
      break;
    case 'repair':
      for (let i = 0; i < w.fences.length; i++) w.hp[w.fences[i]] = w.maxHp[w.fences[i]];
      break;
    case 'keep': {
      eco.keepTier++;
      eco.coinCap = Math.min(
        units.economy.maxCoinCap,
        eco.coinCap + units.economy.coinCapPerKeepTier,
      );
      w.maxHp[w.keep] += units.keep.hpPerTier;
      w.hp[w.keep] = w.maxHp[w.keep];
      // New recruits walk out of the keep and join the squad.
      for (let i = 0; i < units.keep.archersPerTier; i++) {
        spawnArcher(w, w.x[w.keep] + w.hw[w.keep] + 0.6, w.y[w.keep] + (i - 0.5), level.squad.tier);
      }
      reassignSlots(w);
      more = eco.keepTier < units.economy.maxKeepTier;
      break;
    }
    case 'brazier':
      eco.brazierLit = true;
      more = false;
      break;
    case 'gate':
      // Gates slam shut for a while; enemies must break them or wait them out.
      eco.gateTimer = units.economy.gateCloseSec;
      for (let i = 0; i < w.gates.length; i++) w.hp[w.gates[i]] = w.maxHp[w.gates[i]];
      break;
  }

  eco.purchases[pad.type]++;
  pad.paid = 0;
  pad.latched = true;
  pad.active = more;
  pad.cost = currentPadCost(w, pad);
  emit(w.events, Ev.PadPaid, pad.x, pad.y, index);
}

/**
 * Pay-by-standing pads: while the king stands on a usable pad, gold streams
 * from his stack into it at the draw rate until the cost is met.
 */
export function padSystem(w: World): void {
  const hero = w.hero;
  const { economy } = w.cfg.units;
  const canPay = w.outcome === 'playing' && w.hp[hero] > 0;

  if (w.eco.gateTimer > 0) {
    w.eco.gateTimer -= DT;
    if (w.eco.gateTimer <= 0) {
      for (let i = 0; i < w.gates.length; i++) w.hp[w.gates[i]] = 0;
    }
  }

  // Sibling pads of the same type share a rising price (SPEC §3.4).
  for (const pad of w.pads) {
    if (pad.paid === 0 && pad.active) {
      pad.cost = currentPadCost(w, pad);
    }
  }

  for (let i = 0; i < w.pads.length; i++) {
    const pad = w.pads[i];
    const standing = Math.hypot(w.x[hero] - pad.x, w.y[hero] - pad.y) < PAD_RADIUS;
    // A pad that just triggered re-arms only after the king steps off it, so
    // standing still never rolls straight into the next, pricier purchase.
    if (!standing) pad.latched = false;
    const onPad = standing && canPay && padUsable(w, pad);
    if (!onPad) {
      pad.paying = false;
      pad.dwell = 0;
      pad.drawAcc = 0;
      continue;
    }
    pad.dwell += DT;
    if (pad.dwell < PAD_DWELL_SEC) continue;

    pad.drawAcc += economy.padDrawPerSec * DT;
    pad.paying = availableGold(w, pad) > 0;
    while (
      pad.drawAcc >= economy.coinValue &&
      availableGold(w, pad) > 0 &&
      pad.active &&
      !pad.latched
    ) {
      pad.drawAcc -= economy.coinValue;
      drawCoin(w, pad);
      emit(w.events, Ev.PadCoin, pad.x, pad.y, i);
      if (pad.paid >= pad.cost) triggerPad(w, pad, i);
    }
    if (!pad.paying) pad.drawAcc = 0;
  }
}
