import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
} from 'three';

import type { PadType } from '../../content/schema';
import { PAD_RADIUS } from '../sim/constants';
import { padUsable } from '../sim/systems/pads';
import type { World } from '../sim/world';

const TEXTURE_SIZE = 160;
const RING_STEPS = 32;
const FONT = '"Fredoka Variable", ui-rounded, system-ui, sans-serif';
const LABELS: Record<PadType, string> = {
  tower: 'TOWER',
  forge: 'FORGE',
  repair: 'REPAIR',
  keep: 'KEEP',
  brazier: 'BRAZIER',
  gate: 'GATE',
};

interface PadVisual {
  plate: Mesh;
  ring: Mesh;
  material: MeshBasicMaterial;
  ringMaterial: MeshBasicMaterial;
  texture: CanvasTexture;
  ctx: CanvasRenderingContext2D;
  shownRemaining: number;
  shownStep: number;
}

/**
 * Pay pads: a green plate lying on the ground showing what it buys and the
 * gold still owed, plus a progress ring that fills as coins arrive.
 */
export class PadView {
  readonly group = new Group();
  private readonly visuals: PadVisual[] = [];
  private readonly plateGeo = new PlaneGeometry(PAD_RADIUS * 1.7, PAD_RADIUS * 1.7);
  /** Ring geometries for each progress step, shared by all pads. */
  private readonly ringGeos = Array.from(
    { length: RING_STEPS + 1 },
    (_, i) =>
      new RingGeometry(
        PAD_RADIUS * 1.02,
        PAD_RADIUS * 1.2,
        40,
        1,
        Math.PI / 2,
        -(i / RING_STEPS) * Math.PI * 2,
      ),
  );

  constructor(world: World, yaw: number) {
    for (const pad of world.pads) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = TEXTURE_SIZE;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const material = new MeshBasicMaterial({ map: texture, transparent: true });
      const plate = new Mesh(this.plateGeo, material);
      // Lie flat, turned so the text reads upright from the isometric camera.
      plate.rotation.set(-Math.PI / 2, 0, yaw);
      plate.position.set(pad.x, 0.05, pad.y);

      const ringMaterial = new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        side: DoubleSide,
      });
      const ring = new Mesh(this.ringGeos[0], ringMaterial);
      ring.rotation.set(-Math.PI / 2, 0, yaw);
      ring.position.set(pad.x, 0.06, pad.y);

      this.group.add(plate, ring);
      this.visuals.push({
        plate,
        ring,
        material,
        ringMaterial,
        texture,
        ctx: canvas.getContext('2d')!,
        shownRemaining: -1,
        shownStep: -1,
      });
    }
    // Labels drawn before the display font has loaded are redrawn once it arrives.
    void document.fonts?.load(`700 40px ${FONT}`).then(() => {
      for (const v of this.visuals) v.shownRemaining = -1;
    });
  }

  update(world: World): void {
    for (let i = 0; i < world.pads.length; i++) {
      const pad = world.pads[i];
      const v = this.visuals[i];
      v.plate.visible = v.ring.visible = pad.active;
      if (!pad.active) continue;

      const usable = padUsable(world, pad);
      v.material.opacity = usable ? 1 : 0.4;
      v.ringMaterial.opacity = usable ? 1 : 0.4;

      const remaining = pad.cost - pad.paid;
      if (remaining !== v.shownRemaining) {
        v.shownRemaining = remaining;
        this.draw(v, LABELS[pad.type], remaining);
      }
      const stepIndex = Math.round((pad.paid / pad.cost) * RING_STEPS);
      if (stepIndex !== v.shownStep) {
        v.shownStep = stepIndex;
        v.ring.geometry = this.ringGeos[stepIndex];
      }
    }
  }

  dispose(): void {
    this.plateGeo.dispose();
    for (const geo of this.ringGeos) geo.dispose();
    for (const v of this.visuals) {
      v.texture.dispose();
      v.material.dispose();
      v.ringMaterial.dispose();
    }
  }

  private draw(v: PadVisual, label: string, remaining: number): void {
    const { ctx } = v;
    const s = TEXTURE_SIZE;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#3dbe5a';
    ctx.beginPath();
    ctx.roundRect(8, 8, s - 16, s - 16, 28);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a8f40';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(label, s / 2, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText(String(remaining), s / 2, 100);
    v.texture.needsUpdate = true;
  }
}
