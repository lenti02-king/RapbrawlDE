// Signature cinematics for the real roster: Jazeek "Herzbrecher" and Bonez MC
// "Palmen-Bassdrop". Timings match the sim's CinematicDef hit frames
// (src/content/jazeek.ts, src/content/bonez.ts); everything here is presentation.
import * as THREE from 'three';
import { BONEZ_ANIMS, BONEZ_POSES } from './anims/bonez';
import { JAZEEK_ANIMS, JAZEEK_POSES } from './anims/jazeek';
import { reactions } from './anims/stances';
import type { AnimSet } from './anims/types';
import type { CineDef, CineProps, FxCtx, PropCtx } from './cinematics';
import { Clip, compose, sampleDef, type PoseDef } from './pose';
import { heartGeometry, heartMaterial, makeCroc, makePalm, makeSplitHeart, makeSpotlight, makeSunset } from './props';

const C = (h: number) => new THREE.Color(h);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const ramp = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Overshooting pop-in 0..1. */
const pop = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

function victimReactions(set: AnimSet) {
  return reactions(set.stance, set.pivot ?? 0.9);
}

function hitFx(c: FxCtx, strength: number, color = 0xffd36b): void {
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

const HEART_ATK = new Clip(
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
  return new Clip(
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
  const big = makeSplitHeart();
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

const PALM_ATK = new Clip(
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
  return new Clip(
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
    const p = makePalm(h, lean, i % 2 ? 0x2a1540 : 0x341a4a);
    p.position.set(x, 0, z);
    group.add(p);
    return p;
  });
  const croc = makeCroc({ top: 0x2f7d3a, side: 0x47a64a, belly: 0xe6d79a });
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
