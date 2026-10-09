import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Material,
  type Texture,
} from 'three';

import type { MapDef } from '../../content/schema';
import type { PathData } from '../sim/pathing';
import type { World } from '../sim/world';
import {
  FENCE_POST_SPACING,
  archeryGeometry,
  brazierGeometry,
  fencePostGeometry,
  forgeGeometry,
  keepGeometry,
  rockGeometry,
  treeGeometry,
} from './meshes/props';
import { PALETTE } from './palette';

const PATH_HALF_WIDTH = 1.3;
const GROUND_SIZE = 400;
const PLOT_SIZE = 1.5;
const GROUND_COLORS = {
  grass: PALETTE.grass,
  dirt: PALETTE.dirt,
  cliff: PALETTE.cliff,
  water: PALETTE.water,
} as const;

const matrix = new Matrix4();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/** Flat ribbon following a sampled path, slightly above the ground. */
function pathRibbon(path: PathData): BufferGeometry {
  const n = path.xs.length;
  const positions = new Float32Array(n * 6);
  const normals = new Float32Array(n * 6);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(i - 1, 0);
    const b = Math.min(i + 1, n - 1);
    const tx = path.xs[b] - path.xs[a];
    const ty = path.ys[b] - path.ys[a];
    const len = Math.hypot(tx, ty) || 1;
    const nx = (-ty / len) * PATH_HALF_WIDTH;
    const ny = (tx / len) * PATH_HALF_WIDTH;
    positions.set(
      [path.xs[i] + nx, 0.02, path.ys[i] + ny, path.xs[i] - nx, 0.02, path.ys[i] - ny],
      i * 6,
    );
    normals.set([0, 1, 0, 0, 1, 0], i * 6);
    if (i < n - 1) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setAttribute('normal', new BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

/** White plate with a bow icon that marks an empty tower plot. */
function plotTexture(): Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(6, 6, size - 12, size - 12, 18);
  ctx.fill();
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(52, 64, 36, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(63, 31);
  ctx.lineTo(63, 97);
  ctx.moveTo(30, 64);
  ctx.lineTo(104, 64);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Everything that is built once per level: ground, paths, palisade, keep,
 * buildings, scenery and plot markers. Only fences, the keep, the archery
 * house and plot markers change afterwards.
 */
export class LevelView {
  readonly group = new Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly posts: InstancedMesh;
  private readonly postRanges: { start: number; count: number; standing: boolean }[] = [];
  private readonly postMatrices: Matrix4[] = [];
  private readonly plotMarkers: Mesh[] = [];
  private readonly keepMesh: Mesh;
  private archeryMesh: Mesh | null = null;

  constructor(world: World, modelMaterial: Material, yaw: number) {
    const map = world.cfg.map;
    // Only the paths this level's waves use are drawn.
    const usedPaths = world.paths.filter((_, i) => world.waves.some((wave) => wave.path === i));
    this.buildGround(map, usedPaths);

    // Palisade: one instanced post mesh; each fence segment owns a run of posts.
    const postGeo = this.track(fencePostGeometry());
    const postCount = map.blockers.fences.reduce((sum, f) => sum + this.postsFor(f), 0);
    this.posts = new InstancedMesh(postGeo, modelMaterial, postCount);
    this.posts.frustumCulled = false;
    let next = 0;
    for (const f of map.blockers.fences) {
      const count = this.postsFor(f);
      this.postRanges.push({ start: next, count, standing: true });
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        // Small deterministic height variation so the palisade looks hand-built.
        const height = 0.92 + ((next * 7919) % 17) / 100;
        matrix
          .makeScale(1, height, 1)
          .setPosition(f.a[0] + (f.b[0] - f.a[0]) * t, 0, f.a[1] + (f.b[1] - f.a[1]) * t);
        this.postMatrices.push(matrix.clone());
        this.posts.setMatrixAt(next++, matrix);
      }
    }
    this.group.add(this.posts);

    this.keepMesh = new Mesh(this.track(keepGeometry(map.keep.w, map.keep.h)), modelMaterial);
    this.keepMesh.position.set(map.keep.x + map.keep.w / 2, 0, map.keep.y + map.keep.h / 2);
    this.group.add(this.keepMesh);

    for (const b of map.blockers.buildings) {
      const geo =
        b.type === 'forge'
          ? forgeGeometry()
          : b.type === 'archery'
            ? archeryGeometry()
            : brazierGeometry();
      const mesh = new Mesh(this.track(geo), modelMaterial);
      mesh.position.set(b.pos[0], 0, b.pos[1]);
      if (b.type === 'archery') this.archeryMesh = mesh;
      this.group.add(mesh);
    }

    this.addScatter(
      treeGeometry(),
      modelMaterial,
      map.blockers.trees.map(([x, y], i) => ({ x, y, s: 0.85 + ((i * 37) % 30) / 100 })),
    );
    this.addScatter(
      rockGeometry(),
      modelMaterial,
      map.blockers.rocks.map((r) => ({ x: r.pos[0], y: r.pos[1], s: r.r })),
    );

    const plotGeo = this.track(new PlaneGeometry(PLOT_SIZE, PLOT_SIZE));
    const plotMat = this.track(
      new MeshBasicMaterial({ map: this.track(plotTexture()), transparent: true }),
    );
    for (const plot of world.plots) {
      const marker = new Mesh(plotGeo, plotMat);
      marker.rotation.set(-Math.PI / 2, 0, yaw - Math.PI / 4);
      marker.position.set(plot.x, 0.04, plot.y);
      this.plotMarkers.push(marker);
      this.group.add(marker);
    }
  }

  /** Reflects fence damage, tower plots and building growth. */
  update(world: World): void {
    let dirty = false;
    for (let i = 0; i < this.postRanges.length; i++) {
      const range = this.postRanges[i];
      const standing = world.hp[world.fences[i]] > 0;
      if (standing === range.standing) continue;
      range.standing = standing;
      dirty = true;
      for (let p = range.start; p < range.start + range.count; p++) {
        this.posts.setMatrixAt(p, standing ? this.postMatrices[p] : HIDDEN);
      }
    }
    if (dirty) this.posts.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.plotMarkers.length; i++)
      this.plotMarkers[i].visible = world.plots[i].tier === 0;
    this.keepMesh.scale.setScalar(1 + world.eco.keepTier * 0.12);
    this.keepMesh.visible = world.hp[world.keep] > 0;
    // The archery house grows as the squad is re-armed at the forge.
    this.archeryMesh?.scale.setScalar(1 + Math.min(world.eco.purchases.forge, 2) * 0.2);
  }

  dispose(): void {
    this.posts.dispose();
    for (const d of this.disposables) d.dispose();
  }

  private postsFor(f: { a: readonly [number, number]; b: readonly [number, number] }): number {
    return Math.max(
      1,
      Math.round(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) / FENCE_POST_SPACING),
    );
  }

  private buildGround(map: MapDef, paths: readonly PathData[]): void {
    const flat = (w: number, h: number, color: number, x: number, z: number, y: number): void => {
      const mesh = new Mesh(
        this.track(new PlaneGeometry(w, h)),
        this.track(new MeshLambertMaterial({ color })),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      this.group.add(mesh);
    };
    flat(
      GROUND_SIZE,
      GROUND_SIZE,
      GROUND_COLORS[map.ground.base],
      map.size.w / 2,
      map.size.h / 2,
      0,
    );
    for (const p of map.ground.patches)
      flat(p.w, p.h, GROUND_COLORS[p.type], p.x + p.w / 2, p.y + p.h / 2, 0.01);

    const pathMat = this.track(new MeshLambertMaterial({ color: PALETTE.path }));
    for (const path of paths) this.group.add(new Mesh(this.track(pathRibbon(path)), pathMat));
  }

  private addScatter(
    geo: BufferGeometry,
    material: Material,
    items: { x: number; y: number; s: number }[],
  ): void {
    if (items.length === 0) {
      geo.dispose();
      return;
    }
    const mesh = new InstancedMesh(this.track(geo), material, items.length);
    items.forEach((item, i) => {
      mesh.setMatrixAt(i, matrix.makeScale(item.s, item.s, item.s).setPosition(item.x, 0, item.y));
    });
    mesh.frustumCulled = false;
    this.disposables.push(mesh);
    this.group.add(mesh);
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }
}
