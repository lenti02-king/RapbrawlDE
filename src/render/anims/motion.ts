// Motion building blocks shared by all fighters: strike clips with anticipation / impact / follow-through / settle,
// a 4-key walk cycle, hit and block reactions with an impact snap, jump squash & stretch, dashes and landings.
// Everything is presentation only; frame numbers line up with the sim's move frames (1 = first move frame).
import { Clip, compose, type EaseName, type Key, type PoseDef } from '../pose';
import type { Reactions } from './stances';

export interface StrikeSpec {
  /** Sim frame data (startup = first active frame). */
  startup: number;
  active: number;
  total: number;
  /** Pose the move starts from and returns to (default: the stance). */
  base?: PoseDef;
  /** Anticipation (wind-up) pose and the frame it peaks on (default ~60 % of the startup). */
  wind: PoseDef;
  windAt?: number;
  /** Extra early key (e.g. a step or a chamber) between start and the wind-up peak. */
  pre?: { f: number; p: PoseDef };
  /** Contact pose on the first active frame. */
  hit: PoseDef;
  /** Pose on the last active frame (default: the contact pose). */
  hold?: PoseDef;
  /** Follow-through a few frames after the active window (momentum carries past the target). */
  follow?: PoseDef;
  followAt?: number;
  /** Late recovery pose (small overshoot back) before the move returns to `base`. */
  settle?: PoseDef;
  /** Ease into the wind-up (default 'out': quick start, slow arrival = readable anticipation). */
  windEase?: EaseName;
}

/** Builds a strike clip on top of a stance (`stance` composes under every key). */
export function strike(spec: StrikeSpec, stance: PoseDef): Clip {
  const { startup, active, total } = spec;
  const base = spec.base ?? {};
  // the delivery (wind-up peak -> contact) gets at least ~45 % of the startup, up to 5 frames (S13): a big arc squeezed
  // into 3 frames moved the fists up to 0.9 m per frame - a teleport, not a strike
  const minDeliver = Math.min(5, Math.floor(startup * 0.45));
  const windAt = Math.max(2, Math.min(startup - 1, startup - minDeliver, spec.windAt ?? Math.round(startup * 0.6)));
  const lastActive = startup + active - 1;
  const followAt = Math.min(total - 2, spec.followAt ?? lastActive + 3);
  const settleAt = Math.max(followAt + 1, total - Math.max(3, Math.round((total - followAt) * 0.4)));
  const keys: Key[] = [{ f: 1, p: base }];
  if (spec.pre && spec.pre.f > 1 && spec.pre.f < windAt) keys.push({ f: spec.pre.f, p: compose(base, spec.pre.p), e: 'inOut' });
  keys.push({ f: windAt, p: compose(base, spec.wind), e: spec.windEase ?? 'out' });
  keys.push({ f: startup, p: compose(base, spec.hit), e: 'strike' });
  if (lastActive > startup) keys.push({ f: lastActive, p: compose(base, spec.hold ?? spec.hit), e: 'out' });
  if (followAt > lastActive) keys.push({ f: followAt, p: compose(base, spec.follow ?? spec.hold ?? spec.hit), e: 'out' });
  if (settleAt < total) keys.push({ f: settleAt, p: compose(base, spec.settle ?? {}), e: 'inOut' });
  keys.push({ f: total, p: base, e: 'inOut' });
  return new Clip(keys, stance);
}

export interface WalkSpec {
  /** Metres covered per step (two steps per cycle); drives the cycle phase from the distance walked. */
  step: number;
  /** Body bob (m) and squash on contact. */
  bob: number;
  /** Lead (far, L) and rear (near, R) leg swing amplitudes in degrees. */
  lift: number;
  /** Torso counter-twist (deg) and forward lean (deg, - = forward). */
  twist: number;
  lean: number;
}

/**
 * Fighting-game shuffle walk: the leading foot steps out, the trailing foot follows (legs never cross), the body
 * dips on each contact and rises while a foot travels. Backward walks lead with the rear foot. Sampled 0..4.
 */
export function walkCycle(stance: PoseDef, w: WalkSpec, back: boolean): Clip {
  const J = stance.j ?? {};
  const thL = J.thL ?? [0, 0, 0];
  const knL = J.knL ?? [0, 0, 0];
  const thR = J.thR ?? [0, 0, 0];
  const knR = J.knR ?? [0, 0, 0];
  const ftR = J.ftR ?? [0, 0, 0];
  const ftL = J.ftL ?? [0, 0, 0];
  const y0 = stance.y ?? 0;
  const L = w.lift;
  const d = back ? -1 : 1;
  const leg = (th: number[], kn: number[], dz: number, dk: number): [number, number, number][] => [
    [th[0], th[1], th[2] + dz],
    [kn[0], kn[1], kn[2] + dk],
  ];
  // forward: lead (L) steps first; backward: rear (R) steps first
  const lead = back ? 'R' : 'L';
  const mk = (leadDz: number, leadDk: number, trailDz: number, trailDk: number, dy: number, sq: number, twist: number, footLift = 0): PoseDef => {
    const [aTh, aKn] = lead === 'L' ? leg(thL, knL, leadDz, leadDk) : leg(thR, knR, leadDz, leadDk);
    const [bTh, bKn] = lead === 'L' ? leg(thR, knR, trailDz, trailDk) : leg(thL, knL, trailDz, trailDk);
    const j: PoseDef['j'] = lead === 'L' ? { thL: aTh, knL: aKn, thR: bTh, knR: bKn } : { thR: aTh, knR: aKn, thL: bTh, knL: bKn };
    j.ftR = [ftR[0], ftR[1], ftR[2] + (lead === 'R' ? footLift : -footLift * 0.5)];
    j.ftL = [ftL[0], ftL[1], ftL[2] + (lead === 'L' ? footLift : -footLift * 0.5)];
    const sp = J.spine ?? [0, 0, 0];
    const ch = J.chest ?? [0, 0, 0];
    j.spine = [sp[0], sp[1] - twist * 0.4, sp[2] + w.lean * d];
    j.chest = [ch[0], ch[1] - twist, ch[2]];
    return { y: y0 + dy, j, s: { sq } };
  };
  const contact = mk(0, 0, 0, 0, -w.bob, 0.05, 0);
  // the moving foot passes with the knee up, the support leg pushes, the body rises
  const leadUp = mk(L * d, -L * 1.6, -L * 0.5 * d, L * 0.2, w.bob * 0.6, -0.03, w.twist, 10);
  const wide = mk(L * 0.75 * d, -L * 0.25, -L * 0.6 * d, -L * 0.1, -w.bob * 1.2, 0.07, -w.twist * 0.5);
  const trailUp = mk(L * 0.35 * d, -L * 0.3, L * 0.45 * d, -L * 1.8, w.bob * 0.5, -0.03, -w.twist, 10);
  const full = (p: PoseDef) => compose(stance, p);
  return new Clip(
    [
      { f: 0, p: full(contact) },
      { f: 1, p: full(leadUp), e: 'inOut' },
      { f: 2, p: full(wide), e: 'inOut' },
      { f: 3, p: full(trailUp), e: 'inOut' },
      { f: 4, p: full(contact), e: 'inOut' },
    ],
  );
}

export interface MotionClips {
  walkF: Clip;
  walkB: Clip;
  step: number;
  /** Hit reactions sampled by state frame (frame 0 = impact, held during hitstop). */
  hitHigh: Clip;
  hitGut: Clip;
  hitLow: Clip;
  hitCrouch: Clip;
  blockStand: Clip;
  blockCrouch: Clip;
  jumpSquat: Clip;
  land: Clip;
  dashF: Clip;
  dashB: Clip;
  countered: Clip;
  wakeup?: Clip;
}

/** Generic movement/reaction clips from a fighter's reaction poses (fighters may override any of them). */
export function motionClips(stance: PoseDef, r: Reactions, walk: WalkSpec, o: { dashF: number; dashB: number; jumpSquat: number }): MotionClips {
  const st = compose(stance);
  // reactions: snap into an exaggerated impact pose (squashed, head whipped), ease back into the reaction pose,
  // then the animator blends to neutral as hitstun runs out
  const react = (pose: PoseDef, impact: PoseDef) =>
    new Clip([
      { f: 0, p: compose(pose, impact) },
      { f: 3, p: compose(pose, { s: { sq: -0.03 } }), e: 'out' },
      { f: 9, p: pose, e: 'inOut' },
      { f: 16, p: compose(pose, { x: (pose.x ?? 0) * 0.6 }), e: 'inOut' },
    ]);
  const hitHigh = react(r.hitHigh, { x: (r.hitHigh.x ?? 0) - 0.06, s: { sq: 0.1 }, j: { neck: [0, 26, 30], head: [0, 36, 34] } });
  const hitGut = react(r.hitGut, { y: (r.hitGut.y ?? 0) - 0.04, s: { sq: 0.16 }, j: { spine: [0, -6, -40], chest: [0, -10, -30] } });
  const hitLow = react(r.hitLow, { y: (r.hitLow.y ?? 0) - 0.04, s: { sq: 0.12 } });
  const hitCrouch = react(r.hitCrouch, { x: (r.hitCrouch.x ?? 0) - 0.05, s: { sq: 0.12 } });
  const block = (pose: PoseDef) =>
    new Clip([
      { f: 0, p: compose(pose, { x: (pose.x ?? 0) - 0.05, s: { sq: 0.08 } }) },
      { f: 4, p: pose, e: 'out' },
    ]);
  const js = Math.max(2, o.jumpSquat);
  return {
    walkF: walkCycle(stance, walk, false),
    walkB: walkCycle(stance, walk, true),
    step: walk.step,
    hitHigh,
    hitGut,
    hitLow,
    hitCrouch,
    blockStand: block(r.blockStand),
    blockCrouch: block(r.blockCrouch),
    // squash down, arms swing back; the last frame is the deepest point (takeoff stretch comes from the air state)
    jumpSquat: new Clip([
      { f: 0, p: compose(r.jumpSquat, { y: (r.jumpSquat.y ?? 0) * 0.5, s: { sq: 0.08 } }) },
      { f: js, p: compose(r.jumpSquat, { s: { sq: 0.22 } }), e: 'out' },
    ]),
    land: new Clip([
      { f: 0, p: compose(r.land, { s: { sq: 0.24 } }) },
      { f: 3, p: compose(r.land, { y: (r.land.y ?? 0) * 0.5, s: { sq: 0.06 } }), e: 'out' },
      { f: 6, p: compose(st, { s: { sq: -0.02 } }), e: 'inOut' },
    ]),
    // dash: lean + stretch on the burst, low glide, plant with a squash
    dashF: new Clip([
      { f: 0, p: compose(r.dashF, { x: 0.02, s: { sq: -0.1 } }) },
      { f: 3, p: compose(r.dashF, { x: 0.08, y: 0.02, s: { sq: -0.06 } }), e: 'out' },
      { f: Math.max(4, o.dashF - 4), p: compose(r.dashF, { x: 0.06, y: -0.04 }), e: 'inOut' },
      { f: o.dashF, p: compose(st, { y: (st.y ?? 0) - 0.06, s: { sq: 0.12 } }), e: 'out' },
    ]),
    dashB: new Clip([
      { f: 0, p: compose(r.dashB, { s: { sq: 0.1 } }) },
      { f: 3, p: compose(r.dashB, { x: -0.06, y: 0.05, s: { sq: -0.08 } }), e: 'out' },
      { f: Math.max(4, o.dashB - 5), p: compose(r.dashB, { x: -0.04, y: 0.02 }), e: 'inOut' },
      { f: o.dashB, p: compose(st, { y: (st.y ?? 0) - 0.05, s: { sq: 0.1 } }), e: 'out' },
    ]),
    countered: new Clip([
      { f: 0, p: compose(r.countered, { s: { sq: 0.14 }, x: (r.countered.x ?? 0) - 0.06 }) },
      { f: 5, p: r.countered, e: 'out' },
    ]),
  };
}
