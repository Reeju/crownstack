const KEY_X: Record<string, number> = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
const KEY_Y: Record<string, number> = { KeyW: -1, ArrowUp: -1, KeyS: 1, ArrowDown: 1 };

/** WASD / arrow keys as a screen-space direction; Space is dash. */
export class KeyboardInput {
  /** Set after the first key event so the UI can reveal keyboard hints. */
  used = false;
  private readonly down = new Set<string>();

  constructor(private readonly onPause: () => void) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  get x(): number {
    let x = 0;
    for (const code of this.down) x += KEY_X[code] ?? 0;
    return Math.sign(x);
  }

  get y(): number {
    let y = 0;
    for (const code of this.down) y += KEY_Y[code] ?? 0;
    return Math.sign(y);
  }

  get dash(): boolean {
    return this.down.has('Space');
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    this.used = true;
    if ((ev.code === 'Escape' || ev.code === 'KeyP') && !ev.repeat) this.onPause();
    if (ev.code in KEY_X || ev.code in KEY_Y || ev.code === 'Space') this.down.add(ev.code);
  };

  private readonly onKeyUp = (ev: KeyboardEvent): void => {
    this.down.delete(ev.code);
  };

  private readonly clear = (): void => this.down.clear();
}
