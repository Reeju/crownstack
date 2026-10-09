import { getLevel, getMap, units } from '../content';
import type { Difficulty } from '../content/schema';
import { InputManager } from './input';
import { FixedLoop } from './loop';
import { GameRenderer, type Quality } from './render/scene';
import { totalGold } from './sim/economy';
import { createWorld } from './sim/load';
import { runSeed } from './sim/rng';
import { step } from './sim/step';
import { NO_META, type MetaBonuses, type World } from './sim/world';

/** Values the HUD shows; pushed to the UI only when one of them changes. */
export interface HudState {
  levelName: string;
  gold: number;
}

export interface GameCallbacks {
  onHud(hud: HudState): void;
  /** The player asked to pause (Esc / P / Start, or the tab was hidden). */
  onPauseRequest(): void;
}

export interface RunOptions {
  levelId: number;
  attempt: number;
  difficulty: Difficulty;
  meta?: MetaBonuses;
}

/** Smoothed frame timings for the `?debug=1` overlay and the performance tests. */
export interface PerfStats {
  fps: number;
  simMs: number;
  renderMs: number;
  drawCalls: number;
}

const BACKDROP_LEVEL = 1;
const PERF_SMOOTHING = 0.05;

/**
 * Owns the frame loop, input, simulation and renderer (SPEC §6.2). React talks
 * to it through start/pause/resume and receives HUD updates via callbacks.
 */
export class Game {
  private readonly renderer: GameRenderer;
  private readonly input: InputManager;
  private readonly loop: FixedLoop;
  private readonly resizeObserver: ResizeObserver;
  private world: World;
  private readonly hud: HudState = { levelName: '', gold: -1 };
  readonly perf: PerfStats = { fps: 60, simMs: 0, renderMs: 0, drawCalls: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    private readonly callbacks: GameCallbacks,
  ) {
    const params = new URLSearchParams(location.search);
    const quality: Quality = params.get('quality') === 'low' ? 'low' : 'high';
    this.renderer = new GameRenderer(canvas, quality);
    this.input = new InputManager(canvas, () => this.callbacks.onPauseRequest());
    this.loop = new FixedLoop({ step: this.step, render: this.render });

    // Until a level starts, an idle copy of the first level is the menu backdrop.
    this.world = this.createRun({ levelId: BACKDROP_LEVEL, attempt: 0, difficulty: 'normal' });
    this.renderer.loadLevel(this.world);
    this.loop.paused = true;

    this.resizeObserver = new ResizeObserver(() => this.renderer.resize(this.world));
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.loop.start();

    // `?debug=1` exposes the game for the Playwright scripts and debug overlay.
    if (params.has('debug')) {
      (window as unknown as { __crownstack?: Game }).__crownstack = this;
    }
  }

  /** True once the player has pressed a key, so the UI can show keyboard hints. */
  get keyboardUsed(): boolean {
    return this.input.keyboard.used;
  }

  /** Read-only view of the current world, for tests and debug tooling. */
  get currentWorld(): World {
    return this.world;
  }

  start(options: RunOptions): void {
    this.world = this.createRun(options);
    this.renderer.loadLevel(this.world);
    this.hud.gold = -1;
    this.loop.paused = false;
  }

  pause(): void {
    this.loop.paused = true;
  }

  resume(): void {
    this.loop.paused = false;
  }

  dispose(): void {
    this.loop.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.input.dispose();
    this.renderer.dispose();
  }

  private createRun(options: RunOptions): World {
    const level = getLevel(options.levelId);
    return createWorld({
      level,
      map: getMap(level.map),
      units,
      seed: runSeed(options.levelId, options.attempt),
      difficulty: options.difficulty,
      meta: options.meta ?? NO_META,
    });
  }

  private readonly step = (): void => {
    const w = this.world;
    const t0 = performance.now();
    this.input.read(w.intent, this.renderer.iso, w.x[w.hero], w.y[w.hero]);
    step(w);
    this.perf.simMs += (performance.now() - t0 - this.perf.simMs) * PERF_SMOOTHING;
  };

  private readonly render = (alpha: number, frameSec: number): void => {
    const t0 = performance.now();
    this.renderer.render(this.world, alpha, frameSec);
    const perf = this.perf;
    perf.renderMs += (performance.now() - t0 - perf.renderMs) * PERF_SMOOTHING;
    if (frameSec > 0) perf.fps += (1 / frameSec - perf.fps) * PERF_SMOOTHING;
    perf.drawCalls = this.renderer.drawCalls;
    this.syncHud();
  };

  private syncHud(): void {
    const gold = totalGold(this.world);
    const levelName = this.world.cfg.level.name;
    if (gold === this.hud.gold && levelName === this.hud.levelName) return;
    this.hud.gold = gold;
    this.hud.levelName = levelName;
    this.callbacks.onHud({ ...this.hud });
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden && !this.loop.paused) this.callbacks.onPauseRequest();
  };
}
