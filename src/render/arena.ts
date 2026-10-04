// "MAIN STAGE" arena: night festival stage. All geometry/materials are procedural
// placeholders; the arena exposes a small API (update, pulse, setDim) so a final
// art-authored scene can replace it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ArenaLike } from './arenas/hinterhof';

const LED_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LED_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uBeat;
  uniform float uHype;
  uniform float uDim;
  uniform float uFlash;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // LED pixel grid
    vec2 grid = fract(uv * vec2(160.0, 70.0));
    float pix = smoothstep(0.0, 0.18, grid.x) * smoothstep(0.0, 0.18, grid.y) * smoothstep(1.0, 0.82, grid.x) * smoothstep(1.0, 0.82, grid.y);
    // equalizer bars
    float bars = 32.0;
    float bi = floor(uv.x * bars);
    float bx = fract(uv.x * bars);
    float h = 0.1 + 0.45 * hash(bi * 7.13 + floor(uTime * 7.0)) * (0.55 + 0.45 * uBeat) + 0.25 * uHype;
    float mirrored = abs(uv.y - 0.5) * 2.0;
    float bar = step(mirrored, h) * smoothstep(0.0, 0.12, bx) * smoothstep(1.0, 0.88, bx);
    vec3 grad = mix(uColA, uColB, uv.x + 0.15 * sin(uTime * 0.6 + uv.y * 3.0));
    vec3 col = grad * bar * (0.55 + 0.6 * uBeat);
    // sweeping diagonal light band
    float band = smoothstep(0.08, 0.0, abs(fract(uv.x * 0.6 - uv.y * 0.3 - uTime * 0.12) - 0.5));
    col += grad * band * 0.25;
    // background glow
    col += grad * 0.07;
    // darken the lower part of the wall so fighters read clearly in front of it
    col *= pix * 1.1 * mix(0.35, 1.0, smoothstep(0.05, 0.6, uv.y));
    col = col * (1.0 + uFlash * 1.6) + grad * uFlash * 0.25 * pix;
    gl_FragColor = vec4(col * (1.0 - uDim * 0.85), 1.0);
  }
`;

const BEAM_VERT = /* glsl */ `
  varying float vY;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vY = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vY;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float edge = pow(abs(dot(vN, vView)), 1.5);
    float a = pow(vY, 1.6) * edge * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class Arena implements ArenaLike {
  readonly group = new THREE.Group();
  private led: THREE.ShaderMaterial;
  private beams: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; phase: number; base: THREE.Euler }[] = [];
  private crowd!: THREE.InstancedMesh;
  private crowdArms!: THREE.InstancedMesh;
  private crowdData: { x: number; z: number; s: number; phase: number; arms: boolean }[] = [];
  private lights: THREE.Light[] = [];
  private stripMat: THREE.MeshBasicMaterial;
  private dummy = new THREE.Object3D();
  private dim = 0;
  private flash = 0;
  private hype = 0;
  private phones!: THREE.Points;
  private crowdY: number[] = [];

  constructor(private scene: THREE.Scene) {
    scene.background = new THREE.Color(0x07050d);
    scene.fog = new THREE.Fog(0x0a0716, 16, 42);
    this.scene.add(this.group);

    // --- lights
    const hemi = new THREE.HemisphereLight(0x7a6cff, 0x1a0c1c, 1.1);
    const key = new THREE.DirectionalLight(0xfff0e0, 2.3);
    key.position.set(3, 6, 7);
    const rimA = new THREE.DirectionalLight(0xff3df0, 2.0);
    rimA.position.set(-5, 3, -5);
    const rimB = new THREE.DirectionalLight(0x32e6ff, 1.6);
    rimB.position.set(5, 2.5, -4);
    for (const l of [hemi, key, rimA, rimB]) {
      this.group.add(l);
      this.lights.push(l);
    }

    // --- stage deck
    const deckTex = makeDeckTexture();
    deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
    deckTex.repeat.set(6, 2);
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x5a5468, map: deckTex, roughness: 0.5, metalness: 0.15 }),
    );
    deck.position.set(0, -0.2, -1.2);
    this.group.add(deck);
    // front skirt
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(26, 1.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x0a090f, roughness: 0.9 }));
    skirt.position.set(0, -1.05, 2.2);
    this.group.add(skirt);
    // glowing front edge strip
    this.stripMat = new THREE.MeshBasicMaterial({ color: 0x29d8ff });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(26, 0.05, 0.05), this.stripMat);
    strip.position.set(0, -0.02, 2.31);
    this.group.add(strip);
    // floor glow under the LED wall
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4),
      new THREE.MeshBasicMaterial({ map: radialTexture('#7d3cff'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.01, -3.2);
    this.group.add(glow);

    // warm light pool on the fighting area (stage wash) for readability
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 4.6),
      new THREE.MeshBasicMaterial({ map: radialTexture('#ffe2c4'), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.008, 0);
    this.group.add(pool);

    // --- LED wall
    this.led = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBeat: { value: 0 },
        uHype: { value: 0 },
        uDim: { value: 0 },
        uFlash: { value: 0 },
        uColA: { value: new THREE.Color(0xff2bd6) },
        uColB: { value: new THREE.Color(0x22d3ff) },
      },
      vertexShader: LED_VERT,
      fragmentShader: LED_FRAG,
      fog: false,
    });
    const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6.2), this.led);
    ledWall.position.set(0, 4.0, -4.6);
    this.group.add(ledWall);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16.4, 6.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.6 }));
    frame.position.set(0, 4.0, -4.75);
    this.group.add(frame);
    // logo plate
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 1.8),
      new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, depthWrite: false, fog: false }),
    );
    logo.position.set(0, 4.9, -4.55);
    this.group.add(logo);

    // --- truss
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x8b8d99, roughness: 0.35, metalness: 0.8 });
    const bar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trussMat);
      m.position.set(x, y, z);
      m.userData.static = true;
      this.group.add(m);
    };
    for (const z of [-3.4, 1.2]) {
      bar(20, 0.12, 0.12, 0, 7.6, z);
      bar(20, 0.12, 0.12, 0, 7.25, z);
      for (let x = -9.5; x <= 9.5; x += 0.7) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), trussMat);
        d.position.set(x, 7.42, z);
        d.rotation.z = 0.6;
        d.userData.static = true;
        this.group.add(d);
      }
    }
    for (const x of [-10, 10]) for (const z of [-3.4, 1.2]) bar(0.3, 8, 0.3, x, 3.6, z);

    // --- light fixtures + beams
    const beamGeo = new THREE.CylinderGeometry(0.08, 1.4, 9, 24, 1, true);
    beamGeo.translate(0, -4.5, 0);
    const colors = [0xff3df0, 0x32e6ff, 0xffd21f, 0x32e6ff, 0xff3df0, 0xffffff];
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 0.5, metalness: 0.6 });
    colors.forEach((c, i) => {
      const x = -7.5 + i * 3;
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.4, 12), fixtureMat);
      fixture.position.set(x, 6.95, 1.2);
      fixture.userData.static = true;
      this.group.add(fixture);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(c) }, uIntensity: { value: 0.35 } },
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(x, 6.8, 1.2);
      const base = new THREE.Euler(-0.35, 0, (i - 2.5) * 0.12);
      beam.rotation.copy(base);
      beam.renderOrder = 2;
      this.group.add(beam);
      this.beams.push({ mesh: beam, mat, phase: i * 1.3, base });
    });

    // --- speaker stacks
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.7 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x1d1d26, roughness: 0.4, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const cab = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.1, 1.0, 2, 0.05), cabMat);
        cab.position.set(sx * 8.6, 0.55 + k * 1.12, -1.8);
        cab.userData.static = true;
        this.group.add(cab);
        for (const dy of [-0.22, 0.22]) {
          const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.06, 20), coneMat);
          cone.rotation.x = Math.PI / 2;
          cone.position.set(sx * 8.6, 0.55 + k * 1.12 + dy, -1.28);
          cone.userData.static = true;
          this.group.add(cone);
        }
      }
    }

    // --- side LED pillars
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.3), new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xff2bd6 : 0x22d3ff }));
      pillar.position.set(sx * 8.6, 4.4, -3.9);
      this.group.add(pillar);
    }

    // --- distant backdrop
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 50),
      new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false, depthWrite: false }),
    );
    sky.position.set(0, 10, -34);
    this.group.add(sky);

    this.buildCrowd();
    this.mergeStatic();
  }

  /** Merge static meshes that share a material into one draw call each. */
  private mergeStatic(): void {
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const c of this.group.children) {
      if (!(c instanceof THREE.Mesh) || !c.userData.static) continue;
      const m = c.material as THREE.Material;
      byMat.set(m, [...(byMat.get(m) ?? []), c]);
    }
    for (const [mat, meshes] of byMat) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = new THREE.Mesh(mergeGeometries(geos), mat);
      for (const m of meshes) this.group.remove(m);
      this.group.add(merged);
    }
  }

  private buildCrowd(): void {
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.55, 2, 7);
    bodyGeo.translate(0, 0.45, 0);
    const head = new THREE.SphereGeometry(0.13, 7, 5);
    head.translate(0, 1.03, 0);
    const merged = mergeGeos([bodyGeo, head]);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b0a12, roughness: 0.9 });
    const rows = [
      { z: 3.0, n: 46, y: -1.45 },
      { z: 3.6, n: 50, y: -1.5 },
      { z: 4.3, n: 54, y: -1.55 },
    ];
    let count = 0;
    for (const r of rows) count += r.n;
    this.crowd = new THREE.InstancedMesh(merged, mat, count);
    const armGeo = new THREE.CapsuleGeometry(0.045, 0.5, 1, 4);
    armGeo.translate(0, 0.25, 0);
    this.crowdArms = new THREE.InstancedMesh(armGeo, mat, count * 2);
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const x = -12 + (24 * (i + rnd() * 0.8)) / r.n;
        this.crowdData.push({ x, z: r.z + rnd() * 0.4, s: 0.9 + rnd() * 0.25, phase: rnd() * Math.PI * 2, arms: rnd() < 0.35 });
      }
    }
    this.crowd.frustumCulled = false;
    this.crowdArms.frustumCulled = false;
    this.group.add(this.crowd, this.crowdArms);
    this.crowdY = rows.flatMap((r) => Array<number>(r.n).fill(r.y));

    // phone lights
    const n = 60;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -11 + rnd() * 22;
      pos[i * 3 + 1] = -0.2 + rnd() * 0.5;
      pos[i * 3 + 2] = 3 + rnd() * 1.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.phones = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.07, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.group.add(this.phones);
  }

  /** Called every render frame. beat: 0..1 pulse from the music clock. */
  update(time: number, beat: number): void {
    this.led.uniforms.uTime.value = time;
    this.led.uniforms.uBeat.value = beat;
    this.led.uniforms.uHype.value = this.hype;
    this.led.uniforms.uDim.value = this.dim;
    this.led.uniforms.uFlash.value = this.flash;
    this.flash *= 0.88;
    const ys = this.crowdY;
    const energy = 0.5 + this.hype * 0.8;
    for (let i = 0; i < this.crowdData.length; i++) {
      const c = this.crowdData[i];
      const bob = Math.max(0, Math.sin(time * 4.2 + c.phase)) * 0.08 * energy + beat * 0.03;
      this.dummy.position.set(c.x, ys[i] + bob, c.z);
      this.dummy.rotation.set(0, 0, Math.sin(time * 1.3 + c.phase) * 0.05);
      this.dummy.scale.setScalar(c.s);
      this.dummy.updateMatrix();
      this.crowd.setMatrixAt(i, this.dummy.matrix);
      for (let a = 0; a < 2; a++) {
        const side = a === 0 ? -1 : 1;
        const raised = c.arms || this.hype > 0.6;
        this.dummy.position.set(c.x + side * 0.2 * c.s, ys[i] + bob + 0.82 * c.s, c.z);
        const wave = Math.sin(time * 6 + c.phase + a) * 0.25;
        this.dummy.rotation.set(0, 0, raised ? side * -0.35 + wave * 0.5 : side * 2.8);
        this.dummy.scale.setScalar(raised ? c.s : 0.001);
        this.dummy.updateMatrix();
        this.crowdArms.setMatrixAt(i * 2 + a, this.dummy.matrix);
      }
    }
    this.crowd.instanceMatrix.needsUpdate = true;
    this.crowdArms.instanceMatrix.needsUpdate = true;

    for (const b of this.beams) {
      b.mesh.rotation.set(
        b.base.x + Math.sin(time * 0.7 + b.phase) * 0.25,
        0,
        b.base.z + Math.sin(time * 0.45 + b.phase * 1.7) * 0.35,
      );
      b.mat.uniforms.uIntensity.value = (0.22 + beat * 0.18 + this.flash * 0.5) * (1 - this.dim * 0.8);
    }
    const stripHue = (time * 0.05) % 1;
    this.stripMat.color.setHSL(0.52 + 0.35 * Math.sin(stripHue * Math.PI * 2) * 0.5, 1, 0.55 * (1 - this.dim * 0.7));
    (this.phones.material as THREE.PointsMaterial).opacity = 0.5 + 0.4 * Math.sin(time * 2.0);
  }

  setDim(d: number): void {
    this.dim = d;
    for (const l of this.lights) {
      const base = l.userData.base ?? (l.userData.base = l.intensity);
      l.intensity = base * (1 - d * 0.55);
    }
  }

  /** Big moment: flash the LED wall and beams. */
  pulse(amount = 1): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  setHype(h: number): void {
    this.hype = h;
  }
}

function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // minimal merge for non-indexed + indexed geometries with position/normal
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

function makeDeckTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3542';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#353040' : '#3e3946';
    g.fillRect(0, i * 32, 256, 31);
    g.fillStyle = '#1b1820';
    g.fillRect(0, i * 32 + 31, 256, 1);
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 30, 1);
  }
  // gaffer tape marks
  g.fillStyle = 'rgba(255,210,31,0.55)';
  g.fillRect(120, 100, 18, 4);
  g.fillRect(127, 93, 4, 18);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function logoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 1024, 256);
  g.font = 'italic 900 170px Anton, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillText('RAPBRAWL', 520, 140);
  g.fillStyle = '#ffffff';
  g.fillText('RAPBRAWL', 512, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#05030a');
  grd.addColorStop(0.6, '#1a0b2e');
  grd.addColorStop(1, '#3a1450');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512;
    const y = 150 + Math.random() * 100;
    g.fillStyle = `rgba(${200 + Math.random() * 55},${150 + Math.random() * 80},255,${0.2 + Math.random() * 0.5})`;
    g.fillRect(x, y, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
