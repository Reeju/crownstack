import { getLevel, getMap, units } from '../content';
import type { Difficulty } from '../content/schema';
import { AudioManager } from './audio';
import { InputManager } from './input';
import { FixedLoop } from './loop';
import { GameRenderer, type Quality } from './render/scene';
import { WAVE_ANNOUNCE_SEC } from './sim/constants';
import { totalGold } from './sim/economy';
import { Ev, type EvType } from './sim/events';
import { createWorld } from './sim/load';
import { runSeed } from './sim/rng';
import { runResult, type RunResult } from './sim/score';
import { step } from './sim/step';
import { NO_META, type MetaBonuses, type World } from './sim/world';
import { Tutorial } from './tutorial';

/** Values the HUD shows; pushed to the UI only when one of them changes. */
export interface HudState {
  levelName: string;
  gold: number;
  /** Waves started so far and the level's total. */
  wave: number;
  waveCount: number;
  /** Keep HP as a 0..100 percentage. */
  keepHp: number;
  /** Number of the wave being announced, or 0 when no banner is showing. */
  bannerWave: number;
  /** Screen-space direction (degrees, 0 = right, clockwise) toward the announced wave's spawn. */
  bannerAngle: number;
  /** Tutorial hint text, or '' when none is showing. */
  hint: string;
  /** True once a key has been pressed, so keyboard hints can be shown (SPEC §7.2). */
  keyboard: boolean;
  /** Whether this level has the dash ability. */
  dash: boolean;
}

export interface GameCallbacks {
  onHud(hud: HudState): void;
  /** The player asked to pause (Esc / P / Start, or the tab was hidden). */
  onPauseRequest(): void;
  onOutcome(won: boolean, result: RunResult): void;
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

/** The player's quality choice; `auto` picks a tier with a short benchmark at launch. */
export type QualitySetting = 'auto' | Quality;

export interface GameSettings {
  music: number;
  sfx: number;
  haptics: boolean;
  reducedMotion: boolean;
  colorBlind: boolean;
  quality: QualitySetting;
}

const BACKDROP_LEVEL = 1;
const PERF_SMOOTHING = 0.05;
/**
 * Auto quality (SPEC §7.3): the benchmark runs in the first seconds of the
 * first level played. After a warm-up (shader compiles, the opening camera
 * snap), one second of frames decides the tier.
 */
const BENCHMARK_WARMUP_SEC = 2.5;
const BENCHMARK_SEC = 1;
const BENCHMARK_MIN_FPS = 45;
/**
 * The tier last used is remembered so the next launch can create its WebGL
 * context to match (antialiasing cannot be changed on a live context).
 */
const TIER_KEY = 'crownstack.tier';

function storedTier(): Quality | null {
  try {
    const tier = localStorage.getItem(TIER_KEY);
    return tier === 'low' || tier === 'high' ? tier : null;
  } catch {
    return null;
  }
}

/**
 * Owns the frame loop, input, simulation and renderer (SPEC §6.2). React talks
 * to it through start/pause/resume and receives HUD updates via callbacks.
 */
export class Game {
  readonly perf: PerfStats = { fps: 60, simMs: 0, renderMs: 0, drawCalls: 0 };
  private readonly renderer: GameRenderer;
  private readonly audio = new AudioManager();
  private readonly input: InputManager;
  /** Quality forced by `?quality=`, which wins over the saved setting (used by tests). */
  private readonly forcedQuality: Quality | null;
  private benchmark: { elapsed: number; frames: number } | null = null;
  private readonly loop: FixedLoop;
  private readonly resizeObserver: ResizeObserver;
  private world: World;
  private hud: HudState = emptyHud();
  private bannerWave = 0;
  private bannerUntil = 0;
  private bannerSpawn = { x: 0, y: 0 };
  private readonly screenPoint = { x: 0, y: 0 };
  private tutorial: Tutorial | null = null;
  private autoQualityDone = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: GameCallbacks,
  ) {
    const params = new URLSearchParams(location.search);
    const requested = params.get('quality');
    this.forcedQuality = requested === 'low' || requested === 'high' ? requested : null;
    this.renderer = new GameRenderer(canvas, this.forcedQuality ?? storedTier() ?? 'high');
    this.input = new InputManager(canvas, () => this.callbacks.onPauseRequest());
    this.loop = new FixedLoop({ step: this.step, render: this.render });

    // Until a level starts, an idle copy of the first level is the menu backdrop.
    this.world = this.createRun({ levelId: BACKDROP_LEVEL, attempt: 0, difficulty: 'normal' });
    this.renderer.loadLevel(this.world);
    this.loop.paused = true;
    // Compile shaders off the main thread where the browser can, then draw the backdrop once.
    void this.renderer.precompile().then(() => this.loop.requestRender());

    this.resizeObserver = new ResizeObserver(() => {
      this.renderer.resize(this.world);
      this.loop.requestRender();
    });
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.loop.start();

    // `?debug=1` exposes the game for the Playwright scripts and debug overlay.
    if (params.has('debug')) {
      (window as unknown as { __crownstack?: Game }).__crownstack = this;
    }
  }

  /** Applies the player's settings: accessibility, audio levels and quality tier. */
  applySettings(settings: GameSettings): void {
    this.renderer.reducedMotion = settings.reducedMotion;
    this.renderer.colorBlind = settings.colorBlind;
    this.audio.applySettings(settings);
    this.loop.requestRender();

    if (this.forcedQuality) return;
    if (settings.quality === 'auto') {
      if (!this.autoQualityDone) this.benchmark = { elapsed: -BENCHMARK_WARMUP_SEC, frames: 0 };
    } else {
      this.benchmark = null;
      this.setTier(settings.quality);
    }
  }

  private setTier(tier: Quality): void {
    this.renderer.setQuality(tier);
    try {
      localStorage.setItem(TIER_KEY, tier);
    } catch {
      // Without storage the tier is simply measured again next launch.
    }
  }

  /** Quality tier currently in use. */
  get quality(): Quality {
    return this.renderer.currentQuality;
  }

  /** Read-only view of the current world, for tests and debug tooling. */
  get currentWorld(): World {
    return this.world;
  }

  start(options: RunOptions): void {
    this.world = this.createRun(options);
    this.renderer.loadLevel(this.world);
    this.hud = emptyHud();
    this.bannerWave = 0;
    this.tutorial = new Tutorial(this.world.cfg.level);
    this.loop.paused = false;
  }

  pause(): void {
    this.loop.paused = true;
    this.loop.requestRender();
  }

  resume(): void {
    this.loop.paused = false;
  }

  dispose(): void {
    this.loop.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.input.dispose();
    this.audio.dispose();
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

    const ev = w.events;
    for (let i = 0; i < ev.count; i++) {
      this.handleEvent(ev.type[i] as EvType, ev.x[i], ev.y[i], ev.a[i], ev.b[i]);
    }
  };

  private handleEvent(type: EvType, x: number, y: number, a: number, b: number): void {
    this.renderer.onEvent(type, x, y, a, b);
    this.audio.onEvent(this.world, type, a, b);
    switch (type) {
      case Ev.WaveAnnounced:
        this.bannerWave = a + 1;
        this.bannerUntil = this.world.time + WAVE_ANNOUNCE_SEC;
        this.bannerSpawn = { x, y };
        break;
      case Ev.LevelWon:
      case Ev.LevelLost:
        this.pause();
        this.callbacks.onOutcome(type === Ev.LevelWon, runResult(this.world));
        break;
      default:
        break;
    }
  }

  private readonly render = (alpha: number, frameSec: number): void => {
    const t0 = performance.now();
    this.renderer.render(this.world, alpha, frameSec);
    const perf = this.perf;
    perf.renderMs += (performance.now() - t0 - perf.renderMs) * PERF_SMOOTHING;
    perf.drawCalls = this.renderer.drawCalls;
    // Frame rate is only meaningful while frames are drawn continuously.
    if (!this.loop.paused) {
      if (frameSec > 0) perf.fps += (1 / frameSec - perf.fps) * PERF_SMOOTHING;
      this.runBenchmark(frameSec);
    }
    this.syncHud();
  };

  /** Auto quality: drop to the low tier if the device cannot hold the frame rate. */
  private runBenchmark(frameSec: number): void {
    const bench = this.benchmark;
    if (!bench || document.hidden) return;
    bench.elapsed += frameSec;
    if (bench.elapsed <= 0) return;
    bench.frames++;
    if (bench.elapsed < BENCHMARK_SEC) return;
    this.setTier(bench.frames / bench.elapsed < BENCHMARK_MIN_FPS ? 'low' : 'high');
    this.benchmark = null;
    this.autoQualityDone = true;
  }

  private syncHud(): void {
    const w = this.world;
    const prev = this.hud;
    const bannerWave = w.time < this.bannerUntil ? this.bannerWave : 0;
    let bannerAngle = prev.bannerAngle;
    if (bannerWave !== 0 && bannerWave !== prev.bannerWave) {
      // Point from the middle of the screen toward where the wave will appear.
      this.renderer.iso.groundToScreen(this.bannerSpawn.x, this.bannerSpawn.y, this.screenPoint);
      const dx = this.screenPoint.x - this.canvas.clientWidth / 2;
      const dy = this.screenPoint.y - this.canvas.clientHeight / 2;
      bannerAngle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    }
    // While paused the last hint stays up; otherwise the tutorial decides.
    const hint = this.loop.paused ? null : (this.tutorial?.update(w) ?? null);
    this.renderer.pointAtPad = hint ? hint.pad : -1;
    const next: HudState = {
      levelName: w.cfg.level.name,
      gold: totalGold(w),
      wave: w.wavesStarted,
      waveCount: w.waves.length,
      keepHp: Math.ceil((w.hp[w.keep] / w.maxHp[w.keep]) * 100),
      bannerWave,
      bannerAngle,
      hint: this.loop.paused ? prev.hint : (hint?.text ?? ''),
      keyboard: this.input.keyboard.used,
      dash: w.cfg.level.dash,
    };
    for (const key of Object.keys(next) as (keyof HudState)[]) {
      if (next[key] !== prev[key]) {
        this.hud = next;
        this.callbacks.onHud(next);
        return;
      }
    }
  }

  private readonly onVisibilityChange = (): void => {
    this.audio.setSuspended(document.hidden);
    if (document.hidden && !this.loop.paused) this.callbacks.onPauseRequest();
  };
}

function emptyHud(): HudState {
  return {
    levelName: '',
    gold: -1,
    wave: 0,
    waveCount: 0,
    keepHp: 100,
    bannerWave: 0,
    bannerAngle: 0,
    hint: '',
    keyboard: false,
    dash: false,
  };
}
