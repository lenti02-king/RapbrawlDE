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
const _hv = new THREE.Vector3();
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
  // long words (KALTER BLICK) shrink to fit inside the burst instead of running off the canvas
  const font = (px: number) => `400 ${px}px "Rubik Wet Paint", "Anton", sans-serif`;
  g.font = font(112);
  const px = Math.max(48, Math.floor(112 * Math.min(1, 400 / Math.max(1, g.measureText(word).width))));
  g.font = font(px);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = Math.round((22 * px) / 112);
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

// ------------------------------------------------------------------ S12 props
let flagTex: THREE.Texture | null = null;
/** The flag of Kurdistan (Ala Rengîn: red, white, green, a golden sun with 21 rays) - the PO asked for "eine kurdische
 *  Flagge"; this is the regional flag, not a party or organisation symbol. */
export function kurdistanFlagTexture(): THREE.Texture {
  if (flagTex) return flagTex;
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ed2024';
  g.fillRect(0, 0, 384, 86);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 86, 384, 85);
  g.fillStyle = '#278e43';
  g.fillRect(0, 171, 384, 85);
  g.translate(192, 128);
  g.fillStyle = '#febd11';
  g.beginPath();
  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2 - Math.PI / 2;
    const b = a + Math.PI / 21;
    g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
    g.lineTo(Math.cos(b) * 36, Math.sin(b) * 36);
  }
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, 0, 34, 0, Math.PI * 2);
  g.fill();
  flagTex = new THREE.CanvasTexture(c);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  return flagTex;
}

/** A waving flag on a pole: `userData.cloth` (vertex-waved in waveFlag), pole along +y, cloth to +x from the pole. */
export function makeFlag(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 2.3, 8), new THREE.MeshToonMaterial({ color: 0x6b4a2a }));
  pole.position.y = 1.15;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshToonMaterial({ color: 0xffd23c }));
  knob.position.y = 2.32;
  const geo = new THREE.PlaneGeometry(1.1, 0.73, 16, 5);
  geo.translate(0.55, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: kurdistanFlagTexture(), side: THREE.DoubleSide }));
  cloth.position.y = 1.88;
  g.add(pole, knob, cloth);
  g.userData.cloth = cloth;
  g.userData.base = Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
  return g;
}

export function waveFlag(f: THREE.Object3D, time: number, speed = 1): void {
  const cloth = f.userData.cloth as THREE.Mesh;
  const base = f.userData.base as Float32Array;
  const pos = cloth.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const u = x / 1.1; // 0 at the pole .. 1 at the free end
    pos.setXYZ(i, x - u * u * 0.06, y - u * 0.05 + Math.sin(time * 7 * speed - x * 5) * 0.03 * u, Math.sin(time * 9 * speed - x * 6 + y * 2) * 0.13 * u);
  }
  pos.needsUpdate = true;
}

const letterTex = new Map<string, THREE.Texture>();
/** One big chrome letter (block capital, steel gradient, ink outline). */
export function letterTexture(ch: string): THREE.Texture {
  let t = letterTex.get(ch);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.font = '400 220px "Anton", "Barlow Condensed", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 26;
  g.strokeStyle = '#08060c';
  g.strokeText(ch, 128, 140);
  const grd = g.createLinearGradient(0, 40, 0, 230);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.45, '#c8d0de');
  grd.addColorStop(0.52, '#6c7486');
  grd.addColorStop(1, '#e8edf6');
  g.fillStyle = grd;
  g.fillText(ch, 128, 136);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  letterTex.set(ch, t);
  return t;
}
/** His track titles are all three characters. */
const TITLES = ['FTW', 'CUP', 'PKS', 'XOX', 'RAP'];

let chartTex: THREE.Texture | null = null;
/** A rising chart curve with an arrow head, glowing green (tall canvas, bottom = floor). */
export function chartTexture(): THREE.Texture {
  if (chartTex) return chartTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  const pts: [number, number][] = [
    [40, 500],
    [70, 420],
    [96, 446],
    [120, 330],
    [146, 360],
    [170, 220],
    [190, 250],
    [212, 70],
  ];
  const stroke = (w: number, col: string) => {
    g.lineWidth = w;
    g.strokeStyle = col;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  };
  stroke(44, 'rgba(60,255,120,0.25)');
  stroke(26, '#08060c');
  stroke(16, '#3cff78');
  g.fillStyle = '#3cff78';
  g.strokeStyle = '#08060c';
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(212, 22);
  g.lineTo(248, 96);
  g.lineTo(176, 92);
  g.closePath();
  g.stroke();
  g.fill();
  chartTex = new THREE.CanvasTexture(c);
  chartTex.colorSpace = THREE.SRGBColorSpace;
  return chartTex;
}

let dotTex: THREE.Texture | null = null;
function dotTexture(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

let crownTex: THREE.Texture | null = null;
export function crownTexture(): THREE.Texture {
  if (crownTex) return crownTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.moveTo(24, 168);
  g.lineTo(36, 52);
  g.lineTo(84, 104);
  g.lineTo(128, 24);
  g.lineTo(172, 104);
  g.lineTo(220, 52);
  g.lineTo(232, 168);
  g.closePath();
  const grd = g.createLinearGradient(0, 24, 0, 168);
  grd.addColorStop(0, '#fff3b0');
  grd.addColorStop(0.5, '#ffd23c');
  grd.addColorStop(1, '#c47a08');
  g.fillStyle = grd;
  g.lineWidth = 12;
  g.lineJoin = 'round';
  g.strokeStyle = '#120a02';
  g.stroke();
  g.fill();
  for (const [x, y, col] of [
    [128, 128, '#ff3b4e'],
    [76, 134, '#3f8dff'],
    [180, 134, '#3cff78'],
  ] as const) {
    g.beginPath();
    g.arc(x, y, 12, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
    g.lineWidth = 5;
    g.stroke();
  }
  crownTex = new THREE.CanvasTexture(c);
  crownTex.colorSpace = THREE.SRGBColorSpace;
  return crownTex;
}

/** The purple double cup (two stacked white foam cups, purple drink), ~16 cm tall, origin at the bottom. */
export function makeDoubleCup(): THREE.Group {
  const g = new THREE.Group();
  const foam = new THREE.MeshToonMaterial({ color: 0xf4f3ef });
  const ink = new THREE.MeshBasicMaterial({ color: 0x0a0810, side: THREE.BackSide });
  const cup = (y: number, s: number) => {
    const geo = new THREE.CylinderGeometry(0.046 * s, 0.034 * s, 0.12, 16, 1, true);
    const m = new THREE.Mesh(geo, foam);
    m.position.y = y + 0.06;
    const sh = new THREE.Mesh(geo, ink);
    sh.scale.setScalar(1.08);
    m.add(sh);
    return m;
  };
  const drink = new THREE.Mesh(new THREE.CircleGeometry(0.047, 16), new THREE.MeshBasicMaterial({ color: 0x9b3dff }));
  drink.rotation.x = -Math.PI / 2;
  drink.position.y = 0.155;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), foam);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = 0.002;
  g.add(cup(0, 1), cup(0.035, 1.03), drink, bottom);
  return g;
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
    // the flag of Kurdistan, carried high by the runner in the middle (S12, PO)
    const flag = makeFlag();
    g.add(flag);
    g.userData.flag = flag;
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
  if (kind === 'letters') {
    // three chrome capitals in a row (the title is picked per throw in updateProjectile11)
    const g = new THREE.Group();
    const letters = [0, 1, 2].map(() => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('F'), transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.62);
      sp.renderOrder = 15;
      g.add(sp);
      return sp;
    });
    g.userData.letters = letters;
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
    const flag = m.userData.flag as THREE.Group;
    rigs.forEach((r, i) => {
      const k = (time * 2.4 + r.ph) % 1;
      r.rig.root.position.set(r.x * p.dir, -0.85 + (1 - fadeIn) * -0.4, r.z);
      const pose = runPose(k, i % 3 !== 1);
      if (i === 3) pose.aim = { shR: [0.15, 1, 0.25], elR: [0.05, 1, 0.15] }; // the flag bearer: arm straight up
      r.rig.apply(toArr(pose, arr), p.dir);
      if (i === 3) {
        r.rig.root.updateMatrixWorld(true);
        const hand = r.rig.joints.haR.getWorldPosition(_hv);
        m.worldToLocal(hand);
        flag.position.set(hand.x, hand.y - 1.55, hand.z);
      }
    });
    flag.scale.x = -p.dir; // the cloth trails behind the runners
    waveFlag(flag, time, 1.4);
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
  if (p.kind === 'letters') {
    m.position.set(p.x / U, p.y / U, 0.3);
    const word = TITLES[p.id % TITLES.length];
    const letters = m.userData.letters as THREE.Sprite[];
    letters.forEach((sp, k) => {
      const tex = letterTexture(word[k]);
      if (sp.material.map !== tex) {
        sp.material.map = tex;
        sp.material.needsUpdate = true;
      }
      // reading order left to right, the first letter leaves first; each wobbles a little in flight
      const lead = p.dir > 0 ? 2 - k : k;
      sp.visible = p.age >= lead * 3;
      sp.position.set((k - 1) * 0.46, Math.sin(time * 14 + k * 2) * 0.04, 0);
      sp.material.rotation = Math.sin(time * 10 + k) * 0.18;
      sp.scale.setScalar(0.62 * (1 + 0.08 * Math.sin(time * 20 + k)));
    });
    if (p.age % 2 === 0) vfx.sparks(p.x / U - p.dir * 0.5, p.y / U, 1, new THREE.Color(0xdfe8ff), 1.5, -p.dir, 0.6);
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
/** Per-fighter props of the S12 abilities (created on first use / prewarm). */
interface Kit {
  shadow: THREE.Group; // König im Schatten: dark smoke silhouette + eyes + crown
  smoke: THREE.Sprite[];
  eyes: THREE.Sprite[];
  crown: THREE.Sprite;
  cup: THREE.Group; // Lila Becher
  haze: THREE.Sprite[];
  chart: THREE.Sprite; // Chart-Einstieg
  badge: THREE.Sprite;
}

export class AbilityFX11 {
  readonly group = new THREE.Group();
  private bubbles: THREE.Sprite[] = [];
  private kits: (Kit | null)[] = [null, null];
  private hid = [false, false];

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

  private kit(i: number): Kit {
    let k = this.kits[i];
    if (k) return k;
    const shadow = new THREE.Group();
    const smoke = Array.from({ length: 9 }, (_, n) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: n % 3 ? 0x0c0814 : 0x1c1028, transparent: true, depthWrite: false }));
      sp.renderOrder = 6;
      shadow.add(sp);
      return sp;
    });
    const eyes = [0, 1].map(() => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd23c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.renderOrder = 7;
      sp.scale.setScalar(0.09);
      shadow.add(sp);
      return sp;
    });
    const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: crownTexture(), transparent: true, depthWrite: false }));
    crown.renderOrder = 8;
    crown.scale.set(0.42, 0.315, 1);
    shadow.add(crown);
    const cup = makeDoubleCup();
    cup.scale.setScalar(1.7); // reads at fight distance
    const haze = Array.from({ length: 8 }, () => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: 0xb36bff, transparent: true, depthWrite: false }));
      sp.renderOrder = 5;
      return sp;
    });
    const chart = new THREE.Sprite(new THREE.SpriteMaterial({ map: chartTexture(), transparent: true, depthWrite: false }));
    chart.center.set(0.5, 0);
    chart.renderOrder = 4;
    const badge = textSprite('#1 NEU', { width: 0.9, color: '#3cff78', font: '"Rubik Wet Paint", "Anton", sans-serif' });
    this.group.add(shadow, cup, chart, badge, ...haze);
    for (const o of [shadow, cup, chart, badge, ...haze]) o.visible = false;
    k = { shadow, smoke, eyes, crown, cup, haze, chart, badge };
    this.kits[i] = k;
    return k;
  }

  /** Create the lazily built props of the match's fighters (hidden) so their shaders compile up front. */
  prewarm(defs: string[]): void {
    defs.forEach((d, i) => {
      if (d === 'manuellsen') for (const f of [1, -1]) this.bubble(i, f).visible = false;
      if (d === 'manuellsen' || d === 'bonez' || d === 'lacazette') this.kit(i);
    });
  }

  update(s: GameState, time: number, anims: FighterAnimator[], rigs: CharacterRig[]): void {
    s.fighters.forEach((f, i) => {
      const rig = rigs[i];
      const anim = anims[i];
      if (!rig || !anim) return;
      const inMove = (k: string) => f.state === 'move' && f.move === k;
      const kit = this.kits[i];
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
        // König im Schatten: he melts into a dark smoke silhouette with glowing eyes and a crown, glides through,
        // and steps out of the shadow behind them
        const sh = inMove('manu_schatten') && f.mf >= 4 && f.mf <= 22;
        const k = sh || kit ? this.kit(i) : null;
        if (k) {
          k.shadow.visible = sh;
          const hideNow = !s.cine && sh && f.mf >= 7 && f.mf <= 16;
          if (hideNow) rig.root.visible = false;
          else if (this.hid[i]) rig.root.visible = true;
          this.hid[i] = hideNow;
          if (sh) {
            const a = ramp(f.mf, 4, 8) * (1 - ramp(f.mf, 17, 22));
            const hip = rig.joints.hips.getWorldPosition(new THREE.Vector3());
            const head = rig.joints.head.getWorldPosition(new THREE.Vector3());
            const hidden = f.mf >= 7 && f.mf <= 16;
            k.smoke.forEach((sp, n) => {
              const t = time * 3 + n * 1.7;
              const hgt = (n / k.smoke.length) * 1.7;
              sp.position.set(anim.vx + Math.sin(t) * 0.12 - f.facing * (n % 3) * 0.12, (hidden ? 0.1 : hip.y - 0.7) + hgt, 0.2 + Math.cos(t) * 0.05);
              sp.scale.setScalar((0.55 + 0.25 * Math.sin(t * 1.3)) * (hidden ? 1.15 : 0.9));
              sp.material.opacity = 0.9 * a;
              sp.material.rotation = t * 0.4;
            });
            const eyeY = hidden ? 1.62 : head.y + 0.03;
            const ex = hidden ? anim.vx : head.x;
            k.eyes.forEach((e, n) => {
              e.position.set(ex + f.facing * 0.06, eyeY, 0.45 + (n ? 0.07 : -0.07));
              e.material.opacity = hidden ? 1 : 0.3 * a;
            });
            k.crown.position.set(ex, eyeY + 0.36 + Math.sin(time * 4) * 0.03, 0.4);
            k.crown.material.opacity = a;
            if (f.mf === 6 || f.mf === 16) this.vfx.dust(anim.vx, 0.05, 10, 1.2, new THREE.Color(0x150c20));
          }
        }
      }
      // Bonez: Lila Becher - the purple double cup in his right hand, purple haze while he sways, a purple tint
      if (f.def === 'bonez') {
        const on = inMove('bon_lean');
        const k = on || kit ? this.kit(i) : null;
        if (k) {
          k.cup.visible = on && f.mf <= 50;
          if (k.cup.visible) {
            rig.joints.haR.updateWorldMatrix(true, false);
            const hp = rig.joints.haR.getWorldPosition(new THREE.Vector3());
            k.cup.position.set(hp.x + f.facing * 0.03, hp.y - 0.12, hp.z + 0.08);
            // tilted to the mouth while he sips
            k.cup.rotation.set(0, 0, -f.facing * 1.1 * ramp(f.mf, 3, 6) * (1 - ramp(f.mf, 11, 14)));
          }
          const sway = on && f.mf >= 10 && f.mf <= 34;
          const a = ramp(f.mf, 10, 14) * (1 - ramp(f.mf, 30, 36));
          k.haze.forEach((sp, n) => {
            sp.visible = sway;
            if (!sway) return;
            const t = time * 1.2 + n * 0.8;
            sp.position.set(anim.vx + Math.sin(t) * 0.5, 0.4 + ((n * 0.27 + time * 0.25) % 1.6), 0.1 + Math.cos(t) * 0.3);
            sp.scale.setScalar(0.7 + 0.3 * Math.sin(t * 2));
            sp.material.opacity = 0.45 * a;
            sp.material.rotation = t;
          });
          if (sway) rig.setFlash(0.22 * a, 0x9b3dff);
          if (on && f.mf === 34) this.vfx.sparks(anim.vx + f.facing * 0.8, 1.35, 10, new THREE.Color(0xc58cff), 5, f.facing, 1.2);
        }
      }
      if (f.def === 'lacazette') {
        // Drei Buchstaben: a chrome glint off his hand as they leave
        if (inMove('laca_abc') && f.mf >= 10 && f.mf <= 13) {
          const h = rig.joints.haR.getWorldPosition(new THREE.Vector3());
          this.vfx.sparks(h.x, h.y, 5, new THREE.Color(0xe8f0ff), 3, f.facing, 1);
        }
        // Chart-Einstieg: a green chart curve rises out of the floor under him, "#1 NEU" over his head
        const on = inMove('laca_chart') && f.mf >= 3 && f.mf <= 34;
        const k = on || kit ? this.kit(i) : null;
        if (k) {
          k.chart.visible = on;
          k.badge.visible = on && f.mf >= 6;
          if (on) {
            const a = ramp(f.mf, 3, 6) * (1 - ramp(f.mf, 28, 34));
            const top = Math.max(0.6, anim.vy + 0.5);
            k.chart.position.set(anim.vx - f.facing * 0.15, 0, 0.15);
            k.chart.scale.set(0.9 * f.facing, top * 1.1, 1);
            k.chart.material.opacity = a;
            const head = rig.joints.head.getWorldPosition(new THREE.Vector3());
            k.badge.position.set(head.x, head.y + 0.55, 0.5);
            k.badge.material.opacity = a;
            if (f.mf === 5) this.vfx.sparks(anim.vx, 0.1, 14, new THREE.Color(0x3cff78), 6, f.facing, 1.3);
          }
        }
      }
    });
  }
}
