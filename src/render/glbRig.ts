// Real character models (glTF/GLB with a humanoid skeleton, e.g. Mixamo auto-rig) driven by the
// game's existing pose system. Every pose is first applied to an invisible procedural reference
// rig; each mapped bone then copies the reference joint's rotation *change* from rest
// (world-space delta), after aligning the model's rest pose (T/A-pose) to the reference rest pose
// (arms down). So all move clips, cinematics, intros and wins work unchanged on imported models.
import * as THREE from 'three';
import { limitTextures, texLimit } from './textureBudget';
import { addOutline, toonFrom, TOON_ON } from './cel';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { JOINTS, JOINT_INDEX, type JointName, LIMB_STRETCH, POSE_LEN, type Rig, S_SQ, squashScale } from './rig';

/** Structural rig interface used by the view, cinematics and specials. */
export interface CharacterRig {
  readonly root: THREE.Group;
  readonly body: THREE.Object3D;
  readonly joints: Record<JointName, THREE.Object3D>;
  readonly props: Record<string, THREE.Object3D>;
  apply(p: Float32Array, facing: number): void;
  setFlash(intensity: number, color?: THREE.ColorRepresentation): void;
}

/** Fraction of the full fist curl applied to finger bones (models from tools/meshy/skin.py). The two-bone finger
 *  rig closes the modelle-3 hands cleanly at 0.75 (D43; the older sculpts crumpled above 0.4). */
const FIST_CURL = 0.75;
/** Extra curl when the arm is extended (punch contact): a straight arm closes the hand into a tight fist. */
const FIST_STRIKE = 0.45;
/** Arm length relative to the sculpt (PO: arms looked oversized next to the body; the hands read better smaller too).
 *  Applied as upper-arm bone scale, so the whole arm chain shrinks toward the shoulder. */
const ARM_SCALE: Record<string, number> = {};
/** Thumb fold across the fingers at a full fist (deg, per model: the sculpted thumbs point different ways). */
const THUMB_FOLD: Record<string, number> = {};

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
export async function fetchGltf(base: string, exact?: string, mobile = false): Promise<GLTF | null> {
  let url = '';
  let res: Response | null = null;
  const full = [`${base}.glb`, `${base}.gltf.json`];
  for (const u of exact ? [exact] : mobile ? [`${base}.m.glb`, `${base}.m.gltf.json`, ...full] : full) {
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
export async function loadCharacterModels(
  ids: string[],
  base = 'assets/characters',
  overrides: Record<string, string> = {},
  onProgress?: (done: number) => void,
): Promise<string[]> {
  const ok: string[] = [];
  let done = 0;
  await Promise.all(
    ids.map(async (id) => {
      try {
        // phones / below 'high': the fighter's mobile copy (<id>.m.glb: 40k triangles, 2K colour, 1K normal map, S12) -
        // the 4K originals cost ~80 MB of decoding each before they were shrunk, and that spike starved the iPhone
        const gltf = await fetchGltf(`${base}/${id}`, overrides[id], texLimit('character') < 4096);
        if (!gltf) return;
        if (!isHumanoid(gltf.scene)) {
          console.warn(`[models] ${id}: no humanoid skeleton (Mixamo bone names expected) — using placeholder`);
          return;
        }
        limitTextures(gltf.scene, texLimit('character')); // phones: 4K -> 2K (D41)
        loaded.set(id, gltf.scene);
        ok.push(id);
      } catch (e) {
        console.warn(`[models] ${id}: failed to load — using placeholder`, e);
      } finally {
        onProgress?.(++done);
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
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0);
const _Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _pa = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _pk = new THREE.Vector3();
const _ph = new THREE.Vector3();
const _tg = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _n = new THREE.Vector3();
const _qf = new THREE.Quaternion();
const _qk = new THREE.Quaternion();
const _qd = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _qe = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const _ds = new THREE.Vector3();
const _de = new THREE.Vector3();
const smooth01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** A mirrored rig (facing left: root scale.x < 0) decomposes into world quaternions conjugated by the mirror; a local
 *  rotation computed from them must be conjugated back: (x, y, z, w) -> (x, -y, -z, w). */
function unmirror(b: THREE.Object3D, q: THREE.Quaternion): THREE.Quaternion {
  if (b.parent!.matrixWorld.determinant() < 0) q.set(q.x, -q.y, -q.z, q.w);
  return q;
}
/** Rotate a bone by a world-space delta (true world axes, from world positions). */
function rotateWorld(b: THREE.Object3D, delta: THREE.Quaternion): void {
  b.parent!.getWorldQuaternion(_qp);
  b.getWorldQuaternion(_qk);
  b.quaternion.copy(unmirror(b, _qp.invert().multiply(_qk.premultiply(delta))));
}

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
  private materials: (THREE.MeshStandardMaterial | THREE.MeshToonMaterial)[] = [];
  private flashColor = new THREE.Color(1, 1, 1);
  private zero = new Float32Array(POSE_LEN);
  private world = new Map<THREE.Object3D, THREE.Quaternion>();
  private headPitch = new THREE.Quaternion();
  /** Finger/thumb bones curled into a fist (models rigged by tools/meshy/skin.py keep their sculpted open hands):
   *  rest rotation, curl angle (rad at full fist) and side (0 = left/far arm, 1 = right/near arm). */
  private fistBones = new Map<THREE.Object3D, { rest: THREE.Quaternion; ang: number; side: 0 | 1; fold?: number }>();
  private curlBase = FIST_CURL;
  /** Ground clamp: sole joints (ankles + toes) and their lowest root-space height in the rest pose. */
  private soles: THREE.Object3D[] = [];
  private soleRest = 0;
  /** Foot planting (S12, PO: "die Spieler schweben leicht"): the legs and their rest heights (root space). */
  private legs: { up: THREE.Bone; low: THREE.Bone; foot: THREE.Bone; toe: THREE.Bone | null; ankleRest: number; toeRest: number }[] = [];
  /** Set per frame by the view: the fighter stands (idle, walk, guard, crouch, blockstun) - hovering feet go down. */
  plant = false;
  /** S13 human shoulders: the clavicle bones (unmapped by the pose system) follow the upper arm like a real shoulder
   *  girdle - they lift when the arm rises past the horizontal (scapulohumeral rhythm) and slide forward on a reach. */
  private clav = new Map<THREE.Bone, 'L' | 'R'>();
  /** Toe length per leg (m, model space) for the toe roll. */
  private toeLen: number[] = [];

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
    const inked: THREE.Mesh[] = [];
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
          // D43: cartoon / cel shading — no gloss at all, quantised light, black ink outline (?toon=0: original PBR, matte)
          if (TOON_ON && !(m as THREE.Material).name.startsWith('cut_')) {
            const t = toonFrom(m as THREE.Material);
            this.materials.push(t);
            return t;
          }
          const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
          if ('roughness' in c) {
            c.roughness = 1;
            c.metalness = 0;
            c.roughnessMap = null;
            c.metalnessMap = null;
          }
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
        if (TOON_ON) inked.push(mesh);
      }
      const pn = o.name.toLowerCase();
      if (pn.includes('prop_teeth') || pn.includes('goldteeth')) {
        this.props.teeth = o;
        o.visible = false;
      }
      if (pn.includes('prop_mic')) this.props.mic = o;
    });
    for (const m of inked) addOutline(m);
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
    // debug: ?fist=0 shows the sculpted open hands
    // ?fist=0..1 scales the curl (debug)
    const fistQ = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('fist') : null;
    const curlScale = fistQ === null ? FIST_CURL : Number(fistQ);
    if (curlScale <= 0) fist = false;
    this.curlBase = curlScale;
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
      [/HandThumb$/, 0],
    ];
    this.hips.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        this.order.push(o as THREE.Bone);
        this.restLocal.set(o as THREE.Bone, o.quaternion.clone());
        const cn = canon(o.name);
        const c = fist ? CURL.find(([re]) => re.test(cn)) : undefined;
        // the bone's local X is the knuckle axis; +rotation curls toward the palm
        if (c) this.fistBones.set(o, { rest: o.quaternion.clone(), ang: (c[1] * Math.PI) / 180, side: cn.startsWith('Left') ? 0 : 1 });
      }
    });
    // thumbs also fold across the front of the curled fingers (around the palm normal, toward the fingertips)
    const dbg = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const thumbFold = Number(dbg?.get('thz') ?? THUMB_FOLD[id] ?? 0);
    for (const [b, fb] of this.fistBones) {
      if (!/HandThumb$/.test(canon(b.name))) continue;
      if (dbg?.get('thx')) fb.ang = (Number(dbg.get('thx')) * Math.PI) / 180;
      const f1 = [...this.fistBones].find(([o]) => o.parent === b.parent && /HandFingers1$/.test(canon(o.name)));
      if (!f1) continue;
      const d = new THREE.Vector3(0, 1, 0).applyQuaternion(f1[1].rest);
      const tx = new THREE.Vector3(1, 0, 0).applyQuaternion(fb.rest);
      const ts = tx.dot(d) < 0 ? 1 : -1;
      fb.fold = (ts * thumbFold * Math.PI) / 180;
    }
    const hp = this.hips.parent!;
    hp.updateMatrixWorld(true);
    this.hipsParentWorldInv.copy(hp.matrixWorld).invert();
    hp.getWorldQuaternion(this.hipsParentQuat);
    this.hipsRestPos.copy(tgtP(this.hips));
    this.refHipsRest.copy(refP('hips'));
    this.hipScale = this.hipsRestPos.y / Math.max(0.01, this.refHipsRest.y);
    for (const n of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) {
      const b = bones.get(n);
      if (b) this.soles.push(b);
    }
    this.root.updateMatrixWorld(true);
    this.soleRest = this.soleHeight();
    const rootY = (o: THREE.Object3D) => this.root.worldToLocal(o.getWorldPosition(new THREE.Vector3())).y;
    for (const side of ['Left', 'Right']) {
      const up = bones.get(`${side}UpLeg`);
      const low = bones.get(`${side}Leg`);
      const foot = bones.get(`${side}Foot`);
      const toe = bones.get(`${side}ToeBase`) ?? null;
      if (up && low && foot) this.legs.push({ up, low, foot, toe, ankleRest: rootY(foot), toeRest: toe ? rootY(toe) : rootY(foot) });
    }
    for (const side of ['Left', 'Right'] as const) {
      const c = bones.get(`${side}Shoulder`);
      if (c && !this.byBone.has(c)) this.clav.set(c, side === 'Left' ? 'L' : 'R');
    }
    for (const L of this.legs) {
      const a = L.foot.getWorldPosition(new THREE.Vector3());
      const t = L.toe?.getWorldPosition(new THREE.Vector3());
      this.toeLen.push(t ? a.distanceTo(t) * 0.42 : 0);
    }
    const arm = ARM_SCALE[id] ?? 1;
    if (arm !== 1)
      for (const n of ['LeftArm', 'RightArm']) {
        const b = bones.get(n);
        if (b) b.scale.multiplyScalar(arm);
      }
  }

  private restPos = new Map<THREE.Object3D, THREE.Vector3>();

  /** Lowest sole joint in root space (root's own scale undone: same units as the hips offset). */
  private soleHeight(): number {
    let low = Infinity;
    for (const b of this.soles) {
      b.getWorldPosition(_v2);
      this.root.worldToLocal(_v2);
      low = Math.min(low, _v2.y);
    }
    return low === Infinity ? 0 : low;
  }

  apply(p: Float32Array, facing: number): void {
    const ref = this.ref;
    ref.apply(p, 1, false);
    // fist tightness per hand: relaxed curl in guard, a closed fist when the arm extends (strike contact)
    const ext = (el: number) => Math.max(0, Math.min(1, 1 - Math.abs(p[JOINT_INDEX[el === 0 ? 'elL' : 'elR'] * 3 + 2]) / 70));
    const curlL = this.curlBase > 0 ? Math.min(1, this.curlBase + FIST_STRIKE * ext(0)) : 0;
    const curlR = this.curlBase > 0 ? Math.min(1, this.curlBase + FIST_STRIKE * ext(1)) : 0;
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
        const fb = this.fistBones.get(bone);
        if (fb) {
          const c = fb.side ? curlR : curlL;
          bone.quaternion.copy(fb.rest);
          if (fb.fold) bone.quaternion.multiply(_q.setFromAxisAngle(_Z, fb.fold * c));
          bone.quaternion.multiply(_q.setFromAxisAngle(_X, fb.ang * c));
        } else bone.quaternion.copy(this.restLocal.get(bone)!);
        const side = this.clav.get(bone);
        if (side) this.driveClavicle(bone, side, parentQ);
        wq.copy(parentQ).multiply(bone.quaternion);
      }
    }
    // hips translation: reference offset from rest, scaled to the model's leg length
    ref.joints.hips.getWorldPosition(_v);
    _v.sub(this.refHipsRest).multiplyScalar(this.hipScale).add(this.hipsRestPos);
    _v3.copy(_v);
    this.hips.position.copy(_v.applyMatrix4(_m.copy(this.hipsParentWorldInv)));
    // ground clamp: a crouched or bobbing pose must never push the shoes into the floor (PO: "Schuhe tauchen ein")
    if (this.soles.length) {
      this.root.updateMatrixWorld(true);
      const sink = this.soleRest - this.soleHeight();
      if (sink > 0.002) {
        _v3.y += sink;
        this.hips.position.copy(_v3.applyMatrix4(_m));
      }
    }
    if (this.plant) this.plantFeet();
    this.rollToes();
    // cartoon stretch: elbow/wrist (knee/ankle) move away from their parent along the bone, the skin follows
    for (const [jn, ch] of LIMB_STRETCH) {
      const b = this.joints[jn];
      if (!b) continue;
      let rest = this.restPos.get(b);
      if (!rest) this.restPos.set(b, (rest = b.position.clone()));
      b.position.copy(rest).multiplyScalar(1 + p[ch]);
    }
    const [w, h] = squashScale(p[S_SQ]);
    this.root.scale.set(facing * w, h, w);
  }

  /** Shoulder girdle (S13): lift and forward slide of the clavicle from the reference arm direction in chest space.
   *  The upper arm keeps its world orientation (it is retargeted in world space), so only the shoulder joint moves:
   *  raised arms pull the shoulders up, a reach brings the shoulder forward (a few cm more reach on punches). */
  private driveClavicle(bone: THREE.Bone, side: 'L' | 'R', parentQ: THREE.Quaternion): void {
    const ref = this.ref;
    const sh = ref.joints[side === 'L' ? 'shL' : 'shR'];
    const el = ref.joints[side === 'L' ? 'elL' : 'elR'];
    sh.getWorldPosition(_ds);
    el.getWorldPosition(_de);
    _de.sub(_ds).normalize();
    ref.joints.chest.getWorldQuaternion(_qc);
    _de.applyQuaternion(_qe.copy(_qc).invert()); // arm direction in chest space (x forward, y up)
    const fromDown = Math.acos(Math.max(-1, Math.min(1, -_de.y))); // 0 hanging, pi straight up
    const lift = smooth01((fromDown - 1.05) / 2.0) * 0.5; // up to ~29 deg overhead, nothing below ~60 deg
    const reach = Math.max(-0.5, Math.min(1, _de.x * 1.2)) * 0.26 * (1 - 0.6 * smooth01((fromDown - 1.6) / 1.2)); // ~15 deg fwd
    const s = side === 'L' ? 1 : -1; // L tip at -z: +x rotation lifts it, -y rotation brings it forward
    _qe.setFromAxisAngle(_X, s * lift).premultiply(_q.setFromAxisAngle(_Y, -s * reach));
    // chest-space delta -> root space, applied on the clavicle's world rotation
    _qe.premultiply(_qc).multiply(_q.copy(_qc).invert());
    _q2.copy(parentQ).multiply(bone.quaternion);
    _q2.premultiply(_qe);
    bone.quaternion.copy(_q.copy(parentQ).invert().multiply(_q2));
  }

  /** Toe roll (S13): with the heel up, the toes bend at the ball of the foot and stay on the floor instead of pushing
   *  into it (the foot is a rigid plank otherwise). */
  private rollToes(): void {
    if (!this.legs.length) return;
    this.root.updateMatrixWorld(true);
    const floor = this.root.getWorldPosition(_v2).y;
    const sy = Math.abs(this.root.matrixWorld.elements[5]) || 1;
    this.legs.forEach((L, i) => {
      if (!L.toe || !this.toeLen[i]) return;
      L.toe.getWorldPosition(_pa);
      if (_pa.y - floor > 0.07 * sy) return; // ball of the foot off the floor (kicks, jumps): as authored
      const len = this.toeLen[i] * sy;
      // the toe points along the foot: ankle -> ball direction continued
      L.foot.getWorldPosition(_pk);
      _u.subVectors(_pa, _pk).normalize();
      _tg.copy(_pa).addScaledVector(_u, len);
      const below = floor + 0.004 - _tg.y;
      if (below <= 0) return;
      // bend up just enough to put the tip on the floor (at most ~60 deg)
      _w.copy(_tg);
      _w.y = floor + 0.004;
      _n.subVectors(_w, _pa);
      const h = Math.sqrt(Math.max(0, len * len - (_n.y * _n.y)));
      const flat = Math.hypot(_n.x, _n.z) || 1;
      _w.set(_pa.x + (_n.x / flat) * h, floor + 0.004, _pa.z + (_n.z / flat) * h);
      _w.sub(_pa).normalize();
      const ang = _u.angleTo(_w);
      if (ang < 0.01) return;
      _qd.setFromUnitVectors(_u, _w);
      if (ang > 1.05) _qd.slerp(_qp.identity(), 1 - 1.05 / ang);
      rotateWorld(L.toe, _qd);
      L.toe.updateMatrixWorld(true);
    });
  }

  /** Two-bone leg IK: a foot whose lowest point (ankle or toe) floats above its rest height is lowered onto the
   *  floor by bending the knee; the foot keeps its world orientation (a raised heel stays raised, the toes touch).
   *  Feet higher than ~30 cm (knees, kicks, steps) are left alone. */
  private plantFeet(): void {
    this.root.updateMatrixWorld(true);
    const sy = Math.abs(this.root.matrixWorld.elements[5]) || 1;
    for (const L of this.legs) {
      L.foot.getWorldPosition(_pa);
      const toeY = L.toe ? this.root.worldToLocal(L.toe.getWorldPosition(_pt)).y - L.toeRest : Infinity;
      const ankY = this.root.worldToLocal(_pk.copy(_pa)).y - L.ankleRest;
      const lift = Math.min(ankY, toeY);
      if (!(lift > 0.008) || lift > 0.34) continue;
      const k = lift < 0.24 ? 1 : 1 - (lift - 0.24) / 0.1; // fade out toward real steps
      const drop = lift * k * sy;
      L.up.getWorldPosition(_ph);
      L.low.getWorldPosition(_pk);
      const footWorld = L.foot.getWorldQuaternion(_qf);
      _tg.copy(_pa).y -= drop;
      const l1 = _ph.distanceTo(_pk);
      const l2 = _pk.distanceTo(_pa);
      const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, _ph.distanceTo(_tg)));
      // knee: change the interior angle to the one that reaches the target distance
      _u.subVectors(_ph, _pk);
      _w.subVectors(_pa, _pk);
      const cur = _u.angleTo(_w);
      const want = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
      _n.crossVectors(_u, _w);
      if (_n.lengthSq() < 1e-10) _n.set(1, 0, 0).applyQuaternion(L.low.getWorldQuaternion(_qk));
      _n.normalize();
      rotateWorld(L.low, _qd.setFromAxisAngle(_n, want - cur));
      // thigh: swing the chain so the ankle lands on the target
      L.low.updateMatrixWorld(true);
      L.foot.getWorldPosition(_pa);
      _u.subVectors(_pa, _ph).normalize();
      _w.subVectors(_tg, _ph).normalize();
      rotateWorld(L.up, _qd.setFromUnitVectors(_u, _w));
      L.up.updateMatrixWorld(true);
      // the foot keeps its orientation in the world
      L.foot.parent!.getWorldQuaternion(_qk);
      L.foot.quaternion.copy(unmirror(L.foot, _qk.invert().multiply(footWorld)));
      L.foot.updateMatrixWorld(true);
    }
  }

  setFlash(intensity: number, color?: THREE.ColorRepresentation): void {
    if (color !== undefined) this.flashColor.set(color);
    for (const m of this.materials) {
      m.emissive.copy(this.flashColor);
      m.emissiveIntensity = intensity;
    }
  }
}
