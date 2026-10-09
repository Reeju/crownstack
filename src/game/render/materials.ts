import { MeshLambertMaterial } from 'three';

/** Shared flat-shaded, vertex-coloured material for every code-built model. */
export function createModelMaterial(): MeshLambertMaterial {
  return new MeshLambertMaterial({ vertexColors: true, flatShading: true });
}
