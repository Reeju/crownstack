import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

/**
 * All models are built in code from a handful of primitives (SPEC §5.1) and
 * merged into one vertex-coloured geometry, so each instanced type is a single
 * draw call. Models stand on y = 0 and face +x.
 */
export interface Part {
  geo: BufferGeometry;
  color: number;
  at?: readonly [number, number, number];
  rot?: readonly [number, number, number];
  scale?: readonly [number, number, number];
}

export const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
export const cyl = (rTop: number, rBottom: number, h: number, segments = 8) =>
  new CylinderGeometry(rTop, rBottom, h, segments);
export const cone = (r: number, h: number, segments = 6) => new ConeGeometry(r, h, segments);
export const ball = (r: number, detail = 1) => new IcosahedronGeometry(r, detail);

const matrix = new Matrix4();
const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const euler = new Euler();
const color = new Color();

export function mergeParts(parts: readonly Part[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const part of parts) {
    const geo = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    position.set(...(part.at ?? [0, 0, 0]));
    quaternion.setFromEuler(euler.set(...(part.rot ?? [0, 0, 0])));
    scale.set(...(part.scale ?? [1, 1, 1]));
    geo.applyMatrix4(matrix.compose(position, quaternion, scale));
    geo.computeVertexNormals();

    positions.push(...(geo.getAttribute('position').array as Float32Array));
    normals.push(...(geo.getAttribute('normal').array as Float32Array));
    color.setHex(part.color);
    for (let i = 0; i < geo.getAttribute('position').count; i++)
      colors.push(color.r, color.g, color.b);

    geo.dispose();
    part.geo.dispose();
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  merged.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  merged.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return merged;
}
