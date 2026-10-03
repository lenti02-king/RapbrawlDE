// Pooled GPU particles (velocity-stretched additive billboards) + shockwave rings.
// One draw call for all sparks; everything is CPU-simulated in a fixed pool.
import * as THREE from 'three';

const MAX = 1400;

const VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iVel;
  attribute vec4 iColor;
  attribute vec2 iSize;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float len = iSize.x + sp * iSize.y;
    mv.xy += dir * position.x * len + perp * position.y * iSize.x;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy * 2.0;
    vColor = iColor;
  }
`;
const FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    float d = length(vUv);
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor.rgb * vColor.a * a, a * vColor.a);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(0.84, 0.95, d) * smoothstep(1.0, 0.96, d);
    gl_FragColor = vec4(uColor * a * uAlpha, a * uAlpha);
  }
`;
const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  life: number;
  max: number;
  size: number;
  flat: boolean;
}

export class VFX {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 4);
  private size = new Float32Array(MAX * 2);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private baseAlpha = new Float32Array(MAX);
  private next = 0;
  private aPos: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private rings: Ring[] = [];
  private camera: THREE.Camera | null = null;
  timeScale = 1;

  constructor() {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.size, 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iVel', this.aVel);
    geo.setAttribute('iColor', this.aCol);
    geo.setAttribute('iSize', this.aSize);
    geo.instanceCount = MAX;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.group.add(this.mesh);

    const ringGeo = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < 12; i++) {
      const mat2 = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0 } },
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(ringGeo, mat2);
      m.visible = false;
      m.renderOrder = 9;
      this.group.add(m);
      this.rings.push({ mesh: m, mat: mat2, life: 0, max: 1, size: 1, flat: false });
    }
  }

  setCamera(c: THREE.Camera): void {
    this.camera = c;
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: THREE.Color,
    alpha: number,
    width: number,
    stretch: number,
    life: number,
    drag = 3,
    grav = 0,
  ): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([color.r, color.g, color.b, alpha], i * 4);
    this.size.set([width, stretch], i * 2);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.baseAlpha[i] = alpha;
  }

  /** Radial streak sparks. dir: -1/1 bias toward hit direction. */
  sparks(x: number, y: number, count: number, color: THREE.Color, speed: number, dir: number, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.random() * 2 - 1) * Math.PI * spread * 0.55 + (dir < 0 ? Math.PI : 0);
      const sp = speed * (0.4 + Math.random() * 0.9);
      this.emit(x, y, 0.35, Math.cos(a) * sp, Math.sin(a) * sp, (Math.random() - 0.5) * sp * 0.6, color, 1.6, 0.035 + Math.random() * 0.03, 0.05, 0.16 + Math.random() * 0.14, 6, -4);
    }
  }

  flash(x: number, y: number, size: number, color: THREE.Color, life = 0.1): void {
    this.emit(x, y, 0.4, 0, 0, 0, color, 1.8, size, 0, life, 0, 0);
  }

  dust(x: number, y: number, count: number, spread: number, color = new THREE.Color(0.55, 0.5, 0.65)): void {
    for (let i = 0; i < count; i++) {
      const d = (Math.random() * 2 - 1) * spread;
      this.emit(x + d * 0.3, y + 0.05, (Math.random() - 0.5) * 0.6, d * 1.6, 0.3 + Math.random() * 0.6, 0, color, 0.35, 0.18 + Math.random() * 0.15, 0, 0.45 + Math.random() * 0.3, 2.5, 0.5);
    }
  }

  confetti(x: number, y: number, count: number): void {
    const palette = [0xff2bd6, 0x22d3ff, 0xffd21f, 0xffffff].map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      const c = palette[i % palette.length];
      this.emit(x + (Math.random() - 0.5) * 6, y + Math.random() * 1.5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1 + Math.random() * 3, 0, c, 1.0, 0.04, 0.02, 1.6 + Math.random(), 1.2, -3);
    }
  }

  ring(x: number, y: number, size: number, color: THREE.Color, life = 0.3, flat = false): void {
    const r = this.rings.find((q) => q.life <= 0) ?? this.rings[0];
    r.life = life;
    r.max = life;
    r.size = size;
    r.flat = flat;
    r.mesh.position.set(x, flat ? y + 0.02 : y, flat ? 0 : 0.3);
    r.mat.uniforms.uColor.value.copy(color);
    r.mesh.visible = true;
  }

  update(dt: number): void {
    dt *= this.timeScale;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        if (this.col[i * 4 + 3] !== 0) this.col[i * 4 + 3] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 4 + 3] = this.baseAlpha[i] * t;
    }
    this.aPos.needsUpdate = true;
    this.aVel.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) {
        r.mesh.visible = false;
        continue;
      }
      r.life -= dt;
      const t = 1 - Math.max(0, r.life / r.max);
      const s = r.size * (0.25 + 0.75 * (1 - Math.pow(1 - t, 3)));
      r.mesh.scale.setScalar(s);
      r.mat.uniforms.uAlpha.value = (1 - t) * 1.6;
      if (r.flat) r.mesh.rotation.set(-Math.PI / 2, 0, 0);
      else if (this.camera) r.mesh.quaternion.copy(this.camera.quaternion);
    }
  }
}
