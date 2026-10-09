import {
  crossValidateLevel,
  levelSchema,
  mapSchema,
  unitsSchema,
  type LevelDef,
  type MapDef,
  type UnitsDef,
} from './schema';
import unitsJson from './units.json';

const levelFiles = import.meta.glob('./levels/*.json', { eager: true, import: 'default' });
const mapFiles = import.meta.glob('./maps/*.json', { eager: true, import: 'default' });

export const units: UnitsDef = unitsSchema.parse(unitsJson);

export const maps: ReadonlyMap<string, MapDef> = new Map(
  Object.values(mapFiles).map((raw) => {
    const map = mapSchema.parse(raw);
    return [map.id, map];
  }),
);

export const levels: readonly LevelDef[] = Object.values(levelFiles)
  .map((raw) => levelSchema.parse(raw))
  .sort((a, b) => a.id - b.id);

export function getLevel(levelId: number): LevelDef {
  const level = levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`Unknown level ${levelId}`);
  return level;
}

export function getMap(mapId: string): MapDef {
  const map = maps.get(mapId);
  if (!map) throw new Error(`Unknown map "${mapId}"`);
  return map;
}

/** Every cross-file problem in the shipped content (empty when the content is sound). */
export function validateContent(): string[] {
  return levels.flatMap((level) => {
    const map = maps.get(level.map);
    return map
      ? crossValidateLevel(level, map, units)
      : [`level ${level.id}: unknown map "${level.map}"`];
  });
}
