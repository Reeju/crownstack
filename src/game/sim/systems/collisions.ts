import { C, Kind, NO_ENTITY } from '../components';
import type { World } from '../world';

/** Pushes circle `e` out of an axis-aligned box. Returns true if they overlapped. */
function resolveBox(w: World, e: number, bx: number, by: number, hw: number, hh: number): boolean {
  const r = w.radius[e];
  const dx = w.x[e] - bx;
  const dy = w.y[e] - by;
  const cx = Math.min(Math.max(dx, -hw), hw);
  const cy = Math.min(Math.max(dy, -hh), hh);
  const ox = dx - cx;
  const oy = dy - cy;
  const d2 = ox * ox + oy * oy;
  if (d2 >= r * r) return false;

  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    w.x[e] = bx + cx + (ox / d) * r;
    w.y[e] = by + cy + (oy / d) * r;
  } else if (hw - Math.abs(dx) < hh - Math.abs(dy)) {
    // Centre is inside the box: leave along the axis of least penetration.
    w.x[e] = bx + Math.sign(dx || 1) * (hw + r);
  } else {
    w.y[e] = by + Math.sign(dy || 1) * (hh + r);
  }
  return true;
}

function resolveCircle(w: World, e: number, cx: number, cy: number, cr: number): void {
  const dx = w.x[e] - cx;
  const dy = w.y[e] - cy;
  const min = w.radius[e] + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1;
  w.x[e] = cx + (dx / d) * min;
  w.y[e] = cy + (dy / d) * min;
}

/**
 * Keeps walking units out of standing fences (archers excepted), the keep,
 * walls, rocks and towers, and inside the map. Enemies remember the structure that blocked
 * them (in `slot`) so the AI can attack what is in the way.
 */
export function collisions(w: World): void {
  const { w: mapW, h: mapH } = w.cfg.map.size;
  const keep = w.keep;

  for (let e = 0; e < w.highWater; e++) {
    const kind = w.kind[e];
    if (kind !== Kind.King && kind !== Kind.Archer && kind !== Kind.Enemy) continue;
    const isEnemy = kind === Kind.Enemy;
    if (isEnemy) w.slot[e] = NO_ENTITY;

    // Squad archers hop their own palisade: they steer straight for their slot
    // with no pathfinding, and would otherwise be stranded when the king uses the gate.
    for (let i = 0; kind !== Kind.Archer && i < w.fences.length; i++) {
      const f = w.fences[i];
      if (w.hp[f] <= 0) continue;
      if (resolveBox(w, e, w.x[f], w.y[f], w.hw[f], w.hh[f]) && isEnemy) w.slot[e] = f;
    }
    if (
      w.hp[keep] > 0 &&
      resolveBox(w, e, w.x[keep], w.y[keep], w.hw[keep], w.hh[keep]) &&
      isEnemy
    ) {
      w.slot[e] = keep;
    }
    for (const wall of w.walls) resolveBox(w, e, wall.x, wall.y, wall.hw, wall.hh);
    for (const rock of w.rocks) resolveCircle(w, e, rock.x, rock.y, rock.r);
    for (const plot of w.plots) {
      if (plot.tier > 0 && (w.mask[plot.tower] & C.Health) !== 0 && w.hp[plot.tower] > 0) {
        resolveCircle(w, e, plot.x, plot.y, w.radius[plot.tower]);
      }
    }

    const r = w.radius[e];
    // Enemies spawn just outside the map edge and walk in, so only clamp the player side.
    if (!isEnemy) {
      w.x[e] = Math.min(Math.max(w.x[e], r), mapW - r);
      w.y[e] = Math.min(Math.max(w.y[e], r), mapH - r);
    }
  }
}
