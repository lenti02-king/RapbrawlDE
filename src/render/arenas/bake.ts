// Baked lighting for the courtyard (see tools/arena/bake.py).
//  - collectBakeScene(): serialises the procedurally built arena (world-space meshes, flat albedo, emitters, lights)
//    so Blender/Cycles can bake a lightmap with direct + bounced light.
//  - applyLightmap(): runtime side. Adds the baked second UV set to every bakeable mesh and swaps its material for an
//    unlit one (albedo x lightmap): realistic GI at a fraction of the per-pixel cost. Fighters keep dynamic lights.
// Meshes are matched by traversal order + vertex count; a mismatch (arena code changed, not re-baked) keeps the
// dynamic lighting.
import * as THREE from 'three';

export interface BakeMesh {
  i: number;
  name: string;
  bake: boolean;
  cast: boolean;
  count: number;
  pos: string;
  nrm: string;
  idx?: string;
  uv?: string;
  albedo: [number, number, number];
  emissive: [number, number, number];
  emissiveMap?: string;
}

export interface BakeScene {
  version: 1;
  meshes: BakeMesh[];
  lights: { type: string; color: [number, number, number]; intensity: number; pos: [number, number, number]; target?: [number, number, number]; angle?: number; penumbra?: number; distance?: number; castShadow?: boolean }[];
  hemi?: { sky: [number, number, number]; ground: [number, number, number]; intensity: number };
}

const b64 = (a: Float32Array | Uint32Array) => {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};

function avgColor(tex: THREE.Texture | null): THREE.Color {
  const img = tex?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width) return new THREE.Color(1, 1, 1);
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0;
  let gg = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue;
    r += d[i];
    gg += d[i + 1];
    b += d[i + 2];
    n++;
  }
  return n ? new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace) : new THREE.Color(1, 1, 1);
}

/** Which arena meshes take part in the bake (receivers) — shared by export and runtime. */
export function isBakeable(mesh: THREE.Mesh): boolean {
  const m = mesh.material as THREE.Material & { isMeshStandardMaterial?: boolean; isMeshLambertMaterial?: boolean; alphaTest?: number; blending?: number };
  if (Array.isArray(mesh.material)) return false;
  if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial)) return false;
  if ((m.alphaTest ?? 0) > 0) return false; // fences, nets: thin, keep dynamic
  if (m.blending === THREE.AdditiveBlending) return false;
  const e = (m as THREE.MeshStandardMaterial).emissive;
  if (e && (m as THREE.MeshStandardMaterial).emissiveIntensity * Math.max(e.r, e.g, e.b) > 0.5 && !(m as THREE.MeshStandardMaterial).emissiveMap) return false; // LEDs glow on their own
  return true;
}

export function arenaMeshes(group: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !mesh.userData.noBake && (mesh.geometry as THREE.BufferGeometry).attributes.position) out.push(mesh);
  });
  return out;
}

export function collectBakeScene(group: THREE.Object3D, lights: THREE.Light[]): BakeScene {
  group.updateMatrixWorld(true);
  const meshes: BakeMesh[] = [];
  arenaMeshes(group).forEach((mesh, i) => {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const m = mesh.material as THREE.MeshStandardMaterial;
    const bake = isBakeable(mesh);
    const emitter = !Array.isArray(m) && !!m.emissive && m.emissiveIntensity * Math.max(m.emissive.r, m.emissive.g, m.emissive.b) > 0.05;
    if (!bake && !emitter) {
      meshes.push({ i, name: mesh.name, bake: false, cast: false, count: geo.attributes.position.count, pos: '', nrm: '', albedo: [0, 0, 0], emissive: [0, 0, 0] });
      return;
    }
    const pos = (geo.attributes.position.array as Float32Array).slice();
    const nrmAttr = geo.attributes.normal;
    const nrm = nrmAttr ? (nrmAttr.array as Float32Array).slice() : new Float32Array(pos.length);
    const mw = mesh.matrixWorld;
    const nm = new THREE.Matrix3().getNormalMatrix(mw);
    const v = new THREE.Vector3();
    for (let k = 0; k < pos.length; k += 3) {
      v.set(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(mw);
      pos[k] = v.x;
      pos[k + 1] = v.y;
      pos[k + 2] = v.z;
      v.set(nrm[k], nrm[k + 1], nrm[k + 2]).applyMatrix3(nm).normalize();
      nrm[k] = v.x;
      nrm[k + 1] = v.y;
      nrm[k + 2] = v.z;
    }
    const albedo = m.color ? m.color.clone().multiply(avgColor(m.map)) : new THREE.Color(0.5, 0.5, 0.5);
    const em = emitter ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : new THREE.Color(0, 0, 0);
    let emissiveMap: string | undefined;
    if (emitter && m.emissiveMap?.image) {
      const img = m.emissiveMap.image as HTMLCanvasElement;
      const c = document.createElement('canvas');
      c.width = Math.min(512, img.width);
      c.height = Math.min(512, img.height);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      emissiveMap = c.toDataURL('image/png');
    }
    const uv = geo.attributes.uv ? b64((geo.attributes.uv.array as Float32Array).slice()) : undefined;
    meshes.push({
      i,
      name: mesh.name,
      bake,
      cast: mesh.castShadow || bake,
      count: geo.attributes.position.count,
      pos: b64(pos),
      nrm: b64(nrm),
      idx: geo.index ? b64(new Uint32Array(geo.index.array as ArrayLike<number>)) : undefined,
      uv,
      albedo: [albedo.r, albedo.g, albedo.b],
      emissive: [em.r, em.g, em.b],
      emissiveMap,
    });
  });
  const ls: BakeScene['lights'] = [];
  let hemi: BakeScene['hemi'];
  for (const l of lights) {
    const wp = l.getWorldPosition(new THREE.Vector3());
    const base = (l.userData.base as number | undefined) ?? l.intensity;
    if ((l as THREE.HemisphereLight).isHemisphereLight) {
      const h = l as THREE.HemisphereLight;
      hemi = { sky: [h.color.r, h.color.g, h.color.b], ground: [h.groundColor.r, h.groundColor.g, h.groundColor.b], intensity: base };
      continue;
    }
    const entry: BakeScene['lights'][number] = { type: l.type, color: [l.color.r, l.color.g, l.color.b], intensity: base, pos: [wp.x, wp.y, wp.z], castShadow: l.castShadow };
    const t = (l as THREE.DirectionalLight | THREE.SpotLight).target;
    if (t) {
      const tp = t.getWorldPosition(new THREE.Vector3());
      entry.target = [tp.x, tp.y, tp.z];
    }
    if ((l as THREE.SpotLight).isSpotLight) {
      const s = l as THREE.SpotLight;
      entry.angle = s.angle;
      entry.penumbra = s.penumbra;
      entry.distance = s.distance;
    }
    if ((l as THREE.PointLight).isPointLight) entry.distance = (l as THREE.PointLight).distance;
    ls.push(entry);
  }
  return { version: 1, meshes, lights: ls, hemi };
}

export interface LightmapData {
  map: THREE.Texture;
  /** second UV set per mesh index (Float32, 2 per vertex) */
  uv2: Map<number, Float32Array>;
  counts: Map<number, number>;
  intensity: number;
}

/** Fetch `<base>.json` (meta), `<base>.bin` (uv2) and `<base>.jpg` (lightmap). Resolves null when absent. */
export async function loadLightmap(base: string): Promise<LightmapData | null> {
  try {
    const metaRes = await fetch(`${base}.json`);
    if (!metaRes.ok || (metaRes.headers.get('content-type') ?? '').includes('text/html')) return null;
    const meta = (await metaRes.json()) as { intensity: number; meshes: { i: number; count: number; offset: number }[]; uvFile?: string };
    const binRes = await fetch(meta.uvFile ? base.replace(/[^/]*$/, meta.uvFile) : `${base}.uv.json`);
    if (!binRes.ok) return null;
    const uvB64 = ((await binRes.json()) as { data: string }).data;
    const bytes = Uint8Array.from(atob(uvB64), (c) => c.charCodeAt(0));
    const all = new Float32Array(bytes.buffer);
    const map = await new THREE.TextureLoader().loadAsync(`${base}.jpg`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.channel = 1;
    const uv2 = new Map<number, Float32Array>();
    const counts = new Map<number, number>();
    for (const m of meta.meshes) {
      uv2.set(m.i, all.subarray(m.offset, m.offset + m.count * 2));
      counts.set(m.i, m.count);
    }
    return { map, uv2, counts, intensity: meta.intensity };
  } catch {
    return null;
  }
}

/** Swap bakeable meshes to unlit albedo x lightmap. Returns the swapped materials (for dimming) or null on mismatch. */
export function applyLightmap(group: THREE.Object3D, data: LightmapData): THREE.MeshBasicMaterial[] | null {
  const meshes = arenaMeshes(group);
  const corners = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count);
  for (const [i, n] of data.counts) if (!meshes[i] || corners(meshes[i]) !== n) return null;
  const swapped = new Map<THREE.Material, THREE.MeshBasicMaterial>();
  meshes.forEach((mesh, i) => {
    const uv = data.uv2.get(i);
    if (!uv || !isBakeable(mesh)) return;
    // UV2 is stored per triangle corner (lightmap seams need split vertices)
    if (mesh.geometry.index) mesh.geometry = mesh.geometry.toNonIndexed();
    mesh.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
    const src = mesh.material as THREE.MeshStandardMaterial;
    let dst = swapped.get(src);
    if (!dst) {
      dst = new THREE.MeshBasicMaterial({
        map: src.map,
        color: src.color.clone(),
        lightMap: data.map,
        lightMapIntensity: data.intensity,
        transparent: src.transparent,
        opacity: src.opacity,
        depthWrite: src.depthWrite,
        polygonOffset: src.polygonOffset,
        polygonOffsetFactor: src.polygonOffsetFactor,
        side: src.side,
      });
      dst.userData.baseColor = dst.color.clone();
      if (src.emissiveMap) {
        // lit windows: keep the glow on top of the baked light
        dst.onBeforeCompile = (sh) => {
          sh.uniforms.emMap = { value: src.emissiveMap };
          sh.uniforms.emCol = { value: src.emissive.clone().multiplyScalar(src.emissiveIntensity) };
          sh.fragmentShader = sh.fragmentShader
            .replace('void main() {', 'uniform sampler2D emMap; uniform vec3 emCol;\nvoid main() {')
            .replace('#include <opaque_fragment>', 'outgoingLight += texture2D(emMap, vMapUv).rgb * emCol;\n#include <opaque_fragment>');
        };
      }
      swapped.set(src, dst);
    }
    mesh.material = dst;
  });
  return [...swapped.values()];
}
