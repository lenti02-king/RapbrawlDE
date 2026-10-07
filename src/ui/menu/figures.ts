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
import { clearPlateCache, type LivingPlate } from '../v2/living';

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

/** Per-fighter flavour of the waiting loop (S12): Jazeek nods to the menu beat, Manuellsen breathes heavy and rolls
 *  his neck, Bonez sways with his chin up, Lacazette barely moves. */
const STYLE: Record<string, { nod: number; breath: number; sway: number; look: number }> = {
  jazeek: { nod: 5, breath: 1, sway: 1.2, look: 0.8 },
  bonez: { nod: 0, breath: 1, sway: 1.5, look: 1.2 },
  manuellsen: { nod: 0, breath: 1.8, sway: 0.6, look: 0.6 },
  lacazette: { nod: 0, breath: 0.7, sway: 0.5, look: 0.7 },
};

/** Relaxed waiting loop on top of the fighter's stance: breathing, a slow weight shift, small look-arounds. */
export function waitingPose(base: Float32Array, t: number, seed: number, out: Float32Array, id = ''): void {
  const st = STYLE[id] ?? { nod: 0, breath: 1, sway: 1, look: 1 };
  out.set(base);
  if (st.nod) {
    // head bob on the 90 BPM menu beat (down on the beat, quick and loose)
    const ph = (t * 1.5) % 1;
    out[J.head * 3 + 2] += Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 2) * st.nod;
    out[J.chest * 3 + 2] += Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 2) * st.nod * 0.25;
  }
  if (id === 'manuellsen') out[J.neck * 3 + 0] += Math.sin(t * 0.6 + seed) * 4; // slow neck roll
  if (st.breath !== 1) {
    const b = Math.sin(t * 1.6 + seed);
    out[J.chest * 3 + 2] += b * 1.6 * (st.breath - 1);
    out[J.shL * 3 + 2] += b * 1.4 * (st.breath - 1);
    out[J.shR * 3 + 2] -= b * 1.4 * (st.breath - 1);
  }
  const ws0 = Math.sin(t * 0.75 + seed * 2) * (st.sway - 1);
  out[R_X] += ws0 * 0.018;
  out[J.hips * 3 + 1] += ws0 * 4;
  const lk = Math.sin(t * 0.45 + seed * 3);
  out[J.head * 3 + 1] += Math.sign(lk) * Math.pow(Math.abs(lk), 3) * 14 * (st.look - 1);
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

// Rigs kept between screens (S12, PO: "kleine Delays bei jedem Tippen"): building a fighter clones the GLB, so a
// screen change or a tap on another fighter re-used to cost a rebuild per figure; now they come out of a pool.
const rigPool = new Map<string, CharacterRig[]>();
function takeRig(id: string): CharacterRig {
  return rigPool.get(id)?.pop() ?? buildCharacter(id, 0);
}
function giveRig(id: string, rig: CharacterRig): void {
  rig.root.removeFromParent();
  const list = rigPool.get(id) ?? [];
  if (list.length < 2) {
    list.push(rig);
    rigPool.set(id, list);
  } else disposeRig(rig);
}
function disposeRig(rig: CharacterRig): void {
  rig.root.removeFromParent();
  rig.root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m) for (const x of Array.isArray(m) ? m : [m]) x.dispose(); // the rig's own material clones
  });
}

function sharedRenderer(): THREE.WebGLRenderer | null {
  // a context iOS took away (memory pressure, too many contexts) and never gave back: start over with a new one
  if (shared?.getContext().isContextLost()) dropShared();
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
  // S12: while the context is lost the canvas is empty - the CSS painting must show instead of a black screen
  canvas.addEventListener('webglcontextlost', () => owner?.contextLost());
  canvas.addEventListener('webglcontextrestored', () => owner?.contextRestored());
  return shared;
}

function dropShared(): void {
  if (!shared) return;
  owner?.dispose();
  for (const list of rigPool.values()) for (const r of list) disposeRig(r);
  rigPool.clear();
  clearPlateCache();
  shared.dispose();
  shared.forceContextLoss();
  shared.domElement.remove();
  shared = null;
}

/** Free the menus' GL context (call when a match starts: only the game's context should hold textures then). */
export function releaseMenuRenderer(): void {
  dropShared();
}

const byRoot = new WeakMap<HTMLElement, MenuFigures>();
/** The screen's figure layer (created once per screen root: the living plate and the fighters share it). */
export function menuFigures(root: HTMLElement): MenuFigures {
  let f = byRoot.get(root);
  if (!f || f.disposed) {
    f = new MenuFigures(root, root.querySelector('.v2-embers') ?? root.querySelector('.v2-stage.front'));
    byRoot.set(root, f);
  }
  return f;
}

export class MenuFigures {
  private renderer: THREE.WebGLRenderer | null;
  private bg: LivingPlate | null = null;
  disposed = false;
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
    this.renderer.domElement.style.visibility = '';
    root.insertBefore(this.renderer.domElement, before);
    // cel-shaded fighters (D43): the toon ramp saturates above ~1, so the menu light is softer than for PBR and the
    // coloured stage rims carry the scene's colours onto the figure
    this.scene.add(new THREE.HemisphereLight(0xe4e0ff, 0x2a2232, 0.62));
    const key = new THREE.DirectionalLight(0xfff1de, 1.45);
    key.position.set(2.5, 4, 5);
    const fill = new THREE.DirectionalLight(0xbfc8ff, 0.35);
    fill.position.set(-3, 1.5, 4);
    this.scene.add(key, fill);
  }

  get canvas(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null;
  }

  /** The painted background drawn first into the same picture (design v2 living plates, D43). */
  setBackground(bg: LivingPlate | null): void {
    this.bg?.dispose();
    this.bg = bg;
    if (!this.raf && this.renderer) this.loop();
  }

  set(specs: FigureSpec[]): void {
    this.releaseFigs();
    this.figs = specs.map((spec, i) => {
      const rig = takeRig(spec.id);
      const group = new THREE.Group();
      group.add(rig.root, contactShadow());
      const rim = new THREE.DirectionalLight(spec.rim, 2.6);
      rim.position.set(-spec.facing * 3, 2.5, -3);
      rim.target = rig.root;
      this.scene.add(group, rim);
      let rim2: THREE.DirectionalLight | null = null;
      if (spec.rim2 !== undefined) {
        rim2 = new THREE.DirectionalLight(spec.rim2, 2.1);
        rim2.position.set(spec.facing * 3, 2.2, -2.6);
        rim2.target = rig.root;
        this.scene.add(rim2);
      }
      const set = ANIM_SETS[spec.id];
      const stance = (set?.stance ?? {}) as PoseDef;
      // the player can pick the menu pose (Kämpfer anpassen -> POSE): upright showcase or the fight stance
      let pose = 'showcase';
      try {
        pose = JSON.parse(localStorage.getItem('rapbrawl.menuPose') ?? '"showcase"');
      } catch {
        /* storage unavailable */
      }
      const base = toArr(spec.showcase && pose !== 'fight' ? showcasePose(spec.id, stance) : stance);
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
    if (!r || r.getContext().isContextLost()) return;
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
    const bg = this.bg?.draw(r, W, H, box) ? this.bg : null;
    const pr = bg?.rect(box) ?? null;
    const t = (performance.now() - this.t0) / 1000;
    for (const f of this.figs) {
      const a = f.spec.anchor.getBoundingClientRect();
      if (!a.height) continue;
      const fh = a.height; // figure height in px
      let fx = a.left - box.left + a.width / 2;
      let fy = a.top - box.top + a.height; // feet
      if (bg && pr) {
        // stand in the painting: the same parallax as the painted floor under the feet
        const d = bg.depthAt((fx - pr.x) / pr.u + bg.x0Ref, (fy - pr.y) / pr.u);
        const [sx, sy] = bg.shiftPx(d, pr.w, pr.h);
        fx += sx;
        fy += sy;
      }
      // viewport: a box around the figure, a bit of room for the shadow below the feet
      const vw = fh * 1.1;
      const vh = fh * 1.18;
      const vx = fx - vw / 2;
      const vy = fy + fh * 0.06 - vh;
      for (const g of this.figs) g.group.visible = g === f;
      waitingPose(f.base, t, f.seed, f.pose, f.spec.id);
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

  private releaseFigs(): void {
    for (const f of this.figs) {
      this.scene.remove(f.group, f.rim);
      if (f.rim2) this.scene.remove(f.rim2);
      giveRig(f.spec.id, f.rig);
    }
    this.figs = [];
  }

  // a lost context's canvas is not transparent (Chromium paints it white, the iPhone black) - it would cover the CSS
  // painting under it, so it is hidden until the context is back
  contextLost(): void {
    this.bg?.contextLost();
    if (this.renderer) this.renderer.domElement.style.visibility = 'hidden';
  }

  contextRestored(): void {
    this.bg?.contextLost(); // re-check the painting's upload in the new context
    if (this.renderer) this.renderer.domElement.style.visibility = '';
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.bg?.dispose();
    this.bg = null;
    this.releaseFigs();
    if (owner === this) {
      owner = null;
      this.renderer?.domElement.remove();
    }
    this.renderer = null;
  }
}
