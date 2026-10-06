// 2D cutout fighters (D42): Manuellsen and Lacazette exactly as the PO drew them. The reference art is cut into puppet
// pieces (tools/characters/cutout.py: public/assets/characters/<id>/<piece>.webp + parts.json). A hidden procedural
// skeleton (render/rig.ts) with the art's proportions runs every existing animation; each piece then takes the angle
// of its bone as seen from the side (x toward the opponent, y up) while its position follows the art: the arms
// stay on the drawn shoulders, the legs on the drawn hips. Presentation only.
import * as THREE from 'three';
import type { CharacterRig } from './glbRig';
import { type HumanoidSpec, Rig } from './rig';
import type { JointName } from './rig';

interface PieceMeta {
  bbox: [number, number, number, number];
  pivot: [number, number];
  axis: [number, number];
  parent: string | null;
  order: number;
  bone: [JointName, JointName] | JointName | null;
}
export interface CutoutMeta {
  id: string;
  scale: number; // metres per image px
  height: number;
  top: number;
  sole: number;
  size: [number, number];
  pieces: Record<string, PieceMeta>;
}

const metas: Record<string, CutoutMeta> = {};
const textures: Record<string, Record<string, THREE.Texture>> = {};
/** Ids drawn as cutouts (their art loads asynchronously; rigs built before it arrives fill in when it does). */
export const CUTOUT_IDS = ['manuellsen', 'lacazette'];

/** UI accent colours (P1 / mirror match P2), from the outfits. */
export const CUTOUT_ACCENTS: Record<string, string[]> = { manuellsen: ['#e8312f', '#f2f2f2'], lacazette: ['#e9e6f2', '#1b1b22'] };

export function isCutout(id: string): boolean {
  return CUTOUT_IDS.includes(id);
}

/** Load the cutout art (call once at boot; resolves when every piece texture is decoded). */
export async function loadCutouts(base = 'assets/characters'): Promise<string[]> {
  const loader = new THREE.TextureLoader();
  const ok: string[] = [];
  await Promise.all(
    CUTOUT_IDS.map(async (id) => {
      try {
        const meta = (await (await fetch(`${base}/${id}/parts.json`)).json()) as CutoutMeta;
        const tex: Record<string, THREE.Texture> = {};
        await Promise.all(
          Object.keys(meta.pieces).map(async (k) => {
            const t = await loader.loadAsync(`${base}/${id}/${k}.webp`);
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
            tex[k] = t;
          }),
        );
        metas[id] = meta;
        textures[id] = tex;
        ok.push(id);
        for (const r of live) if (r.id === id) r.build();
      } catch (e) {
        console.warn('cutout', id, e);
      }
    }),
  );
  return ok;
}

const live = new Set<CutoutRig>();
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Skeleton proportions from the art (so the hidden rig moves the hips/feet where the drawing has them). */
function specFor(m: CutoutMeta | undefined, h: number): HumanoidSpec {
  const P = m?.pieces;
  const s = m?.scale ?? h / 1890;
  const d = (a?: [number, number], b?: [number, number]) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) * s : 0);
  const thigh = d(P?.thighR?.pivot, P?.thighR?.axis) || 0.46;
  const shin = d(P?.shinR?.pivot, P?.shinR?.axis) || 0.4;
  const ankle = m && P?.footR ? (m.sole - P.footR.pivot[1]) * s : 0.1;
  const torso = m && P?.torso ? (P.torso.pivot[1] - P.torso.axis[1]) * s : 0.6;
  const head = m && P?.head ? (P.head.pivot[1] - m.top) * s : 0.26;
  const shoulderHalf = P?.armR && P?.armL ? (Math.abs(P.armL.pivot[0] - P.armR.pivot[0]) / 2) * s : 0.24;
  const hipHalf = P?.thighR && P?.thighL ? (Math.abs(P.thighL.pivot[0] - P.thighR.pivot[0]) / 2) * s : 0.11;
  return {
    thigh,
    shin,
    ankle,
    hipHalf,
    pelvisR: hipHalf * 1.4,
    waistR: shoulderHalf * 0.75,
    chestR: shoulderHalf * 0.85,
    shoulderR: shoulderHalf * 0.9,
    depth: 0.7,
    torsoLow: torso * 0.42,
    torsoHigh: torso * 0.5,
    shoulderHalf,
    neckLen: torso * 0.08,
    headR: head * 0.42,
    upperArm: d(P?.armR?.pivot, P?.armR?.axis) || 0.3,
    foreArm: d(P?.foreR?.pivot, P?.foreR?.axis) || 0.26,
    armR: [0.06, 0.05],
    foreR: [0.05, 0.04],
    hand: 0.09,
    thighR: [0.08, 0.06],
    shinR: [0.06, 0.05],
    foot: [0.26, 0.09, 0.11],
  };
}

interface Piece {
  key: string;
  meta: PieceMeta;
  outer: THREE.Group; // at the pivot, turned to the bone angle, scaled along the bone (foreshortening)
  inner: THREE.Group; // undoes the art's own axis angle
  mat: THREE.MeshStandardMaterial;
  alpha: number; // art axis angle (rad, y up)
  len: number; // art bone length (m)
}

export class CutoutRig implements CharacterRig {
  readonly root = new THREE.Group();
  readonly body: THREE.Object3D;
  readonly joints: Record<JointName, THREE.Object3D>;
  readonly props: Record<string, THREE.Object3D> = {};
  private skel: Rig;
  private puppet = new THREE.Group(); // never mirrored
  private pieces: Piece[] = [];
  private byKey = new Map<string, Piece>();
  private flash = new THREE.Color(1, 1, 1);
  private flashK = 0;
  private shadow: THREE.Mesh;

  constructor(
    readonly id: string,
    height: number,
  ) {
    this.skel = new Rig(specFor(metas[id], height), { skin: 0x9a6a48, top: 0x222222, top2: 0xffffff, pants: 0x222222, pants2: 0x222222, shoes: 0xffffff, sole: 0x333333, hat: 0x222222, metal: 0xcccccc, shades: 0x111111 });
    this.skel.root.visible = false;
    this.body = this.skel.body;
    this.joints = this.skel.joints;
    this.root.add(this.skel.root, this.puppet);
    // soft contact shadow (flat pieces cast no useful shadow themselves)
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.root.add(this.shadow);
    live.add(this);
    this.build();
  }

  /** (Re)build the pieces once the art is loaded. */
  build(): void {
    const meta = metas[this.id];
    const tex = textures[this.id];
    if (!meta || !tex || this.pieces.length) return;
    const s = meta.scale;
    for (const [key, pm] of Object.entries(meta.pieces)) {
      const [bx, by, bw, bh] = pm.bbox;
      const [px, py] = pm.pivot;
      const mat = new THREE.MeshStandardMaterial({
        map: tex[key],
        emissiveMap: tex[key],
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: 0.42,
        roughness: 1,
        metalness: 0,
        transparent: true,
        alphaTest: 0.03,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const geo = new THREE.PlaneGeometry(bw * s, bh * s);
      // plane centre relative to the pivot (image y down -> world y up)
      geo.translate((bx + bw / 2 - px) * s, -(by + bh / 2 - py) * s, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 20 + pm.order;
      mesh.frustumCulled = false;
      const inner = new THREE.Group();
      inner.add(mesh);
      const outer = new THREE.Group();
      outer.add(inner);
      outer.position.z = pm.order * 0.004;
      this.puppet.add(outer);
      const alpha = Math.atan2(-(pm.axis[1] - py), pm.axis[0] - px);
      const p: Piece = { key, meta: pm, outer, inner, mat, alpha, len: Math.hypot(pm.axis[0] - px, pm.axis[1] - py) * s };
      inner.rotation.z = -alpha;
      this.pieces.push(p);
      this.byKey.set(key, p);
    }
    // parents before children
    const depth = (p: Piece): number => (p.meta.parent ? 1 + depth(this.byKey.get(p.meta.parent)!) : 0);
    this.pieces.sort((a, b) => depth(a) - depth(b));
    this.setFlash(this.flashK);
  }

  /** Screen angle (rad, in this rig's root frame: already mirrored by facing) and foreshortening of a skeleton bone. */
  private bone(a: JointName, b: JointName): [number, number] {
    this.joints[a].getWorldPosition(tmpA);
    this.joints[b].getWorldPosition(tmpB);
    this.root.worldToLocal(tmpA);
    this.root.worldToLocal(tmpB);
    const dx = tmpB.x - tmpA.x;
    const dy = tmpB.y - tmpA.y;
    const l3 = Math.hypot(dx, dy, tmpB.z - tmpA.z) || 1;
    return [Math.atan2(dy, dx), Math.max(0.62, Math.min(1, Math.hypot(dx, dy) / l3))];
  }

  /** The art is never mirrored (the PO's design stays exactly as drawn, D42): facing left only mirrors the motion,
   *  and the arm/leg pieces swap which skeleton side drives them, so the lead hand is always the one toward the
   *  opponent. */
  apply(p: Float32Array, facing: number): void {
    this.skel.apply(p, facing);
    this.root.updateMatrixWorld(true);
    const meta = metas[this.id];
    if (!meta || !this.pieces.length) return;
    const s = meta.scale;
    const swap = (j: JointName): JointName => (facing >= 0 ? j : ((j.endsWith('L') ? j.slice(0, -1) + 'R' : j.endsWith('R') ? j.slice(0, -1) + 'L' : j) as JointName));
    // per piece: final angle of its art axis (theta), foreshortening along it (k), pivot position (x, y)
    const st = new Map<string, { theta: number; k: number; x: number; y: number }>();
    for (const pc of this.pieces) {
      const pm = pc.meta;
      let theta = pc.alpha;
      let k = 1;
      if (typeof pm.bone === 'string') {
        // head: the skeleton's head up axis (nods, the torso lean), toned down for the front-view face
        const h = this.joints[pm.bone];
        h.getWorldPosition(tmpA);
        tmpB.set(0, 0.2, 0).applyMatrix4(h.matrixWorld);
        this.root.worldToLocal(tmpA);
        this.root.worldToLocal(tmpB);
        theta = pc.alpha + wrap(Math.atan2(tmpB.y - tmpA.y, tmpB.x - tmpA.x) - pc.alpha) * 0.7;
      } else if (pm.bone) {
        const [ang, kk] = this.bone(swap(pm.bone[0]), swap(pm.bone[1]));
        if (pc.key === 'torso') theta = pc.alpha + wrap(ang - pc.alpha) * 0.6;
        else {
          theta = ang;
          k = kk;
        }
      }
      let x: number;
      let y: number;
      if (!pm.parent) {
        this.joints.hips.getWorldPosition(tmpA);
        this.root.worldToLocal(tmpA);
        x = tmpA.x;
        y = tmpA.y;
      } else {
        const par = this.byKey.get(pm.parent)!;
        const ps = st.get(pm.parent)!;
        // the child's pivot sits on the parent's art: turn the art offset with the parent, then foreshorten it
        // along the parent's axis
        const ox = (pm.pivot[0] - par.meta.pivot[0]) * s;
        const oy = -(pm.pivot[1] - par.meta.pivot[1]) * s;
        const r = ps.theta - par.alpha;
        const vx = ox * Math.cos(r) - oy * Math.sin(r);
        const vy = ox * Math.sin(r) + oy * Math.cos(r);
        const ux = Math.cos(ps.theta);
        const uy = Math.sin(ps.theta);
        const along = vx * ux + vy * uy;
        x = ps.x + vx + (ps.k - 1) * along * ux;
        y = ps.y + vy + (ps.k - 1) * along * uy;
      }
      st.set(pc.key, { theta, k, x, y });
      pc.outer.position.set(x, y, pm.order * 0.004);
      pc.outer.rotation.z = theta;
      pc.outer.scale.set(k, 1, 1);
    }
    this.shadow.position.x = st.get('torso')?.x ?? 0;
  }

  setFlash(intensity: number, color?: THREE.ColorRepresentation): void {
    this.flashK = intensity;
    if (color !== undefined) this.flash.set(color);
    for (const pc of this.pieces) {
      pc.mat.emissive.setRGB(1, 1, 1).lerp(this.flash, Math.min(1, intensity));
      pc.mat.emissiveIntensity = 0.42 + intensity * 0.8;
    }
  }

  dispose(): void {
    live.delete(this);
  }
}
