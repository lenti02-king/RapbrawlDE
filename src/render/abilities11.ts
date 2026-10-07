// Presentation of the D43 abilities (session 11) outside their cinematics: the 5000-Kurden crowd, Lacazette's glint
// and his black off-roader crossing the stage, Manuellsen turning to concrete, Lacazette's puffer vest armour, the
// speech bubbles. Shared builders (crew rigs, the off-roader, comic text) are used by cines11.ts too.
// Presentation only: reads the sim state, never writes it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { UNITS_PER_METER } from '../core/math';
import type { GameState, ProjectileState } from '../core/state';
import type { FighterAnimator } from './animator';
import { buildProceduralRig } from './characters';
import type { CharacterRig } from './glbRig';
import { toArr, type PoseDef } from './pose';
import { POSE_LEN, type Rig } from './rig';
import { smokeTexture } from './props';

const U = UNITS_PER_METER;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1e-6, b - a));
const pop = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

// ------------------------------------------------------------------ comic text
/** Canvas text sprite (brush or block lettering with ink outline); width in metres, height from the text. */
export function textSprite(text: string, o: { width: number; color?: string; stroke?: string; font?: string; bg?: string; lines?: number } = { width: 2 }): THREE.Sprite {
  const c = document.createElement('canvas');
  const lines = text.split('\n');
  c.width = 1024;
  c.height = Math.round(150 * lines.length + 40);
  const g = c.getContext('2d')!;
  const font = o.font ?? '"Anton", "Barlow Condensed", sans-serif';
  let size = 120;
  g.font = `400 ${size}px ${font}`;
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  size = Math.min(130, Math.floor((size * 960) / Math.max(1, widest)));
  g.font = `400 ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  lines.forEach((l, i) => {
    const y = 20 + 150 * i + 75;
    g.lineJoin = 'round';
    g.lineWidth = size * 0.16;
    g.strokeStyle = o.stroke ?? '#0b0910';
    g.strokeText(l, 512, y + size * 0.05);
    g.strokeText(l, 512, y);
    g.fillStyle = o.color ?? '#ffffff';
    g.fillText(l, 512, y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 20;
  s.scale.set(o.width, (o.width * c.height) / c.width, 1);
  return s;
}

/** Comic speech bubble (white, ink outline, a tail at the bottom pointing to the speaker), `w` metres wide. */
export function bubbleSprite(text: string, w = 1.7, tail: 'left' | 'right' = 'left'): THREE.Sprite {
  const c = document.createElement('canvas');
  const lines = text.split('\n');
  c.width = 1024;
  const lh = 118;
  const bodyH = lh * lines.length + 70;
  c.height = bodyH + 110;
  const g = c.getContext('2d')!;
  const r = 70;
  const x0 = 24;
  const y0 = 24;
  const x1 = c.width - 24;
  const y1 = y0 + bodyH;
  const tx = tail === 'left' ? 230 : c.width - 230;
  const dir = tail === 'left' ? -1 : 1;
  g.beginPath();
  g.moveTo(x0 + r, y0);
  g.arcTo(x1, y0, x1, y1, r);
  g.arcTo(x1, y1, x0, y1, r);
  g.lineTo(tx + 60, y1);
  g.lineTo(tx + dir * 90, y1 + 95); // the tail
  g.lineTo(tx - 50, y1);
  g.arcTo(x0, y1, x0, y0, r);
  g.arcTo(x0, y0, x1, y0, r);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 18;
  g.strokeStyle = '#0b0910';
  g.stroke();
  const font = '"Permanent Marker", "Anton", sans-serif';
  let size = 100;
  g.font = `400 ${size}px ${font}`;
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  size = Math.min(104, Math.floor((size * 900) / Math.max(1, widest)));
  g.font = `400 ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#0b0910';
  lines.forEach((l, i) => g.fillText(l, 512, y0 + 35 + lh * i + lh / 2));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 20;
  sp.userData.aspect = c.height / c.width;
  sp.scale.set(w, w * sp.userData.aspect, 1);
  return sp;
}

/** Comic "sound" burst (star with a word), e.g. BATSCH! — returns a sprite sized `w` metres. */
export function burstSprite(word: string, fill: string, w = 0.9): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.translate(256, 160);
  g.beginPath();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = i % 2 ? 108 : 156;
    g.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.92);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = '#100c14';
  g.stroke();
  g.font = '400 112px "Rubik Wet Paint", "Anton", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 22;
  g.strokeText(word, 0, 6);
  g.fillStyle = '#ffffff';
  g.fillText(word, 0, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 21;
  s.scale.set(w, w * 0.625, 1);
  return s;
}

// ------------------------------------------------------------------ crew rigs (procedural, toon)
/** Running with a raised fist (k = phase 0..1 of the stride). */
export function runPose(k: number, fist = true): PoseDef {
  const a = Math.sin(k * Math.PI * 2);
  return {
    y: 0.04 + Math.abs(Math.cos(k * Math.PI * 2)) * 0.06,
    j: {
      spine: [0, 0, -12],
      chest: [0, a * 8, -8],
      head: [0, 0, 6],
      thL: [8, 10, 46 * a],
      knL: [0, 0, -30 - 40 * Math.max(0, -a)],
      thR: [-8, 10, -46 * a],
      knR: [0, 0, -30 - 40 * Math.max(0, a)],
      shL: fist ? [20, 0, 150 + 10 * a] : [30, 0, 40 - 50 * a],
      elL: fist ? [0, 0, 40] : [0, 0, 80],
      shR: [-30, 0, 40 + 50 * a],
      elR: [0, 0, 80],
    },
  };
}

export function crewRig(i: number): Rig {
  return buildProceduralRig('crew', i);
}

// ------------------------------------------------------------------ the off-roader (no brand, no badges)
/** Boxy black off-roader, faces +x, 3.4 m long; `userData.window` = the driver's window (left side, +z), wheels in
 *  `userData.wheels`. Front-left of the car = (+x, +z). */
export function makeOffroader(): THREE.Group {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  // gunmetal reads as black paint under the toon ramp while keeping its form (pure black was a flat silhouette)
  const paint = new THREE.MeshToonMaterial({ color: 0x2c3039 });
  const paintDark = new THREE.MeshToonMaterial({ color: 0x1a1c22 });
  const chrome = new THREE.MeshToonMaterial({ color: 0xd2d7df, emissive: 0x2a2e36 });
  const glass = new THREE.MeshToonMaterial({ color: 0x2a4258, emissive: 0x0c1622 });
  const tyre = new THREE.MeshToonMaterial({ color: 0x101012 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff4cf });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffa62a });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2440 });
  const gloss = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const ink = new THREE.MeshBasicMaterial({ color: 0x050407, side: THREE.BackSide });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0, r = 0.06, parent: THREE.Object3D = body) => {
    const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45));
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    const shell = new THREE.Mesh(geo, ink);
    shell.scale.setScalar(1.025);
    mesh.add(shell);
    return mesh;
  };
  // cartoon gloss: thin bright strips on the upper edges and a slanted glint on the glass
  const strip = (w: number, h: number, x: number, y: number, z: number, ry = 0, rz = 0, mat: THREE.Material = gloss) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.set(0, ry, rz);
    body.add(m);
    return m;
  };
  box(3.3, 0.78, 1.5, paint, 0, 0.82); // lower body
  box(2.2, 0.74, 1.42, paint, -0.4, 1.56, 0, 0.05); // the upright cabin
  box(2.3, 0.06, 1.3, paintDark, -0.4, 1.96, 0, 0.02); // roof rails
  box(0.05, 0.5, 1.2, glass, 0.71, 1.6, 0, 0.02); // windscreen (upright, it is a box)
  for (const z of [0.72, -0.72]) {
    const sd = Math.sign(z);
    box(0.5, 0.42, 0.04, glass, -0.5, 1.62, z, 0.02);
    box(0.5, 0.42, 0.04, glass, -1.2, 1.62, z, 0.02);
    if (z < 0) box(0.62, 0.42, 0.04, glass, 0.25, 1.62, z, 0.02); // the passenger side stays closed
    box(3.0, 0.07, 0.03, chrome, 0, 1.05, z * 1.035, 0.02); // side trim line
    box(1.5, 0.07, 0.2, chrome, -0.1, 0.42, z * 1.05, 0.02); // running board
    // flared wheel arches
    for (const x of [1.08, -1.08]) box(0.98, 0.16, 0.1, paintDark, x, 0.9, z * 1.03, 0.04);
    // gloss along the shoulder line and the cabin, glints on the windows
    strip(2.9, 0.035, 0.05, 1.16, z * 1.012, sd > 0 ? 0 : Math.PI);
    strip(2.0, 0.03, -0.42, 1.88, z * 0.99, sd > 0 ? 0 : Math.PI);
    for (const x of [-0.5, -1.2]) strip(0.08, 0.38, x + 0.08, 1.62, z * 1.035, sd > 0 ? 0 : Math.PI, 0.5);
  }
  strip(3.0, 0.04, 0, 1.215, 0, 0, 0).rotation.set(-Math.PI / 2, 0, 0); // hood edge highlight seen from above
  // the classic box face: round headlights with glow, indicator pods on the wings, slatted grille, chrome bumper
  const glowMat = new THREE.SpriteMaterial({ map: starTexture(), color: 0xfff1c8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const z of [0.5, -0.5]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20), lamp);
    hl.rotation.z = Math.PI / 2;
    hl.position.set(1.66, 0.98, z);
    body.add(hl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 6, 20), chrome);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(1.68, 0.98, z);
    body.add(ring);
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(1.76, 0.98, z);
    glow.scale.setScalar(0.55);
    body.add(glow);
    box(0.16, 0.08, 0.12, amber, 1.42, 1.25, z * 1.18, 0.02);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.14), tail);
    tl.position.set(-1.66, 0.95, z * 1.05);
    body.add(tl);
  }
  box(0.08, 0.34, 0.66, paintDark, 1.68, 0.86, 0, 0.03); // grille
  for (let i = -2; i <= 2; i++) box(0.03, 0.3, 0.035, chrome, 1.72, 0.86, i * 0.12, 0.01);
  box(0.14, 0.16, 1.56, chrome, 1.7, 0.5, 0, 0.05); // bumpers
  box(0.14, 0.16, 1.56, chrome, -1.7, 0.5, 0, 0.05);
  // spare wheel on the tailgate (with a cover)
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 24), tyre);
  spare.rotation.z = Math.PI / 2;
  spare.position.set(-1.78, 1.08, 0);
  body.add(spare);
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.24, 24), chrome);
  cover.rotation.z = Math.PI / 2;
  cover.position.set(-1.79, 1.08, 0);
  body.add(cover);
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [
    [1.08, 0.74],
    [1.08, -0.74],
    [-1.08, 0.74],
    [-1.08, -0.74],
  ]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24), tyre);
    t.rotation.x = Math.PI / 2;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.34, 20), chrome);
    r.rotation.x = Math.PI / 2;
    w.add(t, r);
    // five spokes (dark) on the outer face so the spin reads
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), tyre);
      sp.position.set(Math.cos((k / 5) * Math.PI * 2) * 0.12, Math.sin((k / 5) * Math.PI * 2) * 0.12, 0.175 * Math.sign(z));
      sp.rotation.z = (k / 5) * Math.PI * 2 + Math.PI / 2;
      w.add(sp);
    }
    w.position.set(x, 0.42, z);
    root.add(w);
    wheels.push(w);
  }
  // the driver's window (left = +z when facing +x) is open: dark inside, a gloved arm with a cartoon pistol pokes out
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshBasicMaterial({ color: 0x07080c }));
  hole.position.set(0.25, 1.62, 0.715);
  body.add(hole);
  const win = new THREE.Object3D();
  win.position.set(0.25, 1.62, 0.78);
  body.add(win);
  const gun = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 10), paintDark);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = 0.1;
  const grip = box(0.07, 0.12, 0.05, tyre, 0, -0.04, 0.3, 0.015, gun);
  const slide = box(0.06, 0.06, 0.24, tyre, 0, 0.03, 0.4, 0.015, gun);
  void grip;
  void slide;
  gun.add(sleeve);
  gun.position.copy(win.position).add(new THREE.Vector3(0, -0.05, -0.12));
  gun.visible = false;
  body.add(gun);
  root.userData.wheels = wheels;
  root.userData.window = win;
  root.userData.gun = gun;
  root.traverse((o) => {
    o.castShadow = !(o instanceof THREE.Sprite);
  });
  return root;
}

let starTex: THREE.Texture | null = null;
/** Star-shaped muzzle flash / glint texture. */
export function starTexture(): THREE.Texture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,240,180,0.9)');
  grd.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = grd;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 18 : 64;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  return starTex;
}

// ------------------------------------------------------------------ projectiles
export function makeProjectile11(kind: string): THREE.Object3D | null {
  if (kind === 'mob') {
    // eight crew members in a loose wedge (front row first), a dust cloud at their feet, "5000" counter sign
    const g = new THREE.Group();
    const rigs: { rig: Rig; x: number; z: number; ph: number }[] = [];
    const spots: [number, number][] = [
      [0.7, 0.35],
      [0.45, -0.4],
      [0.1, 0.75],
      [0.0, -0.05],
      [-0.35, 0.45],
      [-0.5, -0.6],
      [-0.85, 0.1],
      [-1.1, -0.35],
    ];
    spots.forEach(([x, z], i) => {
      const rig = crewRig(i);
      rig.root.position.set(x, -0.85, z);
      g.add(rig.root);
      rigs.push({ rig, x, z, ph: (i * 0.37) % 1 });
    });
    const dust = new THREE.Group();
    const tex = smokeTexture();
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xd8ccb8, transparent: true, opacity: 0.7, depthWrite: false }));
      sp.position.set(-1.3 + i * 0.22, -0.7, ((i * 37) % 7) * 0.12 - 0.4);
      sp.userData.seed = i;
      dust.add(sp);
    }
    g.add(dust);
    g.userData.mob = rigs;
    g.userData.dust = dust;
    g.userData.arr = new Float32Array(POSE_LEN);
    return g;
  }
  if (kind === 'glint') {
    const g = new THREE.Group();
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: 0xeef8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    star.scale.setScalar(0.7);
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    streak.position.x = -0.75;
    g.add(streak, star);
    g.userData.star = star;
    return g;
  }
  if (kind === 'gwagon') {
    const car = makeOffroader();
    car.scale.setScalar(0.92);
    return car;
  }
  return null;
}

export function updateProjectile11(m: THREE.Object3D, p: ProjectileState, s: GameState, time: number, vfx: { sparks: (x: number, y: number, n: number, c: THREE.Color, sp: number, dir: number, life?: number) => void; dust: (x: number, y: number, n: number, sp: number, c?: THREE.Color) => void }): boolean {
  if (p.kind === 'mob') {
    m.position.set(p.x / U, p.y / U, 0.05);
    // never mirrored (faces, chains): the rigs turn instead
    const rigs = m.userData.mob as { rig: Rig; x: number; z: number; ph: number }[];
    const arr = m.userData.arr as Float32Array<ArrayBuffer>;
    const fadeIn = clamp01(p.age / 8);
    rigs.forEach((r, i) => {
      const k = (time * 2.4 + r.ph) % 1;
      r.rig.root.position.set(r.x * p.dir, -0.85 + (1 - fadeIn) * -0.4, r.z);
      r.rig.apply(toArr(runPose(k, i % 3 !== 1), arr), p.dir);
    });
    const dust = m.userData.dust as THREE.Group;
    dust.children.forEach((c, i) => {
      const sp = c as THREE.Sprite;
      sp.scale.setScalar(0.55 + 0.25 * Math.sin(time * 6 + i));
      sp.position.x = (-1.3 + i * 0.22) * p.dir;
      sp.material.rotation = time * (i % 2 ? 1 : -1);
    });
    if (p.age % 3 === 0) vfx.dust(p.x / U - p.dir * 0.8, 0, 2, 0.6, new THREE.Color(0xd8ccb8));
    void s;
    return true;
  }
  if (p.kind === 'glint') {
    m.position.set(p.x / U, p.y / U, 0.25);
    m.scale.x = p.dir;
    const star = m.userData.star as THREE.Sprite;
    star.material.rotation = time * 6;
    star.scale.setScalar(0.55 + 0.2 * Math.sin(time * 40));
    return true;
  }
  if (p.kind === 'gwagon') {
    m.position.set(p.x / U, 0, -0.25);
    m.rotation.y = p.dir > 0 ? 0 : Math.PI; // turn, never mirror
    const body = m.getObjectByName('body');
    if (body) body.position.y = Math.abs(Math.sin(time * 26)) * 0.015;
    for (const w of m.userData.wheels as THREE.Object3D[]) w.rotation.z = -time * 30;
    vfx.dust(p.x / U - p.dir * 1.6, 0.1, 2, 0.5, new THREE.Color(0xc9c2d6));
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ in-move effects
export class AbilityFX11 {
  readonly group = new THREE.Group();
  private bubbles: THREE.Sprite[] = [];
  private shells: THREE.Mesh[] = [];
  private shellMat = new THREE.MeshToonMaterial({ color: 0xf4f3ef, transparent: true, opacity: 0.85 });

  constructor(private vfx: { sparks: (x: number, y: number, n: number, c: THREE.Color, sp: number, dir: number, life?: number) => void; dust: (x: number, y: number, n: number, sp: number, c?: THREE.Color) => void }) {}

  /** Speech bubble of fighter i; the tail points back to his head (right when the bubble is left of him). */
  private bubble(i: number, facing: number): THREE.Sprite {
    const k = i * 2 + (facing > 0 ? 0 : 1);
    let b = this.bubbles[k];
    if (!b) {
      b = bubbleSprite('SAG WAS GEGEN MICH –\n5000 KURDEN STEHEN AUF!', 1.7, facing > 0 ? 'right' : 'left');
      b.visible = false;
      this.group.add(b);
      this.bubbles[k] = b;
    }
    return b;
  }

  /** The puffer vest swelling into a shield (Lacazette's Daunenweste). */
  private shell(i: number): THREE.Mesh {
    let s = this.shells[i];
    if (!s) {
      s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), this.shellMat);
      s.scale.set(0.8, 1.15, 0.95);
      s.renderOrder = 3;
      this.group.add(s);
      this.shells[i] = s;
    }
    return s;
  }

  /** Create the lazily built props of the match's fighters (hidden) so their shaders compile up front. */
  prewarm(defs: string[]): void {
    defs.forEach((d, i) => {
      if (d === 'manuellsen') for (const f of [1, -1]) this.bubble(i, f).visible = false;
      if (d === 'lacazette') this.shell(i).visible = false;
    });
  }

  update(s: GameState, time: number, anims: FighterAnimator[], rigs: CharacterRig[]): void {
    s.fighters.forEach((f, i) => {
      const rig = rigs[i];
      const anim = anims[i];
      if (!rig || !anim) return;
      const inMove = (k: string) => f.state === 'move' && f.move === k;
      // 5000 Kurden: the call (speech bubble over Manuellsen while he is on the phone)
      if (f.def === 'manuellsen') {
        const on = inMove('manu_kurden') && f.mf >= 6 && f.mf <= 46;
        const other = this.bubbles[i * 2 + (f.facing > 0 ? 1 : 0)];
        if (other) other.visible = false;
        const b = on ? this.bubble(i, f.facing) : this.bubbles[i * 2 + (f.facing > 0 ? 0 : 1)];
        if (b) {
          b.visible = on;
          if (on) {
            const head = rig.joints.head.getWorldPosition(new THREE.Vector3());
            const k = ramp(f.mf, 6, 10) * (1 - ramp(f.mf, 40, 46));
            // beside his head, toward his back (the mob comes from there; the HUD keeps the top of the screen)
            b.position.set(head.x - f.facing * 0.75, head.y + 0.42, 0.6);
            b.material.opacity = k;
            const w = 1.7 * (0.75 + 0.25 * pop(k));
            b.scale.set(w, w * (b.userData.aspect as number), 1);
          }
        }
        // Beton: grey concrete tint while armoured, stone dust from the joints, a crack ring on the floor
        const beton = inMove('manu_beton') && f.mf >= 4 && f.mf <= 44;
        if (beton) {
          const k = ramp(f.mf, 4, 10) * (1 - ramp(f.mf, 40, 44));
          rig.setFlash(0.42 * k, 0x8e8c86);
          if (f.mf % 4 === 0) {
            const c = rig.joints.chest.getWorldPosition(new THREE.Vector3());
            this.vfx.sparks(c.x, c.y, 4, new THREE.Color(0xb9b6ad), 2.5, f.facing, 1.2);
            this.vfx.dust(anim.vx, 0.02, 2, 0.5, new THREE.Color(0xb9b6ad));
          }
        }
      }
      // Daunenweste: the vest swells into a white quilted shield around the torso while armoured
      if (f.def === 'lacazette') {
        const on = inMove('laca_weste') && f.mf >= 3 && f.mf <= 26;
        const sh = this.shells[i] ?? (on ? this.shell(i) : null);
        if (sh) {
          sh.visible = on;
          if (on) {
            const c = rig.joints.chest.getWorldPosition(new THREE.Vector3());
            const k = Math.sin(ramp(f.mf, 3, 8) * Math.PI * 0.5) * (1 - ramp(f.mf, 22, 26));
            sh.position.set(c.x + f.facing * 0.08, c.y - 0.12, c.z);
            const pulse = 1 + 0.05 * Math.sin(time * 30);
            sh.scale.set(0.8 * k * pulse, 1.15 * k * pulse, 0.95 * k);
            this.shellMat.opacity = 0.75 * k;
          }
        }
        // Kalter Blick: the sunglasses flash right before the glint leaves
        if (inMove('laca_blick') && f.mf >= 9 && f.mf <= 13 && f.mf % 2 === 1) {
          const h = rig.joints.head.getWorldPosition(new THREE.Vector3());
          this.vfx.sparks(h.x + f.facing * 0.12, h.y + 0.08, 6, new THREE.Color(0xeef8ff), 2.5, f.facing, 1);
        }
      }
    });
  }
}

