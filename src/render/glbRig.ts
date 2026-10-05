// Real character models (glTF/GLB with a humanoid skeleton, e.g. Mixamo auto-rig) driven by the
// game's existing pose system. Every pose is first applied to an invisible procedural reference
// rig; each mapped bone then copies the reference joint's rotation *change* from rest
// (world-space delta), after aligning the model's rest pose (T/A-pose) to the reference rest pose
// (arms down). So all move clips, cinematics, intros and wins work unchanged on imported models.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { JOINTS, type JointName, POSE_LEN, type Rig } from './rig';

/** Structural rig interface used by the view, cinematics and specials. */
export interface CharacterRig {
  readonly root: THREE.Group;
  readonly body: THREE.Object3D;
  readonly joints: Record<JointName, THREE.Object3D>;
  readonly props: Record<string, THREE.Object3D>;
  apply(p: Float32Array, facing: number): void;
  setFlash(intensity: number, color?: THREE.ColorRepresentation): void;
}

/** Humanoid bone names (Mixamo convention; prefixes like "mixamorig:" are ignored). */
const BONE_FOR: Partial<Record<JointName, string>> = {
  hips: 'Hips',
  spine: 'Spine',
  chest: 'Spine2',
  neck: 'Neck',
  head: 'Head',
  shL: 'LeftArm',
  elL: 'LeftForeArm',
  haL: 'LeftHand',
  shR: 'RightArm',
  elR: 'RightForeArm',
  haR: 'RightHand',
  thL: 'LeftUpLeg',
  knL: 'LeftLeg',
  ftL: 'LeftFoot',
  thR: 'RightUpLeg',
  knR: 'RightLeg',
  ftR: 'RightFoot',
};
/** Child used to measure each joint's rest direction (reference joint, model bone). */
const DIR_CHILD: Partial<Record<JointName, [JointName | null, string]>> = {
  shL: ['elL', 'LeftForeArm'],
  elL: ['haL', 'LeftHand'],
  haL: ['haL', 'LeftHand'], // same as forearm (hand continues the forearm)
  shR: ['elR', 'RightForeArm'],
  elR: ['haR', 'RightHand'],
  haR: ['haR', 'RightHand'],
  thL: ['knL', 'LeftLeg'],
  knL: ['ftL', 'LeftFoot'],
  thR: ['knR', 'RightLeg'],
  knR: ['ftR', 'RightFoot'],
  spine: ['chest', 'Spine2'],
  chest: ['neck', 'Neck'],
  neck: ['head', 'Head'],
};

const canon = (name: string) => name.replace(/^.*?(mixamorig\d*[:_]?)/i, '').replace(/^.*[:|]/, '');

export function findBones(scene: THREE.Object3D): Map<string, THREE.Bone> {
  const out = new Map<string, THREE.Bone>();
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      const c = canon(o.name);
      if (!out.has(c)) out.set(c, o as THREE.Bone);
    }
  });
  return out;
}

export function isHumanoid(scene: THREE.Object3D): boolean {
  const b = findBones(scene);
  return ['Hips', 'Spine', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'].every((n) => b.has(n));
}

// ------------------------------------------------------------------ loading

const loaded = new Map<string, THREE.Object3D>();

/**
 * A self-contained `.gltf.json` (buffer as base64 data URI, scripts/glb-to-json.mjs) rebuilt as GLB bytes in memory.
 * Hosts with a strict CSP (the claude.ai Artifact: connect-src without data:) refuse GLTFLoader's fetch() of the
 * data URI, which silently dropped the models to the procedural fallback.
 */
function gltfJsonToGlb(text: string): ArrayBuffer | null {
  const json = JSON.parse(text) as { buffers?: { uri?: string; byteLength: number }[] };
  const uri = json.buffers?.[0]?.uri;
  if (!uri?.startsWith('data:')) return null;
  const raw = atob(uri.slice(uri.indexOf(',') + 1));
  const bin = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  delete json.buffers![0].uri;
  json.buffers![0].byteLength = bin.length;
  const js = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (js.length % 4)) % 4;
  const bpad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + js.length + jpad + 8 + bin.length + bpad;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, js.length + jpad, true);
  dv.setUint32(16, 0x4e4f534a, true); // JSON
  u8.set(js, 20);
  u8.fill(0x20, 20 + js.length, 20 + js.length + jpad);
  const o = 20 + js.length + jpad;
  dv.setUint32(o, bin.length + bpad, true);
  dv.setUint32(o + 4, 0x004e4942, true); // BIN
  u8.set(bin, o + 8);
  return out;
}

/**
 * GLTFLoader decodes embedded textures with ImageBitmapLoader, i.e. fetch(blob:), whenever createImageBitmap exists;
 * strict CSPs block that while <img> with blob: URLs is allowed. The loader picks its texture loader synchronously
 * inside parse(), so createImageBitmap is hidden only for that call.
 */
function parseWithImageElements(loader: GLTFLoader, buf: ArrayBuffer | string, path: string) {
  const g = globalThis as { createImageBitmap?: unknown };
  const saved = g.createImageBitmap;
  g.createImageBitmap = undefined;
  try {
    return loader.parseAsync(buf, path);
  } finally {
    g.createImageBitmap = saved;
  }
}

/**
 * Fetch and parse a glTF: `<base>.glb`, or a self-contained `<base>.gltf.json` for hosts that do not serve .glb
 * (scripts/glb-to-json.mjs). Safe under the Artifact CSP (see gltfJsonToGlb / parseWithImageElements).
 * Resolves null when neither file exists.
 */
export async function fetchGltf(base: string, exact?: string): Promise<GLTF | null> {
  let url = '';
  let res: Response | null = null;
  for (const u of exact ? [exact] : [`${base}.glb`, `${base}.gltf.json`]) {
    const r = await fetch(u).catch(() => null);
    const type = r?.headers.get('content-type') ?? '';
    if (r && r.ok && !type.includes('text/html')) {
      url = u;
      res = r;
      break;
    }
  }
  if (!res) return null;
  let buf: ArrayBuffer | string;
  if (url.endsWith('.json')) {
    const text = await res.text();
    buf = gltfJsonToGlb(text) ?? text;
  } else buf = await res.arrayBuffer();
  return parseWithImageElements(new GLTFLoader(), buf, url.replace(/[^/]*$/, ''));
}

/** Try to load `<base>/<id>.glb` for each fighter (missing files are fine: procedural fallback). */
export async function loadCharacterModels(ids: string[], base = 'assets/characters', overrides: Record<string, string> = {}): Promise<string[]> {
  const ok: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const gltf = await fetchGltf(`${base}/${id}`, overrides[id]);
        if (!gltf) return;
        if (!isHumanoid(gltf.scene)) {
          console.warn(`[models] ${id}: no humanoid skeleton (Mixamo bone names expected) — using placeholder`);
          return;
        }
        loaded.set(id, gltf.scene);
        ok.push(id);
      } catch (e) {
        console.warn(`[models] ${id}: failed to load — using placeholder`, e);
      }
    }),
  );
  return ok;
}

export function hasModel(id: string): boolean {
  return loaded.has(id);
}

// ------------------------------------------------------------------ retargeting rig

interface MapEntry {
  joint: JointName;
  bone: THREE.Bone;
  srcRestInv: THREE.Quaternion;
  alignedRest: THREE.Quaternion;
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class GlbRig implements CharacterRig {
  readonly root = new THREE.Group();
  readonly body: THREE.Object3D;
  readonly joints = {} as Record<JointName, THREE.Object3D>;
  readonly props: Record<string, THREE.Object3D> = {};
  private model: THREE.Object3D;
  private fit = new THREE.Group();
  private order: THREE.Bone[] = [];
  private restLocal = new Map<THREE.Bone, THREE.Quaternion>();
  private byBone = new Map<THREE.Bone, MapEntry>();
  private hips: THREE.Bone;
  private hipsParentWorldInv = new THREE.Matrix4();
  private hipsParentQuat = new THREE.Quaternion();
  private hipsRestPos = new THREE.Vector3();
  private refHipsRest = new THREE.Vector3();
  private hipScale = 1;
  private materials: THREE.MeshStandardMaterial[] = [];
  private flashColor = new THREE.Color(1, 1, 1);
  private zero = new Float32Array(POSE_LEN);
  private world = new Map<THREE.Object3D, THREE.Quaternion>();
  private headPitch = new THREE.Quaternion();
  /** Finger/thumb bones curled into a fist (models rigged by tools/meshy/skin.py keep their sculpted open hands). */
  private fistLocal = new Map<THREE.Object3D, THREE.Quaternion>();

  constructor(
    id: string,
    private ref: Rig,
    heightM: number,
  ) {
    const src = loaded.get(id);
    if (!src) throw new Error(`no model for ${id}`);
    this.model = SkeletonUtils.clone(src);
    // glTF characters face +Z; the game's rigs face +X.
    this.fit.rotation.y = Math.PI / 2;
    this.fit.add(this.model);
    this.root.add(this.fit);
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
          const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
          if (c.name.startsWith('cut_')) {
            // hair cards, brows, lashes: alpha-tested (no sorting artefacts), soft edges via MSAA coverage
            c.transparent = false;
            c.depthWrite = true;
            c.alphaTest = 0.45;
            c.alphaToCoverage = true;
            c.side = THREE.DoubleSide;
          }
          if (c.emissive) this.materials.push(c);
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
      }
      const pn = o.name.toLowerCase();
      if (pn.includes('prop_teeth') || pn.includes('goldteeth')) {
        this.props.teeth = o;
        o.visible = false;
      }
      if (pn.includes('prop_mic')) this.props.mic = o;
    });
    const bones = findBones(this.model);
    this.hips = bones.get('Hips')!;
    this.body = this.hips;

    // ---- scale: hip height matches the reference rig (keeps arm/leg reach on the sim's hitboxes even for
    // big-headed cartoon models); bounding-box height as fallback
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const h = Math.max(0.01, box.max.y - box.min.y);
    this.ref.apply(this.zero, 1);
    this.ref.root.updateMatrixWorld(true);
    const refHips = this.ref.joints.hips.getWorldPosition(new THREE.Vector3()).y;
    const modelHips = this.hips.getWorldPosition(new THREE.Vector3()).y - box.min.y;
    // realistic models (tools/meshy) ask to be fitted to the fighter's gameplay height instead (glTF extras rb_fit)
    let fitHeight = false;
    let fist = false;
    this.model.traverse((o) => {
      if (o.userData?.rb_fit === 'height') fitHeight = true;
      // realistic heads read the cartoon chin-up attitude as "looking at the sky": per-model pitch offset (deg)
      if (typeof o.userData?.rb_head_pitch === 'number') this.headPitch.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (o.userData.rb_head_pitch * Math.PI) / 180);
      if (o.userData?.rb_fist) fist = true;
    });
    const s = !fitHeight && refHips > 0.2 && modelHips > 0.05 ? refHips / modelHips : heightM / h;
    this.fit.scale.setScalar(s);
    this.root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(this.model);
    this.fit.position.y = -box2.min.y;
    this.root.updateMatrixWorld(true);

    // ---- rest data (root has identity transform here)
    this.ref.apply(this.zero, 1);
    this.ref.root.updateMatrixWorld(true);
    const refQ = (j: JointName) => this.ref.joints[j].getWorldQuaternion(new THREE.Quaternion());
    const refP = (j: JointName) => this.ref.joints[j].getWorldPosition(new THREE.Vector3());
    const tgtP = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3());
    for (const j of JOINTS) {
      const bn = BONE_FOR[j];
      const bone = bn ? bones.get(bn) : undefined;
      if (!bone) continue;
      this.joints[j] = bone;
      const srcRest = refQ(j);
      const tgtRest = bone.getWorldQuaternion(new THREE.Quaternion());
      // align the model's rest bone direction to the reference rest direction
      let align = new THREE.Quaternion();
      const dc = DIR_CHILD[j];
      if (dc) {
        const [rj, tb] = dc;
        const useParent = j === 'haL' || j === 'haR';
        const srcFrom = useParent ? refP(j === 'haL' ? 'elL' : 'elR') : refP(j);
        const srcTo = useParent ? refP(j) : refP(rj!);
        const tgtBone = bones.get(tb);
        const tgtFrom = useParent ? tgtP(bones.get(j === 'haL' ? 'LeftForeArm' : 'RightForeArm')!) : tgtP(bone);
        const tgtTo = tgtBone ? tgtP(tgtBone) : null;
        if (tgtTo) {
          const ds = srcTo.sub(srcFrom).normalize();
          const dt = tgtTo.sub(tgtFrom).normalize();
          if (ds.lengthSq() > 0 && dt.lengthSq() > 0) align = new THREE.Quaternion().setFromUnitVectors(dt, ds);
        }
      } else if (j === 'ftL' || j === 'ftR') {
        const toe = bones.get(j === 'ftL' ? 'LeftToeBase' : 'RightToeBase');
        if (toe) {
          const dt = tgtP(toe).sub(tgtP(bone));
          dt.y = 0;
          dt.normalize();
          const ds = new THREE.Vector3(1, 0, 0).applyQuaternion(srcRest);
          ds.y = 0;
          ds.normalize();
          if (dt.lengthSq() > 0 && ds.lengthSq() > 0) align = new THREE.Quaternion().setFromUnitVectors(dt, ds);
        }
      }
      const entry: MapEntry = { joint: j, bone, srcRestInv: srcRest.clone().invert(), alignedRest: align.multiply(tgtRest) };
      this.byBone.set(bone, entry);
    }
    // traversal order (parents first) + rest local rotations
    const CURL: [RegExp, number][] = [
      [/HandFingers1$/, 80],
      [/HandFingers2$/, 95],
      [/HandThumb$/, 55],
    ];
    this.hips.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        this.order.push(o as THREE.Bone);
        this.restLocal.set(o as THREE.Bone, o.quaternion.clone());
        const c = fist ? CURL.find(([re]) => re.test(canon(o.name))) : undefined;
        // the bone's local X is the knuckle axis; +rotation curls toward the palm
        if (c) this.fistLocal.set(o, o.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (c[1] * Math.PI) / 180)));
      }
    });
    const hp = this.hips.parent!;
    hp.updateMatrixWorld(true);
    this.hipsParentWorldInv.copy(hp.matrixWorld).invert();
    hp.getWorldQuaternion(this.hipsParentQuat);
    this.hipsRestPos.copy(tgtP(this.hips));
    this.refHipsRest.copy(refP('hips'));
    this.hipScale = this.hipsRestPos.y / Math.max(0.01, this.refHipsRest.y);
  }

  apply(p: Float32Array, facing: number): void {
    const ref = this.ref;
    ref.apply(p, 1);
    ref.root.updateMatrixWorld(true);
    const world = this.world;
    for (const bone of this.order) {
      const parentQ = bone === this.hips ? this.hipsParentQuat : (world.get(bone.parent!) ?? this.hipsParentQuat);
      let wq = world.get(bone);
      if (!wq) {
        wq = new THREE.Quaternion();
        world.set(bone, wq);
      }
      const e = this.byBone.get(bone);
      if (e) {
        // delta of the reference joint from its rest, applied to the aligned model rest
        ref.joints[e.joint].getWorldQuaternion(_q);
        _q.multiply(e.srcRestInv);
        if (e.joint === 'head') _q.premultiply(this.headPitch);
        wq.copy(_q).multiply(e.alignedRest);
        bone.quaternion.copy(_q2.copy(parentQ).invert().multiply(wq));
      } else {
        bone.quaternion.copy(this.fistLocal.get(bone) ?? this.restLocal.get(bone)!);
        wq.copy(parentQ).multiply(bone.quaternion);
      }
    }
    // hips translation: reference offset from rest, scaled to the model's leg length
    ref.joints.hips.getWorldPosition(_v);
    _v.sub(this.refHipsRest).multiplyScalar(this.hipScale).add(this.hipsRestPos);
    this.hips.position.copy(_v.applyMatrix4(_m.copy(this.hipsParentWorldInv)));
    this.root.scale.x = facing;
  }

  setFlash(intensity: number, color?: THREE.ColorRepresentation): void {
    if (color !== undefined) this.flashColor.set(color);
    for (const m of this.materials) {
      m.emissive.copy(this.flashColor);
      m.emissiveIntensity = intensity;
    }
  }
}
