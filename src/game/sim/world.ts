import type {
  Difficulty,
  EnemyDef,
  LevelDef,
  MapDef,
  PadType,
  UnitsDef,
} from '../../content/schema';
import { MAX_ENTITIES, NO_ENTITY } from './components';
import { createEventBuffer, type EventBuffer } from './events';
import type { PathData } from './pathing';
import { Rng } from './rng';
import { createSpatialHash, type SpatialHash } from './spatial';
import type { WaveState } from './waves';

/** Player input for one step, in world space. `move` has length <= 1. */
export interface Intent {
  moveX: number;
  moveY: number;
  dash: boolean;
}

/** Bonuses bought with crowns on the upgrades screen (SPEC §4.4). */
export interface MetaBonuses {
  coinCap: number;
  kingHp: number;
  extraArchers: number;
  towerCostMult: number;
  magnetRadius: number;
}

export const NO_META: MetaBonuses = {
  coinCap: 0,
  kingHp: 0,
  extraArchers: 0,
  towerCostMult: 1,
  magnetRadius: 0,
};

/** Everything that defines a run. Same config + same intents = same run. */
export interface RunConfig {
  level: LevelDef;
  map: MapDef;
  units: UnitsDef;
  seed: number;
  difficulty: Difficulty;
  meta: MetaBonuses;
}

export interface PadState {
  readonly id: string;
  readonly type: PadType;
  readonly x: number;
  readonly y: number;
  /** Index into `world.plots` for tower pads, otherwise -1. */
  readonly plot: number;
  readonly baseCost: number;
  /** Price multiplier from meta upgrades (1 = none). */
  readonly discount: number;
  readonly gear: number;
  cost: number;
  paid: number;
  active: boolean;
  /** True while the king is streaming coins into this pad (render hint). */
  paying: boolean;
  /** Seconds the king has stood on the pad; payment starts after a short dwell. */
  dwell: number;
  /** Fractional gold owed by the draw-rate accumulator. */
  drawAcc: number;
  /** Set when the pad triggers; it takes no more coins until the king steps off. */
  latched: boolean;
}

export interface PlotState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** 0 = empty, otherwise the tower tier standing on it. */
  tier: number;
  tower: number;
}

export interface StaticBox {
  readonly x: number;
  readonly y: number;
  readonly hw: number;
  readonly hh: number;
}

export interface StaticCircle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export type Outcome = 'playing' | 'won' | 'lost';

export interface World {
  readonly cfg: RunConfig;
  readonly rng: Rng;
  readonly intent: Intent;
  readonly events: EventBuffer;
  readonly enemyDefs: readonly EnemyDef[];
  readonly enemyDefIndex: ReadonlyMap<string, number>;
  readonly paths: readonly PathData[];
  /** Entity id of the fence or gate each path crosses on its way to the keep. */
  readonly pathTargets: Int32Array;
  readonly walls: readonly StaticBox[];
  readonly rocks: readonly StaticCircle[];
  readonly pads: PadState[];
  readonly plots: PlotState[];
  /** Palisade segments (repairable). */
  readonly fences: Int32Array;
  /** Gate segments: open (0 HP) until a gate pad closes them. */
  readonly gates: Int32Array;
  /** Fences followed by gates: everything that can block movement and be attacked. */
  readonly barriers: Int32Array;
  readonly waves: WaveState[];
  /** Living enemies, rebuilt every step. */
  readonly enemyHash: SpatialHash;
  /** The king and squad archers, rebuilt every step. */
  readonly friendHash: SpatialHash;

  tick: number;
  time: number;
  outcome: Outcome;
  /** Seconds left of the win celebration; < 0 when not celebrating. */
  celebrate: number;
  hero: number;
  keep: number;
  enemiesAlive: number;
  archersAlive: number;
  /** Number of waves that have started (for the HUD wave counter). */
  wavesStarted: number;

  readonly king: {
    iframes: number;
    sinceHit: number;
    dashTime: number;
    dashCooldown: number;
    dashX: number;
    dashY: number;
    dashHeld: boolean;
  };

  /** The king's coin stack, the bank and carried forge gear. */
  readonly eco: {
    stackCoins: number;
    bank: number;
    coinCap: number;
    gear: number;
    gearTimer: number;
    gearHandoutTimer: number;
    keepTier: number;
    brazierLit: boolean;
    /** Seconds the gates stay closed; <= 0 means they are open. */
    gateTimer: number;
    goldEarned: number;
    purchases: Record<PadType, number>;
  };

  readonly stats: { kills: number; bonusScore: number; rewardGold: number };

  // ── Entity pool (struct of arrays) ──
  highWater: number;
  freeCount: number;
  readonly freeList: Int32Array;
  readonly mask: Uint16Array;
  readonly kind: Uint8Array;
  readonly team: Uint8Array;
  readonly gen: Uint16Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Position at the start of the step, for render interpolation. */
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** Knockback velocity, decays quickly. */
  readonly kx: Float32Array;
  readonly ky: Float32Array;
  readonly facing: Float32Array;
  readonly radius: Float32Array;
  readonly hw: Float32Array;
  readonly hh: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly damage: Float32Array;
  readonly atkInterval: Float32Array;
  readonly atkRange: Float32Array;
  readonly cooldown: Float32Array;
  readonly target: Int32Array;
  readonly targetGen: Uint16Array;
  /** Enemy def index, archer/tower tier, or owning plot. */
  readonly def: Int16Array;
  readonly state: Uint8Array;
  readonly pathId: Int8Array;
  readonly pathS: Float32Array;
  readonly pathOff: Float32Array;
  /** Lifetime (coins, arrows) or ability timer (bosses). */
  readonly timer: Float32Array;
  readonly timer2: Float32Array;
  readonly value: Int32Array;
  readonly slot: Int16Array;
  /** Seconds of hit flash remaining (render hint). */
  readonly flash: Float32Array;
  readonly hits: Uint16Array;
  readonly stun: Float32Array;
}

export function createEmptyWorld(
  cfg: RunConfig,
  statics: Pick<World, 'paths' | 'walls' | 'rocks' | 'pads' | 'plots' | 'waves'> & {
    fenceCount: number;
    gateCount: number;
  },
): World {
  const n = MAX_ENTITIES;
  const enemyIds = Object.keys(cfg.units.enemies);
  const f32 = () => new Float32Array(n);
  return {
    cfg,
    rng: new Rng(cfg.seed),
    intent: { moveX: 0, moveY: 0, dash: false },
    events: createEventBuffer(),
    enemyDefs: enemyIds.map((id) => cfg.units.enemies[id]),
    enemyDefIndex: new Map(enemyIds.map((id, i) => [id, i])),
    paths: statics.paths,
    pathTargets: new Int32Array(statics.paths.length).fill(NO_ENTITY),
    walls: statics.walls,
    rocks: statics.rocks,
    pads: statics.pads,
    plots: statics.plots,
    fences: new Int32Array(statics.fenceCount).fill(NO_ENTITY),
    gates: new Int32Array(statics.gateCount).fill(NO_ENTITY),
    barriers: new Int32Array(statics.fenceCount + statics.gateCount).fill(NO_ENTITY),
    waves: statics.waves,
    enemyHash: createSpatialHash(cfg.map.size.w, cfg.map.size.h, n),
    friendHash: createSpatialHash(cfg.map.size.w, cfg.map.size.h, n),
    tick: 0,
    time: 0,
    outcome: 'playing',
    celebrate: -1,
    hero: NO_ENTITY,
    keep: NO_ENTITY,
    enemiesAlive: 0,
    archersAlive: 0,
    wavesStarted: 0,
    king: {
      iframes: 0,
      sinceHit: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashX: 0,
      dashY: 0,
      dashHeld: false,
    },
    eco: {
      stackCoins: 0,
      bank: 0,
      coinCap: 0,
      gear: 0,
      gearTimer: 0,
      gearHandoutTimer: 0,
      keepTier: 0,
      brazierLit: false,
      gateTimer: 0,
      goldEarned: 0,
      purchases: { tower: 0, forge: 0, repair: 0, keep: 0, brazier: 0, gate: 0 },
    },
    stats: { kills: 0, bonusScore: 0, rewardGold: 0 },
    highWater: 0,
    freeCount: 0,
    freeList: new Int32Array(n),
    mask: new Uint16Array(n),
    kind: new Uint8Array(n),
    team: new Uint8Array(n),
    gen: new Uint16Array(n),
    x: f32(),
    y: f32(),
    px: f32(),
    py: f32(),
    vx: f32(),
    vy: f32(),
    kx: f32(),
    ky: f32(),
    facing: f32(),
    radius: f32(),
    hw: f32(),
    hh: f32(),
    hp: f32(),
    maxHp: f32(),
    damage: f32(),
    atkInterval: f32(),
    atkRange: f32(),
    cooldown: f32(),
    target: new Int32Array(n).fill(NO_ENTITY),
    targetGen: new Uint16Array(n),
    def: new Int16Array(n),
    state: new Uint8Array(n),
    pathId: new Int8Array(n),
    pathS: f32(),
    pathOff: f32(),
    timer: f32(),
    timer2: f32(),
    value: new Int32Array(n),
    slot: new Int16Array(n),
    flash: f32(),
    hits: new Uint16Array(n),
    stun: f32(),
  };
}

/** Allocates an entity id with every field zeroed, or NO_ENTITY if the pool is full. */
export function alloc(w: World, kind: number, mask: number, team: number): number {
  let e: number;
  if (w.freeCount > 0) e = w.freeList[--w.freeCount];
  else if (w.highWater < MAX_ENTITIES) e = w.highWater++;
  else return NO_ENTITY;

  w.mask[e] = mask;
  w.kind[e] = kind;
  w.team[e] = team;
  w.x[e] = w.y[e] = w.px[e] = w.py[e] = 0;
  w.vx[e] = w.vy[e] = w.kx[e] = w.ky[e] = 0;
  w.facing[e] = 0;
  w.radius[e] = w.hw[e] = w.hh[e] = 0;
  w.hp[e] = w.maxHp[e] = 0;
  w.damage[e] = w.atkInterval[e] = w.atkRange[e] = w.cooldown[e] = 0;
  w.target[e] = NO_ENTITY;
  w.targetGen[e] = 0;
  w.def[e] = 0;
  w.state[e] = 0;
  w.pathId[e] = 0;
  w.pathS[e] = w.pathOff[e] = 0;
  w.timer[e] = w.timer2[e] = 0;
  w.value[e] = 0;
  w.slot[e] = 0;
  w.flash[e] = 0;
  w.hits[e] = 0;
  w.stun[e] = 0;
  return e;
}

export function free(w: World, e: number): void {
  if (w.kind[e] === 0) return;
  w.mask[e] = 0;
  w.kind[e] = 0;
  w.team[e] = 0;
  w.gen[e] = (w.gen[e] + 1) & 0xffff;
  w.freeList[w.freeCount++] = e;
}

/** Places an entity and snaps its interpolation history to the same point. */
export function place(w: World, e: number, x: number, y: number): void {
  w.x[e] = w.px[e] = x;
  w.y[e] = w.py[e] = y;
}

/** True if `e` still refers to the entity that was targeted (ids are recycled). */
export function targetValid(w: World, owner: number): boolean {
  const t = w.target[owner];
  return t !== NO_ENTITY && w.gen[t] === w.targetGen[owner] && w.hp[t] > 0;
}

export function setTarget(w: World, owner: number, t: number): void {
  w.target[owner] = t;
  w.targetGen[owner] = t === NO_ENTITY ? 0 : w.gen[t];
}
