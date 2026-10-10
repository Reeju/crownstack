import {
  CanvasTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  PlaneGeometry,
  SRGBColorSpace,
  type ShaderMaterial,
} from 'three';

import type { UnitsDef } from '../../content/schema';
import { createAtlasMaterial } from './atlas';
import { writeBillboard, type BillboardBasis } from './billboards';

const CAPACITY = 64;
const CELL_W = 128;
const CELL_H = 64;
const COLS = 4;
const ROWS = 8;
const LIFE_SEC = 0.7;
const RISE = 1.4;
const WIDTH = 1.5;
const FONT = '700 46px "Fredoka Variable", ui-rounded, system-ui, sans-serif';

/**
 * Floating damage numbers: one instanced draw call of billboards that sample
 * a canvas atlas (SPEC §5.1). Every damage value in units.json gets two atlas
 * cells up front — white for hits on enemies, red for hits on the player.
 */
export class Popups {
  readonly mesh: InstancedMesh;
  private readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cells = new Map<string, number>();
  private readonly uvRect = new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  private readonly alpha = new InstancedBufferAttribute(new Float32Array(CAPACITY), 1);
  private readonly x = new Float32Array(CAPACITY);
  private readonly y = new Float32Array(CAPACITY);
  private readonly z = new Float32Array(CAPACITY);
  private readonly age = new Float32Array(CAPACITY).fill(LIFE_SEC);
  private readonly cell = new Uint8Array(CAPACITY);
  private cursor = 0;

  constructor(
    private readonly basis: BillboardBasis,
    units: UnitsDef,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = CELL_W * COLS;
    canvas.height = CELL_H * ROWS;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;

    const amounts = new Set<number>();
    for (const tier of [...units.archer.tiers, ...units.tower.tiers]) amounts.add(tier.damage);
    for (const enemy of Object.values(units.enemies)) {
      amounts.add(enemy.damage);
      if (enemy.slam) amounts.add(enemy.slam.damage);
    }
    for (const amount of amounts) {
      this.cells.set(`${amount}:0`, this.cells.size);
      this.cells.set(`${amount}:1`, this.cells.size);
    }
    this.drawAtlas();
    void document.fonts?.load(FONT).then(() => this.drawAtlas());

    const geometry = new PlaneGeometry(1, 1);
    this.uvRect.setUsage(DynamicDrawUsage);
    this.alpha.setUsage(DynamicDrawUsage);
    geometry.setAttribute('uvRect', this.uvRect);
    geometry.setAttribute('alpha', this.alpha);
    this.mesh = new InstancedMesh(geometry, createAtlasMaterial(this.texture, false), CAPACITY);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.count = 0;
  }

  /** Shows "-amount" rising from a point. `hurtsPlayer` selects the red variant. */
  spawn(x: number, y: number, z: number, amount: number, hurtsPlayer: boolean): void {
    const cell = this.cells.get(`${amount}:${hurtsPlayer ? 1 : 0}`);
    if (cell === undefined) return;
    const p = this.cursor;
    this.cursor = (this.cursor + 1) % CAPACITY;
    this.x[p] = x + (Math.random() - 0.5) * 0.5;
    this.y[p] = y;
    this.z[p] = z + (Math.random() - 0.5) * 0.5;
    this.age[p] = 0;
    this.cell[p] = cell;
  }

  update(frameSec: number): void {
    let n = 0;
    for (let p = 0; p < CAPACITY; p++) {
      if (this.age[p] >= LIFE_SEC) continue;
      this.age[p] += frameSec;
      const t = Math.min(this.age[p] / LIFE_SEC, 1);
      const cell = this.cell[p];
      writeBillboard(
        this.mesh.instanceMatrix.array,
        n * 16,
        this.basis,
        this.x[p],
        this.y[p] + t * RISE,
        this.z[p],
        WIDTH,
        (WIDTH * CELL_H) / CELL_W,
      );
      // Canvas rows run top-down; texture v runs bottom-up.
      this.uvRect.setXYZW(
        n,
        (cell % COLS) / COLS,
        1 - (Math.floor(cell / COLS) + 1) / ROWS,
        1 / COLS,
        1 / ROWS,
      );
      this.alpha.setX(n, 1 - t * t);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.uvRect.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
    this.mesh.dispose();
  }

  private drawAtlas(): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, CELL_W * COLS, CELL_H * ROWS);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1b1f2a';
    for (const [key, cell] of this.cells) {
      const [amount, hurtsPlayer] = key.split(':');
      const cx = (cell % COLS) * CELL_W + CELL_W / 2;
      const cy = Math.floor(cell / COLS) * CELL_H + CELL_H / 2;
      ctx.fillStyle = hurtsPlayer === '1' ? '#ff6b61' : '#ffffff';
      ctx.strokeText(`-${amount}`, cx, cy);
      ctx.fillText(`-${amount}`, cx, cy);
    }
    this.texture.needsUpdate = true;
  }
}
