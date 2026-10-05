// Presentation for character specials during normal play (not the signature cinematics):
// Jazeek's voice wave / spotlight dash / counter notes, Bonez's crocodile jaws / smoke wall /
// gold teeth, and win flourishes. Reads sim state only; all timing keyed to sim frames.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SimEvent } from '../core/events';
import { UNITS_PER_METER } from '../core/math';
import { getMove } from '../core/registry';
import type { GameState, ProjectileState } from '../core/state';
import type { FighterAnimator } from './animator';
import { HeartPool, makeCroc, makeCrocRunner, makeSpotlight, noteTexture, smokeTexture, SpritePool, type Croc } from './props';
import type { CharacterRig } from './glbRig';
import type { VFX } from './vfx';

const U = UNITS_PER_METER;
const NOTE_COLORS = [0x6ff7ff, 0xff6fd8, 0xffe066];
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const ramp = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));

export class SpecialFX {
  readonly group = new THREE.Group();
  readonly notes = new SpritePool(noteTexture(), 40, THREE.AdditiveBlending);
  readonly hearts = new HeartPool(24);
  private winCroc: Croc;
  private spots = [makeSpotlight(0xfff0c8), makeSpotlight(0xfff0c8)];
  private glint: THREE.Sprite;
  private acc = 0;
  /** Cinematics can force the gold teeth on. */
  teethOverride = [false, false];

  constructor(private vfx: VFX) {
    this.group.add(this.notes.group, this.hearts.group);
    this.winCroc = makeCroc({ top: 0x1f5a2c, side: 0x2c7a38, belly: 0xb9b07a });
    this.winCroc.setOpacity(0);
    this.group.add(this.winCroc.group);
    for (const sp of this.spots) {
      sp.setIntensity(0);
      this.group.add(sp.group);
    }
    this.glint = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glintTexture(), color: 0xffd65a, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }),
    );
    this.glint.renderOrder = 40;
    this.glint.visible = false;
    this.group.add(this.glint);
  }

  noteBurst(x: number, y: number, n: number, dir: number, speed = 1.6): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 1.6;
      this.notes.spawn(
        new THREE.Vector3(x + (Math.random() - 0.5) * 0.2, y + (Math.random() - 0.5) * 0.2, 0.3),
        new THREE.Vector3(dir * Math.cos(a) * speed, 0.8 + Math.sin(a) * speed * 0.6 + Math.random(), (Math.random() - 0.5) * 0.5),
        NOTE_COLORS[i % NOTE_COLORS.length],
        0.22 + Math.random() * 0.12,
        0.7 + Math.random() * 0.5,
        0.3,
        (Math.random() - 0.5) * 2,
      );
    }
  }

  heartBurst(x: number, y: number, n: number, spread = 1): void {
    for (let i = 0; i < n; i++)
      this.hearts.spawn(
        new THREE.Vector3(x + (Math.random() - 0.5) * 0.5 * spread, y + (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.3),
        new THREE.Vector3((Math.random() - 0.5) * 1.6 * spread, 0.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.6),
        0.07 + Math.random() * 0.06,
        0.9 + Math.random() * 0.6,
      );
  }

  onEvents(s: GameState, events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.t === 'moveStart') {
        const f = s.fighters[e.p];
        const x = f.x / U;
        if (e.move === 'jaz_spot') {
          this.vfx.ring(x, 0.03, 1.4, new THREE.Color(0xfff0c8), 0.3, true);
          this.noteBurst(x, 1.5, 4, f.facing);
        }
      } else if (e.t === 'projectile' && e.kind === 'voicewave') {
        const f = s.fighters[e.p];
        this.noteBurst(f.x / U + f.facing * 0.5, 1.45, 5, f.facing, 2.2);
      } else if (e.t === 'counter' && s.fighters[e.p].def === 'jazeek') {
        const f = s.fighters[e.p];
        this.noteBurst(f.x / U, 1.3, 10, f.facing, 2.6);
      } else if (e.t === 'meterGain' && s.fighters[e.p].def === 'bonez') {
        const f = s.fighters[e.p];
        this.vfx.sparks(f.x / U + f.facing * 0.12, 1.72, 18, new THREE.Color(0xffd65a), 4, f.facing, 2);
      } else if (e.t === 'hit' && !e.projectile && s.fighters[e.a].def === 'jazeek' && e.strength >= 2) {
        this.heartBurst(e.x / U, e.y / U, 2);
      }
    }
  }

  update(s: GameState, dt: number, time: number, anims: FighterAnimator[], rigs: CharacterRig[]): void {
    this.notes.update(dt);
    this.hearts.update(dt);
    this.acc += dt;
    const emitTick = this.acc > 1 / 30;
    if (emitTick) this.acc = 0;
    let winCrocShown = false;
    s.fighters.forEach((f, i) => {
      const anim = anims[i];
      const rig = rigs[i];
      if (!anim || !rig) return;
      const x = anim.vx;
      const inMove = (k: string) => f.state === 'move' && f.move === k;

      // --- Bonez: gold teeth while grinning
      if (rig.props.teeth) {
        const grinMove = (inMove('bon_grin') && f.mf >= 8 && f.mf <= 58) || (inMove('bon_croc') && f.mf >= 26 && f.mf <= 44);
        const intro = f.state === 'intro' && f.sf >= 55 && f.sf <= 100;
        const flash = s.freeze > 0 && s.freezeOwner === i;
        const win = f.state === 'win' && s.roundWinner === i;
        rig.props.teeth.visible = grinMove || intro || flash || win || this.teethOverride[i];
      }

      // --- Jazeek: spotlight dash
      const spot = this.spots[i];
      let spotI = 0;
      if (inMove('jaz_spot')) {
        spotI = ramp(f.mf, 0, 3) * (1 - ramp(f.mf, 16, 26));
        if (emitTick && f.mf <= 18)
          for (let k = 0; k < 4; k++)
            this.vfx.emit(x - f.facing * 0.1, 0.3 + k * 0.4 + Math.random() * 0.2, 0.2, -f.facing * 2, 0, 0, new THREE.Color(k % 2 ? 0xfff0c8 : 0xff8fd8), 1.2, 0.05, 0.12, 0.25, 4, 0);
      }
      // --- win flourishes
      const won = (s.phase === 'roundOver' || s.phase === 'matchOver') && f.state === 'win' && s.roundWinner === i;
      if (won && f.def === 'jazeek') {
        spotI = Math.max(spotI, ramp(f.sf, 10, 30));
        if (emitTick && Math.random() < 0.25) this.heartBurst(x, 1.9, 1);
        if (emitTick && Math.random() < 0.3) this.noteBurst(x + f.facing * 0.2, 1.75, 1, f.facing, 1);
      }
      spot.setIntensity(spotI);
      spot.group.position.set(x, 0, 0);
      if (won && f.def === 'bonez') {
        winCrocShown = true;
        const t = f.sf;
        const c = this.winCroc;
        const rise = ramp(t, 14, 40);
        c.setOpacity(0.92 * rise);
        const cycle = (t - 40) % 70;
        c.setOpen(t < 40 ? 50 * rise : cycle < 40 ? 50 * ramp(cycle, 0, 30) : cycle < 44 ? 0 : 50 * ramp(cycle, 50, 70));
        const sc = 2.4;
        c.group.scale.set(f.facing * sc, sc, sc);
        c.group.rotation.z = f.facing * 1.25;
        c.group.position.set(x - f.facing * 0.55, -1.2 + rise * 1.4, -1.1);
      }

      // --- smoke wall: show a gold glint "hint" of Bonez when he stands behind his own smoke
      if (f.def === 'bonez') {
        const smoke = s.projectiles.find((p) => p.owner === i && p.kind === 'smoke');
        const hidden = smoke && Math.abs(smoke.x / U - x) < 0.9;
        this.glint.visible = !!hidden;
        if (hidden) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 9);
          this.glint.position.set(x + f.facing * 0.15, 1.38, 0.5);
          this.glint.scale.setScalar(0.18 + pulse * 0.12);
          (this.glint.material as THREE.SpriteMaterial).opacity = 0.5 + pulse * 0.5;
          (this.glint.material as THREE.SpriteMaterial).rotation = time * 2;
        }
      }
    });
    if (!winCrocShown) this.winCroc.setOpacity(0);
  }

  // ---------------------------------------------------------------- projectiles

  makeProjectile(kind: string): THREE.Object3D | null {
    if (kind === 'voicewave') {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xff6fd8 : 0x6ff7ff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.16 + i * 0.11, 0.028, 6, 28, 1.9), mat);
        arc.rotation.z = -0.95;
        arc.position.x = -i * 0.1;
        g.add(arc);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: 0x9ffcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(0.6, 0.6, 1);
      g.add(glow);
      return g;
    }
    if (kind === 'smoke') {
      const g = new THREE.Group();
      const tex = smokeTexture();
      for (let i = 0; i < 16; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: i % 3 ? 0xd9d3e6 : 0xbab2cc, transparent: true, depthWrite: false }));
        const row = Math.floor(i / 4);
        const col = i % 4;
        s.position.set((col - 1.5) * 0.24 + (row % 2) * 0.1, -0.85 + row * 0.55, ((i * 37) % 7) * 0.05 - 0.15);
        s.userData.base = s.position.clone();
        s.userData.seed = i * 1.7;
        s.userData.size = 0.75 + ((i * 13) % 5) * 0.08;
        g.add(s);
      }
      return g;
    }
    if (kind === 'diamonds') return makeDiamondRain();
    if (kind === 'car') return makeTunerCar();
    if (kind === 'crocrun') {
      const c = makeCrocRunner();
      c.group.userData.croc = c;
      return c.group;
    }
    return null;
  }

  /** Returns true if handled. */
  updateProjectile(m: THREE.Object3D, p: ProjectileState, s: GameState, time: number): boolean {
    if (p.kind === 'voicewave') {
      m.position.set(p.x / U, p.y / U, 0.15);
      m.scale.x = p.dir;
      m.children.forEach((c, i) => {
        if (c instanceof THREE.Sprite) return;
        const k = 1 + 0.18 * Math.sin(time * 18 - i * 1.2);
        c.scale.set(k, k, 1);
      });
      if (Math.random() < 0.25) this.noteBurst(p.x / U - p.dir * 0.2, p.y / U, 1, -p.dir, 0.6);
      return true;
    }
    if (p.kind === 'diamonds') {
      // a shower of diamonds over the zone; they land, bounce off and sparkle
      const life = 36;
      const a = Math.min(ease(p.age / 5), 1 - ease((p.age - (life - 8)) / 8));
      m.position.set(p.x / U, p.y / U, 0.1);
      m.children.forEach((c) => {
        const d = c.userData as { lane: number; z: number; off: number; spin: number; size: number; glint?: boolean };
        if (d.glint) {
          (c as THREE.Sprite).material.opacity = a * (0.5 + 0.5 * Math.sin(time * 20 + d.off * 9));
          return;
        }
        const t = ((p.age + d.off * 30) / 14) % 1;
        const y = 1.9 - t * 2.9;
        c.position.set(d.lane, Math.max(-0.98, y), d.z);
        c.rotation.set(time * d.spin, time * d.spin * 1.3, 0.3);
        const sc = d.size * a * (y < -0.95 ? 0.7 : 1);
        c.scale.set(sc, sc * 1.4, sc);
      });
      if (p.age % 3 === 0) this.vfx.sparks(p.x / U + (Math.random() - 0.5) * 1.2, 0.05, 3, new THREE.Color(0xbff6ff), 3, 0, 2);
      if (p.age % 2 === 0) this.vfx.emit(p.x / U + (Math.random() - 0.5) * 1.3, 2.4, 0.1, 0, -4, 0, new THREE.Color(0xe8fdff), 0.5, 0.06, 0, 0.5, 0, 0);
      return true;
    }
    if (p.kind === 'car') {
      // the car drifts in with a slight yaw, wheels spinning, tyre smoke and neon underglow
      m.position.set(p.x / U, 0, 0.05);
      m.scale.x = p.dir;
      const body = m.getObjectByName('body');
      if (body) {
        body.rotation.y = 0.18 * Math.sin(Math.min(1, p.age / 10) * Math.PI) * -p.dir;
        body.position.y = Math.abs(Math.sin(time * 30)) * 0.015;
      }
      for (const w of m.userData.wheels as THREE.Object3D[]) w.rotation.z = -time * 40;
      this.vfx.dust(p.x / U - p.dir * 1.0, 0.1, 2, 0.4, new THREE.Color(0xdcd6ea));
      if (p.age % 2 === 0) this.vfx.emit(p.x / U - p.dir * 1.15, 0.35, 0.2, -p.dir * 2, 0.5, 0, new THREE.Color(0xff8a3d), 0.35, 0.12, 0, 0.2, 0, 0);
      return true;
    }
    if (p.kind === 'crocrun') {
      // Bonez' little crocodile: pops out of the ground dust, then scurries low along the floor snapping its jaws
      const c = m.userData.croc as ReturnType<typeof makeCrocRunner>;
      const pop = 1.3 * (0.7 + 0.3 * ease(p.age / 5)); // a bit larger than in the cinematic: it runs past the card hand
      m.position.set(p.x / U, 0, 0.12);
      m.scale.set(p.dir * pop, pop, pop);
      c.setOpacity(Math.min(1, p.age / 3 + 0.2));
      c.waddle(time * 24, 1);
      c.setOpen(8 + 26 * Math.max(0, Math.sin(time * 11)));
      if (p.age === 0) this.vfx.dust(p.x / U, 0.05, 10, 0.8, new THREE.Color(0xd9cfb8));
      if (p.age % 3 === 0) this.vfx.dust(p.x / U - p.dir * 0.6, 0.05, 2, 0.35, new THREE.Color(0xd9cfb8));
      return true;
    }
    if (p.kind === 'smoke') {
      let life = 100;
      try {
        life = getMove(s.fighters[p.owner].def, p.move).projectile?.def.life ?? 100;
      } catch {
        /* default */
      }
      const fadeIn = ease(p.age / 8);
      const fadeOut = 1 - ease((p.age - (life - 16)) / 16);
      const a = Math.min(fadeIn, fadeOut);
      m.position.set(p.x / U, p.y / U, 0.35);
      m.children.forEach((c) => {
        const sp = c as THREE.Sprite;
        const base = sp.userData.base as THREE.Vector3;
        const seed = sp.userData.seed as number;
        sp.position.set(base.x + Math.sin(time * 0.9 + seed) * 0.06, base.y + Math.sin(time * 0.7 + seed * 2) * 0.05 + (1 - fadeIn) * -0.3, base.z);
        const sz = (sp.userData.size as number) * (0.55 + 0.45 * fadeIn) * (1 + 0.15 * (1 - fadeOut));
        sp.scale.set(sz, sz, 1);
        (sp.material as THREE.SpriteMaterial).opacity = a * 0.82;
        (sp.material as THREE.SpriteMaterial).rotation = Math.sin(time * 0.5 + seed) * 0.4;
      });
      return true;
    }
    return false;
  }
}

let glintTex: THREE.CanvasTexture | null = null;
function glintTexture(): THREE.CanvasTexture {
  if (glintTex) return glintTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.moveTo(32, 2);
  g.lineTo(35, 29);
  g.lineTo(62, 32);
  g.lineTo(35, 35);
  g.lineTo(32, 62);
  g.lineTo(29, 35);
  g.lineTo(2, 32);
  g.lineTo(29, 29);
  g.closePath();
  g.fill();
  glintTex = new THREE.CanvasTexture(c);
  glintTex.colorSpace = THREE.SRGBColorSpace;
  return glintTex;
}

/** Diamond shower: falling, spinning diamonds over a 1.3 m wide zone, plus glints. Local origin = projectile center. */
export function makeDiamondRain(): THREE.Object3D {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.19, 0);
  const mats = [0xe8fdff, 0x9ff4ff, 0x7fe8ff, 0xffffff].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.05, emissive: 0x4fd8ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.95 }),
  );
  for (let i = 0; i < 26; i++) {
    const d = new THREE.Mesh(geo, mats[i % mats.length]);
    d.userData = { lane: ((i * 37) % 13) / 12 * 1.3 - 0.65, z: (((i * 53) % 9) / 8 - 0.5) * 0.7, off: ((i * 29) % 17) / 17, spin: 4 + (i % 5), size: 0.8 + ((i * 7) % 5) * 0.12 };
    d.castShadow = false;
    g.add(d);
  }
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: 0xe8fdff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set((i / 5 - 0.5) * 1.2, -0.2 + ((i * 3) % 5) * 0.35, 0.3);
    sp.scale.set(0.6, 0.6, 1);
    sp.userData = { glint: true, off: i * 0.37 };
    g.add(sp);
  }
  return g;
}

/** Lowered tuner compact (generic: no brand, no badges): purple body, tinted glass, gold rims, neon underglow. Faces +x. */
export function makeTunerCar(): THREE.Object3D {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color: 0x8a4dff, metalness: 0.55, roughness: 0.28, emissive: 0x2a1060, emissiveIntensity: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1430, metalness: 0.2, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, metalness: 0.4, roughness: 0.08, emissive: 0x1f4a66, emissiveIntensity: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc531, metalness: 0.85, roughness: 0.25 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0) => {
    const r = Math.min(w, h, d) * 0.35;
    const mesh = new THREE.Mesh(r > 0.02 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  box(2.3, 0.4, 1.05, paint, 0, 0.38); // lower body
  box(1.0, 0.2, 1.08, paint, 0.7, 0.5); // front wing bulge
  box(2.36, 0.08, 1.08, dark, 0, 0.2); // side skirt line
  const cabin = box(1.15, 0.36, 0.95, glass, -0.18, 0.7); // greenhouse
  cabin.scale.set(1, 1, 1);
  box(1.0, 0.06, 0.98, paint, -0.2, 0.9); // roof
  box(0.5, 0.05, 1.0, paint, 0.55, 0.56); // bonnet slope
  box(0.08, 0.2, 1.0, dark, -1.18, 0.62); // spoiler post
  box(0.32, 0.05, 1.1, paint, -1.22, 0.74); // spoiler wing
  box(0.06, 0.08, 0.28, lamp, 1.16, 0.44, 0.33);
  box(0.06, 0.08, 0.28, lamp, 1.16, 0.44, -0.33);
  box(0.06, 0.08, 0.3, tail, -1.16, 0.44, 0.32);
  box(0.06, 0.08, 0.3, tail, -1.16, 0.44, -0.32);
  // headlight beams (additive)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 16, 1, true), beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(2.35, 0.44, 0);
  body.add(beam);
  // neon underglow
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.5),
    new THREE.MeshBasicMaterial({ color: 0x7cff5a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  body.add(glow);
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [
    [0.72, 0.5],
    [-0.72, 0.5],
    [0.72, -0.5],
    [-0.72, -0.5],
  ]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 18), dark);
    tyre.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.21, 6), gold);
    rim.rotation.x = Math.PI / 2;
    w.add(tyre, rim);
    w.position.set(x, 0.24, z);
    body.add(w);
    wheels.push(w);
  }
  root.userData.wheels = wheels;
  return root;
}
