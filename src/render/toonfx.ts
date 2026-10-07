// Cartoon VFX layer (Clash-Royale look, fighting-game timing). Presentation only, all procedural:
//  - impact stars: jagged starbursts with an ink outline that pop (overshoot) and collapse from the centre
//  - speed lines: screen-space anime lines radiating from the impact (heavy hits, counters, KO, supers)
//  - impact frame: a 2-frame colour inversion on the biggest moments (can be switched off: setting "Blitzeffekte")
//  - smears: a tapered ribbon behind the striking fist/foot from wind-up through the active frames
//  - toon puffs: cel-shaded dust clouds with an outline that shrink away instead of fading
//  - ground cracks: decals under slams and hard knockdowns
//  - debris: small toon chunks with gravity and bounce
//  - blood (PO: allowed, rating must stay at USK 16): a few dark droplets that fall and leave small floor splats
//    which fade within ~2 s; no gore, no dismemberment (setting "Blut" can switch it off)
import * as THREE from 'three';

const HASH = /* glsl */ `float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }`;

// ------------------------------------------------------------------ impact star
const STAR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const STAR_FRAG = /* glsl */ `
  uniform vec3 uFill; uniform vec3 uCore; uniform vec3 uInk;
  uniform float uSeed; uniform float uSpikes; uniform float uHole; uniform float uAlpha; uniform float uJag;
  varying vec2 vUv;
  ${HASH}
  void main() {
    float r = length(vUv);
    float a = atan(vUv.y, vUv.x) / 6.2831853 + 0.5;
    float s = a * uSpikes;
    float i = floor(s);
    float f = fract(s);
    float tri = 1.0 - abs(f * 2.0 - 1.0);
    float tip = mix(1.0 - uJag, 1.0, hash(i + uSeed));
    float R = mix(0.36, 0.86 * tip, pow(tri, 1.6));
    float aa = fwidth(r) * 1.5;
    // S12 (PO: "Treffer-VFX transparenter oder cooler"): a thin ink rim, a see-through body that gets clearer toward
    // the spike tips, a hot opaque core and a soft glow around the star
    float ink = 1.0 - smoothstep(R + 0.04 - aa, R + 0.04, r);
    float fill = 1.0 - smoothstep(R - aa, R, r);
    float core = 1.0 - smoothstep(R * 0.42 - 0.08, R * 0.42, r);
    float hole = smoothstep(uHole * R - aa, uHole * R, r);
    float body = fill * mix(0.38, 0.92, core) * (1.0 - 0.35 * smoothstep(0.3, 0.9, r));
    float rim = ink * (1.0 - fill) * 0.8;
    float glow = (1.0 - smoothstep(R, R + 0.22, r)) * (1.0 - ink) * (1.0 - smoothstep(0.82, 1.0, r)) * 0.3;
    vec3 col = mix(mix(uFill, uCore, core), uInk, rim / max(0.001, rim + body));
    col = mix(col, mix(uFill, vec3(1.0), 0.5), glow / max(0.001, glow + body + rim));
    float alpha = max(body + rim, glow) * hole * uAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ screen-space passes (speed lines, impact frame)
const SCREEN_VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const LINES_FRAG = /* glsl */ `
  uniform vec2 uCenter; uniform float uAspect; uniform float uInner; uniform float uSeed; uniform vec3 uColor; uniform float uAlpha;
  varying vec2 vNdc;
  ${HASH}
  void main() {
    vec2 d = vNdc - uCenter;
    d.x *= uAspect;
    float r = length(d);
    float s = (atan(d.y, d.x) / 6.2831853 + 0.5) * 120.0;
    float i = floor(s);
    float h = hash(i + uSeed);
    if (h > 0.32) discard;
    float start = uInner * mix(0.8, 1.45, hash(i * 2.11 + uSeed));
    float taper = smoothstep(start, start + 0.45, r);
    float w = (0.06 + 0.2 * hash(i * 1.37 + uSeed)) * taper;
    float line = 1.0 - smoothstep(w * 0.55, w, abs(fract(s) - 0.5));
    float m = line * step(start, r);
    if (m * uAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor, m * uAlpha);
    #include <colorspace_fragment>
  }
`;
const INVERT_FRAG = /* glsl */ `void main() { gl_FragColor = vec4(1.0); }`;

// ------------------------------------------------------------------ smear ribbon
const SMEAR_VERT = /* glsl */ `
  attribute vec2 aT;
  varying vec2 vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SMEAR_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying vec2 vT;
  void main() {
    float edge = abs(vT.y);
    float body = 1.0 - smoothstep(0.7, 1.0, edge);
    float a = body * smoothstep(0.0, 0.6, vT.x) * uAlpha;
    if (a < 0.01) discard;
    vec3 col = mix(uColor, vec3(1.0), smoothstep(0.55, 0.0, edge) * vT.x);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ toon puffs (instanced billboards)
const PUFF_VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec2 iSize;
  attribute vec3 iColor;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    mv.xy += position.xy * iSize.x;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy * 2.0;
    vColor = iColor;
    vSeed = iSize.y;
  }
`;
const PUFF_FRAG = /* glsl */ `
  uniform vec3 uInk;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    if (vSeed <= 0.0) discard;
    float a = atan(vUv.y, vUv.x);
    float R = 0.82 + 0.06 * sin(a * 5.0 + vSeed * 6.0) + 0.04 * sin(a * 9.0 - vSeed * 3.0);
    float r = length(vUv);
    float aa = fwidth(r) * 1.5;
    float ink = 1.0 - smoothstep(R - aa, R, r);
    if (ink < 0.01) discard;
    float fill = 1.0 - smoothstep(R - 0.1 - aa, R - 0.1, r);
    float shade = smoothstep(0.55 - aa, 0.55, length(vUv - vec2(-0.22, 0.26)));
    float hi = 1.0 - smoothstep(0.2 - aa, 0.2, length(vUv - vec2(-0.3, 0.32)));
    vec3 col = mix(vColor, vColor * 0.68, shade);
    col = mix(col, min(vec3(1.0), vColor * 1.35), hi * 0.6);
    gl_FragColor = vec4(mix(uInk, col, fill), ink);
    #include <colorspace_fragment>
  }
`;

const PUFFS = 120;
const DEBRIS = 48;
const DROPS = 96;
const SPLATS = 40;

interface Star {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  t: number;
  life: number;
  size: number;
  spin: number;
}
interface Puff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  life: number;
  size: number;
}
interface Crack {
  mesh: THREE.Mesh;
  t: number;
  life: number;
}
interface Smear {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  pts: THREE.Vector3[];
  width: number;
  /** recording: append the limb position each frame */
  live: number;
  fade: number;
  limb: number;
  fighter: number;
}

/** Limbs that can carry a smear: [end joint, parent joint, tip offset (m)]. */
export const SMEAR_LIMBS: [string, string, number][] = [
  ['haR', 'elR', 0.08],
  ['haL', 'elL', 0.08],
  ['ftR', 'knR', 0.06],
  ['ftL', 'knL', 0.06],
];
const HISTORY = 10;
const SMEAR_PTS = 18;

export interface LimbSource {
  joints: Record<string, THREE.Object3D>;
}

export class ToonFX {
  readonly group = new THREE.Group();
  /** Impact frames on counters / KO / Signature (setting "Blitzeffekte"). */
  impactFrames = true;
  /** When the post pipeline draws the impact frame (medium/high), the inversion quad stays off. */
  postImpact = false;
  /** 1 while an impact frame is showing (read by the post pass). */
  impactNow = 0;
  private camera: THREE.Camera | null = null;
  private stars: Star[] = [];
  private lines: THREE.Mesh;
  private linesMat: THREE.ShaderMaterial;
  private linesT = 0;
  private linesLife = 0;
  private invert: THREE.Mesh;
  private invertT = 0;
  private puffs: Puff[] = [];
  private puffNext = 0;
  private puffMesh: THREE.Mesh;
  private pPos = new Float32Array(PUFFS * 3);
  private pSize = new Float32Array(PUFFS * 2);
  private pCol = new Float32Array(PUFFS * 3);
  private aPos: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private cracks: Crack[] = [];
  private debris: THREE.InstancedMesh;
  private dState = new Float32Array(DEBRIS * 8); // x y z vx vy vz life spin
  private dNext = 0;
  /** Blood droplets / floor splats (switchable, USK 16). */
  bloodOn = true;
  private drops: THREE.InstancedMesh;
  private bState = new Float32Array(DROPS * 7); // x y z vx vy vz life
  private bNext = 0;
  private splats: THREE.InstancedMesh;
  private sState = new Float32Array(SPLATS * 5); // x z size life max
  private sNext = 0;
  private smears: Smear[] = [];
  /** Per fighter, per limb: ring buffer of recent tip positions. */
  private history: THREE.Vector3[][][] = [0, 1].map(() => SMEAR_LIMBS.map(() => [] as THREE.Vector3[]));
  private _v = new THREE.Vector3();
  private _w = new THREE.Vector3();

  constructor() {
    const quad = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uFill: { value: new THREE.Color() },
          uCore: { value: new THREE.Color(1, 1, 1) },
          uInk: { value: new THREE.Color(0x1a1030) },
          uSeed: { value: 0 },
          uSpikes: { value: 9 },
          uHole: { value: 0 },
          uAlpha: { value: 1 },
          uJag: { value: 0.45 },
        },
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(quad, mat);
      mesh.visible = false;
      mesh.renderOrder = 12;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.stars.push({ mesh, mat, t: 0, life: 0, size: 1, spin: 0 });
    }

    this.linesMat = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector2() },
        uAspect: { value: 1.6 },
        uInner: { value: 0.5 },
        uSeed: { value: 0 },
        uColor: { value: new THREE.Color(1, 1, 1) },
        uAlpha: { value: 0 },
      },
      vertexShader: SCREEN_VERT,
      fragmentShader: LINES_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.lines = new THREE.Mesh(quad, this.linesMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 998;
    this.lines.visible = false;
    this.group.add(this.lines);

    this.invert = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        vertexShader: SCREEN_VERT,
        fragmentShader: INVERT_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneMinusDstColorFactor,
        blendDst: THREE.ZeroFactor,
      }),
    );
    this.invert.frustumCulled = false;
    this.invert.renderOrder = 999;
    this.invert.visible = false;
    this.group.add(this.invert);

    // puffs
    const geo = new THREE.InstancedBufferGeometry();
    const pq = new THREE.PlaneGeometry(1, 1);
    geo.index = pq.index;
    geo.setAttribute('position', pq.attributes.position);
    this.aPos = new THREE.InstancedBufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.pSize, 2).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iSize', this.aSize);
    geo.setAttribute('iColor', this.aCol);
    geo.instanceCount = PUFFS;
    this.puffMesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uInk: { value: new THREE.Color(0x5a463c) } },
        vertexShader: PUFF_VERT,
        fragmentShader: PUFF_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.puffMesh.frustumCulled = false;
    this.puffMesh.renderOrder = 8;
    this.group.add(this.puffMesh);
    for (let i = 0; i < PUFFS; i++) this.puffs.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 0, size: 0 });

    // ground cracks
    const crackTex = crackTexture();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      m.visible = false;
      this.group.add(m);
      this.cracks.push({ mesh: m, t: 0, life: 0 });
    }

    // debris
    this.debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.045, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), DEBRIS);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.frustumCulled = false;
    this.debris.castShadow = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < DEBRIS; i++) {
      this.debris.setMatrixAt(i, zero);
      this.debris.setColorAt(i, new THREE.Color(0x6f655d));
    }
    this.group.add(this.debris);

    // blood: glossy dark-red droplets + flat splats on the floor
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x7a0a12, roughness: 0.22, metalness: 0.05 });
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 7, 5), bloodMat, DROPS);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops.frustumCulled = false;
    const splatGeo = new THREE.CircleGeometry(1, 14);
    splatGeo.rotateX(-Math.PI / 2);
    const splatMat = new THREE.MeshStandardMaterial({ color: 0x5e070e, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.splats = new THREE.InstancedMesh(splatGeo, splatMat, SPLATS);
    this.splats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splats.frustumCulled = false;
    this.splats.renderOrder = 1;
    for (let i = 0; i < DROPS; i++) this.drops.setMatrixAt(i, zero);
    for (let i = 0; i < SPLATS; i++) this.splats.setMatrixAt(i, zero);
    this.group.add(this.drops, this.splats);

    // smears (one per fighter is enough; a second slot lets a new strike start while the old one fades)
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMEAR_PTS * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const t = new Float32Array(SMEAR_PTS * 2 * 2);
      g.setAttribute('aT', new THREE.BufferAttribute(t, 2).setUsage(THREE.DynamicDrawUsage));
      const idx: number[] = [];
      for (let k = 0; k < SMEAR_PTS - 1; k++) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
        vertexShader: SMEAR_VERT,
        fragmentShader: SMEAR_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 7;
      mesh.visible = false;
      this.group.add(mesh);
      this.smears.push({ mesh, mat, pts: [], width: 0.1, live: 0, fade: 0, limb: 0, fighter: -1 });
    }
  }

  setCamera(c: THREE.Camera): void {
    this.camera = c;
  }

  // ---------------------------------------------------------------- spawners
  /** Comic impact star. size in metres (diameter of the spikes). */
  impact(x: number, y: number, size: number, fill: THREE.Color, opts: { spikes?: number; jag?: number; life?: number; core?: THREE.Color } = {}): void {
    const s = this.stars.find((q) => q.life <= 0) ?? this.stars.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
    s.t = 0;
    s.life = opts.life ?? 0.2;
    s.size = size * 0.5;
    s.spin = (Math.random() - 0.5) * 1.2;
    s.mat.uniforms.uFill.value.copy(fill);
    s.mat.uniforms.uCore.value.copy(opts.core ?? new THREE.Color(1, 1, 1));
    s.mat.uniforms.uSeed.value = Math.random() * 100;
    s.mat.uniforms.uSpikes.value = opts.spikes ?? 9;
    s.mat.uniforms.uJag.value = opts.jag ?? 0.45;
    s.mesh.position.set(x, y, 0.45);
    s.mesh.rotation.set(0, 0, Math.random() * Math.PI);
    s.mesh.visible = true;
  }

  /** Radial anime speed lines around a world point. */
  speedLines(x: number, y: number, color = new THREE.Color(1, 1, 1), life = 0.26, inner = 0.55): void {
    inner = 0.35 + inner;
    if (!this.camera) return;
    this._v.set(x, y, 0).project(this.camera);
    this.linesMat.uniforms.uCenter.value.set(this._v.x, this._v.y);
    this.linesMat.uniforms.uColor.value.copy(color);
    this.linesMat.uniforms.uSeed.value = Math.random() * 100;
    this.linesMat.uniforms.uInner.value = inner;
    this.linesT = 0;
    this.linesLife = life;
    this.lines.visible = true;
  }

  /** Colour-inverted impact frame (seconds). Skipped when the setting is off. */
  impactFrame(seconds = 0.05): void {
    if (!this.impactFrames) return;
    this.invertT = Math.max(this.invertT, seconds);
  }

  puff(x: number, y: number, count: number, spread: number, color = new THREE.Color(0xe8dccb), size = 0.22, up = 0.6): void {
    for (let i = 0; i < count; i++) {
      const p = this.puffs[this.puffNext];
      this.puffNext = (this.puffNext + 1) % PUFFS;
      const d = (Math.random() * 2 - 1) * spread;
      p.x = x + d * 0.35;
      p.y = y + 0.08 + Math.random() * 0.08;
      p.z = 0.15 + (Math.random() - 0.5) * 0.5;
      p.vx = d * 1.8;
      p.vy = up * (0.4 + Math.random() * 0.8);
      p.vz = (Math.random() - 0.5) * 0.6;
      p.t = 0;
      p.life = 0.45 + Math.random() * 0.3;
      p.size = size * (0.7 + Math.random() * 0.6);
      const k = this.puffs.indexOf(p);
      this.pCol.set([color.r, color.g, color.b], k * 3);
      this.pSize[k * 2 + 1] = Math.random() * 10 + 0.1;
    }
  }

  crack(x: number, size = 1.6, life = 1.4): void {
    const c = this.cracks.find((q) => q.life <= 0) ?? this.cracks[0];
    c.t = 0;
    c.life = life;
    c.mesh.position.set(x, 0.012, 0);
    c.mesh.userData.size = size;
    c.mesh.userData.wall = false;
    c.mesh.rotation.set(-Math.PI / 2, 0, 0);
    c.mesh.scale.set(size * 0.55, size * 0.94, 1);
    c.mesh.rotation.z = (Math.random() - 0.5) * 0.6;
    c.mesh.visible = true;
  }

  /** Upright crack "in the air" behind a fighter slammed into the stage wall (Wand-Splat). */
  wallCrack(x: number, y: number, size = 2.2, life = 1.6): void {
    const c = this.cracks.find((q) => q.life <= 0) ?? this.cracks[0];
    c.t = 0;
    c.life = life;
    c.mesh.position.set(x, y, -0.45);
    c.mesh.userData.size = size;
    c.mesh.userData.wall = true;
    c.mesh.scale.set(size, size, 1);
    c.mesh.rotation.set(0, 0, (Math.random() - 0.5) * 0.8);
    c.mesh.visible = true;
  }

  rubble(x: number, y: number, count: number, speed = 3.5, color = new THREE.Color(0x6f655d)): void {
    for (let i = 0; i < count; i++) {
      const k = this.dNext;
      this.dNext = (this.dNext + 1) % DEBRIS;
      const a = Math.PI * (0.15 + Math.random() * 0.7);
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.dState.set([x + (Math.random() - 0.5) * 0.3, y + 0.05, (Math.random() - 0.5) * 0.4, Math.cos(a) * sp, Math.sin(a) * sp, (Math.random() - 0.5) * 2, 1.2 + Math.random() * 0.5, Math.random() * 20], k * 8);
      this.debris.setColorAt(k, color.clone().multiplyScalar(0.8 + Math.random() * 0.4));
    }
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;
  }

  /** A short spray of droplets from (x, y), biased along `dir` (-1/1, 0 = all around). */
  blood(x: number, y: number, count: number, dir: number, speed = 2.6): void {
    if (!this.bloodOn) return;
    for (let i = 0; i < count; i++) {
      const k = this.bNext;
      this.bNext = (this.bNext + 1) % DROPS;
      const a = Math.PI * (0.1 + Math.random() * 0.5);
      const sp = speed * (0.35 + Math.random() * 0.8);
      const sx = dir === 0 ? (Math.random() < 0.5 ? -1 : 1) : dir;
      this.bState.set(
        [x + (Math.random() - 0.5) * 0.08, y + (Math.random() - 0.5) * 0.08, 0.15 + (Math.random() - 0.5) * 0.3, sx * Math.cos(a) * sp, Math.sin(a) * sp, (Math.random() - 0.5) * 1.2, 1.4],
        k * 7,
      );
    }
  }

  private splat(x: number, z: number, size: number): void {
    const k = this.sNext;
    this.sNext = (this.sNext + 1) % SPLATS;
    this.sState.set([x, z, size, 2.2, 2.2], k * 5);
  }

  // ---------------------------------------------------------------- smears
  /** Record end-effector tips every rendered frame (call after the rigs are posed). */
  track(i: number, rig: LimbSource): void {
    const h = this.history[i];
    SMEAR_LIMBS.forEach(([end, parent, off], l) => {
      const je = rig.joints[end];
      const jp = rig.joints[parent];
      if (!je || !jp) return;
      je.getWorldPosition(this._v);
      jp.getWorldPosition(this._w);
      const tip = this._v.clone().add(this._w.subVectors(this._v, this._w).normalize().multiplyScalar(off));
      const buf = h[l];
      buf.push(tip);
      if (buf.length > HISTORY) buf.shift();
    });
    for (const s of this.smears) {
      if (s.fighter !== i || s.live <= 0) continue;
      const buf = h[s.limb];
      const tip = buf[buf.length - 1];
      if (tip && (!s.pts.length || s.pts[s.pts.length - 1].distanceToSquared(tip) > 1e-6)) {
        s.pts.push(tip.clone());
        if (s.pts.length > SMEAR_PTS) s.pts.shift();
      }
    }
  }

  /**
   * Start a smear on fighter i: picks the limb whose tip is closest to the hitbox centre (hx, hy) and seeds it with
   * that limb's recent path (the wind-up). frames = how long it keeps recording.
   */
  smear(i: number, hx: number, hy: number, color: THREE.Color, width: number, frames: number): void {
    const h = this.history[i];
    let best = -1;
    let bd = Infinity;
    // the striking limb is near the hitbox and has been travelling fast (presentation can lag the sim a frame or two)
    h.forEach((buf, l) => {
      const tip = buf[buf.length - 1];
      if (!tip) return;
      const d = Math.hypot(tip.x - hx, tip.y - hy);
      let travel = 0;
      for (let k = Math.max(1, buf.length - 5); k < buf.length; k++) travel += buf[k].distanceTo(buf[k - 1]);
      const score = d - 0.9 * travel;
      if (score < bd) {
        bd = score;
        best = l;
      }
    });
    if (best < 0) return;
    const s = this.smears.find((q) => q.fighter === i && q.live > 0) ?? this.smears.find((q) => q.live <= 0 && q.fade <= 0) ?? this.smears[0];
    s.fighter = i;
    s.limb = best;
    s.pts = h[best].slice(-6).map((p) => p.clone());
    s.width = width;
    s.live = frames / 60;
    s.fade = 0.16;
    s.mat.uniforms.uColor.value.copy(color);
    s.mesh.visible = true;
  }

  private buildSmear(s: Smear, alpha: number): void {
    const n = s.pts.length;
    const pos = s.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const tt = s.mesh.geometry.attributes.aT as THREE.BufferAttribute;
    if (n < 2) {
      s.mesh.visible = false;
      return;
    }
    // path length; skip tiny wiggles (idle hands)
    let len = 0;
    for (let k = 1; k < n; k++) len += s.pts[k].distanceTo(s.pts[k - 1]);
    if (len < 0.12) {
      s.mesh.visible = false;
      return;
    }
    s.mesh.visible = true;
    const view = new THREE.Vector3(0, 0, 1);
    if (this.camera) this.camera.getWorldDirection(view).negate();
    const tan = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    for (let k = 0; k < SMEAR_PTS; k++) {
      const src = Math.min(n - 1, Math.round((k / (SMEAR_PTS - 1)) * (n - 1)));
      const p = s.pts[src];
      const a = s.pts[Math.max(0, src - 1)];
      const b = s.pts[Math.min(n - 1, src + 1)];
      tan.subVectors(b, a);
      if (tan.lengthSq() < 1e-8) tan.set(1, 0, 0);
      nrm.crossVectors(tan, view).normalize();
      const u = k / (SMEAR_PTS - 1);
      const w = s.width * Math.pow(u, 0.7) * (0.35 + 0.65 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5));
      pos.setXYZ(k * 2, p.x + nrm.x * w, p.y + nrm.y * w, p.z + nrm.z * w + 0.05);
      pos.setXYZ(k * 2 + 1, p.x - nrm.x * w, p.y - nrm.y * w, p.z - nrm.z * w + 0.05);
      tt.setXY(k * 2, u, 1);
      tt.setXY(k * 2 + 1, u, -1);
    }
    pos.needsUpdate = true;
    tt.needsUpdate = true;
    s.mat.uniforms.uAlpha.value = alpha;
  }

  // ---------------------------------------------------------------- update
  /** Slow motion factor (KO); impact frames always count in real time. */
  timeScale = 1;

  /** dt: real seconds; frozen[i]: fighter i is in hitstop (smears hold). */
  update(realDt: number, frozen: readonly boolean[] = [false, false]): void {
    const dt = realDt * this.timeScale;
    for (const s of this.stars) {
      if (s.life <= 0) continue;
      s.t += dt;
      const u = s.t / s.life;
      if (u >= 1) {
        s.life = 0;
        s.mesh.visible = false;
        continue;
      }
      // pop with overshoot in the first 25%, then hold and collapse from the centre
      const grow = u < 0.25 ? 1 + 0.25 * Math.sin((u / 0.25) * Math.PI) * (u < 0.125 ? 1 : 0.5) : 1;
      const k = u < 0.25 ? Math.min(1, u / 0.1) : 1;
      s.mesh.scale.setScalar(s.size * k * grow * (1 + u * 0.25));
      s.mat.uniforms.uHole.value = u < 0.45 ? 0 : Math.pow((u - 0.45) / 0.55, 0.8);
      s.mat.uniforms.uAlpha.value = 1;
      s.mesh.rotation.z += s.spin * dt;
      if (this.camera) {
        const rz = s.mesh.rotation.z;
        s.mesh.quaternion.copy(this.camera.quaternion);
        s.mesh.rotateZ(rz);
        s.mesh.rotation.z = rz;
      }
    }

    if (this.linesLife > 0) {
      this.linesT += dt;
      const u = this.linesT / this.linesLife;
      if (u >= 1) {
        this.linesLife = 0;
        this.lines.visible = false;
      } else {
        this.linesMat.uniforms.uAlpha.value = 0.7 * (1 - u * u);
        this.linesMat.uniforms.uInner.value += dt * 1.2;
        if (this.camera && (this.camera as THREE.PerspectiveCamera).aspect) this.linesMat.uniforms.uAspect.value = (this.camera as THREE.PerspectiveCamera).aspect;
      }
    }

    this.impactNow = this.invertT > 0 ? 1 : 0;
    this.invert.visible = this.invertT > 0 && !this.postImpact;
    this.invertT = Math.max(0, this.invertT - realDt);

    for (let i = 0; i < PUFFS; i++) {
      const p = this.puffs[i];
      if (p.life <= 0) {
        if (this.pSize[i * 2] !== 0) this.pSize[i * 2] = 0;
        continue;
      }
      p.t += dt;
      const u = p.t / p.life;
      if (u >= 1) {
        p.life = 0;
        this.pSize[i * 2] = 0;
        continue;
      }
      const k = Math.exp(-4 * dt);
      p.vx *= k;
      p.vy = p.vy * k + 0.2 * dt;
      p.vz *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.pPos.set([p.x, p.y, p.z], i * 3);
      // grow fast, then shrink to nothing (cartoon dissolve)
      const s = u < 0.2 ? 0.5 + 2.5 * u : 1.0 - Math.pow((u - 0.2) / 0.8, 1.6);
      this.pSize[i * 2] = p.size * Math.max(0, s) * (1 + u * 0.6);
    }
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aCol.needsUpdate = true;

    for (const c of this.cracks) {
      if (c.life <= 0) continue;
      c.t += dt;
      const u = c.t / c.life;
      if (u >= 1) {
        c.life = 0;
        c.mesh.visible = false;
        continue;
      }
      (c.mesh.material as THREE.MeshBasicMaterial).opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const grow = 0.55 + 0.45 * Math.min(1, c.t / 0.08);
      const size = c.mesh.userData.size as number;
      c.mesh.scale.set(size * grow, size * (c.mesh.userData.wall ? 1 : 1.7) * grow, 1);
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3();
    const p = new THREE.Vector3();
    let dirty = false;
    for (let i = 0; i < DEBRIS; i++) {
      const o = i * 8;
      if (this.dState[o + 6] <= 0) continue;
      dirty = true;
      this.dState[o + 6] -= dt;
      this.dState[o + 4] -= 14 * dt;
      this.dState[o] += this.dState[o + 3] * dt;
      this.dState[o + 1] += this.dState[o + 4] * dt;
      this.dState[o + 2] += this.dState[o + 5] * dt;
      if (this.dState[o + 1] < 0.03 && this.dState[o + 4] < 0) {
        this.dState[o + 1] = 0.03;
        this.dState[o + 4] *= -0.35;
        this.dState[o + 3] *= 0.6;
        this.dState[o + 5] *= 0.6;
      }
      const life = this.dState[o + 6];
      const sc = life <= 0 ? 0 : Math.min(1, life / 0.25);
      e.set(this.dState[o + 7] * (1.2 - life), this.dState[o + 7] * 0.7 * (1.2 - life), 0);
      q.setFromEuler(e);
      p.set(this.dState[o], this.dState[o + 1], this.dState[o + 2]);
      one.setScalar(sc);
      m.compose(p, q, one);
      this.debris.setMatrixAt(i, m);
    }
    if (dirty) this.debris.instanceMatrix.needsUpdate = true;

    // blood droplets: stretched along their velocity, a splat where they land
    dirty = false;
    const up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    for (let i = 0; i < DROPS; i++) {
      const o = i * 7;
      if (this.bState[o + 6] <= 0) continue;
      dirty = true;
      this.bState[o + 6] -= dt;
      this.bState[o + 4] -= 11 * dt;
      this.bState[o] += this.bState[o + 3] * dt;
      this.bState[o + 1] += this.bState[o + 4] * dt;
      this.bState[o + 2] += this.bState[o + 5] * dt;
      if (this.bState[o + 1] <= 0.01) {
        if (i % 2 === 0) this.splat(this.bState[o], this.bState[o + 2], 0.035 + Math.random() * 0.05);
        this.bState[o + 6] = 0;
      }
      if (this.bState[o + 6] <= 0) {
        m.makeScale(0, 0, 0);
        this.drops.setMatrixAt(i, m);
        continue;
      }
      v.set(this.bState[o + 3], this.bState[o + 4], this.bState[o + 5]);
      const sp = v.length();
      q.setFromUnitVectors(up, v.normalize());
      p.set(this.bState[o], this.bState[o + 1], this.bState[o + 2]);
      one.set(1, 1 + Math.min(2.5, sp * 0.35), 1);
      m.compose(p, q, one);
      this.drops.setMatrixAt(i, m);
    }
    if (dirty) this.drops.instanceMatrix.needsUpdate = true;
    dirty = false;
    q.identity();
    for (let i = 0; i < SPLATS; i++) {
      const o = i * 5;
      if (this.sState[o + 3] <= 0) continue;
      dirty = true;
      this.sState[o + 3] -= dt;
      const t = this.sState[o + 3] / this.sState[o + 4];
      // spreads out quickly, then shrinks away over the last third
      const grow = Math.min(1, (1 - t) * 10) * Math.min(1, t * 3);
      const sz = this.sState[o + 2] * grow;
      p.set(this.sState[o], 0.006, this.sState[o + 1]);
      one.set(sz * 1.4, 1, sz);
      m.compose(p, q, t <= 0 ? one.setScalar(0) : one);
      this.splats.setMatrixAt(i, m);
    }
    if (dirty) this.splats.instanceMatrix.needsUpdate = true;

    for (const s of this.smears) {
      if (s.fighter < 0 || (s.live <= 0 && s.fade <= 0)) {
        s.mesh.visible = false;
        continue;
      }
      const hold = frozen[s.fighter];
      if (s.live > 0) {
        if (!hold) s.live -= dt;
        this.buildSmear(s, 0.9);
      } else {
        if (!hold) s.fade -= dt;
        // the tail catches up with the head while fading
        if (s.pts.length > 2 && !hold) s.pts.shift();
        this.buildSmear(s, 0.9 * Math.max(0, s.fade / 0.16));
        if (s.fade <= 0) {
          s.fighter = -1;
          s.mesh.visible = false;
        }
      }
    }
  }
}

/** Procedural ground-crack decal: chunky cartoon crater (pale dust ring, thick dark fissures with a light lip, chips).
 *  Strokes are thick on purpose: the fight camera sees the ground at a grazing angle (~13 deg). */
function crackTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cx = S / 2;
  const cy = S / 2;
  // pale dust ring + dark crater centre
  const dust = g.createRadialGradient(cx, cy, S * 0.08, cx, cy, S * 0.46);
  dust.addColorStop(0, 'rgba(235,222,200,0.55)');
  dust.addColorStop(0.6, 'rgba(235,222,200,0.25)');
  dust.addColorStop(1, 'rgba(235,222,200,0)');
  g.fillStyle = dust;
  g.fillRect(0, 0, S, S);
  const pit = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.16);
  pit.addColorStop(0, 'rgba(25,16,24,0.85)');
  pit.addColorStop(0.7, 'rgba(25,16,24,0.6)');
  pit.addColorStop(1, 'rgba(25,16,24,0)');
  g.fillStyle = pit;
  g.fillRect(0, 0, S, S);
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    let px = x;
    let py = y;
    const steps = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.8;
      px += Math.cos(a) * (len / steps);
      py += Math.sin(a) * (len / steps);
      pts.push([px, py]);
    }
    for (const [col, extra] of [
      ['rgba(250,238,215,0.95)', 8],
      ['rgba(25,16,24,1)', 0],
    ] as [string, number][]) {
      g.strokeStyle = col;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let i = 1; i < pts.length; i++) {
        g.lineWidth = Math.max(3, w * (1 - (i - 1) / pts.length)) + extra;
        g.beginPath();
        g.moveTo(pts[i - 1][0], pts[i - 1][1]);
        g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
      }
    }
    if (depth > 0) {
      const k = 1 + Math.floor((pts.length - 2) * rnd());
      branch(pts[k][0], pts[k][1], a + (rnd() > 0.5 ? 0.9 : -0.9), len * 0.5, w * 0.6, depth - 1);
    }
  };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    branch(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, a, S * (0.22 + rnd() * 0.16), 22, 1);
  }
  // chunky chips around the crater
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 40 + rnd() * 90;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const s = 7 + rnd() * 10;
    g.fillStyle = 'rgba(250,238,215,0.95)';
    g.beginPath();
    g.moveTo(x, y - s - 3);
    g.lineTo(x + s + 3, y + s * 0.4);
    g.lineTo(x - s * 0.7 - 3, y + s * 0.8 + 2);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(25,16,24,1)';
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s, y + s * 0.4);
    g.lineTo(x - s * 0.7, y + s * 0.8);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
