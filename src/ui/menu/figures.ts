// Live 3D fighters for the menus (main menu favourite, character-select pedestals): the real GLB models in a small
// transparent WebGL overlay, standing in a relaxed "waiting" loop (breathing, weight shift, looking around) with a
// contact shadow and side-coloured rim light, so they stand ON the painted pedestal instead of being pasted on.
// Each figure follows an anchor element (feet = anchor's bottom centre, height = anchor's height); one renderer draws
// all figures with scissored viewports. Presentation only.
import * as THREE from 'three';
import { getFighter } from '../../core/registry';
import { UNITS_PER_METER } from '../../core/math';
import { ANIM_SETS } from '../../render/animator';
import { buildCharacter } from '../../render/characters';
import type { CharacterRig } from '../../render/glbRig';
import { toArr, type PoseDef } from '../../render/pose';
import { JOINT_INDEX, R_X, R_Y } from '../../render/rig';
import { isPhone } from '../../render/textureBudget';
import { showcasePose } from '../../render/anims/showcase';

export interface FigureSpec {
  id: string;
  /** Element whose box marks the figure: feet at its bottom centre, its height = figure height. */
  anchor: HTMLElement;
  facing: 1 | -1;
  /** Rim light colour (side colour: red P1, blue P2, gold for the menu favourite). */
  rim: number;
  /** Turn toward the camera (rad); default 0.55. */
  turn?: number;
  /** Second rim light from the other side (stage lights), optional. */
  rim2?: number;
  /** Upright hero pose for showcase screens instead of the fight stance (D42). */
  showcase?: boolean;
}

interface Fig {
  spec: FigureSpec;
  rig: CharacterRig;
  group: THREE.Group;
  rim: THREE.DirectionalLight;
  rim2: THREE.DirectionalLight | null;
  base: Float32Array;
  pose: Float32Array;
  seed: number;
  height: number;
}

const J = JOINT_INDEX;
let shadowTex: THREE.Texture | null = null;

function contactShadow(): THREE.Mesh {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.7), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = -1;
  return m;
}

/** Relaxed waiting loop on top of the fighter's stance: breathing, a slow weight shift, small look-arounds. */
export function waitingPose(base: Float32Array, t: number, seed: number, out: Float32Array): void {
  out.set(base);
  const br = Math.sin(t * 2.1 + seed);
  out[J.chest * 3 + 2] += br * 2.4;
  out[J.shL * 3 + 2] += br * 2;
  out[J.shR * 3 + 2] -= br * 1.6;
  out[R_Y] += (br * 0.5 + 0.5) * 0.006;
  // weight shift: hips drift sideways and twist a little, the upper body counters
  const ws = Math.sin(t * 0.75 + seed * 2);
  out[R_X] += ws * 0.018;
  out[J.hips * 3 + 1] += ws * 4;
  out[J.chest * 3 + 1] -= ws * 3;
  // looking around: slow head yaw/nod with a pause in the middle
  const look = Math.sin(t * 0.45 + seed * 3);
  out[J.head * 3 + 1] += Math.sign(look) * Math.pow(Math.abs(look), 3) * 14;
  out[J.head * 3 + 2] += Math.sin(t * 0.9 + seed) * 2.5;
  // hands: a slight loosening and re-tightening of the guard
  const hs = Math.sin(t * 1.3 + seed * 5);
  out[J.elL * 3 + 2] += hs * 3;
  out[J.elR * 3 + 2] -= hs * 2.5;
}

// One WebGL context for all menu screens (D41): a fresh context per screen re-uploaded both fighters every time and
// iOS Safari killed the tab after a few screen changes. Released while a match runs (releaseMenuRenderer).
let shared: THREE.WebGLRenderer | null = null;
let sharedFailed = false;
let owner: MenuFigures | null = null;

function sharedRenderer(): THREE.WebGLRenderer | null {
  if (shared || sharedFailed) return shared;
  const canvas = document.createElement('canvas');
  canvas.className = 'mm-figures';
  try {
    shared = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    sharedFailed = true; // no WebGL: menus still work, just without the live fighters
    return null;
  }
  shared.setClearColor(0x000000, 0);
  shared.toneMapping = THREE.ACESFilmicToneMapping;
  shared.toneMappingExposure = 1.05;
  shared.outputColorSpace = THREE.SRGBColorSpace;
  shared.setScissorTest(true);
  shared.autoClear = false;
  return shared;
}

/** Free the menus' GL context (call when a match starts: only the game's context should hold textures then). */
export function releaseMenuRenderer(): void {
  if (!shared) return;
  owner?.dispose();
  shared.dispose();
  shared.forceContextLoss();
  shared.domElement.remove();
  shared = null;
}

export class MenuFigures {
  private renderer: THREE.WebGLRenderer | null;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(18, 1, 0.1, 40);
  private figs: Fig[] = [];
  private raf = 0;
  private t0 = performance.now();

  constructor(
    private root: HTMLElement,
    before: Element | null,
  ) {
    this.renderer = sharedRenderer();
    if (!this.renderer) return;
    owner?.dispose();
    owner = this;
    root.insertBefore(this.renderer.domElement, before);
    this.scene.add(new THREE.HemisphereLight(0xe4e6ff, 0x2a2232, 1.05));
    const key = new THREE.DirectionalLight(0xfff1de, 2.4);
    key.position.set(2.5, 4, 5);
    const fill = new THREE.DirectionalLight(0xbfc8ff, 0.5);
    fill.position.set(-3, 1.5, 4);
    this.scene.add(key, fill);
  }

  get canvas(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null;
  }

  set(specs: FigureSpec[]): void {
    for (const f of this.figs) {
      this.scene.remove(f.group, f.rim);
      if (f.rim2) this.scene.remove(f.rim2);
    }
    this.figs = specs.map((spec, i) => {
      const rig = buildCharacter(spec.id, 0);
      const group = new THREE.Group();
      group.add(rig.root, contactShadow());
      const rim = new THREE.DirectionalLight(spec.rim, 3.2);
      rim.position.set(-spec.facing * 3, 2.5, -3);
      rim.target = rig.root;
      this.scene.add(group, rim);
      let rim2: THREE.DirectionalLight | null = null;
      if (spec.rim2 !== undefined) {
        rim2 = new THREE.DirectionalLight(spec.rim2, 2.6);
        rim2.position.set(spec.facing * 3, 2.2, -2.6);
        rim2.target = rig.root;
        this.scene.add(rim2);
      }
      const set = ANIM_SETS[spec.id];
      const stance = (set?.stance ?? {}) as PoseDef;
      const base = toArr(spec.showcase ? showcasePose(spec.id, stance) : stance);
      let height = 1.8;
      try {
        height = getFighter(spec.id).height / UNITS_PER_METER;
      } catch {
        /* non-fighter visual */
      }
      return { spec, rig, group, rim, rim2, base, pose: new Float32Array(base.length), seed: i * 1.7 + spec.id.length, height };
    });
    if (!this.raf) this.loop();
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.root.isConnected) return this.dispose();
    this.render();
  };

  render(): void {
    const r = this.renderer;
    if (!r) return;
    const box = this.root.getBoundingClientRect();
    const W = Math.round(box.width);
    const H = Math.round(box.height);
    if (!W || !H) return;
    const dpr = Math.min(isPhone() ? 1.5 : 2, window.devicePixelRatio || 1); // phones: the canvas spans the screen
    if (r.getPixelRatio() !== dpr) r.setPixelRatio(dpr);
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== W || size.y !== H) r.setSize(W, H, false);
    r.setScissor(0, 0, W, H);
    r.setViewport(0, 0, W, H);
    r.clear();
    const t = (performance.now() - this.t0) / 1000;
    for (const f of this.figs) {
      const a = f.spec.anchor.getBoundingClientRect();
      if (!a.height) continue;
      const fh = a.height; // figure height in px
      const fx = a.left - box.left + a.width / 2;
      const fy = a.top - box.top + a.height; // feet
      // viewport: a box around the figure, a bit of room for the shadow below the feet
      const vw = fh * 1.1;
      const vh = fh * 1.18;
      const vx = fx - vw / 2;
      const vy = fy + fh * 0.06 - vh;
      for (const g of this.figs) g.group.visible = g === f;
      waitingPose(f.base, t, f.seed, f.pose);
      f.rig.apply(f.pose, f.spec.facing);
      f.group.rotation.y = -f.spec.facing * (f.spec.turn ?? 0.55);
      // camera: world height covered by the viewport = model height * 1.18, looking slightly down at the pedestal
      const mh = f.height;
      const span = mh * 1.18;
      const dist = span / 2 / Math.tan((this.cam.fov / 2) * (Math.PI / 180));
      const cy = mh * 1.18 * 0.5 - mh * 0.06;
      this.cam.aspect = vw / vh;
      this.cam.position.set(0, cy + dist * 0.07, dist);
      this.cam.lookAt(0, cy, 0);
      this.cam.updateProjectionMatrix();
      const gy = H - (vy + vh);
      r.setViewport(vx, gy, vw, vh);
      r.setScissor(vx, gy, vw, vh);
      r.render(this.scene, this.cam);
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const f of this.figs) {
      this.scene.remove(f.group, f.rim);
      if (f.rim2) this.scene.remove(f.rim2);
      f.group.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const x of Array.isArray(m) ? m : [m]) x.dispose(); // the rig's own material clones
      });
    }
    this.figs = [];
    if (owner === this) {
      owner = null;
      this.renderer?.domElement.remove();
    }
    this.renderer = null;
  }
}
