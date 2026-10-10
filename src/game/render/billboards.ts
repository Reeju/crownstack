import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Material,
} from 'three';

const color = new Color();

/** Camera-facing basis vectors for a fixed isometric camera. */
export interface BillboardBasis {
  rx: number;
  ry: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
  nx: number;
  ny: number;
  nz: number;
}

export function billboardBasis(yaw: number, pitch: number): BillboardBasis {
  return {
    rx: Math.cos(yaw),
    ry: 0,
    rz: -Math.sin(yaw),
    ux: -Math.sin(pitch) * Math.sin(yaw),
    uy: Math.cos(pitch),
    uz: -Math.sin(pitch) * Math.cos(yaw),
    nx: Math.sin(yaw) * Math.cos(pitch),
    ny: Math.sin(pitch),
    nz: Math.cos(yaw) * Math.cos(pitch),
  };
}

/** Writes a camera-facing instance matrix scaled (sx, sy) at (x, y, z). */
export function writeBillboard(
  m: ArrayLike<number> & { [i: number]: number },
  offset: number,
  b: BillboardBasis,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
): void {
  m[offset] = b.rx * sx;
  m[offset + 1] = b.ry * sx;
  m[offset + 2] = b.rz * sx;
  m[offset + 3] = 0;
  m[offset + 4] = b.ux * sy;
  m[offset + 5] = b.uy * sy;
  m[offset + 6] = b.uz * sy;
  m[offset + 7] = 0;
  m[offset + 8] = b.nx;
  m[offset + 9] = b.ny;
  m[offset + 10] = b.nz;
  m[offset + 11] = 0;
  m[offset + 12] = x;
  m[offset + 13] = y;
  m[offset + 14] = z;
  m[offset + 15] = 1;
}

/**
 * Refill-every-frame pool of flat, tinted, camera-facing quads drawn on top of
 * the scene (HP bars, particles). `anchorLeft` makes quads grow from their left
 * edge, which is what a bar fill needs.
 */
export class BillboardPool {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor(
    private readonly basis: BillboardBasis,
    private readonly capacity: number,
    anchorLeft = false,
    material: Material = new MeshBasicMaterial({ depthTest: false, transparent: true }),
  ) {
    const geometry = new PlaneGeometry(1, 1);
    if (anchorLeft) geometry.translate(0.5, 0, 0);
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;
    // Allocate the colour buffer up front so tinting never reallocates.
    this.mesh.setColorAt(0, color.setRGB(1, 1, 1));
  }

  begin(): void {
    this.n = 0;
  }

  add(x: number, y: number, z: number, sx: number, sy: number, hex: number): void {
    if (this.n >= this.capacity) return;
    writeBillboard(this.mesh.instanceMatrix.array, this.n * 16, this.basis, x, y, z, sx, sy);
    this.mesh.setColorAt(this.n++, color.setHex(hex));
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as Material).dispose();
    this.mesh.dispose();
  }
}
