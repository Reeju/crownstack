import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Material,
  type Texture,
} from 'three';

import type { MapDef } from '../../content/schema';
import type { PathData } from '../sim/pathing';
import type { World } from '../sim/world';
import { box, cone, mergeParts, type Part } from './geometry';
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
const CLIFF_HEIGHT = 1.8;
/** Flat ground layers are stacked a hair apart so they never z-fight. */
const LAYER_Y = { dirt: 0.01, grass: 0.01, water: 0.015, path: 0.02, wood: 0.04 } as const;
const GROUND_COLORS = {
  grass: PALETTE.grass,
  dirt: PALETTE.dirt,
  cliff: PALETTE.cliff,
  water: PALETTE.water,
  wood: PALETTE.wood,
} as const;
/** Every n-th fence segment carries a torch on night levels. */
const TORCH_EVERY = 3;
const GATE_TINT = new Color(0.55, 0.6, 0.75);

const matrix = new Matrix4();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/** Flat ribbon following a sampled path. */
function pathRibbon(path: PathData): BufferGeometry {
  const n = path.xs.length;
  const positions = new Float32Array(n * 6);
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
      [path.xs[i] + nx, 0, path.ys[i] + ny, path.xs[i] - nx, 0, path.ys[i] - ny],
      i * 6,
    );
    if (i < n - 1) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
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
 * Everything that is built once per level: terrain, paths, palisade and
 * gates, keep, buildings, scenery, plot markers and (at night) torches.
 * Afterwards only barriers, the keep, the archery house, plot markers and
 * the brazier flame change.
 */
export class LevelView {
  readonly group = new Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly posts: InstancedMesh;
  private readonly postRanges: { start: number; count: number; standing: boolean }[] = [];
  private readonly postMatrices: Matrix4[] = [];
  private readonly plotMarkers: InstancedMesh;
  private readonly plotMatrices: Matrix4[] = [];
  private readonly plotShown: boolean[] = [];
  private readonly keepMesh: Mesh;
  private archeryMesh: Mesh | null = null;
  private brazierFlame: Mesh | null = null;

  constructor(world: World, modelMaterial: Material, yaw: number) {
    const map = world.cfg.map;
    // Only the paths this level's waves use are drawn.
    const usedPaths = world.paths.filter((_, i) => world.waves.some((wave) => wave.path === i));
    this.group.add(new Mesh(this.track(this.terrain(map, usedPaths)), modelMaterial));

    // Palisade and gates: one instanced post mesh; each barrier owns a run of posts.
    const barriers = [...map.blockers.fences, ...map.blockers.gates];
    const postCount = barriers.reduce((sum, f) => sum + this.postsFor(f), 0);
    this.posts = new InstancedMesh(this.track(fencePostGeometry()), modelMaterial, postCount);
    this.posts.frustumCulled = false;
    let next = 0;
    barriers.forEach((f, index) => {
      const count = this.postsFor(f);
      const isGate = index >= map.blockers.fences.length;
      this.postRanges.push({ start: next, count, standing: true });
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        // Small deterministic height variation so the palisade looks hand-built.
        const height = isGate ? 1.15 : 0.92 + ((next * 7919) % 17) / 100;
        matrix
          .makeScale(1, height, 1)
          .setPosition(f.a[0] + (f.b[0] - f.a[0]) * t, 0, f.a[1] + (f.b[1] - f.a[1]) * t);
        this.postMatrices.push(matrix.clone());
        if (isGate) this.posts.setColorAt(next, GATE_TINT);
        this.posts.setMatrixAt(next++, matrix);
      }
    });
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
      if (b.type === 'brazier') {
        this.brazierFlame = this.flame(1);
        this.brazierFlame.position.set(b.pos[0], 1.05, b.pos[1]);
        this.brazierFlame.visible = false;
        this.group.add(this.brazierFlame);
      }
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

    // Plot markers: one instanced quad per plot, hidden once a tower stands on it.
    const plotMaterial = this.track(
      new MeshBasicMaterial({
        map: this.track(plotTexture()),
        transparent: true,
        depthWrite: false,
      }),
    );
    this.plotMarkers = new InstancedMesh(
      this.track(
        new PlaneGeometry(PLOT_SIZE, PLOT_SIZE).rotateX(-Math.PI / 2).rotateY(Math.PI / 4 - yaw),
      ),
      plotMaterial,
      Math.max(world.plots.length, 1),
    );
    this.plotMarkers.count = world.plots.length;
    this.plotMarkers.frustumCulled = false;
    world.plots.forEach((plot, i) => {
      this.plotMatrices.push(new Matrix4().makeTranslation(plot.x, 0.045, plot.y));
      this.plotMarkers.setMatrixAt(i, this.plotMatrices[i]);
      this.plotShown.push(true);
    });
    this.group.add(this.plotMarkers);

    if (world.cfg.level.night) this.addTorches(map);
  }

  /** Reflects barrier damage, tower plots, building growth and the brazier. */
  update(world: World): void {
    let dirty = false;
    for (let i = 0; i < this.postRanges.length; i++) {
      const range = this.postRanges[i];
      const standing = world.hp[world.barriers[i]] > 0;
      if (standing === range.standing) continue;
      range.standing = standing;
      dirty = true;
      for (let p = range.start; p < range.start + range.count; p++) {
        this.posts.setMatrixAt(p, standing ? this.postMatrices[p] : HIDDEN);
      }
    }
    if (dirty) this.posts.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < world.plots.length; i++) {
      const show = world.plots[i].tier === 0;
      if (show === this.plotShown[i]) continue;
      this.plotShown[i] = show;
      this.plotMarkers.setMatrixAt(i, show ? this.plotMatrices[i] : HIDDEN);
      this.plotMarkers.instanceMatrix.needsUpdate = true;
    }

    this.keepMesh.scale.setScalar(1 + world.eco.keepTier * 0.12);
    this.keepMesh.visible = world.hp[world.keep] > 0;
    // The archery house grows as the squad is re-armed at the forge.
    this.archeryMesh?.scale.setScalar(1 + Math.min(world.eco.purchases.forge, 2) * 0.2);
    if (this.brazierFlame) this.brazierFlame.visible = world.eco.brazierLit;
  }

  dispose(): void {
    this.posts.dispose();
    this.plotMarkers.dispose();
    for (const d of this.disposables) d.dispose();
  }

  private postsFor(f: { a: readonly [number, number]; b: readonly [number, number] }): number {
    return Math.max(
      1,
      Math.round(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) / FENCE_POST_SPACING),
    );
  }

  /** Ground, patches, cliffs and path ribbons merged into one vertex-coloured mesh. */
  private terrain(map: MapDef, paths: readonly PathData[]): BufferGeometry {
    const flat = (w: number, h: number, color: number, x: number, z: number, y: number): Part => ({
      geo: new PlaneGeometry(w, h),
      color,
      at: [x, y, z],
      rot: [-Math.PI / 2, 0, 0],
    });
    const parts: Part[] = [
      flat(
        GROUND_SIZE,
        GROUND_SIZE,
        GROUND_COLORS[map.ground.base],
        map.size.w / 2,
        map.size.h / 2,
        0,
      ),
    ];
    for (const p of map.ground.patches) {
      const cx = p.x + p.w / 2;
      const cz = p.y + p.h / 2;
      if (p.type === 'cliff') {
        parts.push({
          geo: box(p.w, CLIFF_HEIGHT, p.h),
          color: GROUND_COLORS.cliff,
          at: [cx, CLIFF_HEIGHT / 2, cz],
        });
      } else {
        parts.push(flat(p.w, p.h, GROUND_COLORS[p.type], cx, cz, LAYER_Y[p.type]));
      }
    }
    for (const path of paths)
      parts.push({ geo: pathRibbon(path), color: PALETTE.path, at: [0, LAYER_Y.path, 0] });
    return mergeParts(parts);
  }

  private flame(scale: number): Mesh {
    const mesh = new Mesh(
      this.track(
        mergeParts([
          {
            geo: cone(0.28 * scale, 0.8 * scale, 5),
            color: PALETTE.white,
            at: [0, 0.4 * scale, 0],
          },
        ]),
      ),
      this.track(new MeshBasicMaterial({ color: PALETTE.ember, fog: false })),
    );
    return mesh;
  }

  /** Emissive torches along the palisade: unlit meshes that glow against the dark scene. */
  private addTorches(map: MapDef): void {
    const spots = map.blockers.fences.filter((_, i) => i % TORCH_EVERY === 0);
    if (spots.length === 0) return;
    const geo = this.track(
      mergeParts([{ geo: cone(0.2, 0.55, 5), color: PALETTE.white, at: [0, 1.75, 0] }]),
    );
    const mesh = new InstancedMesh(
      geo,
      this.track(new MeshBasicMaterial({ color: PALETTE.ember, fog: false })),
      spots.length,
    );
    spots.forEach((f, i) => mesh.setMatrixAt(i, matrix.makeTranslation(f.a[0], 0, f.a[1])));
    mesh.frustumCulled = false;
    this.disposables.push(mesh);
    this.group.add(mesh);
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
