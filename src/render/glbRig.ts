// Real character models (glTF/GLB with a humanoid skeleton, e.g. Mixamo auto-rig) driven by the
// game's existing pose system. Every pose is first applied to an invisible procedural reference
// rig; each mapped bone then copies the reference joint's rotation *change* from rest
// (world-space delta), after aligning the model's rest pose (T/A-pose) to the reference rest pose
// (arms down). So all move clips, cinematics, intros and wins work unchanged on imported models.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

/** Try to load `<base>/<id>.glb` for each fighter (missing files are fine: procedural fallback). */
export async function loadCharacterModels(ids: string[], base = 'assets/characters', overrides: Record<string, string> = {}): Promise<string[]> {
  const loader = new GLTFLoader();
  const ok: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const url = overrides[id] ?? `${base}/${id}.glb`;
      try {
        const res = await fetch(url);
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || type.includes('text/html')) return;
        const buf = await res.arrayBuffer();
        const gltf = await loader.parseAsync(buf, url.replace(/[^/]*$/, ''));
        if (!isHumanoid(gltf.scene)) {
          console.warn(`[models] ${url}: no humanoid skeleton (Mixamo bone names expected) — using placeholder`);
          return;
        }
        loaded.set(id, gltf.scene);
        ok.push(id);
      } catch (e) {
        void e;
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

    // ---- scale to the fighter's height, feet on the ground
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const h = Math.max(0.01, box.max.y - box.min.y);
    const s = heightM / h;
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
    this.hips.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        this.order.push(o as THREE.Bone);
        this.restLocal.set(o as THREE.Bone, o.quaternion.clone());
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
        wq.copy(_q).multiply(e.alignedRest);
        bone.quaternion.copy(_q2.copy(parentQ).invert().multiply(wq));
      } else {
        bone.quaternion.copy(this.restLocal.get(bone)!);
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
