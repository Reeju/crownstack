import { C, CoinState, Kind } from '../../src/game/sim/components';
import { padUsable } from '../../src/game/sim/systems/pads';
import { step } from '../../src/game/sim/step';
import type { World } from '../../src/game/sim/world';

/**
 * Heuristic bots used to tune levels (SPEC §9 Phase 4).
 *
 * - `naive`: the spec's "nearest coin, cheapest pad" player. It never retreats.
 * - `careful`: the same goals, but it leaves coins that sit next to enemies,
 *   falls back to the yard when hurt and waits near home between waves. It
 *   stands in for a competent human when checking that a level is winnable.
 */
export type BotStyle = 'naive' | 'careful';

const CELL = 0.5;
const CLEARANCE = 0.55;
const DECIDE_EVERY = 12;
const DANGER_RADIUS = 3.5;
const RETREAT_HP = 0.5;

/** Breadth-first navigation over a coarse grid of the map's standing blockers. */
class Navigator {
  private readonly cols: number;
  private readonly rows: number;
  private readonly blocked: Uint8Array;
  private readonly from: Int32Array;
  private readonly queue: Int32Array;

  constructor(private readonly w: World) {
    this.cols = Math.ceil(w.cfg.map.size.w / CELL);
    this.rows = Math.ceil(w.cfg.map.size.h / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.from = new Int32Array(this.cols * this.rows);
    this.queue = new Int32Array(this.cols * this.rows);
  }

  /** Next point to walk toward on the way from (sx, sy) to (tx, ty). */
  next(sx: number, sy: number, tx: number, ty: number, out: { x: number; y: number }): void {
    this.rasterise();
    const start = this.cell(sx, sy);
    const goal = this.cell(tx, ty);
    this.blocked[start] = 0;
    this.from.fill(-1);
    this.from[start] = start;
    let head = 0;
    let tail = 0;
    this.queue[tail++] = start;
    let best = start;
    let bestDist = Infinity;

    while (head < tail) {
      const c = this.queue[head++];
      const cx = c % this.cols;
      const cy = (c - cx) / this.cols;
      const d = Math.hypot((cx + 0.5) * CELL - tx, (cy + 0.5) * CELL - ty);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
      if (c === goal) break;
      for (let i = 0; i < 4; i++) {
        const nx = cx + (i === 0 ? 1 : i === 1 ? -1 : 0);
        const ny = cy + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const n = ny * this.cols + nx;
        if (this.blocked[n] || this.from[n] !== -1) continue;
        this.from[n] = c;
        this.queue[tail++] = n;
      }
    }

    // Walk back from the reachable cell nearest the goal to the step after the start.
    let c = best;
    let prev = best;
    let prev2 = best;
    while (c !== start) {
      prev2 = prev;
      prev = c;
      c = this.from[c];
    }
    if (best === start || (prev2 === best && bestDist < CELL)) {
      out.x = tx;
      out.y = ty;
    } else {
      out.x = ((prev2 % this.cols) + 0.5) * CELL;
      out.y = (Math.floor(prev2 / this.cols) + 0.5) * CELL;
    }
  }

  private cell(x: number, y: number): number {
    const cx = Math.min(Math.max(Math.floor(x / CELL), 0), this.cols - 1);
    const cy = Math.min(Math.max(Math.floor(y / CELL), 0), this.rows - 1);
    return cy * this.cols + cx;
  }

  private rasterise(): void {
    const w = this.w;
    this.blocked.fill(0);
    const box = (x: number, y: number, hw: number, hh: number): void => {
      const x0 = Math.max(Math.floor((x - hw - CLEARANCE) / CELL), 0);
      const x1 = Math.min(Math.floor((x + hw + CLEARANCE) / CELL), this.cols - 1);
      const y0 = Math.max(Math.floor((y - hh - CLEARANCE) / CELL), 0);
      const y1 = Math.min(Math.floor((y + hh + CLEARANCE) / CELL), this.rows - 1);
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) this.blocked[cy * this.cols + cx] = 1;
    };
    for (let i = 0; i < w.fences.length; i++) {
      const f = w.fences[i];
      if (w.hp[f] > 0) box(w.x[f], w.y[f], w.hw[f], w.hh[f]);
    }
    if (w.hp[w.keep] > 0) box(w.x[w.keep], w.y[w.keep], w.hw[w.keep], w.hh[w.keep]);
    for (const wall of w.walls) box(wall.x, wall.y, wall.hw, wall.hh);
    for (const rock of w.rocks) box(rock.x, rock.y, rock.r * 0.7, rock.r * 0.7);
  }
}

export class Bot {
  private readonly nav: Navigator;
  private readonly goal = { x: 0, y: 0 };
  private readonly waypoint = { x: 0, y: 0 };

  constructor(
    private readonly w: World,
    private readonly style: BotStyle,
  ) {
    this.nav = new Navigator(w);
    this.goal.x = w.x[w.hero];
    this.goal.y = w.y[w.hero];
  }

  /** Sets the world's intent for the next step. */
  act(): void {
    const w = this.w;
    const hero = w.hero;
    if (w.tick % DECIDE_EVERY === 0) {
      this.decide();
      this.nav.next(w.x[hero], w.y[hero], this.goal.x, this.goal.y, this.waypoint);
    }
    const dx = this.waypoint.x - w.x[hero];
    const dy = this.waypoint.y - w.y[hero];
    const dist = Math.hypot(dx, dy);
    w.intent.moveX = dist > 0.15 ? dx / dist : 0;
    w.intent.moveY = dist > 0.15 ? dy / dist : 0;
    w.intent.dash = false;
  }

  private decide(): void {
    const w = this.w;
    const hero = w.hero;
    const [homeX, homeY] = w.cfg.map.heroStart;
    const careful = this.style === 'careful';
    const coinValue = w.cfg.units.economy.coinValue;

    if (careful && w.hp[hero] / w.maxHp[hero] < RETREAT_HP) return this.setGoal(homeX, homeY);

    // Cheapest pad that can be finished with the gold in hand.
    let pad = null;
    for (const p of w.pads) {
      if (!padUsable(w, p)) continue;
      const funds = w.eco.stackCoins * coinValue + (p.type === 'keep' ? w.eco.bank : 0);
      if (funds < p.cost - p.paid) continue;
      if (!pad || p.cost - p.paid < pad.cost - pad.paid) pad = p;
    }
    if (pad) return this.setGoal(pad.x, pad.y);

    // Otherwise the nearest loot on the ground.
    let best = -1;
    let bestDist = Infinity;
    for (let e = 0; e < w.highWater; e++) {
      const kind = w.kind[e];
      if (kind !== Kind.Coin && kind !== Kind.Chest) continue;
      if (kind === Kind.Coin && w.state[e] !== CoinState.Idle) continue;
      if (careful && this.dangerAt(w.x[e], w.y[e])) continue;
      const dist = Math.hypot(w.x[e] - w.x[hero], w.y[e] - w.y[hero]);
      if (dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    if (best >= 0) return this.setGoal(w.x[best], w.y[best]);
    this.setGoal(homeX, homeY);
  }

  private dangerAt(x: number, y: number): boolean {
    const w = this.w;
    for (let e = 0; e < w.highWater; e++) {
      if (w.kind[e] !== Kind.Enemy || (w.mask[e] & C.Health) === 0) continue;
      if (Math.hypot(w.x[e] - x, w.y[e] - y) < DANGER_RADIUS + w.radius[e]) return true;
    }
    return false;
  }

  private setGoal(x: number, y: number): void {
    this.goal.x = x;
    this.goal.y = y;
  }
}

export interface BotRun {
  outcome: World['outcome'];
  timeSec: number;
  kills: number;
  keepHp: number;
  kingHp: number;
  archers: number;
  gold: number;
}

/** Plays a world to its end (or `maxSec`) with the given bot style. */
export function playBot(w: World, style: BotStyle, maxSec = 900): BotRun {
  const bot = new Bot(w, style);
  for (let i = 0; i < maxSec * 60 && w.outcome === 'playing'; i++) {
    bot.act();
    step(w);
  }
  return {
    outcome: w.outcome,
    timeSec: Math.round(w.time),
    kills: w.stats.kills,
    keepHp: Math.round((w.hp[w.keep] / w.maxHp[w.keep]) * 100),
    kingHp: Math.round(w.hp[w.hero]),
    archers: w.archersAlive,
    gold: w.eco.goldEarned,
  };
}
