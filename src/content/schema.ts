import { z } from 'zod';

/**
 * Zod schemas for every content file. Content is data (SPEC §4): the build and
 * the unit tests fail if any JSON file does not match these shapes.
 */

const vec2 = z.tuple([z.number(), z.number()]);
const rect = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
const id = z.string().min(1);
const positive = z.number().positive();
const count = z.number().int().nonnegative();

export const difficultySchema = z.enum(['easy', 'normal', 'hard']);
export const padTypeSchema = z.enum(['tower', 'forge', 'repair', 'keep', 'brazier', 'gate']);
export const enemyModelSchema = z.enum(['raider', 'brute', 'giant', 'chieftain']);

// ── units.json ───────────────────────────────────────────────────────────────

const shooterTier = z.object({
  hp: positive,
  damage: positive,
  attackInterval: positive,
  range: positive,
});

const enemySchema = z.object({
  model: enemyModelSchema,
  scale: positive.default(1),
  hp: positive,
  damage: positive,
  attackInterval: positive,
  range: positive,
  speed: positive,
  radius: positive,
  coins: count,
  scoreBonus: count.default(0),
  knockback: z.number().nonnegative().default(0),
  staggerHits: count.default(0),
  boss: z.boolean().default(false),
  slam: z.object({ every: positive, radius: positive, damage: positive }).optional(),
  summon: z.object({ type: id, count: count, every: positive }).optional(),
});

export const unitsSchema = z.object({
  king: z.object({
    hp: positive,
    speed: positive,
    radius: positive,
    iframesSec: positive,
    regenPerSec: positive,
    regenDelaySec: positive,
    magnetRadius: positive,
    dashSpeedMult: positive,
    dashSec: positive,
    dashCooldownSec: positive,
  }),
  archer: z.object({
    speed: positive,
    radius: positive,
    arrowSpeed: positive,
    ringRadius: positive,
    tiers: z.array(shooterTier).length(3),
  }),
  tower: z.object({ radius: positive, tiers: z.array(shooterTier).length(3) }),
  enemies: z.record(id, enemySchema),
  fence: z.object({ hp: positive }),
  keep: z.object({ hp: positive, hpPerTier: z.number().nonnegative(), archersPerTier: count }),
  economy: z.object({
    coinValue: positive,
    coinLifetimeSec: positive,
    coinBlinkSec: positive,
    padDrawPerSec: positive,
    repeatCostMult: positive,
    gearLifetimeSec: positive,
    coinCapPerKeepTier: count,
    maxCoinCap: count,
    maxKeepTier: count,
  }),
  difficulty: z.record(
    difficultySchema,
    z.object({ enemyHpMult: positive, coinCapDelta: z.number().int() }),
  ),
});

// ── maps/*.json ──────────────────────────────────────────────────────────────

export const mapSchema = z.object({
  id,
  name: z.string(),
  size: z.object({ w: positive, h: positive }),
  cameraBounds: rect,
  ground: z.object({
    base: z.enum(['grass', 'dirt']),
    patches: z.array(rect.extend({ type: z.enum(['grass', 'dirt', 'cliff', 'water']) })),
  }),
  blockers: z.object({
    /** Palisade segments: axis-aligned, destructible, repairable. */
    fences: z.array(z.object({ id, a: vec2, b: vec2 })),
    /** Impassable rectangles (cliffs, water, building footprints). */
    walls: z.array(rect),
    rocks: z.array(z.object({ pos: vec2, r: positive })),
    trees: z.array(vec2),
    buildings: z.array(z.object({ type: z.enum(['forge', 'archery', 'brazier']), pos: vec2 })),
  }),
  plots: z.array(z.object({ id, pos: vec2 })),
  pads: z.array(z.object({ id, type: padTypeSchema, pos: vec2, plot: id.optional() })),
  paths: z.array(z.object({ id, points: z.array(vec2).min(2), targetFence: id })),
  heroStart: vec2,
  keep: rect,
});

// ── levels/*.json ────────────────────────────────────────────────────────────

const waveSchema = z.object({
  /** Seconds since level start, or "prevCleared+N" for reactive pacing. */
  at: z.union([z.number().nonnegative(), z.string().regex(/^prevCleared\+\d+(\.\d+)?$/)]),
  path: id,
  groups: z
    .array(
      z.object({
        type: id,
        count: z.number().int().positive(),
        interval: z.number().nonnegative(),
        delay: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
});

/**
 * Tutorial hints fire in order, each when its trigger first becomes true:
 * `start`, `gearCarried`, `fenceDamaged`, `gold>=N`, `wave>=N`, `padPaid:<type>`.
 */
const TUTORIAL_TRIGGER =
  /^(start|gearCarried|fenceDamaged|gold>=\d+|wave>=\d+|padPaid:(tower|forge|repair|keep|brazier|gate))$/;

export const levelSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  map: id,
  startGold: count,
  parTimeSec: positive,
  coinCap: count,
  night: z.boolean().default(false),
  dash: z.boolean().default(false),
  maxArcherTier: z.number().int().min(0).max(2).default(1),
  maxTowerTier: z.number().int().min(1).max(3).default(1),
  coinDespawnSec: positive.optional(),
  squad: z.object({ archers: count, tier: z.number().int().min(0).max(2) }),
  pads: z.array(
    z.object({
      type: padTypeSchema,
      plot: id.optional(),
      cost: positive,
      produces: z.object({ gear: z.number().int().positive() }).optional(),
    }),
  ),
  looseCoins: z.array(z.object({ pos: vec2, count: z.number().int().positive() })).default([]),
  chests: z.array(z.object({ pos: vec2, coins: z.number().int().positive() })).default([]),
  waves: z.array(waveSchema).min(1),
  tutorial: z
    .array(
      z.object({
        trigger: z.string().regex(TUTORIAL_TRIGGER),
        text: z.string().min(1),
        pointAt: z
          .string()
          .regex(/^pad:[\w-]+$/)
          .optional(),
      }),
    )
    .default([]),
});

export type Difficulty = z.infer<typeof difficultySchema>;
export type PadType = z.infer<typeof padTypeSchema>;
export type EnemyModel = z.infer<typeof enemyModelSchema>;
export type EnemyDef = z.infer<typeof enemySchema>;
export type UnitsDef = z.infer<typeof unitsSchema>;
export type MapDef = z.infer<typeof mapSchema>;
export type LevelDef = z.infer<typeof levelSchema>;
export type WaveDef = z.infer<typeof waveSchema>;

/**
 * Cross-file checks a single schema cannot express: every id a level refers to
 * must exist in its map and in units.json. Returns a list of problems.
 */
export function crossValidateLevel(level: LevelDef, map: MapDef, units: UnitsDef): string[] {
  const problems: string[] = [];
  const pathIds = new Set(map.paths.map((p) => p.id));
  const fenceIds = new Set(map.blockers.fences.map((f) => f.id));
  const plotIds = new Set(map.plots.map((p) => p.id));

  for (const path of map.paths) {
    if (!fenceIds.has(path.targetFence)) {
      problems.push(`map ${map.id}: path "${path.id}" targets unknown fence "${path.targetFence}"`);
    }
  }
  for (const pad of map.pads) {
    if (pad.plot !== undefined && !plotIds.has(pad.plot)) {
      problems.push(`map ${map.id}: pad "${pad.id}" refers to unknown plot "${pad.plot}"`);
    }
  }
  for (const pad of level.pads) {
    const match = map.pads.some((m) => m.type === pad.type && m.plot === pad.plot);
    if (!match) {
      problems.push(
        `level ${level.id}: no ${pad.type} pad${pad.plot ? ` on plot "${pad.plot}"` : ''} in map ${map.id}`,
      );
    }
  }
  for (const hint of level.tutorial) {
    if (!hint.pointAt) continue;
    const padId = hint.pointAt.slice('pad:'.length);
    const mapPad = map.pads.find((m) => m.id === padId);
    const enabled =
      mapPad && level.pads.some((p) => p.type === mapPad.type && p.plot === mapPad.plot);
    if (!enabled)
      problems.push(
        `level ${level.id}: tutorial points at "${hint.pointAt}", which is not enabled`,
      );
  }
  level.waves.forEach((wave, i) => {
    if (!pathIds.has(wave.path))
      problems.push(`level ${level.id}: wave ${i} uses unknown path "${wave.path}"`);
    if (i === 0 && typeof wave.at === 'string') {
      problems.push(`level ${level.id}: the first wave cannot be reactive`);
    }
    for (const group of wave.groups) {
      if (!(group.type in units.enemies)) {
        problems.push(`level ${level.id}: wave ${i} spawns unknown enemy "${group.type}"`);
      }
    }
  });
  for (const enemy of Object.values(units.enemies)) {
    if (enemy.summon && !(enemy.summon.type in units.enemies)) {
      problems.push(`units: summon refers to unknown enemy "${enemy.summon.type}"`);
    }
  }
  return problems;
}
