import { BillboardPool, type BillboardBasis } from './billboards';

const GRAVITY = 9;

/** Pooled CPU particles drawn as tinted quads: hit sparks, kill bursts, celebration. */
export class Particles {
  readonly pool: BillboardPool;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly z: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly hex: Uint32Array;
  private cursor = 0;
  /** Share of each burst that is actually emitted (lower on the low quality tier). */
  density = 1;

  constructor(
    basis: BillboardBasis,
    private readonly capacity: number,
  ) {
    this.pool = new BillboardPool(basis, capacity);
    const f32 = () => new Float32Array(capacity);
    this.x = f32();
    this.y = f32();
    this.z = f32();
    this.vx = f32();
    this.vy = f32();
    this.vz = f32();
    this.life = f32();
    this.maxLife = f32();
    this.size = f32();
    this.hex = new Uint32Array(capacity);
  }

  /** Emits `count` particles outward from a point. Oldest particles are recycled when full. */
  burst(
    x: number,
    y: number,
    z: number,
    count: number,
    hex: number,
    speed: number,
    size = 0.14,
  ): void {
    const emitted = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < emitted; i++) {
      const p = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      // Cosmetic only, so unseeded randomness is fine here (never in sim/).
      const angle = Math.random() * Math.PI * 2;
      const lift = 0.4 + Math.random() * 0.8;
      const s = speed * (0.5 + Math.random() * 0.5);
      this.x[p] = x;
      this.y[p] = y;
      this.z[p] = z;
      this.vx[p] = Math.cos(angle) * s;
      this.vz[p] = Math.sin(angle) * s;
      this.vy[p] = lift * speed;
      this.life[p] = this.maxLife[p] = 0.35 + Math.random() * 0.3;
      this.size[p] = size;
      this.hex[p] = hex;
    }
  }

  update(frameSec: number): void {
    this.pool.begin();
    for (let p = 0; p < this.capacity; p++) {
      if (this.life[p] <= 0) continue;
      this.life[p] -= frameSec;
      this.vy[p] -= GRAVITY * frameSec;
      this.x[p] += this.vx[p] * frameSec;
      this.y[p] = Math.max(0.05, this.y[p] + this.vy[p] * frameSec);
      this.z[p] += this.vz[p] * frameSec;
      const s = this.size[p] * Math.max(this.life[p] / this.maxLife[p], 0);
      this.pool.add(this.x[p], this.y[p], this.z[p], s, s, this.hex[p]);
    }
    this.pool.end();
  }

  dispose(): void {
    this.pool.dispose();
  }
}
