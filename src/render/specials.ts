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
import { showcaseOf } from '../core/sim';
import { HandProp } from './handProps';
import { AbilityFX11, makeProjectile11, updateProjectile11 } from './abilities11';
import { crocAsHead, crocRunnerModel, hasProp, materialsOf, propMesh, propModel, setOpacity, tunerCarModel } from './propModels';
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
  /** Soft smoke puffs (Blunt für dich: wisps from the tip, the exhale, the cloud around the victim). */
  readonly smoke = new SpritePool(smokeTexture(), 70);
  /** Sound hook (set by installCinematics): frame-exact sounds inside moves. */
  sound: ((k: 'lighter' | 'inhale' | 'cough' | 'smoke') => void) | null = null;
  /** Jazeek's joint (the PO's model) in his right hand, its glowing tip and the lighter flame. */
  private joints: HandProp[] = [];
  private tip: THREE.Sprite[] = [];
  private flame: THREE.Sprite[] = [];
  /** Diamanten-Regen: Jazeek's chain flashes (big star glint + small ones along the chain). */
  private chain: THREE.Sprite[][] = [];
  private lastMf = [-1, -1];
  private winCroc: Croc;
  /** The PO's wrecking ball per fighter (Abrissbirne), created on first use. */
  private balls: (THREE.Object3D | null)[] = [null, null];
  /** Jazeek's gold mic (the PO's model) in his right hand while he sings. */
  private mics: HandProp[] = [];
  private spots = [makeSpotlight(0xfff0c8), makeSpotlight(0xfff0c8)];
  private glint: THREE.Sprite;
  private acc = 0;
  /** Cinematics can force the gold teeth on. */
  teethOverride = [false, false];

  private abilities: AbilityFX11;

  constructor(private vfx: VFX) {
    this.abilities = new AbilityFX11(vfx);
    this.group.add(this.notes.group, this.hearts.group, this.smoke.group, this.abilities.group);
    for (let i = 0; i < 2; i++) {
      const mk = (color: number, size: number) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        sp.scale.setScalar(size);
        sp.visible = false;
        sp.renderOrder = 41;
        this.group.add(sp);
        return sp;
      };
      this.tip.push(mk(0xff7a2a, 0.07));
      this.flame.push(mk(0xffc24a, 0.12));
      this.chain.push([mk(0xe8fdff, 0.5), mk(0x9ff0ff, 0.22), mk(0xffffff, 0.18), mk(0xbff6ff, 0.2)]);
    }
    this.winCroc = crocAsHead(1) ?? makeCroc({ top: 0x1f5a2c, side: 0x2c7a38, belly: 0xb9b07a });
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
    this.abilities.update(s, time, anims, rigs);
    this.notes.update(dt);
    this.hearts.update(dt);
    this.smoke.update(dt);
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

      // --- Jazeek: the gold mic in his right hand whenever he sings (Stimmwelle, intro emote, Signature, win, finisher)
      if (f.def === 'jazeek' && hasProp('mic')) {
        const mic = this.mics[i] ?? (this.mics[i] = new HandProp('mic', this.group));
        const sc = showcaseOf(s);
        const cineF = s.cine && s.cine.owner === i && s.cine.id === 'jaz_heart' ? s.cine.frame : -1;
        const fatalF = s.fatal && s.fatal.owner === i ? s.fatal.frame : -1;
        const on =
          (inMove('jaz_wave') && f.mf >= 4 && f.mf <= 34) ||
          (sc?.who === i && sc.f >= 4 && sc.f <= 46) ||
          (f.state === 'win' && s.roundWinner === i) ||
          (s.freeze > 0 && s.freezeOwner === i) ||
          (cineF >= 0 && (cineF < 64 || cineF >= 136)) ||
          fatalF >= 344;
        mic.place(rig, 'haR', on);
      }

      // --- Jazeek: Diamanten-Regen — the diamond chain flashes (frames 2-24), star glints run along it
      if (f.def === 'jazeek') {
        const rf = inMove('jaz_rain') ? f.mf : -1;
        const on = rf >= 2 && rf <= 26;
        const chest = on ? rig.joints.chest.getWorldPosition(new THREE.Vector3()) : null;
        const neck = on ? rig.joints.neck.getWorldPosition(new THREE.Vector3()) : null;
        this.chain[i].forEach((g, k) => {
          g.visible = on;
          if (!on || !chest || !neck) return;
          // the pendant sits a bit below the collar bone, in front of the chest
          const t = k === 0 ? 0.55 : 0.2 + k * 0.22;
          g.position.copy(neck).lerp(chest, t).add(new THREE.Vector3(f.facing * (0.1 + (k ? (k - 2) * 0.05 : 0)), -0.06, 0.16));
          const blink = Math.max(0, Math.sin(time * (k ? 22 : 15) + k * 1.9));
          const env = ramp(rf, 2, 6) * (1 - ramp(rf, 22, 27));
          const big = k === 0 ? 0.35 + 0.55 * blink + (rf >= 16 && rf <= 22 ? 0.6 : 0) : 0.12 + 0.16 * blink;
          g.scale.setScalar(big * env);
          g.material.rotation = time * (k ? 3 : 1.2);
        });
        if (on && chest && emitTick && rf >= 6 && Math.random() < 0.7)
          this.vfx.sparks(chest.x + f.facing * 0.12, chest.y + 0.08, 3, new THREE.Color(0xc8f8ff), 1.6, f.facing, 1.5);
      }

      // --- Jazeek: Blunt für dich is a grab now (D42): the giant joint is the cinematic's own prop (cines.ts); the
      // hand joint, its tip and the lighter flame stay hidden
      if (f.def === 'jazeek') {
        this.joints[i]?.place(rig, 'haR', false);
        this.tip[i].visible = false;
        this.flame[i].visible = false;
        this.lastMf[i] = -1;
      }

      // --- Bonez: Abrissbirne — the PO's wrecking ball swings in on its chain from the background, straight into the
      // opponent on the hit frames 18-21 (pendulum about a pivot above them; the hitbox stays the sim's)
      if (inMove('bon_abriss') && f.mf < 42) {
        let ball = this.balls[i];
        if (!ball && hasProp('ball')) {
          const pivot = new THREE.Group();
          const m = propModel('ball', true)!;
          m.scale.setScalar(1.4); // chain + ball 2.1 m
          pivot.add(m);
          pivot.userData.mats = materialsOf(m);
          this.group.add(pivot);
          ball = this.balls[i] = pivot;
        }
        if (ball) {
          const mf = f.mf;
          const k = (a: number, b: number) => Math.min(1, Math.max(0, (mf - a) / (b - a)));
          // + = back into the scene; 0 = hanging straight down at the opponent's head
          const th = mf < 18 ? 1.25 * (1 - k(4, 18) * k(4, 18)) : mf < 24 ? -0.5 * ease(k(18, 24)) : -0.5 + 0.35 * ease(k(24, 36));
          ball.visible = true;
          ball.position.set(x + f.facing * 1.1, 2.9, 0); // the ~1 m ball hangs at the opponent's head on the hit frame
          ball.rotation.set(th, 0, 0);
          setOpacity(ball.userData.mats as THREE.Material[], Math.min(k(1, 6), 1 - k(32, 41)));
          if (mf === 18 && f.hitstop === 0 && emitTick) this.vfx.sparks(x + f.facing * 1.1, 1.5, 12, new THREE.Color(0xffd36b), 6, f.facing, 2);
        }
      } else if (this.balls[i]) this.balls[i]!.visible = false;

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
    if (kind === 'bluntsmoke') {
      // a thick, slowly churning cloud of soft smoke sprites (greenish grey)
      const g = new THREE.Group();
      const tex = smokeTexture();
      for (let i = 0; i < 14; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: [0xdfe6d6, 0xc9d8bf, 0xeef0e8][i % 3], transparent: true, depthWrite: false }));
        const a = (i / 14) * Math.PI * 2;
        sp.userData = { a, r: 0.12 + ((i * 7) % 5) * 0.06, y: ((i * 5) % 7) / 7 - 0.5, size: 0.5 + ((i * 3) % 4) * 0.12, seed: i * 1.3 };
        g.add(sp);
      }
      return g;
    }
    const p11 = makeProjectile11(kind);
    if (p11) return p11;
    if (kind === 'diamonds') return makeDiamondRain();
    if (kind === 'car') return tunerCarModel() ?? makeTunerCar();
    if (kind === 'crocrun') {
      const model = crocRunnerModel();
      const c = model ?? makeCrocRunner();
      c.group.userData.croc = c;
      c.group.userData.glb = !!model;
      return c.group;
    }
    return null;
  }

  /** Returns true if handled. */
  updateProjectile(m: THREE.Object3D, p: ProjectileState, s: GameState, time: number): boolean {
    if (updateProjectile11(m, p, s, time, this.vfx)) return true;
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
      // Diamanten-Regen: a sparkling warning ring on the floor under the opponent (harmless), a light shaft from above
      // with diamonds gathering high up; then the shower: dense, big, spinning diamonds hammer the zone, bounce and glint
      const pd = getMove(s.fighters[p.owner].def, p.move).projectile!.def;
      const arm = pd.armAt ?? 0;
      const life = pd.life;
      const warn = p.age < arm;
      const tw = ramp(p.age, 0, 6);
      const out = 1 - ramp(p.age, life - 10, life);
      const fall = warn ? 0 : ramp(p.age, arm, arm + 4) * out;
      m.position.set(p.x / U, p.y / U, 0.05);
      const floor = -p.y / U + 0.02;
      const ud = m.userData as { ring: THREE.Mesh; shaft: THREE.Mesh; glow: THREE.Mesh };
      // warning ring: pulses faster as the shower approaches, then flares and stays as a glowing pool while it rains
      const k = warn ? p.age / Math.max(1, arm) : 1;
      ud.ring.position.y = floor;
      const pulse = 0.5 + 0.5 * Math.sin(time * (8 + 22 * k));
      const rs = warn ? 0.85 + 0.25 * (1 - k) + 0.05 * pulse : 1.05 + 0.04 * Math.sin(time * 30);
      ud.ring.scale.set(rs, rs, rs);
      (ud.ring.material as THREE.MeshBasicMaterial).opacity = (warn ? tw * (0.45 + 0.45 * pulse) : 0.9) * out;
      ud.glow.position.y = floor + 0.01;
      (ud.glow.material as THREE.MeshBasicMaterial).opacity = (warn ? 0.25 * tw * k : 0.55) * out;
      // light shaft from above
      ud.shaft.position.y = floor + 1.9;
      (ud.shaft.material as THREE.MeshBasicMaterial).opacity = (warn ? 0.1 + 0.18 * k : 0.32) * tw * out;
      m.children.forEach((c) => {
        const d = c.userData as { lane: number; z: number; off: number; spin: number; size: number; glint?: boolean; dia?: boolean };
        if (d.glint) {
          (c as THREE.Sprite).material.opacity = (warn ? 0.6 * tw : 1) * out * (0.4 + 0.6 * Math.abs(Math.sin(time * 14 + d.off * 9)));
          c.position.y = warn ? 1.9 + d.off * 0.6 : floor + 0.15 + ((d.off * 7) % 1) * 1.6;
          return;
        }
        if (!d.dia) return;
        if (warn) {
          // gathering high up: small, slowly spinning, twinkling
          c.position.set(d.lane * 0.8, 2.05 + d.off * 0.5, d.z * 0.6);
          c.rotation.set(time * d.spin * 0.4, time * d.spin * 0.6, 0.3);
          const sc = d.size * 0.45 * tw * k;
          c.scale.set(sc, sc, sc);
          return;
        }
        // falling: each diamond loops top -> floor, bounces once, then the next fall starts from the top
        const period = 16;
        const t = ((p.age - arm + d.off * period) / period) % 1;
        const top = 2.2;
        const y = top - t * t * (top - floor) * 1.15;
        const landed = y <= floor + 0.06;
        c.position.set(d.lane, landed ? floor + 0.06 + Math.sin((t - 0.87) * 30) * 0.05 : y, d.z);
        c.rotation.set(time * d.spin, time * d.spin * 1.3, 0.3);
        const sc = d.size * fall;
        c.scale.set(sc, sc * (m.userData.glb ? 1 : 1.4), sc);
      });
      if (warn) {
        if (p.age % 3 === 0) this.vfx.sparks(p.x / U + (Math.random() - 0.5) * 1.0, 0.04, 2, new THREE.Color(0xbff6ff), 1.4, 0, 1.5);
      } else if (fall > 0.1) {
        if (p.age % 2 === 0) this.vfx.sparks(p.x / U + (Math.random() - 0.5) * 1.1, 0.06, 4, new THREE.Color(0xe8fdff), 3.5, 0, 2.2);
        this.vfx.emit(p.x / U + (Math.random() - 0.5) * 1.1, 2.4, 0.1, 0, -6, 0, new THREE.Color(0xe8fdff), 0.4, 0.07, 0, 0.45, 0, 0);
      }
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
    if (p.kind === 'bluntsmoke') {
      const life = 46;
      const grow = ease(p.age / 10);
      const fade = 1 - ease((p.age - (life - 12)) / 12);
      m.position.set(p.x / U, p.y / U, 0.2);
      m.children.forEach((c) => {
        const sp = c as THREE.Sprite;
        const d = sp.userData as { a: number; r: number; y: number; size: number; seed: number };
        const a = d.a + time * 1.6 * (d.seed % 2 ? 1 : -1);
        sp.position.set(Math.cos(a) * d.r * (0.6 + grow), d.y * 0.55 * (0.6 + grow) + Math.sin(time * 2 + d.seed) * 0.04, Math.sin(a) * d.r * 0.5);
        const sz = d.size * (0.35 + 0.65 * grow);
        sp.scale.set(sz, sz, 1);
        (sp.material as THREE.SpriteMaterial).opacity = 0.8 * fade;
        (sp.material as THREE.SpriteMaterial).rotation = time * 0.6 + d.seed;
      });
      return true;
    }
    if (p.kind === 'crocrun') {
      // Bonez' little crocodile: pops out of the ground dust, then scurries low along the floor snapping its jaws
      const c = m.userData.croc as ReturnType<typeof makeCrocRunner>;
      // the procedural croc runs a bit larger than in the cinematic (it passes the card hand); the PO's model is 1.5 m
      const pop = (m.userData.glb ? 1.3 : 1.45) * (0.7 + 0.3 * ease(p.age / 5)); // D42: bigger, readable on a phone
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
  // the PO's diamond model when loaded (0.27 m wide), else octahedra; big and bright enough to read on a phone
  const model = propMesh('diamond');
  const geo = model?.geometry ?? new THREE.OctahedronGeometry(0.19, 0);
  const mats = model
    ? [0, 1, 2].map((i) => {
        const m = (model.material as THREE.MeshStandardMaterial).clone();
        m.emissive = new THREE.Color([0xcfefff, 0x9fd8ff, 0xffffff][i]);
        m.emissiveIntensity = 0.4;
        m.transparent = true;
        return m;
      })
    : [0xe8fdff, 0x9ff4ff, 0x7fe8ff, 0xffffff].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.05, emissive: 0x6fe0ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.96 }),
      );
  g.userData.glb = !!model;
  // many small cut stones (not a few big chunks: those read as ice), each with its own sparkle
  for (let i = 0; i < 76; i++) {
    const d = new THREE.Mesh(geo, mats[i % mats.length]);
    d.userData = {
      dia: true,
      lane: (((i * 37) % 23) / 22) * 1.1 - 0.55,
      z: (((i * 53) % 11) / 10 - 0.5) * 0.8,
      off: ((i * 29) % 41) / 41,
      spin: 4 + (i % 5),
      size: (0.8 + ((i * 7) % 5) * 0.12) * (model ? 1.05 : 0.75),
    };
    d.castShadow = false;
    g.add(d);
  }
  // star glints in white and the stones' rainbow 'fire'
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glintTexture(), color: [0xffffff, 0xbff6ff, 0xffd6f6, 0xfff3c4][i % 4], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sp.position.set((i / 15 - 0.5) * 1.1, 0, 0.35);
    sp.scale.set(0.42, 0.42, 1);
    sp.userData = { glint: true, off: i * 0.37 };
    g.add(sp);
  }
  // warning ring on the floor (a bright rim + inner sparkle band) and a soft pool of light
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 5;
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 40),
    new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.renderOrder = 4;
  // light shaft: an open cone from above, additive
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.62, 3.8, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xcff8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  shaft.renderOrder = 6;
  g.add(ring, glow, shaft);
  g.userData.ring = ring;
  g.userData.glow = glow;
  g.userData.shaft = shaft;
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
