/**
 * Component and entity-kind constants for the struct-of-arrays ECS in world.ts.
 *
 * Per-entity components are bit flags in `world.mask`; their data lives in the
 * parallel typed arrays on the world. The `Stack` (coins and gear carried by
 * the king) and `Pad` components from SPEC §6.3 are singletons / a handful of
 * static objects, so they live on `world.eco` and `world.pads` instead.
 */

export const DT = 1 / 60;
export const MAX_ENTITIES = 1024;

export const C = {
  Transform: 1 << 0,
  Velocity: 1 << 1,
  Health: 1 << 2,
  Attack: 1 << 3,
  PathFollower: 1 << 4,
  Squad: 1 << 5,
  Lifetime: 1 << 6,
  Loot: 1 << 7,
  /** Shape is an axis-aligned box (hw, hh) instead of a circle (radius). */
  Box: 1 << 8,
} as const;

export const Kind = {
  None: 0,
  King: 1,
  Archer: 2,
  Tower: 3,
  Enemy: 4,
  Coin: 5,
  Arrow: 6,
  Fence: 7,
  Keep: 8,
  Chest: 9,
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

export const Team = { Neutral: 0, Player: 1, Enemy: 2 } as const;

/** Values of `world.state` for enemies. */
export const EnemyState = { Path: 0, Siege: 1 } as const;

/** Values of `world.state` for coins. */
export const CoinState = { Idle: 0, Attracted: 1 } as const;

export const NO_ENTITY = -1;
