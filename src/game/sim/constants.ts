/** Tuning constants that are not per-unit stats (those live in content/units.json). */

export const FENCE_HALF_THICKNESS = 0.2;
export const PAD_RADIUS = 1.1;
/** Seconds the king must stand on a pad before coins start flowing. */
export const PAD_DWELL_SEC = 0.45;
export const COIN_RADIUS = 0.25;
export const COIN_PICKUP_DELAY_SEC = 0.3;
export const COIN_ATTRACT_SPEED = 14;
export const CHEST_RADIUS = 0.6;
export const GEAR_HANDOUT_RADIUS = 2.2;
export const GEAR_HANDOUT_INTERVAL_SEC = 0.15;
export const KNOCK_DECAY = 0.8;
export const AGGRO_RADIUS = 2.5;
export const SEPARATION_RADIUS = 0.5;
export const ARROW_LIFETIME_SEC = 1.5;
export const HIT_FLASH_SEC = 0.12;
export const STAGGER_SEC = 1.5;
export const CELEBRATION_SEC = 1.5;
export const WAVE_ANNOUNCE_SEC = 3;
export const NIGHT_TOWER_RANGE_MULT = 0.8;
export const SPATIAL_CELL = 2;

/** Half extents of building footprints, shared by collision and rendering. */
export const BUILDING_HALF = {
  forge: [1.3, 1.0],
  archery: [1.4, 1.1],
  brazier: [0.4, 0.4],
} as const satisfies Record<string, readonly [number, number]>;
