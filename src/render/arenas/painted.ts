// Arenas from the PO's paintings (D40): FESTIVAL (open air at the excavators, sunset) and BAHNHOFSVIERTEL (Frankfurt
// at night, wet street). The painting (tools/arena/plates.py: real names replaced, cut at the ground line) stands on a
// big plane far behind the fight (real perspective scales it; mirrored edges for extreme zoom-outs) and fades into a
// 3D floor that takes the fighters' shadows (wet asphalt reflects on medium/high). In front of it: a 3D crowd
// (festival hipsters + moshpit, rocker gang with bikes) and animated light: stage beams, CO2 jets and sparks at the
// festival; flickering neon, drizzle and street steam in the Bahnhofsviertel.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Crowd, type CrowdSpot } from '../crowd';
import { isV3 } from '../../ui/design';
import type { ArenaLike } from './hinterhof';

export type PaintedId = 'festival' | 'bahnhof';

interface Meta {
  width_px: number;
  height_px: number;
  ground_px: number;
  /** Design v3 renders (tools/ui3/arenas.py): real scenery this fraction of the width beyond each side. */
  margin?: number;
  signs: { uv: [number, number, number, number]; color: string }[];
}

/** Painting width in metres and its depth; floor + light settings per arena. */
const CFG = {
  festival: { width: 27, depth: -14, sky: 0xc7b3d6, fog: 0xe8b98f, floorRepeat: [5, 4] as [number, number], rough: 0.95, reflect: 0 },
  bahnhof: { width: 25, depth: -12, sky: 0x0b1024, fog: 0x101428, floorRepeat: [4, 4] as [number, number], rough: 0.55, reflect: 0.3 },
};

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function softTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 6; i++) {
    const x = 20 + ((i * 37) % 24);
    const y = 20 + ((i * 53) % 24);
    const grd = g.createRadialGradient(x, y, 0, x, y, 22);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

export class PaintedArena implements ArenaLike {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  readonly look: Record<string, unknown>;
  private cfg: (typeof CFG)[PaintedId];
  private backMat: THREE.MeshBasicMaterial | null = null;
  private floorMat: THREE.MeshStandardMaterial | null = null;
  private lights: THREE.Light[] = [];
  private crowds: Crowd[] = [];
  private dim = 0;
  private flash = 0;
  private hype = 0;
  private lastT = 0;
  private updaters: ((t: number, beat: number, dt: number) => void)[] = [];
  private reflector: Reflector | null = null;

  constructor(
    private scene: THREE.Scene,
    readonly id: PaintedId,
    private quality: 'low' | 'medium' | 'high' = 'high',
  ) {
    this.cfg = CFG[id];
    scene.background = new THREE.Color(this.cfg.sky);
    scene.fog = new THREE.Fog(this.cfg.fog, 16, 60);
    scene.add(this.group);
    this.look =
      id === 'festival'
        ? { toneMapping: THREE.ACESFilmicToneMapping, bloomThreshold: 1.1, bloomStrength: 0.32, bloomRadius: 0.35, exposure: 1.0, saturation: 1.12, contrast: 1.06 }
        : { toneMapping: THREE.AgXToneMapping, bloomThreshold: 1.25, bloomStrength: 0.45, bloomRadius: 0.3, exposure: 0.9, saturation: 1.25, contrast: 1.12 };
    this.buildLights();
    this.buildCrowd();
    if (id === 'festival') this.buildFestivalFx();
    else this.buildBahnhofFx();
    this.ready = this.load().catch((e) => console.warn(`[arena] ${id} failed to load`, e));
  }

  private async load(): Promise<void> {
    // design v3 (D46): the same places rebuilt as stylized 3D scenes in Blender; v1/v2 keep the PO's paintings
    const base = `assets/arena/${this.id}${isV3() ? '3' : ''}/`;
    const tl = new THREE.TextureLoader();
    const low = this.quality === 'low';
    const [meta, back, floor] = await Promise.all([
      fetch(`${base}meta.json`).then((r) => r.json() as Promise<Meta>),
      tl.loadAsync(base + (low ? 'backdrop_low.jpg' : 'backdrop.jpg')),
      tl.loadAsync(base + 'floor.jpg'),
    ]);
    back.colorSpace = THREE.SRGBColorSpace;
    floor.colorSpace = THREE.SRGBColorSpace;
    const W = this.cfg.width;
    const real = meta.margin ?? 0;
    const H = (W * (1 + 2 * real) * meta.height_px) / meta.width_px;
    const below = ((meta.height_px - meta.ground_px) / meta.height_px) * H;
    // margins: 20 % each side (zoomed-out shots on wide phones) - rendered scenery when the plate has them, else
    // the painting mirrored at its edges
    const margin = 0.2;
    if (real > 0) {
      back.wrapS = THREE.ClampToEdgeWrapping;
    } else {
      back.wrapS = THREE.MirroredRepeatWrapping;
      back.repeat.set(1 + 2 * margin, 1);
      back.offset.set(-margin, 0);
    }
    back.anisotropy = 4;
    // alpha: fade the last rows (below the ground line) into the 3D floor
    const ac = document.createElement('canvas');
    ac.width = 2;
    ac.height = 256;
    const ag = ac.getContext('2d')!;
    const fadeStart = 1 - (below / H) * 1.6;
    const grd = ag.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(Math.max(0, fadeStart), '#fff');
    grd.addColorStop(1, '#000');
    ag.fillStyle = grd;
    ag.fillRect(0, 0, 2, 256);
    const alpha = new THREE.CanvasTexture(ac);
    this.backMat = new THREE.MeshBasicMaterial({ map: back, alphaMap: alpha, transparent: true, depthWrite: false, fog: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W * (1 + 2 * margin), H), this.backMat);
    plane.position.set(0, H / 2 - below, this.cfg.depth);
    plane.renderOrder = -2;
    this.group.add(plane);
    // floor: from in front of the camera to the painting
    floor.wrapS = floor.wrapT = THREE.MirroredRepeatWrapping;
    floor.repeat.set(...this.cfg.floorRepeat);
    floor.anisotropy = 8;
    const near = 14;
    const len = near - this.cfg.depth;
    this.floorMat = new THREE.MeshStandardMaterial({ map: floor, roughness: this.cfg.rough, metalness: this.id === 'bahnhof' ? 0.15 : 0 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(90, len), this.floorMat);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(0, 0, near - len / 2);
    fl.receiveShadow = true;
    this.group.add(fl);
    if (this.cfg.reflect > 0 && this.quality !== 'low') this.addReflector(len, near);
    // neon flicker glows on the (repainted) signs
    if (meta.signs.length) {
      const tex = glowTexture();
      const WF = W * (1 + 2 * real); // image width in metres (the v3 renders include their side margins)
      for (const s of meta.signs) {
        const [u0, v0, u1, v1] = s.uv;
        const cx = ((u0 + u1) / 2 - 0.5) * WF;
        const cy = (1 - (v0 + v1) / 2) * H - below;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(s.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.4 }));
        sp.scale.set((u1 - u0) * WF * 1.6, (v1 - v0) * H * 2.6, 1);
        sp.position.set(cx, cy, this.cfg.depth + 0.05);
        this.group.add(sp);
        const seed = cx * 3.1;
        this.updaters.push((t) => {
          // neon hum with a rare stutter
          const stutter = Math.sin(t * 0.7 + seed) > 0.985 ? 0.25 : 1;
          (sp.material as THREE.SpriteMaterial).opacity = (0.32 + 0.06 * Math.sin(t * 9 + seed) + 0.25 * this.flash) * stutter * (1 - this.dim * 0.6);
        });
      }
    }
  }

  /** Wet-street reflection (medium/high): the painting, signs and fighters mirrored, blurred and faded by fresnel. */
  private addReflector(len: number, near: number): void {
    const shader = {
      name: 'WetStreet',
      uniforms: { color: { value: new THREE.Color(1, 1, 1) }, tDiffuse: { value: null as THREE.Texture | null }, textureMatrix: { value: new THREE.Matrix4() }, uStrength: { value: this.cfg.reflect } },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStrength; varying vec4 vUv; varying vec3 vWorld;
        void main(){
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.25 + 0.75 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
          vec2 ripple = vec2(sin(vWorld.x * 5.0 + vWorld.z * 2.0) * 0.003, sin(vWorld.z * 7.0) * 0.002);
          vec3 base = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 2.39996;
            vec2 o = ripple + vec2(cos(a), sin(a) * 2.2) * 0.006 * sqrt((float(i) + 0.5) / 8.0);
            base += texture2DProj(tDiffuse, vUv + vec4(o * vUv.w, 0.0, 0.0)).rgb;
          }
          gl_FragColor = vec4(base / 8.0 * color * uStrength * fres, 1.0);
        }`,
    };
    const refl = new Reflector(new THREE.PlaneGeometry(60, len), { shader, textureWidth: this.quality === 'high' ? 1024 : 512, textureHeight: this.quality === 'high' ? 512 : 256, clipBias: 0.003, multisample: 0 });
    const m = refl.material as THREE.ShaderMaterial;
    m.transparent = true;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(0, 0.004, near - len / 2);
    refl.renderOrder = 1;
    this.reflector = refl;
    this.group.add(refl);
  }

  private buildLights(): void {
    const low = this.quality === 'low';
    const add = (l: THREE.Light) => {
      l.userData.base = l.intensity;
      this.lights.push(l);
      this.scene.add(l);
      return l;
    };
    const key = (color: number, intensity: number, pos: [number, number, number]) => {
      const k = new THREE.DirectionalLight(color, intensity);
      k.position.set(...pos);
      k.castShadow = !low;
      k.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
      const sc = k.shadow.camera;
      sc.left = -10;
      sc.right = 10;
      sc.top = 7;
      sc.bottom = -3;
      sc.near = 1;
      sc.far = 40;
      k.shadow.bias = -0.0004;
      k.shadow.normalBias = 0.03;
      this.scene.add(k.target);
      return add(k);
    };
    if (this.id === 'festival') {
      // sunset: low warm sun from the right behind the stage, blue-violet sky fill, pink/cyan stage rims
      add(new THREE.HemisphereLight(0xffd9b3, 0x9a6a48, low ? 1.4 : 0.85));
      key(0xffb36b, low ? 1.6 : 1.9, [7, 6, -6]);
      const rimA = new THREE.DirectionalLight(0xff4fb8, 0.9);
      rimA.position.set(-6, 4, -8);
      const rimB = new THREE.DirectionalLight(0x4fd8ff, 0.8);
      rimB.position.set(4, 5, -9);
      const front = new THREE.DirectionalLight(0xffe6cc, 0.55);
      front.position.set(-2, 3, 10);
      for (const l of [rimA, rimB, front]) add(l);
    } else {
      // night: cold sky, warm street lamp from the left, the signs' red and cyan spill
      add(new THREE.HemisphereLight(0x5a6aa8, 0x1a1420, low ? 1.2 : 0.55));
      key(0xffc890, low ? 1.2 : 1.35, [-6, 7, 5]);
      const red = new THREE.PointLight(0xff2a4a, low ? 0 : 3.2, 13, 1.5);
      red.position.set(-4.6, 3.2, -6.5);
      const cyan = new THREE.PointLight(0x30d0ff, low ? 0 : 3.5, 12, 1.4);
      cyan.position.set(0.8, 3.0, -6.5);
      const pink = new THREE.DirectionalLight(0xff5ab0, 0.7);
      pink.position.set(8, 3, -6);
      const front = new THREE.DirectionalLight(0xc8d0ff, 0.35);
      front.position.set(1, 2, 10);
      for (const l of [red, cyan, pink, front]) add(l);
    }
  }

  private buildCrowd(): void {
    const r = rng(this.id === 'festival' ? 11 : 23);
    const spots: CrowdSpot[] = [];
    if (this.id === 'festival') {
      // a loose band of fans in front of the stage, a moshpit left and right, gaps behind the fighters' centre
      for (let i = 0; i < 46; i++) {
        const row = i % 3;
        const z = -3.6 - row * 1.4 - r() * 0.7;
        let x = -13 + (i / 46) * 26 + (r() - 0.5) * 0.9;
        if (Math.abs(x) < 1.2) x += x < 0 ? -1.4 : 1.4;
        spots.push({ x, z });
      }
      // two circle pits (opposite directions), people running round the pit centre
      for (const [cx, dir] of [
        [-6.2, 1],
        [6.4, -1],
      ])
        for (let i = 0; i < 7; i++)
          spots.push({ x: cx, z: -5.6, pit: { cx, cz: -5.6, r: 1.05 + (r() - 0.5) * 0.3, a0: (i / 7) * Math.PI * 2 + (r() - 0.5) * 0.3, speed: dir * 0.95 } });
    } else {
      // rocker gangs in groups on the pavement in front of the bars, a few at the kerb with their bikes
      const groups: [number, number, number][] = [
        [-9.5, -6.6, 4],
        [-3.8, -6.9, 3],
        [3.4, -6.7, 4],
        [9.2, -6.4, 4],
        [-12.5, -5.6, 2],
        [12.6, -5.8, 2],
      ];
      for (const [gx, gz, n] of groups)
        for (let i = 0; i < n; i++) spots.push({ x: gx + (i - (n - 1) / 2) * 0.75 + (r() - 0.5) * 0.25, z: gz + (r() - 0.5) * 0.6 });
    }
    const crowd = new Crowd(this.id === 'festival' ? 'hipster' : 'rocker', spots, this.id === 'festival' ? 5 : 9, this.quality);
    this.crowds.push(crowd);
    this.group.add(crowd.group);
    if (this.id === 'bahnhof') this.buildBikes();
  }

  /** Chunky parked choppers (stylized, no brand). */
  private buildBikes(): void {
    const toon = (c: number, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: metal ? 0.25 : 0.6, metalness: metal });
    const black = toon(0x16161a);
    const chrome = toon(0xd8dde8, 0.9);
    const paint = [toon(0x7a1414, 0.3), toon(0x1a1a24, 0.3), toon(0x3a2a14, 0.3)];
    const spots: [number, number, number][] = [
      [-7.2, -6.1, 0.5],
      [6.4, -5.9, -0.6],
      [-11.2, -5.4, 0.9],
    ];
    spots.forEach(([x, z, yaw], i) => {
      const b = new THREE.Group();
      for (const wx of [-0.75, 0.8]) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 8, 20), black);
        w.position.set(wx, 0.4, 0);
        b.add(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), chrome);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(wx, 0.4, 0);
        b.add(hub);
      }
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 10), paint[i % 3]);
      tank.rotation.z = Math.PI / 2 + 0.15;
      tank.position.set(0.15, 0.82, 0);
      b.add(tank);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.26), black);
      seat.position.set(-0.35, 0.78, 0);
      b.add(seat);
      const engine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.3), chrome);
      engine.position.set(0.05, 0.52, 0);
      b.add(engine);
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), chrome);
      fork.rotation.z = 0.55;
      fork.position.set(0.62, 0.78, 0);
      b.add(fork);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8), chrome);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0.42, 1.18, 0);
      b.add(bar);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
      lamp.position.set(0.66, 1.0, 0);
      b.add(lamp);
      b.position.set(x, 0, z);
      b.rotation.y = yaw;
      b.rotation.x = 0.0;
      b.rotation.z = 0.08; // on the kickstand
      b.traverse((o) => ((o as THREE.Mesh).castShadow = this.quality !== 'low'));
      this.group.add(b);
    });
  }

  private buildFestivalFx(): void {
    const W = this.cfg.width;
    const Z = this.cfg.depth + 0.4;
    // sweeping light beams from the stage roof (additive cones)
    const beamMat = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const cols = [0x7fd8ff, 0xb48cff, 0x7fd8ff, 0xff8fd8, 0x7fd8ff, 0xb48cff];
    const beams = cols.map((c, i) => {
      const geo = new THREE.ConeGeometry(0.7, 12, 18, 1, true).translate(0, -6, 0); // apex at the origin, pointing down
      const m = new THREE.Mesh(geo, beamMat(c));
      m.position.set((-0.24 + (i / (cols.length - 1)) * 0.48) * W * 0.62, 6.6, Z);
      this.group.add(m);
      return m;
    });
    this.updaters.push((t, beat) => {
      const pulse = Math.pow(1 - (beat % 1), 3);
      beams.forEach((b, i) => {
        // pointing up into the sky and sweeping
        b.rotation.set(Math.PI + Math.sin(t * 0.5 + i) * 0.15, 0, Math.sin(t * 0.6 + i * 1.3) * 0.5);
        (b.material as THREE.MeshBasicMaterial).opacity = (0.08 + 0.08 * pulse + 0.12 * this.flash) * (1 - this.dim * 0.5);
      });
    });
    // CO2 jets at the stage front on the beat + sparks
    const soft = softTexture();
    const jets = [-0.15, -0.08, 0.08, 0.15].map((u) => {
      const sp: THREE.Sprite[] = [];
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0, fog: false }));
        s.position.set(u * W, 1.2, Z + 0.2);
        this.group.add(s);
        sp.push(s);
      }
      return { x: u * W, sp, t: 10 };
    });
    let lastBeat = 0;
    let bar = 0;
    this.updaters.push((_t, beat, dt) => {
      if (Math.floor(beat) !== lastBeat) {
        lastBeat = Math.floor(beat);
        bar++;
        // every other bar (or on big hits) the jets fire
        if (bar % 8 === 0 || this.flash > 0.6) for (const j of jets) j.t = 0;
      }
      for (const j of jets) {
        j.t += dt;
        j.sp.forEach((s, i) => {
          const k = Math.max(0, j.t - i * 0.06);
          const life = 1.1;
          const a = k < life ? Math.sin((k / life) * Math.PI) : 0;
          s.position.y = 1.0 + k * 5;
          s.scale.setScalar(0.8 + k * 3);
          (s.material as THREE.SpriteMaterial).opacity = a * 0.55;
        });
      }
    });
    // warm dust motes drifting in the low sun
    const n = this.quality === 'low' ? 0 : 60;
    if (n) {
      const pos = new Float32Array(n * 3);
      const r = rng(3);
      for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 24, r() * 4, -1 - r() * 7], i * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.05, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.group.add(pts);
      this.updaters.push((t) => {
        for (let i = 0; i < n; i++) {
          pos[i * 3 + 1] = (pos[i * 3 + 1] + 0.003) % 4;
          pos[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
        }
        geo.attributes.position.needsUpdate = true;
      });
    }
  }

  private buildBahnhofFx(): void {
    // drizzle: short streaks falling in front of the street
    const n = this.quality === 'low' ? 120 : 360;
    const pos = new Float32Array(n * 6);
    const r = rng(5);
    const drops: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) drops.push([(r() - 0.5) * 30, r() * 9, 2 - r() * 10, 6 + r() * 3]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb8e8, transparent: true, opacity: 0.32, depthWrite: false }));
    lines.frustumCulled = false;
    this.group.add(lines);
    this.updaters.push((_t, _b, dt) => {
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d[1] -= d[3] * dt;
        if (d[1] < 0) d[1] += 9;
        pos.set([d[0], d[1], d[2], d[0] + 0.02, d[1] + 0.22, d[2]], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
    });
    // steam from a manhole on the right
    const soft = softTexture();
    const puffs: { s: THREE.Sprite; t: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xc8d0e8, transparent: true, depthWrite: false, opacity: 0 }));
      this.group.add(s);
      puffs.push({ s, t: i / 6 });
    }
    this.updaters.push((_t, _b, dt) => {
      for (const p of puffs) {
        p.t = (p.t + dt * 0.25) % 1;
        p.s.position.set(7.8 + Math.sin(p.t * 6) * 0.2, 0.1 + p.t * 2.6, -3.2);
        p.s.scale.setScalar(0.6 + p.t * 2.2);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(p.t * Math.PI) * 0.22;
      }
    });
  }

  update(time: number, beat: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.lastT));
    this.lastT = time;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (const u of this.updaters) u(time, beat, dt);
    for (const c of this.crowds) c.update(time, beat, this.hype, dt);
  }

  setDim(d: number): void {
    this.dim = d;
    const k = 1 - d * 0.65;
    this.backMat?.color.setScalar(k);
    this.floorMat?.color.setScalar(1 - d * 0.5);
    for (const l of this.lights) l.intensity = (l.userData.base as number) * (1 - d * 0.45);
    for (const c of this.crowds) c.setDim(d);
    if (this.reflector) ((this.reflector.material as THREE.ShaderMaterial).uniforms.uStrength.value = this.cfg.reflect * (1 - d * 0.5));
  }

  pulse(amount = 1): void {
    this.flash = Math.min(1, this.flash + amount);
    for (const c of this.crowds) c.excite(amount * 0.8);
  }

  setHype(h: number): void {
    this.hype = h;
  }
}
