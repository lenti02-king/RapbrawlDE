// Cel shading for the PO's 3D fighters (D43; the procedural rigs' toon kit is toon.ts): cel shading without gloss (MeshToonMaterial: no roughness/metal
// reflections at all, the lighting is quantised by a small gradient ramp) and a black ink outline as an inverted hull.
// The hull is a second skinned mesh on the SAME skeleton and geometry, pushed out along smoothed normals in view
// space by a fraction of the depth, so the line has the same on-screen width in the fight, the menus and close-ups.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Outline width as a fraction of the view depth (≈ 0.3 % of the screen height at the game's field of view). */
export const OUTLINE = { value: 0.0019 };
/** Character look (S17, PO: "es sieht aus wie eine primitive Grafik"): 'pbr' = the models' own PBR maps (colour,
 *  normal, metal/roughness) lit by the arena's lights and reflections, soft shading, no ink - how the models look in
 *  their viewers; 'toon' = the D43 cel look (3-band ramp + black ink hull). Per fighter: only the modelle-4 Jazeek pair
 *  is PBR for now - the PO is remaking the other fighters, they stay exactly as they are (PO, S17). */
export const PBR_FIGHTERS = new Set(['jazeek', 'jazeektoon']);
/** `?look=toon|pbr` forces one look on every fighter (comparisons). */
const LOOK_OVERRIDE: 'pbr' | 'toon' | null = (() => {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('look');
  return v === 'toon' || v === 'pbr' ? v : null;
})();
export function lookFor(id: string): 'pbr' | 'toon' {
  return LOOK_OVERRIDE ?? (PBR_FIGHTERS.has(id) ? 'pbr' : 'toon');
}

/** Rim light of one character (fresnel, added after the lights): a pale tint of the arena's purple back light (S17: the
 *  saturated purple read as pink on skin); the second fighter of a mirror match gets the P2 blue instead of a recolour. */
export interface RimUniforms {
  uRim: { value: THREE.Color };
  uRimPow: { value: number };
}
/** How much of the arena lights' colour the PBR fighters' shading drops (0 = all, 1 = white light of the same
 *  brightness): the podcast studio's purple ambient, purple back light and pink probe turned real skin magenta (S17
 *  in-game check against the photos). The environment around them keeps its colours. */
export const CHAR_NEUTRAL = { value: 0.55 };
/** Colour grade of the PBR fighters' own output, before the scene's tone mapping and the arena's grade (saturation
 *  x1.32, contrast x1.16 for the podcast studio): measured on Jazeek's cheeks in-game against his photos (S17: in-game
 *  saturation 0.60 vs 0.33 in the photos, darker and redder) - sat < 1 pulls toward grey, gain lifts the exposure, tint
 *  takes out the pink the studio's lights leave (hue 7 vs 10-12 in the photos). Calibrated with scripts/gradeprobe.mjs:
 *  sat 0.5 / gain 1.5 -> cheek saturation 89/255 (photos 78-91). */
export const CHAR_GRADE = { sat: { value: 0.5 }, gain: { value: 1.5 }, tint: { value: new THREE.Vector3(1, 1.07, 1.03) } };
if (typeof window !== 'undefined') (window as unknown as { __rbLook: unknown }).__rbLook = { grade: CHAR_GRADE, neutral: CHAR_NEUTRAL }; // calibration hook (scripts/gradeprobe.mjs)
export function rimUniforms(color = 0xc4b8ff, strength = 0.3): RimUniforms {
  return { uRim: { value: new THREE.Color(color).multiplyScalar(strength) }, uRimPow: { value: 2.6 } };
}

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
/** Neutral studio reflections for the PBR fighters where no arena probe exists (menus, portraits, low quality, the
 *  first frames of a fight): without an environment their metal (chains, watches, rings) renders black. */
export function charEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  let t = envCache.get(renderer);
  if (!t) {
    const pm = new THREE.PMREMGenerator(renderer);
    t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    envCache.set(renderer, t);
  }
  return t;
}

/** Skin-like diffuse for the PBR fighters: wrapped N·L (light reaches a little past the terminator, as through skin
 *  and cloth) with a warm tint in that band - the hard light/shadow edge on faces read as plastic. Specular stays GGX. */
const WRAP_LINE = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';
const SOFT_SKIN_CHUNK = THREE.ShaderChunk.lights_physical_pars_fragment.includes(WRAP_LINE)
  ? THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      WRAP_LINE,
      `float rbWrapNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.3 ) / 1.3 );
      vec3 rbWarm = mix( vec3( 1.0 ), vec3( 1.0, 0.88, 0.8 ), saturate( ( rbWrapNL - dotNL ) * 2.5 ) );
      reflectedLight.directDiffuse += rbWrapNL * directLight.color * rbWarm * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );`,
    )
  : THREE.ShaderChunk.lights_physical_pars_fragment;
/** Direct lights reach the BRDF with their colour pulled toward grey (CHAR_NEUTRAL). */
const NEUTRAL_DIRECT = `
void RE_Direct_RB( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  IncidentLight rbLight = directLight;
  rbLight.color = rbNeutral( rbLight.color );
  RE_Direct_Physical( rbLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}
#undef RE_Direct
#define RE_Direct RE_Direct_RB
`;

/** The PBR character material from a glTF material: the model's own maps; metal/roughness from Meshy's map when the
 *  model carries it (chains and jewellery metal, skin and cloth their own gloss), else a soft skin-like default. */
export function pbrFrom(m: THREE.Material, rim: RimUniforms): THREE.MeshPhysicalMaterial {
  const s = m as THREE.MeshStandardMaterial;
  const mr = s.roughnessMap ?? s.metalnessMap ?? null;
  const p = new THREE.MeshPhysicalMaterial({
    name: s.name,
    color: s.color ? s.color.clone() : new THREE.Color(1, 1, 1),
    map: s.map ?? null,
    normalMap: s.normalMap ?? null,
    roughnessMap: mr,
    metalnessMap: mr,
    roughness: mr ? 1 : 0.62,
    metalness: mr ? 1 : 0,
    specularIntensity: 0.55,
    envMapIntensity: 1.0,
    emissive: new THREE.Color(0, 0, 0),
    transparent: s.transparent,
    alphaTest: s.alphaTest,
    side: s.side,
  });
  if (s.normalMap) p.normalScale.copy(s.normalScale ?? new THREE.Vector2(1, 1));
  // the face and hands sit at grazing angles in the side-on fight camera: anisotropic filtering keeps them sharp
  // (three clamps it to the GPU's maximum)
  for (const t of [p.map, p.normalMap, mr]) if (t) t.anisotropy = 8;
  p.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rim.uRim;
    sh.uniforms.uRimPow = rim.uRimPow;
    sh.uniforms.uNeutral = CHAR_NEUTRAL;
    sh.uniforms.uCharSat = CHAR_GRADE.sat;
    sh.uniforms.uCharGain = CHAR_GRADE.gain;
    sh.uniforms.uCharTint = CHAR_GRADE.tint;
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRim;
        uniform float uRimPow;
        uniform float uNeutral;
        uniform float uCharSat;
        uniform float uCharGain;
        uniform vec3 uCharTint;
        vec3 rbNeutral( vec3 c ) { return mix( c, vec3( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) ), uNeutral ); }`,
      )
      .replace('#include <lights_physical_pars_fragment>', SOFT_SKIN_CHUNK + NEUTRAL_DIRECT)
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight = mix( vec3( dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) ) ), outgoingLight, uCharSat ) * uCharGain * uCharTint;
        #include <opaque_fragment>`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `irradiance = rbNeutral( irradiance );
        iblIrradiance = rbNeutral( iblIrradiance );
        #include <lights_fragment_end>`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
        // rim: lifts the silhouette off the background like the key/back light of a character shot
        totalEmissiveRadiance += uRim * pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), uRimPow ) * diffuseColor.rgb * 2.0;`,
      );
  };
  p.customProgramCacheKey = () => 'rb-pbr-char';
  return p;
}

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

/** Ink colours: black, and the P2 blue for the second fighter of a mirror match (same fighter on both sides). */
export const INK = { black: 0x08070a, p2: 0x2f7bff } as const;
const inkMats = new Map<number, THREE.MeshBasicMaterial>();
function ink(color: number = INK.black): THREE.MeshBasicMaterial {
  const cached = inkMats.get(color);
  if (cached) return cached;
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
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
  inkMats.set(color, m);
  return m;
}

/** Adds the ink hull next to a (skinned) mesh. Returns the hull so callers can hide it with the fighter. */
export function addOutline(mesh: THREE.Mesh, color: number = INK.black): THREE.Mesh | null {
  if (!mesh.parent) return null;
  smoothNormals(mesh.geometry);
  let hull: THREE.Mesh;
  const sk = mesh as THREE.SkinnedMesh;
  if (sk.isSkinnedMesh) {
    const s = new THREE.SkinnedMesh(mesh.geometry, ink(color));
    s.bind(sk.skeleton, sk.bindMatrix);
    s.bindMode = sk.bindMode;
    hull = s;
  } else hull = new THREE.Mesh(mesh.geometry, ink(color));
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
