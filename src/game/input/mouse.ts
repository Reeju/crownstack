/** Click-and-hold with a mouse or trackpad: the king walks toward the cursor. */
export class MouseInput {
  held = false;
  clientX = 0;
  clientY = 0;

  constructor(private readonly target: HTMLElement) {
    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
    target.addEventListener('contextmenu', this.preventDefault);
  }

  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    this.target.removeEventListener('pointerup', this.onUp);
    this.target.removeEventListener('pointercancel', this.onUp);
    this.target.removeEventListener('contextmenu', this.preventDefault);
  }

  private readonly onDown = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    this.held = true;
    this.clientX = ev.clientX;
    this.clientY = ev.clientY;
    this.target.setPointerCapture(ev.pointerId);
  };

  private readonly onMove = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'mouse') return;
    this.clientX = ev.clientX;
    this.clientY = ev.clientY;
  };

  private readonly onUp = (ev: PointerEvent): void => {
    if (ev.pointerType === 'mouse') this.held = false;
  };

  private readonly preventDefault = (ev: Event): void => ev.preventDefault();
}
