import type { Intent } from '../sim/world';
import { GamepadInput } from './gamepad';
import { Joystick } from './joystick';
import { KeyboardInput } from './keyboard';
import { MouseInput } from './mouse';

/** Distance (world units) at which mouse-walking stops, so the king does not jitter on the cursor. */
const MOUSE_ARRIVE_DISTANCE = 0.25;

/** What the input layer needs to know about the camera to turn screen input into world input. */
export interface InputView {
  /** Camera yaw in radians; screen-up maps to world (-sin yaw, -cos yaw). */
  readonly yaw: number;
  /** Projects a client-space point onto the ground plane. */
  screenToGround(clientX: number, clientY: number, out: { x: number; y: number }): void;
}

/** Merges keyboard, touch joystick, mouse and gamepad into one world-space Intent. */
export class InputManager {
  readonly keyboard: KeyboardInput;
  private readonly joystick: Joystick;
  private readonly mouse: MouseInput;
  private readonly gamepad: GamepadInput;
  private readonly ground = { x: 0, y: 0 };

  constructor(target: HTMLElement, onPause: () => void) {
    this.keyboard = new KeyboardInput(onPause);
    this.joystick = new Joystick(target);
    this.mouse = new MouseInput(target);
    this.gamepad = new GamepadInput(onPause);
  }

  /** Fills `intent` for the next simulation step. */
  read(intent: Intent, view: InputView, heroX: number, heroY: number): void {
    this.gamepad.poll();
    const { keyboard, joystick, mouse, gamepad } = this;
    intent.dash = keyboard.dash || gamepad.dash || joystick.takeDash();

    // Screen-space direction from the first device that has one.
    let sx = keyboard.x;
    let sy = keyboard.y;
    if (sx === 0 && sy === 0) {
      sx = joystick.x;
      sy = joystick.y;
    }
    if (sx === 0 && sy === 0) {
      sx = gamepad.x;
      sy = gamepad.y;
    }

    if (sx !== 0 || sy !== 0) {
      const len = Math.max(1, Math.hypot(sx, sy));
      sx /= len;
      sy /= len;
      const sin = Math.sin(view.yaw);
      const cos = Math.cos(view.yaw);
      // right = (cos, -sin), up = (-sin, -cos); screen y points down.
      intent.moveX = cos * sx + sin * sy;
      intent.moveY = -sin * sx + cos * sy;
      return;
    }

    if (mouse.held) {
      view.screenToGround(mouse.clientX, mouse.clientY, this.ground);
      const dx = this.ground.x - heroX;
      const dy = this.ground.y - heroY;
      const dist = Math.hypot(dx, dy);
      if (dist > MOUSE_ARRIVE_DISTANCE) {
        intent.moveX = dx / dist;
        intent.moveY = dy / dist;
        return;
      }
    }
    intent.moveX = intent.moveY = 0;
  }

  dispose(): void {
    this.keyboard.dispose();
    this.joystick.dispose();
    this.mouse.dispose();
  }
}
