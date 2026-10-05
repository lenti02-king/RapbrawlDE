// Fatalities (finish phase after the match-deciding KO): a brutal cartoon finisher per fighter that ends with the
// winner mocking the flattened loser. Pure presentation keyed to the sim's fatal.frame (src/core/sim.ts stepFinish);
// the victim stands 1.1 m in front of the attacker at frame 0. Cartoon violence only: squash, stars, no gore.
import * as THREE from 'three';
import { BONEZ_ANIMS, BONEZ_POSES } from './anims/bonez';
import { JAZEEK_ANIMS, JAZEEK_POSES } from './anims/jazeek';
import { reactions } from './anims/stances';
import type { AnimSet } from './anims/types';
import type { CineDef, CineProps, FxCtx, PropCtx } from './cinematics';
import { Clip, compose, sampleDef, type PoseDef } from './pose';
import { makeCroc } from './props';

export const FATALITY_FRAMES = 300;
/** Mocking last words (shown by the HUD at the end of the fatality). */
export const TAUNTS: Record<string, string[]> = {
  jazeek: ['Zu leise, Bro.', 'Nächstes Mal mit Playback?', 'Danke fürs Zuhören!', 'Platin für mich, Pfannkuchen für dich.'],
  bonez: ['Ab ins Becken!', 'Nächster!', 'Kroko hatte Hunger.', 'Bleib liegen, Kleiner.'],
};
/** Frame from which the HUD shows the taunt bubble / the FATALITY title. */
export const TAUNT_AT = 212;
export const TITLE_AT = 168;

const C = (h: number) => new THREE.Color(h);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const ramp = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hitFx(c: FxCtx, strength: number, color = 0xffd36b, y = 0.45): void {
  const p = c.def.clone().add(new THREE.Vector3(0, y, 0.25));
  c.view.vfx.sparks(p.x, p.y, 16 + strength * 8, C(color), 8 + strength * 2, -c.facing);
  c.view.vfx.flash(p.x, p.y, 0.6 + strength * 0.2, C(0xfff4c2), 0.08);
  c.view.toon.impact(p.x, p.y, 0.9 + strength * 0.3, C(color), { spikes: 10 + strength * 2, life: 0.22 + strength * 0.05 });
  if (strength >= 2) c.view.toon.speedLines(p.x, p.y, C(0xffffff), 0.3, 0.5);
  c.view.director.shake(0.2 + strength * 0.12);
  c.audio.hit(Math.min(3, strength), strength >= 3);
}

/** Victim: dazed wobble, then the beating, flattened at the end. Built per victim rig (stance + pivot). */
function pancake(r: ReturnType<typeof reactions>, x: number, sq = 0.66): PoseDef {
  return compose(r.lying, { x, s: { sq } });
}
function dizzyKeys(r: ReturnType<typeof reactions>, until: number): { f: number; p: PoseDef }[] {
  const out: { f: number; p: PoseDef }[] = [];
  for (let f = 0; f <= until; f += 8) {
    const k = (f / 8) % 2 ? 1 : -1;
    out.push({ f, p: compose(r.hitHigh, { x: -0.02, rot: 5 * k, j: { head: [0, 14 * k, 16], neck: [0, 8 * k, 8], shL: [40, 0, -10], elL: [0, 0, 20], shR: [-40, 0, -14], elR: [0, 0, 24] } }) });
  }
  return out;
}

// =================================================================== JAZEEK — PLATIN-FINALE
const J = JAZEEK_POSES;
const jM = JAZEEK_ANIMS.moves;
const beckon: PoseDef = { j: { shR: [-10, 0, 70], elR: [0, 0, 120], haR: [0, 0, -40], head: [0, -14, 14], chest: [0, -18, 6], shL: [20, 0, 20], elL: [0, 0, 30] } };
const pointUp: PoseDef = { j: { shL: [10, 0, 172], elL: [0, 0, 6], haL: [0, 0, -10], head: [0, 0, 24], neck: [0, 0, 10], chest: [0, -10, 10], shR: [-20, 0, 30], elR: [0, 0, 90] } };
const danceA: PoseDef = { y: 0.3, j: { shL: [30, 0, 150], elL: [0, 0, 30], shR: [-30, 0, 60], elR: [0, 0, 120], hips: [0, 20, 0], thL: [6, 20, 40], knL: [0, 0, -70], head: [0, 10, 10] } };
const danceB: PoseDef = { y: 0.24, j: { shL: [30, 0, 60], elL: [0, 0, 120], shR: [-30, 0, 150], elR: [0, 0, 30], hips: [0, -20, 0], thR: [-8, 18, 30], knR: [0, 0, -70], head: [0, -10, 10] } };
const crouchSign: PoseDef = { y: -0.36, x: 0.35, j: { spine: [0, 0, -30], chest: [0, -10, -20], thL: [6, 20, 90], knL: [0, 0, -120], thR: [-8, 18, 40], knR: [0, 0, -130], shL: [20, 0, 80], elL: [0, 0, 60], haL: [0, 0, -30], shR: [-20, 0, 30], elR: [0, 0, 90], head: [0, 0, -20] } };
const kissHand: PoseDef = { j: { shR: [-30, 0, 128], elR: [0, 0, 150], haR: [0, 0, -20], head: [0, -10, 8], shL: [20, 0, 30], elL: [0, 0, 40] } };
const kissBlow: PoseDef = { x: 0.04, j: { shR: [-8, 0, 92], elR: [0, 0, 6], haR: [0, 0, -40], head: [0, -6, -2], shL: [20, 0, 30], elL: [0, 0, 40] } };

const JAZ_ATK = new Clip(
  [
    { f: 0, p: {} },
    { f: 12, p: beckon, e: 'out' },
    { f: 22, p: compose(beckon, { j: { elR: [0, 0, 140] } }) },
    { f: 26, p: {} },
    { f: 28, p: compose(J.jab, { x: 0.12 }), e: 'snap' },
    { f: 31, p: { x: 0.1 } },
    { f: 34, p: compose(J.cross, { x: 0.18 }), e: 'snap' },
    { f: 37, p: { x: 0.16 } },
    { f: 40, p: compose(J.hookL, { x: 0.2 }), e: 'snap' },
    { f: 45, p: { x: 0.2, y: -0.06 } },
    { f: 52, p: compose(sampleDef(jM.jaz_LLH, 12), { x: 0.05 }), e: 'snap' },
    { f: 57, p: compose(sampleDef(jM.jaz_LLH, 16), { x: 0.0 }) },
    { f: 62, p: compose(sampleDef(jM.jaz_HH, 4), { x: 0.0 }) },
    { f: 65, p: compose(sampleDef(jM.jaz_HH, 8), { x: 0.05 }), e: 'snap' },
    { f: 72, p: compose(sampleDef(jM.jaz_HH, 12), { x: 0.05 }) },
    { f: 80, p: pointUp, e: 'out' },
    { f: 94, p: compose(pointUp, { j: { shL: [10, 0, 178] } }) },
    { f: 100, p: { x: -0.1, s: { sq: 0.1 }, j: { shL: [20, 0, 60], shR: [-20, 0, 60] } }, e: 'snap' },
    { f: 112, p: compose(danceA, { x: 1.25 }), e: 'out' },
    { f: 122, p: compose(danceB, { x: 1.25 }) },
    { f: 132, p: compose(danceA, { x: 1.25 }) },
    { f: 142, p: compose(danceB, { x: 1.25 }) },
    { f: 152, p: compose(danceA, { x: 1.2, y: 0.5 }), e: 'out' },
    { f: 162, p: { x: 0.2, s: { sq: 0.14 } }, e: 'in' },
    { f: 174, p: { x: 0.2 } },
    { f: 192, p: crouchSign, e: 'inOut' },
    { f: 198, p: compose(crouchSign, { j: { elL: [0, 0, 30], haL: [0, 0, -50] } }) },
    { f: 204, p: compose(crouchSign, { j: { elL: [0, 0, 80], haL: [0, 0, -20] } }) },
    { f: 212, p: compose(kissHand, { x: 0.2 }), e: 'inOut' },
    { f: 222, p: compose(kissBlow, { x: 0.24 }), e: 'snap' },
    { f: 236, p: compose(kissBlow, { x: 0.24, j: { elR: [0, 0, 14] } }) },
    { f: 250, p: compose(J.sing, { x: 0.2 }) },
    { f: 300, p: compose(J.sing, { x: 0.2, j: { head: [0, -16, 22] } }) },
  ],
  JAZEEK_ANIMS.stance,
);

function jazVictim(set: AnimSet): Clip {
  const r = reactions(set.stance, set.pivot ?? 0.9);
  return new Clip(
    [
      ...dizzyKeys(r, 24),
      { f: 28, p: compose(r.hitHigh, { x: -0.06 }), e: 'snap' },
      { f: 34, p: compose(r.hitHigh, { x: -0.1, j: { head: [0, -30, 30] } }), e: 'snap' },
      { f: 40, p: compose(r.hitHigh, { x: -0.14, rot: -6 }), e: 'snap' },
      { f: 52, p: compose(r.hitGut, { x: -0.12, y: 0.06 }), e: 'snap' },
      { f: 60, p: compose(r.hitGut, { x: -0.12 }) },
      { f: 65, p: compose(r.juggle, { x: -0.12, y: 0.5, rot: -20 }), e: 'snap' },
      { f: 82, p: compose(r.juggle, { x: -0.1, y: 2.3, rot: -60 }), e: 'out' },
      { f: 94, p: compose(r.juggle, { x: -0.05, y: 2.0, rot: -90 }), e: 'inOut' },
      { f: 100, p: pancake(r, 0, 0.68), e: 'in' },
      { f: 160, p: pancake(r, 0, 0.68) },
      { f: 170, p: pancake(r, 0, 0.6) },
      { f: 178, p: pancake(r, 0, 0.68) },
      { f: 240, p: pancake(r, 0, 0.68) },
      { f: 244, p: compose(pancake(r, 0, 0.64), { j: { shL: [70, 0, 70], shR: [-70, 0, 70] } }) },
      { f: 252, p: pancake(r, 0, 0.68) },
      { f: 300, p: pancake(r, 0, 0.68) },
    ],
    set.stance,
  );
}

/** Canvas texture of a platinum/gold record with grooves and the word PLATIN on the label. */
function recordTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, '#fff6c8');
  grad.addColorStop(0.5, '#ffd34a');
  grad.addColorStop(1, '#c98a12');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(256, 256, 254, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(120,70,0,0.35)';
  for (let r = 110; r < 250; r += 6) {
    g.lineWidth = r % 18 === 0 ? 2 : 1;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#ff3d7f';
  g.beginPath();
  g.arc(256, 256, 100, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.font = 'bold 48px "Lilita One", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PLATIN', 256, 236);
  g.font = 'bold 26px "Lilita One", sans-serif';
  g.fillText('JAZEEK', 256, 284);
  g.fillStyle = '#1a0f2e';
  g.beginPath();
  g.arc(256, 256, 12, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function jazProps(): CineProps {
  const group = new THREE.Group();
  const tex = recordTexture();
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xffc531, metalness: 0.7, roughness: 0.3, emissive: 0x8a5a00, emissiveIntensity: 0.5 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 64), [edge, face, face]);
  disc.castShadow = true;
  const rec = new THREE.Group();
  rec.add(disc);
  group.add(rec);
  const glow = new THREE.PointLight(0xffd36b, 0, 8, 1.6);
  return {
    group,
    lights: [glow],
    update(f: number, c: PropCtx) {
      const vis = f >= 80 && f < 190;
      rec.visible = vis;
      glow.intensity = vis ? 6 * ramp(f, 80, 96) * (1 - ramp(f, 170, 188)) : 0;
      if (!vis) return;
      // falls from the sky (tilted, spinning), crushes at 100, lifts off again from 164
      const fall = Math.min(1, Math.max(0, (f - 82) / 18));
      const lift = ramp(f, 164, 188);
      const y = f < 100 ? lerp(9, 0.06, fall * fall) : lerp(0.06, 10, lift * lift);
      rec.position.set(1.4, y, 0);
      rec.rotation.set(f < 100 ? (1 - fall) * 0.6 : lift * -0.5, f * 0.25 * (f < 100 ? 1 : lift), 0);
      glow.position.copy(c.world(1.4, y + 1.2, 1.2));
    },
  };
}

export const FATAL_JAZEEK: CineDef = {
  frames: FATALITY_FRAMES,
  startDx: 1.1,
  camera: [
    { f: 0, pos: [0.85, 1.55, 1.75], target: [0.05, 1.5, 0], fov: 30 },
    { f: 24, pos: [0.75, 1.5, 1.95], target: [0.1, 1.48, 0], fov: 30 },
    { f: 26, pos: [0.55, 1.15, 4.4], target: [0.55, 1.2, 0], fov: 40, cut: true },
    { f: 58, pos: [0.65, 1.2, 4.0], target: [0.6, 1.25, 0], fov: 40 },
    { f: 60, pos: [0.1, 0.35, 3.0], target: [0.9, 1.6, 0], fov: 50, cut: true },
    { f: 82, pos: [0.2, 0.5, 3.4], target: [0.9, 2.6, 0], fov: 52 },
    { f: 84, pos: [0.3, 0.9, 4.2], target: [1.0, 3.4, 0], fov: 54, cut: true },
    { f: 97, pos: [0.4, 1.1, 4.6], target: [1.0, 1.4, 0], fov: 50 },
    { f: 99, pos: [0.7, 1.9, 6.4], target: [0.8, 0.5, 0], fov: 44, cut: true },
    { f: 150, pos: [1.8, 1.5, 5.0], target: [0.85, 0.7, 0], fov: 42 },
    { f: 176, pos: [1.6, 1.0, 3.6], target: [0.85, 0.4, 0], fov: 38 },
    { f: 210, pos: [1.4, 0.9, 3.0], target: [0.8, 0.45, 0], fov: 36 },
    { f: 212, pos: [0.65, 1.5, 2.1], target: [0.15, 1.45, 0], fov: 30, cut: true },
    { f: 300, pos: [0.7, 1.55, 2.6], target: [0.25, 1.4, 0], fov: 32 },
  ],
  atk: JAZ_ATK,
  def: jazVictim,
  props: jazProps,
  dim: (f) => (f < 100 ? 0.55 : f < 200 ? 0.35 : 0.5),
  fx: [
    { f: 1, run: (c) => (c.audio.riser(), c.view.arena.pulse(0.6)) },
    { f: 28, run: (c) => hitFx(c, 1) },
    { f: 34, run: (c) => hitFx(c, 1, 0xffd36b, 0.55) },
    { f: 40, run: (c) => hitFx(c, 2, 0xff6fae, 0.5) },
    { f: 52, run: (c) => hitFx(c, 2, 0xffd36b, 0.2) },
    {
      f: 65,
      run: (c) => {
        hitFx(c, 3, 0xff3d7f, 0.6);
        c.view.toon.impactFrame(0.06);
        c.audio.whoosh(2);
      },
    },
    { f: 84, run: (c) => (c.audio.chime(), c.audio.riser()) },
    {
      f: 100,
      run: (c) => {
        const x = c.atk.x + c.facing * 1.4;
        c.audio.boom();
        c.audio.slam();
        c.view.toon.impactFrame(0.08);
        c.view.vfx.ring(x, 0.05, 3.2, C(0xffd36b), 0.5, true);
        c.view.vfx.ring(x, 0.6, 2.6, C(0xffffff), 0.4);
        c.view.vfx.sparks(x, 0.3, 90, C(0xffd36b), 14, 1, 2);
        c.view.vfx.confetti(x, 3.2, 90);
        c.view.toon.puff(x, 0, 14, 2.2, new THREE.Color(0xe9dfd0), 0.32, 0.8);
        c.view.toon.crack(x, 2.6);
        c.view.toon.rubble(x, 0, 14, 5);
        c.view.director.shake(1.2);
        c.view.director.punch(6);
        c.view.screenFlash = 1;
        c.view.arena.pulse(1);
        c.audio.crowdSwell(0.8);
      },
    },
    ...[112, 122, 132, 142].map((f) => ({ f, run: (c: FxCtx) => (c.view.vfx.sparks(c.atk.x + c.facing * 1.4, 0.2, 18, C(0xffd36b), 6, 1, 2), c.audio.hit(1, false)) })),
    { f: 168, run: (c) => (c.audio.crowdSwell(0.7), c.view.vfx.confetti(c.def.x, 3.5, 70)) },
    { f: 200, run: (c) => c.view.vfx.sparks(c.def.x, 0.1, 12, C(0xff3d7f), 3, 1, 2) },
    { f: 222, run: (c) => c.view.fx.heartBurst(c.atk.x + c.facing * 0.4, 1.55, 6, 1) },
  ],
};

// =================================================================== BONEZ — KROKODIL-FINALE
const B = BONEZ_POSES;
const bM = BONEZ_ANIMS.moves;
const bR = reactions(BONEZ_ANIMS.stance, 0.88);
const neckRoll: PoseDef = { j: { head: [0, -24, -18], neck: [0, -10, -10], shL: [20, 0, 20], elL: [0, 0, 40], shR: [-20, 0, 20], elR: [0, 0, 40] } };
const stomp: PoseDef = { y: 0.04, j: { thR: [-8, 12, 64], knR: [0, 0, -80], ftR: [0, 0, 10], spine: [0, 0, -8], chest: [0, -10, -6], shL: [40, 0, 40], elL: [0, 0, 130], shR: [-40, 0, 40], elR: [0, 0, 130] } };
const stompDown: PoseDef = { y: -0.02, j: { thR: [-8, 12, 50], knR: [0, 0, -40], ftR: [0, 0, -10], spine: [0, 0, -12], chest: [0, -10, -8], shL: [40, 0, 40], elL: [0, 0, 130], shR: [-40, 0, 40], elR: [0, 0, 130] } };
const flex: PoseDef = { j: { shL: [60, 0, 90], elL: [0, 0, 130], shR: [-60, 0, 90], elR: [0, 0, 130], chest: [0, 0, 8], head: [0, -10, 14] } };

const BON_ATK = new Clip(
  [
    { f: 0, p: {} },
    { f: 10, p: neckRoll, e: 'inOut' },
    { f: 18, p: compose(neckRoll, { j: { head: [0, 24, -18], neck: [0, 10, -10] } }) },
    { f: 24, p: B.grin },
    { f: 30, p: compose(sampleDef(bM.bon_LLH, 7), { x: 0.1 }), e: 'inOut' },
    { f: 38, p: compose(sampleDef(bM.bon_LLH, 10), { x: 0.14 }), e: 'snap' },
    { f: 46, p: compose(sampleDef(bM.bon_LLH, 16), { x: 0.1 }) },
    { f: 54, p: compose(B.straight, { x: 0.12 }), e: 'snap' },
    { f: 60, p: { x: 0.05 } },
    { f: 68, p: compose(bR.crouch, { y: -0.2, j: { shL: [30, 0, 140], shR: [-30, 0, 140] } }), e: 'out' },
    { f: 76, p: compose(bR.crouch, { y: -0.42, s: { sq: 0.15 }, j: { shL: [30, 0, -30], elL: [0, 0, 20], shR: [-30, 0, -30], elR: [0, 0, 20] } }), e: 'snap' },
    { f: 92, p: compose(B.grin, { x: -0.05 }), e: 'out' },
    { f: 130, p: compose(B.grin, { x: -0.05, j: { head: [0, -16, 12] } }) },
    { f: 150, p: { x: 0.4 } },
    { f: 168, p: compose(stomp, { x: 0.75 }), e: 'inOut' },
    { f: 176, p: compose(stompDown, { x: 0.8 }), e: 'snap' },
    { f: 200, p: compose(stompDown, { x: 0.8, j: { shL: [60, 0, 100], elL: [0, 0, 130], shR: [-60, 0, 100], elR: [0, 0, 130] } }) },
    { f: 212, p: compose(stompDown, compose(B.grin, { x: 0.8 })), e: 'inOut' },
    { f: 240, p: compose(flex, { x: 0.8 }), e: 'out' },
    { f: 300, p: compose(flex, { x: 0.8, j: { head: [0, -18, 16] } }) },
  ],
  BONEZ_ANIMS.stance,
);

function bonVictim(set: AnimSet): Clip {
  const r = reactions(set.stance, set.pivot ?? 0.9);
  return new Clip(
    [
      ...dizzyKeys(r, 32),
      { f: 38, p: compose(r.hitHigh, { x: -0.08, j: { head: [0, 0, 40], neck: [0, 0, 20] } }), e: 'snap' },
      { f: 48, p: compose(r.hitHigh, { x: -0.1 }) },
      { f: 54, p: compose(r.hitHigh, { x: -0.2, rot: -8 }), e: 'snap' },
      { f: 76, p: compose(r.hitHigh, { x: -0.26, rot: -4 }) },
      // the croc bursts up under them: lifted in the jaws, the jaws snap shut, death roll
      { f: 82, p: compose(r.juggle, { x: -0.25, y: 1.0, rot: -50 }), e: 'snap' },
      { f: 96, p: compose(r.juggle, { x: -0.25, y: 1.5, rot: -90 }), e: 'out' },
      { f: 104, p: compose(r.juggle, { x: -0.25, y: 1.3, rot: -270 }), e: 'linear' },
      { f: 112, p: compose(r.juggle, { x: -0.25, y: 1.3, rot: -450 }), e: 'linear' },
      { f: 120, p: compose(r.juggle, { x: -0.25, y: 1.3, rot: -630 }), e: 'linear' },
      { f: 130, p: compose(r.juggle, { x: -0.3, y: 1.4, rot: -720 }), e: 'out' },
      // spat out, splat flat
      { f: 140, p: compose(r.juggle, { x: -0.9, y: 2.0, rot: -800 }), e: 'out' },
      { f: 152, p: pancake(r, -0.6, 0.68), e: 'in' },
      { f: 176, p: pancake(r, -0.6, 0.68) },
      { f: 180, p: pancake(r, -0.6, 0.74) },
      { f: 300, p: pancake(r, -0.6, 0.72) },
    ],
    set.stance,
  );
}

function bonProps(): CineProps {
  const group = new THREE.Group();
  const croc = makeCroc({ top: 0x2f7d3a, side: 0x47a64a, belly: 0xe6d79a });
  group.add(croc.group);
  const glow = new THREE.PointLight(0x7cff5a, 0, 7, 1.6);
  return {
    group,
    lights: [glow],
    update(f: number, c: PropCtx) {
      const show = f >= 74 && f < 152;
      croc.setOpacity(show ? ramp(f, 74, 80) * (1 - ramp(f, 142, 152)) : 0);
      glow.intensity = show ? 4 * ramp(f, 74, 84) * (1 - ramp(f, 138, 150)) : 0;
      if (!show) return;
      const up = ramp(f, 76, 90) * (1 - ramp(f, 136, 152));
      // jaws: open wide on the way up, CHOMP at 96, open again to spit at 132
      const open = f < 94 ? 62 * ramp(f, 76, 88) : f < 97 ? 62 * (1 - (f - 94) / 3) : f < 130 ? 0 : 50 * ramp(f, 130, 134);
      croc.setOpen(open);
      const roll = f >= 100 && f < 128 ? ((f - 100) / 28) * Math.PI * 2 * 2 : 0;
      const [dx] = c.defLocal;
      croc.group.position.set(dx + 0.05, lerp(-3.2, 0.2, up), -0.15);
      croc.group.rotation.set(roll, Math.PI, Math.PI / 2 - 0.25);
      croc.group.scale.setScalar(2.6);
      glow.position.copy(c.world(dx, 1.4, 1.2));
    },
  };
}

export const FATAL_BONEZ: CineDef = {
  frames: FATALITY_FRAMES,
  startDx: 1.1,
  teeth: [
    [20, 32],
    [205, 300],
  ],
  camera: [
    { f: 0, pos: [1.0, 1.9, 2.3], target: [0.05, 1.78, 0], fov: 30 },
    { f: 28, pos: [0.95, 1.88, 2.5], target: [0.08, 1.75, 0], fov: 30 },
    { f: 30, pos: [0.6, 1.3, 4.6], target: [0.6, 1.35, 0], fov: 40, cut: true },
    { f: 66, pos: [0.7, 1.3, 4.4], target: [0.6, 1.3, 0], fov: 40 },
    { f: 68, pos: [-0.6, 0.5, 3.6], target: [0.9, 1.5, 0], fov: 50, cut: true },
    { f: 96, pos: [-0.4, 0.7, 4.0], target: [0.9, 1.6, 0], fov: 50 },
    { f: 98, pos: [1.0, 1.6, 5.8], target: [0.9, 1.3, 0], fov: 44, cut: true },
    { f: 150, pos: [0.6, 1.4, 6.0], target: [0.5, 0.8, 0], fov: 42 },
    { f: 176, pos: [1.6, 1.0, 3.6], target: [0.6, 0.5, 0], fov: 38, cut: true },
    { f: 210, pos: [1.4, 1.1, 3.4], target: [0.6, 0.6, 0], fov: 38 },
    { f: 212, pos: [1.5, 1.85, 2.6], target: [0.85, 1.65, 0], fov: 32, cut: true },
    { f: 300, pos: [1.6, 1.9, 3.0], target: [0.85, 1.6, 0], fov: 34 },
  ],
  atk: BON_ATK,
  def: bonVictim,
  props: bonProps,
  dim: (f) => (f < 150 ? 0.6 : 0.45),
  fx: [
    { f: 1, run: (c) => (c.audio.riser(), c.view.arena.pulse(0.6)) },
    { f: 38, run: (c) => (hitFx(c, 3, 0xffffff, 0.75), c.view.toon.impactFrame(0.05)) },
    { f: 54, run: (c) => hitFx(c, 2, 0xffd36b, 0.6) },
    {
      f: 76,
      run: (c) => {
        const x = c.def.x;
        c.audio.bassDrop();
        c.view.toon.crack(x, 2.4);
        c.view.toon.rubble(x, 0, 16, 5);
        c.view.vfx.dust(x, 0, 18, 2);
        c.view.director.shake(0.9);
      },
    },
    { f: 88, run: (c) => c.audio.snap() },
    {
      f: 96,
      run: (c) => {
        c.audio.snap();
        c.audio.boom();
        hitFx(c, 3, 0x7cff5a, 0.9);
        c.view.toon.impactFrame(0.08);
        c.view.director.punch(5);
        c.view.screenFlash = 1;
        c.audio.crowdSwell(0.8);
      },
    },
    ...[104, 112, 120].map((f) => ({ f, run: (c: FxCtx) => (c.audio.whoosh(2), c.view.director.shake(0.5), c.view.vfx.dust(c.def.x, 0.4, 8, 1.2)) })),
    { f: 132, run: (c) => (c.audio.snap(), c.audio.whoosh(3)) },
    {
      f: 152,
      run: (c) => {
        const x = c.atk.x + c.facing * 0.5;
        c.audio.slam();
        c.view.vfx.ring(x, 0.05, 2.6, C(0x7cff5a), 0.45, true);
        c.view.toon.puff(x, 0, 10, 1.6, new THREE.Color(0xe9dfd0), 0.28, 0.8);
        c.view.director.shake(0.8);
      },
    },
    { f: 168, run: (c) => (c.audio.crowdSwell(0.7), c.view.vfx.confetti(c.def.x, 3.5, 60)) },
    { f: 176, run: (c) => (c.audio.slam(), c.view.director.shake(0.5), c.view.vfx.dust(c.def.x, 0.05, 10, 1)) },
    { f: 205, run: (c) => c.view.vfx.sparks(c.atk.x + c.facing * 0.85, 1.78, 14, C(0xffd65a), 4, c.facing, 2) },
  ],
};

export const FATALITIES: Record<string, CineDef> = { fatal_jazeek: FATAL_JAZEEK, fatal_bonez: FATAL_BONEZ };
