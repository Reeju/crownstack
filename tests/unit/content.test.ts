import { describe, expect, it } from 'vitest';

import { levels, maps, units, validateContent } from '../../src/content';
import { levelSchema } from '../../src/content/schema';

describe('content', () => {
  it('parses every level, map and the unit table', () => {
    expect(levels.length).toBeGreaterThan(0);
    expect(maps.size).toBeGreaterThan(0);
    expect(units.enemies.raider.hp).toBe(20);
  });

  it('has consecutive level ids starting at 1', () => {
    expect(levels.map((l) => l.id)).toEqual(levels.map((_, i) => i + 1));
  });

  it('has no dangling references between levels, maps and units', () => {
    expect(validateContent()).toEqual([]);
  });

  it('rejects malformed level JSON', () => {
    expect(() => levelSchema.parse({ id: 1, name: 'Broken' })).toThrow();
    expect(() => levelSchema.parse({ ...levels[0], waves: [] })).toThrow();
  });
});
