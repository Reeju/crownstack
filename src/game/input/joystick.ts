const DEAD_ZONE_PX = 12;
const MAX_RADIUS_PX = 60;
/** The joystick only spawns on the lower 70% of the screen (SPEC §3.2). */
const ACTIVE_AREA_TOP = 0.3;
const DOUBLE_TAP_MS = 300;

/**
 * Floating virtual joystick for touch and pen. It appears where the thumb
 * lands; the first pointer owns it, so later pointers can still hit HUD buttons.
 */
export class Joystick {
  x = 0;
  y = 0;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private lastTapAt = -Infinity;
  private dashQueued = false;
  private readonly base = document.createElement('div');
  private readonly knob = document.createElement('div');

  constructor(private readonly target: HTMLElement) {
    this.base.className = 'joystick';
    this.knob.className = 'joystick-knob';
    this.base.append(this.knob);
    this.base.hidden = true;
    document.body.append(this.base);

    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
  }

  /** True once per double tap; reading it consumes the dash. */
  takeDash(): boolean {
    const dash = this.dashQueued;
    this.dashQueued = false;
    return dash;
  }

  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    this.target.removeEventListener('pointerup', this.onUp);
    this.target.removeEventListener('pointercancel', this.onUp);
    this.base.remove();
  }

  private readonly onDown = (ev: PointerEvent): void => {
    if (ev.pointerType === 'mouse' || this.pointerId !== null) return;
    if (ev.clientY < window.innerHeight * ACTIVE_AREA_TOP) return;
    if (ev.timeStamp - this.lastTapAt < DOUBLE_TAP_MS) this.dashQueued = true;
    this.lastTapAt = ev.timeStamp;

    this.pointerId = ev.pointerId;
    this.originX = ev.clientX;
    this.originY = ev.clientY;
    this.target.setPointerCapture(ev.pointerId);
    this.base.hidden = false;
    this.base.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
  };

  private readonly onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.pointerId) return;
    let dx = ev.clientX - this.originX;
    let dy = ev.clientY - this.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS_PX) {
      dx *= MAX_RADIUS_PX / dist;
      dy *= MAX_RADIUS_PX / dist;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (dist < DEAD_ZONE_PX) {
      this.x = this.y = 0;
      return;
    }
    // Scale so the stick reads 0 at the dead-zone edge and 1 at full deflection.
    const mag = (Math.min(dist, MAX_RADIUS_PX) - DEAD_ZONE_PX) / (MAX_RADIUS_PX - DEAD_ZONE_PX);
    this.x = (dx / Math.min(dist, MAX_RADIUS_PX)) * mag;
    this.y = (dy / Math.min(dist, MAX_RADIUS_PX)) * mag;
  };

  private readonly onUp = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.x = this.y = 0;
    this.base.hidden = true;
  };
}
