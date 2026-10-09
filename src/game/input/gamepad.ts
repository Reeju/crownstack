const STICK_DEAD_ZONE = 0.2;
const BUTTON_A = 0;
const BUTTON_START = 9;

/** Polled gamepad: left stick moves, A dashes, Start pauses. */
export class GamepadInput {
  x = 0;
  y = 0;
  dash = false;
  private startHeld = false;

  constructor(private readonly onPause: () => void) {}

  poll(): void {
    this.x = this.y = 0;
    this.dash = false;
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (!pad) return;

    const [ax = 0, ay = 0] = pad.axes;
    if (Math.hypot(ax, ay) > STICK_DEAD_ZONE) {
      this.x = ax;
      this.y = ay;
    }
    this.dash = pad.buttons[BUTTON_A]?.pressed ?? false;

    const start = pad.buttons[BUTTON_START]?.pressed ?? false;
    if (start && !this.startHeld) this.onPause();
    this.startHeld = start;
  }
}
