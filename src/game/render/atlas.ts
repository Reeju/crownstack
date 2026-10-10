import { ShaderMaterial, type Texture } from 'three';

const VERTEX = /* glsl */ `
  attribute vec4 uvRect;
  attribute float alpha;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = uv * uvRect.zw + uvRect.xy;
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 texel = texture2D(map, vUv);
    gl_FragColor = vec4(texel.rgb, texel.a * vAlpha);
    #include <colorspace_fragment>
  }
`;

/**
 * Material for instanced quads that each show one cell of a canvas atlas.
 * Instances carry `uvRect` (offset.xy, scale.zw) and `alpha` attributes, so a
 * whole family of labels is one draw call.
 */
export function createAtlasMaterial(map: Texture, depthTest: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest,
    depthWrite: false,
  });
}

/** UV rectangle of cell `index` in a `cols` x `rows` atlas (canvas rows run top-down). */
export function cellUv(
  index: number,
  cols: number,
  rows: number,
  out: { x: number; y: number },
): void {
  out.x = (index % cols) / cols;
  out.y = 1 - (Math.floor(index / cols) + 1) / rows;
}
