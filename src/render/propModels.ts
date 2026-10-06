// The PO's Meshy prop models (D40): public/assets/props/<id>.glb, made game-ready by tools/meshy/props.py (real-world
// size, +X forward, origin on the floor where it stands on it, croc jaw split off as node 'jaw'). Loaded once at boot;
// every user falls back to the procedural prop in props.ts when a model is missing (e.g. a host without the files).
import * as THREE from 'three';
import { fetchGltf } from './glbRig';
import { limitTextures, texLimit } from './textureBudget';
import type { Croc, CrocRunner } from './props';

export const PROP_IDS = ['joint', 'heart', 'ball', 'diamond', 'mic', 'croc', 'palm', 'car'] as const;
export type PropId = (typeof PROP_IDS)[number];

const loaded = new Map<PropId, THREE.Object3D>();

export async function loadPropModels(base = 'assets/props', onProgress?: (done: number) => void): Promise<PropId[]> {
  let done = 0;
  await Promise.all(
    PROP_IDS.map(async (id) => {
      try {
        const g = await fetchGltf(`${base}/${id}`);
        if (g) {
          limitTextures(g.scene, texLimit('prop')); // phones: 2K -> 1K (D41)
          g.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            m.castShadow = true;
            m.receiveShadow = false;
          });
          loaded.set(id, g.scene);
        }
      } catch (e) {
        console.warn(`[props] ${id}: failed to load — procedural fallback`, e);
      } finally {
        onProgress?.(++done);
      }
    }),
  );
  return [...loaded.keys()];
}

export function hasProp(id: PropId): boolean {
  return loaded.has(id);
}

/**
 * A copy of the prop (meshes share geometry; materials are cloned when `ownMaterials`, so opacity fades of one copy do
 * not affect the others). Null when the model is not loaded.
 */
export function propModel(id: PropId, ownMaterials = false): THREE.Object3D | null {
  const src = loaded.get(id);
  if (!src) return null;
  const c = src.clone(true);
  if (ownMaterials)
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    });
  return c;
}

/** First mesh of a prop (geometry + material), e.g. for instancing the diamonds. */
export function propMesh(id: PropId): THREE.Mesh | null {
  let mesh: THREE.Mesh | null = null;
  loaded.get(id)?.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  return mesh;
}

/** All materials under a node (for fades). */
export function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) out.add(x);
  });
  return [...out];
}

/** Fade helper: remembers each material's own opacity and scales it by `a`. Faded props render in the transparent
 *  pass from the start (no material recompiles mid-match); depth writes stay on while mostly opaque. */
export function setOpacity(mats: THREE.Material[], a: number): void {
  for (const m of mats) {
    if (m.userData.baseOpacity === undefined) {
      m.userData.baseOpacity = m.opacity;
      m.transparent = true;
      m.needsUpdate = true;
    }
    m.opacity = (m.userData.baseOpacity as number) * a;
    m.depthWrite = a > 0.5;
  }
}

/**
 * The PO's croc as a `Croc` (the interface of the procedural head in props.ts): `setOpen` drops the split-off lower
 * jaw. The group's origin sits at the jaw hinge with the snout along +X and `headLen` metres from hinge to snout tip,
 * so code written for the 1 m procedural head (scale it) keeps working: the body continues behind the hinge.
 */
export function crocAsHead(headLen = 1): Croc | null {
  const model = propModel('croc', true);
  if (!model) return null;
  const jaw = model.getObjectByName('jaw');
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  // model space: hinge at (0.46, 0.145), snout tip at x 0.75 (tools/meshy/props.py)
  const k = headLen / 0.3;
  inner.scale.setScalar(k);
  inner.position.set(-0.46 * k, -0.145 * k, 0);
  inner.add(model);
  const mats = materialsOf(model);
  const dummy = new THREE.Group();
  return {
    group,
    upper: dummy,
    lower: (jaw as THREE.Group) ?? dummy,
    setOpen(deg: number) {
      if (jaw) jaw.rotation.z = (-deg * Math.PI) / 180;
    },
    setOpacity(a: number) {
      setOpacity(mats, a);
      group.visible = a > 0.01;
    },
  };
}

/**
 * The PO's croc as a running `CrocRunner` (Krokodil-Attacke): origin on the floor under the belly, snout +X (`snout`
 * metres ahead of the origin). Legs and tail are one sculpt, so the waddle sways, bobs and rolls the whole body; head
 * yaw/pitch set on `head.group` are applied (softened) to the body as well.
 */
export function crocRunnerModel(): (CrocRunner & { snout: number }) | null {
  const model = propModel('croc', true);
  if (!model) return null;
  const jaw = model.getObjectByName('jaw');
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.15;
  group.add(body);
  const neck = new THREE.Group();
  body.add(neck);
  model.position.y = -0.15;
  neck.add(model);
  const mats = materialsOf(model);
  const headDummy = new THREE.Group();
  const head: Croc = {
    group: headDummy,
    upper: new THREE.Group(),
    lower: (jaw as THREE.Group) ?? new THREE.Group(),
    setOpen(deg) {
      if (jaw) jaw.rotation.z = (-deg * Math.PI) / 180;
    },
    setOpacity(a) {
      setOpacity(mats, a);
    },
  };
  return {
    group,
    body,
    head,
    tail: new THREE.Group(),
    legs: [],
    snout: 0.75,
    setOpen: head.setOpen,
    setOpacity(a) {
      setOpacity(mats, a);
      group.visible = a > 0.01;
    },
    waddle(phase, amp) {
      const s = Math.sin(phase);
      body.rotation.y = s * 0.13 * amp;
      body.rotation.z = Math.sin(phase * 2) * 0.03 * amp;
      body.position.y = 0.15 + Math.abs(Math.cos(phase)) * 0.025 * amp;
      neck.rotation.set(0, headDummy.rotation.y * 0.5, headDummy.rotation.z * 0.5);
    },
  };
}

/** The PO's tuner hatchback (no brand) with headlight beams and a neon underglow; same structure as makeTunerCar
 *  (root > 'body', userData.wheels — empty: the sculpted wheels do not spin). Nose toward +X, 2.7 m long. */
export function tunerCarModel(): THREE.Object3D | null {
  const model = propModel('car', true);
  if (!model) return null;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  body.add(model);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const z of [-0.42, 0.42]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.4, 16, 1, true), beamMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(2.5, 0.5, z);
    body.add(beam);
  }
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.5),
    new THREE.MeshBasicMaterial({ color: 0x9a5cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  body.add(glow);
  root.userData.wheels = [];
  return root;
}

/** The PO's broken heart as the Herzbrecher's split heart ({group, left, right, mat}), ~1.8 m wide at scale 1 like the
 *  procedural one; one shared material (opacity + a red glow are animated). */
export function splitHeartModel(): { group: THREE.Group; left: THREE.Object3D; right: THREE.Object3D; mat: THREE.MeshStandardMaterial } | null {
  const model = propModel('heart');
  const left = model?.getObjectByName('left');
  const right = model?.getObjectByName('right');
  if (!model || !left || !right) return null;
  const src = (left as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const mat = src.clone();
  mat.transparent = true;
  mat.emissive = new THREE.Color(0x7a1030);
  for (const h of [left, right]) {
    h.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
    });
  }
  const k = 1.8 / 0.55;
  const group = new THREE.Group();
  // halves keep their own pivots; scaling a wrapper per half keeps `left.position` in heart units like the procedural one
  const wrap = (h: THREE.Object3D) => {
    const w = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(k);
    h.removeFromParent();
    h.position.set(0, 0, 0);
    inner.add(h);
    w.add(inner);
    group.add(w);
    return w;
  };
  return { group, left: wrap(left), right: wrap(right), mat };
}

/** The PO's speaker palm, `height` metres tall, leaning by `lean` (the procedural makePalm's parameter);
 *  userData.crown = the model (sways about its trunk). */
export function palmModel(height: number, lean: number): THREE.Group | null {
  const model = propModel('palm');
  if (!model) return null;
  const g = new THREE.Group();
  model.scale.setScalar(height / 5);
  g.add(model);
  g.rotation.z = -lean * 0.12;
  g.userData.crown = model;
  return g;
}
