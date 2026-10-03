// Shared toon-shading materials and geometry helpers for procedural placeholder art.
import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** 3-step ramp for cel shading. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMat(color: THREE.ColorRepresentation, opts: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

const outlineVert = /* glsl */ `
  uniform float thickness;
  void main() {
    vec3 p = position + normal * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const outlineFrag = /* glsl */ `
  uniform vec3 color;
  void main() { gl_FragColor = vec4(color, 1.0); }
`;

const outlineCache = new Map<number, THREE.ShaderMaterial>();

const SKIN_OUTLINE_VERT = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  attribute float outlineW;
  void main() {
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    transformed += normalize(objectNormal) * outlineW;
    #include <project_vertex>
  }
`;

let skinOutline: THREE.ShaderMaterial | null = null;
/** Outline for baked skinned characters: per-vertex thickness attribute `outlineW`. */
export function skinnedOutlineMat(color = 0x07060c): THREE.ShaderMaterial {
  return (skinOutline ??= new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) } },
    vertexShader: SKIN_OUTLINE_VERT,
    fragmentShader: outlineFrag,
    side: THREE.BackSide,
  }));
}

/** Inverted-hull outline material (vertices pushed along normals, back faces only). */
export function outlineMat(thickness = 0.012, color = 0x07060c): THREE.ShaderMaterial {
  const key = Math.round(thickness * 10000) * 1000 + (color & 0xfff);
  let m = outlineCache.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(color) } },
      vertexShader: outlineVert,
      fragmentShader: outlineFrag,
      side: THREE.BackSide,
    });
    outlineCache.set(key, m);
  }
  return m;
}

/** Capsule along -Y from the origin: top sphere radius r1 at y=0, bottom radius r2 at y=-length. */
export function taperedCapsule(length: number, r1: number, r2: number, radial = 16, capSeg = 5): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= capSeg; i++) {
    const a = -Math.PI / 2 + (i / capSeg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, r2 * Math.cos(a)), -length + r2 * Math.sin(a)));
  }
  for (let i = 0; i <= capSeg; i++) {
    const a = (i / capSeg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), r1 * Math.sin(a)));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/** Lathe body from a radius profile [[y, r], ...] (bottom to top), closed at both ends. */
export function latheProfile(profile: [number, number][], radial = 28): THREE.LatheGeometry {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(1e-4, r), y));
  return new THREE.LatheGeometry(pts, radial);
}

/** Add a mesh with an outline shell to a parent. */
export function addPart(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  opts: { pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number]; outline?: number } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  if (opts.pos) mesh.position.set(...opts.pos);
  if (opts.rot) mesh.rotation.set(...opts.rot);
  if (opts.scale) mesh.scale.set(...opts.scale);
  parent.add(mesh);
  const t = opts.outline ?? 0.012;
  if (t > 0) {
    const shell = new THREE.Mesh(geo, outlineMat(t));
    mesh.add(shell);
  }
  return mesh;
}
