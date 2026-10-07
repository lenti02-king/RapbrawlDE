// Cinematics of the D43 abilities (session 11, PO wishes): Manuellsen's Sofa-Backpfeifen, Lacazette's 70 Schüsse,
// Jazeek's Ninetynine and Bonez's Ohne mein Team. Keyed to the sim's cinematic frames (content/<id>.ts cinematics:
// the same hit frames, startDx and endDx). Attacker-local coordinates: x toward the victim, y up, z toward the camera.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { burstSprite, crownTexture, makeOffroader, runPose, starTexture, textSprite } from './abilities11';
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
// Stage 1: grab -> a black sofa pops up behind the opponent -> he pushes them down onto it -> three slaps with straight
// arms (sim hits 70 / 92 / 116: batsch, batsch, BATSCH) -> the last one knocks them out cold: they slump on the sofa
// and sleep (Zzz, PO S12: "man muss klar sehen, er ist K.O. und schläft").
// Stage 2: "König im Schatten" (his autobiography): the lights go down, one spot on him, a crown comes down onto his
// head, the title - then he kicks the sofa over backwards with the sleeper on it (hit 226). startDx 0.95, endDx 2.6.
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
// double biceps: upper arms out to the sides, forearms up (reads from the 3/4 front camera)
const flexUp: PoseDef = { y: 0.02, aim: { shL: [0.25, 0.1, -1], elL: [0.2, 1, -0.1], shR: [0.25, 0.1, 1], elR: [0.2, 1, 0.1] }, j: { chest: [0, 0, -8], head: [0, 0, -6] } };
const dustHands: PoseDef = { aim: { shL: [0.6, -0.5, -0.1], elL: [0.4, 0.6, 0.6], shR: [0.6, -0.5, 0.1], elR: [0.4, 0.6, -0.6] }, j: { head: [0, -8, -8] } };
// index finger to the lips (pssst, he sleeps), the other hand on the hip
// (S12 capture: the old aim put the hand above his head; checked with scripts/posegrid.mjs)
const shush: PoseDef = { aim: { shR: [0.6, -0.6, 0.3], elR: [-0.2, 0.95, -0.3], shL: [0.1, -0.8, -0.6], elL: [-0.4, 0.4, 0.5] }, j: { head: [0, 18, 6], chest: [0, 10, 2] } };
// arms crossed high, chest out, chin up: the king in the spotlight
const kingStand: PoseDef = {
  aim: { shL: [0.35, -0.9, 0], elL: [0.1, 0.05, 1], shR: [0.35, -0.9, 0], elR: [0.1, 0.1, -1] },
  j: { chest: [0, -4, -6], head: [0, 0, -8], thL: [16, 10, 4], thR: [-16, 8, -4] },
};
const SOFA_KICK_CHAMBER: PoseDef = {
  y: 0.02,
  aim: { shL: [0.4, -0.5, -0.6], elL: [0.6, 0.5, -0.4], shR: [0.3, -0.6, 0.6], elR: [0.5, 0.5, 0.4] },
  j: { spine: [0, 0, 10], chest: [0, -6, 6], thR: [-8, 6, 96], knR: [0, 0, -110], ftR: [0, 0, 20], thL: [10, 10, -4], knL: [0, 0, -12] },
};
const SOFA_PUSH_KICK: PoseDef = {
  y: 0.02,
  aim: { shL: [0.5, -0.4, -0.7], elL: [0.7, 0.4, -0.4], shR: [0.2, -0.7, 0.6], elR: [0.5, 0.4, 0.5] },
  j: { spine: [0, 0, -16], chest: [0, -6, -10], thR: [-8, 6, 88], knR: [0, 0, -6], ftR: [0, 0, -30], thL: [10, 10, -10], knL: [0, 0, -16] },
};

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
    // he looks at the sleeper, a finger to his lips: pssst
    { f: 150, p: compose(shush, { x: 0.42 }), e: 'inOut' },
    { f: 166, p: compose(shush, { x: 0.42, j: { head: [0, 10, -2] } }) },
    // stage 2: lights down, he straightens up, the crown comes down (180-196), arms crossed: the king
    { f: 178, p: compose(kingStand, { x: 0.3 }), e: 'inOut' },
    { f: 196, p: compose(kingStand, { x: 0.3, y: 0.02, j: { head: [0, 0, -12] } }), e: 'out' },
    { f: 212, p: compose(kingStand, { x: 0.32, j: { head: [0, -6, -10] } }) },
    // the kick: chamber, push-kick into the sofa (226)
    { f: 220, p: compose(SOFA_KICK_CHAMBER, { x: 0.5 }), e: 'inOut' },
    { f: 226, p: compose(SOFA_PUSH_KICK, { x: 0.62 }), e: 'snap' },
    { f: 234, p: compose(SOFA_PUSH_KICK, { x: 0.66 }) },
    { f: 246, p: compose(flexUp, { x: 0.5 }), e: 'inOut' },
    { f: 260, p: compose(flexUp, { x: 0.5, y: 0.03 }) },
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
  // knocked out on the sofa: slid down and sunk back into the backrest, head rolled over toward the camera and back
  // (face readable, mouth to the ceiling), arms dead at the sides, knees apart; `b` 0..1 = the slow breath of a sleeper
  // (S12 capture: the first version slumped forward and hid the face)
  const ko = (b: number): PoseDef =>
    compose(sit(0, 0), {
      y: SEAT_H - 0.03 - pivot,
      j: {
        hips: [0, 0, 10],
        spine: [4, 0, 14 + b * 3],
        chest: [6, 0, 10 + b * 4],
        neck: [14, -6, 10],
        head: [28, -18, 22 + b * 2],
        thL: [24, 10, 76],
        knL: [0, 0, -78],
        thR: [-24, 10, 74],
        knR: [0, 0, -82],
        shL: [70, 0, 6],
        elL: [0, 0, 12],
        shR: [-70, 0, 6],
        elR: [0, 0, 12],
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
      // out cold: slumps into the backrest, head over to one side, arms dead on the seat - asleep (Zzz, props)
      { f: 124, p: ko(0), e: 'out' },
      { f: 150, p: ko(1) },
      { f: 176, p: ko(0) },
      { f: 200, p: ko(1) },
      { f: 224, p: ko(0) },
      // stage 2 ends: the kicked sofa goes over backwards, the sleeper tumbles over the backrest
      { f: 230, p: compose(r.juggle, { x: at(SOFA_X + 0.25), y: 1.05 - pivot, rot: 70 }), e: 'out' },
      { f: 238, p: compose(r.juggle, { x: at(2.2), y: 0.75 - pivot, rot: 160 }) },
      { f: 246, p: compose(r.lying, { x: endX, rot: 90, s: { sq: 0.16 } }), e: 'in' },
      { f: 260, p: compose(r.lying, { x: endX, rot: 90, j: { head: [0, 14, -6] } }) },
    ],
    set.stance,
  );
}

/** Black leather two-seater, seat front facing -x, origin on the floor under the seat's back edge. */
export function makeSofa(): THREE.Group {
  const g = new THREE.Group();
  // black leather, but light enough that the shape still reads in the dimmed cinematic light
  const leather = new THREE.MeshToonMaterial({ color: 0x2b2b35 });
  const sheen = new THREE.MeshToonMaterial({ color: 0x3e3e4c });
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

let zTex: THREE.Texture | null = null;
/** A "Z" for the sleeper (square canvas sprite, white with ink). */
function zSprite(): THREE.Sprite {
  if (!zTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.font = '400 110px "Rubik Wet Paint", "Anton", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = '#0b0910';
    g.strokeText('Z', 64, 68);
    g.fillStyle = '#ffffff';
    g.fillText('Z', 64, 68);
    zTex = new THREE.CanvasTexture(c);
    zTex.colorSpace = THREE.SRGBColorSpace;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 22;
  return sp;
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
    { f: 151, word: 'PSSST…', fill: '#9fd0ff', w: 0.95, pos: [0.25, 2.15, 0.6], len: 18 },
    { f: 226, word: 'RUMMS!', fill: '#ff8a2a', w: 1.4, pos: [1.7, 1.6, 0.6], len: 18 },
  ]);
  const tex = smokeTexture();
  const poof = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xece8f2, transparent: true, depthWrite: false }));
    s.userData.a = (i / 10) * Math.PI * 2;
    group.add(s);
    return s;
  });
  // the sleeper: Z's rising from the head, a few stars circling right after the knockout
  const zs = [0, 1, 2].map(() => {
    const z = zSprite();
    group.add(z);
    return z;
  });
  const stars = Array.from({ length: 5 }, () => {
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: 0xffe36a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    st.scale.setScalar(0.16);
    st.renderOrder = 22;
    group.add(st);
    return st;
  });
  // stage 2: the crown that comes down onto his head, the title
  const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: crownTexture(), transparent: true, depthWrite: false }));
  crown.renderOrder = 23;
  group.add(crown);
  const title = textSprite('KÖNIG IM SCHATTEN', { width: 2.6, color: '#ffd23c', stroke: '#1a0f02', font: '"Rubik Wet Paint", "Anton", sans-serif' });
  title.renderOrder = 24;
  const tAspect = title.scale.y / title.scale.x;
  group.add(title);
  const spot = new THREE.SpotLight(0xfff0c8, 0, 9, 0.42, 0.6, 0);
  group.add(spot, spot.target);
  return {
    group,
    lights: [spot],
    update(f: number, c: PropCtx) {
      const appear = pop(lin(f, 12, 18));
      const gone = f >= 250 ? 1 - lin(f, 250, 256) : 1;
      pivot.visible = f >= 12 && gone > 0.01;
      pivot.scale.setScalar(Math.max(0.01, appear * gone));
      // tips over backwards when he kicks it (226)
      pivot.rotation.z = -1.35 * ramp(f, 226, 238);
      // the poof when it appears and disappears
      const pk = (f >= 12 && f < 24 ? 1 - lin(f, 14, 24) : 0) + (f >= 250 && f < 260 ? 1 - lin(f, 252, 260) : 0);
      poof.forEach((s, i) => {
        s.visible = pk > 0.01;
        if (!s.visible) return;
        const a = s.userData.a + c.time;
        const r = 0.5 + (1 - pk) * 0.5;
        s.position.set(SOFA_X - 0.2 + Math.cos(a) * r, 0.45 + Math.sin(a * 1.3) * 0.25, Math.sin(a) * 0.5);
        s.scale.setScalar(0.6 + 0.2 * Math.sin(i));
        s.material.opacity = pk;
      });
      // the victim's head (attacker-local): asleep on the sofa
      const head = c.rigs[1]?.joints.head.getWorldPosition(new THREE.Vector3());
      const hx = head ? (head.x - c.ax) * c.facing : SOFA_X - 0.2;
      const hy = head ? head.y : 1.0;
      const asleep = f >= 128 && f < 226;
      zs.forEach((z, i) => {
        const t = ((f - 128) / 26 + i / 3) % 1;
        z.visible = asleep;
        if (!asleep) return;
        z.position.set(hx + 0.12 + t * 0.35, hy + 0.2 + t * 0.6, 0.55);
        const k = Math.sin(t * Math.PI);
        z.scale.setScalar(0.16 + t * 0.2);
        z.material.opacity = k;
        z.material.rotation = -0.3 + t * 0.4;
      });
      const dizzy = f >= 118 && f < 150;
      stars.forEach((st, i) => {
        st.visible = dizzy;
        if (!dizzy) return;
        const a = c.time * 5 + (i / stars.length) * Math.PI * 2;
        st.position.set(hx + Math.cos(a) * 0.28, hy + 0.24 + Math.sin(a * 2) * 0.04, 0.4 + Math.sin(a) * 0.2);
        st.material.opacity = 1 - lin(f, 140, 150);
      });
      // the crown comes down onto Manuellsen's head (180-196) and stays until the end
      const top = c.rigs[0]?.joints.head.getWorldPosition(new THREE.Vector3());
      const tx = top ? (top.x - c.ax) * c.facing : 0.4;
      const ty = top ? top.y + 0.27 : 2.1;
      const drop = ramp(f, 180, 196);
      crown.visible = f >= 178;
      crown.position.set(tx, ty + (1 - drop) * 1.4, 0.35);
      crown.scale.set(0.42, 0.315, 1);
      crown.material.rotation = (1 - drop) * 0.5 * Math.sin(c.time * 6);
      const tk = f >= 198 && f < 222 ? pop(lin(f, 198, 203)) * (1 - lin(f, 217, 222)) : 0;
      title.visible = tk > 0.01;
      title.position.set(0.9, 2.55, 0.8);
      title.scale.set(2.6 * tk, 2.6 * tk * tAspect, 1);
      // one spot on him while the lights are down
      spot.intensity = 7 * ramp(f, 168, 180) * (1 - ramp(f, 222, 232));
      spot.position.copy(c.world(0.3, 4.2, 1.2));
      spot.target.position.copy(c.world(0.35, 0.9, 0));
      signs(f);
    },
  };
}

export const SOFA_SLAPS: CineDef = {
  frames: 260,
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
    // the big one: wide
    { f: 106, pos: [1.2, 1.4, 4.8], target: [1.3, 1.0, 0], fov: 40, cut: true },
    { f: 124, pos: [1.25, 1.38, 4.6], target: [1.35, 0.95, 0], fov: 38 },
    // out cold: close on the sleeper (Zzz)
    { f: 126, pos: [0.95, 1.3, 1.95], target: [1.45, 0.9, 0], fov: 34, cut: true },
    { f: 148, pos: [1.0, 1.25, 1.7], target: [1.45, 0.92, 0], fov: 32 },
    // pssst: two-shot
    { f: 150, pos: [1.0, 1.4, 3.6], target: [0.85, 1.15, 0], fov: 38, cut: true },
    { f: 168, pos: [1.0, 1.4, 3.4], target: [0.85, 1.15, 0], fov: 36 },
    // stage 2: low hero angle on him as the crown comes down
    { f: 170, pos: [0.9, 0.7, 2.5], target: [0.3, 1.6, 0], fov: 38, cut: true },
    { f: 198, pos: [0.85, 0.75, 2.2], target: [0.3, 1.75, 0], fov: 36 },
    // the title, both in frame
    { f: 200, pos: [1.0, 1.5, 4.4], target: [0.9, 1.4, 0], fov: 40, cut: true },
    { f: 218, pos: [1.0, 1.5, 4.2], target: [0.9, 1.35, 0], fov: 40 },
    // the kick: wide, so the tipping sofa reads
    { f: 220, pos: [1.2, 1.4, 4.8], target: [1.3, 1.0, 0], fov: 40, cut: true },
    { f: 244, pos: [1.3, 1.35, 5.4], target: [1.5, 0.9, 0], fov: 40 },
    // the flex
    { f: 246, pos: [2.3, 1.45, 2.7], target: [0.55, 1.35, 0], fov: 36, cut: true },
    { f: 260, pos: [2.1, 1.5, 2.4], target: [0.55, 1.45, 0], fov: 34 },
  ],
  atk: SOFA_ATK,
  def: sofaDef,
  props: sofaProps,
  // the lights go down for "König im Schatten"
  dim: (f) => (f < 166 ? 0.55 : f < 228 ? 0.55 + 0.3 * ramp(f, 166, 178) - 0.3 * ramp(f, 222, 230) : 0.4),
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
    { f: 168, run: (c) => c.audio.boom() },
    { f: 196, run: (c) => (c.audio.sparkle(), c.audio.crowdSwell(0.6)) },
    {
      f: 226,
      run: (c: FxCtx) => {
        c.audio.slam();
        const p = c.def.clone().add(new THREE.Vector3(0, 0.6, 0.2));
        c.view.toon.impact(p.x, p.y, 1.6, C(0xff8a2a), { spikes: 13, life: 0.3 });
        c.view.director.shake(0.6);
        c.view.director.punch(3);
      },
    },
    { f: 236, run: (c) => (c.audio.slam(), c.view.toon.puff(c.def.x, 0, 10, 1.2, C(0xe9dfd0), 0.28, 0.7)) },
    { f: 250, run: (c) => c.audio.sparkle() },
  ],
};

// =================================================================== LACAZETTE — 70 SCHÜSSE (signature)
// Stage 1: the off-roader crossed the stage and caught them: it drifts round so the driver's side faces them (window
// opens), 70 shots from the window (sim hits 64-104 every 10, the last burst 116 throws them onto their knees), a
// counter runs up to 70, then the line "…DAS WAREN 70 SCHÜSSE AUS DEM G-WAGON". Lacazette watches, arms crossed.
// Stage 2 (S12): he walks up, pulls them up by the collar, glasses down - KALTER BLICK from close - and a push kick
// (226); the car pulls away. startDx 3.0, endDx 2.0.
const LS = JAZEEK_ANIMS.stance;
// the car stops diagonally behind the victim: driver's side (window) toward them and the camera, nose to the front right
const CAR_X = 5.7;
const CAR_Z = -0.7;
const CAR_YAW = -0.7;
const SHOT0 = 58;
const SHOT1 = 118;

const crossedL: PoseDef = { j: { chest: [0, -8, 6], shL: [10, 0, 66], elL: [0, 0, 116], shR: [-10, 0, 66], elR: [0, 0, 116], head: [0, -10, 6] } };
const glassesDown: PoseDef = { aim: { shR: [0.3, 0.3, 0.55], elR: [-0.2, 1, 0.25] }, j: { head: [0, -6, -14], chest: [0, -8, 2], shL: [10, 0, 60], elL: [0, 0, 110] } };
// stage 2 (S12): he steps up to the kneeling victim, pulls them up by the collar, glasses down - a cold stare from
// close - lets go and finishes with a push kick (226)
const collarL: PoseDef = {
  x: 0.25,
  aim: { shL: [0.9, 0.1, -0.15], elL: [0.9, 0.3, 0], shR: [-0.1, -0.95, 0.3], elR: [0.3, -0.6, 0.3], face: 0.8 },
  j: { chest: [0, -8, -6], spine: [0, -4, -6], head: [0, -6, -4] },
};
// glasses down with the free hand and eyes UP into theirs (they are held higher; S12 capture: he looked at the floor)
const collarStare: PoseDef = compose(collarL, { aim: { shR: [0.3, 0.3, 0.55], elR: [-0.2, 1, 0.25] }, j: { head: [0, -4, 12], neck: [0, 0, 4] } });
const GW_ATK = smoothClip(
  [
    { f: 0, p: compose(LS, { j: { head: [0, -6, 4] } }) },
    { f: 20, p: crossedL, e: 'inOut' },
    { f: 118, p: compose(crossedL, { j: { head: [0, -12, 8] } }) },
    { f: 128, p: glassesDown, e: 'inOut' },
    { f: 146, p: glassesDown },
    { f: 158, p: compose(crossedL, { j: { head: [0, 0, 12] } }), e: 'inOut' },
    { f: 168, p: compose(crossedL, { x: 0.12 }) },
    { f: 180, p: compose(collarL, { x: 0.2 }), e: 'inOut' },
    { f: 188, p: collarL, e: 'out' },
    { f: 196, p: collarStare, e: 'inOut' },
    { f: 210, p: collarStare },
    { f: 216, p: compose(SOFA_KICK_CHAMBER, { x: 0.18 }), e: 'inOut' },
    { f: 226, p: compose(SOFA_PUSH_KICK, { x: 0.3 }), e: 'snap' },
    { f: 234, p: compose(SOFA_PUSH_KICK, { x: 0.3 }) },
    { f: 246, p: compose(crossedL, { x: 0.1, j: { head: [0, 0, 12] } }), e: 'inOut' },
    { f: 250, p: compose(crossedL, { x: 0.1 }) },
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
  // the last burst throws them toward Lacazette, onto their knees (dazed, swaying); stage 2: pulled up by the collar,
  // held, then the kick sends them back down to endX
  const NEAR = START - 0.95; // victim-local x of "right in front of him"
  const kneel = (sway: number): PoseDef =>
    compose(set.stance, {
      x: NEAR - 0.1,
      y: -0.48,
      j: {
        hips: [0, 0, 0],
        spine: [sway * 6, sway * 6, 18],
        chest: [sway * 6, sway * 8, 14],
        head: [sway * 12, sway * 14, 18],
        thL: [8, 6, 90],
        knL: [0, 0, -100],
        ftL: [0, 0, 10],
        thR: [-8, 6, -10],
        knR: [0, 0, -110],
        ftR: [0, 0, 60],
        shL: [30, 0, 10],
        elL: [0, 0, 20],
        shR: [-30, 0, 10],
        elR: [0, 0, 20],
      },
    });
  const held: PoseDef = compose(r.hitHigh, { x: NEAR, y: 0.04, j: { head: [0, 10, 20], chest: [0, 0, 10] } });
  keys.push(
    { f: 116, p: compose(r.juggle, { x: 0.9, y: 0.6, rot: 25 }), e: 'snap' },
    { f: 124, p: compose(r.juggle, { x: NEAR - 0.3, y: 0.3, rot: 40 }), e: 'out' },
    { f: 130, p: kneel(0), e: 'in' },
    { f: 145, p: kneel(1) },
    { f: 160, p: kneel(-1) },
    { f: 175, p: kneel(0.6) },
    // pulled up by the collar
    { f: 188, p: compose(held, { y: 0.0 }), e: 'out' },
    { f: 210, p: compose(held, { j: { head: [0, 16, 24] } }) },
    { f: 226, p: compose(r.hitGut, { x: NEAR - 0.05 }), e: 'snap' },
    { f: 232, p: compose(r.juggle, { x: endX + 0.6, y: 0.45, rot: 40 }), e: 'out' },
    { f: 238, p: compose(r.lying, { x: endX, rot: 90, s: { sq: 0.16 } }), e: 'in' },
    { f: 250, p: compose(r.lying, { x: endX, rot: 90 }) },
  );
  return smoothClip(keys, set.stance);
}

function gwagonProps(): CineProps {
  const group = new THREE.Group();
  const car = makeOffroader();
  group.add(car);
  const win = car.userData.window as THREE.Object3D;
  const wheels = car.userData.wheels as THREE.Object3D[];
  const gun = car.userData.gun as THREE.Object3D;
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
  // stage 2: the cold stare from close up, then the kick
  const blick = signTrack(group, [
    { f: 198, word: 'KALTER BLICK', fill: '#9fd8ff', w: 0.62, pos: [0.6, 2.0, 0.55], len: 20 },
    { f: 226, word: 'BOOM!', fill: '#ff8a2a', w: 1.2, pos: [1.2, 1.7, 0.6], len: 16 },
  ]);
  return {
    group,
    lights: [lamp],
    update(f: number, c: PropCtx) {
      // car path: roars in along the front lane, drifts (the tail swings out past the stop angle and settles) and stops
      // diagonally at CAR_X with the open driver's window toward the victim; pulls away into the back right at the end
      const arrive = ramp(f, 0, 26);
      const leave = ramp(f, 230, 250);
      const x = lerp(0.2, CAR_X, arrive) + leave * 6;
      const z = lerp(1.7, CAR_Z, arrive) - leave * 3.5;
      car.position.set(x, 0, z);
      const yaw = lerp(0, CAR_YAW - 0.45, ramp(f, 4, 20)) + 0.45 * ramp(f, 20, 32) + leave * 1.1;
      car.rotation.y = yaw;
      const roll = f < 32 ? Math.sin(lin(f, 4, 32) * Math.PI) * 0.07 : 0;
      car.rotation.x = roll;
      gun.visible = f >= SHOT0 - 8 && f < SHOT1 + 6;
      gun.rotation.x = f >= SHOT0 && f < SHOT1 ? Math.sin(c.time * 60) * 0.12 : 0; // recoil
      const spin = f < 30 ? -c.time * 30 : f > 230 ? -c.time * 34 : 0;
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
          s.position.set(CAR_X - 0.4, 2.9, 0.2);
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
        line.position.set(2.9, 2.7, 0.8);
        line.scale.set(4.6 * k, 4.6 * k * 0.33, 1);
        line.material.opacity = Math.min(1, k * 1.2);
      }
      if (f < 2 && line) {
        group.remove(line);
        line = null;
      }
      blick(f);
      // per-frame bits: tyre smoke during the drift, shell casings, sparks on the victim
      const fi = Math.floor(f);
      if (fi < last) last = -1;
      if (fi === last) return;
      for (let k = last + 1; k <= fi; k++) {
        if (k < 30 || k > 230) {
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
  frames: 250,
  startDx: 3.0,
  camera: [
    // the drift: wide and low, the car slides in from the front lane
    { f: 0, pos: [2.8, 0.8, 7.4], target: [3.6, 0.9, 0], fov: 46, cut: true },
    { f: 30, pos: [3.4, 0.95, 6.8], target: [4.4, 1.0, -0.3], fov: 44 },
    // over the victim's shoulder: the driver's side, the window rolls down, the gun comes out
    { f: 32, pos: [1.55, 1.8, 2.6], target: [4.9, 1.45, -0.4], fov: 40, cut: true },
    { f: 56, pos: [1.7, 1.75, 2.4], target: [4.9, 1.45, -0.4], fov: 38 },
    // the hail: 3/4 front on both, the flashes at the window
    { f: 58, pos: [3.4, 1.45, 5.2], target: [4.2, 1.35, -0.2], fov: 42, cut: true },
    { f: 86, pos: [3.3, 1.4, 4.7], target: [4.2, 1.35, -0.2], fov: 40 },
    // low from the victim's other side: tracers past the camera, the car behind
    { f: 88, pos: [1.7, 0.75, 3.0], target: [4.4, 1.45, -0.3], fov: 40, cut: true },
    { f: 114, pos: [1.85, 0.8, 2.8], target: [4.4, 1.45, -0.3], fov: 38 },
    // the line: wide on everything
    { f: 116, pos: [2.9, 1.9, 8.4], target: [2.9, 1.5, 0], fov: 46, cut: true },
    { f: 150, pos: [2.9, 1.85, 7.8], target: [2.9, 1.45, 0], fov: 46 },
    // stage 2: he walks up to them, two-shot
    { f: 152, pos: [1.6, 1.4, 3.8], target: [0.7, 1.15, 0], fov: 38, cut: true },
    { f: 186, pos: [1.5, 1.45, 3.4], target: [0.7, 1.3, 0], fov: 36 },
    // the cold stare: both heads in profile, face to face
    { f: 188, pos: [0.75, 1.8, 2.0], target: [0.6, 1.78, 0], fov: 32, cut: true },
    { f: 212, pos: [0.72, 1.8, 1.85], target: [0.6, 1.78, 0], fov: 30 },
    // the kick: low and wide, the car behind
    { f: 214, pos: [1.4, 0.8, 4.6], target: [1.4, 1.0, 0], fov: 42, cut: true },
    { f: 236, pos: [1.6, 0.85, 4.9], target: [1.6, 0.95, 0], fov: 42 },
    // he stands, the car pulls away
    { f: 238, pos: [2.4, 1.5, 6.4], target: [2.4, 1.2, 0], fov: 44, cut: true },
    { f: 250, pos: [2.4, 1.5, 6.6], target: [2.6, 1.2, 0], fov: 44 },
  ],
  atk: GW_ATK,
  def: gwagonDef,
  props: gwagonProps,
  dim: (f) => (f < 150 ? 0.6 : f < 230 ? 0.55 : 0.4),
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
    { f: 186, run: (c) => c.audio.whoosh(1) },
    { f: 198, run: (c) => (c.audio.sparkle(), c.view.director.shake(0.1)) },
    {
      f: 226,
      run: (c) => {
        hitFx(c, 3, 0xff8a2a);
        c.audio.boom();
        c.view.director.shake(0.7);
        c.view.director.punch(3);
        c.audio.crowdSwell(0.8);
      },
    },
    { f: 230, run: (c) => c.audio.carIn() },
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

export function makeNine(): THREE.Group {
  const g = new THREE.Group();
  const curve = nineCurve();
  const ice = new THREE.MeshToonMaterial({ color: 0xd2efff, emissive: 0x3a6a90, emissiveIntensity: 0.3 });
  const tube = inked(new THREE.TubeGeometry(curve, 80, 0.085, 12, false), ice, 1.12);
  g.add(tube);
  // iced-out: faceted stones along the tube
  const stones = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x9fdcff, emissiveIntensity: 0.4 }), 90);
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

// S12 (PO: "Ninetynine braucht bessere Animation"): every beat gets an anticipation, a snap and a follow-through. He
// pulls the chain off his chest and spins it over his head (the arm circles in time with the pendant, the body
// bounces on it), coils and throws, then conducts the nines like a band leader — a cocked arm and a step into each
// hit — runs up, kicks through the 99 and backflips home into the MVP pose (ends on his own spot: no pop at the end).
const LASSO0 = 8; // first frame of the overhead spin
const LASSO_T = 8; // frames per turn (the props use the same phase)
/** Phase of the pendant spin (radians) at cinematic frame f. */
const lassoPhase = (f: number) => ((f - LASSO0) / LASSO_T) * Math.PI * 2;
const chainGrab: PoseDef = {
  y: -0.03,
  aim: { shR: [0.45, -0.35, 0.55], elR: [0.15, 0.75, -0.65], shL: [0.2, -1, -0.25], elL: [0.55, -0.35, 0.1], face: 0.5 },
  j: { chest: [0, -8, -4], head: [0, -6, -10], knL: [0, 0, -38], knR: [0, 0, -26] },
};
const lasso = (ph: number): PoseDef => {
  const bob = Math.abs(Math.sin(ph));
  return {
    y: 0.0 + bob * 0.035,
    aim: {
      shR: [0.12, 1, 0.22],
      elR: [0.55 * Math.cos(ph), 0.8, 0.55 * Math.sin(ph)],
      shL: [0.25, -0.45, -0.85],
      elL: [0.45, -0.15, -0.85],
      face: 0.6,
    },
    j: { hips: [0, -22 + 8 * Math.sin(ph), 0], chest: [0, -8 + 6 * Math.sin(ph), 7], head: [0, 0, 16], knL: [0, 0, -30 - 12 * (1 - bob)], knR: [0, 0, -20 - 10 * (1 - bob)] },
  };
};
const throwCoil: PoseDef = {
  x: -0.04,
  y: -0.05,
  aim: { shR: [-0.75, 0.55, 0.4], elR: [-0.45, 0.85, 0.25], shL: [0.85, 0.2, -0.35], elL: [0.8, 0.45, -0.2], face: 0.9 },
  j: { hips: [0, -34, 0], spine: [0, -6, 4], chest: [0, -30, 8], thL: [6, 20, 34], knL: [0, 0, -20], thR: [-8, 18, -8], knR: [0, 0, -44] },
};
const throwPose: PoseDef = {
  x: 0.14,
  y: -0.06,
  aim: { shR: [1, 0.25, 0.05], elR: [1, 0.2, 0.05], shL: [-0.3, -1, -0.3], elL: [0.3, -0.7, -0.2], face: 0.8 },
  j: { hips: [0, 14, 0], spine: [0, 8, -12], chest: [0, 20, -10], thL: [12, 14, 40], knL: [0, 0, -44], thR: [-12, 12, -32], knR: [0, 0, -6] },
};
const throwFollow: PoseDef = {
  x: 0.18,
  y: -0.08,
  aim: { shR: [0.75, -0.5, -0.4], elR: [0.6, -0.6, -0.5], shL: [-0.4, -1, -0.2], elL: [0.2, -0.8, -0.2], face: 0.8 },
  j: { hips: [0, 22, 0], spine: [0, 10, -18], chest: [0, 30, -14], thL: [12, 14, 44], knL: [0, 0, -50], thR: [-12, 12, -34], knR: [0, 0, -4] },
};
/** Band leader, ready: arms open, chest up, eyes on the floating opponent. */
const leadReady: PoseDef = {
  x: 0.12,
  aim: { shR: [0.35, 0.25, 0.9], elR: [0.65, 0.65, 0.4], shL: [0.35, 0.25, -0.9], elL: [0.65, 0.65, -0.4], face: 0.4 },
  j: { chest: [0, -6, 10], head: [0, 0, 16] },
};
// the three commands: R cocks up and back, then slashes at the nine (58); L the same (70); both arms up, slam (82)
const cockR: PoseDef = {
  x: 0.1,
  y: -0.03,
  aim: { shR: [-0.35, 0.9, 0.35], elR: [-0.5, 0.8, 0.15], shL: [0.7, 0.2, -0.5], elL: [0.7, 0.6, -0.2], face: 0.5 },
  j: { hips: [0, -32, 0], chest: [0, -30, 10], head: [0, 0, 14], knL: [0, 0, -24], knR: [0, 0, -40] },
};
const slashR: PoseDef = {
  x: 0.26,
  y: -0.06,
  aim: { shR: [1, 0.4, 0.1], elR: [1, 0.35, 0], shL: [-0.2, -0.8, -0.5], elL: [0.3, -0.6, -0.3], face: 0.8 },
  j: { hips: [0, 8, 0], spine: [0, 6, -12], chest: [0, 24, -8], head: [0, 0, 10], thL: [6, 20, 42], knL: [0, 0, -40], thR: [-8, 16, -26], knR: [0, 0, -12] },
};
const followR: PoseDef = {
  x: 0.28,
  y: -0.07,
  aim: { shR: [0.65, -0.45, -0.35], elR: [0.5, -0.6, -0.45], shL: [-0.2, -0.8, -0.5], elL: [0.3, -0.6, -0.3], face: 0.7 },
  j: { hips: [0, 14, 0], spine: [0, 8, -16], chest: [0, 32, -12], thL: [6, 20, 42], knL: [0, 0, -44], thR: [-8, 16, -26], knR: [0, 0, -10] },
};
const cockL: PoseDef = {
  x: 0.28,
  y: -0.03,
  aim: { shL: [-0.35, 0.9, -0.35], elL: [-0.5, 0.8, -0.15], shR: [0.7, 0.2, 0.5], elR: [0.7, 0.6, 0.2], face: 0.5 },
  j: { hips: [0, 10, 0], chest: [0, 30, 10], head: [0, 0, 14], knL: [0, 0, -36], knR: [0, 0, -26] },
};
const slashL: PoseDef = {
  x: 0.42,
  y: -0.06,
  aim: { shL: [1, 0.4, -0.1], elL: [1, 0.35, 0], shR: [-0.2, -0.8, 0.5], elR: [0.3, -0.6, 0.3], face: 0.8 },
  j: { hips: [0, -36, 0], spine: [0, -8, -12], chest: [0, -30, -8], head: [0, 0, 10], thL: [6, 20, 46], knL: [0, 0, -42], thR: [-8, 16, -28], knR: [0, 0, -12] },
};
const followL: PoseDef = {
  x: 0.44,
  y: -0.07,
  aim: { shL: [0.65, -0.45, 0.35], elL: [0.5, -0.6, 0.45], shR: [-0.2, -0.8, 0.5], elR: [0.3, -0.6, 0.3], face: 0.7 },
  j: { hips: [0, -40, 0], spine: [0, -8, -16], chest: [0, -38, -12], thL: [6, 20, 46], knL: [0, 0, -46], thR: [-8, 16, -28], knR: [0, 0, -10] },
};
const bothUp: PoseDef = {
  x: 0.4,
  y: 0.05,
  s: { sq: -0.06 },
  aim: { shR: [0.12, 1, 0.3], elR: [0.05, 1, 0.25], shL: [0.12, 1, -0.3], elL: [0.05, 1, -0.25], face: 0.4 },
  j: { hips: [0, -20, 0], spine: [0, 0, 8], chest: [0, -6, 10], head: [0, 0, 16], knL: [0, 0, -8], knR: [0, 0, -4], ftL: [0, 0, -20], ftR: [0, 0, -10] },
};
const slamBoth: PoseDef = {
  x: 0.46,
  y: -0.15,
  s: { sq: 0.12 },
  aim: { shR: [0.9, -0.3, 0.3], elR: [0.9, -0.45, 0.15], shL: [0.9, -0.3, -0.3], elL: [0.9, -0.45, -0.15], face: 0.7 },
  j: { hips: [0, -20, 0], spine: [0, 0, -24], chest: [0, -6, -14], head: [0, 0, 18], thL: [6, 20, 60], knL: [0, 0, -80], thR: [-8, 18, 10], knR: [0, 0, -76] },
};
/** Deep crouch before the take-off: arms swung back, chest over the knees. */
const takeoffCrouch: PoseDef = {
  x: 0.86,
  y: -0.17,
  s: { sq: 0.14 },
  aim: { shR: [-0.75, -0.6, 0.3], elR: [-0.6, -0.6, 0.2], shL: [-0.75, -0.6, -0.3], elL: [-0.6, -0.6, -0.2], face: 0.6 },
  j: { hips: [0, -10, 0], spine: [0, 0, -26], chest: [0, -4, -14], head: [0, 0, 20], thL: [6, 12, 64], knL: [0, 0, -96], thR: [-6, 12, 30], knR: [0, 0, -92] },
};
const takeoff: PoseDef = {
  x: 1.04,
  y: 0.5,
  rot: -6,
  s: { sq: -0.12 },
  aim: { shR: [0.4, 1, 0.3], elR: [0.3, 1, 0.2], shL: [0.4, 1, -0.3], elL: [0.3, 1, -0.2], face: 0.6 },
  j: { spine: [0, 0, -8], thL: [6, 10, 86], knL: [0, 0, -120], thR: [-6, 10, -10], knR: [0, 0, -30], ftR: [0, 0, -30] },
};
const kickChamber: PoseDef = {
  x: 1.22,
  y: 0.98,
  rot: -14,
  aim: { shL: [-0.4, 0.6, -0.4], elL: [-0.2, 0.8, -0.3], shR: [-0.5, 0.3, 0.4], elR: [-0.3, 0.6, 0.3] },
  j: { spine: [0, 0, 6], thR: [-10, 0, 104], knR: [0, 0, -124], thL: [10, 0, 70], knL: [0, 0, -120] },
};
const flyKick: PoseDef = {
  x: 1.34,
  y: 1.05,
  rot: -20,
  aim: { shL: [-0.4, 0.6, -0.4], elL: [-0.2, 0.8, -0.3], shR: [-0.5, 0.3, 0.4], elR: [-0.3, 0.6, 0.3] },
  j: { spine: [0, 0, 12], thR: [-10, 0, 95], knR: [0, 0, -4], ftR: [0, 0, -10], thL: [10, 0, 20], knL: [0, 0, -110] },
};
/** Tucked backflip: knees to the chest, hands on the shins. */
const tuck = (x: number, y: number, rot: number): PoseDef => ({
  x,
  y,
  rot,
  aim: { shR: [0.6, -0.5, 0.35], elR: [0.8, 0.1, 0.2], shL: [0.6, -0.5, -0.35], elL: [0.8, 0.1, -0.2] },
  j: { spine: [0, 0, -18], chest: [0, 0, -12], head: [0, 0, -10], thL: [6, 6, 118], knL: [0, 0, -134], thR: [-6, 6, 112], knR: [0, 0, -132] },
});
const landing: PoseDef = {
  x: 0.12,
  y: -0.17,
  rot: 360,
  s: { sq: 0.2 },
  aim: { shR: [0.5, -0.8, 0.5], elR: [0.6, -0.7, 0.3], shL: [0.6, 0.1, -0.8], elL: [0.7, 0.5, -0.4], face: 0.7 },
  j: { spine: [0, 0, -22], chest: [0, -10, -10], head: [0, 0, 14], thL: [6, 20, 70], knL: [0, 0, -100], thR: [-8, 18, 6], knR: [0, 0, -96] },
};
const mvp: PoseDef = { aim: { shR: [0.3, 1, 0.2], elR: [0.25, 1, 0.15], shL: [0.4, -0.8, -0.3], elL: [0.5, 0.6, -0.2], face: 0.7 }, j: { head: [0, 0, 14], chest: [0, -6, 8] } };

const NINETY_ATK = smoothClip(
  [
    { f: 0, p: compose(JS, { x: 0.1 }) },
    // he takes the chain off his chest, then spins it overhead: one key per quarter turn keeps hand and pendant in sync
    { f: 4, p: compose(chainGrab, { x: 0.1 }), e: 'out' },
    ...Array.from({ length: 8 }, (_, i) => ({ f: LASSO0 + i * 2, p: compose(lasso(lassoPhase(LASSO0 + i * 2)), { x: 0.1 }) })),
    { f: 25, p: throwCoil, e: 'inOut' },
    { f: 29, p: throwPose, e: 'snap' },
    { f: 36, p: throwFollow, e: 'out' },
    { f: 45, p: leadReady, e: 'inOut' },
    { f: 51, p: cockR, e: 'inOut' },
    { f: 58, p: slashR, e: 'snap' },
    { f: 62, p: followR, e: 'out' },
    { f: 65, p: cockL, e: 'inOut' },
    { f: 70, p: slashL, e: 'snap' },
    { f: 74, p: followL, e: 'out' },
    { f: 78, p: bothUp, e: 'inOut' },
    { f: 82, p: slamBoth, e: 'snap' },
    { f: 87, p: compose(slamBoth, { y: -0.12, s: { sq: 0.06 } }), e: 'out' },
    // run-up: two strides, crouch, take-off, chamber, kick through the 99
    { f: 91, p: compose(runPose(0.25), { x: 0.56 }), e: 'inOut' },
    { f: 95, p: compose(runPose(0.75), { x: 0.72 }) },
    { f: 99, p: takeoffCrouch, e: 'inOut' },
    { f: 103, p: takeoff, e: 'snap' },
    { f: 108, p: kickChamber, e: 'out' },
    { f: 112, p: flyKick, e: 'snap' },
    { f: 115, p: compose(flyKick, { x: 1.4, y: 1.1 }), e: 'out' },
    // push off their body into a tucked backflip, all the way back to his own spot
    { f: 119, p: tuck(1.2, 1.4, 70), e: 'inOut' },
    { f: 124, p: tuck(0.8, 1.6, 190) },
    { f: 129, p: tuck(0.4, 1.0, 300) },
    { f: 132, p: compose(JS, { x: 0.18, y: 0.12, rot: 350, s: { sq: -0.06 } }) },
    { f: 135, p: landing, e: 'in' },
    // rot 360 == 0: the hold key swaps it without a visible change, so the blend out of the cinematic does not spin
    { f: 141, p: compose(JS, { x: 0.06, rot: 360 }), e: 'out' },
    { f: 142, p: compose(JS, { x: 0.06, rot: 0 }), e: 'hold' },
    { f: 148, p: compose(mvp, { x: 0.04 }), e: 'out' },
    { f: 160, p: compose(mvp, { x: 0.04, y: 0.02 }) },
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
      // they watch the pendant spin, then the throw: a flinch
      { f: 29, p: compose(set.stance, { x: 0, j: { head: [0, -10, -16] } }), e: 'inOut' },
      { f: 34, p: float(0.7, 20, 1), e: 'snap' },
      { f: 48, p: float(1.0, 8), e: 'out' },
      { f: 58, p: float(0.95, 30, -1), e: 'snap' },
      { f: 64, p: float(1.05, 12) },
      { f: 70, p: float(1.0, -10, 1), e: 'snap' },
      { f: 76, p: float(1.1, 10) },
      { f: 82, p: float(0.9, 40, -1), e: 'snap' },
      { f: 104, p: float(1.1, 18), e: 'inOut' },
      { f: 112, p: compose(r.juggle, { x: at(VX + 0.2), y: 1.2, rot: 90 }), e: 'snap' },
      { f: 124, p: compose(r.juggle, { x: at(2.4), y: 0.9, rot: 240 }), e: 'out' },
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
  const held = new THREE.Vector3(1.9, 1.9, 0); // where they were when the 99 shatters
  return {
    group,
    lights: [light],
    update(f: number, c: PropCtx) {
      const atk = c.rigs[0];
      const hand = atk ? atk.joints.haR.getWorldPosition(tmp).clone() : new THREE.Vector3();
      const handL = group.worldToLocal(hand.clone());
      // the floating opponent's hips (attacker-local): the nines orbit and smash what is actually there
      const vrig = c.rigs[1];
      const vic = vrig ? group.worldToLocal(vrig.joints.hips.getWorldPosition(tmp).clone()) : new THREE.Vector3(1.9, 1.9, 0);
      vic.z = 0;
      if (f < 112) held.copy(vic);
      // 0-8 hangs from his hand; 8-29 spins overhead in time with his forearm; 29-34 flies and grows; 34-40 the 99 stands
      let size = 0.12;
      const center = new THREE.Vector3();
      if (f < LASSO0) {
        center.copy(handL).add(new THREE.Vector3(0.03, -0.14 + 0.24 * lin(f, 4, LASSO0), 0.04));
      } else if (f < 29) {
        const a = lassoPhase(f) - 0.9;
        center.copy(handL).add(new THREE.Vector3(Math.cos(a) * 0.45, 0.1, Math.sin(a) * 0.45));
      } else if (f < 34) {
        const k = lin(f, 29, 34);
        center.copy(handL).lerp(new THREE.Vector3(1.9, NINE_H * 0.5, -0.25), ease(k));
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
            n.position.set(vic.x + off * 0.8, vic.y - 0.2, -0.8);
            n.scale.setScalar(size * 0.85 * (1 + 0.04 * Math.sin(c.time * 12)));
          }
        } else if (split) {
          // orbit the floating opponent on a flat ellipse (never into the lens), faces turned to the camera; each
          // nine swings in for its hit (58 A, 70 B, 82 both)
          const ph = (f - 40) * 0.16 + i * Math.PI;
          const smash = (h: number) => Math.max(0, 1 - Math.abs(f - h) / 5);
          const k = 1 - 0.85 * (i === 0 ? Math.max(smash(58), smash(82)) : Math.max(smash(70), smash(82)));
          n.position.set(vic.x + Math.cos(ph) * 1.25 * k, vic.y - 0.35 + Math.sin(ph * 0.7) * 0.25, (Math.sin(ph) * 0.6 - 0.15) * k);
          n.rotation.set(0, 0.35 * Math.sin(ph), 0.3 * Math.cos(ph * 0.8));
          n.scale.setScalar(size * 0.62);
        }
      });
      // the chain line from his hand to the pendant while it swings
      chain.visible = f < 29;
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
        m.position.set(held.x + v.x * t, held.y + v.y * t - 9.8 * t * t * 0.5 * 1.2, -0.4 + v.z * t);
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
    { f: 142, pos: [2.5, 1.45, 2.8], target: [0.75, 1.4, 0], fov: 36, cut: true },
    { f: 160, pos: [2.3, 1.5, 2.5], target: [0.75, 1.45, 0], fov: 34 },
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
  // after the pile-on they line up behind the two, arms crossed (x, z): framing the right hand, never in front of it
  const back = ([[-0.7, -0.9], [2.5, -1.0], [-1.25, -1.5], [3.05, -1.6]] as const)[i];
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
      { f: 116, p: [back[0], 0, back[1]], e: 'inOut' },
      { f: 170, p: [back[0], 0, back[1]] },
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
    { f: 50, word: 'HANDYVERBOT!', fill: '#ff4f6a', w: 1.25, pos: [1.2, 1.72, 0.2], len: 20 },
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
