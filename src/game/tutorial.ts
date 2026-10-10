import type { LevelDef } from '../content/schema';
import { totalGold } from './sim/economy';
import type { World } from './sim/world';

/** A hint stays on screen this long unless the next one replaces it first. */
const HINT_SEC = 7;
/** ...and is never replaced sooner than this, so every hint can be read. */
const MIN_HINT_SEC = 3.5;

export interface Hint {
  text: string;
  /** Pad to draw a pointer over, or -1. */
  pad: number;
}

function triggered(trigger: string, w: World): boolean {
  if (trigger === 'start') return true;
  if (trigger === 'gearCarried') return w.eco.gear > 0;
  if (trigger === 'fenceDamaged') {
    for (let i = 0; i < w.fences.length; i++)
      if (w.hp[w.fences[i]] < w.maxHp[w.fences[i]]) return true;
    return false;
  }
  const [name, arg] = trigger.split(/>=|:/);
  if (name === 'gold') return totalGold(w) >= Number(arg);
  if (name === 'wave') return w.wavesStarted >= Number(arg);
  if (name === 'padPaid') return w.eco.purchases[arg as keyof typeof w.eco.purchases] > 0;
  return false;
}

/**
 * Walks a level's tutorial list in order (SPEC §4.3). It only reads the world,
 * so it lives outside `sim/` and has no effect on determinism.
 */
export class Tutorial {
  private next = 0;
  private shownAt = -Infinity;
  private readonly current: Hint = { text: '', pad: -1 };

  constructor(private readonly level: LevelDef) {}

  /** The hint to show right now, or null. */
  update(w: World): Hint | null {
    const steps = this.level.tutorial;
    const readable = w.time - this.shownAt >= MIN_HINT_SEC;
    if (this.next < steps.length && readable && triggered(steps[this.next].trigger, w)) {
      const step = steps[this.next++];
      this.current.text = step.text;
      this.current.pad = step.pointAt
        ? w.pads.findIndex((p) => `pad:${p.id}` === step.pointAt)
        : -1;
      this.shownAt = w.time;
    }
    if (w.time - this.shownAt > HINT_SEC) return null;
    // Stop pointing at a pad once it has been bought.
    if (this.current.pad >= 0 && !w.pads[this.current.pad].active) this.current.pad = -1;
    return this.current;
  }
}
