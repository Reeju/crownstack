import { COIN_HEIGHT } from './meshes/props';
import type { InstancedPool } from './instancing';

/** Spring constants for the wobbly-tower feel (SPEC §5.1). */
const STIFFNESS = 120;
const DAMPING = 14;
const MAX_VISIBLE_COINS = 60;
/** Each coin may slide at most this far from the one below it. */
const MAX_LEAN = 0.1;
const MAX_SUBSTEP = 1 / 60;
const GEAR_HEIGHT = 0.1;
/** Visual scale of stacked coins and gear, matching the enlarged characters. */
const STACK_SCALE = 1.3;

/**
 * The tower of coins (and forged bows) on the king's head. Purely visual:
 * every coin is a damped spring chasing the coin beneath it, so the stack
 * leans and whips when the king changes direction.
 */
export class CoinStack {
  private readonly x = new Float32Array(MAX_VISIBLE_COINS + 16);
  private readonly z = new Float32Array(MAX_VISIBLE_COINS + 16);
  private readonly vx = new Float32Array(MAX_VISIBLE_COINS + 16);
  private readonly vz = new Float32Array(MAX_VISIBLE_COINS + 16);
  private baseX = 0;
  private baseZ = 0;
  private started = false;
  /** World position of the top of the stack, for the pay-pad coin stream. */
  readonly top = { x: 0, y: 0, z: 0 };

  update(
    coins: InstancedPool,
    gear: InstancedPool,
    baseX: number,
    baseY: number,
    baseZ: number,
    coinCount: number,
    gearCount: number,
    frameSec: number,
    wobble: boolean,
  ): void {
    const visibleCoins = Math.min(coinCount, MAX_VISIBLE_COINS);
    const total = Math.min(visibleCoins + gearCount, this.x.length);
    if (!this.started || !wobble) this.reset(baseX, baseZ);

    // The base's velocity is fed forward so a steady walk causes no lean; only
    // acceleration does.
    let remaining = Math.min(frameSec, 0.1);
    while (wobble && remaining > 1e-5) {
      const dt = Math.min(remaining, MAX_SUBSTEP);
      remaining -= dt;
      let belowX = baseX;
      let belowZ = baseZ;
      let belowVx = (baseX - this.baseX) / Math.max(frameSec, 1e-3);
      let belowVz = (baseZ - this.baseZ) / Math.max(frameSec, 1e-3);
      for (let i = 0; i < total; i++) {
        this.vx[i] += (STIFFNESS * (belowX - this.x[i]) - DAMPING * (this.vx[i] - belowVx)) * dt;
        this.vz[i] += (STIFFNESS * (belowZ - this.z[i]) - DAMPING * (this.vz[i] - belowVz)) * dt;
        this.x[i] += this.vx[i] * dt;
        this.z[i] += this.vz[i] * dt;

        const dx = this.x[i] - belowX;
        const dz = this.z[i] - belowZ;
        const lean = Math.hypot(dx, dz);
        if (lean > MAX_LEAN) {
          this.x[i] = belowX + (dx / lean) * MAX_LEAN;
          this.z[i] = belowZ + (dz / lean) * MAX_LEAN;
        }
        belowX = this.x[i];
        belowZ = this.z[i];
        belowVx = this.vx[i];
        belowVz = this.vz[i];
      }
    }
    this.baseX = baseX;
    this.baseZ = baseZ;

    let y = baseY + (COIN_HEIGHT * STACK_SCALE) / 2;
    for (let i = 0; i < total; i++) {
      if (i < visibleCoins) {
        coins.add(this.x[i], y, this.z[i], 0, STACK_SCALE);
        y += COIN_HEIGHT * STACK_SCALE;
      } else {
        gear.add(this.x[i], y, this.z[i], (i % 2) * (Math.PI / 2), STACK_SCALE);
        y += GEAR_HEIGHT * STACK_SCALE;
      }
    }
    this.top.x = total > 0 ? this.x[total - 1] : baseX;
    this.top.z = total > 0 ? this.z[total - 1] : baseZ;
    this.top.y = y;
  }

  private reset(baseX: number, baseZ: number): void {
    this.x.fill(baseX);
    this.z.fill(baseZ);
    this.vx.fill(0);
    this.vz.fill(0);
    this.baseX = baseX;
    this.baseZ = baseZ;
    this.started = true;
  }
}
