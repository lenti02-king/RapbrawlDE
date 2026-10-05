// "BLOCK BEATS PODCAST" arena (Clash-Royale style) after the product owner's concept image.
// Geometry and lighting are built and baked in Blender (tools/arena/podcast.py): the static set, the rug and the
// floor's lightmap are unlit textures (all bounce light and soft shadows baked), the neon sign, LED strips, ON AIR,
// ring lights and mixer buttons are emissive meshes animated here (beat, hype, hit flashes) and picked up by bloom.
// The fighters get real-time lights that match the baked mood (warm key, purple and gold rims) and cast shadows
// onto a shadow catcher; the high tier adds planar reflections of the neon on the polished floor.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { fetchGltf } from '../glbRig';
import type { ArenaLike } from './hinterhof';

const BASE = 'assets/arena/podcast/';

interface Meta {
  range: number;
  floorRange?: number;
  rugRange?: number;
  tile: number;
  floor: [number, number, number];
}

interface Glow {
  mat: THREE.MeshBasicMaterial;
  color: THREE.Color;
  anim: string;
}

export class PodcastArena implements ArenaLike {
  readonly group = new THREE.Group();
  private lights: THREE.Light[] = [];
  private baked: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  private glows: Glow[] = [];
  private reflector: Reflector | null = null;
  private dim = 0;
  private flash = 0;
  private hype = 0;
  readonly ready: Promise<void>;
  /** Post settings for this set: only real neon/LED brightness blooms (white clothes and the baked set do not). */
  readonly look = { toneMapping: THREE.AgXToneMapping, bloomThreshold: 1.6, bloomStrength: 0.38, bloomRadius: 0.22, exposure: 0.82, saturation: 1.32, contrast: 1.16 };

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer, private quality: 'low' | 'medium' | 'high' = 'high') {
    scene.background = new THREE.Color(0x0c0711);
    scene.fog = new THREE.Fog(0x0c0711, 28, 70);
    scene.add(this.group);
    if (renderer && quality !== 'low') {
      // soft studio environment for the fighters' metals (chains, grillz, watches)
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.3;
      pm.dispose();
    }
    this.buildLights(scene);
    this.ready = this.load().catch((e) => console.warn('[arena] podcast failed to load', e));
  }

  private buildLights(scene: THREE.Scene): void {
    const low = this.quality === 'low';
    const hemi = new THREE.HemisphereLight(0xb8a4ff, 0x4a2a1c, low ? 1.2 : 0.55);
    const key = new THREE.DirectionalLight(0xffe0c4, low ? 1.3 : 1.25);
    key.position.set(-3, 9, 9);
    key.target.position.set(0, 0, 0);
    key.castShadow = !low;
    key.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
    const sc = key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 6;
    sc.bottom = -2;
    sc.near = 1;
    sc.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    const rimP = new THREE.DirectionalLight(0xa45cff, 1.5);
    rimP.position.set(-6, 4, -7);
    const rimG = new THREE.DirectionalLight(0xffa640, 0.9);
    rimG.position.set(6, 3, -7);
    const front = new THREE.DirectionalLight(0xf2e2ff, 0.3);
    front.position.set(1, 2, 10);
    for (const l of [hemi, key, rimP, rimG, front]) {
      l.userData.base = l.intensity;
      this.lights.push(l);
      scene.add(l);
    }
    scene.add(key.target);
    // contact shadows of the fighters on the baked floor
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.ShadowMaterial({ opacity: 0.45, depthWrite: false }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(0, 0.006, 0.5);
    catcher.receiveShadow = true;
    catcher.renderOrder = 2;
    this.group.add(catcher);
  }

  private async load(): Promise<void> {
    const [meta, gltf] = await Promise.all([fetch(`${BASE}arena.json`).then((r) => r.json() as Promise<Meta>), fetchGltf(`${BASE}arena`)]);
    if (!gltf) throw new Error('arena geometry missing');
    const tl = new THREE.TextureLoader();
    const tex = async (file: string, srgb = true, repeat = false) => {
      const t = await tl.loadAsync(BASE + file);
      t.flipY = false;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = this.quality === 'low' ? 1 : 8;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const [setTex, rugTex, tileTex, floorLight] = await Promise.all([
      tex(this.quality === 'high' ? 'set.jpg' : 'set_2k.jpg'),
      tex('rug.jpg'),
      tex('floor_tile.jpg', true, true),
      tex('floor_light.jpg'),
    ]);
    floorLight.channel = 1;
    const unlit = (map: THREE.Texture, range: number) => {
      const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(range, range, range) });
      this.baked.push({ mat, base: mat.color.clone() });
      return mat;
    };
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const name = mesh.name || mesh.parent?.name || '';
      if (name.startsWith('arena_set')) mesh.material = unlit(setTex, meta.range);
      else if (name.startsWith('arena_rug')) mesh.material = unlit(rugTex, meta.rugRange ?? meta.range);
      else if (name.startsWith('arena_floor')) {
        const mat = new THREE.MeshBasicMaterial({ map: tileTex, lightMap: floorLight, lightMapIntensity: meta.floorRange ?? meta.range });
        this.baked.push({ mat, base: mat.color.clone() });
        mesh.material = mat;
      } else {
        const extra = (mesh.userData.rb_glow ?? mesh.parent?.userData.rb_glow) as string | undefined;
        const g = extra ? (JSON.parse(extra) as { color: number[]; base: number[]; strength: number; anim: string }) : null;
        const c = g ? new THREE.Color(g.base[0], g.base[1], g.base[2]).lerp(new THREE.Color(g.color[0], g.color[1], g.color[2]), 0.45) : new THREE.Color(1, 1, 1);
        // HDR colour (> 1) so bloom picks the tubes up; the tone mapper keeps the core near white like real neon
        c.multiplyScalar(g ? Math.min(2.6, 1.2 + g.strength / 20) : 1.8);
        const mat = new THREE.MeshBasicMaterial({ color: c.clone() });
        this.glows.push({ mat, color: c, anim: g?.anim ?? 'led' });
        mesh.material = mat;
      }
    });
    this.group.add(gltf.scene);
    if (this.quality === 'high') this.addReflections(meta);
    this.setDim(this.dim);
  }

  /** Polished floor: planar reflection of the neon and LEDs, strongest at grazing angles. */
  private addReflections(meta: Meta): void {
    const [fx, fy0, fy1] = meta.floor;
    const shader = {
      name: 'FloorReflector',
      uniforms: {
        color: { value: new THREE.Color(1, 1, 1) },
        tDiffuse: { value: null as THREE.Texture | null },
        textureMatrix: { value: new THREE.Matrix4() },
        uStrength: { value: 0.2 },
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStrength; varying vec4 vUv; varying vec3 vWorld;
        void main(){
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.12 + 0.88 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
          // polished wood, not a mirror: 12-tap blur (wider further from the camera), slight ripple along the planks
          vec2 ripple = vec2(sin(vWorld.x * 3.0) * 0.002, 0.0);
          float r = 0.004 + 0.006 * clamp(V.y * 1.6, 0.0, 1.0);
          vec3 base = vec3(0.0);
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996;
            float d = sqrt((float(i) + 0.5) / 12.0) * r;
            vec2 o = ripple + vec2(cos(a), sin(a) * 1.6) * d;
            base += texture2DProj(tDiffuse, vUv + vec4(o * vUv.w, 0.0, 0.0)).rgb;
          }
          gl_FragColor = vec4(base / 12.0 * color * uStrength * fres, 1.0);
        }`,
    };
    const refl = new Reflector(new THREE.PlaneGeometry(2 * fx, fy1 - fy0), { shader, textureWidth: 1024, textureHeight: 512, clipBias: 0.003, multisample: 0 });
    const m = refl.material as THREE.ShaderMaterial;
    m.transparent = true;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    refl.rotation.x = -Math.PI / 2;
    // Blender y (away from the camera) is the game's -z
    refl.position.set(0, 0.004, -(fy0 + fy1) / 2);
    refl.renderOrder = 1;
    this.reflector = refl;
    this.group.add(refl);
  }

  update(time: number, beat: number): void {
    this.flash = Math.max(0, this.flash - 0.04);
    const pulse = Math.pow(1 - (beat % 1), 3);
    for (const g of this.glows) {
      let k = 1;
      if (g.anim === 'neon') k = 0.92 + 0.08 * Math.sin(time * 2.1) + 0.12 * pulse + 0.25 * this.hype + 0.2 * this.flash;
      else if (g.anim === 'led') k = 0.85 + 0.25 * pulse + 0.6 * this.flash;
      else if (g.anim === 'cassette') k = 0.9 + 0.1 * Math.sin(time * 1.3);
      else if (g.anim === 'onair') k = 0.95 + 0.05 * Math.sin(time * 8);
      else if (g.anim === 'buttons') k = 0.75 + 0.25 * Math.abs(Math.sin(time * 3.7)) + 0.3 * pulse;
      g.mat.color.copy(g.color).multiplyScalar(k * (1 - this.dim * 0.45));
    }
  }

  setDim(d: number): void {
    this.dim = d;
    for (const b of this.baked) b.mat.color.copy(b.base).multiplyScalar(1 - d * 0.72);
    for (const l of this.lights) l.intensity = (l.userData.base as number) * (1 - d * 0.6);
    if (this.reflector) (this.reflector.material as THREE.ShaderMaterial).uniforms.uStrength.value = 0.2 * (1 - d * 0.6);
  }

  pulse(amount = 1): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  setHype(h: number): void {
    this.hype = h;
  }
}
