import { DT } from './sim/components';

const MAX_STEPS_PER_FRAME = 5;

export interface LoopCallbacks {
  /** Advance the simulation by exactly DT. */
  step(): void;
  /** Draw a frame. `alpha` in [0, 1) blends the last two simulation states. */
  render(alpha: number, frameSec: number): void;
}

/**
 * Converts a variable frame time into a whole number of fixed steps.
 * Returns the number of steps to run; `state.acc` keeps the remainder.
 * Excess time beyond MAX_STEPS_PER_FRAME is dropped so a slow frame cannot
 * snowball into a "spiral of death".
 */
export function consumeFrame(state: { acc: number }, frameSec: number): number {
  state.acc += frameSec;
  let steps = Math.floor(state.acc / DT);
  if (steps > MAX_STEPS_PER_FRAME) {
    steps = MAX_STEPS_PER_FRAME;
    state.acc = 0;
  } else {
    state.acc -= steps * DT;
  }
  return steps;
}

/** requestAnimationFrame driver with a fixed-step accumulator (SPEC §6.3). */
export class FixedLoop {
  /** When true the simulation does not advance and frames are drawn only on request. */
  paused = false;
  private pendingFrames = 0;
  private readonly state = { acc: 0 };
  private raf = 0;
  private last = 0;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.raf !== 0) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Draws a few frames while paused: after a resize, a setting change or the pause itself. */
  requestRender(frames = 2): void {
    this.pendingFrames = Math.max(this.pendingFrames, frames);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const frameSec = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;

    if (this.paused) {
      // Nothing moves while paused, so frames are drawn only on request. An idle
      // menu then costs no CPU or battery.
      this.state.acc = 0;
      if (this.pendingFrames > 0) {
        this.pendingFrames--;
        this.callbacks.render(1, frameSec);
      }
      return;
    }
    const steps = consumeFrame(this.state, frameSec);
    for (let i = 0; i < steps; i++) this.callbacks.step();
    this.callbacks.render(this.state.acc / DT, frameSec);
  };
}
