import { BACKUP_KEY, defaultSave, saveSchema, type SaveV1 } from './save';

/** One function per old version, each returning the next version's shape. */
const MIGRATIONS: Record<number, (old: unknown) => unknown> = {
  // 1 -> 2 will go here when the save format changes.
};

const CURRENT_VERSION = 1;

/**
 * Brings a stored save up to the current version. A save that cannot be
 * understood (unknown version, corrupt data) is backed up verbatim to
 * localStorage and replaced with defaults (SPEC §6.4).
 */
export function migrate(raw: unknown): SaveV1 {
  if (raw === undefined || raw === null) return defaultSave();

  let data: unknown = raw;
  let version = typeof raw === 'object' ? (raw as { version?: unknown }).version : undefined;
  while (typeof version === 'number' && version < CURRENT_VERSION && MIGRATIONS[version]) {
    data = MIGRATIONS[version](data);
    version = (data as { version?: unknown }).version;
  }

  const parsed = saveSchema.safeParse(data);
  if (parsed.success) return parsed.data;

  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(raw));
  } catch {
    // Nothing more can be done if storage is unavailable.
  }
  return defaultSave();
}
