import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Scene,
  WebGLRenderer,
} from 'three';

import { C, CoinState, Kind } from '../sim/components';
import type { World } from '../sim/world';
import { IsoCamera } from './camera';
import { CoinStack } from './coinStack';
import { InstancedPool } from './instancing';
import { LevelView } from './levelView';
import { createModelMaterial } from './materials';
import { KING_HEAD_TOP, archerGeometry, kingGeometry } from './meshes/characters';
import {
  TOWER_DECK_HEIGHT,
  chestGeometry,
  coinGeometry,
  gearGeometry,
  towerGeometry,
} from './meshes/props';
import { PadView } from './padView';
import { ARCHER_TIER_COLORS, PALETTE } from './palette';

/** Characters are drawn larger than their collision radius so they read on a phone. */
const UNIT_SCALE = 1.5;
const GROUND_COIN_SCALE = 1.3;
const WALK_BOB_HEIGHT = 0.07;
const WALK_BOB_RATE = 14;
const PAY_STREAM_COINS = 5;
const PAY_STREAM_ARC = 1.6;

/** Render quality tier (SPEC §7.3). */
export type Quality = 'low' | 'high';

const QUALITY = {
  low: { antialias: false, maxDpr: 1 },
  high: { antialias: true, maxDpr: 2 },
} as const;

/** three.js view of a World. Reads simulation state; never writes it. */
export class GameRenderer {
  readonly iso = new IsoCamera();
  /** When true, camera shake and bobbing are suppressed (reduced motion). */
  reducedMotion = false;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly material = createModelMaterial();
  private readonly king: Mesh;
  private readonly squadRing: Mesh;
  private readonly archers: InstancedPool[];
  private readonly towers: InstancedPool;
  private readonly groundCoins: InstancedPool;
  private readonly stackCoins: InstancedPool;
  private readonly gear: InstancedPool;
  private readonly chests: InstancedPool;
  private readonly pools: InstancedPool[];
  private readonly coinStack = new CoinStack();
  private level: LevelView | null = null;
  private pads: PadView | null = null;
  private clock = 0;
  private snapCamera = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly quality: Quality,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: QUALITY[quality].antialias,
      powerPreference: 'high-performance',
    });
    this.scene.background = new Color(PALETTE.background);

    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 14, 8);
    this.scene.add(new AmbientLight(0xffffff, 1.5), sun);

    this.king = new Mesh(kingGeometry(), this.material);
    this.squadRing = new Mesh(
      new RingGeometry(1, 1.06, 48),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    this.squadRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.king, this.squadRing);

    this.archers = ARCHER_TIER_COLORS.map(
      (c) => new InstancedPool(archerGeometry(c), this.material, 96),
    );
    this.towers = new InstancedPool(towerGeometry(), this.material, 32);
    this.groundCoins = new InstancedPool(coinGeometry(), this.material, 600);
    this.stackCoins = new InstancedPool(coinGeometry(), this.material, 64);
    this.gear = new InstancedPool(gearGeometry(), this.material, 16);
    this.chests = new InstancedPool(chestGeometry(), this.material, 16);
    this.pools = [
      ...this.archers,
      this.towers,
      this.groundCoins,
      this.stackCoins,
      this.gear,
      this.chests,
    ];
    for (const pool of this.pools) this.scene.add(pool.mesh);
  }

  /** Replaces the per-level scenery for a freshly created world. */
  loadLevel(world: World): void {
    this.unloadLevel();
    this.level = new LevelView(world, this.material, this.iso.yaw);
    this.pads = new PadView(world, this.iso.yaw);
    this.scene.add(this.level.group, this.pads.group);
    this.squadRing.scale.setScalar(world.cfg.units.archer.ringRadius);
    this.snapCamera = true;
    this.resize(world);
  }

  resize(world: World): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[this.quality].maxDpr));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.iso.fit(clientWidth, clientHeight, world.cfg.map.cameraBounds);
    this.snapCamera = true;
  }

  render(world: World, alpha: number, frameSec: number): void {
    this.clock += frameSec;
    const w = world;
    const hero = w.hero;
    const hx = lerp(w.px[hero], w.x[hero], alpha);
    const hz = lerp(w.py[hero], w.y[hero], alpha);
    const heroAlive = w.hp[hero] > 0;
    const heroBob = this.bob(hero, w.vx[hero], w.vy[hero]);

    this.king.visible = heroAlive;
    this.king.position.set(hx, heroBob, hz);
    this.king.scale.setScalar(UNIT_SCALE);
    this.king.rotation.y = -w.facing[hero];
    this.squadRing.visible = heroAlive;
    this.squadRing.position.set(hx, 0.03, hz);
    this.iso.update(hx, hz, frameSec, this.snapCamera);
    this.snapCamera = false;

    for (const pool of this.pools) pool.begin();

    for (let e = 0; e < w.highWater; e++) {
      const kind = w.kind[e];
      if (kind === Kind.None || kind === Kind.King) continue;
      const x = lerp(w.px[e], w.x[e], alpha);
      const z = lerp(w.py[e], w.y[e], alpha);

      if (kind === Kind.Archer) {
        this.archers[w.def[e]].add(x, this.bob(e, w.vx[e], w.vy[e]), z, -w.facing[e], UNIT_SCALE);
      } else if (kind === Kind.Tower) {
        if (w.hp[e] <= 0) continue;
        const tier = w.plots[w.def[e]].tier;
        this.towers.add(x, 0, z, 0, 1, 1 + (tier - 1) * 0.12, 1);
        this.archers[Math.min(tier - 1, 2)].add(
          x,
          TOWER_DECK_HEIGHT * (1 + (tier - 1) * 0.12),
          z,
          -w.facing[e],
        );
      } else if (kind === Kind.Coin) {
        const blinkSec = w.cfg.units.economy.coinBlinkSec;
        const expiring = (w.mask[e] & C.Lifetime) !== 0 && w.timer[e] < blinkSec;
        if (expiring && w.state[e] === CoinState.Idle && Math.floor(w.timer[e] * 8) % 2 === 0)
          continue;
        this.groundCoins.add(
          x,
          0.16 + Math.sin(this.clock * 4 + e) * 0.04,
          z,
          this.clock * 2 + e,
          GROUND_COIN_SCALE,
        );
      } else if (kind === Kind.Chest) {
        this.chests.add(x, 0, z, Math.PI / 4);
      }
    }

    if (heroAlive) {
      this.coinStack.update(
        this.stackCoins,
        this.gear,
        hx,
        heroBob + KING_HEAD_TOP * UNIT_SCALE,
        hz,
        w.eco.stackCoins,
        w.eco.gear,
        frameSec,
        !this.reducedMotion,
      );
      this.drawPayStream(w);
    }

    for (const pool of this.pools) pool.end();
    this.level?.update(w);
    this.pads?.update(w);
    this.renderer.render(this.scene, this.iso.camera);
  }

  /** Draw calls issued by the last frame. */
  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.unloadLevel();
    for (const pool of this.pools) pool.dispose();
    this.king.geometry.dispose();
    this.squadRing.geometry.dispose();
    (this.squadRing.material as MeshBasicMaterial).dispose();
    this.material.dispose();
    this.renderer.dispose();
  }

  /** Coins arcing from the top of the stack into the pad being paid (the ad's dotted line). */
  private drawPayStream(w: World): void {
    for (const pad of w.pads) {
      if (!pad.paying) continue;
      const top = this.coinStack.top;
      for (let i = 0; i < PAY_STREAM_COINS; i++) {
        const t = (this.clock * 1.8 + i / PAY_STREAM_COINS) % 1;
        this.groundCoins.add(
          lerp(top.x, pad.x, t),
          lerp(top.y, 0.1, t) + Math.sin(t * Math.PI) * PAY_STREAM_ARC,
          lerp(top.z, pad.y, t),
          t * 6,
          0.7,
        );
      }
    }
  }

  private bob(e: number, vx: number, vy: number): number {
    if (this.reducedMotion || vx * vx + vy * vy < 0.25) return 0;
    return Math.abs(Math.sin(this.clock * WALK_BOB_RATE + e)) * WALK_BOB_HEIGHT;
  }

  private unloadLevel(): void {
    if (this.level) {
      this.scene.remove(this.level.group);
      this.level.dispose();
      this.level = null;
    }
    if (this.pads) {
      this.scene.remove(this.pads.group);
      this.pads.dispose();
      this.pads = null;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
