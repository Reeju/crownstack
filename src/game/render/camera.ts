import { OrthographicCamera, Vector3 } from 'three';

const PITCH = (50 * Math.PI) / 180;
const YAW = (45 * Math.PI) / 180;
const DISTANCE = 80;
/** Portrait screens zoom out a further 15% (SPEC §5.2). */
const PORTRAIT_ZOOM = 0.85;
/**
 * Below this many CSS pixels per world unit the level is unreadable, so the
 * camera stops fitting the whole level and follows the king instead.
 */
const MIN_PX_PER_UNIT = 24;
const FOLLOW_SHARPNESS = 6;

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Orthographic isometric camera (pitch 50°, yaw 45°). It fits the level's
 * camera bounds when the screen is big enough and otherwise follows the king,
 * clamped to those bounds.
 */
export class IsoCamera {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  readonly yaw = YAW;
  /** CSS pixels per world unit at the current zoom. */
  pxPerUnit = MIN_PX_PER_UNIT;

  // Ground-plane basis: screen-right and screen-up directions in world (x, z).
  private readonly rightX = Math.cos(YAW);
  private readonly rightZ = -Math.sin(YAW);
  private readonly upX = -Math.sin(YAW);
  private readonly upZ = -Math.cos(YAW);

  private viewW = 1;
  private viewH = 1;
  private following = false;
  // Level bounds and camera centre in screen-aligned ground coordinates.
  private min = { u: 0, v: 0 };
  private max = { u: 0, v: 0 };
  private centre = { u: 0, v: 0 };
  private shakeSec = 0;
  private shakeAmp = 0;
  private readonly target = new Vector3();

  /** Sets the viewport (CSS px) and level bounds, and recomputes the zoom. */
  fit(viewW: number, viewH: number, bounds: Bounds): void {
    this.viewW = viewW;
    this.viewH = viewH;
    this.min = { u: Infinity, v: Infinity };
    this.max = { u: -Infinity, v: -Infinity };
    for (const [x, z] of [
      [bounds.x, bounds.y],
      [bounds.x + bounds.w, bounds.y],
      [bounds.x, bounds.y + bounds.h],
      [bounds.x + bounds.w, bounds.y + bounds.h],
    ] as const) {
      const u = x * this.rightX + z * this.rightZ;
      const v = (x * this.upX + z * this.upZ) * Math.sin(PITCH);
      this.min.u = Math.min(this.min.u, u);
      this.min.v = Math.min(this.min.v, v);
      this.max.u = Math.max(this.max.u, u);
      this.max.v = Math.max(this.max.v, v);
    }

    const portrait = viewH > viewW;
    const fitPx =
      Math.min(viewW / (this.max.u - this.min.u), viewH / (this.max.v - this.min.v)) *
      (portrait ? PORTRAIT_ZOOM : 1);
    this.following = fitPx < MIN_PX_PER_UNIT;
    this.pxPerUnit = Math.max(fitPx, MIN_PX_PER_UNIT);

    const halfW = viewW / 2 / this.pxPerUnit;
    const halfH = viewH / 2 / this.pxPerUnit;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.centre = { u: (this.min.u + this.max.u) / 2, v: (this.min.v + this.max.v) / 2 };
    this.apply(0);
  }

  /** Moves the camera toward the focus point (the king) when in follow mode. */
  update(focusX: number, focusZ: number, frameSec: number, snap = false): void {
    if (this.following) {
      const halfW = this.viewW / 2 / this.pxPerUnit;
      const halfH = this.viewH / 2 / this.pxPerUnit;
      const u = clampOrCentre(
        focusX * this.rightX + focusZ * this.rightZ,
        this.min.u + halfW,
        this.max.u - halfW,
      );
      const v = clampOrCentre(
        (focusX * this.upX + focusZ * this.upZ) * Math.sin(PITCH),
        this.min.v + halfH,
        this.max.v - halfH,
      );
      const k = snap ? 1 : 1 - Math.exp(-FOLLOW_SHARPNESS * frameSec);
      this.centre.u += (u - this.centre.u) * k;
      this.centre.v += (v - this.centre.v) * k;
    }
    this.apply(frameSec);
  }

  /** Starts a short screen shake (seconds, world units). */
  shake(seconds: number, amplitude: number): void {
    this.shakeSec = seconds;
    this.shakeAmp = amplitude;
  }

  /** Projects a client-space point onto the ground plane (y = 0). */
  screenToGround(clientX: number, clientY: number, out: { x: number; y: number }): void {
    const u = this.centre.u + (clientX - this.viewW / 2) / this.pxPerUnit;
    const v = (this.centre.v - (clientY - this.viewH / 2) / this.pxPerUnit) / Math.sin(PITCH);
    out.x = u * this.rightX + v * this.upX;
    out.y = u * this.rightZ + v * this.upZ;
  }

  private apply(frameSec: number): void {
    let u = this.centre.u;
    let v = this.centre.v;
    if (this.shakeSec > 0) {
      this.shakeSec -= frameSec;
      // Cheap deterministic-looking jitter; purely cosmetic, so wall-clock phase is fine.
      const phase = this.shakeSec * 90;
      u += Math.sin(phase * 1.7) * this.shakeAmp;
      v += Math.cos(phase * 2.3) * this.shakeAmp;
    }
    const gv = v / Math.sin(PITCH);
    this.target.set(u * this.rightX + gv * this.upX, 0, u * this.rightZ + gv * this.upZ);
    this.camera.position.set(
      this.target.x + Math.sin(YAW) * Math.cos(PITCH) * DISTANCE,
      Math.sin(PITCH) * DISTANCE,
      this.target.z + Math.cos(YAW) * Math.cos(PITCH) * DISTANCE,
    );
    this.camera.lookAt(this.target);
  }
}

function clampOrCentre(value: number, min: number, max: number): number {
  return min > max ? (min + max) / 2 : Math.min(Math.max(value, min), max);
}
