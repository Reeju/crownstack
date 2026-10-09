import type { BufferGeometry } from 'three';

import { ball, box, cone, cyl, mergeParts } from '../geometry';
import { PALETTE } from '../palette';

/** Height at which the coin stack starts on the king's head. */
export const KING_HEAD_TOP = 1.32;

export function kingGeometry(): BufferGeometry {
  return mergeParts([
    { geo: box(0.16, 0.3, 0.14), color: PALETTE.dark, at: [0, 0.15, -0.13] },
    { geo: box(0.16, 0.3, 0.14), color: PALETTE.dark, at: [0, 0.15, 0.13] },
    { geo: cyl(0.24, 0.34, 0.56), color: PALETTE.heroBlue, at: [0, 0.56, 0] },
    { geo: box(0.08, 0.5, 0.5), color: PALETTE.roof, at: [-0.3, 0.58, 0] },
    { geo: ball(0.22), color: PALETTE.skin, at: [0, 1.02, 0] },
    { geo: box(0.1, 0.16, 0.24), color: PALETTE.white, at: [0.17, 0.93, 0] },
    { geo: cyl(0.21, 0.19, 0.12, 6), color: PALETTE.gold, at: [0, 1.25, 0] },
  ]);
}

/** One geometry per tier so each tier is a single draw call with its own tunic colour. */
export function archerGeometry(tunic: number): BufferGeometry {
  return mergeParts([
    { geo: box(0.13, 0.26, 0.12), color: PALETTE.dark, at: [0, 0.13, -0.1] },
    { geo: box(0.13, 0.26, 0.12), color: PALETTE.dark, at: [0, 0.13, 0.1] },
    { geo: cyl(0.18, 0.25, 0.44), color: tunic, at: [0, 0.48, 0] },
    { geo: ball(0.17), color: PALETTE.skin, at: [0, 0.84, 0] },
    { geo: cone(0.2, 0.22), color: tunic, at: [-0.02, 1.0, 0] },
    { geo: box(0.04, 0.62, 0.04), color: PALETTE.woodDark, at: [0.3, 0.55, 0] },
    { geo: box(0.18, 0.04, 0.04), color: PALETTE.woodDark, at: [0.22, 0.55, 0] },
  ]);
}
