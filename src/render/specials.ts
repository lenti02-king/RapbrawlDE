// Presentation for character specials during normal play (not the signature cinematics):
// Jazeek's voice wave / spotlight dash / counter notes, Bonez's crocodile jaws / smoke wall /
// gold teeth, and win flourishes. Reads sim state only; all timing keyed to sim frames.
import * as THREE from 'three';
import type { SimEvent } from '../core/events';
import { UNITS_PER_METER } from '../core/math';
import { getMove } from '../core/registry';
import type { GameState, ProjectileState } from '../core/state';
import type { FighterAnimator } from './animator';
import { HeartPool, makeCroc, makeSpotlight, noteTexture, smokeTexture, SpritePool, type Croc } from './props';
import type { Rig } from './rig';
import type { VFX } from './vfx';

const U = UNITS_PER_METER;
const NOTE_COLORS = [0x6ff7ff, 0xff6fd8, 0xffe066];
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const ramp = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));

export class SpecialFX {
  readonly group = new THREE.Group();
  readonly notes = new SpritePool(noteTexture(), 40, THREE.AdditiveBlending);
  readonly hearts = new HeartPool(24);
  private crocs: Croc[] = [];
  private winCroc: Croc;
  private spots = [makeSpotlight(0xfff0c8), makeSpotlight(0xfff0c8)];
  private glint: THREE.Sprite;
  private acc = 0;
  /** Cinematics can force the gold teeth on. */
  teethOverride = [false, false];

  constructor(private vfx: VFX) {
    this.group.add(this.notes.group, this.hearts.group);
    for (let i = 0; i < 2; i++) {
      const c = makeCroc();
      c.setOpacity(0);
      this.crocs.push(c);
      this.group.add(c.group);
    }
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

  update(s: GameState, dt: number, time: number, anims: FighterAnimator[], rigs: Rig[]): void {
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

      // --- Bonez: crocodile jaws (bon_croc). Hit frames 20-23.
      const croc = this.crocs[i];
      if (inMove('bon_croc') && f.mf < 40) {
        const mf = f.mf;
        const appear = ramp(mf, 2, 9);
        const open = mf < 20 ? 8 + 50 * ramp(mf, 6, 18) : mf < 22 ? 0 : 2 + 4 * Math.max(0, 1 - (mf - 22) / 6);
        const fade = 1 - ramp(mf, 28, 38);
        croc.setOpacity(appear * fade);
        croc.setOpen(open);
        const sc = 1.6 * (0.6 + 0.4 * appear);
        croc.group.scale.set(f.facing * sc, sc, sc);
        const shake = mf >= 20 && mf < 26 ? (mf % 2 ? 0.03 : -0.03) : 0;
        croc.group.position.set(x + f.facing * 0.85, 0.55 + shake, 0.25);
        if (mf === 20 && f.hitstop === 0 && emitTick) this.vfx.sparks(x + f.facing * 1.9, 0.6, 3, new THREE.Color(0xffffff), 4, f.facing, 2);
      } else croc.setOpacity(0);

      // --- Bonez: gold teeth while grinning
      if (rig.props.teeth) {
        const grinMove = inMove('bon_grin') && f.mf >= 8 && f.mf <= 58;
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
