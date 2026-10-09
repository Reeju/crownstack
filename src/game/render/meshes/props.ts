import { CylinderGeometry, type BufferGeometry } from 'three';

import { ball, box, cone, cyl, mergeParts } from '../geometry';
import { PALETTE } from '../palette';

export const COIN_HEIGHT = 0.09;
export const COIN_RADIUS = 0.27;

export function coinGeometry(): BufferGeometry {
  return mergeParts([
    { geo: new CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_HEIGHT, 10), color: PALETTE.gold },
  ]);
}

/** A forged bow, carried flat on top of the coin stack. */
export function gearGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.62, 0.07, 0.07), color: PALETTE.gearBlue, at: [0, 0, -0.08] },
    { geo: box(0.07, 0.07, 0.2), color: PALETTE.gearBlue, at: [-0.28, 0, 0.02] },
    { geo: box(0.07, 0.07, 0.2), color: PALETTE.gearBlue, at: [0.28, 0, 0.02] },
    { geo: box(0.56, 0.03, 0.03), color: PALETTE.white, at: [0, 0, 0.11] },
  ]);
}

export const FENCE_POST_SPACING = 0.5;

export function fencePostGeometry(): BufferGeometry {
  return mergeParts([
    { geo: cyl(0.17, 0.19, 1.0, 6), color: PALETTE.wood, at: [0, 0.5, 0] },
    { geo: cone(0.17, 0.3, 6), color: PALETTE.woodDark, at: [0, 1.15, 0] },
  ]);
}

export function treeGeometry(): BufferGeometry {
  return mergeParts([
    { geo: cyl(0.16, 0.22, 0.8, 6), color: PALETTE.woodDark, at: [0, 0.4, 0] },
    { geo: cone(0.95, 1.3, 7), color: PALETTE.leaf, at: [0, 1.35, 0] },
    { geo: cone(0.7, 1.1, 7), color: PALETTE.grassDark, at: [0, 2.1, 0] },
  ]);
}

/** Unit rock; instances are scaled by their radius. */
export function rockGeometry(): BufferGeometry {
  return mergeParts([
    { geo: ball(1, 0), color: PALETTE.stoneDark, at: [0, 0.35, 0], scale: [1, 0.7, 1] },
    { geo: ball(0.55, 0), color: PALETTE.stone, at: [0.55, 0.25, 0.4], scale: [1, 0.7, 1] },
  ]);
}

export function chestGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.9, 0.5, 0.6), color: PALETTE.wood, at: [0, 0.25, 0] },
    { geo: box(0.94, 0.2, 0.64), color: PALETTE.woodDark, at: [0, 0.58, 0] },
    { geo: box(0.14, 0.2, 0.05), color: PALETTE.gold, at: [0, 0.45, 0.32] },
  ]);
}

/** Tower platform; the tower archer stands on top at TOWER_DECK_HEIGHT. */
export const TOWER_DECK_HEIGHT = 1.5;

export function towerGeometry(): BufferGeometry {
  const legs = ([-1, 1] as const).flatMap((sx) =>
    ([-1, 1] as const).map((sz) => ({
      geo: box(0.14, TOWER_DECK_HEIGHT, 0.14),
      color: PALETTE.woodDark,
      at: [sx * 0.42, TOWER_DECK_HEIGHT / 2, sz * 0.42] as const,
    })),
  );
  return mergeParts([
    ...legs,
    { geo: box(1.15, 0.14, 1.15), color: PALETTE.wood, at: [0, TOWER_DECK_HEIGHT - 0.07, 0] },
    { geo: box(1.2, 0.28, 0.08), color: PALETTE.wood, at: [0, TOWER_DECK_HEIGHT + 0.14, 0.56] },
    { geo: box(1.2, 0.28, 0.08), color: PALETTE.wood, at: [0, TOWER_DECK_HEIGHT + 0.14, -0.56] },
    { geo: box(0.08, 0.28, 1.2), color: PALETTE.wood, at: [0.56, TOWER_DECK_HEIGHT + 0.14, 0] },
    { geo: box(0.08, 0.28, 1.2), color: PALETTE.wood, at: [-0.56, TOWER_DECK_HEIGHT + 0.14, 0] },
  ]);
}

/** Keep sized to its footprint (w along x, d along z). */
export function keepGeometry(w: number, d: number): BufferGeometry {
  return mergeParts([
    { geo: box(w, 2.2, d), color: PALETTE.stone, at: [0, 1.1, 0] },
    { geo: box(w + 0.3, 0.3, d + 0.3), color: PALETTE.stoneDark, at: [0, 2.35, 0] },
    {
      geo: cone(Math.min(w, d) * 0.62, 1.6, 4),
      color: PALETTE.roof,
      at: [0, 3.3, 0],
      rot: [0, Math.PI / 4, 0],
    },
    { geo: box(0.1, 1.1, 0.9), color: PALETTE.woodDark, at: [w / 2 + 0.01, 0.55, 0] },
    { geo: cyl(0.04, 0.04, 1.2, 5), color: PALETTE.dark, at: [0, 4.6, 0] },
    { geo: box(0.5, 0.3, 0.04), color: PALETTE.heroBlue, at: [0.27, 5.0, 0] },
  ]);
}

export function forgeGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(2.4, 1.3, 1.8), color: PALETTE.stoneDark, at: [0, 0.65, 0] },
    { geo: box(2.7, 0.2, 2.1), color: PALETTE.woodDark, at: [0, 1.4, 0] },
    { geo: box(0.6, 1.4, 0.6), color: PALETTE.stone, at: [-0.7, 2.0, -0.4] },
    { geo: box(0.7, 0.5, 0.06), color: PALETTE.ember, at: [0.3, 0.5, 0.92] },
    { geo: box(0.6, 0.3, 0.3), color: PALETTE.dark, at: [-0.9, 0.2, 1.3] },
  ]);
}

export function archeryGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(2.6, 1.2, 2.0), color: PALETTE.wood, at: [0, 0.6, 0] },
    { geo: cone(1.9, 1.1, 4), color: PALETTE.heroBlue, at: [0, 1.75, 0], rot: [0, Math.PI / 4, 0] },
    {
      geo: cyl(0.4, 0.4, 0.08, 10),
      color: PALETTE.white,
      at: [0, 0.75, 1.03],
      rot: [Math.PI / 2, 0, 0],
    },
    {
      geo: cyl(0.18, 0.18, 0.1, 8),
      color: PALETTE.enemyRed,
      at: [0, 0.75, 1.05],
      rot: [Math.PI / 2, 0, 0],
    },
  ]);
}

export function brazierGeometry(): BufferGeometry {
  return mergeParts([
    { geo: cyl(0.12, 0.2, 0.8, 6), color: PALETTE.dark, at: [0, 0.4, 0] },
    { geo: cyl(0.4, 0.22, 0.3, 6), color: PALETTE.stoneDark, at: [0, 0.9, 0] },
  ]);
}
