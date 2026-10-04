// GameView: the presentation layer. Reads GameState + SimEvents, never mutates the sim.
import * as THREE from 'three';
import type { SimEvent } from '../core/events';
import { UNITS_PER_METER } from '../core/math';
import { getFighter, getMove } from '../core/registry';
import { activeHitboxes, hurtboxes, projectileBox } from '../core/sim';
import type { GameState } from '../core/state';
import { ANIM_SETS, FighterAnimator } from './animator';
import { Arena } from './arena';
import { HinterhofArena, type ArenaLike } from './arenas/hinterhof';
import { CameraDirector } from './camera';
import { buildCharacter, CHARACTER_VISUALS } from './characters';
import type { Rig } from './rig';
import { SpecialFX } from './specials';
import { addPart } from './toon';
import { VFX } from './vfx';

const U = UNITS_PER_METER;
const C = (hex: number) => new THREE.Color(hex);
const HIT_COLORS = [C(0xfff4c2), C(0xffd36b), C(0xff9a3c), C(0xffffff)];
const BLOCK_COLOR = C(0x7fd8ff);
const COUNTER_COLOR = C(0xff3b5c);

export interface ViewHooks {
  /** Cinematic presentation hook (camera + poses + fx); returns true while active. */
  cinematic?: (view: GameView, s: GameState, dt: number, alpha: number) => boolean;
}

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly arena: ArenaLike;
  readonly director = new CameraDirector();
  readonly vfx = new VFX();
  readonly fx = new SpecialFX(this.vfx);
  rigs: Rig[] = [];
  anims: FighterAnimator[] = [];
  private shadows: THREE.Mesh[] = [];
  private projMeshes = new Map<number, THREE.Object3D>();
  private flash = [0, 0];
  private flashColor = [new THREE.Color(), new THREE.Color()];
  private shakeT = [0, 0];
  private dim = 0;
  private debugGroup = new THREE.Group();
  private debugPool: THREE.Mesh[] = [];
  debug = false;
  time = 0;
  hooks: ViewHooks = {};
  /** Exposed for UI: screen-space flash request (0..1). */
  screenFlash = 0;
  private matchKey = '';
  /** Cinematics may request a custom darkening level (0..1). */
  dimOverride: number | null = null;

  constructor(canvas: HTMLCanvasElement, arenaId = 'hinterhof') {
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(coarse ? 1.75 : 2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.arena = arenaId === 'club' ? new Arena(this.scene) : new HinterhofArena(this.scene);
    this.scene.add(this.vfx.group);
    this.scene.add(this.fx.group);
    this.vfx.setCamera(this.director.cam);
    this.scene.add(this.debugGroup);
    this.resize();
  }

  resize(): void {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.director.resize(w / Math.max(1, h));
  }

  setMatch(s: GameState): void {
    const key = s.fighters.map((f) => f.def).join('|');
    if (key === this.matchKey && this.rigs.length) {
      this.anims = s.fighters.map((f, i) => new FighterAnimator(ANIM_SETS[f.def], i));
      return;
    }
    this.matchKey = key;
    for (const r of this.rigs) this.scene.remove(r.root);
    for (const sh of this.shadows) this.scene.remove(sh);
    this.rigs = [];
    this.shadows = [];
    const shadowTex = radial();
    s.fighters.forEach((f, i) => {
      const palette = i === 1 && s.fighters[0].def === f.def ? 1 : 0;
      const rig = buildCharacter(f.def, palette);
      this.rigs.push(rig);
      this.scene.add(rig.root);
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 }),
      );
      sh.rotation.x = -Math.PI / 2;
      sh.renderOrder = 1;
      this.shadows.push(sh);
      this.scene.add(sh);
    });
    this.anims = s.fighters.map((f, i) => new FighterAnimator(ANIM_SETS[f.def], i));
  }

  accentFor(s: GameState, i: number): string {
    const f = s.fighters[i];
    const palette = i === 1 && s.fighters[0].def === f.def ? 1 : 0;
    return CHARACTER_VISUALS[f.def].accents[palette];
  }

  handleEvents(s: GameState, events: readonly SimEvent[]): void {
    this.fx.onEvents(s, events);
    for (const e of events) {
      switch (e.t) {
        case 'hit': {
          const x = e.x / U;
          const y = e.y / U;
          const dir = e.projectile ? Math.sign(s.fighters[e.d].x - e.x) || 1 : s.fighters[e.a].facing;
          const col = e.counter ? COUNTER_COLOR : HIT_COLORS[e.strength];
          const n = [12, 18, 28, 40][e.strength];
          this.vfx.sparks(x, y, n, col, [6, 8, 11, 13][e.strength], dir);
          this.vfx.flash(x, y, [0.45, 0.6, 0.9, 1.2][e.strength], col, 0.09);
          this.vfx.flash(x, y, [0.2, 0.25, 0.35, 0.45][e.strength], C(0xffffff), 0.06);
          if (e.strength >= 2) this.vfx.ring(x, y, [0, 0, 0.55, 0.95][e.strength], col, 0.18);
          if (e.counter) this.vfx.ring(x, y, 1.4, COUNTER_COLOR, 0.32);
          this.director.shake([0.1, 0.18, 0.32, 0.45][e.strength] + (e.counter ? 0.15 : 0));
          this.director.kick(dir * [0.02, 0.035, 0.06, 0.08][e.strength], 0, -[0.02, 0.04, 0.08, 0.1][e.strength]);
          if (e.strength >= 2) this.director.punch(e.strength === 3 ? 2.2 : 1.2);
          this.flash[e.d] = 1;
          this.flashColor[e.d].set(e.counter ? 0xff6070 : 0xffffff);
          this.shakeT[e.d] = 1;
          const def = s.fighters[e.d];
          if (!e.projectile && e.move) {
            const atk = s.fighters[e.a];
            try {
              const mv = getMove(atk.def, e.move);
              this.anims[e.d]?.noteReaction(mv.hits.find((h) => h.reaction)?.reaction ?? (def.crouching ? 'low' : 'high'));
            } catch {
              /* ignore */
            }
          } else this.anims[e.d]?.noteReaction('gut');
          if (e.strength >= 2) this.arena.pulse(0.25);
          if (e.counter || e.strength === 3) this.screenFlash = Math.max(this.screenFlash, 0.35);
          break;
        }
        case 'block': {
          const x = e.x / U;
          const y = e.y / U;
          const dir = s.fighters[e.a].facing;
          this.vfx.sparks(x, y, 10 + e.strength * 4, BLOCK_COLOR, 5 + e.strength, dir, 0.6);
          this.vfx.ring(x, y, 0.45 + e.strength * 0.12, BLOCK_COLOR, 0.18);
          this.vfx.flash(x, y, 0.4, BLOCK_COLOR, 0.07);
          this.director.shake(0.06 + e.strength * 0.04);
          this.director.kick(dir * 0.015, 0, 0);
          this.shakeT[e.d] = 0.6;
          break;
        }
        case 'armor': {
          const x = e.x / U;
          const y = e.y / U;
          this.vfx.sparks(x, y, 18, C(0xffa040), 7, s.fighters[e.a].facing);
          this.vfx.ring(x, y, 0.9, C(0xffa040), 0.25);
          this.flash[e.d] = 1;
          this.flashColor[e.d].set(0xff9a30);
          this.director.shake(0.25);
          break;
        }
        case 'counter': {
          const x = e.x / U;
          const y = e.y / U;
          this.vfx.ring(x, y, 1.6, C(0x8af7ff), 0.35);
          this.vfx.sparks(x, y, 30, C(0x8af7ff), 9, 1, 2);
          this.flash[e.p] = 1;
          this.flashColor[e.p].set(0x8af7ff);
          this.screenFlash = Math.max(this.screenFlash, 0.5);
          this.director.punch(2.5);
          this.arena.pulse(0.5);
          break;
        }
        case 'throwHit': {
          const x = e.x / U;
          this.vfx.dust(x, 0, 24, 1.2);
          this.vfx.ring(x, 0.05, 1.6, C(0xffffff), 0.3, true);
          this.vfx.sparks(x, 0.4, 20, HIT_COLORS[2], 8, 1, 2);
          this.director.shake(0.45);
          this.director.kick(0, -0.06, 0);
          this.flash[e.d] = 1;
          this.flashColor[e.d].set(0xffffff);
          break;
        }
        case 'tech': {
          this.vfx.sparks(e.x / U, e.y / U, 22, C(0xffffff), 7, 1, 2);
          this.vfx.ring(e.x / U, e.y / U, 0.9, C(0xffffff), 0.25);
          this.director.shake(0.15);
          break;
        }
        case 'knockdown': {
          this.vfx.dust(e.x / U, 0, 16, 1);
          this.director.shake(0.15);
          break;
        }
        case 'land':
        case 'jump':
        case 'dash': {
          const f = s.fighters[e.p];
          this.vfx.dust(f.x / U, 0, e.t === 'land' ? 6 : 4, 0.5);
          break;
        }
        case 'superFlash': {
          const f = s.fighters[e.p];
          const x = f.x / U;
          this.vfx.ring(x, 1.1, 2.4, C(0xffd21f), 0.5);
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            this.vfx.emit(x, 1.1, 0.3, Math.cos(a) * 6, Math.sin(a) * 6, 0, C(0xffd21f), 1.4, 0.05, 0.05, 0.35, 4, 0);
          }
          this.screenFlash = Math.max(this.screenFlash, 0.6);
          this.director.punch(3);
          this.arena.pulse(0.8);
          break;
        }
        case 'ko': {
          const loser = e.loser >= 0 ? s.fighters[e.loser] : s.fighters[0];
          const x = loser.x / U;
          this.vfx.flash(x, 1.2, 2.5, C(0xffffff), 0.25);
          this.vfx.ring(x, 1.2, 3, C(0xffd21f), 0.6);
          this.vfx.sparks(x, 1.2, 60, C(0xffd21f), 12, 1, 2);
          this.director.shake(0.7);
          this.director.punch(4);
          this.arena.pulse(1);
          this.screenFlash = 1;
          break;
        }
        case 'projectileEnd': {
          this.vfx.sparks(e.x / U, e.y / U, 10, C(0xd0f4ff), 5, 1, 2);
          const m = this.projMeshes.get(e.id);
          if (m) {
            this.scene.remove(m);
            this.projMeshes.delete(e.id);
          }
          break;
        }
        case 'clash': {
          this.vfx.sparks(e.x / U, e.y / U, 30, C(0xffffff), 9, 1, 2);
          this.vfx.ring(e.x / U, e.y / U, 1.2, C(0xffffff), 0.3);
          this.director.shake(0.25);
          break;
        }
        case 'meterGain': {
          const f = s.fighters[e.p];
          for (let i = 0; i < 26; i++)
            this.vfx.emit(f.x / U + (Math.random() - 0.5) * 0.8, Math.random() * 1.8, 0.3, 0, 1.5 + Math.random() * 2, 0, C(0xffd21f), 1.2, 0.05, 0.04, 0.8, 1, 0);
          this.arena.pulse(0.4);
          break;
        }
        default:
          break;
      }
    }
  }

  render(s: GameState, dt: number, alpha: number, beat: number): void {
    this.time += dt;
    const slow = s.slowmo > 0 ? 0.35 : 1;
    this.vfx.timeScale = slow;
    const cineActive = this.hooks.cinematic ? this.hooks.cinematic(this, s, dt, alpha) : false;
    if (!cineActive) this.director.setOverride(null);
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const anim = this.anims[i];
      const rig = this.rigs[i];
      if (!anim || !rig) continue;
      anim.beat = beat;
      const pose = anim.update(s, dt, this.time, alpha);
      rig.apply(pose, f.facing);
      let sx = 0;
      if (f.hitstop > 0 && this.shakeT[i] > 0) sx = (s.frame % 2 ? 1 : -1) * 0.03 * Math.min(1, f.hitstop / 6);
      rig.root.position.set(anim.vx + sx, anim.vy, i === 0 ? 0.04 : -0.04);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 9);
      if (f.hitstop <= 0) this.shakeT[i] = Math.max(0, this.shakeT[i] - dt * 4);
      rig.setFlash(this.flash[i] * this.flash[i] * 0.7, this.flashColor[i]);
      const sh = this.shadows[i];
      const sc = Math.max(0.3, 1 - anim.vy * 0.35) * (getFighter(f.def).pushHalf / U) * 4.2;
      sh.scale.set(sc * 1.15, sc * 0.55, 1);
      sh.position.set(anim.vx, 0.006, 0);
      if (rig.props.mic) rig.props.mic.visible = !s.projectiles.some((p) => p.owner === i && p.kind === 'mic');
    }

    this.fx.update(s, dt * slow, this.time, this.anims, this.rigs);
    this.updateProjectiles(s, dt);

    // super flash darkening
    const wantDim = s.freeze > 0 ? 0.9 : s.cine ? (this.dimOverride ?? 0.35) : 0;
    this.dim += (wantDim - this.dim) * (1 - Math.exp(-dt * 10));
    this.arena.setDim(this.dim);
    this.arena.setHype(Math.max(s.fighters[0].meter, s.fighters[1].meter) / 300);
    this.arena.update(this.time, beat);

    const a = this.anims[0];
    const b = this.anims[1];
    if (a && b) this.director.update(dt, a.vx, a.vy, b.vx, b.vy, s.phase === 'intro' ? -0.4 : 0);
    this.vfx.update(dt);
    this.updateDebug(s);
    this.screenFlash = Math.max(0, this.screenFlash - dt * 3.5);
    this.renderer.render(this.scene, this.director.cam);
  }

  private updateProjectiles(s: GameState, dt: number): void {
    const alive = new Set<number>();
    for (const p of s.projectiles) {
      alive.add(p.id);
      let m = this.projMeshes.get(p.id);
      if (!m) {
        m = this.fx.makeProjectile(p.kind) ?? makeProjectile(p.kind);
        this.projMeshes.set(p.id, m);
        this.scene.add(m);
      }
      if (this.fx.updateProjectile(m, p, s, this.time)) continue;
      m.position.set(p.x / U, p.y / U, 0.1);
      m.scale.x = p.dir;
      if (p.kind === 'mic') {
        m.rotation.z += dt * 22 * p.dir;
        this.vfx.emit(p.x / U, p.y / U, 0.1, 0, 0, 0, C(0x9ad8ff), 0.6, 0.12, 0, 0.12, 0, 0);
      } else {
        const t = this.time * 12;
        m.children.forEach((c, i) => c.scale.setScalar(1 + 0.12 * Math.sin(t + i)));
        if (Math.random() < 0.6) this.vfx.dust(p.x / U, 0, 1, 0.4, C(0xff4fd8));
      }
    }
    for (const [id, m] of this.projMeshes) {
      if (!alive.has(id)) {
        this.scene.remove(m);
        this.projMeshes.delete(id);
      }
    }
  }

  private updateDebug(s: GameState): void {
    this.debugGroup.visible = this.debug;
    if (!this.debug) return;
    let n = 0;
    const box = (b: { x0: number; x1: number; y0: number; y1: number }, color: number) => {
      let m = this.debugPool[n];
      if (!m) {
        m = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthTest: false }),
        );
        m.renderOrder = 50;
        this.debugPool.push(m);
        this.debugGroup.add(m);
      }
      n++;
      m.visible = true;
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      m.scale.set((b.x1 - b.x0) / U, (b.y1 - b.y0) / U, 1);
      m.position.set((b.x0 + b.x1) / 2 / U, (b.y0 + b.y1) / 2 / U, 0.6);
    };
    for (const f of s.fighters) {
      for (const b of hurtboxes(f)) box(b, 0x2f8cff);
      for (const b of activeHitboxes(f)) box(b, 0xff2340);
      const d = getFighter(f.def);
      box({ x0: f.x - d.pushHalf, x1: f.x + d.pushHalf, y0: f.y, y1: f.y + 400 }, 0x33ff88);
    }
    for (const p of s.projectiles) box(projectileBox(s, p), 0xffaa00);
    for (let i = n; i < this.debugPool.length; i++) this.debugPool[i].visible = false;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

function radial(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.4)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeProjectile(kind: string): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'mic') {
    const body = new THREE.MeshToonMaterial({ color: 0x16161a });
    const head = new THREE.MeshToonMaterial({ color: 0xd8dbe6, emissive: 0x6fb8ff, emissiveIntensity: 0.4 });
    addPart(g, new THREE.CylinderGeometry(0.022, 0.03, 0.2, 10), body, { rot: [0, 0, Math.PI / 2], pos: [-0.06, 0, 0], outline: 0.008 });
    addPart(g, new THREE.SphereGeometry(0.05, 12, 10), head, { pos: [0.06, 0, 0], outline: 0.008 });
  } else {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18 + i * 0.12, 0.022, 6, 24, Math.PI), mat);
      ring.position.x = -i * 0.12;
      ring.rotation.z = -Math.PI / 2;
      g.add(ring);
    }
  }
  return g;
}
