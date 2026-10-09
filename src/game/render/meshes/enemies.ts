import type { BufferGeometry } from 'three';

import type { EnemyModel } from '../../../content/schema';
import { ball, box, cone, cyl, mergeParts } from '../geometry';
import { PALETTE } from '../palette';

function raiderGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.13, 0.26, 0.12), color: PALETTE.dark, at: [0, 0.13, -0.1] },
    { geo: box(0.13, 0.26, 0.12), color: PALETTE.dark, at: [0, 0.13, 0.1] },
    { geo: cyl(0.2, 0.26, 0.46), color: PALETTE.enemyRed, at: [0, 0.49, 0] },
    { geo: ball(0.18), color: PALETTE.skin, at: [0, 0.86, 0] },
    { geo: cyl(0.2, 0.2, 0.1, 6), color: PALETTE.enemyDark, at: [0, 0.99, 0] },
    { geo: cone(0.05, 0.2, 4), color: PALETTE.white, at: [0, 1.08, -0.16] },
    { geo: cone(0.05, 0.2, 4), color: PALETTE.white, at: [0, 1.08, 0.16] },
    { geo: box(0.5, 0.08, 0.08), color: PALETTE.woodDark, at: [0.32, 0.55, 0.24] },
  ]);
}

function bruteGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.18, 0.3, 0.16), color: PALETTE.dark, at: [0, 0.15, -0.15] },
    { geo: box(0.18, 0.3, 0.16), color: PALETTE.dark, at: [0, 0.15, 0.15] },
    { geo: cyl(0.3, 0.38, 0.62), color: PALETTE.enemyDark, at: [0, 0.6, 0] },
    { geo: ball(0.22), color: PALETTE.skin, at: [0, 1.08, 0] },
    { geo: cyl(0.25, 0.23, 0.14, 6), color: PALETTE.dark, at: [0, 1.24, 0] },
    {
      geo: cyl(0.34, 0.34, 0.07, 8),
      color: PALETTE.stoneDark,
      at: [0.34, 0.62, -0.1],
      rot: [0, 0, Math.PI / 2],
    },
    { geo: box(0.66, 0.1, 0.1), color: PALETTE.woodDark, at: [0.36, 0.7, 0.36] },
  ]);
}

function giantGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.34, 0.5, 0.3), color: PALETTE.enemyDark, at: [0, 0.25, -0.3] },
    { geo: box(0.34, 0.5, 0.3), color: PALETTE.enemyDark, at: [0, 0.25, 0.3] },
    { geo: ball(0.78), color: PALETTE.giantPink, at: [0, 1.15, 0], scale: [1, 1.1, 1.1] },
    { geo: ball(0.34), color: PALETTE.giantPink, at: [0.12, 2.15, 0] },
    { geo: box(0.3, 0.9, 0.3), color: PALETTE.giantPink, at: [0.1, 1.05, -0.95] },
    { geo: box(0.3, 0.9, 0.3), color: PALETTE.giantPink, at: [0.1, 1.05, 0.95] },
    {
      geo: cyl(0.2, 0.12, 1.3, 6),
      color: PALETTE.woodDark,
      at: [0.55, 0.9, 1.0],
      rot: [0, 0, -1.1],
    },
    { geo: box(0.3, 0.1, 0.36), color: PALETTE.dark, at: [0.36, 2.22, 0] },
  ]);
}

function chieftainGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.4, 0.6, 0.36), color: PALETTE.dark, at: [0, 0.3, -0.36] },
    { geo: box(0.4, 0.6, 0.36), color: PALETTE.dark, at: [0, 0.3, 0.36] },
    { geo: cyl(0.75, 0.95, 1.5, 8), color: PALETTE.enemyDark, at: [0, 1.35, 0] },
    { geo: box(0.16, 1.5, 1.5), color: PALETTE.enemyRed, at: [-0.8, 1.3, 0] },
    { geo: ball(0.42), color: PALETTE.skin, at: [0.08, 2.5, 0] },
    { geo: cone(0.13, 0.7, 5), color: PALETTE.white, at: [0, 3.0, -0.42], rot: [0.5, 0, 0] },
    { geo: cone(0.13, 0.7, 5), color: PALETTE.white, at: [0, 3.0, 0.42], rot: [-0.5, 0, 0] },
    {
      geo: cyl(0.3, 0.16, 1.9, 6),
      color: PALETTE.woodDark,
      at: [0.7, 1.3, 1.15],
      rot: [0, 0, -1.0],
    },
  ]);
}

export const ENEMY_MODELS: readonly EnemyModel[] = ['raider', 'brute', 'giant', 'chieftain'];

export const ENEMY_GEOMETRY: Record<EnemyModel, () => BufferGeometry> = {
  raider: raiderGeometry,
  brute: bruteGeometry,
  giant: giantGeometry,
  chieftain: chieftainGeometry,
};

/** Model height in world units, for placing HP bars. */
export const ENEMY_HEIGHT: Record<EnemyModel, number> = {
  raider: 1.2,
  brute: 1.4,
  giant: 2.6,
  chieftain: 3.4,
};

/** Small enemies are drawn enlarged like the player's units; big ones are already readable. */
export const ENEMY_VISUAL_SCALE: Record<EnemyModel, number> = {
  raider: 1.5,
  brute: 1.5,
  giant: 1.15,
  chieftain: 1.1,
};

export function arrowGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.7, 0.05, 0.05), color: PALETTE.woodDark },
    { geo: box(0.14, 0.1, 0.1), color: PALETTE.white, at: [0.36, 0, 0] },
  ]);
}
