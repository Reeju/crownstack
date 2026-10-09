import { DT } from '../components';
import { KNOCK_DECAY } from '../constants';
import { Ev, emit } from '../events';
import type { World } from '../world';

/** Applies the player's intent to the king: walking, dashing, i-frames and regeneration. */
export function heroMove(w: World): void {
  const e = w.hero;
  if (w.hp[e] <= 0) return;
  const def = w.cfg.units.king;
  const st = w.king;

  st.iframes = Math.max(0, st.iframes - DT);
  st.dashCooldown = Math.max(0, st.dashCooldown - DT);
  st.sinceHit += DT;
  if (st.sinceHit >= def.regenDelaySec) {
    w.hp[e] = Math.min(w.maxHp[e], w.hp[e] + def.regenPerSec * DT);
  }

  let mx = w.outcome === 'playing' && w.celebrate < 0 ? w.intent.moveX : 0;
  let my = w.outcome === 'playing' && w.celebrate < 0 ? w.intent.moveY : 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  // Dash triggers on the press edge, in the direction of travel.
  const dashPressed = w.intent.dash && !st.dashHeld;
  st.dashHeld = w.intent.dash;
  if (w.cfg.level.dash && dashPressed && st.dashCooldown <= 0 && len > 0.1) {
    st.dashTime = def.dashSec;
    st.dashCooldown = def.dashCooldownSec;
    st.dashX = mx / Math.min(len, 1);
    st.dashY = my / Math.min(len, 1);
    emit(w.events, Ev.Dash, w.x[e], w.y[e]);
  }

  if (st.dashTime > 0) {
    st.dashTime -= DT;
    w.vx[e] = st.dashX * def.speed * def.dashSpeedMult;
    w.vy[e] = st.dashY * def.speed * def.dashSpeedMult;
  } else {
    w.vx[e] = mx * def.speed;
    w.vy[e] = my * def.speed;
  }

  w.x[e] += (w.vx[e] + w.kx[e]) * DT;
  w.y[e] += (w.vy[e] + w.ky[e]) * DT;
  w.kx[e] *= KNOCK_DECAY;
  w.ky[e] *= KNOCK_DECAY;
  if (len > 0.1) w.facing[e] = Math.atan2(my, mx);
}
