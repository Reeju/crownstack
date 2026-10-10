import { get, set } from 'idb-keyval';
import { z } from 'zod';

import { difficultySchema } from '../content/schema';

/** Persisted player data (SPEC §6.4). Bump `version` and add a migration when the shape changes. */
export const saveSchema = z.object({
  version: z.literal(1),
  levels: z.record(
    z.string(),
    z.object({
      crowns: z.number().int().min(0).max(3),
      bestScore: z.object({ easy: z.number(), normal: z.number(), hard: z.number() }),
      cleared: z.boolean(),
    }),
  ),
  crownsSpent: z.number().int().nonnegative(),
  upgrades: z.record(z.string(), z.number().int().nonnegative()),
  settings: z.object({
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    haptics: z.boolean(),
    reducedMotion: z.boolean(),
    colorBlind: z.boolean(),
    difficulty: difficultySchema,
    /** Render quality; added after the first release, hence the default. */
    quality: z.enum(['auto', 'low', 'high']).default('auto'),
  }),
  stats: z.object({
    kills: z.number().nonnegative(),
    goldEarned: z.number().nonnegative(),
    playtimeSec: z.number().nonnegative(),
  }),
});

export type SaveV1 = z.infer<typeof saveSchema>;
export type Settings = SaveV1['settings'];
export type LevelRecord = SaveV1['levels'][string];

export const SAVE_KEY = 'crownstack.save';
export const BACKUP_KEY = 'crownstack.backup';

export function defaultSave(): SaveV1 {
  const prefersReducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1,
    levels: {},
    crownsSpent: 0,
    upgrades: {},
    settings: {
      music: 0.6,
      sfx: 0.8,
      haptics: true,
      reducedMotion: prefersReducedMotion,
      colorBlind: false,
      difficulty: 'normal',
      quality: 'auto',
    },
    stats: { kills: 0, goldEarned: 0, playtimeSec: 0 },
  };
}

/**
 * A synchronous copy of the newest save. IndexedDB writes are asynchronous and
 * can be lost if the page closes right after a change; this copy cannot.
 */
const PENDING_KEY = 'crownstack.save.pending';

function readLocal(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Reads the raw save: an unflushed write first, then IndexedDB, then the localStorage fallback. */
export async function readRawSave(): Promise<unknown> {
  const pending = readLocal(PENDING_KEY);
  if (pending !== undefined) return pending;
  try {
    const stored = await get<unknown>(SAVE_KEY);
    if (stored !== undefined) return stored;
  } catch {
    // IndexedDB is unavailable (private mode, blocked storage): fall through.
  }
  return readLocal(SAVE_KEY);
}

/** Writes the save to IndexedDB, falling back to localStorage if that fails. */
export async function writeSave(save: SaveV1): Promise<void> {
  const json = JSON.stringify(save);
  try {
    localStorage.setItem(PENDING_KEY, json);
  } catch {
    // Storage is full or blocked; IndexedDB below is still worth trying.
  }
  try {
    await set(SAVE_KEY, save);
    // Only clear the copy if no newer write has replaced it meanwhile.
    if (localStorage.getItem(PENDING_KEY) === json) localStorage.removeItem(PENDING_KEY);
  } catch {
    try {
      localStorage.setItem(SAVE_KEY, json);
      localStorage.removeItem(PENDING_KEY);
    } catch {
      // Nothing persists this session.
    }
  }
}
