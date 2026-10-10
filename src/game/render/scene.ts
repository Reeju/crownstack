import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  PCFSoftShadowMap,
  Scene,
  Shape,
  ShapeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

import type { EnemyModel } from '../../content/schema';
import { C, CoinState, Kind } from '../sim/components';
import { Ev, type EvType } from '../sim/events';
import type { World } from '../sim/world';
import { BillboardPool, billboardBasis } from './billboards';
import { IsoCamera } from './camera';
import { CoinStack } from './coinStack';
import { InstancedPool } from './instancing';
import { LevelView } from './levelView';
import { createModelMaterial } from './materials';
import { KING_HEAD_TOP, archerGeometry, kingGeometry } from './meshes/characters';
import {
  ENEMY_GEOMETRY,
  ENEMY_HEIGHT,
  ENEMY_MODELS,
  ENEMY_VISUAL_SCALE,
  arrowGeometry,
} from './meshes/enemies';
import {
  TOWER_DECK_HEIGHT,
  chestGeometry,
  coinGeometry,
  gearGeometry,
  pointerGeometry,
  towerGeometry,
} from './meshes/props';
import { PadView } from './padView';
import { ARCHER_TIER_COLORS, PALETTE } from './palette';
import { Particles } from './particles';
import { Popups } from './popups';

/** Characters are drawn larger than their collision radius so they read on a phone. */
const UNIT_SCALE = 1.5;
const GROUND_COIN_SCALE = 1.3;
const WALK_BOB_HEIGHT = 0.07;
const WALK_BOB_RATE = 14;
const CHEER_JUMP_HEIGHT = 0.55;
const PAY_STREAM_COINS = 5;
const PAY_STREAM_ARC = 1.6;
const ARROW_HEIGHT = 1.2;
const BAR_HEIGHT = 0.16;
const BAR_BACK = 0x1b1f2a;
const BAR_PLAYER = 0x58d66b;
const BAR_ENEMY = 0xe53935;
const SHAKE_SEC = 0.12;
const SHAKE_AMPLITUDE = 0.18;
/** The king blinks at this rate (Hz) while his i-frames are active. */
const IFRAME_BLINK_HZ = 12;
const DAY = { ambientColor: 0xffffff, ambient: 1.5, sunColor: 0xffffff, sun: 2.2 };
const NIGHT = {
  ambientColor: 0x6f82d8,
  ambient: 1.25,
  /** Ambient level once the brazier is lit. */
  ambientLit: 1.7,
  sunColor: 0x8fa5ff,
  sun: 0.8,
  fog: 0x0b1030,
};

/** Render quality tier (SPEC §7.3). */
export type Quality = 'low' | 'high';

/** Low: no shadows, 150 particles, DPR 1. High: 1024 shadow map, 600 particles, DPR 2. */
const QUALITY = {
  low: { antialias: false, maxDpr: 1, shadows: false, particleDensity: 0.25 },
  high: { antialias: true, maxDpr: 2, shadows: true, particleDensity: 1 },
} as const;
const MAX_PARTICLES = 600;
const SHADOW_MAP_SIZE = 1024;
/** Direction from the scene toward the sun. */
const SUN_DIRECTION = new Vector3(-6, 14, 8).normalize();
const MARKER_SIZE = 0.42;

/** three.js view of a World. Reads simulation state; never writes it. */
export class GameRenderer {
  readonly iso = new IsoCamera();
  /** When true, camera shake and bobbing are suppressed (reduced motion). */
  reducedMotion = false;
  /** When true, enemies carry shape markers (raider triangle, giant square). */
  colorBlind = false;
  /** Index of the pad the tutorial is pointing at, or -1. */
  pointAtPad = -1;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly ambient = new AmbientLight();
  private readonly sun = new DirectionalLight();
  private night = false;
  private readonly material = createModelMaterial();
  private readonly king: Mesh;
  private readonly squadRing: Mesh;
  private readonly pointer: Mesh;
  /** True while the win celebration plays: player units jump for joy. */
  private celebrating = false;
  private readonly archers: InstancedPool[];
  private readonly towers: InstancedPool;
  private readonly groundCoins: InstancedPool;
  private readonly stackCoins: InstancedPool;
  private readonly gear: InstancedPool;
  private readonly chests: InstancedPool;
  private readonly arrows: InstancedPool;
  private readonly enemies: Record<EnemyModel, InstancedPool>;
  private readonly pools: InstancedPool[];
  private readonly barBack: BillboardPool;
  private readonly barFill: BillboardPool;
  private readonly particles: Particles;
  private readonly markerTriangles: BillboardPool;
  private readonly markerSquares: BillboardPool;
  private popups: Popups | null = null;
  private readonly basis = billboardBasis(this.iso.yaw, this.iso.pitch);
  private readonly coinStack = new CoinStack();
  private level: LevelView | null = null;
  private pads: PadView | null = null;
  private clock = 0;
  private snapCamera = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private quality: Quality,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: QUALITY[quality].antialias,
      powerPreference: 'high-performance',
    });
    this.scene.background = new Color(PALETTE.background);

    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.ambient, this.sun, this.sun.target);

    this.king = new Mesh(kingGeometry(), this.material);
    this.squadRing = new Mesh(
      new RingGeometry(1, 1.06, 48),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    this.squadRing.rotation.x = -Math.PI / 2;
    this.pointer = new Mesh(pointerGeometry(), this.material);
    this.pointer.visible = false;
    this.scene.add(this.king, this.squadRing, this.pointer);

    this.archers = ARCHER_TIER_COLORS.map(
      (c) => new InstancedPool(archerGeometry(c), this.material, 96),
    );
    this.towers = new InstancedPool(towerGeometry(), this.material, 32);
    this.groundCoins = new InstancedPool(coinGeometry(), this.material, 600);
    this.stackCoins = new InstancedPool(coinGeometry(), this.material, 64);
    this.gear = new InstancedPool(gearGeometry(), this.material, 16);
    this.chests = new InstancedPool(chestGeometry(), this.material, 16);
    this.arrows = new InstancedPool(arrowGeometry(), this.material, 256);
    this.enemies = Object.fromEntries(
      ENEMY_MODELS.map((model) => [
        model,
        new InstancedPool(ENEMY_GEOMETRY[model](), this.material, model === 'raider' ? 400 : 96),
      ]),
    ) as Record<EnemyModel, InstancedPool>;
    this.pools = [
      ...this.archers,
      ...Object.values(this.enemies),
      this.towers,
      this.groundCoins,
      this.stackCoins,
      this.gear,
      this.chests,
      this.arrows,
    ];
    for (const pool of this.pools) this.scene.add(pool.mesh);

    this.barBack = new BillboardPool(this.basis, 256, true);
    this.barFill = new BillboardPool(this.basis, 256, true);
    this.barFill.mesh.renderOrder = 11;
    this.particles = new Particles(this.basis, MAX_PARTICLES);

    // Colour-blind shape markers: a triangle over raiders and brutes, a square over giants and bosses.
    const triangle = new Shape().moveTo(0, 0.6).lineTo(0.55, -0.4).lineTo(-0.55, -0.4).closePath();
    this.markerTriangles = new BillboardPool(this.basis, 512, false, new ShapeGeometry(triangle));
    this.markerSquares = new BillboardPool(this.basis, 128);
    this.scene.add(this.markerTriangles.mesh, this.markerSquares.mesh);

    for (const pool of this.pools) pool.mesh.castShadow = true;
    this.king.castShadow = true;
    this.setQuality(quality);
    this.scene.add(this.barBack.mesh, this.barFill.mesh, this.particles.pool.mesh);
  }

  /** Replaces the per-level scenery for a freshly created world. */
  loadLevel(world: World): void {
    this.unloadLevel();
    this.level = new LevelView(world, this.material, this.iso.yaw);
    this.pads = new PadView(world, this.iso.yaw);
    this.popups = new Popups(this.basis, world.cfg.units);
    this.scene.add(this.level.group, this.pads.mesh, this.popups.mesh);
    this.applyLighting(world.cfg.level.night);

    // Aim the sun (and its shadow frustum) at the middle of the map.
    const { w: mapW, h: mapH } = world.cfg.map.size;
    const reach = Math.max(mapW, mapH) * 0.8;
    this.sun.target.position.set(mapW / 2, 0, mapH / 2);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIRECTION, 70);
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = shadowCamera.bottom = -reach;
    shadowCamera.right = shadowCamera.top = reach;
    shadowCamera.near = 1;
    shadowCamera.far = 160;
    shadowCamera.updateProjectionMatrix();
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
    this.celebrating = w.celebrate >= 0 || w.outcome === 'won';
    const heroBob = this.bob(hero, w.vx[hero], w.vy[hero], true);

    const blinking = w.king.iframes > 0 && Math.floor(this.clock * IFRAME_BLINK_HZ) % 2 === 0;
    this.king.visible = heroAlive && !blinking;
    this.king.position.set(hx, heroBob, hz);
    this.king.scale.setScalar(UNIT_SCALE);
    this.king.rotation.y = -w.facing[hero];
    this.squadRing.visible = heroAlive;
    this.squadRing.position.set(hx, 0.03, hz);
    this.iso.update(hx, hz, frameSec, this.snapCamera);
    this.snapCamera = false;

    for (const pool of this.pools) pool.begin();
    this.barBack.begin();
    this.barFill.begin();
    this.markerTriangles.begin();
    this.markerSquares.begin();
    if (heroAlive) this.bar(hx, 2.1, hz, 1.2, w.hp[hero] / w.maxHp[hero], BAR_PLAYER, false);

    for (let e = 0; e < w.highWater; e++) {
      const kind = w.kind[e];
      if (kind === Kind.None || kind === Kind.King) continue;
      const x = lerp(w.px[e], w.x[e], alpha);
      const z = lerp(w.py[e], w.y[e], alpha);

      if (kind === Kind.Archer) {
        this.archers[w.def[e]].add(
          x,
          this.bob(e, w.vx[e], w.vy[e], true),
          z,
          -w.facing[e],
          UNIT_SCALE,
        );
        this.bar(x, 1.9, z, 0.9, w.hp[e] / w.maxHp[e], BAR_PLAYER, false);
      } else if (kind === Kind.Enemy) {
        const def = w.enemyDefs[w.def[e]];
        const pool = this.enemies[def.model];
        const scale = def.scale * ENEMY_VISUAL_SCALE[def.model];
        // Staggered enemies sway on the spot.
        const sway =
          w.stun[e] > 0 && !this.reducedMotion ? Math.sin(this.clock * 30 + e) * 0.25 : 0;
        const i = pool.add(x, this.bob(e, w.vx[e], w.vy[e]), z, -w.facing[e] + sway, scale);
        if (w.flash[e] > 0) pool.tint(i, 2.4, 0.7, 0.7);
        else pool.tint(i, 1, 1, 1);
        const big = def.boss || def.model === 'giant';
        this.bar(
          x,
          ENEMY_HEIGHT[def.model] * scale + 0.3,
          z,
          big ? 2 : 0.9,
          w.hp[e] / w.maxHp[e],
          BAR_ENEMY,
          big,
        );
        if (this.colorBlind) {
          const markerY = ENEMY_HEIGHT[def.model] * scale + 0.75;
          const size = big ? MARKER_SIZE * 1.8 : MARKER_SIZE;
          (big ? this.markerSquares : this.markerTriangles).add(
            x,
            markerY,
            z,
            size,
            size,
            PALETTE.white,
          );
        }
      } else if (kind === Kind.Arrow) {
        this.arrows.add(x, ARROW_HEIGHT, z, -w.facing[e]);
      } else if (kind === Kind.Fence) {
        if (w.hp[e] > 0) this.bar(x, 1.9, z, 1.4, w.hp[e] / w.maxHp[e], BAR_PLAYER, false);
      } else if (kind === Kind.Keep) {
        if (w.hp[e] > 0) this.bar(x, 5.2, z, 3, w.hp[e] / w.maxHp[e], BAR_PLAYER, false);
      } else if (kind === Kind.Tower) {
        if (w.hp[e] <= 0) continue;
        const tier = w.plots[w.def[e]].tier;
        this.towers.add(x, 0, z, 0, 1, 1 + (tier - 1) * 0.12, 1);
        this.archers[Math.min(tier - 1, 2)].add(
          x,
          TOWER_DECK_HEIGHT * (1 + (tier - 1) * 0.12),
          z,
          -w.facing[e],
          UNIT_SCALE,
        );
        this.bar(x, 3.6, z, 1.2, w.hp[e] / w.maxHp[e], BAR_PLAYER, false);
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

    const pad = this.pointAtPad >= 0 ? w.pads[this.pointAtPad] : null;
    this.pointer.visible = pad !== null;
    if (pad) {
      const hop = this.reducedMotion ? 0 : Math.abs(Math.sin(this.clock * 4)) * 0.5;
      this.pointer.position.set(pad.x, 1.6 + hop, pad.y);
      this.pointer.rotation.y = this.clock * 2;
    }

    for (const pool of this.pools) pool.end();
    this.barBack.end();
    this.barFill.end();
    this.markerTriangles.end();
    this.markerSquares.end();
    this.particles.update(frameSec);
    this.popups?.update(frameSec);
    if (this.night) this.ambient.intensity = w.eco.brazierLit ? NIGHT.ambientLit : NIGHT.ambient;
    this.level?.update(w);
    this.pads?.update(w);
    this.renderer.render(this.scene, this.iso.camera);
  }

  /** Turns a simulation event into visual feedback (popups, sparks, shake). */
  onEvent(type: EvType, x: number, z: number, a: number, b: number): void {
    switch (type) {
      case Ev.Damage: {
        const hurtsPlayer = b !== Kind.Enemy;
        this.popups?.spawn(x, 1.6, z, a, hurtsPlayer);
        this.particles.burst(x, 0.9, z, 8, hurtsPlayer ? PALETTE.enemyRed : PALETTE.white, 2.6);
        break;
      }
      case Ev.EnemyKilled:
        this.particles.burst(x, 0.8, z, b > 0 ? 40 : 10, PALETTE.enemyRed, b > 0 ? 5 : 3.2, 0.2);
        this.particles.burst(x, 0.8, z, b > 0 ? 20 : 4, PALETTE.gold, 3.5);
        break;
      case Ev.HeavyHit:
      case Ev.Slam:
        if (!this.reducedMotion) this.iso.shake(SHAKE_SEC, SHAKE_AMPLITUDE);
        if (type === Ev.Slam) this.particles.burst(x, 0.3, z, 40, PALETTE.dirt, a * 1.6, 0.26);
        break;
      case Ev.FenceBroken:
        this.particles.burst(x, 0.8, z, 24, PALETTE.wood, 4, 0.22);
        break;
      case Ev.UnitDied:
        this.particles.burst(x, 0.8, z, 14, PALETTE.white, 3);
        break;
      case Ev.PadPaid:
        this.particles.burst(x, 0.4, z, 24, PALETTE.padGreen, 4.5, 0.2);
        break;
      case Ev.GearDelivered:
        this.particles.burst(x, 1.2, z, 12, PALETTE.gearBlue, 3);
        break;
      case Ev.WavesCleared:
        // Reward burst: a fountain of gold over the king.
        this.particles.burst(x, 1.5, z, 90, PALETTE.gold, 7, 0.24);
        this.particles.burst(x, 1.5, z, 40, PALETTE.white, 5, 0.16);
        break;
      case Ev.ChestOpened:
        this.particles.burst(x, 0.6, z, 20, PALETTE.gold, 4.5, 0.2);
        break;
      default:
        break;
    }
  }

  /** Switches quality tier at runtime: shadows, particle density and pixel ratio. */
  setQuality(quality: Quality): void {
    const tier = QUALITY[quality];
    this.quality = quality;
    this.particles.density = tier.particleDensity;
    if (this.renderer.shadowMap.enabled !== tier.shadows) {
      this.renderer.shadowMap.enabled = tier.shadows;
      this.sun.castShadow = tier.shadows;
      // Materials compile shadow support in, so they must be rebuilt.
      this.scene.traverse((object) => {
        const material = (object as Mesh).material;
        if (material && !Array.isArray(material)) material.needsUpdate = true;
      });
    }
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth > 0 && clientHeight > 0) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.maxDpr));
      this.renderer.setSize(clientWidth, clientHeight, false);
    }
  }

  get currentQuality(): Quality {
    return this.quality;
  }

  /** Day or night palette: night dims and blues the lights and adds dark-blue fog. */
  private applyLighting(night: boolean): void {
    const look = night ? NIGHT : DAY;
    this.night = night;
    this.ambient.color.setHex(look.ambientColor);
    this.ambient.intensity = look.ambient;
    this.sun.color.setHex(look.sunColor);
    this.sun.intensity = look.sun;
    this.scene.fog = night ? new Fog(NIGHT.fog, 60, 150) : null;
    (this.scene.background as Color).setHex(night ? NIGHT.fog : PALETTE.background);
  }

  /** Draw calls issued by the last frame. */
  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.unloadLevel();
    for (const pool of this.pools) pool.dispose();
    this.barBack.dispose();
    this.barFill.dispose();
    this.markerTriangles.dispose();
    this.markerSquares.dispose();
    this.particles.dispose();
    this.king.geometry.dispose();
    this.pointer.geometry.dispose();
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

  /** HP bar above a unit. Hidden at full health unless `always` is set. */
  private bar(
    x: number,
    y: number,
    z: number,
    width: number,
    ratio: number,
    hex: number,
    always: boolean,
  ): void {
    if (!always && ratio >= 1) return;
    const left = -width / 2;
    const lx = x + this.basis.rx * left;
    const lz = z + this.basis.rz * left;
    this.barBack.add(lx, y, lz, width, BAR_HEIGHT, BAR_BACK);
    this.barFill.add(lx, y, lz, width * Math.max(ratio, 0), BAR_HEIGHT * 0.7, hex);
  }

  /** Vertical offset for a unit: a walk bob, or a jump for player units during the celebration. */
  private bob(e: number, vx: number, vy: number, cheers = false): number {
    if (this.reducedMotion) return 0;
    if (cheers && this.celebrating)
      return Math.abs(Math.sin(this.clock * 9 + e)) * CHEER_JUMP_HEIGHT;
    if (vx * vx + vy * vy < 0.25) return 0;
    return Math.abs(Math.sin(this.clock * WALK_BOB_RATE + e)) * WALK_BOB_HEIGHT;
  }

  private unloadLevel(): void {
    if (this.level) {
      this.scene.remove(this.level.group);
      this.level.dispose();
      this.level = null;
    }
    if (this.pads) {
      this.scene.remove(this.pads.mesh);
      this.pads.dispose();
      this.pads = null;
    }
    if (this.popups) {
      this.scene.remove(this.popups.mesh);
      this.popups.dispose();
      this.popups = null;
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
