// Props held in a fighter's hand (the PO's gold mic, the joint): placed every frame from the hand bone's world
// transform instead of being parented, so bone scales (model scale, ARM_SCALE) never shrink or stretch them.
// Per-rig grip offsets are in hand-local axes (metres / degrees), found with the lab: /?lab=poses&hp=mic&hpo=..&hpr=..
import * as THREE from 'three';
import type { CharacterRig } from './glbRig';
import { propModel, type PropId } from './propModels';

export interface Grip {
  /** offset from the hand bone in its local axes (m) */
  pos: [number, number, number];
  /** rotation in hand-local axes (deg, XYZ) */
  rot: [number, number, number];
}

/** Grips per prop and model (the GLB fighters share the skin.py skeleton; 'default' = procedural rigs). */
export const GRIPS: Record<string, Record<string, Grip>> = {
  mic: {
    // GLB fighters (skin.py skeleton): hand bone +Y points back to the wrist; head up to the mouth in the sing pose
    glb: { pos: [0, -0.05, 0], rot: [0, -35, 90] },
    default: { pos: [0, -0.05, 0], rot: [0, -35, 90] },
  },
  joint: {
    // between the fingers, tip (+X of the model) pointing forward/out of the hand
    glb: { pos: [0.06, -0.1, 0], rot: [0, 0, 90] },
    default: { pos: [0.06, -0.1, 0], rot: [0, 0, 90] },
  },
};

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _o = new THREE.Vector3();
const _r = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _g = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);

export class HandProp {
  readonly obj: THREE.Object3D;

  constructor(
    readonly id: PropId,
    parent: THREE.Object3D,
    model?: THREE.Object3D,
  ) {
    this.obj = model ?? propModel(id) ?? new THREE.Group();
    this.obj.visible = false;
    parent.add(this.obj);
  }

  get ok(): boolean {
    return this.obj.children.length > 0 || (this.obj as THREE.Mesh).isMesh === true;
  }

  /** Put the prop into `hand` of `rig` (grip by the rig's model id, else 'default'). */
  place(rig: CharacterRig, hand: 'haL' | 'haR', visible: boolean, grip?: Grip): void {
    this.obj.visible = visible;
    if (!visible) return;
    const kind = (rig as unknown as { model?: unknown }).model ? 'glb' : 'default';
    const g = grip ?? GRIPS[this.id]?.[kind] ?? GRIPS[this.id]?.default;
    const bone = rig.joints[hand];
    bone.updateWorldMatrix(true, false);
    bone.matrixWorld.decompose(_p, _q, _s);
    // world = bone rotation (keeping a mirror of facing -1 rigs, dropping the bone's scale) * grip
    _m.compose(_p, _q, _s.set(Math.sign(_s.x) || 1, 1, 1));
    const [rx, ry, rz] = g?.rot ?? [0, 0, 0];
    _r.setFromEuler(_e.set((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180));
    _g.compose(_o.set(...(g?.pos ?? [0, 0, 0])), _r, _one);
    _m.multiply(_g);
    _m.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
  }
}
