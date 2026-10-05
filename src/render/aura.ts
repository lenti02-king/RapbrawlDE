// Special-move aura: when a card fires, the fighter powers up in the card's colour — an energy pillar, a glowing rune
// circle on the floor, a light that washes over the arena, sparks rising off the body and energy trails from hands and
// feet while the move runs. Presentation only (keyed to the sim's move state); built once, no shader compiles mid-match.
import * as THREE from 'three';
import type { SimEvent } from '../core/events';
import { UNITS_PER_METER } from '../core/math';
import { getCard } from '../core/registry';
import type { GameState } from '../core/state';
import type { FighterAnimator } from './animator';
import type { CharacterRig } from './glbRig';
import type { VFX } from './vfx';
import type { ToonFX } from './toonfx';
import type { CameraDirector } from './camera';

const U = UNITS_PER_METER;
const CAT_HEX: Record<string, number> = {
  offense: 0xff6a3d,
  zoning: 0x3dc8ff,
  mobility: 0x5ce07a,
  counter: 0xb56bff,
  utility: 0xffc93d,
  grapple: 0xff4f8b,
  signature: 0xffd23a,
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rune circle: concentric rings, ticks and a star, white on transparent (tinted by the material). */
function runeTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.translate(128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, 118, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 96, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 98, Math.sin(a) * 98);
      g.lineTo(Math.cos(a) * (i % 3 ? 108 : 116), Math.sin(a) * (i % 3 ? 108 : 116));
      g.stroke();
    }
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 36 : 84;
      if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.stroke();
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, 120);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, 120, 0, Math.PI * 2);
    g.fill();
  });
}

/** Vertical streaks for the energy pillar (scrolls upward). */
function pillarTexture(): THREE.CanvasTexture {
  const t = canvasTex(64, 256, (g) => {
    for (let i = 0; i < 26; i++) {
      const x = (i * 37) % 64;
      const y = (i * 91) % 256;
      const h = 40 + ((i * 13) % 80);
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, 2 + (i % 3), h);
      g.fillRect(x, y - 256, 2 + (i % 3), h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function glowTexture(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
}

interface Slot {
  group: THREE.Group;
  rune: THREE.Mesh;
  pillar: THREE.Mesh;
  glow: THREE.Sprite;
  light: THREE.PointLight | null;
  color: THREE.Color;
  card: string | null;
  level: number;
  t: number;
}

const additive = (map: THREE.Texture, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side, toneMapped: false, fog: false });

export class SpecialAura {
  readonly group = new THREE.Group();
  private slots: Slot[] = [];
  private acc = 0;

  constructor(
    private vfx: VFX,
    private toon: ToonFX,
    private director: CameraDirector,
    lights: boolean,
  ) {
    const rune = runeTexture();
    const pillarTex = pillarTexture();
    const glow = glowTexture();
    for (let i = 0; i < 2; i++) {
      const group = new THREE.Group();
      const r = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), additive(rune));
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.02;
      r.renderOrder = 3;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 3.2, 28, 1, true), additive(pillarTex.clone(), THREE.DoubleSide));
      (p.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
      p.position.y = 1.6;
      p.renderOrder = 4;
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      g.scale.set(2.8, 3.2, 1);
      g.position.set(0, 1.2, -0.3);
      group.add(r, p, g);
      let light: THREE.PointLight | null = null;
      if (lights) {
        light = new THREE.PointLight(0xffffff, 0, 6, 1.5);
        light.position.set(0, 1.3, 0.8);
        group.add(light);
      }
      this.group.add(group);
      this.slots.push({ group, rune: r, pillar: p, glow: g, light, color: new THREE.Color(), card: null, level: 0, t: 0 });
    }
  }

  onEvents(s: GameState, events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.t !== 'card') continue;
      const f = s.fighters[e.p];
      let cat = 'offense';
      try {
        cat = getCard(f.def, e.card).category;
      } catch {
        /* keep default */
      }
      const slot = this.slots[e.p];
      slot.card = e.card;
      slot.t = 0;
      slot.color.setHex(CAT_HEX[cat] ?? 0xffffff);
      // activation burst: shockwave on the floor, a ring of light, sparks bursting off the body, speed lines
      const x = f.x / U;
      this.vfx.ring(x, 0.04, 3.0, slot.color, 0.45, true);
      this.vfx.ring(x, 1.1, 1.8, slot.color.clone().lerp(new THREE.Color(0xffffff), 0.5), 0.3);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        this.vfx.emit(x + Math.cos(a) * 0.2, 0.9 + Math.sin(a) * 0.5, 0.2, Math.cos(a) * 3.5, 2 + Math.sin(a) * 3, 0, slot.color, 1.1, 0.06, 0.04, 0.45, 3, 0);
      }
      this.toon.speedLines(x, 1.1, slot.color.clone().lerp(new THREE.Color(0xffffff), 0.6), 0.3, 0.45);
      this.director.punch(1.6);
    }
  }

  update(s: GameState, dt: number, time: number, anims: FighterAnimator[], rigs: CharacterRig[]): void {
    this.acc += dt;
    const tick = this.acc > 1 / 40;
    if (tick) this.acc = 0;
    s.fighters.forEach((f, i) => {
      const slot = this.slots[i];
      const anim = anims[i];
      const rig = rigs[i];
      const active = !!slot.card && f.state === 'move' && f.card === slot.card;
      slot.t += dt;
      // fast power-up, slower fade
      slot.level = active ? Math.min(1, slot.level + dt * 9) : Math.max(0, slot.level - dt * 3);
      if (!active && slot.level === 0) slot.card = null;
      const a = slot.level;
      slot.group.visible = a > 0.001;
      if (!slot.group.visible || !anim) return;
      slot.group.position.set(anim.vx, f.y / U, 0);
      const pulse = 0.85 + 0.15 * Math.sin(time * 14 + i);
      const rm = slot.rune.material as THREE.MeshBasicMaterial;
      rm.color.copy(slot.color);
      rm.opacity = a * 0.9;
      slot.rune.rotation.z = time * 1.6 * (i ? -1 : 1);
      const grow = 0.6 + 0.4 * Math.min(1, slot.t / 0.18);
      slot.rune.scale.setScalar(grow);
      const pm = slot.pillar.material as THREE.MeshBasicMaterial;
      pm.color.copy(slot.color);
      pm.opacity = a * 0.85 * pulse;
      pm.map!.offset.y = -time * 1.4;
      slot.pillar.scale.set(1, 0.4 + 0.6 * Math.min(1, slot.t / 0.25), 1);
      const gm = slot.glow.material as THREE.SpriteMaterial;
      gm.color.copy(slot.color);
      gm.opacity = a * 0.65 * pulse;
      if (slot.light) {
        slot.light.color.copy(slot.color);
        slot.light.intensity = a * 3.2 * pulse;
      }
      if (!tick || !active || !rig) return;
      // energy rising off the body + trails from the striking limbs
      const x = anim.vx;
      this.vfx.emit(x + (Math.random() - 0.5) * 0.7, 0.2 + Math.random() * 1.2, 0.25, (Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 1.4, 0, slot.color, 0.7, 0.05, 0.02, 0.5, 0, 0);
      const v = new THREE.Vector3();
      for (const j of ['haL', 'haR', 'ftL', 'ftR'] as const) {
        const bone = rig.joints[j];
        if (!bone) continue;
        bone.getWorldPosition(v);
        this.vfx.emit(v.x, v.y, v.z + 0.05, 0, 0.3, 0, slot.color, 0.45, 0.07, 0.01, 0.3, 0, 0);
      }
    });
  }
}
