// "HINTERHOF – BLOCK BEATS", realistic version modelled on the product owner's reference image:
// a narrow Berlin backyard enclosed on three sides, olive-grey peeling plaster, roller shutters,
// a balcony with a basketball hoop and purple LED bars, a low block-party stage with PA stacks,
// chain-link fences, crates, bins, a scooter, and wet asphalt with chalk and court lines.
// PBR materials from procedural textures, real shadows, dusk-sky image-based lighting, planar
// reflections on the wet ground (high quality only). Original artwork only (no real logos).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { asphalt, concrete, drawTags, plaster, shutter, windowAtlas, withRepeat, wood, type PBRSet } from '../textures';
import type { ArenaLike } from './hinterhof';

const DISPLAY_FONT = "'Lilita One', 'Arial Black', Impact, sans-serif";

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'window' | 'shutter' | 'door';
  variant?: number;
}

function pbr(set: PBRSet, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0, ...opts });
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, redrawOnFonts = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (redrawOnFonts && document.fonts) {
    void document.fonts.ready.then(() => {
      g.clearRect(0, 0, w, h);
      draw(g);
      t.needsUpdate = true;
    });
  }
  return t;
}

/** Collects geometry per material and merges it into one mesh per material. */
class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4): void {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (m) g = g.applyMatrix4(m);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }
  build(group: THREE.Group, cast: Set<THREE.Material>): void {
    for (const [mat, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.receiveShadow = true;
      mesh.castShadow = cast.has(mat);
      group.add(mesh);
    }
    this.parts.clear();
  }
}

const M4 = (pos: [number, number, number], rotY = 0, rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1] + rotY, rot[2]));
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...scale));
};
const mul = (a: THREE.Matrix4, b: THREE.Matrix4) => new THREE.Matrix4().multiplyMatrices(a, b);

// courtyard dimensions (metres)
const BACK_Z = -8.2;
const SIDE_X = 10;
const FRONT_Z = 9.5;
const WALL_H = 17;
const FLOORS = [3.7, 6.9, 10.1, 13.3];

export class CourtyardArena implements ArenaLike {
  readonly group = new THREE.Group();
  private lights: THREE.Light[] = [];
  private batch = new Batch();
  private casters = new Set<THREE.Material>();
  private ledMats: THREE.MeshStandardMaterial[] = [];
  private parLens!: THREE.MeshStandardMaterial;
  private beams: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; phase: number }[] = [];
  private dim = 0;
  private flash = 0;
  private hype = 0;
  private envBase = 0.6;
  private sceneRef: THREE.Scene;
  private skyMat!: THREE.MeshBasicMaterial;
  private atlasMat!: THREE.MeshStandardMaterial;
  private reflector: Reflector | null = null;

  private mBack = pbr(withRepeat(plaster([0.6, 0.6, 0.5], 3, 0.55), 1 / 4, 1 / 4));
  private mLeft = pbr(withRepeat(plaster([0.66, 0.6, 0.47], 9, 0.45), 1 / 4, 1 / 4));
  private mRight = pbr(withRepeat(plaster([0.6, 0.6, 0.57], 15, 0.5), 1 / 4, 1 / 4));
  private mPlinth = pbr(withRepeat(plaster([0.5, 0.49, 0.44], 21, 0.2), 1 / 3, 1 / 3));
  private mConcrete = pbr(withRepeat(concrete(2), 1, 1));
  private mMetal = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.5, metalness: 0.75 });
  private mRail = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
  private mSteel = new THREE.MeshStandardMaterial({ color: 0xb7bbc2, roughness: 0.32, metalness: 0.88 });
  private mBlack = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.7 });
  private mCab = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  private mWhite = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.6 });

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer, quality: 'low' | 'medium' | 'high' = 'high') {
    this.sceneRef = scene;
    scene.background = new THREE.Color(0x384058);
    scene.fog = new THREE.Fog(0x4a4f63, 26, 60);
    scene.add(this.group);
    for (const m of [this.mBack, this.mLeft, this.mRight, this.mPlinth, this.mConcrete, this.mMetal, this.mRail, this.mSteel, this.mBlack, this.mCab, this.mWhite]) this.casters.add(m);
    this.buildSky(renderer);
    this.buildLights();
    this.buildGround(quality === 'high');
    this.buildBackWall();
    this.buildSideWings();
    this.buildStage();
    this.buildProps();
    this.buildFencesAndBarriers();
    this.buildCables();
    this.batch.build(this.group, this.casters);
  }

  // ------------------------------------------------------------ sky + environment
  private buildSky(renderer?: THREE.WebGLRenderer): void {
    const tex = canvasTexture(1024, 512, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, '#26304f');
      grd.addColorStop(0.4, '#55607e');
      grd.addColorStop(0.62, '#9a8f9a');
      grd.addColorStop(0.8, '#d9a985');
      grd.addColorStop(1, '#f0c69c');
      g.fillStyle = grd;
      g.fillRect(0, 0, 1024, 512);
      const r = rng(17);
      for (let i = 0; i < 90; i++) {
        const x = r() * 1024;
        const y = 80 + r() * 260;
        const w = 80 + r() * 260;
        const cg = g.createRadialGradient(x, y, 0, x, y, w * 0.5);
        cg.addColorStop(0, `rgba(${200 + r() * 40},${190 + r() * 40},${200 + r() * 40},${0.08 + r() * 0.14})`);
        cg.addColorStop(1, 'rgba(200,190,200,0)');
        g.fillStyle = cg;
        g.save();
        g.translate(x, y);
        g.scale(1, 0.18);
        g.beginPath();
        g.arc(0, 0, w * 0.5, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    this.skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), this.skyMat);
    sky.position.set(0, -10, 0);
    this.group.add(sky);
    if (renderer) {
      const pm = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
      // bright warm windows and purple LEDs make the reflections on wet ground look right
      const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.95, 0.5) });
      for (let i = 0; i < 14; i++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), warm);
        const a = (i / 14) * Math.PI * 2;
        w.position.set(Math.cos(a) * 8, 1 + (i % 4) * 1.2, Math.sin(a) * 8);
        w.lookAt(0, 1, 0);
        envScene.add(w);
      }
      const led = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.8, 4) }));
      led.position.set(0, 2.5, -8);
      envScene.add(led);
      this.sceneRef.environment = pm.fromScene(envScene, 0.02).texture;
      (this.sceneRef as THREE.Scene & { environmentIntensity: number }).environmentIntensity = this.envBase;
      pm.dispose();
    }
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xb9c6ff, 0x3d352c, 0.85);
    const key = new THREE.DirectionalLight(0xe8ecff, 1.5);
    key.position.set(-5, 13, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -12;
    sc.right = 12;
    sc.top = 12;
    sc.bottom = -8;
    sc.near = 1;
    sc.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.target.position.set(0, 0, -2);
    this.group.add(key.target);
    const front = new THREE.DirectionalLight(0xffe2c8, 0.8);
    front.position.set(2, 3, 12);
    const rim = new THREE.DirectionalLight(0xffb27a, 0.9);
    rim.position.set(6, 7, -14);
    const ledGlow = new THREE.PointLight(0xa64dff, 7, 7, 2);
    ledGlow.position.set(0, 3.4, -7.0);
    const spotA = new THREE.SpotLight(0xffe3c0, 38, 14, 0.62, 0.55, 2);
    spotA.position.set(-1.4, 3.55, -7.2);
    spotA.target.position.set(-1.0, 0, -4.2);
    const spotB = new THREE.SpotLight(0xffe3c0, 38, 14, 0.62, 0.55, 2);
    spotB.position.set(1.4, 3.55, -7.2);
    spotB.target.position.set(1.0, 0, -4.2);
    this.group.add(spotA.target, spotB.target);
    for (const l of [hemi, key, front, rim, ledGlow, spotA, spotB]) {
      this.group.add(l);
      this.lights.push(l);
      l.userData.base = l.intensity;
    }
  }

  setShadowQuality(size: number): void {
    for (const l of this.lights) if (l instanceof THREE.DirectionalLight && l.castShadow) l.shadow.mapSize.set(size, size);
  }

  // ------------------------------------------------------------ ground
  private buildGround(reflections: boolean): void {
    const set = withRepeat(asphalt(), 8, 7);
    const mat = pbr(set, { color: 0x6e6e76, envMapIntensity: 0.9 });
    // wet: darker and glossier than dry asphalt, but no glitter from the aggregate normals
    mat.roughnessMap = null;
    mat.roughness = 0.58;
    mat.normalScale.set(0.25, 0.25);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * SIDE_X + 2, FRONT_Z - BACK_Z + 4), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, (FRONT_Z + BACK_Z) / 2);
    ground.receiveShadow = true;
    this.group.add(ground);
    // wetness mask (drives the planar reflection strength)
    const wet = canvasTexture(512, 512, (g) => {
      g.fillStyle = '#3a3a3a';
      g.fillRect(0, 0, 512, 512);
      const r = rng(61);
      for (let i = 0; i < 26; i++) {
        const x = r() * 512;
        const y = r() * 512;
        const rad = 20 + r() * 70;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, 'rgba(255,255,255,0.95)');
        grd.addColorStop(0.7, 'rgba(255,255,255,0.6)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.save();
        g.translate(x, y);
        g.scale(1.6, 0.8);
        g.beginPath();
        g.arc(0, 0, rad, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    });
    wet.colorSpace = THREE.NoColorSpace;
    wet.wrapS = wet.wrapT = THREE.RepeatWrapping;
    if (reflections) {
      const shader = {
        name: 'WetReflector',
        uniforms: {
          color: { value: new THREE.Color(1, 1, 1) },
          tDiffuse: { value: null as THREE.Texture | null },
          textureMatrix: { value: new THREE.Matrix4() },
          tWet: { value: wet },
          uStrength: { value: 0.55 },
        },
        vertexShader: /* glsl */ `
          uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vMapUv; varying vec3 vWorld;
          void main(){ vUv = textureMatrix * vec4(position, 1.0); vMapUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D tWet; uniform float uStrength;
          varying vec4 vUv; varying vec2 vMapUv; varying vec3 vWorld;
          void main(){
            float wet = texture2D(tWet, vMapUv * 3.0).r;
            vec3 V = normalize(cameraPosition - vWorld);
            float fres = 0.15 + 0.85 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
            vec2 jitter = vec2(sin(vWorld.x * 7.0 + vWorld.z * 3.0), cos(vWorld.z * 6.0)) * 0.004 * (1.0 - wet);
            vec4 base = texture2DProj(tDiffuse, vUv + vec4(jitter * vUv.w, 0.0, 0.0));
            float k = uStrength * fres * mix(0.25, 1.0, wet);
            gl_FragColor = vec4(base.rgb * color * k, 1.0);
          }`,
      };
      const refl = new Reflector(new THREE.PlaneGeometry(2 * SIDE_X, FRONT_Z - BACK_Z), {
        shader,
        textureWidth: 1024,
        textureHeight: 1024,
        clipBias: 0.003,
        multisample: 0,
      });
      const m = refl.material as THREE.ShaderMaterial;
      m.transparent = true;
      m.blending = THREE.AdditiveBlending;
      m.depthWrite = false;
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(0, 0.002, (FRONT_Z + BACK_Z) / 2);
      refl.renderOrder = 1;
      this.reflector = refl;
      this.group.add(refl);
    }
    // court lines + chalk (decal)
    const W = 2048;
    const H = 2048;
    const sx = W / (2 * SIDE_X);
    const sz = H / (FRONT_Z - BACK_Z);
    const P = (x: number, z: number): [number, number] => [(x + SIDE_X) * sx, (z - BACK_Z) * sz];
    const lines = canvasTexture(W, H, (g) => {
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(236,234,226,0.92)';
      g.lineCap = 'round';
      g.lineWidth = 0.11 * sx;
      const line = (a: [number, number], b: [number, number]) => {
        g.beginPath();
        g.moveTo(...a);
        g.lineTo(...b);
        g.stroke();
      };
      line(P(0, -5.3), P(0, FRONT_Z));
      line(P(-4.8, -5.3), P(-6.6, FRONT_Z));
      line(P(4.8, -5.3), P(6.6, FRONT_Z));
      line(P(-5.5, -1.0), P(5.5, -1.0));
      // chalk drawings
      const chalk = (col: string, pts: [number, number][], lw = 0.06) => {
        g.strokeStyle = col;
        g.lineWidth = lw * sx;
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(...P(...p)) : g.moveTo(...P(...p))));
        g.stroke();
      };
      chalk('rgba(255,120,190,0.8)', [[2.6, 6.2], [4.6, 5.6], [4.2, 5.1], [4.6, 5.6], [4.1, 6.0]]);
      chalk('rgba(255,120,190,0.75)', [[5.0, 6.8], [5.4, 6.2], [5.8, 6.8], [6.2, 6.2], [6.6, 6.8]]);
      chalk('rgba(110,220,255,0.75)', [[-3.2, 2.2], [-2.2, 1.8], [-1.4, 2.3], [-0.6, 1.9]]);
      chalk('rgba(110,220,255,0.7)', [[2.0, 2.8], [3.4, 2.6], [3.0, 2.3], [3.4, 2.6], [3.0, 2.9]]);
      chalk('rgba(150,255,170,0.6)', [[-7.6, 3.6], [-6.8, 3.0], [-6.0, 3.6], [-6.8, 4.2], [-7.6, 3.6]]);
      // wear
      g.globalCompositeOperation = 'destination-out';
      const r = rng(5);
      for (let i = 0; i < 4500; i++) {
        g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.7})`;
        g.fillRect(r() * W, r() * H, 2 + r() * 12, 2 + r() * 5);
      }
      g.globalCompositeOperation = 'source-over';
    });
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * SIDE_X, FRONT_Z - BACK_Z),
      new THREE.MeshStandardMaterial({ map: lines, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, 0.003, (FRONT_Z + BACK_Z) / 2);
    decal.receiveShadow = true;
    this.group.add(decal);
    // manhole covers
    const manhole = canvasTexture(256, 256, (g) => {
      g.fillStyle = '#2b2a2c';
      g.beginPath();
      g.arc(128, 128, 126, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#4a3a30';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(128, 128, 118, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#3d3c40';
      g.lineWidth = 6;
      for (let k = -4; k <= 4; k++) {
        g.beginPath();
        g.moveTo(30, 128 + k * 20);
        g.lineTo(226, 128 + k * 20);
        g.stroke();
      }
    });
    const mh = new THREE.MeshStandardMaterial({ map: manhole, metalness: 0.65, roughness: 0.45, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const [x, z] of [
      [-6.2, 5.6],
      [-3.4, 7.2],
      [5.4, 6.4],
      [-4.4, -2.6],
    ]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), mh);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      m.receiveShadow = true;
      this.group.add(m);
    }
    // a sheet of paper near the stage
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), this.mWhite);
    paper.rotation.set(-Math.PI / 2, 0, 0.4);
    paper.position.set(1.6, 0.006, -3.6);
    this.group.add(paper);
  }

  // ------------------------------------------------------------ walls
  private windowAtlasMat(): THREE.MeshStandardMaterial {
    if (!this.atlasMat) {
      const a = windowAtlas();
      this.atlasMat = new THREE.MeshStandardMaterial({
        map: a.map,
        emissiveMap: a.emissive,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.05,
        envMapIntensity: 0.55,
      });
    }
    return this.atlasMat;
  }

  private _shutter: THREE.MeshStandardMaterial | null = null;
  private shutterMat(): THREE.MeshStandardMaterial {
    if (!this._shutter) {
      const s = shutter(5);
      this._shutter = pbr(s, { metalness: 0.5, color: 0xc8c8c8 });
      for (const t of [s.map, s.normalMap, s.roughnessMap]) t.repeat.set(1 / 3.0, 1 / 2.8);
      this.casters.add(this._shutter);
    }
    return this._shutter;
  }

  private _door: THREE.MeshStandardMaterial | null = null;
  private doorMat(): THREE.MeshStandardMaterial {
    if (!this._door) {
      this._door = pbr(withRepeat(wood(12), 1 / 1.2, 1 / 2.4), { color: 0x7a5b46 });
      this.casters.add(this._door);
    }
    return this._door;
  }

  /** Wall in local space (x along the wall, y up, +z = facing the courtyard) with openings. */
  private facade(w: number, h: number, holes: Hole[], wall: THREE.Material, m: THREE.Matrix4, opts: { y0?: number; depth?: number; sills?: boolean } = {}): void {
    const y0 = opts.y0 ?? 0;
    const depth = opts.depth ?? 0.24;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, y0);
    shape.lineTo(w / 2, y0);
    shape.lineTo(w / 2, y0 + h);
    shape.lineTo(-w / 2, y0 + h);
    shape.closePath();
    for (const o of holes) {
      const p = new THREE.Path();
      p.moveTo(o.x - o.w / 2, o.y);
      p.lineTo(o.x + o.w / 2, o.y);
      p.lineTo(o.x + o.w / 2, o.y + o.h);
      p.lineTo(o.x - o.w / 2, o.y + o.h);
      p.closePath();
      shape.holes.push(p);
    }
    this.batch.add(new THREE.ShapeGeometry(shape), wall, m);
    for (const o of holes) {
      const d = o.kind === 'window' ? depth : depth * 0.7;
      const sides: [number, number, number, number, number, number][] = [
        [o.x - o.w / 2, o.y + o.h / 2, -d / 2, 0, Math.PI / 2, o.h],
        [o.x + o.w / 2, o.y + o.h / 2, -d / 2, 0, -Math.PI / 2, o.h],
        [o.x, o.y + o.h, -d / 2, Math.PI / 2, 0, o.w],
        [o.x, o.y, -d / 2, -Math.PI / 2, 0, o.w],
      ];
      for (const [px, py, pz, rx, ry, len] of sides) {
        const g = ry !== 0 ? new THREE.PlaneGeometry(d, len) : new THREE.PlaneGeometry(len, d);
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)));
        g.translate(px, py, pz);
        this.batch.add(g, wall, m);
      }
      if (o.kind === 'window') {
        const k = o.variant ?? 0;
        const g = new THREE.PlaneGeometry(o.w, o.h);
        const u0 = (k % 4) / 4;
        const v1 = 1 - Math.floor(k / 4) / 2;
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v1 - 0.5 + uv.getY(i) * 0.5);
        g.translate(o.x, o.y + o.h / 2, -d);
        this.batch.add(g, this.windowAtlasMat(), m);
        if (opts.sills !== false) this.batch.add(new THREE.BoxGeometry(o.w + 0.2, 0.06, 0.24), this.mConcrete, mul(m, M4([o.x, o.y - 0.03, 0.06])));
      } else {
        const g = new THREE.PlaneGeometry(o.w, o.h);
        g.translate(o.x, o.y + o.h / 2, -d);
        this.batch.add(g, o.kind === 'shutter' ? this.shutterMat() : this.doorMat(), m);
        if (o.kind === 'shutter') this.batch.add(new THREE.BoxGeometry(o.w + 0.1, 0.32, 0.3), this.mMetal, mul(m, M4([o.x, o.y + o.h + 0.12, 0.05])));
      }
    }
  }

  private balcony(m: THREE.Matrix4, x: number, floorY: number, w: number, depth = 1.15, extras: 'chairs' | 'laundry' | 'plants' | 'mural' | 'none' = 'none'): void {
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, l: THREE.Matrix4) => this.batch.add(g, mat, mul(m, l));
    add(new THREE.BoxGeometry(w, 0.2, depth), this.mConcrete, M4([x, floorY - 0.1, depth / 2]));
    add(new THREE.BoxGeometry(w, 0.05, 0.05), this.mRail, M4([x, floorY + 1.02, depth - 0.03]));
    add(new THREE.BoxGeometry(0.05, 0.05, depth), this.mRail, M4([x - w / 2 + 0.03, floorY + 1.02, depth / 2]));
    add(new THREE.BoxGeometry(0.05, 0.05, depth), this.mRail, M4([x + w / 2 - 0.03, floorY + 1.02, depth / 2]));
    add(new THREE.BoxGeometry(w, 0.03, 0.03), this.mRail, M4([x, floorY + 0.1, depth - 0.03]));
    for (let k = -w / 2 + 0.06; k <= w / 2 - 0.05; k += 0.12) add(new THREE.BoxGeometry(0.016, 0.92, 0.016), this.mRail, M4([x + k, floorY + 0.56, depth - 0.03]));
    for (const sx of [-1, 1]) for (let k = 0.1; k < depth; k += 0.12) add(new THREE.BoxGeometry(0.016, 0.92, 0.016), this.mRail, M4([x + sx * (w / 2 - 0.03), floorY + 0.56, k]));
    const r = rng(Math.floor(x * 31 + floorY * 7 + 99));
    if (extras === 'plants')
      for (let i = 0; i < 2; i++) {
        const px = x - w / 2 + 0.4 + r() * (w - 0.8);
        add(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 12), this.potMat(), M4([px, floorY + 0.14, 0.35]));
        add(new THREE.SphereGeometry(0.26, 10, 8), this.leafMat(), M4([px, floorY + 0.48, 0.35], 0, [0, 0, 0], [1, 0.8, 1]));
      }
    if (extras === 'chairs') {
      for (const cx of [-0.5, 0.4]) {
        add(new THREE.BoxGeometry(0.42, 0.04, 0.42), this.mBlack, M4([x + cx, floorY + 0.45, 0.45]));
        add(new THREE.BoxGeometry(0.42, 0.45, 0.04), this.mBlack, M4([x + cx, floorY + 0.68, 0.24]));
        for (const lx of [-0.18, 0.18]) for (const lz of [0.27, 0.63]) add(new THREE.BoxGeometry(0.03, 0.45, 0.03), this.mBlack, M4([x + cx + lx, floorY + 0.22, lz]));
      }
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), this.mBlack, M4([x - 0.05, floorY + 0.62, 0.5]));
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), this.mBlack, M4([x - 0.05, floorY + 0.3, 0.5]));
    }
    if (extras === 'laundry') {
      const cloth = [0x8a8f96, 0xb5aa98, 0x5d6b7c, 0xd2cfc8];
      cloth.forEach((c, i) => {
        add(new THREE.PlaneGeometry(0.5, 0.62), this.clothMat(c), M4([x - w / 2 + 0.5 + i * 0.6, floorY + 0.74, depth + 0.02]));
      });
    }
    if (extras === 'mural') add(new THREE.PlaneGeometry(w * 0.7, 0.9), this.muralMat(), M4([x - w * 0.1, floorY + 0.55, depth + 0.02], 0, [0, 0, -0.03]));
  }

  private _pot?: THREE.MeshStandardMaterial;
  private potMat() {
    return (this._pot ??= new THREE.MeshStandardMaterial({ color: 0x8a4a2e, roughness: 0.8 }));
  }
  private _leaf?: THREE.MeshStandardMaterial;
  private leafMat() {
    return (this._leaf ??= new THREE.MeshStandardMaterial({ color: 0x3e6b3a, roughness: 0.85 }));
  }
  private clothMats = new Map<number, THREE.MeshStandardMaterial>();
  private clothMat(c: number) {
    let m = this.clothMats.get(c);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide });
      this.clothMats.set(c, m);
    }
    return m;
  }
  private _mural?: THREE.MeshStandardMaterial;
  private muralMat() {
    if (!this._mural) {
      const t = canvasTexture(512, 256, (g) => {
        g.fillStyle = '#d9d4c8';
        g.fillRect(0, 0, 512, 256);
        drawTags(g, 512, 256, 19);
        drawTags(g, 512, 256, 23);
      });
      this._mural = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
    }
    return this._mural;
  }

  private decal(m: THREE.Matrix4, x: number, y: number, w: number, h: number, seed: number): void {
    const t = canvasTexture(512, 256, (g) => {
      g.clearRect(0, 0, 512, 256);
      drawTags(g, 512, 256, seed);
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    );
    mesh.applyMatrix4(mul(m, M4([x, y, 0.025])));
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildBackWall(): void {
    const w = 2 * SIDE_X;
    const m = M4([0, 0, BACK_Z]);
    const r = rng(41);
    const cols = [-7.4, -3.6, 0, 3.6, 7.4];
    const holes: Hole[] = [];
    FLOORS.forEach((fy, fi) =>
      cols.forEach((cx) => {
        const french = (fi === 0 || fi === 2) && cx === 0;
        holes.push({ x: cx, y: fy + (french ? 0.0 : 0.85), w: french ? 1.2 : 1.15, h: french ? 2.4 : 1.7, kind: 'window', variant: Math.floor(r() * 8) });
      }),
    );
    this.facade(w, WALL_H - 3.5, holes, this.mBack, m, { y0: 3.5 });
    // ground floor: two roller shutters left/right of the stage wall
    const ground: Hole[] = [
      { x: -6.6, y: 0, w: 3.0, h: 2.7, kind: 'shutter' },
      { x: 6.6, y: 0, w: 3.0, h: 2.7, kind: 'shutter' },
    ];
    this.facade(w, 3.5, ground, this.mPlinth, m, { depth: 0.3 });
    // string course + floor bands + roof cornice
    this.batch.add(new THREE.BoxGeometry(w, 0.16, 0.26), this.mConcrete, M4([0, 3.5, BACK_Z + 0.1]));
    for (const fy of FLOORS.slice(1)) this.batch.add(new THREE.BoxGeometry(w, 0.08, 0.14), this.mConcrete, M4([0, fy - 0.15, BACK_Z + 0.05]));
    this.batch.add(new THREE.BoxGeometry(w + 0.6, 0.5, 0.7), this.mConcrete, M4([0, WALL_H - 0.25, BACK_Z + 0.3]));
    // balconies: hoop balcony (floor 1, centre) and the top one with chairs
    this.balcony(m, 0, FLOORS[0], 4.2, 1.25, 'plants');
    this.balcony(m, 0, FLOORS[2], 3.6, 1.1, 'chairs');
    this.hoop(BACK_Z + 1.3, FLOORS[0]);
    // purple LED bars and a spot bar under the hoop balcony
    const led = new THREE.MeshStandardMaterial({ color: 0x110818, emissive: new THREE.Color(0.75, 0.25, 1.0), emissiveIntensity: 3.0 });
    this.ledMats.push(led);
    for (const lx of [-1.0, 1.0]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.06), led);
      bar.position.set(lx * 1.05, FLOORS[0] - 0.24, BACK_Z + 1.05);
      this.group.add(bar);
    }
    this.batch.add(new THREE.BoxGeometry(4.0, 0.05, 0.05), this.mRail, M4([0, FLOORS[0] - 0.32, BACK_Z + 0.85]));
    this.parLens = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(1, 0.86, 0.68), emissiveIntensity: 5, roughness: 0.3 });
    this.ledMats.push(this.parLens);
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.9, 4, 24, 1, true);
    beamGeo.translate(0, -2, 0);
    [-1.6, -0.6, 0.6, 1.6].forEach((px, i) => {
      this.batch.add(new THREE.CylinderGeometry(0.11, 0.13, 0.26, 14), this.mBlack, M4([px, FLOORS[0] - 0.48, BACK_Z + 0.85], 0, [0.6, 0, 0]));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 16), this.parLens);
      lens.position.set(px, FLOORS[0] - 0.55, BACK_Z + 0.95);
      lens.lookAt(px, 0, BACK_Z + 4);
      this.group.add(lens);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(i % 3 ? 0xffe0c0 : 0xffc8f0) }, uIntensity: { value: 0.09 } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN,vV)),1.5); float a = pow(vY,1.8)*e*uIntensity; gl_FragColor = vec4(uColor*a, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(px, FLOORS[0] - 0.55, BACK_Z + 0.95);
      beam.rotation.set(0.62, 0, (i - 1.5) * 0.12);
      beam.renderOrder = 2;
      this.group.add(beam);
      this.beams.push({ mesh: beam, mat, phase: i * 1.7 });
    });
    // drain pipes
    for (const px of [-9.5, 9.5, -4.9, 4.9]) {
      this.batch.add(new THREE.CylinderGeometry(0.075, 0.075, WALL_H, 10), this.mMetal, M4([px, WALL_H / 2, BACK_Z + 0.17]));
      for (let k = 1; k < 6; k++) this.batch.add(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 10), this.mMetal, M4([px, k * 3, BACK_Z + 0.17]));
    }
    // logo + posters on the stage wall, a few tags
    this.logo(0, 2.2, BACK_Z + 0.03);
    this.poster(-3.95, 2.25, BACK_Z + 0.03, 'dancer');
    this.poster(3.95, 2.25, BACK_Z + 0.03, 'singer');
    this.decal(m, -2.0, 0.75, 1.4, 0.6, 31);
    this.decal(m, 1.9, 0.9, 1.6, 0.7, 37);
    this.decal(m, -8.6, 1.4, 1.8, 1.0, 43);
  }

  private hoop(z: number, floorY: number): void {
    const r = rng(8);
    const board = canvasTexture(256, 160, (g) => {
      g.fillStyle = '#f2f1ec';
      g.fillRect(0, 0, 256, 160);
      g.strokeStyle = '#c6382c';
      g.lineWidth = 6;
      g.strokeRect(6, 6, 244, 148);
      g.strokeRect(88, 70, 80, 64);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 40; i++) g.fillRect(r() * 256, r() * 160, 6, 2);
    });
    const b = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.95, 0.05, 2, 0.02), new THREE.MeshStandardMaterial({ map: board, roughness: 0.5 }));
    b.position.set(0, floorY + 1.15, z + 0.02);
    b.castShadow = true;
    this.group.add(b);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 8, 28), new THREE.MeshStandardMaterial({ color: 0xd2501e, metalness: 0.5, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, floorY + 0.78, z + 0.3);
    this.group.add(rim);
    const net = canvasTexture(64, 64, (g) => {
      g.clearRect(0, 0, 64, 64);
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 2;
      for (let i = -64; i < 64; i += 10) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 64, 64);
        g.stroke();
        g.beginPath();
        g.moveTo(i + 64, 0);
        g.lineTo(i, 64);
        g.stroke();
      }
    });
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.15, 0.36, 16, 1, true), new THREE.MeshStandardMaterial({ map: net, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
    n.position.set(0, floorY + 0.6, z + 0.3);
    this.group.add(n);
  }

  private logo(x: number, y: number, z: number): void {
    const t = canvasTexture(
      1024,
      640,
      (g) => {
        g.clearRect(0, 0, 1024, 640);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.save();
        g.translate(512, 120);
        g.rotate(-0.06);
        g.font = `italic 96px ${DISPLAY_FONT}`;
        g.lineWidth = 20;
        g.strokeStyle = '#141018';
        g.strokeText('RapBrawl', 0, 0);
        g.fillStyle = '#ff5fa8';
        g.fillText('RapBrawl', 0, 0);
        g.restore();
        g.font = `220px ${DISPLAY_FONT}`;
        g.lineWidth = 34;
        g.strokeStyle = '#141018';
        g.strokeText('BLOCK', 512, 300);
        g.lineWidth = 14;
        g.strokeStyle = '#2f6fff';
        g.strokeText('BLOCK', 512, 300);
        g.fillStyle = '#f5f2ec';
        g.fillText('BLOCK', 512, 300);
        g.font = `180px ${DISPLAY_FONT}`;
        g.lineWidth = 30;
        g.strokeStyle = '#141018';
        g.strokeText('BEATS', 512, 480);
        const grd = g.createLinearGradient(0, 410, 0, 560);
        grd.addColorStop(0, '#b56bff');
        grd.addColorStop(1, '#5a2bd6');
        g.fillStyle = grd;
        g.fillText('BEATS', 512, 480);
        g.fillStyle = '#5a2bd6';
        for (const dx of [-200, -40, 150]) g.fillRect(512 + dx, 545, 8, 40 + Math.abs(dx) / 5);
      },
      true,
    );
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.62),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private poster(x: number, y: number, z: number, kind: 'dancer' | 'singer'): void {
    const t = canvasTexture(
      400,
      560,
      (g) => {
        const grd = g.createLinearGradient(0, 0, 0, 560);
        grd.addColorStop(0, kind === 'dancer' ? '#f0e6d2' : '#3a1f5c');
        grd.addColorStop(1, kind === 'dancer' ? '#c9b9a0' : '#e0559a');
        g.fillStyle = grd;
        g.fillRect(0, 0, 400, 560);
        g.fillStyle = kind === 'dancer' ? '#141414' : 'rgba(15,10,25,0.9)';
        if (kind === 'dancer') {
          g.beginPath();
          g.arc(140, 300, 34, 0, Math.PI * 2);
          g.fill();
          g.save();
          g.translate(200, 250);
          g.rotate(-0.5);
          g.fillRect(-30, -90, 70, 150);
          g.restore();
          g.lineWidth = 26;
          g.lineCap = 'round';
          g.strokeStyle = '#141414';
          g.beginPath();
          g.moveTo(230, 170);
          g.lineTo(300, 80);
          g.lineTo(340, 120);
          g.moveTo(240, 190);
          g.lineTo(320, 200);
          g.moveTo(170, 330);
          g.lineTo(150, 420);
          g.moveTo(190, 300);
          g.lineTo(260, 360);
          g.stroke();
        } else {
          g.beginPath();
          g.arc(200, 190, 60, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.moveTo(90, 560);
          g.quadraticCurveTo(110, 280, 200, 260);
          g.quadraticCurveTo(290, 280, 310, 560);
          g.fill();
          g.fillRect(250, 200, 18, 70);
        }
        g.textAlign = 'center';
        g.font = `64px ${DISPLAY_FONT}`;
        g.lineWidth = 10;
        g.strokeStyle = '#141018';
        g.strokeText('BLOCK', 200, 470);
        g.fillStyle = kind === 'dancer' ? '#e8364f' : '#ffffff';
        g.fillText('BLOCK', 200, 470);
        g.strokeText('BEATS', 200, 530);
        g.fillStyle = kind === 'dancer' ? '#2f6fe8' : '#ffc533';
        g.fillText('BEATS', 200, 530);
        g.globalCompositeOperation = 'destination-out';
        const r = rng(kind === 'dancer' ? 3 : 4);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = `rgba(0,0,0,${r() * 0.7})`;
          g.fillRect(r() * 400, r() < 0.5 ? r() * 24 : 536 + r() * 24, 5 + r() * 12, 2 + r() * 8);
        }
        g.globalCompositeOperation = 'source-over';
      },
      true,
    );
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 1.75),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildSideWings(): void {
    const len = FRONT_Z - BACK_Z;
    const zmid = (FRONT_Z + BACK_Z) / 2;
    const r = rng(77);
    // local x runs toward the back for the left wing (rotY +90°), toward the front for the right wing (-90°)
    const lx = (z: number, side: number) => (side < 0 ? -(z - zmid) : z - zmid);
    for (const side of [-1, 1]) {
      const m = M4([side * SIDE_X, 0, zmid], side < 0 ? Math.PI / 2 : -Math.PI / 2);
      const wall = side < 0 ? this.mLeft : this.mRight;
      const holes: Hole[] = [];
      for (const fy of FLOORS) for (const z of [-5.6, -2.0, 1.6, 5.2]) holes.push({ x: lx(z, side), y: fy + 0.85, w: 1.15, h: 1.7, kind: 'window', variant: Math.floor(r() * 8) });
      this.facade(len, WALL_H - 3.5, holes, wall, m, { y0: 3.5 });
      const ground: Hole[] = [
        { x: lx(-5.4, side), y: 0, w: 2.8, h: 2.6, kind: 'shutter' },
        { x: lx(-1.6, side), y: 0, w: 2.8, h: 2.6, kind: 'shutter' },
        { x: lx(2.4, side), y: 0, w: 1.1, h: 2.3, kind: 'door' },
      ];
      this.facade(len, 3.5, ground, this.mPlinth, m, { depth: 0.3 });
      this.batch.add(new THREE.BoxGeometry(len, 0.16, 0.26), this.mConcrete, mul(m, M4([0, 3.5, 0.1])));
      this.batch.add(new THREE.BoxGeometry(len + 0.6, 0.5, 0.7), this.mConcrete, mul(m, M4([0, WALL_H - 0.25, 0.3])));
      this.balcony(m, lx(-5.6, side), FLOORS[0], 2.6, 1.15, side < 0 ? 'plants' : 'mural');
      this.balcony(m, lx(-5.6, side), FLOORS[1], 2.6, 1.15, side < 0 ? 'laundry' : 'plants');
      this.balcony(m, lx(-2.0, side), FLOORS[2], 2.6, 1.15, 'none');
      this.decal(m, lx(-5.4, side), 1.1, 2.6, 1.3, side < 0 ? 51 : 57);
      this.decal(m, lx(-1.6, side), 1.0, 2.4, 1.1, side < 0 ? 53 : 59);
      this.decal(m, lx(4.6, side), 1.4, 2.4, 1.2, side < 0 ? 61 : 67);
    }
    // left wing: AC unit + electrical box near the back corner
    this.batch.add(new RoundedBoxGeometry(0.4, 0.75, 0.95, 2, 0.04), this.mWhite, M4([-SIDE_X + 0.2, 3.1, -4.0]));
    this.batch.add(new RoundedBoxGeometry(0.25, 1.0, 0.7, 2, 0.03), this.mWhite, M4([-SIDE_X + 0.13, 1.6, -7.2]));
  }

  // ------------------------------------------------------------ stage
  private buildStage(): void {
    const z = -6.9;
    const deck = pbr(withRepeat(wood(3), 1 / 1.4, 1 / 1.4), { color: 0x5a5056 });
    this.casters.add(deck);
    this.batch.add(new THREE.BoxGeometry(6.6, 0.06, 2.4), deck, M4([0, 0.3, z]));
    this.batch.add(new THREE.BoxGeometry(6.6, 0.28, 2.3), this.mBlack, M4([0, 0.14, z]));
    // speakers: two woofer cabinets per side + a top
    const woofer = this.wooferMat();
    for (const sx of [-2.75, 2.75]) {
      for (let k = 0; k < 2; k++) {
        const y = 0.33 + 0.48 + k * 0.97;
        this.batch.add(new RoundedBoxGeometry(0.85, 0.95, 0.7, 2, 0.02), this.mCab, M4([sx, y, z + 0.1]));
        this.batch.add(new THREE.PlaneGeometry(0.8, 0.9), woofer, M4([sx, y, z + 0.452]));
      }
      this.batch.add(new RoundedBoxGeometry(0.7, 0.5, 0.55, 2, 0.02), this.mCab, M4([sx, 0.33 + 1.94 + 0.25, z + 0.1]));
      this.batch.add(new THREE.PlaneGeometry(0.62, 0.42), woofer, M4([sx, 0.33 + 1.94 + 0.25, z + 0.378]));
    }
    // DJ: folding table, controller, laptop, stool
    this.batch.add(new THREE.BoxGeometry(1.5, 0.04, 0.7), this.mWhite, M4([0, 1.08, z + 0.15]));
    for (const lx of [-0.68, 0.68]) for (const lz of [-0.18, 0.48]) this.batch.add(new THREE.CylinderGeometry(0.018, 0.018, 0.76, 6), this.mSteel, M4([lx, 0.7, z + lz]));
    this.batch.add(new RoundedBoxGeometry(0.85, 0.07, 0.42, 2, 0.02), this.mBlack, M4([0, 1.135, z + 0.18]));
    for (const dx of [-0.25, 0.25]) this.batch.add(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 24), this.mSteel, M4([dx, 1.18, z + 0.18]));
    this.batch.add(new THREE.BoxGeometry(0.36, 0.01, 0.25), this.mSteel, M4([0, 1.12, z - 0.08]));
    this.batch.add(new THREE.BoxGeometry(0.36, 0.24, 0.01), this.mBlack, M4([0, 1.24, z - 0.2], 0, [-0.25, 0, 0]));
    this.batch.add(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), this.mBlack, M4([0.1, 0.95, z - 0.55]));
    for (let k = 0; k < 3; k++) this.batch.add(new THREE.CylinderGeometry(0.015, 0.015, 0.65, 6), this.mSteel, M4([0.1 + Math.cos(k * 2.1) * 0.12, 0.62, z - 0.55 + Math.sin(k * 2.1) * 0.12]));
  }

  private _woofer?: THREE.MeshStandardMaterial;
  private wooferMat(): THREE.MeshStandardMaterial {
    if (!this._woofer) {
      const t = canvasTexture(256, 288, (g) => {
        g.fillStyle = '#141416';
        g.fillRect(0, 0, 256, 288);
        const cx = 128;
        const cy = 144;
        const r = 104;
        g.fillStyle = '#0b0b0c';
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        const grd = g.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r * 0.88);
        grd.addColorStop(0, '#3a3a3e');
        grd.addColorStop(0.35, '#1c1c1f');
        grd.addColorStop(1, '#0e0e10');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#2c2c30';
        g.lineWidth = r * 0.08;
        g.beginPath();
        g.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
        g.stroke();
        const cap = g.createRadialGradient(cx - r * 0.06, cy - r * 0.06, 1, cx, cy, r * 0.22);
        cap.addColorStop(0, '#6a6a70');
        cap.addColorStop(1, '#1a1a1c');
        g.fillStyle = cap;
        g.beginPath();
        g.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#55555a';
        for (const [bx, by] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          g.beginPath();
          g.arc(cx + bx * r * 0.95, cy + by * r * 0.95, 4, 0, Math.PI * 2);
          g.fill();
        }
      });
      this._woofer = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
    }
    return this._woofer;
  }

  // ------------------------------------------------------------ props
  private buildProps(): void {
    const crate = (c: string, dark: string) => {
      const t = canvasTexture(256, 160, (g) => {
        g.fillStyle = c;
        g.fillRect(0, 0, 256, 160);
        g.fillStyle = dark;
        for (let i = 0; i < 6; i++) g.fillRect(14 + i * 40, 26, 28, 76);
        g.fillRect(0, 140, 256, 20);
      });
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
      this.casters.add(m);
      return m;
    };
    const red = crate('#b8332c', '#7c201b');
    const green = crate('#2f7a3a', '#1d5025');
    const orange = crate('#d4782a', '#97511a');
    const stack = (x: number, z: number, mats: THREE.Material[], rot = 0) =>
      mats.forEach((mt, k) => this.batch.add(new THREE.BoxGeometry(0.42, 0.3, 0.32), mt, M4([x, 0.15 + k * 0.305, z], rot + (k % 2) * 0.05)));
    stack(-4.1, -6.4, [orange, green, red]);
    stack(-4.6, -6.2, [orange, red], 0.2);
    stack(4.1, -6.4, [red, orange, red]);
    stack(4.55, -6.0, [orange], 0.3);
    stack(-3.75, -5.9, [orange]);
    const bin = (x: number, z: number, body: number, lid: number, rot = 0) => {
      const bm = this.solid(body, 0.5);
      const lm = this.solid(lid, 0.45);
      this.batch.add(new RoundedBoxGeometry(0.62, 0.95, 0.68, 2, 0.05), bm, M4([x, 0.55, z], rot));
      this.batch.add(new RoundedBoxGeometry(0.66, 0.06, 0.74, 2, 0.02), lm, M4([x, 1.05, z], rot));
      for (const wx of [-0.24, 0.24]) this.batch.add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), this.mBlack, M4([x + wx, 0.09, z - 0.3], rot, [0, 0, Math.PI / 2]));
    };
    bin(-1.65, -6.3, 0x1e1f22, 0x1e1f22);
    bin(1.65, -6.3, 0x8c1f2a, 0x8c1f2a);
    bin(7.0, -7.2, 0x2a5fc0, 0x2a5fc0);
    bin(7.8, -7.0, 0x2d7a3a, 0xd9c21e, -0.1);
    bin(8.7, -6.6, 0x2d7a3a, 0x2d7a3a, 0.2);
    this.scooter(-6.4, -6.6);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), this.solid(0xb5531f, 0.6));
    ball.position.set(-7.3, 0.12, -5.6);
    ball.castShadow = true;
    this.group.add(ball);
  }

  private solidMats = new Map<string, THREE.MeshStandardMaterial>();
  private solid(color: number, rough: number, metal = 0): THREE.MeshStandardMaterial {
    const key = `${color}/${rough}/${metal}`;
    let m = this.solidMats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      this.casters.add(m);
      this.solidMats.set(key, m);
    }
    return m;
  }

  private scooter(x: number, z: number): void {
    const body = this.solid(0xb53a46, 0.35, 0.25);
    const base = M4([x, 0, z], 0.35);
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, l: THREE.Matrix4) => this.batch.add(g, mat, mul(base, l));
    add(new RoundedBoxGeometry(1.0, 0.36, 0.42, 3, 0.15), body, M4([-0.15, 0.45, 0]));
    add(new RoundedBoxGeometry(0.62, 0.12, 0.34, 2, 0.05), this.mBlack, M4([-0.25, 0.68, 0]));
    add(new RoundedBoxGeometry(0.2, 0.75, 0.4, 3, 0.08), body, M4([0.48, 0.62, 0], 0, [0, 0, -0.2]));
    add(new THREE.BoxGeometry(0.4, 0.06, 0.32), body, M4([0.25, 0.26, 0]));
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8), this.mSteel, M4([0.6, 1.05, 0], 0, [Math.PI / 2, 0, 0]));
    add(new THREE.SphereGeometry(0.07, 10, 8), this.mWhite, M4([0.62, 0.95, 0]));
    for (const wx of [-0.55, 0.6]) {
      add(new THREE.TorusGeometry(0.17, 0.07, 10, 20), this.mBlack, M4([wx, 0.24, 0]));
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 14), this.mSteel, M4([wx, 0.24, 0], 0, [Math.PI / 2, 0, 0]));
    }
  }

  private buildFencesAndBarriers(): void {
    const meshTex = canvasTexture(128, 128, (g) => {
      g.clearRect(0, 0, 128, 128);
      g.strokeStyle = '#c9ccd2';
      g.lineWidth = 5;
      for (let i = -128; i < 256; i += 32) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 128, 128);
        g.stroke();
        g.beginPath();
        g.moveTo(i + 128, 0);
        g.lineTo(i, 128);
        g.stroke();
      }
    });
    meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
    const fenceLen = 9.0;
    meshTex.repeat.set(fenceLen / 0.25, 1.9 / 0.25);
    const fm = new THREE.MeshStandardMaterial({ map: meshTex, alphaTest: 0.45, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const fx = side * (SIDE_X - 1.3);
      const fz0 = -4.3;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(fenceLen, 1.9), fm);
      plane.position.set(fx, 0.98, fz0 + fenceLen / 2);
      plane.rotation.y = Math.PI / 2;
      plane.castShadow = true;
      this.group.add(plane);
      for (let k = 0; k <= 3; k++) this.batch.add(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), this.mSteel, M4([fx, 1.0, fz0 + (k * fenceLen) / 3]));
      this.batch.add(new THREE.CylinderGeometry(0.02, 0.02, fenceLen, 8), this.mSteel, M4([fx, 1.95, fz0 + fenceLen / 2], 0, [Math.PI / 2, 0, 0]));
    }
    for (const [x, z, ry] of [
      [-8.0, -2.9, 0.15],
      [-7.6, 0.2, 0.35],
      [-7.9, 3.2, 0.1],
      [8.0, -2.9, -0.15],
      [7.6, 0.2, -0.35],
      [7.9, 3.2, -0.1],
    ]) {
      const base = M4([x, 0, z], ry + Math.PI / 2);
      const add = (g: THREE.BufferGeometry, l: THREE.Matrix4) => this.batch.add(g, this.mSteel, mul(base, l));
      for (const yy of [0.2, 1.08]) add(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 8), M4([0, yy, 0], 0, [0, 0, Math.PI / 2]));
      for (let k = -1.0; k <= 1.0001; k += 0.1) add(new THREE.CylinderGeometry(0.01, 0.01, 0.88, 6), M4([k, 0.64, 0]));
      for (const fx of [-1.08, 1.08]) {
        add(new THREE.CylinderGeometry(0.022, 0.022, 1.12, 8), M4([fx, 0.56, 0]));
        add(new THREE.BoxGeometry(0.05, 0.03, 0.75), M4([fx, 0.015, 0]));
      }
    }
  }

  private buildCables(): void {
    const cable = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
      const n = 18;
      let prev = a.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * sag;
        const len = prev.distanceTo(p);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize());
        this.batch.add(new THREE.CylinderGeometry(0.012, 0.012, len, 4), this.mBlack, new THREE.Matrix4().compose(prev.clone().lerp(p, 0.5), q, new THREE.Vector3(1, 1, 1)));
        prev = p;
      }
    };
    cable(new THREE.Vector3(-SIDE_X + 0.1, 4.4, -7.5), new THREE.Vector3(-2.2, 3.2, BACK_Z + 0.1), 0.5);
    cable(new THREE.Vector3(SIDE_X - 0.1, 4.6, -7.0), new THREE.Vector3(2.2, 3.2, BACK_Z + 0.1), 0.6);
    cable(new THREE.Vector3(-SIDE_X + 0.1, 3.4, -6.0), new THREE.Vector3(-SIDE_X + 0.1, 3.3, 2.0), 0.25);
    cable(new THREE.Vector3(SIDE_X - 0.1, 3.5, -6.5), new THREE.Vector3(SIDE_X - 0.1, 3.4, 1.0), 0.3);
    cable(new THREE.Vector3(-9.6, 3.35, BACK_Z + 0.08), new THREE.Vector3(9.6, 3.35, BACK_Z + 0.08), 0.15);
  }

  // ------------------------------------------------------------ runtime
  update(time: number, beat: number): void {
    this.flash *= 0.9;
    const k = 1 - this.dim * 0.75;
    for (const m of this.ledMats) {
      if (m === this.parLens) {
        m.emissiveIntensity = (4.5 + beat * 1.5 + this.flash * 3) * k;
        continue;
      }
      const hue = 0.78 + Math.sin(time * (0.3 + this.hype * 0.5)) * 0.03;
      m.emissive.setHSL(hue, 0.9, 0.55);
      m.emissiveIntensity = (2.6 + beat * 0.8 + this.flash * 2) * k;
    }
    if (this.atlasMat) this.atlasMat.emissiveIntensity = 0.85 * (1 - this.dim * 0.4);
    for (const b of this.beams) {
      b.mesh.rotation.z = Math.sin(time * 0.45 + b.phase) * 0.12;
      b.mat.uniforms.uIntensity.value = (0.07 + beat * 0.05 + this.flash * 0.2 + this.hype * 0.04) * (1 - this.dim * 0.85);
    }
  }

  setDim(d: number): void {
    this.dim = d;
    for (const l of this.lights) l.intensity = (l.userData.base as number) * (1 - d * 0.72);
    (this.sceneRef as THREE.Scene & { environmentIntensity: number }).environmentIntensity = this.envBase * (1 - d * 0.7);
    this.skyMat.color.setScalar(1 - d * 0.7);
    if (this.reflector) (this.reflector.material as THREE.ShaderMaterial).uniforms.uStrength.value = 0.55 * (1 - d * 0.6);
  }

  pulse(amount = 1): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  setHype(h: number): void {
    this.hype = h;
  }
}
