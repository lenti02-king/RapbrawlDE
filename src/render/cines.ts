// Signature cinematics for the real roster: Jazeek "Herzbrecher" and Bonez MC
// "Palmen-Bassdrop". Timings match the sim's CinematicDef hit frames
// (src/content/jazeek.ts, src/content/bonez.ts); everything here is presentation.
import * as THREE from 'three';
import { BONEZ_ANIMS, BONEZ_POSES } from './anims/bonez';
import { JAZEEK_ANIMS, JAZEEK_POSES } from './anims/jazeek';
import { reactions } from './anims/stances';
import type { AnimSet } from './anims/types';
import type { CineDef, CineProps, FxCtx, PropCtx } from './cinematics';
import { compose, EASE, sampleDef, smoothClip, type Clip, type PoseDef } from './pose';
import { heartGeometry, heartMaterial, makeCroc, makeCrocRunner, makePalm, makeSplitHeart, makeSpotlight, makeSunset } from './props';
import { makeTunerCar } from './specials';
import { crocAsHead, crocRunnerModel, palmModel, splitHeartModel, tunerCarModel } from './propModels';
import { HandProp } from './handProps';

const C = (h: number) => new THREE.Color(h);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const ramp = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Overshooting pop-in 0..1. */
const pop = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

export function victimReactions(set: AnimSet) {
  return reactions(set.stance, set.pivot ?? 0.9);
}

export function hitFx(c: FxCtx, strength: number, color = 0xffd36b): void {
  const p = c.def.clone().add(new THREE.Vector3(0, 0.45, 0.25));
  c.view.vfx.sparks(p.x, p.y, 14 + strength * 6, C(color), 8 + strength, -c.facing);
  c.view.vfx.flash(p.x, p.y, 0.55 + strength * 0.15, C(0xfff4c2), 0.08);
  c.view.toon.impact(p.x, p.y, 0.8 + strength * 0.25, C(color), { spikes: 9 + strength * 2, life: 0.2 + strength * 0.04 });
  if (strength >= 2) c.view.toon.speedLines(p.x, p.y, C(0xffffff), 0.25, 0.55);
  c.view.director.shake(0.18 + strength * 0.08);
}

// =================================================================== JAZEEK — HERZBRECHER
const J = JAZEEK_POSES;
const jStance = JAZEEK_ANIMS.stance;

const kissHand: PoseDef = { j: { shR: [-30, 0, 128], elR: [0, 0, 150], haR: [0, 0, -20], head: [0, 0, 6], shL: [20, 0, 30], elL: [0, 0, 40] } };
const kissBlow: PoseDef = { x: 0.04, j: { shR: [-8, 0, 92], elR: [0, 0, 6], haR: [0, 0, -40], head: [0, 0, -4], shL: [20, 0, 30], elL: [0, 0, 40] } };
const palmStrike = compose(J.cross, { j: { shL: [6, 0, 92], elL: [0, 0, 4], haL: [0, 0, -50], haR: [0, 0, -50] } });

const HEART_ATK = smoothClip(
  [
    { f: 0, p: J.sing },
    { f: 10, p: compose(J.sing, { j: { shL: [20, 0, 150], elL: [0, 0, 10], haL: [0, 0, -30], head: [0, -10, 24], chest: [0, -24, 14] } }) },
    { f: 22, p: compose(J.sing, { j: { shL: [20, 0, 158], elL: [0, 0, 6], head: [0, -10, 26], chest: [0, -24, 16] } }) },
    { f: 28, p: compose(J.sing, { x: 0.02, j: { shL: [6, 0, 96], elL: [0, 0, 4], haL: [0, 0, -14], head: [0, -4, 8], hips: [0, -30, 4] } }), e: 'snap' },
    { f: 36, p: compose(J.sing, { x: 0.04, j: { shL: [6, 0, 92], elL: [0, 0, 8], hips: [0, -14, -4], spine: [0, -2, 12] } }) },
    { f: 44, p: compose(J.sing, { x: 0.02, j: { shL: [6, 0, 98], elL: [0, 0, 6], hips: [0, -34, 6], spine: [0, -10, 4] } }) },
    { f: 50, p: kissHand },
    { f: 56, p: kissBlow, e: 'snap' },
    { f: 62, p: compose(kissBlow, { j: { elR: [0, 0, 12] } }) },
    { f: 66, p: { x: 0.18, y: -0.08, j: { spine: [0, 0, -14], chest: [0, -20, -6] } } },
    { f: 70, p: compose(J.jab, { x: 0.25 }), e: 'snap' },
    { f: 74, p: { x: 0.25 } },
    { f: 78, p: compose(J.cross, { x: 0.3 }), e: 'snap' },
    { f: 82, p: { x: 0.28 } },
    { f: 86, p: compose(J.hookL, { x: 0.32 }), e: 'snap' },
    { f: 91, p: { x: 0.28, y: -0.06, j: { spine: [0, 0, -10], thR: [-8, 18, 20], knR: [0, 0, -50] } } },
    { f: 96, p: compose(J.kickHigh, { x: 0.3 }), e: 'snap' },
    { f: 102, p: compose(J.kickHigh, { x: 0.3 }) },
    { f: 106, p: { x: 0.3, j: { shL: [40, 0, 70], elL: [0, 0, 20], shR: [-40, 0, 70], elR: [0, 0, 20] } } },
    { f: 116, p: { x: 0.34, yaw: -360, j: { shL: [60, 0, 80], elL: [0, 0, 10], shR: [-60, 0, 80], elR: [0, 0, 10] } }, e: 'in' },
    { f: 120, p: compose(palmStrike, { x: 0.45, yaw: -360 }), e: 'snap' },
    { f: 130, p: compose(palmStrike, { x: 0.45, yaw: -360 }) },
    { f: 140, p: compose(J.sing, { x: 0.2, yaw: -360, j: { shL: [20, 0, 160], elL: [0, 0, 6], head: [0, -10, 24] } }) },
    { f: 150, p: compose(J.sing, { x: 0.0, yaw: -360, j: { shL: [20, 0, 165], elL: [0, 0, 4], head: [0, -10, 26] } }) },
  ],
  jStance,
);

function heartDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const st = set.stance;
  const dazed = compose(st, {
    j: { spine: [0, 0, 6], chest: [0, 0, 4], neck: [0, 0, -6], head: [0, 14, -14], shL: [10, 0, 14], elL: [0, 0, 24], shR: [-10, 0, 14], elR: [0, 0, 24] },
  });
  const swoon = compose(dazed, { x: 0.04, j: { head: [0, 0, -18], shL: [10, 0, 40], elL: [0, 0, 110], shR: [-10, 0, 40], elR: [0, 0, 110] } });
  const endX = -(2.1 - 0.9) + 0.05;
  return smoothClip(
    [
      { f: 0, p: r.hitHigh },
      { f: 8, p: compose(r.hitHigh, { x: -0.04 }) },
      { f: 16, p: compose(dazed, { x: -0.04, yaw: 8 }) },
      { f: 28, p: compose(dazed, { x: -0.02, yaw: -6, j: { head: [0, -14, -10] } }) },
      { f: 40, p: compose(dazed, { x: 0.0, yaw: 6 }) },
      { f: 50, p: swoon },
      { f: 62, p: compose(swoon, { j: { head: [0, 0, -20], elL: [0, 0, 114], elR: [0, 0, 114] } }) },
      { f: 70, p: compose(r.hitHigh, { x: -0.02 }), e: 'snap' },
      { f: 74, p: compose(r.hitHigh, { x: -0.04 }) },
      { f: 78, p: compose(r.hitHigh, { x: -0.08, j: { head: [0, -30, 24] } }), e: 'snap' },
      { f: 82, p: compose(r.hitGut, { x: -0.1 }) },
      { f: 86, p: compose(r.hitHigh, { x: -0.12, j: { head: [0, 36, 26] } }), e: 'snap' },
      { f: 91, p: compose(r.hitGut, { x: -0.14 }) },
      { f: 96, p: compose(r.juggle, { x: -0.2, y: 0.3, rot: 20 }), e: 'snap' },
      { f: 106, p: compose(r.juggle, { x: -0.22, y: 0.62, rot: 34 }), e: 'out' },
      { f: 118, p: compose(r.juggle, { x: -0.24, y: 0.6, rot: 40 }) },
      { f: 120, p: compose(r.juggle, { x: -0.4, y: 0.75, rot: 70 }), e: 'snap' },
      { f: 132, p: compose(r.juggle, { x: -0.95, y: 0.7, rot: 200 }), e: 'out' },
      { f: 140, p: compose(r.lying, { x: endX, rot: 450 }), e: 'in' },
      { f: 150, p: compose(r.lying, { x: endX, rot: 450 }) },
    ],
    st,
  );
}

function heartProps(): CineProps {
  const group = new THREE.Group();
  const spotA = makeSpotlight(0xfff0d0);
  const spotB = makeSpotlight(0xff7fc8);
  group.add(spotA.group, spotB.group);
  const big = splitHeartModel() ?? makeSplitHeart();
  group.add(big.group);
  const orbit = [0, 1, 2].map((i) => new THREE.Mesh(heartGeometry(), heartMaterial(i ? 0xff6fae : 0xff3d7f)));
  for (const m of orbit) group.add(m);
  const key = new THREE.SpotLight(0xfff0d0, 0, 16, 0.36, 0.55, 0);
  let last = -1;
  return {
    group,
    lights: [key],
    update(f: number, c: PropCtx) {
      const fi = Math.floor(f);
      const fresh = fi !== last;
      if (fi < last) last = -1;
      const [ax] = c.atkLocal;
      const [dx, dy] = c.defLocal;
      // spotlights
      spotA.setIntensity(f < 64 ? ramp(f, 0, 5) : f < 136 ? lerp(1, 0.35, ramp(f, 64, 72)) : lerp(0.35, 1, ramp(f, 136, 146)));
      spotA.group.position.set(ax, 0, 0);
      const keyI = f < 64 ? ramp(f, 0, 5) : f < 136 ? lerp(1, 0.4, ramp(f, 64, 72)) : lerp(0.4, 1, ramp(f, 136, 146));
      key.intensity = keyI * 6;
      key.position.copy(c.world(ax + 0.3, 6.5, 2.4));
      key.target.position.copy(c.world(ax, 1.0, 0));
      spotB.setIntensity(ramp(f, 22, 30) * (1 - ramp(f, 62, 70)));
      spotB.group.position.set(dx, 0, 0);
      // notes + heart stream
      if (fresh) {
        for (let k = last + 1; k <= fi; k++) {
          if (k >= 4 && k <= 44 && k % 3 === 0) {
            const p = c.world(ax + 0.15, 1.62, 0.2);
            c.view.fx.noteBurst(p.x, p.y, 1, c.facing, 1.4);
          }
          if (k >= 24 && k <= 46 && k % 2 === 0) {
            const p = c.world(ax + 0.2, 1.55, 0.25);
            c.view.fx.hearts.spawn(p, new THREE.Vector3(c.facing * (1.3 + Math.random() * 0.5), 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4), 0.06 + Math.random() * 0.04, 0.6);
          }
        }
        last = fi;
      }
      // hearts circling the victim's head
      const orbitOn = f >= 30 && f < 66;
      orbit.forEach((m, i) => {
        m.visible = orbitOn;
        if (!orbitOn) return;
        const a = c.time * 4 + (i * Math.PI * 2) / 3;
        m.position.set(dx + Math.cos(a) * 0.32, 1.92 + dy + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.32);
        m.scale.setScalar(0.08 * pop(ramp(f, 30 + i * 2, 38 + i * 2)) * (1 - ramp(f, 62, 66)));
        m.rotation.y = a;
      });
      // big heart: forms, beats, cracks with each hit, breaks on the finisher
      big.group.visible = f >= 48 && f < 144;
      if (!big.group.visible) return;
      let pos = new THREE.Vector3(0.45, 2.05, 0.1);
      let scale = 0.3 * pop(ramp(f, 48, 56));
      if (f >= 56 && f < 64) scale *= 1 + 0.08 * Math.sin((f - 56) * 1.6);
      if (f >= 64) {
        const t = ramp(f, 64, 72);
        pos = new THREE.Vector3(lerp(0.45, dx + 0.05, t), lerp(2.05, 2.4, t), lerp(0.1, 0.1, t));
        scale = lerp(0.3, 0.26, t);
      }
      if (f >= 100) {
        const t = ramp(f, 100, 112);
        pos = new THREE.Vector3(lerp(dx + 0.05, dx - 0.1, t), lerp(2.4, 1.85 + dy * 0.5, t), lerp(0.1, 0.25, t));
        scale = lerp(0.26, 0.3, t);
      }
      let gap = 0;
      for (const h of [70, 78, 86, 96]) if (f >= h) gap += 0.015;
      const sinceHit = Math.min(...[70, 78, 86, 96].map((h) => (f >= h ? f - h : 99)));
      const jitter = sinceHit < 6 ? Math.sin(f * 7) * 0.12 * (1 - sinceHit / 6) : 0;
      big.group.position.copy(pos);
      big.group.scale.setScalar(Math.max(0.001, scale));
      big.group.rotation.set(0, f >= 100 && f < 120 ? Math.sin(f * 0.25) * 0.4 : 0, jitter);
      if (f < 120) {
        big.left.position.set(-gap, 0, 0);
        big.right.position.set(gap, 0, 0);
        big.left.rotation.set(0, 0, 0);
        big.right.rotation.set(0, 0, 0);
        big.mat.opacity = 1;
      } else {
        const t = (f - 120) / 20;
        big.left.position.set(-gap - 1.6 * t, 1.2 * t - 3.2 * t * t, 0.3 * t);
        big.right.position.set(gap + 1.6 * t, 0.9 * t - 3.2 * t * t, 0.2 * t);
        big.left.rotation.set(0, 0, 1.4 * t);
        big.right.rotation.set(0, 0, -1.6 * t);
        big.mat.opacity = 1 - ramp(f, 128, 142);
      }
      big.mat.emissiveIntensity = 0.35 + (f >= 100 && f < 120 ? 0.4 * ramp(f, 100, 118) : 0);
    },
  };
}

export const HERZBRECHER: CineDef = {
  frames: 150,
  startDx: 0.9,
  camera: [
    { f: 0, pos: [0.9, 1.25, 2.4], target: [0.0, 1.5, 0], fov: 30 },
    { f: 22, pos: [0.7, 1.35, 2.0], target: [0.0, 1.55, 0], fov: 28 },
    { f: 24, pos: [-1.25, 1.65, 1.9], target: [0.95, 1.4, 0], fov: 34, cut: true },
    { f: 46, pos: [-1.0, 1.55, 2.3], target: [0.95, 1.4, 0], fov: 34 },
    { f: 48, pos: [0.45, 1.5, 4.0], target: [0.45, 1.45, 0], fov: 36, cut: true },
    { f: 62, pos: [0.45, 1.45, 3.6], target: [0.45, 1.45, 0], fov: 36 },
    { f: 64, pos: [0.5, 0.95, 3.1], target: [0.65, 1.3, 0], fov: 42, cut: true },
    { f: 100, pos: [0.8, 1.05, 3.4], target: [0.9, 1.45, 0], fov: 42 },
    { f: 104, pos: [1.6, 1.55, 2.8], target: [0.9, 1.55, 0], fov: 34, cut: true },
    { f: 119, pos: [1.5, 1.5, 2.5], target: [0.9, 1.5, 0], fov: 32 },
    { f: 120, pos: [1.2, 1.5, 4.8], target: [1.2, 1.3, 0], fov: 40, cut: true },
    { f: 136, pos: [1.0, 1.45, 5.6], target: [1.0, 1.1, 0], fov: 38 },
    { f: 150, pos: [0.9, 1.4, 6.6], target: [0.9, 1.0, 0], fov: 32 },
  ],
  atk: HEART_ATK,
  def: heartDef,
  props: heartProps,
  dim: (f) => (f < 64 ? 0.85 : f < 136 ? 0.5 : 0.75),
  fx: [
    {
      f: 1,
      run: (c) => {
        c.view.arena.pulse(1);
        c.audio.crowdSwell(0.4);
      },
    },
    { f: 4, run: (c) => c.audio.sing([0, 4, 7, 12, 11, 7], 0.17, 330) },
    { f: 24, run: (c) => c.audio.crowdSwell(0.45) },
    {
      f: 48,
      run: (c) => {
        c.audio.chime();
        c.view.vfx.flash(c.atk.x + c.facing * 0.45, 1.55, 1.4, C(0xff6fae), 0.2);
      },
    },
    { f: 56, run: (c) => c.audio.sing([16], 0.25, 330) },
    ...[70, 78, 86].map((f) => ({ f, run: (c: FxCtx) => hitFx(c, 1, 0xff8fc8) })),
    {
      f: 96,
      run: (c) => {
        hitFx(c, 2, 0xff6fae);
        c.view.vfx.ring(c.def.x, c.def.y + 0.5, 1.1, C(0xff6fae), 0.25);
      },
    },
    { f: 104, run: (c) => c.audio.riser() },
    {
      f: 120,
      run: (c) => {
        const x = c.def.x;
        const y = c.def.y + 0.5;
        c.view.vfx.ring(x, y, 2.6, C(0xffffff), 0.45);
        c.view.vfx.ring(x, y, 1.8, C(0xff3d7f), 0.4);
        c.view.vfx.sparks(x, y, 70, C(0xff6fae), 14, -c.facing, 2);
        c.view.fx.heartBurst(x, y, 12, 2.2);
        c.view.toon.impactFrame(0.07);
        c.view.after(0.07, () => {
          c.view.toon.impact(x, y, 2.2, C(0xff6fae), { spikes: 14, life: 0.45, core: C(0xffe4f0) });
          c.view.toon.speedLines(x, y, C(0xffe0ee), 0.6, 0.4);
        });
        c.view.director.shake(1);
        c.view.director.punch(5);
        c.view.director.kick(-c.facing * 0.2, 0, -0.2);
        c.view.arena.pulse(1);
        c.view.screenFlash = 1;
        c.audio.crowdSwell(0.6);
      },
    },
    {
      f: 140,
      run: (c) => {
        c.view.vfx.dust(c.def.x, 0, 24, 1.4);
        c.view.fx.heartBurst(c.atk.x, 2.0, 6, 1.4);
        c.view.fx.noteBurst(c.atk.x, 1.8, 6, c.facing, 1.6);
        c.audio.sing([12, 16, 19], 0.12, 330);
      },
    },
  ],
};

// =================================================================== BONEZ — PALMEN-BASSDROP
const B = BONEZ_POSES;
const bStance = BONEZ_ANIMS.stance;
const bR = reactions(bStance, BONEZ_ANIMS.pivot ?? 0.88);
const slam = sampleDef(BONEZ_ANIMS.moves.bon_palm, 20);
const upper = sampleDef(BONEZ_ANIMS.moves.bon_2H, 11);
const airLegs: PoseDef['j'] = { thL: [12, 14, 60], knL: [0, 0, -80], thR: [-12, 12, 30], knR: [0, 0, -90] };
const hammerLand: PoseDef = {
  y: -0.3,
  j: {
    spine: [0, 0, -46],
    chest: [0, 0, -16],
    head: [0, 0, -6],
    shL: [10, 0, 60],
    elL: [0, 0, 4],
    shR: [-10, 0, 60],
    elR: [0, 0, 4],
    thL: [12, 14, 80],
    knL: [0, 0, -110],
    thR: [-12, 12, 20],
    knR: [0, 0, -100],
  },
};

const PALM_ATK = smoothClip(
  [
    { f: 0, p: slam },
    { f: 24, p: compose(slam, { j: { head: [0, 0, 16] } }) },
    { f: 30, p: compose(slam, { y: (slam.y ?? 0) + 0.04, j: { head: [0, 0, 22] } }), e: 'snap' },
    { f: 40, p: bR.crouch },
    { f: 48, p: compose(B.grin, { x: 0.05 }) },
    { f: 62, p: compose(B.grin, { x: 0.1, j: { head: [0, -16, 14] } }) },
    { f: 68, p: { x: 0.25, y: -0.12, j: { spine: [0, 0, -10], chest: [0, -30, -6], shR: [-14, 0, -24], elR: [0, 0, 70] } } },
    { f: 74, p: compose(upper, { x: 0.35 }), e: 'snap' },
    { f: 82, p: compose(upper, { x: 0.35 }) },
    { f: 88, p: compose(bR.crouch, { x: 0.4, y: -0.42 }) },
    {
      f: 98,
      p: { x: 0.55, y: 1.5, j: { spine: [0, 0, 14], chest: [0, 0, 10], head: [0, 0, -6], shL: [10, 0, 176], elL: [0, 0, 20], shR: [-10, 0, 176], elR: [0, 0, 20], ...airLegs } },
      e: 'out',
    },
    { f: 110, p: { x: 0.65, y: 1.75, j: { spine: [0, 0, 18], chest: [0, 0, 14], shL: [10, 0, 182], elL: [0, 0, 30], shR: [-10, 0, 182], elR: [0, 0, 30], ...airLegs } } },
    { f: 118, p: compose(hammerLand, { x: 0.75 }), e: 'in' },
    { f: 134, p: compose(hammerLand, { x: 0.75, y: -0.28 }) },
    { f: 144, p: compose(B.grin, { x: 0.45, y: 0.14 }) },
    { f: 152, p: compose(B.grin, { x: 0.1 }) },
    { f: 160, p: compose(B.grin, { x: 0 }) },
  ],
  bStance,
);

function palmDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const endX = -(2.3 - 1.0) + 0.05;
  // helpless levitation on the bass: arms out, legs dangling
  const float = compose(r.juggle, {
    j: {
      spine: [0, 0, 10],
      chest: [0, 0, 8],
      head: [0, 0, 14],
      shL: [70, 0, 50],
      elL: [0, 0, 30],
      shR: [-70, 0, 40],
      elR: [0, 0, 36],
      thL: [8, 0, 18],
      knL: [0, 0, -34],
      thR: [-8, 0, 4],
      knR: [0, 0, -20],
      ftL: [0, 0, -30],
      ftR: [0, 0, -24],
    },
  });
  return smoothClip(
    [
      { f: 0, p: r.hitLow },
      { f: 12, p: compose(r.hitLow, { x: -0.02 }) },
      { f: 26, p: compose(r.hitLow, { x: -0.03, y: -0.05 }) },
      { f: 30, p: compose(float, { x: -0.05, y: 0.45, rot: 8 }), e: 'snap' },
      { f: 44, p: compose(float, { x: -0.05, y: 0.95, rot: 14, j: { shL: [80, 0, 70], shR: [-80, 0, 60] } }), e: 'out' },
      { f: 58, p: compose(float, { x: -0.05, y: 1.05, rot: 4 }) },
      { f: 70, p: compose(float, { x: -0.05, y: 0.95, rot: 12, j: { shL: [80, 0, 70], shR: [-80, 0, 60] } }) },
      { f: 74, p: compose(r.juggle, { x: -0.1, y: 1.25, rot: 40 }), e: 'snap' },
      { f: 96, p: compose(r.juggle, { x: -0.2, y: 2.4, rot: 150 }), e: 'out' },
      { f: 112, p: compose(r.juggle, { x: -0.2, y: 2.3, rot: 200 }) },
      { f: 118, p: compose(r.lying, { x: -0.15, rot: 450 }), e: 'in' },
      { f: 126, p: compose(r.juggle, { x: -0.6, y: 0.7, rot: 560 }), e: 'out' },
      { f: 138, p: compose(r.lying, { x: endX, rot: 810 }), e: 'in' },
      { f: 160, p: compose(r.lying, { x: endX, rot: 810 }) },
    ],
    set.stance,
  );
}

function palmProps(): CineProps {
  const group = new THREE.Group();
  const sunset = makeSunset(7.5);
  group.add(sunset);
  const palmSpots: [number, number, number, number][] = [
    [-2.5, -2.6, 4.6, 0.5],
    [-1.3, -3.6, 5.4, -0.35],
    [2.7, -2.8, 4.9, -0.55],
    [3.7, -3.8, 5.6, 0.4],
    [-3.7, -4.3, 5.0, 0.45],
    [1.3, -4.6, 5.8, 0.3],
  ];
  const palms = palmSpots.map(([x, z, h, lean], i) => {
    const p = palmModel(h, lean) ?? makePalm(h, lean, i % 2 ? 0x2a1540 : 0x341a4a);
    p.position.set(x, 0, z);
    group.add(p);
    return p;
  });
  const croc = crocAsHead(1) ?? makeCroc({ top: 0x2f7d3a, side: 0x47a64a, belly: 0xe6d79a });
  group.add(croc.group);
  const sun = new THREE.SpotLight(0xff9a4a, 0, 20, 0.75, 0.8, 0);
  return {
    group,
    lights: [sun],
    update(f: number, c: PropCtx) {
      const out = ramp(f, 148, 160);
      const rise = ramp(f, 0, 26) * (1 - out);
      sun.intensity = rise * 5;
      sun.position.copy(c.world(0.6, 5.5, -4.5));
      sun.target.position.copy(c.world(0.6, 1.2, 0.5));
      sunset.position.set(0.6, lerp(-2.4, 2.4, rise), -6.5);
      (sunset.material as THREE.MeshBasicMaterial).opacity = rise;
      palms.forEach((p, i) => {
        const r = ramp(f, 2 + i * 2.5, 20 + i * 2.5) * (1 - out);
        p.position.y = lerp(-7, 0, r);
        const impact = f >= 118 ? Math.exp(-(f - 118) / 10) * Math.sin((f - 118) * 0.9) * 0.08 : 0;
        p.rotation.z = Math.sin(c.time * 1.4 + i) * 0.03 + impact;
        const crown = p.userData.crown as THREE.Object3D;
        crown.rotation.y = Math.sin(c.time * 0.8 + i * 2) * 0.2;
      });
      // crocodile silhouette bursts up behind the impact and snaps shut on the slam
      const [dx] = c.defLocal;
      const show = f >= 100 && f < 152;
      croc.setOpacity(show ? ramp(f, 100, 106) * (1 - ramp(f, 140, 150)) : 0);
      if (!show) return;
      const up = ramp(f, 100, 112) * (1 - ramp(f, 136, 152));
      const open = f < 117 ? 58 * ramp(f, 102, 114) : f < 119 ? 58 * (1 - (f - 117) / 2) : 0;
      croc.setOpen(open);
      const shake = f >= 119 && f < 132 ? Math.sin(f * 2.5) * 0.06 * (1 - (f - 119) / 13) : 0;
      croc.group.position.set(dx - 0.2 + shake, lerp(-3.0, -0.2, up), -1.1);
      croc.group.rotation.set(0, 0.6, 1.15);
      croc.group.scale.setScalar(2.3);
    },
  };
}

export const PALMEN_BASSDROP: CineDef = {
  frames: 160,
  startDx: 1.0,
  teeth: [
    [44, 66],
    [140, 160],
  ],
  camera: [
    { f: 0, pos: [0.5, 0.35, 3.8], target: [0.5, 1.4, 0], fov: 46 },
    { f: 28, pos: [0.5, 0.5, 4.4], target: [0.6, 1.7, 0], fov: 46 },
    { f: 30, pos: [1.9, 1.1, 5.0], target: [0.6, 1.5, 0], fov: 40, cut: true },
    { f: 42, pos: [1.8, 1.15, 4.6], target: [0.65, 1.6, 0], fov: 40 },
    { f: 44, pos: [0.8, 1.72, 1.35], target: [0.0, 1.78, 0], fov: 28, cut: true },
    { f: 62, pos: [0.72, 1.74, 1.2], target: [0.05, 1.8, 0], fov: 26 },
    { f: 64, pos: [0.6, 1.3, 4.8], target: [0.7, 1.6, 0], fov: 42, cut: true },
    { f: 84, pos: [0.7, 1.6, 5.6], target: [0.8, 2.2, 0], fov: 44 },
    { f: 86, pos: [-0.7, 0.4, 3.4], target: [0.7, 2.3, 0], fov: 50, cut: true },
    { f: 112, pos: [-0.5, 0.5, 3.8], target: [0.8, 1.9, 0], fov: 50 },
    { f: 114, pos: [0.9, 1.7, 6.6], target: [0.9, 1.3, 0], fov: 44, cut: true },
    { f: 140, pos: [0.6, 1.5, 6.6], target: [0.4, 1.1, 0], fov: 38 },
    { f: 160, pos: [0.9, 1.4, 6.8], target: [0.9, 1.0, 0], fov: 32 },
  ],
  atk: PALM_ATK,
  def: palmDef,
  props: palmProps,
  dim: (f) => (f < 150 ? 0.6 : 0.4),
  fx: [
    {
      f: 1,
      run: (c) => {
        c.view.arena.pulse(0.8);
        c.audio.crowdSwell(0.3);
        c.view.vfx.ring(c.atk.x + c.facing * 0.3, 0.02, 2.2, C(0xffa23a), 0.4, true);
      },
    },
    { f: 8, run: (c) => c.audio.riser() },
    ...[30, 74, 118].map((f, i) => ({
      f,
      run: (c: FxCtx) => {
        const x = c.def.x;
        c.audio.bassDrop();
        c.view.vfx.ring(x, 0.03, 2.2 + i * 0.8, C(0xffa23a), 0.4 + i * 0.1, true);
        c.view.vfx.ring(x, 0.05, 1.4 + i * 0.6, C(0xff4f7b), 0.3 + i * 0.1, true);
        c.view.vfx.dust(x, 0, 6 + i * 6, 1 + i * 0.6);
        c.view.toon.puff(x, 0, 6 + i * 4, 1 + i * 0.6, new THREE.Color(0xe9dfd0), 0.26 + i * 0.05, 0.8);
        c.view.toon.crack(x, 1.4 + i * 0.5);
        c.view.toon.rubble(x, 0, 5 + i * 4, 3 + i);
        c.view.director.shake(0.35 + i * 0.3);
        c.view.arena.pulse(0.6 + i * 0.2);
        if (i < 2) hitFx(c, i + 1, 0xffa23a);
      },
    })),
    { f: 44, run: (c) => c.audio.chime() },
    { f: 104, run: (c) => c.audio.snap() },
    {
      f: 118,
      run: (c) => {
        const x = c.def.x;
        c.audio.snap();
        c.audio.boom();
        c.view.vfx.ring(x, 0.6, 2.8, C(0xffffff), 0.45);
        c.view.vfx.sparks(x, 0.4, 70, C(0xffd36b), 14, 1, 2);
        c.view.vfx.confetti(x, 3.5, 60);
        c.view.toon.impactFrame(0.07);
        c.view.after(0.07, () => {
          c.view.toon.impact(x, 0.6, 2.4, C(0xffa23a), { spikes: 14, life: 0.45 });
          c.view.toon.speedLines(x, 0.6, C(0xffffff), 0.6, 0.4);
        });
        c.view.director.shake(1);
        c.view.director.punch(5);
        c.view.director.kick(0, -0.08, -0.15);
        c.view.screenFlash = 1;
        c.audio.crowdSwell(0.6);
      },
    },
    { f: 144, run: (c) => c.view.vfx.sparks(c.atk.x + c.facing * 0.12, 1.75, 16, C(0xffd65a), 4, c.facing, 2) },
  ],
};

// =================================================================== BONEZ — KROKODIL-ATTACKE
// The little croc (projectile 'crocrun') caught the opponent: it bites the ankle, the victim goes down and is dragged
// toward Bonez in three tugs, two death rolls (hit 62), a head flick throws them up and they slam down (hit 92). Bonez
// watches with crossed arms, laughs, pumps his fist. Victim-local x is toward Bonez; startDx 2.2, endDx 3.0.
const crossed: PoseDef = { j: { chest: [0, -6, 6], shL: [10, 0, 66], elL: [0, 0, 112], shR: [-10, 0, 66], elR: [0, 0, 112], head: [0, -14, 10] } };
const pointCroc = sampleDef(BONEZ_ANIMS.moves.bon_croc, 24);
const fistUp: PoseDef = compose(B.grin, { y: 0.04, j: { shR: [-10, 0, 172], elR: [0, 0, 34], shL: [30, 0, 40], elL: [0, 0, 60], chest: [0, -10, 0] } });
const laugh = (k: number): PoseDef =>
  compose(crossed, { y: k ? -0.015 : 0.01, j: { chest: [0, -8, k ? -6 : 2], head: [0, -10, k ? 18 : 6], spine: [0, 0, k ? -4 : 2] } });

const CROC_ATK = smoothClip(
  [
    { f: 0, p: pointCroc },
    { f: 8, p: compose(pointCroc, { j: { head: [0, -4, -8] } }) },
    { f: 12, p: fistUp, e: 'snap' },
    { f: 20, p: compose(fistUp, { y: 0.02 }) },
    { f: 28, p: crossed, e: 'inOut' },
    { f: 34, p: laugh(1) },
    { f: 38, p: laugh(0) },
    { f: 42, p: laugh(1) },
    { f: 46, p: crossed },
    // the death roll: leans in and eggs it on
    { f: 52, p: { x: 0.08, y: -0.05, j: { spine: [0, 0, -10], chest: [0, -14, -4], shL: [40, 0, 40], elL: [0, 0, 70], shR: [-40, 0, 40], elR: [0, 0, 70], head: [0, -6, -4] } }, e: 'inOut' },
    { f: 64, p: { x: 0.1, y: -0.06, j: { spine: [0, 0, -12], chest: [0, -18, -6], shL: [50, 0, 60], elL: [0, 0, 50], shR: [-50, 0, 60], elR: [0, 0, 50], head: [0, -6, -6] } } },
    { f: 76, p: compose(B.grin, { x: 0.06 }), e: 'inOut' },
    { f: 80, p: laugh(1) },
    { f: 84, p: laugh(0) },
    { f: 88, p: compose(B.grin, { x: 0.04 }) },
    { f: 93, p: compose(fistUp, { x: 0.04, y: -0.02 }), e: 'snap' },
    { f: 102, p: compose(fistUp, { x: 0.02 }) },
    { f: 110, p: B.grin },
  ],
  bStance,
);

/** Victim-local distance from the hips back to the feet along x (toward Bonez) and foot height, per cinematic frame. */
function crocFoot(f: number): [number, number] {
  if (f < 10) return [0.3, 0.22];
  if (f < 16) return [lerp(0.3, 0.86, ramp(f, 10, 16)), lerp(0.22, 0.1, ramp(f, 10, 16))];
  return [0.86, 0.1];
}
const ROLL_A = 50;
const DRAG_END = 0.36;
const ROLL_B = 78;

function crocDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const endX = -(3.0 - 2.2) + 0.05;
  const drag = (x: number, k: number): PoseDef =>
    compose(r.lying, {
      x,
      j: {
        // clawing at the floor overhead
        shL: [70, 0, k ? 160 : 120],
        elL: [0, 0, k ? 20 : 60],
        shR: [-70, 0, k ? 120 : 165],
        elR: [0, 0, k ? 60 : 16],
        head: [0, 0, k ? -4 : -20],
        thL: [8, 0, 4],
        knL: [0, 0, -6],
        thR: [-8, 0, 8],
        knR: [0, 0, -10],
      },
    });
  const roll = (deg: number, k: number): PoseDef =>
    compose(drag(DRAG_END, k), { y: (r.lying.y ?? 0) + 0.05, j: { hips: [0, deg, 0] } });
  return smoothClip(
    [
      { f: 0, p: compose(r.hitLow, { x: 0.02 }) },
      { f: 5, p: compose(r.hitLow, { x: 0.04, y: -0.06, j: { spine: [0, -6, -16], head: [0, 10, -10] } }) },
      // bitten (hit 10): legs swept toward Bonez, falls backward
      { f: 10, p: compose(r.juggle, { x: 0.08, y: 0.18, rot: 40 }), e: 'snap' },
      { f: 16, p: compose(r.lying, { x: 0.05 }), e: 'in' },
      { f: 20, p: drag(0.05, 0) },
      // three tugs toward Bonez
      { f: 26, p: drag(0.17, 1), e: 'snap' },
      { f: 30, p: drag(0.17, 0) },
      { f: 35, p: drag(0.28, 1), e: 'snap' },
      { f: 39, p: drag(0.28, 0) },
      { f: 44, p: drag(DRAG_END, 1), e: 'snap' },
      { f: ROLL_A, p: roll(0, 0) },
      // two death rolls round the long axis (hit 62 halfway)
      { f: 64, p: roll(360, 1), e: 'linear' },
      { f: ROLL_B, p: roll(720, 0), e: 'linear' },
      { f: ROLL_B + 1, p: roll(0, 0), e: 'hold' },
      // the head flick: up and over
      { f: 84, p: compose(r.juggle, { x: 0.3, y: 0.6, rot: 150 }), e: 'out' },
      { f: 89, p: compose(r.juggle, { x: 0.2, y: 1.15, rot: 290 }), e: 'out' },
      // slam (hit 92) and a bounce away
      { f: 92, p: compose(r.lying, { x: 0.05, rot: 450 }), e: 'in' },
      { f: 97, p: compose(r.juggle, { x: -0.35, y: 0.4, rot: 600 }), e: 'out' },
      { f: 103, p: compose(r.lying, { x: endX, rot: 810 }), e: 'in' },
      { f: 110, p: compose(r.lying, { x: endX, rot: 810 }) },
    ],
    set.stance,
  );
}

function crocProps(): CineProps {
  const group = new THREE.Group();
  const model = crocRunnerModel();
  const croc = model ?? makeCrocRunner({ top: 0x3a8f41, side: 0x55b84a, belly: 0xf0e2a8 });
  group.add(croc.group);
  // bigger than in the fight (D42, PO: the croc was hard to make out): a clear, chunky silhouette in every shot
  const SC = model ? 1.45 : 1.6;
  const SNOUT = (model ? model.snout : 0.8) * SC; // origin -> snout tip
  croc.group.scale.setScalar(SC);
  let last = -1;
  let held: [number, number, number] = [0, 0, 0]; // snout target where the victim was released
  return {
    group,
    update(f: number, c: PropCtx) {
      const fi = Math.floor(f);
      const fresh = fi !== last;
      if (fi < last) last = -1;
      const [dx] = c.defLocal;
      const [back, fy] = crocFoot(f);
      // the snout follows the victim's feet until the release at 84
      const target: [number, number, number] = f < 84 ? [dx - back + 0.06, fy, 0] : held;
      if (f < 84) held = target;
      const vis = 1 - ramp(f, 100, 108);
      croc.setOpacity(vis);
      // yaw: straight in for the bite, body swings back into the scene while dragging, turns round to leave
      const yaw = lerp(0, 0.9, ramp(f, 14, 30));
      const turn = Math.PI * ramp(f, 93, 101);
      const phi = -yaw + turn;
      croc.group.rotation.set(0, phi, 0);
      let ox = target[0] - Math.cos(-yaw) * SNOUT;
      let oz = -Math.sin(yaw) * SNOUT;
      if (f < 9) ox -= 0.35 * (1 - ramp(f, 0, 8)); // lunge
      if (f >= 98) {
        const d = (f - 98) * 0.045; // trots off past Bonez, behind him
        ox += Math.cos(phi) * d;
        oz -= Math.sin(phi) * d;
      }
      croc.group.position.set(ox, 0, oz);
      // jaws: open for the lunge, clamp shut on the ankle, open at the release, snap at the slam
      const open = f < 7 ? 55 * ramp(f, 0, 3) : f < 9 ? 55 * (1 - (f - 7) / 2) : f < 82 ? 4 : f < 86 ? 60 * ramp(f, 82, 85) : f < 92 ? 60 * (1 - ramp(f, 89, 92)) : 4;
      croc.setOpen(open);
      // head: pitched up to the lifted foot, shaking while dragging, flick at 78-84
      const pitch = f < 12 ? 0.35 * (1 - ramp(f, 9, 14)) : f >= 78 && f < 90 ? 0.75 * ramp(f, 78, 83) * (1 - ramp(f, 85, 90)) : 0;
      const shake = f >= 16 && f < 48 ? Math.sin(f * 1.4) * 0.22 : 0;
      croc.head.group.rotation.set(0, shake, pitch);
      // body: waddles backward while dragging, rolls with the victim, trots off at the end
      const dragging = f >= 18 && f < 46;
      const leaving = f >= 96;
      croc.waddle(dragging ? -f * 0.55 : leaving ? f * 0.7 : 0, dragging ? 0.75 : leaving ? 1 : 0);
      const rollT = f < ROLL_A ? 0 : f < ROLL_B ? (f - ROLL_A) / (ROLL_B - ROLL_A) : 0;
      croc.body.rotation.x = -rollT * Math.PI * 4;
      croc.body.position.y = 0.17 + (rollT > 0 ? 0.05 : 0) + (f >= 78 && f < 86 ? 0.06 * ramp(f, 78, 82) : 0);
      // dust trail while dragging + rolling
      if (fresh) {
        for (let k = last + 1; k <= fi; k++) {
          if (k >= 20 && k < 46 && k % 3 === 0) {
            const p = c.world(dx - 0.2, 0.05, 0.1);
            c.view.vfx.dust(p.x, 0.02, 2, 0.5, C(0xd9cfb8));
          }
          if (k >= ROLL_A && k < ROLL_B && k % 4 === 0) {
            const p = c.world(dx - 0.5, 0.05, 0.1);
            c.view.toon.puff(p.x, 0, 2, 0.6, C(0xe8dccb), 0.2, 0.5);
            c.view.vfx.sparks(p.x, 0.2, 3, C(0xffffff), 3, 0, 2);
          }
          if ((k === 26 || k === 35 || k === 44) && f < 46) {
            const p = c.world(dx - 0.86, 0.12, 0.05);
            c.view.toon.blood(p.x, p.y, 4, 0);
            c.audio.snap();
          }
        }
        last = fi;
      }
    },
  };
}

export const CROC_ATTACK: CineDef = {
  frames: 110,
  startDx: 2.2,
  teeth: [
    [12, 46],
    [76, 110],
  ],
  camera: [
    // D42: three calm shots instead of six cuts. (1) low close-up on the bite
    { f: 0, pos: [1.0, 0.6, 3.0], target: [1.75, 0.45, 0], fov: 40, cut: true },
    { f: 15, pos: [0.95, 0.65, 3.3], target: [1.7, 0.45, 0], fov: 40 },
    // (2) one wide profile for the drag and the death roll: Bonez, the croc and the victim all in frame
    { f: 16, pos: [1.1, 1.05, 5.2], target: [1.15, 0.7, 0], fov: 40, cut: true },
    { f: 50, pos: [1.05, 0.95, 4.6], target: [1.15, 0.6, 0], fov: 40 },
    { f: 82, pos: [1.0, 0.95, 4.3], target: [1.2, 0.6, 0], fov: 40 },
    // (3) the toss and slam, wide
    { f: 84, pos: [1.2, 1.2, 5.4], target: [1.4, 0.9, 0], fov: 44, cut: true },
    { f: 96, pos: [1.25, 1.15, 5.6], target: [1.5, 0.8, 0], fov: 42 },
    { f: 110, pos: [1.1, 1.2, 5.8], target: [1.3, 0.8, 0], fov: 40 },
  ],
  atk: CROC_ATK,
  def: crocDef,
  props: crocProps,
  dim: (f) => (f < 100 ? 0.5 : 0.35),
  fx: [
    {
      f: 1,
      run: (c) => {
        c.audio.crowdSwell(0.3);
        c.view.vfx.dust(c.def.x - c.facing * 0.4, 0.02, 8, 0.7, C(0xd9cfb8));
      },
    },
    {
      f: 9,
      run: (c) => {
        const x = c.def.x - c.facing * 0.3;
        c.audio.snap();
        c.view.toon.blood(x, 0.22, 10, 0);
        c.view.vfx.sparks(x, 0.25, 10, C(0xffffff), 5, 0, 2);
        c.view.toon.impact(x, 0.25, 0.9, C(0xffd36b), { spikes: 10, life: 0.2 });
        c.view.director.shake(0.25);
      },
    },
    { f: 16, run: (c) => c.view.toon.puff(c.def.x, 0, 8, 0.9, C(0xe8dccb), 0.24, 0.6) },
    {
      f: 62,
      run: (c) => {
        const x = c.def.x - c.facing * 0.5;
        hitFx(c, 2, 0x7cff5a);
        c.view.toon.blood(x, 0.2, 12, 0, 3);
        c.view.director.shake(0.35);
        c.audio.crowdSwell(0.4);
      },
    },
    { f: 84, run: (c) => c.audio.whoosh(3) },
    {
      f: 92,
      run: (c) => {
        const x = c.def.x;
        c.audio.snap();
        c.view.vfx.ring(x, 0.03, 2.6, C(0x7cff5a), 0.4, true);
        c.view.vfx.dust(x, 0, 16, 1.4);
        c.view.toon.puff(x, 0, 12, 1.2, C(0xe9dfd0), 0.28, 0.8);
        c.view.toon.crack(x, 2.0);
        c.view.toon.rubble(x, 0, 10, 4);
        c.view.toon.blood(x, 0.25, 10, -c.facing, 3);
        c.view.toon.impactFrame(0.06);
        c.view.after(0.06, () => c.view.toon.impact(x, 0.4, 2.0, C(0x7cff5a), { spikes: 13, life: 0.4 }));
        c.view.director.shake(0.9);
        c.view.director.punch(4);
        c.view.screenFlash = 0.6;
        c.audio.crowdSwell(0.6);
      },
    },
    { f: 104, run: (c) => c.view.toon.puff(c.atk.x - c.facing * 0.2, 0, 8, 0.8, C(0xe8dccb), 0.22, 0.6) },
  ],
};

// =================================================================== BONEZ — TIEFERGELEGT (car special)
// Three stages after the car hits a grounded opponent: (1) scooped onto the roof and carried, (2) two donuts with the
// victim spinning on the roof while Bonez "steers" along, (3) hard brake: the victim flies off the roof and slams
// down; the car turns into the background and drives off. Victim-local x is toward Bonez; startDx 2.0, endDx 4.2.
const CAR_START = 2.0;
const CAR_END = 4.2; // = the sim's endDx (content/bonez.ts), so nobody jumps when control returns
const CAR_SPIN = [40, 80] as const;
const wheel = (turn: number): PoseDef => ({
  y: -0.03,
  aim: { shL: [0.75, -0.2, -0.35], elL: [0.8, 0.45 - turn * 0.5, -0.1 + turn * 0.3], shR: [0.75, -0.2, 0.35], elR: [0.8, 0.45 + turn * 0.5, 0.1 + turn * 0.3] },
  j: { chest: [0, turn * 12, -4], head: [0, turn * 8, 4], spine: [0, 0, -6], thL: [12, 14, 20], knL: [0, 0, -24], thR: [-12, 12, 6], knR: [0, 0, -18] },
});
const CAR_ATK = smoothClip(
  [
    // he jumped over his car: landing
    { f: 0, p: { y: 0.45, j: { thL: [12, 14, 60], knL: [0, 0, -80], thR: [-12, 12, 30], knR: [0, 0, -90], shL: [30, 0, 120], shR: [-30, 0, 120] } } },
    { f: 6, p: compose(bR.crouch, { y: -0.12, s: { sq: 0.14 } }), e: 'in' },
    { f: 14, p: {}, e: 'out' },
    { f: 20, p: { x: 0.04, aim: { shR: [1, 0.05, 0.1], elR: [1, 0.08, 0.1] }, j: { chest: [0, -10, 0], head: [0, -4, 4] } }, e: 'snap' },
    { f: 32, p: compose(B.grin, { j: { chest: [0, -6, 8] } }), e: 'inOut' },
    // steering along with the donuts
    { f: 42, p: wheel(0), e: 'inOut' },
    { f: 48, p: wheel(-1) },
    { f: 54, p: wheel(1) },
    { f: 60, p: wheel(-1) },
    { f: 66, p: compose(crossed, { j: { head: [0, -16, 12] } }), e: 'inOut' },
    { f: 70, p: laugh(1) },
    { f: 74, p: laugh(0) },
    { f: 78, p: laugh(1) },
    // brake!
    { f: 84, p: { x: 0.06, aim: { shR: [1, 0.1, 0.1], elR: [1, 0.12, 0.1] }, j: { chest: [0, -12, -4], head: [0, -6, -2] } }, e: 'snap' },
    { f: 99, p: compose(fistUp, { y: -0.02 }), e: 'snap' },
    { f: 108, p: compose(fistUp, { y: 0.02 }) },
    { f: 120, p: compose(crossed, { j: { head: [0, -14, 10] } }), e: 'inOut' },
  ],
  bStance,
);

function carDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const roofY = (r.lying.y ?? 0) + 0.9;
  const endX = -(CAR_END - CAR_START) + 0.05;
  const flail = (k: number): PoseDef => ({
    j: { shL: [70, 0, k ? 150 : 90], elL: [0, 0, k ? 30 : 80], shR: [-70, 0, k ? 100 : 160], elR: [0, 0, k ? 70 : 20], head: [0, k ? 20 : -20, -10], thL: [8, 0, k ? 40 : 10], knL: [0, 0, k ? -60 : -20] },
  });
  const ride = (x: number, k: number, yaw = 0): PoseDef => compose(r.lying, flail(k), { x, y: roofY, yaw });
  return smoothClip(
    [
      { f: 0, p: compose(r.hitLow, { x: 0 }) },
      { f: 4, p: compose(r.juggle, { x: 0.02, y: 0.75, rot: 60 }), e: 'out' },
      { f: 10, p: ride(0, 0), e: 'in' },
      { f: 18, p: ride(-0.35, 1), e: 'out' },
      { f: 26, p: ride(-0.58, 0), e: 'out' },
      { f: 36, p: ride(-0.7, 1), e: 'out' },
      // donuts: spin with the car, sampled from the car's own spin curve (opposite sign: the victim is mirrored
      // against the prop group)
      ...Array.from({ length: 11 }, (_, i) => {
        const f = CAR_SPIN[0] + i * 4;
        const yaw = -720 * EASE.inOut((f - CAR_SPIN[0]) / (CAR_SPIN[1] - CAR_SPIN[0]));
        return { f, p: ride(-0.7, i % 2, yaw), e: i ? ('linear' as const) : undefined };
      }),
      { f: CAR_SPIN[1] + 1, p: ride(-0.7, 0, 0), e: 'hold' },
      // hard brake (84): off the roof, over the bonnet, slam (98), bounce
      { f: 84, p: ride(-0.95, 1) },
      { f: 91, p: compose(r.juggle, { x: -1.9, y: 1.9, rot: 300 }), e: 'out' },
      { f: 98, p: compose(r.lying, { x: -2.7, rot: 450, s: { sq: 0.18 } }), e: 'in' },
      { f: 104, p: compose(r.juggle, { x: -2.85, y: 0.35, rot: 560 }), e: 'out' },
      { f: 110, p: compose(r.lying, { x: endX, rot: 810 }), e: 'in' },
      { f: 120, p: compose(r.lying, { x: endX, rot: 810 }) },
    ],
    set.stance,
  );
}

function carProps(): CineProps {
  const group = new THREE.Group();
  const car = tunerCarModel() ?? makeTunerCar();
  const carHalf = car.userData.wheels.length ? 1.15 : 1.35; // half length: procedural 2.3 m, the PO's model 2.7 m
  group.add(car);
  const body = car.getObjectByName('body')!;
  const wheels = car.userData.wheels as THREE.Object3D[];
  const mats = new Set<THREE.Material>();
  car.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) mats.add(m);
  });
  for (const m of mats) {
    m.userData.baseOpacity = m.opacity;
    m.transparent = true;
  }
  let last = -1;
  return {
    group,
    update(f: number, c: PropCtx) {
      const fi = Math.floor(f);
      const fresh = fi !== last;
      if (fi < last) last = -1;
      const [dx] = c.defLocal;
      // x: rams in, then carries the victim (car centre under the hips), brake lurch, holds
      let x = f < 10 ? lerp(CAR_START - 0.1 - carHalf, CAR_START, f / 10) : f < CAR_SPIN[1] ? dx : CAR_START + 0.7 + 0.25 * EASE.out(Math.min(1, (f - CAR_SPIN[1]) / 6));
      let z = 0.05;
      const spin = f >= CAR_SPIN[0] && f < CAR_SPIN[1] ? EASE.inOut((f - CAR_SPIN[0]) / (CAR_SPIN[1] - CAR_SPIN[0])) * Math.PI * 4 : 0;
      // after the stunt: nose into the background and away
      const turn = (Math.PI / 2) * EASE.inOut(Math.min(1, Math.max(0, (f - 100) / 6)));
      if (f >= 106) {
        const d = Math.pow((f - 106) / 14, 2) * 6;
        z -= d;
        x += 0;
      }
      car.position.set(x, 0, z);
      car.rotation.set(0, spin + turn, 0);
      // body: roll in the donuts, nose dive on the brake, bounce on landing
      const dive = f >= 80 && f < 96 ? -0.14 * Math.sin(((f - 80) / 16) * Math.PI) : 0;
      body.rotation.set(spin ? 0.07 : 0, 0, dive);
      body.position.y = f < 12 ? Math.max(0, Math.sin((f / 12) * Math.PI) * 0.05) : 0;
      const roll = f < 10 ? f * 1.2 : f < CAR_SPIN[1] ? 10 + f * 0.9 : f < 84 ? 80 : f >= 100 ? 80 + (f - 100) * 2 : 80;
      for (const w of wheels) w.rotation.z = -roll;
      const a = 1 - ramp(f, 110, 120);
      for (const m of mats) m.opacity = (m.userData.baseOpacity as number) * a;
      car.visible = a > 0.01;
      if (fresh) {
        for (let k = last + 1; k <= fi; k++) {
          // tyre smoke in the donuts, sparks from the bumper on the brake
          if (k >= CAR_SPIN[0] && k < CAR_SPIN[1] && k % 2 === 0) {
            const a2 = spin + Math.PI;
            const p = c.world(x + Math.cos(a2) * 1.0, 0.1, z - Math.sin(a2) * 1.0);
            c.view.toon.puff(p.x, 0, 2, 0.6, C(0xdcd6ea), 0.3, 0.7);
            c.view.vfx.dust(p.x, 0.05, 2, 0.6, C(0xdcd6ea));
          }
          if (k >= 80 && k < 92 && k % 2 === 0) {
            const p = c.world(x + 1.15, 0.15, 0.1);
            c.view.vfx.sparks(p.x, 0.15, 6, C(0xffb347), 5, c.facing, 1);
          }
          if (k >= 106 && k < 118 && k % 2 === 0) {
            const p = c.world(x, 0.1, z);
            c.view.vfx.dust(p.x, 0.05, 3, 0.8, C(0xdcd6ea));
          }
        }
        last = fi;
      }
    },
  };
}

export const CAR_RIDE: CineDef = {
  frames: 120,
  startDx: CAR_START,
  teeth: [
    [30, 42],
    [64, 82],
    [98, 120],
  ],
  camera: [
    // impact, low
    { f: 0, pos: [1.15, 0.45, 2.7], target: [2.0, 0.75, 0], fov: 42, cut: true },
    { f: 10, pos: [1.5, 0.7, 3.7], target: [2.2, 0.95, 0], fov: 44 },
    // roof ride, side
    { f: 22, pos: [2.5, 1.7, 4.8], target: [2.6, 1.0, 0], fov: 42, cut: true },
    { f: 38, pos: [2.6, 1.8, 4.6], target: [2.7, 1.0, 0], fov: 42 },
    // donuts from above
    { f: 40, pos: [2.7, 3.8, 4.6], target: [2.7, 0.6, 0], fov: 48, cut: true },
    { f: 62, pos: [2.8, 3.4, 4.0], target: [2.7, 0.7, 0], fov: 48 },
    // Bonez laughing
    { f: 64, pos: [0.9, 1.65, 2.0], target: [0.1, 1.6, 0], fov: 30, cut: true },
    { f: 79, pos: [0.85, 1.68, 1.85], target: [0.12, 1.62, 0], fov: 29 },
    // the brake and the flight, wide and low
    { f: 80, pos: [2.6, 0.6, 6.6], target: [3.4, 1.2, 0], fov: 46, cut: true },
    { f: 98, pos: [2.9, 0.7, 6.4], target: [3.9, 0.8, 0], fov: 46 },
    // the victim on the floor, car leaving into the background
    { f: 100, pos: [4.0, 0.7, 3.4], target: [4.6, 0.35, -0.5], fov: 42, cut: true },
    { f: 120, pos: [4.1, 0.8, 3.7], target: [4.6, 0.4, -0.8], fov: 42 },
  ],
  atk: CAR_ATK,
  def: carDef,
  props: carProps,
  dim: (f) => (f < 110 ? 0.5 : 0.35),
  fx: [
    {
      f: 2,
      run: (c) => {
        hitFx(c, 2, 0xffa23a);
        c.audio.slam();
        c.view.toon.blood(c.def.x, c.def.y + 0.2, 5, -c.facing, 2.4);
      },
    },
    { f: 10, run: (c) => (c.audio.block(2), c.view.director.shake(0.35)) },
    { f: 40, run: (c) => (c.audio.carIn(), c.audio.crowdSwell(0.4)) },
    ...[44, 58].map((f) => ({ f, run: (c: FxCtx) => c.view.vfx.ring(c.def.x, 0.03, 3.2, C(0x7cff5a), 0.5, true) })),
    {
      f: 62,
      run: (c) => {
        hitFx(c, 2, 0x7cff5a);
        c.view.toon.blood(c.def.x, c.def.y + 0.3, 5, 0, 2.4);
      },
    },
    { f: 80, run: (c) => (c.audio.carIn(), c.audio.whoosh(3)) },
    {
      f: 98,
      run: (c) => {
        const x = c.def.x;
        c.audio.boom();
        c.audio.slam();
        c.view.toon.impactFrame(0.06);
        c.view.toon.crack(x, 2.2);
        c.view.toon.rubble(x, 0, 12, 4);
        c.view.toon.puff(x, 0, 12, 1.3, C(0xe9dfd0), 0.28, 0.8);
        c.view.toon.blood(x, 0.3, 10, -c.facing, 3);
        c.view.vfx.ring(x, 0.05, 2.8, C(0xffa23a), 0.45, true);
        c.view.director.shake(1);
        c.view.director.punch(5);
        c.view.screenFlash = 0.6;
        c.audio.crowdSwell(0.7);
      },
    },
    { f: 100, run: (c) => c.view.vfx.sparks(c.atk.x + c.facing * 0.12, 1.75, 14, C(0xffd65a), 4, c.facing, 2) },
  ],
};

// =================================================================== JAZEEK — BLUNT FÜR DICH (special, D43)
// PO session 11: "Jazeek greift den Gegner und trägt ihn auf den Händen, dann kommt wie im Cartoon eine Wolke, während
// seine Hände sich schnell bewegen, als würde er etwas zusammenbauen – der Gegner verschwindet, ein Joint kommt raus.
// Er raucht ihn in einer passenden Pose (Schaden), beim letzten Auspusten erscheint eine Wolke und daraus fliegt der
// Gegner." (1) grab + lift onto his hands (0-16), (2) cartoon fight cloud, only the fast hands visible, the victim is
// gone (16-54), (3) the cloud pops: he holds the joint (the PO's prop), lights it (54-72), (4) three drags in a cool
// pose, each one burns (sim hits 78/96/114), smoke rings, (5) the last big exhale makes a cloud and the victim flies
// out of it (134), tumbles and lands at endDx 2.6. Victim hidden 18-131 (CineDef.hide).
const BL = JAZEEK_POSES.BLUNT;
const CLOUD_X = 0.62;
const CLOUD_Y = 1.32;
/** Exhale cloud the victim flies out of (attacker-local). */
const OUT_X = 1.55;
const OUT_Y = 1.45;

// carrying them on his hands: both forearms forward and up, palms up under the body
const carry = (lift: number): PoseDef => ({
  x: 0.06,
  y: 0.02 * lift,
  aim: { shL: [0.75, 0.2 + 0.25 * lift, -0.25], elL: [0.75, 0.55 + 0.2 * lift, -0.1], shR: [0.75, 0.2 + 0.25 * lift, 0.25], elR: [0.75, 0.55 + 0.2 * lift, 0.1], face: 0.6 },
  j: { spine: [0, -2, -6 - 4 * lift], chest: [0, -4, -8 - 6 * lift], head: [0, 0, 6 * lift], thL: [10, 14, 22], knL: [0, 0, -26], thR: [-10, 12, -14], knR: [0, 0, -18] },
});
// working inside the cloud: hands at chest height, alternating fast (k = 0/1)
const build = (k: number, h = 0): PoseDef => ({
  x: 0.08,
  y: -0.03,
  aim: {
    shL: [0.85, -0.05 + 0.35 * k + 0.1 * h, -0.3],
    elL: [0.7, 0.55 - 0.7 * k, 0.2 * h - 0.1],
    shR: [0.85, 0.3 - 0.35 * k - 0.1 * h, 0.3],
    elR: [0.7, -0.15 + 0.7 * k, -0.1 - 0.2 * h],
    face: 0.8,
  },
  j: { spine: [0, (k - 0.5) * 6, -10], chest: [0, (0.5 - k) * 10, -14], head: [0, (k - 0.5) * 8, -10], thL: [12, 16, 30], knL: [0, 0, -40], thR: [-12, 12, -20], knR: [0, 0, -30] },
});
// the cool smoking stance: weight back, left hand low, head tilted; the joint is IN his right hand (S12, PO: it
// floated crosswise in front of him): between drags the hand rests at chest height, forearm up; for a drag it goes
// to his lips (drag = 1)
const cool = (drag: number): PoseDef =>
  compose(BL.chill, {
    x: -0.04,
    y: 0.015 * drag,
    aim: {
      shR: [0.15 + 0.25 * drag, -0.75 + 0.9 * drag, 0.6 - 0.05 * drag],
      elR: [0.45 - 0.9 * drag, 0.85 + 0.1 * drag, 0.1 - 0.2 * drag],
    },
    j: {
      hips: [0, -10, 0],
      spine: [0, -4, 2 + 2 * drag],
      chest: [0, -10 - 6 * drag, 6 + 4 * drag],
      neck: [0, -2, -2 * drag],
      head: [0, -8 + 6 * drag, 8 - 12 * drag],
      haR: [0, 0, -10],
      shL: [16, 0, 14],
      elL: [0, 0, 22],
      thL: [6, 18, 12],
      knL: [0, 0, -16],
      thR: [-6, 10, -10],
      knR: [0, 0, -6],
    },
  });
const exhale = compose(BL.blow, { x: 0.02, aim: { shR: [0.2, -0.6, 0.65], elR: [0.6, 0.7, 0.2] }, j: { head: [0, -4, -14], chest: [0, -6, -12] } });

const BLUNT_ATK = smoothClip(
  [
    { f: 0, p: compose(BL.chill, { x: 0.05 }) },
    // grab and lift onto the hands
    { f: 4, p: { x: 0.12, aim: { shL: [0.85, -0.2, -0.3], elL: [0.9, 0.2, -0.1], shR: [0.85, -0.2, 0.3], elR: [0.9, 0.2, 0.1], face: 0.6 }, j: { spine: [0, -4, -8], chest: [0, -6, -10] } }, e: 'snap' },
    { f: 10, p: carry(0.5), e: 'out' },
    { f: 16, p: carry(1) },
    // the cloud: hands flying (4-frame cycles), a little bounce
    ...Array.from({ length: 9 }, (_, i) => ({ f: 20 + i * 4, p: build(i % 2, ((i * 5) % 3) - 1), e: 'snap' as const })),
    { f: 52, p: build(0.5, 0), e: 'inOut' },
    // the cloud pops: he holds up the joint, proud
    { f: 56, p: compose(cool(0), { y: 0.04, j: { shR: [-34, 0, 92], elR: [0, 0, 120], head: [0, -6, 16] } }), e: 'out' },
    { f: 62, p: compose(BL.light, { x: -0.02 }), e: 'inOut' },
    { f: 68, p: compose(BL.light, { x: -0.02, j: { haL: [0, 0, 40] } }) },
    { f: 72, p: cool(0), e: 'inOut' },
    // three drags (hits 78 / 96 / 114) and the exhales
    ...[78, 96, 114].flatMap((h, i) => [
      { f: h - 4, p: cool(0.3) },
      { f: h, p: cool(1 + (i === 2 ? 0.4 : 0)), e: 'inOut' as const },
      { f: h + 6, p: exhale, e: 'snap' as const },
      { f: h + 12, p: cool(0.1) },
    ]),
    // the last, biggest exhale: leans into it, flicks the stub away
    { f: 128, p: compose(exhale, { x: 0.06, j: { chest: [0, -4, -18], head: [0, -2, -20] } }), e: 'snap' },
    { f: 134, p: compose(BL.chill, { x: 0.02, j: { shR: [-40, 0, 40], elR: [0, 0, 20], haR: [0, 0, -40] } }), e: 'snap' },
    { f: 146, p: compose(BL.chill, { j: { head: [0, -10, 4] } }), e: 'inOut' },
    { f: 160, p: BL.chill },
  ],
  jStance,
);

function bluntDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const st = set.stance;
  const pivot = set.pivot ?? 0.9;
  const START = 0.75;
  const endX = -(2.6 - START) + 0.05;
  // victim-local x points toward Jazeek: attacker-local x = START - victim x
  const onHands = (lift: number): PoseDef =>
    compose(r.lying, { x: START - CLOUD_X, y: 1.12 + 0.12 * lift - pivot, rot: -90, j: { head: [0, 10, -10], shL: [60, 0, 40], elL: [0, 0, 50], thL: [8, 0, 20], knL: [0, 0, -30] } });
  return smoothClip(
    [
      { f: 0, p: compose(r.hitHigh, { x: 0.02 }) },
      { f: 4, p: compose(r.hitHigh, { x: 0.06, y: 0.06 }), e: 'snap' },
      { f: 10, p: compose(r.juggle, { x: START - CLOUD_X, y: 1.0 - pivot, rot: -60 }), e: 'out' },
      { f: 16, p: onHands(1) },
      { f: 130, p: onHands(1) },
      // out of the exhale cloud: tumbling, landing on the back
      { f: 132, p: compose(r.juggle, { x: START - OUT_X, y: OUT_Y - pivot, rot: -160 }), e: 'snap' },
      { f: 140, p: compose(r.juggle, { x: (START - OUT_X + endX) / 2, y: 1.6 - pivot, rot: -300 }), e: 'out' },
      { f: 148, p: compose(r.lying, { x: endX, rot: 90, s: { sq: 0.16 } }), e: 'in' },
      { f: 160, p: compose(r.lying, { x: endX, rot: 90, j: { head: [0, 10, -4] } }) },
    ],
    st,
  );
}

let puffTex: THREE.Texture | null = null;
/** Cartoon cloud puff: a white ball with a soft grey underside and a dark ink rim (reads as a drawn cloud). */
function puffTexture(): THREE.Texture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fillStyle = '#16121c';
  g.fill();
  // cel-shaded ball: lavender shadow, the lit part as an offset disc (hard edge = toon band), a soft highlight
  g.save();
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#b7aecb';
  g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(57, 55, 47, 0, Math.PI * 2);
  g.fillStyle = '#f3f0f8';
  g.fill();
  const hi = g.createRadialGradient(44, 40, 2, 44, 40, 20);
  hi.addColorStop(0, 'rgba(255,255,255,1)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, 128, 128);
  g.restore();
  puffTex = new THREE.CanvasTexture(c);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}

let glowTex: THREE.Texture | null = null;
function smokeGlow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** Comic "action" sign (star burst with a word) as a sprite texture. */
function burstTexture(word: string, fill: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.translate(128, 80);
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 52 : 74;
    g.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.95);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#111';
  g.stroke();
  g.font = '900 54px "Rubik Wet Paint", "Anton", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#111';
  g.strokeText(word, 0, 4);
  g.fillStyle = '#fff';
  g.fillText(word, 0, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bluntProps(): CineProps {
  const group = new THREE.Group();
  // --- the fight cloud: a ring of puffs around the carried victim, churning; blur streaks and comic signs pop out
  const cloud = new THREE.Group();
  cloud.position.set(CLOUD_X, CLOUD_Y, 0.08);
  group.add(cloud);
  const puffMat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false });
  const puffs: { s: THREE.Sprite; a: number; r: number; size: number; sp: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(puffMat);
    const a = (i / 22) * Math.PI * 2;
    puffs.push({ s, a, r: 0.32 + ((i * 37) % 11) / 60, size: 0.38 + ((i * 13) % 7) / 28, sp: 1.6 + ((i * 7) % 5) / 3 });
    s.renderOrder = 4;
    cloud.add(s);
  }
  const streakMat = new THREE.MeshBasicMaterial({ color: 0x15121c, transparent: true, opacity: 0.8, depthWrite: false });
  const streaks: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.025), streakMat);
    m.renderOrder = 5;
    streaks.push(m);
    cloud.add(m);
  }
  const signs = [burstTexture('ZACK', '#ffd23c'), burstTexture('KLATSCH', '#ff5a8c'), burstTexture('ROLL!', '#5ad1ff')].map((map) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    s.renderOrder = 6;
    s.scale.set(0.5, 0.31, 1);
    cloud.add(s);
    return s;
  });
  const starMat = new THREE.SpriteMaterial({ map: smokeGlow(), color: 0xfff1a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const stars = Array.from({ length: 6 }, () => {
    const s = new THREE.Sprite(starMat);
    s.renderOrder = 6;
    cloud.add(s);
    return s;
  });
  // --- the exhale cloud the victim flies out of
  const outCloud = new THREE.Group();
  outCloud.position.set(OUT_X, OUT_Y, 0.05);
  group.add(outCloud);
  const outPuffs = Array.from({ length: 16 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0xeceaf2, transparent: true, depthWrite: false }));
    s.renderOrder = 4;
    outCloud.add(s);
    return { s, a: (i / 16) * Math.PI * 2, r: 0.2 + ((i * 29) % 9) / 30 };
  });
  // --- the joint: the PO's prop in his right hand, ember glow + lighter flame
  const joint = new HandProp('joint', group);
  const jointScale = 1.35; // between the fingers (2.2 read as a baton floating across him)
  const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeGlow(), color: 0xff5a14, transparent: true, depthWrite: false, depthTest: false }));
  ember.renderOrder = 11;
  const emberGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeGlow(), color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  emberGlow.renderOrder = 10;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeGlow(), color: 0xffc24a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(ember, emberGlow, flame);
  const light = new THREE.PointLight(0xff7a2a, 0, 1.6, 2);
  const tip = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  let last = -1;
  return {
    group,
    lights: [light],
    update(f: number, c: PropCtx) {
      const t = c.time;
      // fight cloud: grows in 16-22, churns, pops 52-58
      const cin = pop(ramp(f, 15, 22));
      const cout = 1 - ramp(f, 52, 58);
      const cs = cin * cout;
      cloud.visible = cs > 0.01;
      if (cloud.visible) {
        cloud.scale.setScalar(0.4 + 0.6 * cs + (f >= 52 ? (1 - cout) * 0.8 : 0));
        cloud.position.y = CLOUD_Y + Math.sin(t * 9) * 0.03;
        puffs.forEach((p, i) => {
          const a = p.a + t * p.sp * (i % 2 ? 1 : -1) * 0.6;
          const wob = 1 + 0.18 * Math.sin(t * 12 + i * 1.7);
          p.s.position.set(Math.cos(a) * p.r * 1.25, Math.sin(a) * p.r * 0.85, Math.sin(a * 2 + t * 3) * 0.12);
          p.s.scale.setScalar(p.size * wob * cs);
          (p.s.material as THREE.SpriteMaterial).opacity = Math.min(1, cs * 1.3);
        });
        streaks.forEach((s, i) => {
          const ph = (t * 7 + i * 0.37) % 1;
          const a = i * 0.9 + Math.floor(t * 7 + i * 0.37) * 2.1;
          s.visible = ph < 0.5 && f > 22 && f < 52;
          s.position.set(Math.cos(a) * (0.42 + ph * 0.25), Math.sin(a) * (0.3 + ph * 0.18), 0.2);
          s.rotation.z = a;
        });
        signs.forEach((s, i) => {
          const start = 24 + i * 9;
          const k = ramp(f, start, start + 3) * (1 - ramp(f, start + 7, start + 9));
          s.visible = k > 0.01;
          s.position.set((i - 1) * 0.42, 0.42 + (i % 2) * 0.12, 0.3);
          s.scale.set(0.5 * pop(k), 0.31 * pop(k), 1);
          s.material.rotation = (i - 1) * 0.25;
        });
        stars.forEach((s, i) => {
          const a = t * 5 + (i / stars.length) * Math.PI * 2;
          s.visible = f > 22 && f < 52;
          s.position.set(Math.cos(a) * 0.5, 0.48 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.2);
          s.scale.setScalar(0.12 + 0.05 * Math.sin(t * 20 + i));
        });
      }
      // the joint: from the pop until the last exhale
      const atkRig = c.rigs[0];
      const hasJoint = f >= 53 && f < 133;
      if (atkRig && joint.ok) {
        joint.place(atkRig, 'haR', hasJoint);
        if (hasJoint) {
          const k = pop(ramp(f, 53, 58));
          joint.obj.scale.multiplyScalar(jointScale * Math.max(0.05, k));
        }
      }
      const lit = f >= 66 && f < 133;
      let flare = 0;
      for (const h of [78, 96, 114]) flare = Math.max(flare, ramp(f, h - 6, h) * (1 - ramp(f, h, h + 6)));
      if (hasJoint && joint.ok) {
        // ember at the far end of the joint (+X of the prop = tip)
        joint.obj.updateWorldMatrix(true, false);
        joint.obj.getWorldQuaternion(tmpQ);
        tip.set(0.085 * jointScale, 0, 0).applyQuaternion(tmpQ).add(joint.obj.getWorldPosition(new THREE.Vector3()));
        group.worldToLocal(tip);
      }
      ember.visible = emberGlow.visible = lit && joint.ok;
      if (ember.visible) {
        ember.position.copy(tip);
        emberGlow.position.copy(tip);
        ember.scale.setScalar(0.07 + 0.05 * flare);
        // small: on the toon materials a strong point light washed Jazeek out to a white-orange shape
        emberGlow.scale.setScalar(0.12 + 0.16 * flare + 0.02 * Math.sin(t * 9));
        (emberGlow.material as THREE.SpriteMaterial).opacity = 0.6;
        light.intensity = 0.25 + 0.9 * flare;
        light.position.copy(group.localToWorld(tip.clone()));
      } else light.intensity = 0;
      flame.visible = f >= 62 && f < 68 && joint.ok;
      if (flame.visible) {
        flame.position.copy(tip).add(new THREE.Vector3(0, -0.04, 0));
        flame.scale.set(0.09 + Math.random() * 0.03, 0.15 + Math.random() * 0.04, 1);
      }
      // exhale cloud: builds 122-132, bursts open as they fly out, fades
      const oin = pop(ramp(f, 120, 131));
      const oout = 1 - ramp(f, 136, 152);
      outCloud.visible = oin * oout > 0.01;
      if (outCloud.visible) {
        const burst = 1 + ramp(f, 131, 140) * 0.9;
        outPuffs.forEach((p, i) => {
          const a = p.a + t * 0.8 * (i % 2 ? 1 : -1);
          p.s.position.set(Math.cos(a) * p.r * 1.4 * burst, Math.sin(a) * p.r * burst, Math.sin(a * 3) * 0.1);
          p.s.scale.setScalar((0.42 + 0.12 * Math.sin(t * 6 + i)) * oin);
          (p.s.material as THREE.SpriteMaterial).opacity = Math.min(1, oin * oout * 1.2);
        });
      }
      // per-frame particles
      const fi = Math.floor(f);
      if (fi < last) last = -1;
      if (fi === last) return;
      for (let k = last + 1; k <= fi; k++) {
        if (k >= 20 && k < 52 && k % 3 === 0) {
          const p = c.world(CLOUD_X + (Math.random() - 0.5) * 0.8, CLOUD_Y + (Math.random() - 0.5) * 0.5, 0.2);
          c.view.vfx.sparks(p.x, p.y, 3, C(0xffffff), 3, 0, 1.5);
        }
        if (lit && k % 3 === 0 && joint.ok) {
          const w = group.localToWorld(tip.clone());
          c.view.fx.smoke.spawn(w, new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.4 + Math.random() * 0.2, 0), k % 2 ? 0xd9dfd2 : 0xc6cfc0, 0.12, 1.4, 2.0, Math.random() - 0.5);
        }
        for (const h of [84, 102])
          if (k >= h && k < h + 5) {
            const head = c.rigs[0]?.joints.head.getWorldPosition(new THREE.Vector3());
            const mouth = head ? head.add(new THREE.Vector3(c.facing * 0.1, -0.06, 0.05)) : c.world(0.22, 1.62, 0.05);
            for (let i = 0; i < 2; i++)
              c.view.fx.smoke.spawn(mouth.clone(), new THREE.Vector3(c.facing * (0.9 + Math.random() * 1.2), 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4), 0xe4e8de, 0.24, 1.5, 2.6, (Math.random() - 0.5) * 2);
          }
        if (k >= 120 && k < 131) {
          // the long last exhale streams into the cloud
          const mouth = c.world(0.22, 1.62, 0.05);
          c.view.fx.smoke.spawn(mouth.clone(), new THREE.Vector3(c.facing * 2.6, -0.1, 0), 0xeceaf2, 0.3, 0.6, 2.4, 0);
        }
      }
      last = fi;
    },
  };
}

export const BLUNT_SESSION: CineDef = {
  frames: 160,
  startDx: 0.75,
  hide: [[18, 131]],
  camera: [
    // the grab and the lift
    { f: 0, pos: [0.35, 1.35, 3.6], target: [0.45, 1.2, 0], fov: 36, cut: true },
    { f: 16, pos: [0.5, 1.5, 3.3], target: [0.55, 1.25, 0], fov: 36 },
    // the cloud: close, slightly from below, a quick push-in
    { f: 18, pos: [1.25, 1.15, 2.4], target: [0.55, 1.3, 0], fov: 38, cut: true },
    { f: 50, pos: [1.1, 1.2, 2.0], target: [0.55, 1.3, 0], fov: 36 },
    // the reveal: he holds up the joint
    { f: 54, pos: [0.85, 1.65, 1.7], target: [0.2, 1.55, 0], fov: 32, cut: true },
    { f: 70, pos: [0.75, 1.65, 1.55], target: [0.2, 1.6, 0], fov: 30 },
    // smoking: the first drag medium, then the face close-up while he pulls on it (PO S12: "Face-Zoom, wie er den
    // Joint raucht"), back out for the third
    { f: 72, pos: [1.5, 1.5, 3.0], target: [0.4, 1.45, 0], fov: 34, cut: true },
    { f: 88, pos: [1.3, 1.52, 2.7], target: [0.35, 1.5, 0], fov: 32 },
    { f: 90, pos: [0.75, 1.68, 1.05], target: [0.12, 1.62, 0], fov: 28, cut: true },
    { f: 108, pos: [0.68, 1.68, 0.92], target: [0.12, 1.63, 0], fov: 26 },
    { f: 110, pos: [1.2, 1.5, 2.8], target: [0.45, 1.45, 0], fov: 34, cut: true },
    { f: 118, pos: [1.1, 1.5, 3.1], target: [0.6, 1.4, 0], fov: 34 },
    // the last exhale and the fly-out: wide
    { f: 120, pos: [1.2, 1.4, 5.0], target: [1.3, 1.3, 0], fov: 40, cut: true },
    { f: 160, pos: [1.6, 1.3, 5.6], target: [1.9, 0.9, 0], fov: 40 },
  ],
  atk: BLUNT_ATK,
  def: bluntDef,
  props: bluntProps,
  dim: (f) => (f < 72 ? 0.5 : f < 120 ? 0.55 : 0.35),
  fx: [
    { f: 1, run: (c) => (c.audio.whoosh(2), c.view.director.shake(0.2)) },
    { f: 16, run: (c) => (c.audio.boom(), c.view.director.shake(0.3)) },
    ...[20, 24, 28, 32, 36, 40, 44, 48].map((f, i) => ({ f, run: (c: FxCtx) => (i % 2 ? c.audio.snap() : c.audio.whoosh(0)) })),
    { f: 54, run: (c) => (c.audio.sparkle(), c.audio.crowdSwell(0.4)) },
    { f: 62, run: (c) => c.audio.lighter() },
    { f: 68, run: (c) => c.audio.smoke() },
    ...[78, 96, 114].map((f, i) => ({
      f,
      run: (c: FxCtx) => {
        c.audio.inhale();
        // the burn: the victim IS the joint, so the hit lands at the ember
        const e = c.atk.clone().add(new THREE.Vector3(c.facing * 0.35, 0.45, 0.1));
        c.view.vfx.sparks(e.x, e.y, 18, C(0xffa040), 5, -c.facing, 2);
        c.view.toon.impact(e.x, e.y, 0.7 + i * 0.15, C(0xff8a2a), { spikes: 10, life: 0.22 });
        c.view.director.shake(0.2 + i * 0.08);
      },
    })),
    ...[84, 102].map((f) => ({ f, run: (c: FxCtx) => (c.audio.smoke(), c.audio.crowdSwell(0.25)) })),
    { f: 120, run: (c) => c.audio.riser() },
    {
      f: 132,
      run: (c) => {
        c.audio.boom();
        c.view.toon.impactFrame(0.06);
        c.view.director.shake(0.8);
        c.view.director.punch(4);
        c.audio.crowdSwell(0.7);
      },
    },
    { f: 148, run: (c) => (c.audio.slam(), c.view.toon.puff(c.def.x, 0, 10, 1.2, C(0xe9dfd0), 0.26, 0.7)) },
    ...[150, 156].map((f) => ({ f, run: (c: FxCtx) => c.audio.cough() })),
  ],
};
