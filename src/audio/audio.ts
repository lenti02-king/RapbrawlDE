// Procedural audio engine: all SFX and music are synthesized at runtime with the
// Web Audio API (no external assets → no licensing risk during development).
// Final game audio can replace individual cues by name (see `cue` mapping).
import type { SimEvent } from '../core/events';
import { getCard } from '../core/registry';
import type { GameState } from '../core/state';

/** 90 BPM = one beat every 40 sim frames (RULES.BEAT_FRAMES): Beat-Drop hits are judged on the sim's beat clock. */
const BPM = 90;
const BEAT = 60 / BPM;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private crowdGain!: GainNode;
  private verbSend!: GainNode;
  private noise!: AudioBuffer;
  private musicOn = false;
  private nextNoteTime = 0;
  private step16 = 0;
  private barStart = 0;
  private schedTimer: number | null = null;
  private hype = 0;
  private sfxVol = 1;
  muted = false;

  constructor() {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    // reverb send
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(1.6);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.35;
    this.verbSend.connect(conv).connect(this.master);
    // noise
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // crowd bed
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.05;
    const crowd = ctx.createBufferSource();
    crowd.buffer = this.noise;
    crowd.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    crowd.connect(bp).connect(lp).connect(this.crowdGain).connect(this.master);
    crowd.start();
    if (this.musicOn) this.startScheduler();
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  /** 0..1 pulse on each beat (kick), for visuals. */
  beat(): number {
    if (!this.ctx || !this.musicOn) {
      const t = performance.now() / 1000;
      return Math.pow(1 - ((t / BEAT) % 1), 3);
    }
    const t = this.ctx.currentTime - this.barStart;
    return Math.pow(1 - (((t / BEAT) % 1) + 1) % 1, 3);
  }

  /** Nudge the music so its next quarter note lands `toNext` seconds from now (the sim's next beat). */
  syncBeat(toNext: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || this.schedTimer === null) return;
    const now = ctx.currentTime + (ctx.outputLatency || ctx.baseLatency || 0);
    const k = Math.ceil((now - this.barStart) / BEAT - 1e-3);
    const audioNext = this.barStart + k * BEAT;
    let err = audioNext - (now + toNext);
    // wrap into (-BEAT/2, BEAT/2]
    err -= Math.round(err / BEAT) * BEAT;
    if (Math.abs(err) < 0.012) return;
    // big jumps (round start) snap at once, small drift is eased out
    const shift = Math.abs(err) > 0.12 ? err : err * 0.25;
    this.nextNoteTime -= shift;
    this.barStart -= shift;
    if (this.nextNoteTime < ctx.currentTime) this.nextNoteTime = ctx.currentTime + 0.01;
  }

  startMusic(): void {
    this.musicOn = true;
    if (this.ctx && this.schedTimer === null) this.startScheduler();
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.schedTimer !== null) window.clearInterval(this.schedTimer);
    this.schedTimer = null;
  }

  private startScheduler(): void {
    const ctx = this.ctx!;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.barStart = this.nextNoteTime;
    this.step16 = 0;
    this.schedTimer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const ctx = this.ctx!;
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      this.playStep(this.step16, this.nextNoteTime);
      const swing = this.step16 % 2 === 0 ? 1.12 : 0.88;
      this.nextNoteTime += (BEAT / 4) * swing;
      this.step16 = (this.step16 + 1) % 64;
      if (this.step16 % 16 === 0) this.barStart = this.nextNoteTime;
    }
  }

  // --- music voices ------------------------------------------------------
  private playStep(st: number, t: number): void {
    const s16 = st % 16;
    const bar = Math.floor(st / 16);
    const kicks = [0, 7, 10];
    if (kicks.includes(s16) || (bar === 3 && s16 === 14)) this.kick(t, s16 === 0 ? 1 : 0.8);
    if (s16 === 4 || s16 === 12) this.snare(t);
    if (s16 % 2 === 0 || this.hype > 0.5) this.hat(t, s16 % 4 === 2 ? 0.5 : 0.28, s16 === 14 && this.hype > 0.3);
    // bassline: Am - Am - F - G (in A minor), root notes
    const roots = [45, 45, 41, 43];
    const root = roots[bar];
    if (s16 === 0 || s16 === 7 || s16 === 10) this.bass(t, root, s16 === 0 ? 0.42 : 0.28);
    if (s16 === 0) this.pad(t, root + 12, BEAT * 4);
    if (s16 === 8 && bar % 2 === 1) this.pluck(t, root + 24 + 7);
    if (s16 === 14 && bar === 3) this.pluck(t, root + 24 + 10);
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private kick(t: number, v: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, 0.9 * v, 0.32);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.4);
  }

  private snare(t: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.55, 0.18);
    n.connect(bp).connect(g).connect(this.music);
    const vs = ctx.createGain();
    vs.gain.value = 0.25;
    g.connect(vs).connect(this.verbSend);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.25);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g2 = ctx.createGain();
    this.env(g2, t, 0.002, 0.3, 0.1);
    o.connect(g2).connect(this.music);
    o.start(t);
    o.stop(t + 0.15);
  }

  private hat(t: number, v: number, open: boolean): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    this.env(g, t, 0.001, v * 0.35, open ? 0.22 : 0.04);
    n.connect(hp).connect(g).connect(this.music);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.3);
  }

  private bass(t: number, midi: number, v: number): void {
    const ctx = this.ctx!;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.frequency.value = f / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    this.env(g, t, 0.01, v, BEAT * 1.4);
    o.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(this.music);
    o.start(t);
    sub.start(t);
    o.stop(t + BEAT * 1.6);
    sub.stop(t + BEAT * 1.6);
  }

  private pad(t: number, midi: number, dur: number): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900 + this.hype * 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.music);
    const vs = ctx.createGain();
    vs.gain.value = 0.4;
    g.connect(vs).connect(this.verbSend);
    // minor triad
    for (const iv of [0, 3, 7, 10]) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 440 * Math.pow(2, (midi + iv - 69) / 12);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private pluck(t: number, midi: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const g = ctx.createGain();
    this.env(g, t, 0.003, 0.08, 0.3);
    o.connect(lp).connect(g).connect(this.music);
    const vs = ctx.createGain();
    vs.gain.value = 0.6;
    g.connect(vs).connect(this.verbSend);
    o.start(t);
    o.stop(t + 0.4);
  }

  // --- SFX -----------------------------------------------------------------
  private now(): number {
    return this.ctx!.currentTime;
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, dur: number, verb = 0): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.001, peak * this.sfxVol, dur);
    n.connect(f).connect(g).connect(this.sfx);
    if (verb > 0) {
      const v = ctx.createGain();
      v.gain.value = verb;
      g.connect(v).connect(this.verbSend);
    }
    n.start(t, Math.random() * 0.6);
    n.stop(t + dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, peak: number, dur: number, verb = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.002, peak * this.sfxVol, dur);
    o.connect(g).connect(this.sfx);
    if (verb > 0) {
      const v = ctx.createGain();
      v.gain.value = verb;
      g.connect(v).connect(this.verbSend);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  whoosh(strength: number): void {
    if (!this.ctx) return;
    const t = this.now();
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1800 + strength * 500, t + 0.09 + strength * 0.03);
    const g = ctx.createGain();
    this.env(g, t, 0.02, (0.18 + strength * 0.08) * this.sfxVol, 0.1 + strength * 0.04);
    n.connect(bp).connect(g).connect(this.sfx);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.3);
  }

  hit(strength: number, counter: boolean): void {
    if (!this.ctx) return;
    const t = this.now();
    const s = strength;
    this.tone(t, 'sine', 160 + s * 10, 42, 0.55 + s * 0.15, 0.14 + s * 0.05);
    this.tone(t, 'triangle', 420 - s * 60, 110, 0.25 + s * 0.05, 0.06 + s * 0.02);
    this.noiseHit(t, 'highpass', 2200 - s * 300, 0.7, 0.45 + s * 0.1, 0.035 + s * 0.015, s >= 2 ? 0.4 : 0.1);
    this.noiseHit(t, 'lowpass', 900, 0.8, 0.35 + s * 0.08, 0.08 + s * 0.04);
    if (counter) {
      this.tone(t, 'square', 1320, 1180, 0.1, 0.25, 0.5);
      this.tone(t, 'square', 1985, 1700, 0.06, 0.25, 0.5);
    }
    this.crowdSwell(0.04 + s * 0.04);
  }

  block(strength: number): void {
    if (!this.ctx) return;
    const t = this.now();
    this.noiseHit(t, 'bandpass', 3200, 2.5, 0.4, 0.04);
    this.tone(t, 'square', 720 - strength * 80, 520, 0.08, 0.05);
    this.tone(t, 'sine', 140, 60, 0.25, 0.06);
  }

  slam(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 'sine', 110, 30, 1.0, 0.45, 0.5);
    this.noiseHit(t, 'lowpass', 500, 0.7, 0.8, 0.3, 0.6);
    this.noiseHit(t, 'highpass', 1500, 0.5, 0.3, 0.06);
    this.crowdSwell(0.2);
  }

  // ------------------------------------------------------------ signature music
  // A licensed track per fighter can be dropped in as public/assets/music/<fighter>.mp3 (+ optional <fighter>.json
  // {"start": seconds, "length": seconds}); it then plays as a short excerpt over the Signature cinematic. Without a
  // file (default, and always until the rights are cleared) an original procedural stinger plays instead.
  private tracks = new Map<string, { buf: AudioBuffer; start: number; length: number } | null>();

  async loadSignatureTrack(fighter: string): Promise<boolean> {
    if (this.tracks.has(fighter)) return !!this.tracks.get(fighter);
    this.tracks.set(fighter, null);
    if (!this.ctx) return false;
    try {
      const res = await fetch(`assets/music/${fighter}.mp3`);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.startsWith('audio')) return false;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      type Meta = { start?: number; length?: number };
      const meta: Meta = await fetch(`assets/music/${fighter}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<Meta>) : {}))
        .catch(() => ({}));
      this.tracks.set(fighter, { buf, start: meta.start ?? 0, length: Math.min(meta.length ?? 8, 15) });
      return true;
    } catch {
      return false;
    }
  }

  /** Plays the fighter's Signature music (licensed excerpt if present, else an original stinger), ducking the beat. */
  signatureMusic(fighter: string): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = this.now();
    const tr = this.tracks.get(fighter);
    const dur = tr ? tr.length : 4.2;
    // duck the generative beat under it
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0.05, t, 0.08);
    this.music.gain.setTargetAtTime(0.32, t + dur, 0.4);
    if (tr) {
      const src = ctx.createBufferSource();
      src.buffer = tr.buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.25);
      g.gain.setValueAtTime(0.9, t + dur - 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(g).connect(this.master);
      src.start(t, tr.start, dur);
      return;
    }
    this.stinger(fighter, t);
  }

  /** Original 4-second themes: Jazeek = smooth R&B (sus chords, sung lead), Bonez = dark street (808, minor riff). */
  private stinger(fighter: string, t0: number): void {
    const beat = 0.34;
    const n = (semi: number) => 220 * Math.pow(2, semi / 12);
    if (fighter === 'jazeek') {
      // Fmaj9 -> Em7 -> Dm9 -> G13 stabs with a vibrato lead on top
      const chords = [
        [-4, 0, 3, 7, 10],
        [-5, -2, 2, 5, 9],
        [-7, -3, 0, 3, 7],
        [-2, 2, 5, 9, 12],
      ];
      chords.forEach((c, i) => c.forEach((st) => this.tone(t0 + i * beat * 2, 'triangle', n(st), n(st), 0.07, beat * 2.1, 0.5)));
      const lead = [12, 14, 15, 14, 12, 10, 12, 7, 9, 10, 12, 15];
      lead.forEach((st, i) => this.sing([0], 0.06, n(st + 12) / 2, t0 + i * beat * 0.67));
      for (let i = 0; i < 12; i++) this.noiseHit(t0 + i * beat * 0.67, 'highpass', 7000, 0.6, 0.08, 0.03);
    } else {
      // 808 slides + a dark minor riff on a detuned saw
      const bass = [-24, -24, -21, -26];
      bass.forEach((st, i) => this.tone(t0 + i * beat * 2, 'sine', n(st), n(st - 2), 0.55, beat * 1.9));
      const riff = [0, 3, 7, 6, 3, 0, -2, 0, 3, 5, 3, -2];
      riff.forEach((st, i) => {
        this.tone(t0 + i * beat * 0.67, 'sawtooth', n(st - 5), n(st - 5), 0.05, beat * 0.6, 0.3);
        this.tone(t0 + i * beat * 0.67, 'sawtooth', n(st - 5) * 1.006, n(st - 5) * 1.006, 0.04, beat * 0.6);
      });
      for (let i = 0; i < 12; i++) this.noiseHit(t0 + i * beat * 0.67, 'highpass', i % 3 === 2 ? 3000 : 8000, 0.6, i % 3 === 2 ? 0.16 : 0.07, 0.04);
    }
  }

  riser(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now();
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.55);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(6000, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(lp).connect(g).connect(this.sfx);
    const v = ctx.createGain();
    v.gain.value = 0.5;
    g.connect(v).connect(this.verbSend);
    o.start(t);
    o.stop(t + 0.7);
    this.tone(t, 'sine', 2600, 2400, 0.12, 0.5, 0.8);
    this.noiseHit(t, 'highpass', 6000, 0.5, 0.3, 0.25, 0.6);
    this.crowdSwell(0.3);
  }

  stab(): void {
    if (!this.ctx) return;
    const t = this.now();
    for (const f of [220, 261.6, 329.6]) this.tone(t, 'sawtooth', f, f * 0.99, 0.07, 0.16, 0.3);
  }

  deny(): void {
    if (!this.ctx) return;
    this.tone(this.now(), 'square', 110, 90, 0.08, 0.12);
  }

  boom(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 'sine', 90, 25, 1.2, 1.1, 0.9);
    this.noiseHit(t, 'lowpass', 400, 0.6, 1.0, 0.9, 0.9);
    this.noiseHit(t, 'highpass', 2500, 0.5, 0.4, 0.1, 0.5);
    this.crowdSwell(0.5);
  }

  /** Sung phrase: sawtooth through two vowel formants with vibrato. notes = semitones over base. */
  sing(notes: number[], step = 0.16, base = 330, at?: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = at ?? this.now();
    notes.forEach((n, i) => {
      const t = t0 + i * step;
      const f = base * Math.pow(2, n / 12);
      const dur = step * (i === notes.length - 1 ? 3.2 : 1.15);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.6;
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(f * 0.014, t + dur * 0.6);
      vib.connect(vg).connect(o.frequency);
      const g = ctx.createGain();
      const peak = 0.55 * this.sfxVol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.035);
      g.gain.setValueAtTime(peak, t + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const [ff, q] of [
        [760, 5],
        [1180, 7],
        [2600, 9],
      ]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = ff;
        bp.Q.value = q;
        o.connect(bp).connect(g);
      }
      g.connect(this.sfx);
      const v = ctx.createGain();
      v.gain.value = 0.7;
      g.connect(v).connect(this.verbSend);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.05);
      vib.stop(t + dur + 0.05);
    });
  }

  chime(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 'sine', 1568, 1560, 0.14, 0.7, 0.8);
    this.tone(t + 0.06, 'sine', 2349, 2340, 0.08, 0.6, 0.8);
    this.tone(t + 0.12, 'triangle', 3136, 3130, 0.04, 0.5, 0.9);
  }

  /** Sub-bass drop with a short grit layer. */
  bassDrop(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 'sine', 72, 30, 1.15, 1.0, 0.3);
    this.tone(t, 'square', 55, 38, 0.12, 0.35);
    this.noiseHit(t, 'lowpass', 260, 0.7, 0.7, 0.5, 0.5);
    this.crowdSwell(0.3);
  }

  snap(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.noiseHit(t, 'highpass', 2800, 0.6, 0.6, 0.045);
    this.tone(t, 'square', 320, 70, 0.18, 0.07);
    this.tone(t, 'sine', 130, 45, 0.7, 0.18);
  }

  smoke(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.noiseHit(t, 'lowpass', 900, 0.5, 0.45, 0.7, 0.4);
    this.noiseHit(t, 'bandpass', 2400, 1.2, 0.12, 0.4);
  }

  ui(kind: 'click' | 'back'): void {
    if (!this.ctx) return;
    this.tone(this.now(), 'triangle', kind === 'click' ? 1200 : 700, kind === 'click' ? 1500 : 500, 0.06, 0.05);
  }

  crowdSwell(amount: number): void {
    if (!this.ctx) return;
    const t = this.now();
    const g = this.crowdGain.gain;
    const base = 0.04 + this.hype * 0.05;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(base, g.value), t);
    g.linearRampToValueAtTime(Math.min(0.45, base + amount), t + 0.08);
    g.linearRampToValueAtTime(base, t + 1.2 + amount * 2);
  }

  onEvents(s: GameState, ev: readonly SimEvent[], vol = 1): void {
    if (!this.ctx || this.muted) return;
    this.sfxVol = vol;
    this.hype = Math.max(s.fighters[0].meter, s.fighters[1].meter) / 300;
    for (const e of ev) {
      switch (e.t) {
        case 'active':
          if (e.move === 'bon_croc') this.snap();
          else this.whoosh(e.strength);
          break;
        case 'moveStart':
          if (e.move === 'jaz_wave') this.sing([0, 4, 7], 0.07, 392);
          else if (e.move === 'jaz_spot') this.chime();
          else if (e.move === 'bon_smoke') this.smoke();
          else if (e.move === 'jaz_heart') this.sing([7], 0.2, 392);
          break;
        case 'hit':
          this.hit(e.strength, e.counter);
          if (e.beat) {
            // Beat-Drop: a bright scratch-stab on top of the impact
            const t = this.now();
            this.tone(t, 'sawtooth', 880, 1760, 0.1 * vol, 0.09, 0.3);
            this.tone(t + 0.04, 'triangle', 1318, 1318, 0.12 * vol, 0.14, 0.4);
          }
          break;
        case 'wallSplat':
          this.slam();
          this.boom();
          this.crowdSwell(e.ko ? 0.8 : 0.5);
          break;
        case 'duelStart':
          this.block(3);
          this.riser();
          this.crowdSwell(0.5);
          break;
        case 'duelTap': {
          // rising pitch the more you mash
          const t = this.now();
          const f = 330 * Math.pow(2, Math.min(24, e.taps) / 24);
          this.tone(t, 'square', f * (e.p ? 0.75 : 1), f * (e.p ? 0.75 : 1) * 1.02, 0.06 * vol, 0.05);
          break;
        }
        case 'duelEnd':
          if (e.winner >= 0) {
            this.boom();
            this.hit(3, true);
          } else this.block(3);
          this.crowdSwell(0.6);
          break;
        case 'finishHim':
          this.riser();
          this.crowdSwell(0.7);
          break;
        case 'fatality':
          this.signatureMusic(s.fighters[e.owner].def);
          break;
        case 'block':
          this.block(e.strength);
          break;
        case 'armor':
          this.tone(this.now(), 'square', 300, 200, 0.12, 0.12);
          this.hit(1, false);
          break;
        case 'throwStart':
          this.whoosh(1);
          break;
        case 'throwHit':
        case 'knockdown':
          if (e.t === 'throwHit') this.slam();
          else this.tone(this.now(), 'sine', 90, 40, 0.4 * vol, 0.2);
          break;
        case 'tech':
          this.block(2);
          break;
        case 'perfectBlock': {
          // bright "ting" + low thump: unmistakable, rewarding
          const t = this.now();
          this.tone(t, 'triangle', 1568, 1568, 0.22 * vol, 0.32, 0.4);
          this.tone(t + 0.05, 'triangle', 2093, 2093, 0.26 * vol, 0.3, 0.4);
          this.tone(t, 'sine', 110, 55, 0.5 * vol, 0.25);
          break;
        }
        case 'counter':
          this.tone(this.now(), 'square', 1760, 1500, 0.12, 0.3, 0.6);
          this.whoosh(2);
          break;
        case 'jump':
          this.whoosh(0);
          break;
        case 'card': {
          const card = getCard(s.fighters[e.p].def, e.card);
          if (card.category !== 'signature') this.stab();
          break;
        }
        case 'cardDenied':
          this.deny();
          break;
        case 'superFlash':
          this.riser();
          break;
        case 'cineStart':
          this.signatureMusic(s.fighters[e.owner].def);
          break;
        case 'cineHit':
          if (e.strength >= 3) this.boom();
          else this.hit(e.strength, false);
          break;
        case 'projectile':
          this.whoosh(1);
          break;
        case 'clash':
          this.block(3);
          break;
        case 'ko':
          this.boom();
          break;
        case 'meterGain':
          this.crowdSwell(0.35);
          this.stab();
          break;
        case 'fight':
          this.stab();
          this.crowdSwell(0.25);
          break;
        default:
          break;
      }
    }
  }
}
