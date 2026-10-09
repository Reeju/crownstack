import { BufferGeometry, Color, DynamicDrawUsage, InstancedMesh, type Material } from 'three';

const color = new Color();

/**
 * A refill-every-frame InstancedMesh: `begin()`, `add()` each visible instance,
 * `end()`. One pool = one draw call (SPEC §5.1).
 */
export class InstancedPool {
  readonly mesh: InstancedMesh;
  private n = 0;
  private tinted = false;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    private readonly capacity: number,
  ) {
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  /** Adds an instance rotated about Y by `rotY`; returns its index, or -1 if the pool is full. */
  add(x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx): number {
    if (this.n >= this.capacity) return -1;
    const m = this.mesh.instanceMatrix.array;
    const o = this.n * 16;
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    m[o] = c * sx;
    m[o + 1] = 0;
    m[o + 2] = -s * sx;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = sy;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = s * sz;
    m[o + 9] = 0;
    m[o + 10] = c * sz;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    return this.n++;
  }

  /** Multiplies an instance's colour (default white). Components may exceed 1 to brighten. */
  tint(index: number, r: number, g: number, b: number): void {
    if (index < 0) return;
    this.mesh.setColorAt(index, color.setRGB(r, g, b));
    this.tinted = true;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.tinted && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
