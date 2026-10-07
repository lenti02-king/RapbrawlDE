// Cinematics of the D43 abilities (session 11, PO wishes): Manuellsen's Sofa-Backpfeifen, Lacazette's 70 Schüsse,
// Jazeek's Ninetynine and Bonez's Ohne mein Team. Keyed to the sim's cinematic frames (content/<id>.ts cinematics:
// the same hit frames, startDx and endDx). Attacker-local coordinates: x toward the victim, y up, z toward the camera.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { burstSprite, makeOffroader, runPose, starTexture, textSprite } from './abilities11';
import { BONEZ_ANIMS, BONEZ_POSES } from './anims/bonez';
import { JAZEEK_ANIMS } from './anims/jazeek';
import type { AnimSet } from './anims/types';
import type { CineDef, CineProps, ExtraActor, FxCtx, PropCtx } from './cinematics';
import { hitFx, victimReactions } from './cines';
import { compose, sampleDef, smoothClip, type Clip, type PoseDef } from './pose';
import { makePalm, makeSunset, smokeTexture } from './props';
import { palmModel } from './propModels';

const C = (h: number) => new THREE.Color(h);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const ramp = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));
const lin = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1e-6, b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pop = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
const INK = new THREE.MeshBasicMaterial({ color: 0x060509, side: THREE.BackSide });

/** Mesh + black ink shell (cel look of the fighters). */
function inked(geo: THREE.BufferGeometry, mat: THREE.Material, shell = 1.04): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  const s = new THREE.Mesh(geo, INK);
  s.scale.setScalar(shell);
  m.add(s);
  return m;
}

/** Comic signs that pop in at a frame and fade (BATSCH!, HANDYVERBOT!, ...). */
function signTrack(group: THREE.Group, items: { f: number; word: string; fill: string; w: number; pos: [number, number, number]; len?: number }[]) {
  const sprites = items.map((it) => {
    const s = burstSprite(it.word, it.fill, it.w);
    s.visible = false;
    group.add(s);
    return s;
  });
  return (f: number) =>
    items.forEach((it, i) => {
      const s = sprites[i];
      const len = it.len ?? 14;
      const k = f >= it.f && f < it.f + len ? pop(lin(f, it.f, it.f + 3)) * (1 - lin(f, it.f + len - 4, it.f + len)) : 0;
      s.visible = k > 0.01;
      if (!s.visible) return;
      s.position.set(...it.pos);
      s.scale.set(it.w * k, it.w * 0.625 * k, 1);
      s.material.rotation = (i % 2 ? 1 : -1) * 0.12;
    });
}

// =================================================================== MANUELLSEN — SOFA-BACKPFEIFEN (signature)
// Grab -> a black sofa pops up behind the opponent -> he pushes them down onto it -> three slaps with straight arms
// (sim hits 70 / 92 / 116: batsch, batsch, BATSCH) -> the last one tips the sofa over backwards, the victim tumbles
// over the backrest. startDx 0.95, endDx 2.6.
const MS = BONEZ_ANIMS.stance;
const SOFA_X = 1.5;
const SEAT_H = 0.47;

const holdCollar: PoseDef = {
  x: 0.14,
  aim: { shL: [0.85, 0.1, -0.25], elL: [0.9, 0.25, -0.1], shR: [0.85, 0.1, 0.25], elR: [0.9, 0.25, 0.1], face: 0.7 },
  j: { spine: [0, 0, -8], chest: [0, -4, -8] },
};
const shove: PoseDef = {
  x: 0.3,
  aim: { shL: [1, 0.05, -0.2], elL: [1, 0.05, -0.2], shR: [1, 0.05, 0.2], elR: [1, 0.05, 0.2], face: 0.8 },
  j: { spine: [0, 0, -16], chest: [0, -4, -10], thL: [12, 14, 40], knL: [0, 0, -36], thR: [-12, 12, -30], knR: [0, 0, -6] },
};
// straight-armed slaps: the arm swings flat across, like a door (aim in character space)
const slapWind = (side: 'R' | 'L', big = 0): PoseDef => ({
  x: 0.42 - big * 0.06,
  aim: side === 'R'
    ? { shR: [-0.25, 0.2 + big * 0.15, 1], elR: [-0.25, 0.2 + big * 0.15, 1], shL: [0.5, -0.6, -0.4], elL: [0.6, 0.6, -0.2], face: 0.6 }
    : { shL: [-0.25, 0.2 + big * 0.15, -1], elL: [-0.25, 0.2 + big * 0.15, -1], shR: [0.5, -0.6, 0.4], elR: [0.6, 0.6, 0.2], face: 0.6 },
  j: { hips: [0, side === 'R' ? 22 : -22, 0], chest: [0, side === 'R' ? 26 + big * 10 : -26 - big * 10, 2], spine: [0, side === 'R' ? 10 : -10, 0], thL: [12, 14, 30], knL: [0, 0, -30], thR: [-12, 12, -24], knR: [0, 0, -10] },
});
const slapHit = (side: 'R' | 'L'): PoseDef => ({
  x: 0.5,
  aim: side === 'R'
    ? { shR: [1, -0.15, -0.35], elR: [1, -0.15, -0.4], shL: [0.4, -0.7, -0.4], elL: [0.5, 0.6, -0.2], face: 0.9 }
    : { shL: [1, -0.15, 0.35], elL: [1, -0.15, 0.4], shR: [0.4, -0.7, 0.4], elR: [0.5, 0.6, 0.2], face: 0.9 },
  j: { hips: [0, side === 'R' ? -18 : 18, 0], chest: [0, side === 'R' ? -30 : 30, -6], spine: [0, side === 'R' ? -12 : 12, -6], thL: [12, 14, 34], knL: [0, 0, -34], thR: [-12, 12, -26], knR: [0, 0, -8] },
});
const slapFollow = (side: 'R' | 'L'): PoseDef => ({
  x: 0.48,
  aim: side === 'R' ? { shR: [0.45, -0.2, -0.85], elR: [0.4, -0.2, -0.9], face: 0.6 } : { shL: [0.45, -0.2, 0.85], elL: [0.4, -0.2, 0.9], face: 0.6 },
  j: { chest: [0, side === 'R' ? -40 : 40, -4] },
});
const flexUp: PoseDef = { y: 0.02, j: { chest: [0, 0, 8], head: [0, 0, 14], shL: [20, 0, 150], elL: [0, 0, 110], shR: [-20, 0, 150], elR: [0, 0, 110] } };
const dustHands: PoseDef = { aim: { shL: [0.6, -0.5, -0.1], elL: [0.4, 0.6, 0.6], shR: [0.6, -0.5, 0.1], elR: [0.4, 0.6, -0.6] }, j: { head: [0, -8, -8] } };

const SOFA_ATK = smoothClip(
  [
    { f: 0, p: holdCollar },
    { f: 10, p: compose(holdCollar, { x: 0.18 }) },
    { f: 18, p: compose(holdCollar, { x: 0.12, j: { chest: [0, -6, 4] } }), e: 'out' },
    { f: 22, p: shove, e: 'snap' },
    { f: 30, p: compose(shove, { x: 0.32 }) },
    { f: 40, p: compose(dustHands, { x: 0.38 }), e: 'inOut' },
    // a stare, then the first slap (70)
    { f: 54, p: compose(MS, { x: 0.42, j: { head: [0, -6, -10], chest: [0, -6, 4] } }), e: 'inOut' },
    { f: 64, p: slapWind('R'), e: 'out' },
    { f: 70, p: slapHit('R'), e: 'snap' },
    { f: 76, p: slapFollow('R'), e: 'out' },
    // second (92)
    { f: 86, p: slapWind('L'), e: 'inOut' },
    { f: 92, p: slapHit('L'), e: 'snap' },
    { f: 98, p: slapFollow('L'), e: 'out' },
    // the big one (116)
    { f: 110, p: slapWind('R', 1), e: 'inOut' },
    { f: 116, p: compose(slapHit('R'), { x: 0.62 }), e: 'snap' },
    { f: 124, p: compose(slapFollow('R'), { x: 0.6 }), e: 'out' },
    { f: 136, p: compose(dustHands, { x: 0.45 }), e: 'inOut' },
    { f: 148, p: compose(flexUp, { x: 0.4 }), e: 'inOut' },
    { f: 160, p: compose(flexUp, { x: 0.4, y: 0.03 }) },
  ],
  MS,
);

function sofaDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const pivot = set.pivot ?? 0.9;
  const START = 0.95;
  const at = (ax: number) => START - ax; // attacker-local x -> victim-local x
  const endX = at(2.6);
  const sit = (turn = 0, lean = 0): PoseDef =>
    compose(set.stance, {
      x: at(SOFA_X - 0.12),
      y: SEAT_H + 0.1 - pivot,
      j: {
        hips: [0, 0, 0],
        spine: [0, turn * 0.4, 10 + lean],
        chest: [0, turn * 0.6, 6 + lean * 0.5],
        neck: [0, turn * 0.6, 0],
        head: [turn * 0.3, turn, -6],
        thL: [8, 6, 92],
        knL: [0, 0, -96],
        ftL: [0, 0, 10],
        thR: [-8, 6, 88],
        knR: [0, 0, -92],
        ftR: [0, 0, 10],
        shL: [40 + Math.abs(turn) * 0.5, 0, 20],
        elL: [0, 0, 40],
        shR: [-40 - Math.abs(turn) * 0.5, 0, 20],
        elR: [0, 0, 40],
      },
    });
  return smoothClip(
    [
      { f: 0, p: compose(r.hitHigh, { x: 0.02 }) },
      { f: 10, p: compose(r.hitHigh, { x: 0.0, j: { head: [0, 10, 6] } }) },
      { f: 22, p: compose(r.hitHigh, { x: at(SOFA_X - 0.35), y: 0.04 }), e: 'out' },
      { f: 27, p: compose(sit(0, 18), { y: SEAT_H + 0.02 - pivot }), e: 'in' },
      { f: 31, p: sit(0, 6), e: 'out' },
      { f: 40, p: sit(-10, 0) },
      { f: 60, p: sit(8, 0) },
      { f: 68, p: sit(0, 0) },
      // slaps: the head snaps away from the hand, the body follows, comes back
      { f: 70, p: sit(-55, 10), e: 'snap' },
      { f: 76, p: sit(-38, 6), e: 'out' },
      { f: 86, p: sit(-6, 0), e: 'inOut' },
      { f: 92, p: sit(55, 10), e: 'snap' },
      { f: 98, p: sit(38, 6), e: 'out' },
      { f: 110, p: sit(4, 0), e: 'inOut' },
      { f: 116, p: sit(-70, 24), e: 'snap' },
      // over the backrest with the tipping sofa
      { f: 122, p: compose(r.juggle, { x: at(SOFA_X + 0.25), y: 1.05 - pivot, rot: 70 }), e: 'out' },
      { f: 132, p: compose(r.juggle, { x: at(2.2), y: 0.75 - pivot, rot: 160 }) },
      { f: 140, p: compose(r.lying, { x: endX, rot: 90, s: { sq: 0.16 } }), e: 'in' },
      { f: 160, p: compose(r.lying, { x: endX, rot: 90, j: { head: [0, 14, -6] } }) },
    ],
    set.stance,
  );
}

/** Black leather two-seater, seat front facing -x, origin on the floor under the seat's back edge. */
function makeSofa(): THREE.Group {
  const g = new THREE.Group();
  const leather = new THREE.MeshToonMaterial({ color: 0x1a1a20 });
  const sheen = new THREE.MeshToonMaterial({ color: 0x2c2c36 });
  const wood = new THREE.MeshToonMaterial({ color: 0x3a2618 });
  const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);
  const seat = inked(rb(0.82, 0.2, 1.62, 0.07), sheen);
  seat.position.set(-0.41, SEAT_H - 0.1, 0);
  const base = inked(rb(0.9, 0.24, 1.8, 0.05), leather);
  base.position.set(-0.43, 0.22, 0);
  const back = inked(rb(0.28, 0.62, 1.8, 0.09), leather);
  back.position.set(0.02, SEAT_H + 0.22, 0);
  back.rotation.z = -0.12;
  g.add(seat, base, back);
  for (const z of [0.9, -0.9]) {
    const arm = inked(rb(0.9, 0.36, 0.22, 0.09), leather);
    arm.position.set(-0.42, SEAT_H + 0.08, z);
    g.add(arm);
  }
  // tufting buttons on the backrest
  const btn = new THREE.MeshBasicMaterial({ color: 0x0a0a0d });
  for (let i = 0; i < 6; i++)
    for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), btn);
      b.position.set(-0.13, SEAT_H + 0.08 + k * 0.26, -0.65 + i * 0.26);
      g.add(b);
    }
  for (const [x, z] of [
    [-0.82, 0.82],
    [-0.82, -0.82],
    [0.0, 0.82],
    [0.0, -0.82],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.1, 8), wood);
    leg.position.set(x, 0.05, z);
    g.add(leg);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function sofaProps(): CineProps {
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // tips over about the back-bottom edge
  group.add(pivot);
  const sofa = makeSofa();
  sofa.rotation.y = 0.32; // a little toward the camera so it reads as a sofa
  pivot.add(sofa);
  pivot.position.set(SOFA_X + 0.1, 0, -0.05);
  const signs = signTrack(group, [
    { f: 70, word: 'BATSCH!', fill: '#ff5a5a', w: 1.1, pos: [1.25, 1.9, 0.6] },
    { f: 92, word: 'BATSCH!', fill: '#ffb03a', w: 1.15, pos: [1.0, 2.0, 0.6] },
    { f: 116, word: 'BATSCH!!', fill: '#ffd23c', w: 1.6, pos: [1.25, 2.1, 0.6], len: 22 },
  ]);
  const tex = smokeTexture();
  const poof = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xece8f2, transparent: true, depthWrite: false }));
    s.userData.a = (i / 10) * Math.PI * 2;
    group.add(s);
    return s;
  });
  return {
    group,
    update(f: number, c: PropCtx) {
      const appear = pop(lin(f, 12, 18));
      const gone = f >= 150 ? 1 - lin(f, 150, 156) : 1;
      pivot.visible = f >= 12 && gone > 0.01;
      pivot.scale.setScalar(Math.max(0.01, appear * gone));
      // tips over backwards on the last slap
      pivot.rotation.z = -1.35 * ramp(f, 116, 128);
      // the poof when it appears and disappears
      const pk = (f >= 12 && f < 24 ? 1 - lin(f, 14, 24) : 0) + (f >= 150 && f < 160 ? 1 - lin(f, 152, 160) : 0);
      poof.forEach((s, i) => {
        s.visible = pk > 0.01;
        if (!s.visible) return;
        const a = s.userData.a + c.time;
        const r = 0.5 + (1 - pk) * 0.5;
        s.position.set(SOFA_X - 0.2 + Math.cos(a) * r, 0.45 + Math.sin(a * 1.3) * 0.25, Math.sin(a) * 0.5);
        s.scale.setScalar(0.6 + 0.2 * Math.sin(i));
        s.material.opacity = pk;
      });
      signs(f);
    },
  };
}

export const SOFA_SLAPS: CineDef = {
  frames: 160,
  startDx: 0.95,
  camera: [
    { f: 0, pos: [0.4, 1.4, 3.6], target: [0.55, 1.25, 0], fov: 36, cut: true },
    { f: 12, pos: [0.9, 1.6, 4.6], target: [0.9, 1.1, 0], fov: 40, cut: true },
    { f: 30, pos: [1.0, 1.55, 4.3], target: [1.0, 1.0, 0], fov: 40 },
    // the stare: 3/4 from the sofa side, both in frame
    { f: 40, pos: [2.6, 1.45, 2.6], target: [0.9, 1.25, 0], fov: 34, cut: true },
    { f: 62, pos: [2.4, 1.5, 2.4], target: [0.9, 1.25, 0], fov: 32 },
    // slap 1: low profile close-up
    { f: 64, pos: [1.1, 1.1, 2.2], target: [1.1, 1.2, 0], fov: 32, cut: true },
    { f: 80, pos: [1.15, 1.12, 2.0], target: [1.1, 1.2, 0], fov: 30 },
    // slap 2: from behind the sofa
    { f: 82, pos: [2.9, 1.5, -1.6], target: [0.9, 1.25, 0], fov: 34, cut: true },
    { f: 104, pos: [2.8, 1.5, -1.4], target: [0.9, 1.25, 0], fov: 32 },
    // the big one: wide, so the tipping sofa reads
    { f: 106, pos: [1.2, 1.4, 4.8], target: [1.3, 1.0, 0], fov: 40, cut: true },
    { f: 140, pos: [1.3, 1.35, 5.4], target: [1.5, 0.9, 0], fov: 40 },
    // the flex
    { f: 142, pos: [0.9, 1.5, 2.6], target: [0.3, 1.45, 0], fov: 34, cut: true },
    { f: 160, pos: [0.85, 1.5, 2.3], target: [0.3, 1.5, 0], fov: 32 },
  ],
  atk: SOFA_ATK,
  def: sofaDef,
  props: sofaProps,
  dim: (f) => (f < 150 ? 0.55 : 0.4),
  fx: [
    { f: 1, run: (c) => (c.audio.whoosh(2), c.view.director.shake(0.2)) },
    { f: 14, run: (c) => (c.audio.boom(), c.view.toon.puff(c.def.x, 0, 8, 0.9, C(0xece8f2), 0.3, 0.6)) },
    { f: 27, run: (c) => (c.audio.slam(), c.view.director.shake(0.25)) },
    { f: 52, run: (c) => c.audio.crowdSwell(0.4) },
    ...[70, 92, 116].map((f, i) => ({
      f,
      run: (c: FxCtx) => {
        c.audio.slap(i === 2 ? 2 : 1);
        const p = c.def.clone().add(new THREE.Vector3(0, 0.75, 0.2));
        c.view.vfx.sparks(p.x, p.y, 16 + i * 10, C(0xffffff), 6 + i * 2, -c.facing, 1.5);
        c.view.toon.impact(p.x, p.y, 0.9 + i * 0.35, C(i === 2 ? 0xffd23c : 0xff6a6a), { spikes: 12, life: 0.24 + i * 0.05 });
        c.view.toon.speedLines(p.x, p.y, C(0xffffff), 0.25, 0.55);
        c.view.director.shake(0.3 + i * 0.25);
        c.view.director.punch(2 + i * 2);
        if (i === 2) {
          c.view.toon.impactFrame(0.07);
          c.view.screenFlash = 0.7;
          c.audio.crowdSwell(0.7);
        }
      },
    })),
    { f: 126, run: (c) => (c.audio.slam(), c.view.toon.puff(c.def.x, 0, 10, 1.2, C(0xe9dfd0), 0.28, 0.7)) },
    { f: 150, run: (c) => c.audio.sparkle() },
  ],
};

// =================================================================== LACAZETTE — 70 SCHÜSSE (signature)
// The off-roader crossed the stage and caught them: it drifts round so the driver's side faces them (window opens),
// 70 shots from the window (sim hits 64-104 every 10, the last burst 116), a counter runs up to 70, then the line
// "…DAS WAREN 70 SCHÜSSE AUS DEM G-WAGON" and the car pulls away. Lacazette watches, arms crossed. startDx 3.0.
const LS = JAZEEK_ANIMS.stance;
const CAR_X = 4.9;
const CAR_Z = -0.55;
const SHOT0 = 58;
const SHOT1 = 118;

const crossedL: PoseDef = { j: { chest: [0, -8, 6], shL: [10, 0, 66], elL: [0, 0, 116], shR: [-10, 0, 66], elR: [0, 0, 116], head: [0, -10, 6] } };
const glassesDown: PoseDef = { aim: { shR: [0.3, 0.3, 0.55], elR: [-0.2, 1, 0.25] }, j: { head: [0, -6, -14], chest: [0, -8, 2], shL: [10, 0, 60], elL: [0, 0, 110] } };
const GW_ATK = smoothClip(
  [
    { f: 0, p: compose(LS, { j: { head: [0, -6, 4] } }) },
    { f: 20, p: crossedL, e: 'inOut' },
    { f: 118, p: compose(crossedL, { j: { head: [0, -12, 8] } }) },
    { f: 128, p: glassesDown, e: 'inOut' },
    { f: 146, p: glassesDown },
    { f: 158, p: compose(crossedL, { j: { head: [0, 0, 12] } }), e: 'inOut' },
    { f: 170, p: crossedL },
  ],
  LS,
);

function gwagonDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const START = 3.0;
  const endX = START - 2.0;
  // standing in the hail: alternating jolts, slowly pushed toward Lacazette
  const keys: { f: number; p: PoseDef; e?: 'snap' | 'out' | 'in' | 'inOut' }[] = [
    { f: 0, p: compose(r.hitHigh, { x: 0 }) },
    { f: 16, p: compose(r.hitHigh, { x: 0.05, j: { head: [0, -20, 10] } }) },
    { f: 40, p: compose(set.stance, { x: 0.05, j: { head: [0, -30, 0], chest: [0, -20, 0] } }), e: 'inOut' },
    { f: 54, p: compose(r.blockStand, { x: 0.05 }), e: 'inOut' },
  ];
  for (let f = SHOT0, k = 0; f < 116; f += 5, k++) {
    const side = k % 2 ? 1 : -1;
    keys.push({ f, p: compose(k % 3 === 2 ? r.hitGut : r.hitHigh, { x: 0.05 + (f - SHOT0) * 0.006, j: { head: [0, side * 24, 14], chest: [0, side * 16, 10] } }), e: 'snap' });
  }
  keys.push(
    { f: 116, p: compose(r.juggle, { x: 0.6, y: 0.5, rot: 25 }), e: 'snap' },
    { f: 124, p: compose(r.juggle, { x: endX - 0.1, y: 0.35, rot: 70 }), e: 'out' },
    { f: 130, p: compose(r.lying, { x: endX, rot: 90, s: { sq: 0.16 } }), e: 'in' },
    { f: 170, p: compose(r.lying, { x: endX, rot: 90 }) },
  );
  return smoothClip(keys, set.stance);
}

function gwagonProps(): CineProps {
  const group = new THREE.Group();
  const car = makeOffroader();
  group.add(car);
  const win = car.userData.window as THREE.Object3D;
  const wheels = car.userData.wheels as THREE.Object3D[];
  // muzzle flashes + tracers from the window toward the victim
  const flashMat = new THREE.SpriteMaterial({ map: starTexture(), color: 0xfff1b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const flashes = Array.from({ length: 3 }, () => {
    const s = new THREE.Sprite(flashMat);
    s.renderOrder = 12;
    group.add(s);
    return s;
  });
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfff3b8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.025), tracerMat);
    m.renderOrder = 11;
    group.add(m);
    return m;
  });
  const lamp = new THREE.PointLight(0xffd27a, 0, 6, 2);
  // the counter and the line
  const counter: THREE.Sprite[] = [];
  let lastCount = -1;
  let line: THREE.Sprite | null = null;
  const tmp = new THREE.Vector3();
  let last = -1;
  return {
    group,
    lights: [lamp],
    update(f: number, c: PropCtx) {
      // car path: comes back in from the left lane, drifts round (nose into the background) and stops at CAR_X
      const arrive = ramp(f, 0, 26);
      const leave = ramp(f, 140, 170);
      const x = lerp(1.0, CAR_X, arrive) + leave * 5.5;
      const z = lerp(0.9, CAR_Z, arrive) - leave * 4.5;
      car.position.set(x, 0, z);
      const yaw = lerp(0, Math.PI / 2, ramp(f, 4, 28)) - leave * 0.6;
      car.rotation.y = yaw;
      const roll = f < 30 ? Math.sin(lin(f, 4, 30) * Math.PI) * 0.06 : 0;
      car.rotation.z = roll;
      const spin = f < 30 ? -c.time * 30 : f > 140 ? -c.time * 34 : 0;
      for (const w of wheels) w.rotation.z = spin;
      // shots
      const shooting = f >= SHOT0 && f < SHOT1;
      win.getWorldPosition(tmp);
      group.worldToLocal(tmp);
      const vic = new THREE.Vector3(c.defLocal[0], 1.25, 0);
      flashes.forEach((s, i) => {
        const on = shooting && Math.sin(c.time * 60 + i * 2.1) > 0.2;
        s.visible = on;
        if (!on) return;
        s.position.copy(tmp).add(new THREE.Vector3(-0.15 - i * 0.05, (i - 1) * 0.06, 0.1));
        s.scale.setScalar(0.4 + 0.25 * Math.random());
        s.material.rotation = Math.random() * 6;
      });
      tracers.forEach((m, i) => {
        const on = shooting && ((c.time * 30 + i * 0.25) % 1) < 0.5;
        m.visible = on;
        if (!on) return;
        const tgt = vic.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 0));
        const mid = tmp.clone().lerp(tgt, 0.5 + (Math.random() - 0.5) * 0.4);
        m.position.copy(mid);
        const d = tgt.clone().sub(tmp);
        m.scale.set(d.length() * 0.35, 1, 1);
        m.rotation.set(0, 0, Math.atan2(d.y, d.x));
      });
      lamp.intensity = shooting ? 3 + Math.random() * 4 : 0;
      lamp.position.copy(c.world(tmp.x, tmp.y, tmp.z));
      // the counter: 0 -> 70 while shooting, big comic numbers over the car
      const n = f < SHOT0 ? -1 : Math.min(70, Math.round(lin(f, SHOT0, SHOT1 - 2) * 70));
      if (n !== lastCount) {
        for (const s of counter) group.remove(s);
        counter.length = 0;
        if (n >= 0 && f < 140) {
          const s = textSprite(String(n), { width: 1.4, color: n >= 70 ? '#ffd23c' : '#ffffff', font: '"Rubik Wet Paint", "Anton", sans-serif' });
          s.position.set(CAR_X - 0.6, 2.75, 0.3);
          group.add(s);
          counter.push(s);
        }
        lastCount = n;
      }
      for (const s of counter) {
        const k = 1 + 0.15 * Math.sin(c.time * 30);
        s.scale.set(1.4 * k, 1.4 * k * 0.205, 1);
        s.visible = f < 140;
      }
      // the line
      if (f >= 120 && !line) {
        line = textSprite('…DAS WAREN 70 SCHÜSSE\nAUS DEM G-WAGON', { width: 4.6, color: '#ffd23c', stroke: '#0b0910' });
        group.add(line);
      }
      if (line) {
        const k = pop(lin(f, 120, 126)) * (1 - lin(f, 160, 168));
        line.visible = f >= 120 && f < 168;
        line.position.set(2.4, 2.6, 0.8);
        line.scale.set(4.6 * k, 4.6 * k * 0.33, 1);
        line.material.opacity = Math.min(1, k * 1.2);
      }
      if (f < 2 && line) {
        group.remove(line);
        line = null;
      }
      // per-frame bits: tyre smoke during the drift, shell casings, sparks on the victim
      const fi = Math.floor(f);
      if (fi < last) last = -1;
      if (fi === last) return;
      for (let k = last + 1; k <= fi; k++) {
        if (k < 30 || k > 140) {
          const rear = c.world(x - Math.cos(yaw) * 1.5, 0.25, z + Math.sin(yaw) * 1.5);
          c.view.fx.smoke.spawn(rear, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.4), 0xd8d4e0, 0.3, 1.2, 2.2, Math.random() - 0.5);
        }
        if (k >= SHOT0 && k < SHOT1) {
          const w = c.world(tmp.x, tmp.y, tmp.z);
          c.view.vfx.sparks(w.x, w.y, 2, C(0xffd27a), 3, -c.facing, 0.8);
          const v = c.world(vic.x, vic.y + (Math.random() - 0.5) * 0.6, 0.1);
          c.view.vfx.sparks(v.x, v.y, 3, C(0xffffff), 4, -c.facing, 1);
        }
      }
      last = fi;
    },
  };
}

export const SEVENTY_SHOTS: CineDef = {
  frames: 170,
  startDx: 3.0,
  camera: [
    // the drift: wide, low
    { f: 0, pos: [2.6, 0.9, 6.6], target: [3.4, 0.9, 0], fov: 42, cut: true },
    { f: 30, pos: [3.0, 1.0, 6.0], target: [3.8, 1.0, 0], fov: 42 },
    // over the victim's shoulder toward the driver's window
    { f: 32, pos: [1.9, 1.7, 1.4], target: [4.6, 1.45, -0.6], fov: 36, cut: true },
    { f: 56, pos: [2.1, 1.65, 1.2], target: [4.6, 1.5, -0.6], fov: 34 },
    // the hail: 3/4 front, car and victim
    { f: 58, pos: [3.6, 1.4, 4.4], target: [3.6, 1.35, 0], fov: 40, cut: true },
    { f: 86, pos: [3.4, 1.35, 3.9], target: [3.6, 1.35, 0], fov: 38 },
    { f: 88, pos: [5.2, 1.6, 2.2], target: [3.2, 1.3, 0], fov: 36, cut: true },
    { f: 114, pos: [5.0, 1.55, 2.0], target: [3.2, 1.3, 0], fov: 34 },
    // the line: wide on everything
    { f: 116, pos: [2.4, 1.8, 7.6], target: [2.4, 1.5, 0], fov: 44, cut: true },
    { f: 150, pos: [2.4, 1.75, 7.0], target: [2.4, 1.45, 0], fov: 44 },
    // Lacazette, cool
    { f: 152, pos: [0.9, 1.65, 2.2], target: [0.1, 1.6, 0], fov: 30, cut: true },
    { f: 170, pos: [0.8, 1.65, 2.0], target: [0.1, 1.62, 0], fov: 28 },
  ],
  atk: GW_ATK,
  def: gwagonDef,
  props: gwagonProps,
  dim: (f) => (f < 150 ? 0.6 : 0.4),
  fx: [
    { f: 1, run: (c) => (c.audio.carIn(), c.view.director.shake(0.3)) },
    { f: 30, run: (c) => (c.audio.slam(), c.view.director.shake(0.2)) },
    { f: 50, run: (c) => c.audio.riser() },
    ...Array.from({ length: 12 }, (_, i) => ({ f: SHOT0 + i * 5, run: (c: FxCtx) => c.audio.shots(6) })),
    ...[64, 74, 84, 94, 104].map((f) => ({ f, run: (c: FxCtx) => hitFx(c, 1, 0xffd27a) })),
    {
      f: 116,
      run: (c) => {
        hitFx(c, 3, 0xffd23c);
        c.audio.boom();
        c.view.toon.impactFrame(0.06);
        c.view.director.shake(0.9);
        c.view.screenFlash = 0.6;
      },
    },
    { f: 121, run: (c) => (c.audio.stab(), c.audio.crowdSwell(0.8)) },
    { f: 142, run: (c) => c.audio.carIn() },
  ],
};

// =================================================================== JAZEEK — NINETYNINE (signature)
// The chain whip landed: he pulls the chain over his head and swings the pendant, throws it — it grows into a giant
// iced-out 99 that slams them up (34), splits into two nines orbiting them (58, 70, 82), joins again behind them,
// and he flies through it with a kick (112): the 99 shatters into diamonds. startDx 1.1, endDx 2.6.
const JS = JAZEEK_ANIMS.stance;
const NINE_H = 2.3;

/** One "9" as a tube (loop + tail), centred on its loop; height ~1 (scaled up). */
function nineCurve(): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const r = 0.26;
  const cy = 0.22;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI * 0.05 + (i / 28) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, cy + Math.sin(a) * r * 1.08, 0));
  }
  path.add(new THREE.CatmullRomCurve3(pts));
  path.add(new THREE.CatmullRomCurve3([new THREE.Vector3(r, cy, 0), new THREE.Vector3(r * 0.98, -0.1, 0), new THREE.Vector3(r * 0.4, -0.42, 0), new THREE.Vector3(-r * 0.6, -0.5, 0)]));
  return path;
}

function makeNine(): THREE.Group {
  const g = new THREE.Group();
  const curve = nineCurve();
  const ice = new THREE.MeshToonMaterial({ color: 0xe6f6ff, emissive: 0x4a7ea0, emissiveIntensity: 0.55 });
  const tube = inked(new THREE.TubeGeometry(curve, 80, 0.085, 12, false), ice, 1.12);
  g.add(tube);
  // iced-out: faceted stones along the tube
  const stones = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x9fdcff, emissiveIntensity: 0.6 }), 90);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const p = curve.getPointAt(t);
    const n = new THREE.Vector3(Math.cos(i * 2.4), Math.sin(i * 2.4) * 0.6, Math.sin(i * 1.7));
    p.add(n.normalize().multiplyScalar(0.08));
    q.setFromEuler(new THREE.Euler(i, i * 0.7, i * 1.3));
    m.compose(p, q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + ((i * 7) % 5) * 0.1));
    stones.setMatrixAt(i, m);
  }
  g.add(stones);
  return g;
}

const chainOverhead = (k: number): PoseDef => ({
  y: 0.02,
  aim: { shR: [0.2, 1, 0.1 + 0.3 * Math.sin(k * Math.PI * 2)], elR: [0.3 * Math.cos(k * Math.PI * 2), 1, 0.3 * Math.sin(k * Math.PI * 2)], shL: [0.4, -0.7, -0.4], elL: [0.5, 0.6, -0.2], face: 0.8 },
  j: { head: [0, 0, 8], chest: [0, -6, 6] },
});
const throwPose: PoseDef = {
  x: 0.12,
  aim: { shR: [1, 0.25, 0.05], elR: [1, 0.2, 0.05], shL: [-0.3, -1, -0.3], elL: [0.3, -0.7, -0.2], face: 0.8 },
  j: { hips: [0, 14, 0], spine: [0, 8, -12], chest: [0, 20, -10], thL: [12, 14, 36], knL: [0, 0, -40], thR: [-12, 12, -30], knR: [0, 0, -6] },
};
const conduct = (k: number): PoseDef => ({
  aim: { shR: [0.6, 0.6 + 0.2 * k, 0.4], elR: [0.6, 0.8, 0.3 - 0.4 * k], shL: [0.6, 0.6 - 0.2 * k, -0.4], elL: [0.6, 0.8, -0.3 + 0.4 * k], face: 0.9 },
  j: { chest: [0, (k - 0.5) * 16, 8], head: [0, (k - 0.5) * 10, 10] },
});
const flyKick: PoseDef = {
  x: 1.4,
  y: 1.35,
  rot: -20,
  aim: { shL: [-0.4, 0.6, -0.4], elL: [-0.2, 0.8, -0.3], shR: [-0.5, 0.3, 0.4], elR: [-0.3, 0.6, 0.3] },
  j: { spine: [0, 0, 12], thR: [-10, 0, 95], knR: [0, 0, -4], ftR: [0, 0, -10], thL: [10, 0, 20], knL: [0, 0, -110] },
};
const mvp: PoseDef = { aim: { shR: [0.3, 1, 0.2], elR: [0.25, 1, 0.15], shL: [0.4, -0.8, -0.3], elL: [0.5, 0.6, -0.2], face: 0.7 }, j: { head: [0, 0, 14], chest: [0, -6, 8] } };

const NINETY_ATK = smoothClip(
  [
    { f: 0, p: compose(JS, { x: 0.1 }) },
    { f: 6, p: chainOverhead(0), e: 'out' },
    { f: 10, p: chainOverhead(0.25) },
    { f: 14, p: chainOverhead(0.5) },
    { f: 18, p: chainOverhead(0.75) },
    { f: 22, p: chainOverhead(1) },
    { f: 28, p: throwPose, e: 'snap' },
    { f: 40, p: compose(throwPose, { x: 0.08 }) },
    { f: 48, p: conduct(0), e: 'inOut' },
    { f: 58, p: conduct(1), e: 'snap' },
    { f: 70, p: conduct(0), e: 'snap' },
    { f: 82, p: conduct(1), e: 'snap' },
    // run-up and the flying kick through the 99
    { f: 92, p: compose(JS, { x: 0.35, y: -0.08, j: { spine: [0, 0, -16], thL: [12, 14, 60], knL: [0, 0, -70] } }), e: 'inOut' },
    { f: 100, p: { x: 0.8, y: 0.8, rot: -10, j: { thL: [10, 0, 80], knL: [0, 0, -120], thR: [-10, 0, 40], knR: [0, 0, -100], shL: [20, 0, 120], shR: [-20, 0, 120] } }, e: 'out' },
    { f: 112, p: flyKick, e: 'snap' },
    { f: 118, p: compose(flyKick, { x: 1.55, y: 1.25 }) },
    { f: 132, p: compose(JS, { x: 0.9, y: -0.12, j: { thL: [12, 14, 60], knL: [0, 0, -80] } }), e: 'in' },
    { f: 144, p: compose(mvp, { x: 0.9 }), e: 'out' },
    { f: 160, p: compose(mvp, { x: 0.9, y: 0.02 }) },
  ],
  JS,
);

function ninetyDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const START = 1.1;
  const at = (ax: number) => START - ax;
  const endX = at(2.6);
  const VX = 1.9; // where they float (attacker-local)
  const float = (h: number, rot: number, jerk = 0): PoseDef =>
    compose(r.juggle, { x: at(VX) + jerk * 0.05, y: h, rot, j: { head: [0, jerk * 20, 14], shL: [70, 0, 60 + jerk * 20], shR: [-70, 0, 50 - jerk * 20], thL: [8, 0, 20], knL: [0, 0, -30] } });
  return smoothClip(
    [
      { f: 0, p: compose(r.hitHigh, { x: 0.02 }) },
      { f: 16, p: compose(r.hitHigh, { x: -0.02, j: { head: [0, 14, 8] } }) },
      { f: 30, p: compose(set.stance, { x: 0, j: { head: [0, -10, -16] } }), e: 'inOut' },
      { f: 34, p: float(0.9, 20, 1), e: 'snap' },
      { f: 48, p: float(1.3, 8), e: 'out' },
      { f: 58, p: float(1.25, 30, -1), e: 'snap' },
      { f: 64, p: float(1.35, 12) },
      { f: 70, p: float(1.3, -10, 1), e: 'snap' },
      { f: 76, p: float(1.4, 10) },
      { f: 82, p: float(1.35, 40, -1), e: 'snap' },
      { f: 104, p: float(1.45, 18), e: 'inOut' },
      { f: 112, p: compose(r.juggle, { x: at(VX + 0.2), y: 1.5, rot: 90 }), e: 'snap' },
      { f: 124, p: compose(r.juggle, { x: at(2.4), y: 1.0, rot: 240 }), e: 'out' },
      { f: 134, p: compose(r.lying, { x: endX, rot: 450, s: { sq: 0.16 } }), e: 'in' },
      { f: 160, p: compose(r.lying, { x: endX, rot: 450 }) },
    ],
    set.stance,
  );
}

function ninetyProps(): CineProps {
  const group = new THREE.Group();
  const nines = [makeNine(), makeNine()];
  for (const n of nines) group.add(n);
  const chainMat = new THREE.MeshToonMaterial({ color: 0xe9eef5, emissive: 0x6a8aa8, emissiveIntensity: 0.4 });
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), chainMat);
  group.add(chain);
  const sparkMat = new THREE.SpriteMaterial({ map: starTexture(), color: 0xeaffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = Array.from({ length: 10 }, () => {
    const s = new THREE.Sprite(sparkMat);
    s.renderOrder = 12;
    group.add(s);
    return s;
  });
  // shards after the kick
  const shardMat = new THREE.MeshToonMaterial({ color: 0xf2fbff, emissive: 0x8ad6ff, emissiveIntensity: 0.6 });
  const shards = Array.from({ length: 34 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 + (i % 4) * 0.025, 0), shardMat);
    m.userData.v = new THREE.Vector3((Math.random() - 0.3) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 3);
    group.add(m);
    return m;
  });
  const banner = { s: null as THREE.Sprite | null };
  const light = new THREE.PointLight(0x9fe6ff, 0, 8, 2);
  const tmp = new THREE.Vector3();
  return {
    group,
    lights: [light],
    update(f: number, c: PropCtx) {
      const atk = c.rigs[0];
      const hand = atk ? atk.joints.haR.getWorldPosition(tmp).clone() : new THREE.Vector3();
      const handL = group.worldToLocal(hand.clone());
      const vic = new THREE.Vector3(1.9, 1.35, 0);
      // 0-28: the pendant swings on its chain over his head; 28-34 flies and grows; 34-48 the 99 stands
      let size = 0.12;
      const center = new THREE.Vector3();
      if (f < 28) {
        const a = c.time * 14;
        center.copy(handL).add(new THREE.Vector3(Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45));
      } else if (f < 34) {
        const k = lin(f, 28, 34);
        center.copy(handL).lerp(new THREE.Vector3(1.9, NINE_H * 0.5, -0.2), ease(k));
        center.y += Math.sin(k * Math.PI) * 0.6;
        size = lerp(0.12, NINE_H, k * k);
      } else {
        center.set(1.9, NINE_H * 0.5, -0.25);
        size = NINE_H;
      }
      const together = f < 40 || (f >= 90 && f < 112);
      const split = f >= 40 && f < 90;
      const show = f < 112;
      nines.forEach((n, i) => {
        n.visible = show;
        if (!show) return;
        n.scale.setScalar(size / 1.0);
        if (together) {
          const off = (i ? 0.33 : -0.33) * size;
          n.position.set(center.x + off, center.y, center.z);
          n.rotation.set(0, f < 34 ? c.time * 8 : 0, f < 34 ? Math.sin(c.time * 10) * 0.3 : 0);
          if (f >= 90) {
            // rejoined behind them, hovering, pulsing
            n.position.set(vic.x + off * 0.8, 1.5, -0.7);
            n.scale.setScalar(size * 0.85 * (1 + 0.04 * Math.sin(c.time * 12)));
          }
        } else if (split) {
          // orbit the floating victim; each nine swings in for its hit (58 A, 70 B, 82 both)
          const ph = c.time * 2.4 + i * Math.PI;
          let rr = 1.4;
          const smash = (h: number) => Math.max(0, 1 - Math.abs(f - h) / 5);
          rr -= 0.9 * (i === 0 ? Math.max(smash(58), smash(82)) : Math.max(smash(70), smash(82)));
          n.position.set(vic.x + Math.cos(ph) * rr, vic.y + Math.sin(ph * 0.7) * 0.3 - 0.4, Math.sin(ph) * rr);
          n.rotation.set(0, -ph, Math.sin(ph) * 0.4);
          n.scale.setScalar(size * 0.7);
        }
      });
      // the chain line from his hand to the pendant while it swings
      chain.visible = f < 28;
      if (chain.visible) {
        const d = center.clone().sub(handL);
        chain.position.copy(handL).add(d.clone().multiplyScalar(0.5));
        chain.scale.set(1, d.length(), 1);
        chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      }
      // glitter around the 99
      sparks.forEach((s, i) => {
        s.visible = show && f > 4;
        if (!s.visible) return;
        const a = c.time * 3 + i * 0.63;
        const src = f >= 40 && f < 90 ? vic : center;
        s.position.set(src.x + Math.cos(a) * size * 0.45, src.y + Math.sin(a * 1.3) * size * 0.5, src.z + 0.3);
        s.scale.setScalar(0.12 + 0.1 * Math.abs(Math.sin(c.time * 9 + i)));
      });
      light.intensity = show ? 2 + Math.sin(c.time * 8) : f < 130 ? 6 * (1 - lin(f, 112, 130)) : 0;
      light.position.copy(c.world(center.x, center.y, 0.6));
      // shatter
      shards.forEach((m) => {
        m.visible = f >= 112 && f < 150;
        if (!m.visible) return;
        const t = (f - 112) / 30;
        const v = m.userData.v as THREE.Vector3;
        m.position.set(vic.x + v.x * t, 1.5 + v.y * t - 9.8 * t * t * 0.5 * 1.2, -0.4 + v.z * t);
        m.rotation.set(f * 0.3, f * 0.2, 0);
      });
      // NINETYNINE banner
      if (f >= 112 && !banner.s) {
        banner.s = textSprite('NINETYNINE', { width: 4.2, color: '#bff0ff', stroke: '#06121c', font: '"Rubik Wet Paint", "Anton", sans-serif' });
        group.add(banner.s);
      }
      if (banner.s) {
        const k = pop(lin(f, 112, 118)) * (1 - lin(f, 150, 158));
        banner.s.visible = f >= 112 && f < 158;
        banner.s.position.set(1.6, 2.7, 0.8);
        banner.s.scale.set(4.2 * k, 4.2 * k * 0.18, 1);
      }
      if (f < 2 && banner.s) {
        group.remove(banner.s);
        banner.s = null;
      }
    },
  };
}

export const NINETYNINE: CineDef = {
  frames: 160,
  startDx: 1.1,
  camera: [
    // the lasso
    { f: 0, pos: [0.6, 1.5, 3.2], target: [0.4, 1.6, 0], fov: 36, cut: true },
    { f: 26, pos: [0.4, 1.3, 3.6], target: [0.5, 1.8, 0], fov: 38 },
    // the throw and the slam: wide
    { f: 28, pos: [1.0, 1.3, 5.2], target: [1.3, 1.3, 0], fov: 42, cut: true },
    { f: 40, pos: [1.1, 1.4, 5.0], target: [1.6, 1.4, 0], fov: 42 },
    // the orbit: the camera circles with the nines
    { f: 42, pos: [3.8, 1.2, 3.2], target: [1.9, 1.3, 0], fov: 40, cut: true },
    { f: 66, pos: [1.9, 0.9, 4.6], target: [1.9, 1.35, 0], fov: 40 },
    { f: 88, pos: [0.0, 1.3, 3.6], target: [1.9, 1.35, 0], fov: 40 },
    // the run-up and the kick: low, side
    { f: 90, pos: [1.2, 0.6, 4.2], target: [1.2, 1.3, 0], fov: 44, cut: true },
    { f: 110, pos: [1.6, 0.8, 4.4], target: [1.7, 1.4, 0], fov: 44 },
    // shatter + banner: wide
    { f: 112, pos: [1.6, 1.6, 6.4], target: [1.6, 1.6, 0], fov: 46, cut: true },
    { f: 140, pos: [1.6, 1.4, 6.0], target: [1.6, 1.2, 0], fov: 44 },
    // MVP
    { f: 142, pos: [1.6, 1.5, 2.6], target: [0.9, 1.55, 0], fov: 32, cut: true },
    { f: 160, pos: [1.5, 1.5, 2.3], target: [0.9, 1.6, 0], fov: 30 },
  ],
  atk: NINETY_ATK,
  def: ninetyDef,
  props: ninetyProps,
  dim: (f) => (f < 150 ? 0.62 : 0.4),
  fx: [
    { f: 2, run: (c) => (c.audio.sparkle(), c.audio.whoosh(1)) },
    ...[8, 14, 20].map((f) => ({ f, run: (c: FxCtx) => c.audio.whoosh(0) })),
    { f: 28, run: (c) => (c.audio.riser(), c.audio.whoosh(2)) },
    ...[34, 58, 70, 82].map((f, i) => ({
      f,
      run: (c: FxCtx) => {
        c.audio.hit(2, false);
        c.audio.sparkle();
        hitFx(c, i === 0 ? 2 : 1, 0x9fe6ff);
        c.view.vfx.sparks(c.def.x, c.def.y + 0.6, 24, C(0xe6fbff), 7, -c.facing, 2);
      },
    })),
    { f: 92, run: (c) => c.audio.whoosh(2) },
    {
      f: 112,
      run: (c) => {
        c.audio.boom();
        c.audio.stab();
        const x = c.def.x;
        c.view.vfx.ring(x, 1.5, 3, C(0xbff0ff), 0.45);
        c.view.vfx.sparks(x, 1.5, 80, C(0xe6fbff), 14, 1, 2);
        c.view.toon.impactFrame(0.08);
        c.view.after(0.08, () => c.view.toon.impact(x, 1.5, 2.4, C(0x9fe6ff), { spikes: 14, life: 0.45 }));
        c.view.director.shake(1);
        c.view.director.punch(5);
        c.view.screenFlash = 1;
        c.audio.crowdSwell(0.8);
      },
    },
    { f: 134, run: (c) => (c.audio.slam(), c.view.toon.puff(c.def.x, 0, 10, 1.2, C(0xe9dfd0), 0.26, 0.7)) },
    { f: 144, run: (c) => (c.audio.chime(), c.view.vfx.confetti(c.atk.x, 3.2, 40)) },
  ],
};

// =================================================================== BONEZ — OHNE MEIN TEAM (signature)
// Palms rise on the slam (as Palmen-Bassdrop, hit 30); dazed, the opponent pulls out a phone to film: HANDYVERBOT —
// he slaps it away (62); "OHNE MEIN TEAM": four of his crew storm in and work them over (84, 96); they step aside,
// one huge right hand sends the opponent flying through the palms (130). startDx 1.1, endDx 2.6.
const BS2 = BONEZ_ANIMS.stance;
const bR2 = { crouch: BONEZ_ANIMS.r.crouch };
const slamPose = sampleDef(BONEZ_ANIMS.moves.bon_palm, 20);
const bigRight: PoseDef = {
  x: 0.55,
  s: { aR: 0.12 },
  aim: { shR: [1, 0.25, -0.05], elR: [1, 0.22, -0.05], shL: [-0.2, -1, -0.3], elL: [0.3, -0.7, -0.2], face: 0.9 },
  j: { hips: [0, 16, 0], spine: [0, 10, -14], chest: [0, 22, -12], thL: [12, 14, 44], knL: [0, 0, -46], thR: [-12, 12, -36], knR: [0, 0, -8], ftR: [0, 0, 30] },
};
const phoneSlap: PoseDef = {
  x: 0.42,
  aim: { shR: [0.9, 0.35, -0.3], elR: [0.9, 0.3, -0.4], face: 0.8 },
  j: { chest: [0, -24, -4], hips: [0, -12, 0] },
};
const pointBack: PoseDef = { aim: { shL: [-0.9, 0.25, -0.2], elL: [-0.9, 0.25, -0.2], face: 0.3 }, j: { head: [0, 30, 6], chest: [0, 14, 4] } };
const crossedB: PoseDef = { j: { chest: [0, -6, 6], shL: [10, 0, 66], elL: [0, 0, 112], shR: [-10, 0, 66], elR: [0, 0, 112], head: [0, -14, 10] } };

const TEAM_ATK = smoothClip(
  [
    { f: 0, p: slamPose },
    { f: 24, p: compose(slamPose, { j: { head: [0, 0, 16] } }) },
    { f: 30, p: compose(slamPose, { y: (slamPose.y ?? 0) + 0.04, j: { head: [0, 0, 22] } }), e: 'snap' },
    { f: 40, p: bR2.crouch },
    { f: 48, p: compose(BONEZ_POSES.grin, { x: 0.1, j: { head: [0, -10, 4] } }), e: 'inOut' },
    { f: 56, p: compose(BS2, { x: 0.35, j: { chest: [0, 30, 2], shR: [-40, 0, -10], elR: [0, 0, 80] } }), e: 'out' },
    { f: 62, p: phoneSlap, e: 'snap' },
    { f: 70, p: compose(phoneSlap, { x: 0.4, j: { head: [0, 20, 4] } }) },
    { f: 76, p: compose(pointBack, { x: 0.3 }), e: 'inOut' },
    { f: 90, p: compose(crossedB, { x: 0.2 }), e: 'inOut' },
    { f: 112, p: compose(crossedB, { x: 0.3, j: { head: [0, 0, 14] } }) },
    { f: 122, p: compose(BS2, { x: 0.25, y: -0.06, j: { chest: [0, 40, 2], spine: [0, 16, 0], shR: [-50, 0, -30], elR: [0, 0, 110] } }), e: 'out' },
    { f: 130, p: bigRight, e: 'snap' },
    { f: 140, p: compose(bigRight, { x: 0.6 }) },
    { f: 152, p: compose(BONEZ_POSES.grin, { x: 0.4 }), e: 'inOut' },
    { f: 170, p: compose(crossedB, { x: 0.4 }) },
  ],
  BS2,
);

function teamDef(set: AnimSet): Clip {
  const r = victimReactions(set);
  const START = 1.1;
  const at = (ax: number) => START - ax;
  const endX = at(2.6);
  const filming: PoseDef = compose(set.stance, {
    x: -0.05,
    aim: { shR: [0.6, 0.5, 0.35], elR: [0.2, 0.9, 0.25], shL: [0.4, -0.8, -0.3], elL: [0.4, 0.6, -0.2], face: 0.4 },
    j: { head: [0, -10, -6] },
  });
  return smoothClip(
    [
      { f: 0, p: r.hitLow },
      { f: 26, p: compose(r.hitLow, { x: -0.03, y: -0.05 }) },
      { f: 30, p: compose(r.juggle, { x: -0.05, y: 0.45, rot: 8 }), e: 'snap' },
      { f: 38, p: compose(r.hitHigh, { x: -0.08 }), e: 'in' },
      { f: 46, p: filming, e: 'inOut' },
      { f: 60, p: compose(filming, { j: { head: [0, -4, -2] } }) },
      { f: 62, p: compose(r.hitHigh, { x: -0.06, j: { head: [0, -30, 10] } }), e: 'snap' },
      { f: 72, p: compose(set.stance, { x: -0.05, j: { head: [0, 30, 0] } }), e: 'inOut' },
      // the crew: knocked down and stomped
      { f: 84, p: compose(r.hitGut, { x: -0.1 }), e: 'snap' },
      { f: 90, p: compose(r.lying, { x: -0.2, rot: 90, s: { sq: 0.1 } }), e: 'in' },
      { f: 96, p: compose(r.lying, { x: -0.2, rot: 90, j: { thL: [8, 0, 60], knL: [0, 0, -80], head: [0, 10, -20] } }), e: 'snap' },
      { f: 104, p: compose(r.lying, { x: -0.2, rot: 90 }) },
      // up again, wobbly
      { f: 116, p: compose(set.stance, { x: -0.15, j: { head: [0, 18, 14], chest: [0, 10, 8] } }), e: 'inOut' },
      { f: 128, p: compose(set.stance, { x: -0.12, j: { head: [0, -14, 10], chest: [0, -6, 6] } }) },
      { f: 130, p: compose(r.juggle, { x: -0.3, y: 0.5, rot: 30 }), e: 'snap' },
      { f: 140, p: compose(r.juggle, { x: (endX - 0.3) * 0.6, y: 1.6, rot: 200 }), e: 'out' },
      { f: 150, p: compose(r.lying, { x: endX, rot: 450, s: { sq: 0.16 } }), e: 'in' },
      { f: 170, p: compose(r.lying, { x: endX, rot: 450 }) },
    ],
    set.stance,
  );
}

/** Crew member: runs in from behind Bonez, works the victim over (kick/stomp), steps aside, crossed arms. */
function crewExtra(visual: string, i: number): ExtraActor {
  const lane = [0.55, -0.55, 0.95, -0.95][i];
  const spot = [1.55, 1.75, 1.15, 2.1][i];
  const side = [0.9, 2.4, 0.5, 2.7][i];
  const t0 = 72 + i * 2;
  const run = (k: number) => compose(BS2, runPose(k));
  const stomp: PoseDef = { y: 0.04, j: { spine: [0, 0, -18], chest: [0, 0, -10], thR: [-8, 10, 70], knR: [0, 0, -70], shL: [30, 0, 70], elL: [0, 0, 60], shR: [-30, 0, 50], elR: [0, 0, 80] } };
  const kick: PoseDef = { j: { spine: [0, 0, 8], thR: [-8, 10, 80], knR: [0, 0, -10], shL: [30, 0, 40], shR: [-30, 0, 30], elR: [0, 0, 60] } };
  const crossed: PoseDef = { j: { chest: [0, -6, 6], shL: [10, 0, 66], elL: [0, 0, 112], shR: [-10, 0, 66], elR: [0, 0, 112], head: [0, -8, 10] } };
  return {
    visual,
    facing: 1,
    visible: [t0, 170],
    path: [
      { f: t0, p: [-3.2 - i * 0.4, 0, lane] },
      { f: t0 + 10, p: [spot - 0.4, 0, lane * 0.7], e: 'out' },
      { f: 104, p: [spot - 0.4, 0, lane * 0.7] },
      { f: 116, p: [side - (side > 1.5 ? 0 : 0.6), 0, lane * 1.4 - 0.6], e: 'inOut' },
      { f: 170, p: [side - (side > 1.5 ? 0 : 0.6), 0, lane * 1.4 - 0.6] },
    ],
    clip: smoothClip(
      [
        { f: t0, p: run(0) },
        { f: t0 + 3, p: run(0.25) },
        { f: t0 + 6, p: run(0.5) },
        { f: t0 + 9, p: run(0.75) },
        { f: 84, p: i % 2 ? kick : stomp, e: 'snap' },
        { f: 90, p: {} },
        { f: 96, p: i % 2 ? stomp : kick, e: 'snap' },
        { f: 104, p: {} },
        { f: 116, p: crossed, e: 'inOut' },
        { f: 170, p: crossed },
      ],
      BS2,
    ),
  };
}

function teamProps(): CineProps {
  const group = new THREE.Group();
  const sunset = makeSunset(7.5);
  group.add(sunset);
  const spots: [number, number, number, number][] = [
    [-2.5, -2.6, 4.6, 0.5],
    [-1.3, -3.6, 5.4, -0.35],
    [2.7, -2.8, 4.9, -0.55],
    [3.7, -3.8, 5.6, 0.4],
    [-3.7, -4.3, 5.0, 0.45],
    [1.3, -4.6, 5.8, 0.3],
  ];
  const palms = spots.map(([x, z, h, lean], i) => {
    const p = palmModel(h, lean) ?? makePalm(h, lean, i % 2 ? 0x2a1540 : 0x341a4a);
    p.position.set(x, 0, z);
    group.add(p);
    return p;
  });
  // the phone: in the victim's raised hand while filming, flies off spinning on the slap
  const phone = new THREE.Group();
  const ph = inked(new RoundedBoxGeometry(0.085, 0.17, 0.012, 2, 0.01), new THREE.MeshToonMaterial({ color: 0x18181d }), 1.08);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.145), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
  screen.position.z = 0.007;
  const rec = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
  rec.position.set(0.022, 0.058, 0.008);
  phone.add(ph, screen, rec);
  group.add(phone);
  const signs = signTrack(group, [
    { f: 50, word: 'HANDYVERBOT!', fill: '#ff4f6a', w: 1.9, pos: [1.0, 2.35, 0.5], len: 20 },
    { f: 130, word: 'BOOM!', fill: '#ffd23c', w: 1.5, pos: [1.6, 2.0, 0.6], len: 18 },
  ]);
  const title = { s: null as THREE.Sprite | null };
  const sun = new THREE.SpotLight(0xff9a4a, 0, 20, 0.75, 0.8, 0);
  const tmp = new THREE.Vector3();
  return {
    group,
    lights: [sun],
    update(f: number, c: PropCtx) {
      const out = ramp(f, 158, 170);
      const rise = ramp(f, 0, 26) * (1 - out);
      sun.intensity = rise * 5;
      sun.position.copy(c.world(0.6, 5.5, -4.5));
      sun.target.position.copy(c.world(0.6, 1.2, 0.5));
      sunset.position.set(0.6, lerp(-2.4, 2.4, rise), -6.5);
      (sunset.material as THREE.MeshBasicMaterial).opacity = rise;
      palms.forEach((p, i) => {
        const r = ramp(f, 2 + i * 2.5, 20 + i * 2.5) * (1 - out);
        p.position.y = lerp(-7, 0, r);
        const impact = f >= 130 ? Math.exp(-(f - 130) / 10) * Math.sin((f - 130) * 0.9) * 0.08 : 0;
        p.rotation.z = Math.sin(c.time * 1.4 + i) * 0.03 + impact;
      });
      // phone
      const vic = c.rigs[1];
      const filming = f >= 44 && f < 62;
      phone.visible = (filming || (f >= 62 && f < 84)) && !!vic;
      if (phone.visible && vic) {
        if (filming) {
          vic.joints.haR.getWorldPosition(tmp);
          group.worldToLocal(tmp);
          phone.position.copy(tmp).add(new THREE.Vector3(-0.06, 0.06, 0.05));
          phone.rotation.set(0, Math.PI / 2 + 0.4, 0);
          (rec.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(c.time * 8) > 0 ? 0xff2a3a : 0x3a0a10);
        } else {
          const t = (f - 62) / 30;
          phone.position.set(c.defLocal[0] + 2.4 * t, 1.5 + 3.2 * t - 6 * t * t, 0.6 + t);
          phone.rotation.set(f * 0.6, f * 0.4, f * 0.3);
        }
      }
      signs(f);
      // "OHNE MEIN TEAM" title as they storm in
      if (f >= 74 && !title.s) {
        title.s = textSprite('OHNE MEIN TEAM', { width: 3.6, color: '#ffd23c', font: '"Rubik Wet Paint", "Anton", sans-serif' });
        group.add(title.s);
      }
      if (title.s) {
        const k = pop(lin(f, 74, 80)) * (1 - lin(f, 104, 110));
        title.s.visible = f >= 74 && f < 110;
        title.s.position.set(0.8, 2.6, 0.6);
        title.s.scale.set(3.6 * k, 3.6 * k * 0.18, 1);
      }
      if (f < 2 && title.s) {
        group.remove(title.s);
        title.s = null;
      }
    },
  };
}

export const OHNE_MEIN_TEAM: CineDef = {
  frames: 170,
  startDx: 1.1,
  teeth: [
    [44, 56],
    [150, 170],
  ],
  extras: [crewExtra('crew', 0), crewExtra('crew2', 1), crewExtra('crew3', 2), crewExtra('crew4', 3)],
  camera: [
    { f: 0, pos: [0.5, 0.35, 3.8], target: [0.5, 1.4, 0], fov: 46 },
    { f: 28, pos: [0.5, 0.5, 4.4], target: [0.6, 1.7, 0], fov: 46 },
    { f: 30, pos: [1.9, 1.1, 5.0], target: [0.6, 1.5, 0], fov: 40, cut: true },
    // the phone: over Bonez's shoulder on the filming victim
    { f: 42, pos: [-0.3, 1.75, 1.6], target: [1.1, 1.55, 0], fov: 34, cut: true },
    { f: 60, pos: [-0.2, 1.75, 1.4], target: [1.1, 1.55, 0], fov: 32 },
    { f: 62, pos: [1.6, 1.4, 3.2], target: [1.0, 1.5, 0], fov: 38, cut: true },
    // the crew storms in: wide and low
    { f: 72, pos: [-0.5, 0.8, 5.6], target: [0.4, 1.2, 0], fov: 46, cut: true },
    { f: 104, pos: [0.2, 1.1, 5.2], target: [1.0, 1.0, 0], fov: 44 },
    // the right hand: close side, then wide on the flight through the palms
    { f: 118, pos: [0.9, 1.2, 2.6], target: [0.9, 1.4, 0], fov: 36, cut: true },
    { f: 130, pos: [0.95, 1.25, 2.4], target: [1.0, 1.4, 0], fov: 34 },
    { f: 132, pos: [1.5, 1.5, 7.2], target: [1.6, 1.4, 0], fov: 46, cut: true },
    { f: 170, pos: [1.2, 1.5, 7.6], target: [1.2, 1.2, 0], fov: 44 },
  ],
  atk: TEAM_ATK,
  def: teamDef,
  props: teamProps,
  dim: (f) => (f < 160 ? 0.6 : 0.4),
  fx: [
    { f: 1, run: (c) => (c.view.arena.pulse(0.8), c.audio.crowdSwell(0.3), c.view.vfx.ring(c.atk.x + c.facing * 0.3, 0.02, 2.2, C(0xffa23a), 0.4, true)) },
    { f: 8, run: (c) => c.audio.riser() },
    {
      f: 30,
      run: (c) => {
        c.audio.bassDrop();
        c.view.vfx.ring(c.def.x, 0.03, 2.4, C(0xffa23a), 0.4, true);
        c.view.toon.crack(c.def.x, 1.6);
        c.view.director.shake(0.5);
        hitFx(c, 2, 0xffa23a);
      },
    },
    { f: 50, run: (c) => (c.audio.deny(), c.audio.crowdSwell(0.4)) },
    { f: 62, run: (c) => (c.audio.slap(1), c.audio.glass(), hitFx(c, 1, 0xffffff)) },
    { f: 74, run: (c) => (c.audio.stab(), c.audio.crowdSwell(0.7)) },
    ...[84, 96].map((f) => ({ f, run: (c: FxCtx) => (c.audio.hit(2, false), hitFx(c, 1, 0xffa23a), c.view.toon.puff(c.def.x, 0.2, 8, 0.8, C(0xe9dfd0), 0.26, 0.5)) })),
    {
      f: 130,
      run: (c) => {
        const x = c.def.x;
        c.audio.bassDrop();
        c.audio.boom();
        c.view.vfx.ring(x, 0.6, 2.8, C(0xffffff), 0.45);
        c.view.vfx.sparks(x, 1.2, 60, C(0xffd36b), 12, 1, 2);
        c.view.toon.impactFrame(0.07);
        c.view.after(0.07, () => c.view.toon.impact(x, 1.3, 2.2, C(0xffa23a), { spikes: 14, life: 0.4 }));
        c.view.director.shake(1);
        c.view.director.punch(5);
        c.view.screenFlash = 1;
        c.audio.crowdSwell(0.8);
      },
    },
    { f: 150, run: (c) => (c.audio.slam(), c.view.toon.puff(c.def.x, 0, 10, 1.2, C(0xe9dfd0), 0.26, 0.7)) },
  ],
};
