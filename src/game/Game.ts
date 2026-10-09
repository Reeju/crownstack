import { Color, Scene, WebGLRenderer } from 'three';

const BACKGROUND = 0x1b1f2a;
const MAX_DPR = 2;

/** Owns the WebGL canvas. Simulation, input and the frame loop arrive in Phase 1. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.scene.background = new Color(BACKGROUND);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.renderer.setClearColor(BACKGROUND);
    this.renderer.clear();
  }
}
