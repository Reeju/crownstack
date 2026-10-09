/**
 * Fixed-capacity event buffer, refilled every simulation step. The renderer,
 * audio and UI drain it after each step; the simulation never reads it.
 */

export const Ev = {
  CoinPicked: 1,
  /** One coin left the stack for a pad. a = pad index. */
  PadCoin: 2,
  /** A pad filled and triggered. a = pad index. */
  PadPaid: 3,
  /** a = enemy def index, b = 1 for bosses and giants. */
  EnemyKilled: 4,
  /** a = amount, b = entity kind that was hit. */
  Damage: 5,
  ArrowFired: 6,
  /** a = wave index, b = path index. */
  WaveAnnounced: 7,
  WaveStarted: 8,
  LevelWon: 9,
  LevelLost: 10,
  /** A heavy (knockback) hit landed: screen shake + haptics. */
  HeavyHit: 11,
  GearForged: 12,
  GearDelivered: 13,
  UnitDied: 14,
  FenceBroken: 15,
  CoinDropped: 16,
  Dash: 17,
  /** Boss ground slam. a = radius. */
  Slam: 18,
  ChestOpened: 19,
  KingHit: 20,
  /** All enemies dead after the final wave; the celebration starts. */
  WavesCleared: 21,
} as const;
export type EvType = (typeof Ev)[keyof typeof Ev];

const CAPACITY = 256;

export interface EventBuffer {
  count: number;
  readonly type: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly a: Float32Array;
  readonly b: Float32Array;
}

export function createEventBuffer(): EventBuffer {
  return {
    count: 0,
    type: new Uint8Array(CAPACITY),
    x: new Float32Array(CAPACITY),
    y: new Float32Array(CAPACITY),
    a: new Float32Array(CAPACITY),
    b: new Float32Array(CAPACITY),
  };
}

/** Appends an event; silently drops it if the buffer is full (events are cosmetic). */
export function emit(buf: EventBuffer, type: EvType, x = 0, y = 0, a = 0, b = 0): void {
  if (buf.count >= CAPACITY) return;
  const i = buf.count++;
  buf.type[i] = type;
  buf.x[i] = x;
  buf.y[i] = y;
  buf.a[i] = a;
  buf.b[i] = b;
}
