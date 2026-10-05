// Procedural humanoid rig. A rig is a hierarchy of joints (Object3D pivots) with
// rigid toon-shaded parts. Poses are flat arrays of Euler angles per joint so
// they can be blended cheaply. A future glTF skinned model only needs to expose
// the same joint names to reuse every pose/animation in the game.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addPart, latheProfile, skinnedOutlineMat, taperedCapsule, toonMat } from './toon';

export const JOINTS = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shL',
  'elL',
  'haL',
  'shR',
  'elR',
  'haR',
  'thL',
  'knL',
  'ftL',
  'thR',
  'knR',
  'ftR',
] as const;
export type JointName = (typeof JOINTS)[number];
export const JOINT_INDEX: Record<JointName, number> = Object.fromEntries(JOINTS.map((j, i) => [j, i])) as Record<
  JointName,
  number
>;

/** Flat pose: 3 Euler angles (degrees) per joint, then rootX, rootY (m), rootRotZ, rootRotY (deg), then the cartoon
 *  deformation channels: arm L/R and leg L/R stretch (fraction of the limb length, 0 = rest) and body squash
 *  (+ = squashed: shorter and wider, - = stretched tall). */
export const POSE_LEN = JOINTS.length * 3 + 9;
export const R_X = JOINTS.length * 3;
export const R_Y = R_X + 1;
export const R_ROT = R_X + 2;
export const R_YAW = R_X + 3;
export const S_AL = R_X + 4;
export const S_AR = R_X + 5;
export const S_LL = R_X + 6;
export const S_LR = R_X + 7;
export const S_SQ = R_X + 8;

/** Root scale for a squash value (volume roughly kept). */
export function squashScale(sq: number): [number, number] {
  const y = Math.max(0.5, 1 - sq);
  return [1 / Math.sqrt(y), y];
}

export interface Palette {
  skin: number;
  top: number;
  top2: number;
  pants: number;
  pants2: number;
  shoes: number;
  sole: number;
  hat: number;
  metal: number;
  shades: number;
}

export interface HumanoidSpec {
  thigh: number;
  shin: number;
  ankle: number;
  hipHalf: number;
  pelvisR: number;
  waistR: number;
  chestR: number;
  shoulderR: number;
  depth: number;
  torsoLow: number;
  torsoHigh: number;
  shoulderHalf: number;
  neckLen: number;
  headR: number;
  upperArm: number;
  foreArm: number;
  armR: [number, number];
  foreR: [number, number];
  hand: number;
  thighR: [number, number];
  shinR: [number, number];
  foot: [number, number, number];
  /** Stylized (chunky) look: no generic jaw block; faces/hair come from decorate(). */
  stylized?: boolean;
  /** Head sphere scale (x forward, y up, z side). */
  headScale?: [number, number, number];
  /** Fraction of the upper arm covered by the top's sleeve (0 = tank top, 1 = long). Default 1. */
  sleeve?: number;
}

export class Rig {
  readonly root = new THREE.Group();
  /** Pivot at hip height: root offsets/rotations from poses are applied here. */
  readonly body = new THREE.Group();
  private readonly inner = new THREE.Group();
  readonly pivotY: number;
  readonly joints = {} as Record<JointName, THREE.Object3D>;
  readonly materials: (THREE.MeshToonMaterial | THREE.MeshStandardMaterial)[] = [];
  readonly props: Record<string, THREE.Object3D> = {};
  private flashColor = new THREE.Color(1, 1, 1);

  constructor(
    readonly spec: HumanoidSpec,
    readonly palette: Palette,
  ) {
    this.root.add(this.body);
    this.body.add(this.inner);
    this.pivotY = spec.thigh + spec.shin + spec.ankle;
    this.inner.position.y = -this.pivotY;
    this.build();
  }

  mat(color: number): THREE.MeshToonMaterial {
    const m = toonMat(color);
    this.materials.push(m);
    return m;
  }

  private joint(name: JointName, parent: THREE.Object3D, pos: [number, number, number]): THREE.Object3D {
    const j = new THREE.Bone();
    j.name = name;
    j.position.set(...pos);
    j.rotation.order = 'ZYX';
    parent.add(j);
    this.joints[name] = j;
    return j;
  }

  private build(): void {
    const s = this.spec;
    const p = this.palette;
    const skin = this.mat(p.skin);
    const top = this.mat(p.top);
    const pants = this.mat(p.pants);
    const shoe = this.mat(p.shoes);
    const sole = this.mat(p.sole);
    const legLen = s.thigh + s.shin + s.ankle;

    const hips = this.joint('hips', this.inner, [0, legLen, 0]);
    addPart(
      hips,
      latheProfile([
        [-0.13, 0.0],
        [-0.12, s.pelvisR * 0.8],
        [-0.06, s.pelvisR],
        [0.04, s.pelvisR * 0.95],
        s.stylized ? [0.07, s.waistR * 0.8] : [0.1, s.waistR * 0.9],
      ]),
      pants,
      { scale: [s.depth, 1, 1] },
    );
    const spine = this.joint('spine', hips, [0, 0.06, 0]);
    addPart(
      spine,
      latheProfile([
        [-0.02, s.waistR * 0.9],
        [0.08, s.waistR],
        [s.torsoLow + 0.04, s.waistR * 1.05],
        [s.torsoLow + 0.06, 0],
      ]),
      top,
      { scale: [s.depth, 1, 1] },
    );
    const chest = this.joint('chest', spine, [0, s.torsoLow, 0]);
    addPart(
      chest,
      latheProfile([
        [-0.06, 0.0],
        [-0.05, s.waistR * 1.04],
        [s.torsoHigh * 0.45, s.chestR],
        [s.torsoHigh * 0.85, s.shoulderR],
        [s.torsoHigh + 0.02, s.shoulderR * 0.75],
        [s.torsoHigh + 0.06, 0.0],
      ]),
      top,
      { scale: [s.depth, 1, 1] },
    );
    const neck = this.joint('neck', chest, [0, s.torsoHigh, 0]);
    addPart(neck, taperedCapsule(s.neckLen, s.headR * 0.42, s.headR * 0.45), skin, { pos: [0, s.neckLen, 0] });
    const head = this.joint('head', neck, [0.01, s.neckLen, 0]);
    addPart(head, new THREE.SphereGeometry(s.headR, 28, 20), skin, {
      pos: [0.01, s.headR * 0.95, 0],
      scale: s.headScale ?? [1.0, 1.12, 0.9],
    });
    if (!s.stylized) {
      // simple nose/jaw volume for silhouette readability
      addPart(head, new RoundedBoxGeometry(s.headR * 0.9, s.headR * 0.6, s.headR * 1.3, 2, s.headR * 0.25), skin, {
        pos: [s.headR * 0.32, s.headR * 0.42, 0],
      });
    }

    for (const side of ['L', 'R'] as const) {
      const z = side === 'L' ? -1 : 1;
      const sh = this.joint(`sh${side}`, chest, [0, s.torsoHigh - 0.05, z * s.shoulderHalf]);
      const sleeve = s.sleeve ?? 1;
      if (sleeve >= 1) {
        addPart(sh, new THREE.SphereGeometry(s.armR[0] * 1.15, 14, 10), top);
        addPart(sh, taperedCapsule(s.upperArm, s.armR[0], s.armR[1]), top);
      } else {
        addPart(sh, new THREE.SphereGeometry(s.armR[0] * 1.08, 16, 12), sleeve > 0 ? top : skin);
        addPart(sh, taperedCapsule(s.upperArm, s.armR[0], s.armR[1], 16), skin);
        if (sleeve > 0)
          addPart(sh, taperedCapsule(s.upperArm * sleeve, s.armR[0] * 1.12, s.armR[0] * 1.08 - (s.armR[0] - s.armR[1]) * sleeve, 16), top);
      }
      const el = this.joint(`el${side}`, sh, [0, -s.upperArm, 0]);
      addPart(el, taperedCapsule(s.foreArm, s.foreR[0], s.foreR[1]), skin);
      const ha = this.joint(`ha${side}`, el, [0, -s.foreArm, 0]);
      addPart(ha, new RoundedBoxGeometry(s.hand * 0.95, s.hand, s.hand * 0.85, 2, s.hand * 0.28), skin, {
        pos: [0.01, -s.hand * 0.45, 0],
      });

      const th = this.joint(`th${side}`, hips, [0, -0.05, z * s.hipHalf]);
      addPart(th, taperedCapsule(s.thigh, s.thighR[0], s.thighR[1]), pants);
      const kn = this.joint(`kn${side}`, th, [0, -s.thigh, 0]);
      addPart(kn, taperedCapsule(s.shin, s.shinR[0], s.shinR[1]), pants);
      const ft = this.joint(`ft${side}`, kn, [0, -s.shin, 0]);
      const [fl, fh, fw] = s.foot;
      addPart(ft, new RoundedBoxGeometry(fl, fh, fw, 2, fh * 0.4), shoe, { pos: [fl * 0.28, -s.ankle + fh * 0.62, 0] });
      addPart(ft, new RoundedBoxGeometry(fl * 1.02, fh * 0.3, fw * 1.04, 1, fh * 0.12), sole, {
        pos: [fl * 0.28, -s.ankle + fh * 0.14, 0],
        outline: 0.008,
      });
    }
  }

  /**
   * Bake all rigid parts into ONE GPU-skinned mesh (vertex colours) plus ONE skinned
   * outline mesh, bound to the joint hierarchy. Cuts ~80 draw calls per fighter to 2.
   * Props (e.g. the mic) stay separate so they can be shown/hidden.
   */
  bake(opts: { soft?: boolean; outline?: boolean } = {}): void {
    this.root.updateMatrixWorld(true);
    const invInner = this.inner.matrixWorld.clone().invert();
    const boneIndex = new Map<THREE.Object3D, number>(JOINTS.map((n, i) => [this.joints[n], i]));
    const propSet = new Set<THREE.Object3D>();
    for (const p of Object.values(this.props)) p.traverse((o) => propSet.add(o));
    const geos: THREE.BufferGeometry[] = [];
    const remove: THREE.Mesh[] = [];
    const m4 = new THREE.Matrix4();
    this.inner.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || propSet.has(o) || o.material instanceof THREE.ShaderMaterial) return;
      let j: THREE.Object3D | null = o.parent;
      while (j && !boneIndex.has(j)) j = j.parent;
      if (!j) return;
      const bi = boneIndex.get(j)!;
      const shell = o.children.find((c) => c instanceof THREE.Mesh && c.material instanceof THREE.ShaderMaterial) as THREE.Mesh | undefined;
      const thick = shell ? ((shell.material as THREE.ShaderMaterial).uniforms.thickness.value as number) : 0;
      let g = o.geometry.clone();
      if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      g.applyMatrix4(m4.multiplyMatrices(invInner, o.matrixWorld));
      const n = g.attributes.position.count;
      const c = (o.material as THREE.MeshToonMaterial).color;
      const col = new Float32Array(n * 3);
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      const ow = new Float32Array(n).fill(thick);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        si[i * 4] = bi;
        sw[i * 4] = 1;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.setAttribute('outlineW', new THREE.Float32BufferAttribute(ow, 1));
      geos.push(g);
      remove.push(o);
    });
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    for (const m of remove) m.parent?.remove(m);
    const bodyMat = opts.soft
      ? new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.58, metalness: 0.04 })
      : toonMat(0xffffff);
    bodyMat.vertexColors = true;
    this.materials.push(bodyMat);
    const skeleton = new THREE.Skeleton(JOINTS.map((n) => this.joints[n] as THREE.Bone));
    const meshes: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.Material>[] = [new THREE.SkinnedMesh(merged, bodyMat)];
    if (opts.outline !== false) meshes.push(new THREE.SkinnedMesh(merged, skinnedOutlineMat()));
    for (const sm of meshes) {
      sm.frustumCulled = false;
      this.inner.add(sm);
    }
    this.root.updateMatrixWorld(true);
    for (const sm of meshes) sm.bind(skeleton);
  }

  /** Apply a flat pose array. */
  private restPos = new Map<THREE.Object3D, THREE.Vector3>();

  /** `deform` = apply the stretch/squash channels (off when this rig only serves as a retargeting reference). */
  apply(p: Float32Array, facing: number, deform = true): void {
    for (let i = 0; i < JOINTS.length; i++) {
      const j = this.joints[JOINTS[i]];
      j.rotation.set(p[i * 3] * DEG, p[i * 3 + 1] * DEG, p[i * 3 + 2] * DEG);
    }
    this.body.position.set(p[R_X], p[R_Y] + this.pivotY, 0);
    this.body.rotation.set(0, p[R_YAW] * DEG, p[R_ROT] * DEG);
    const [w, h] = deform ? squashScale(p[S_SQ]) : [1, 1];
    this.root.scale.set(facing * w, h, w);
    if (!deform) return;
    for (const [jn, ch] of LIMB_STRETCH) {
      const j = this.joints[jn];
      let rest = this.restPos.get(j);
      if (!rest) this.restPos.set(j, (rest = j.position.clone()));
      j.position.copy(rest).multiplyScalar(1 + p[ch]);
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

export const DEG = Math.PI / 180;

/** Joints whose offset from the parent grows with a stretch channel (elbow + wrist for arms, knee + ankle for legs). */
export const LIMB_STRETCH: [JointName, number][] = [
  ['elL', S_AL],
  ['haL', S_AL],
  ['elR', S_AR],
  ['haR', S_AR],
  ['knL', S_LL],
  ['ftL', S_LL],
  ['knR', S_LR],
  ['ftR', S_LR],
];
