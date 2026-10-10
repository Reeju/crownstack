import {
  CanvasTexture,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  SRGBColorSpace,
  type ShaderMaterial,
} from 'three';

import type { PadType } from '../../content/schema';
import { PAD_RADIUS } from '../sim/constants';
import { padUsable } from '../sim/systems/pads';
import type { World } from '../sim/world';
import { cellUv, createAtlasMaterial } from './atlas';

const CELL = 128;
const RING_RADIUS_PX = 57;
/** World size of a pad quad, chosen so the ring drawn in its cell sits just outside PAD_RADIUS. */
const QUAD_SIZE = (PAD_RADIUS * 2.1 * CELL) / (RING_RADIUS_PX * 2);
const FONT = '"Fredoka Variable", ui-rounded, system-ui, sans-serif';
const LABELS: Record<PadType, string> = {
  tower: 'TOWER',
  forge: 'FORGE',
  repair: 'REPAIR',
  keep: 'KEEP',
  brazier: 'BRAZIER',
  gate: 'GATE',
};

/**
 * Pay pads: plates lying on the ground showing what they buy, the gold still
 * owed and a progress ring. All pads share one canvas atlas and one instanced
 * draw call; a pad's cell is redrawn only when its numbers change.
 */
export class PadView {
  readonly mesh: InstancedMesh;
  private readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cols: number;
  private readonly rows: number;
  private readonly alpha: InstancedBufferAttribute;
  private readonly shown: { remaining: number; paid: number; tier: number }[];

  constructor(world: World, yaw: number) {
    const count = Math.max(world.pads.length, 1);
    this.cols = Math.ceil(Math.sqrt(count));
    this.rows = Math.ceil(count / this.cols);
    const canvas = document.createElement('canvas');
    canvas.width = this.cols * CELL;
    canvas.height = this.rows * CELL;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;

    const geometry = new PlaneGeometry(QUAD_SIZE, QUAD_SIZE);
    const uvRect = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.alpha = new InstancedBufferAttribute(new Float32Array(count), 1);
    geometry.setAttribute('uvRect', uvRect);
    geometry.setAttribute('alpha', this.alpha);

    this.mesh = new InstancedMesh(geometry, createAtlasMaterial(this.texture, true), count);
    this.mesh.frustumCulled = false;
    this.mesh.count = world.pads.length;

    // Lie flat, turned so the text reads upright from the isometric camera.
    const matrix = new Matrix4().makeRotationFromEuler(new Euler(-Math.PI / 2, 0, yaw));
    const uv = { x: 0, y: 0 };
    world.pads.forEach((pad, i) => {
      this.mesh.setMatrixAt(i, matrix.setPosition(pad.x, 0.05, pad.y));
      cellUv(i, this.cols, this.rows, uv);
      uvRect.setXYZW(i, uv.x, uv.y, 1 / this.cols, 1 / this.rows);
    });
    this.shown = world.pads.map(() => ({ remaining: -1, paid: -1, tier: -1 }));

    // Labels drawn before the display font has loaded are redrawn once it arrives.
    void document.fonts?.load(`700 40px ${FONT}`).then(() => {
      for (const s of this.shown) s.remaining = -1;
    });
  }

  update(world: World): void {
    let redrawn = false;
    for (let i = 0; i < world.pads.length; i++) {
      const pad = world.pads[i];
      const alpha = !pad.active ? 0 : padUsable(world, pad) ? 1 : 0.4;
      if (this.alpha.getX(i) !== alpha) {
        this.alpha.setX(i, alpha);
        this.alpha.needsUpdate = true;
      }
      if (!pad.active) continue;

      const shown = this.shown[i];
      const remaining = pad.cost - pad.paid;
      // Tower pads say "UPGRADE" once their plot holds a tower.
      const tier = pad.plot >= 0 ? world.plots[pad.plot].tier : 0;
      if (remaining === shown.remaining && pad.paid === shown.paid && tier === shown.tier) continue;
      shown.remaining = remaining;
      shown.paid = pad.paid;
      shown.tier = tier;
      this.draw(i, tier > 0 ? 'UPGRADE' : LABELS[pad.type], remaining, pad.paid / pad.cost);
      redrawn = true;
    }
    if (redrawn) this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
    this.mesh.dispose();
  }

  private draw(index: number, label: string, remaining: number, progress: number): void {
    const { ctx } = this;
    const x = (index % this.cols) * CELL;
    const y = Math.floor(index / this.cols) * CELL;
    const c = CELL / 2;
    ctx.clearRect(x, y, CELL, CELL);

    ctx.fillStyle = '#3dbe5a';
    ctx.beginPath();
    ctx.roundRect(x + 20, y + 20, CELL - 40, CELL - 40, 20);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2a8f40';
    ctx.stroke();

    // Progress ring: a faint full circle with the paid share drawn over it, clockwise from the top.
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(x + c, y + c, RING_RADIUS_PX, 0, Math.PI * 2);
    ctx.stroke();
    if (progress > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x + c, y + c, RING_RADIUS_PX, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(label, x + c, y + 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(String(remaining), x + c, y + 76);
  }
}
