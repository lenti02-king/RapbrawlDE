// Cel shading for the PO's 3D fighters (D43; the procedural rigs' toon kit is toon.ts): cel shading without gloss (MeshToonMaterial: no roughness/metal
// reflections at all, the lighting is quantised by a small gradient ramp) and a black ink outline as an inverted hull.
// The hull is a second skinned mesh on the SAME skeleton and geometry, pushed out along smoothed normals in view
// space by a fraction of the depth, so the line has the same on-screen width in the fight, the menus and close-ups.
import * as THREE from 'three';

/** Outline width as a fraction of the view depth (≈ 0.3 % of the screen height at the game's field of view). */
export const OUTLINE = { value: 0.0019 };
/** `?toon=0` shows the models with their original PBR material (comparison / fallback). */
export const TOON_ON = typeof location === 'undefined' || new URLSearchParams(location.search).get('toon') !== '0';

let ramp: THREE.DataTexture | null = null;
/** Cel bands over N·L from -1 to 1 (8 texels of 0.25): the side turned away from a light gets nothing from it (the
 *  hemisphere/ambient fills it), a narrow half-tone at the terminator, full light beyond. A ramp whose first band was
 *  not black let every back/rim light wash the whole figure pale (session-11 first try). */
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const steps = [0, 0, 0, 0, 120, 235, 255, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

/** The cel-shaded replacement of a PBR material: same maps, no gloss. */
export function toonFrom(m: THREE.Material): THREE.MeshToonMaterial {
  const s = m as THREE.MeshStandardMaterial;
  const t = new THREE.MeshToonMaterial({
    name: s.name,
    color: s.color ? s.color.clone() : new THREE.Color(1, 1, 1),
    map: s.map ?? null,
    normalMap: s.normalMap ?? null,
    normalScale: s.normalMap ? new THREE.Vector2(0.55, 0.55) : undefined,
    gradientMap: toonRamp(),
    emissive: new THREE.Color(0, 0, 0),
    transparent: s.transparent,
    alphaTest: s.alphaTest,
    side: s.side,
  });
  if (s.normalMap) t.normalScale.multiply(s.normalScale ?? new THREE.Vector2(1, 1));
  return t;
}

const smoothed = new WeakSet<THREE.BufferGeometry>();
/** Normals averaged over vertices that share a position (UV seams split vertices; a hull pushed along split normals
 *  tears open along every seam). Stored once per geometry as `outlineNormal`. */
function smoothNormals(g: THREE.BufferGeometry): void {
  if (smoothed.has(g)) return;
  smoothed.add(g);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  let nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!nrm) {
    g.computeVertexNormals();
    nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  }
  const n = pos.count;
  const key = new Map<string, number>();
  const id = new Int32Array(n);
  const acc: number[] = [];
  const q = 1e4;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`;
    let j = key.get(k);
    if (j === undefined) {
      j = acc.length / 3;
      key.set(k, j);
      acc.push(0, 0, 0);
    }
    id[i] = j;
    acc[j * 3] += nrm.getX(i);
    acc[j * 3 + 1] += nrm.getY(i);
    acc[j * 3 + 2] += nrm.getZ(i);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = id[i] * 3;
    const l = Math.hypot(acc[j], acc[j + 1], acc[j + 2]) || 1;
    out[i * 3] = acc[j] / l;
    out[i * 3 + 1] = acc[j + 1] / l;
    out[i * 3 + 2] = acc[j + 2] / l;
  }
  g.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}

let inkMat: THREE.MeshBasicMaterial | null = null;
function ink(): THREE.MeshBasicMaterial {
  if (inkMat) return inkMat;
  const m = new THREE.MeshBasicMaterial({ color: 0x08070a, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutline = OUTLINE;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 outlineNormal;\nuniform float uOutline;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec3 oN = outlineNormal;
        #ifdef USE_SKINNING
          oN = ( skinMatrix * vec4( oN, 0.0 ) ).xyz;
        #endif
        vec3 vN = normalize( normalMatrix * oN );
        float dep = max( -mvPosition.z, 0.3 );
        vec2 dir = dot( vN.xy, vN.xy ) > 1e-6 ? normalize( vN.xy ) : vec2( 0.0 );
        mvPosition.xy += dir * uOutline * dep;
        mvPosition.z -= uOutline * dep * 0.6;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  m.customProgramCacheKey = () => 'rb-ink';
  inkMat = m;
  return m;
}

/** Adds the ink hull next to a (skinned) mesh. Returns the hull so callers can hide it with the fighter. */
export function addOutline(mesh: THREE.Mesh): THREE.Mesh | null {
  if (!mesh.parent) return null;
  smoothNormals(mesh.geometry);
  let hull: THREE.Mesh;
  const sk = mesh as THREE.SkinnedMesh;
  if (sk.isSkinnedMesh) {
    const s = new THREE.SkinnedMesh(mesh.geometry, ink());
    s.bind(sk.skeleton, sk.bindMatrix);
    s.bindMode = sk.bindMode;
    hull = s;
  } else hull = new THREE.Mesh(mesh.geometry, ink());
  hull.name = `${mesh.name}_ink`;
  hull.position.copy(mesh.position);
  hull.quaternion.copy(mesh.quaternion);
  hull.scale.copy(mesh.scale);
  hull.frustumCulled = false;
  hull.castShadow = false;
  hull.receiveShadow = false;
  hull.renderOrder = mesh.renderOrder;
  mesh.parent.add(hull);
  return hull;
}
