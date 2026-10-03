// Procedural humanoid rig. A rig is a hierarchy of joints (Object3D pivots) with
// rigid toon-shaded parts. Poses are flat arrays of Euler angles per joint so
// they can be blended cheaply. A future glTF skinned model only needs to expose
// the same joint names to reuse every pose/animation in the game.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { addPart, latheProfile, taperedCapsule, toonMat } from './toon';

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

/** Flat pose: 3 Euler angles (degrees) per joint, then rootX, rootY (m), rootRotZ, rootRotY (deg). */
export const POSE_LEN = JOINTS.length * 3 + 4;
export const R_X = JOINTS.length * 3;
export const R_Y = R_X + 1;
export const R_ROT = R_X + 2;
export const R_YAW = R_X + 3;

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
}

export class Rig {
  readonly root = new THREE.Group();
  /** Pivot at hip height: root offsets/rotations from poses are applied here. */
  readonly body = new THREE.Group();
  private readonly inner = new THREE.Group();
  readonly pivotY: number;
  readonly joints = {} as Record<JointName, THREE.Object3D>;
  readonly materials: THREE.MeshToonMaterial[] = [];
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
    const j = new THREE.Group();
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
        [0.1, s.waistR * 0.9],
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
    addPart(head, new THREE.SphereGeometry(s.headR, 20, 16), skin, {
      pos: [0.01, s.headR * 0.95, 0],
      scale: [1.0, 1.12, 0.9],
    });
    // simple nose/jaw volume for silhouette readability
    addPart(head, new RoundedBoxGeometry(s.headR * 0.9, s.headR * 0.6, s.headR * 1.3, 2, s.headR * 0.25), skin, {
      pos: [s.headR * 0.32, s.headR * 0.42, 0],
    });

    for (const side of ['L', 'R'] as const) {
      const z = side === 'L' ? -1 : 1;
      const sh = this.joint(`sh${side}`, chest, [0, s.torsoHigh - 0.05, z * s.shoulderHalf]);
      addPart(sh, new THREE.SphereGeometry(s.armR[0] * 1.15, 14, 10), top);
      addPart(sh, taperedCapsule(s.upperArm, s.armR[0], s.armR[1]), top);
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

  /** Apply a flat pose array. */
  apply(p: Float32Array, facing: number): void {
    for (let i = 0; i < JOINTS.length; i++) {
      const j = this.joints[JOINTS[i]];
      j.rotation.set(p[i * 3] * DEG, p[i * 3 + 1] * DEG, p[i * 3 + 2] * DEG);
    }
    this.body.position.set(p[R_X], p[R_Y] + this.pivotY, 0);
    this.body.rotation.set(0, p[R_YAW] * DEG, p[R_ROT] * DEG);
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

export const DEG = Math.PI / 180;
