// "HINTERHOF – BLOCK BEATS", realistic version: Berlin Altbau backyard at dusk with a block-party
// stage. PBR materials from procedural textures (render/textures.ts), real shadows, dusk sky as
// image-based lighting, emissive windows/bulbs for bloom. Original designs only (no logos).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { asphalt, brick, concrete, drawTags, grille, plaster, shutter, windowAtlas, withRepeat, wood, type PBRSet } from '../textures';
import type { ArenaLike } from './hinterhof';

const DISPLAY_FONT = "'Lilita One', 'Arial Black', Impact, sans-serif";

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count * 2) | 0), 2));
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
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1] + rotY, rot[2]));
  return m.compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...scale));
};

export class CourtyardArena implements ArenaLike {
  readonly group = new THREE.Group();
  private lights: THREE.Light[] = [];
  private batch = new Batch();
  private casters = new Set<THREE.Material>();
  private bulbMat!: THREE.MeshStandardMaterial;
  private ledMats: THREE.MeshStandardMaterial[] = [];
  private beams: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; phase: number }[] = [];
  private parLenses!: THREE.MeshStandardMaterial;
  private dim = 0;
  private flash = 0;
  private hype = 0;
  private envBase = 0.55;
  private sceneRef: THREE.Scene;
  private skyMat!: THREE.MeshBasicMaterial;
  private bannerMat!: THREE.MeshStandardMaterial;

  // materials
  private mPlaster = pbr(withRepeat(plaster([0.86, 0.76, 0.6], 3), 1 / 4, 1 / 4));
  private mPlinth = pbr(withRepeat(plaster([0.55, 0.5, 0.46], 9), 1 / 3, 1 / 3));
  private mBrick = pbr(withRepeat(brick(4), 1 / 2, 1 / 1));
  private mBrick2 = pbr(withRepeat(brick(8, [[0.62, 0.42, 0.3], [0.7, 0.5, 0.36], [0.55, 0.36, 0.26], [0.66, 0.46, 0.34]]), 1 / 2, 1 / 1));
  private mConcrete = pbr(withRepeat(concrete(2), 1, 1));
  private mMetal = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.45, metalness: 0.8 });
  private mAlu = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.3, metalness: 0.9 });
  private mBlack = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.75, metalness: 0.05 });
  private mFabric = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.95 });

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.sceneRef = scene;
    scene.background = new THREE.Color(0x2a2340);
    scene.fog = new THREE.Fog(0x4b3a52, 30, 70);
    scene.add(this.group);
    for (const m of [this.mPlaster, this.mPlinth, this.mBrick, this.mBrick2, this.mConcrete, this.mMetal, this.mAlu, this.mBlack]) this.casters.add(m);
    this.buildSky(renderer);
    this.buildLights();
    this.buildGround();
    this.buildBackFacade();
    this.buildWings();
    this.buildStage();
    this.buildProps();
    this.buildStringLights();
    this.batch.build(this.group, this.casters);
  }

  // ------------------------------------------------------------ sky + environment
  private buildSky(renderer?: THREE.WebGLRenderer): void {
    const tex = canvasTexture(1024, 512, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, '#1d2350');
      grd.addColorStop(0.35, '#4a3f7a');
      grd.addColorStop(0.62, '#c46a6a');
      grd.addColorStop(0.78, '#f2a15f');
      grd.addColorStop(1, '#ffd29a');
      g.fillStyle = grd;
      g.fillRect(0, 0, 1024, 512);
      // soft clouds
      const r = rng(17);
      for (let i = 0; i < 70; i++) {
        const x = r() * 1024;
        const y = 120 + r() * 230;
        const w = 60 + r() * 220;
        const h = 8 + r() * 22;
        const cg = g.createRadialGradient(x, y, 0, x, y, w * 0.5);
        cg.addColorStop(0, `rgba(255,${170 + r() * 60},${150 + r() * 60},${0.12 + r() * 0.18})`);
        cg.addColorStop(1, 'rgba(255,200,180,0)');
        g.fillStyle = cg;
        g.save();
        g.translate(x, y);
        g.scale(1, h / w);
        g.translate(-x, -y);
        g.beginPath();
        g.arc(x, y, w * 0.5, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
        g.fillRect(r() * 1024, r() * 140, 1.5, 1.5);
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
      // warm sun patch low on the horizon
      const sun = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.6) }));
      sun.position.set(6, 0.6, -7);
      envScene.add(sun);
      this.sceneRef.environment = pm.fromScene(envScene, 0.02).texture;
      (this.sceneRef as THREE.Scene & { environmentIntensity: number }).environmentIntensity = this.envBase;
      pm.dispose();
    }
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xa9bfff, 0x4a3a30, 0.7);
    const key = new THREE.DirectionalLight(0xffe6cc, 2.3);
    key.position.set(-6, 12, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 10;
    sc.bottom = -6;
    sc.near = 1;
    sc.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.025;
    key.target.position.set(0, 0, -3);
    this.group.add(key.target);
    const rim = new THREE.DirectionalLight(0xff9a55, 1.7);
    rim.position.set(9, 6, -12);
    const fill = new THREE.DirectionalLight(0x8fa8ff, 0.35);
    fill.position.set(6, 3, 10);
    const warmA = new THREE.PointLight(0xffb866, 9, 11, 2);
    warmA.position.set(-4.5, 5.6, -3.2);
    const warmB = new THREE.PointLight(0xffb866, 9, 11, 2);
    warmB.position.set(4.5, 5.6, -3.2);
    const stageL = new THREE.SpotLight(0xff3fbf, 40, 16, 0.5, 0.6, 2);
    stageL.position.set(-3.4, 4.8, -6.4);
    stageL.target.position.set(-1.2, 0, -1);
    const stageR = new THREE.SpotLight(0x3fb8ff, 40, 16, 0.5, 0.6, 2);
    stageR.position.set(3.4, 4.8, -6.4);
    stageR.target.position.set(1.2, 0, -1);
    this.group.add(stageL.target, stageR.target);
    for (const l of [hemi, key, rim, fill, warmA, warmB, stageL, stageR]) {
      this.group.add(l);
      this.lights.push(l);
      l.userData.base = l.intensity;
    }
  }

  setShadowQuality(size: number): void {
    for (const l of this.lights) if (l instanceof THREE.DirectionalLight && l.castShadow) l.shadow.mapSize.set(size, size);
  }

  // ------------------------------------------------------------ ground
  private buildGround(): void {
    const mat = pbr(withRepeat(asphalt(), 15, 11), { envMapIntensity: 0.6 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 44), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 6);
    ground.receiveShadow = true;
    this.group.add(ground);
    // worn court paint as a decal
    const lines = canvasTexture(2048, 1024, (g) => {
      g.clearRect(0, 0, 2048, 1024);
      g.strokeStyle = 'rgba(236,232,220,0.9)';
      g.lineWidth = 12;
      g.strokeRect(124, 96, 1800, 832);
      g.beginPath();
      g.moveTo(1024, 96);
      g.lineTo(1024, 928);
      g.stroke();
      g.beginPath();
      g.arc(1024, 512, 150, 0, Math.PI * 2);
      g.stroke();
      for (const sx of [124, 1924]) {
        g.beginPath();
        g.arc(sx, 512, 420, sx < 1000 ? -Math.PI / 2 : Math.PI / 2, sx < 1000 ? Math.PI / 2 : (Math.PI * 3) / 2);
        g.stroke();
      }
      // wear: erase with noise
      g.globalCompositeOperation = 'destination-out';
      const r = rng(5);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`;
        g.fillRect(r() * 2048, r() * 1024, 2 + r() * 14, 2 + r() * 6);
      }
      g.globalCompositeOperation = 'source-over';
    });
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 10),
      new THREE.MeshStandardMaterial({ map: lines, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, 0.003, -0.6);
    decal.receiveShadow = true;
    this.group.add(decal);
    // puddles: dark mirror-ish patches
    const puddle = new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.7, envMapIntensity: 1.6, depthWrite: false });
    const r = rng(23);
    for (const [x, z, s] of [
      [-4.2, 2.3, 1.3],
      [5.6, -0.4, 1.0],
      [1.2, -4.0, 1.5],
      [-7.6, -3.5, 0.9],
    ]) {
      const shape = new THREE.Shape();
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rad = s * (0.75 + r() * 0.35);
        const px = Math.cos(a) * rad * 1.6;
        const py = Math.sin(a) * rad * 0.7;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      const p = new THREE.Mesh(new THREE.ShapeGeometry(shape), puddle);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.005, z);
      this.group.add(p);
    }
    // manhole covers
    const manhole = canvasTexture(256, 256, (g) => {
      g.fillStyle = '#2a2a2e';
      g.beginPath();
      g.arc(128, 128, 126, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#3c3c42';
      g.lineWidth = 8;
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(128, 128, 30 + k * 20, 0, Math.PI * 2);
        g.stroke();
      }
      for (let k = 0; k < 12; k++) {
        g.save();
        g.translate(128, 128);
        g.rotate((k / 12) * Math.PI * 2);
        g.fillRect(-3, 30, 6, 96);
        g.restore();
      }
    });
    const mh = new THREE.MeshStandardMaterial({ map: manhole, metalness: 0.6, roughness: 0.5, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const [x, z] of [
      [-6.2, 1.6],
      [6.8, 2.2],
    ]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), mh);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // ------------------------------------------------------------ facades
  /** Wall with window openings: ShapeGeometry (UVs in metres) + reveals + glass + sills. */
  private facade(opts: {
    width: number;
    height: number;
    holes: (Rect & { kind: 'window' | 'shutter' | 'door'; variant?: number })[];
    wall: THREE.Material;
    m: THREE.Matrix4;
    depth?: number;
    sills?: boolean;
  }): void {
    const { width: w, height: h, holes, wall, m } = opts;
    const depth = opts.depth ?? 0.24;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h);
    shape.lineTo(-w / 2, h);
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
    const atlas = this.windowAtlasMats();
    for (const o of holes) {
      // reveals (inner faces of the opening)
      const sides: [number, number, number, number, number, number][] = [
        // [px, py, pz, rx, ry, len] plane depth x len
        [o.x - o.w / 2, o.y + o.h / 2, -depth / 2, 0, Math.PI / 2, o.h],
        [o.x + o.w / 2, o.y + o.h / 2, -depth / 2, 0, -Math.PI / 2, o.h],
        [o.x, o.y + o.h, -depth / 2, Math.PI / 2, 0, o.w],
        [o.x, o.y, -depth / 2, -Math.PI / 2, 0, o.w],
      ];
      for (const [px, py, pz, rx, ry, len] of sides) {
        const g = ry !== 0 ? new THREE.PlaneGeometry(depth, len) : new THREE.PlaneGeometry(len, depth);
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)));
        g.translate(px, py, pz);
        this.batch.add(g, wall, m);
      }
      if (o.kind === 'window') {
        const k = o.variant ?? 0;
        const g = new THREE.PlaneGeometry(o.w, o.h);
        const u0 = (k % 4) / 4;
        const v1 = 1 - Math.floor(k / 4) / 2;
        const v0 = v1 - 0.5;
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.5);
        g.translate(o.x, o.y + o.h / 2, -depth);
        this.batch.add(g, atlas, m);
        if (opts.sills !== false) {
          this.batch.add(new THREE.BoxGeometry(o.w + 0.24, 0.07, 0.26), this.mConcrete, new THREE.Matrix4().multiplyMatrices(m, M4([o.x, o.y - 0.035, 0.08])));
          // ornamental lintel
          this.batch.add(new THREE.BoxGeometry(o.w + 0.4, 0.16, 0.12), this.mConcrete, new THREE.Matrix4().multiplyMatrices(m, M4([o.x, o.y + o.h + 0.16, 0.05])));
          this.batch.add(new THREE.BoxGeometry(o.w + 0.2, 0.06, 0.08), this.mConcrete, new THREE.Matrix4().multiplyMatrices(m, M4([o.x, o.y + o.h + 0.28, 0.08])));
        }
      } else {
        const sh = o.kind === 'shutter' ? this.shutterMat() : this.doorMat();
        const g = new THREE.PlaneGeometry(o.w, o.h);
        g.translate(o.x, o.y + o.h / 2, -depth * 0.6);
        this.batch.add(g, sh, m);
      }
    }
  }

  private _atlas: THREE.MeshStandardMaterial | null = null;
  private windowAtlasMats(): THREE.MeshStandardMaterial {
    if (!this._atlas) {
      const a = windowAtlas();
      this._atlas = new THREE.MeshStandardMaterial({
        map: a.map,
        emissiveMap: a.emissive,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: 1.25,
        roughness: 0.12,
        metalness: 0.1,
        envMapIntensity: 1.2,
      });
      this.ledMats.push(this._atlas);
      this._atlas.userData.baseEmissive = 1.25;
    }
    return this._atlas;
  }

  private _shutter: THREE.MeshStandardMaterial | null = null;
  private shutterMat(): THREE.MeshStandardMaterial {
    if (!this._shutter) {
      const s = shutter(5);
      this._shutter = pbr(s, { metalness: 0.55 });
      for (const t of [s.map, s.normalMap, s.roughnessMap]) t.repeat.set(1 / 3.4, 1 / 3);
    }
    return this._shutter;
  }

  private _door: THREE.MeshStandardMaterial | null = null;
  private doorMat(): THREE.MeshStandardMaterial {
    if (!this._door) {
      const s = withRepeat(wood(12), 1 / 1.4, 1 / 2.4);
      this._door = pbr(s, { color: 0x6b4a8a });
    }
    return this._door;
  }

  private buildBackFacade(): void {
    const W = 32;
    const H = 17.5;
    const z = -9.2;
    const m = M4([0, 0, z]);
    const holes: (Rect & { kind: 'window' | 'shutter' | 'door'; variant?: number })[] = [];
    const floors = [4.1, 7.3, 10.5, 13.7];
    const cols = [-13.2, -10, -6.8, -3.4, 0, 3.4, 6.8, 10, 13.2];
    const r = rng(41);
    floors.forEach((fy, fi) =>
      cols.forEach((cx) => {
        const french = fi < 2 && (cx === -10 || cx === 10 || (fi === 1 && Math.abs(cx) === 3.4));
        holes.push({ x: cx, y: fy + (french ? 0.05 : 0.85), w: french ? 1.3 : 1.25, h: french ? 2.6 : 1.85, kind: 'window', variant: Math.floor(r() * 8) });
      }),
    );
    // upper facade in plaster
    const upper = holes.filter((o) => o.y >= 4);
    const upperShape = { width: W, height: H - 3.9, holes: upper.map((o) => ({ ...o, y: o.y - 3.9 })), wall: this.mPlaster, m: M4([0, 3.9, z]) };
    this.facade(upperShape);
    // ground floor plinth: shutters, door, small barred windows
    const ground: (Rect & { kind: 'window' | 'shutter' | 'door'; variant?: number })[] = [
      { x: -11.4, y: 0, w: 3.4, h: 3.0, kind: 'shutter' },
      { x: 11.4, y: 0, w: 3.4, h: 3.0, kind: 'shutter' },
      { x: -6.6, y: 0, w: 1.4, h: 2.5, kind: 'door' },
      { x: 6.6, y: 1.2, w: 1.3, h: 1.5, kind: 'window', variant: 2 },
    ];
    this.facade({ width: W, height: 3.9, holes: ground, wall: this.mPlinth, m, depth: 0.3 });
    // cornices / string courses
    for (const fy of [3.9, 7.1, 10.3, 13.5]) {
      this.batch.add(new THREE.BoxGeometry(W, 0.18, 0.32), this.mConcrete, M4([0, fy, z + 0.12]));
      this.batch.add(new THREE.BoxGeometry(W, 0.08, 0.42), this.mConcrete, M4([0, fy + 0.12, z + 0.16]));
    }
    this.batch.add(new THREE.BoxGeometry(W + 0.4, 0.5, 0.7), this.mConcrete, M4([0, H - 0.25, z + 0.3]));
    // balconies with railings
    for (const [bx, fy] of [
      [-10, 4.1],
      [10, 4.1],
      [-3.4, 7.3],
      [3.4, 7.3],
      [0, 10.5],
    ]) this.balcony(bx, fy, z);
    // drain pipes
    for (const px of [-15.4, 15.4, -1.7]) {
      this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, H, 10), this.mMetal, M4([px, H / 2, z + 0.16]));
      for (let k = 1; k < 6; k++) this.batch.add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), this.mMetal, M4([px, k * 3, z + 0.16]));
    }
    // satellite dish + AC unit
    this.batch.add(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, 0.9), this.mAlu, M4([12.1, 11.9, z + 0.45], 0, [Math.PI / 2 - 0.3, 0, 0]));
    this.batch.add(new RoundedBoxGeometry(0.9, 0.6, 0.35, 2, 0.04), this.mAlu, M4([-5.2, 8.2, z + 0.2]));
    // graffiti on the plinth
    this.decal(-4.4, 1.3, z + 0.02, 3.2, 1.4, 31);
    this.decal(8.6, 1.1, z + 0.02, 2.6, 1.2, 37);
  }

  private balcony(x: number, floorY: number, z: number): void {
    const w = 2.6;
    this.batch.add(new THREE.BoxGeometry(w, 0.18, 1.1), this.mConcrete, M4([x, floorY - 0.09, z + 0.55]));
    // railing: top rail + balusters
    this.batch.add(new THREE.BoxGeometry(w, 0.05, 0.05), this.mMetal, M4([x, floorY + 1.0, z + 1.08]));
    this.batch.add(new THREE.BoxGeometry(0.05, 0.05, 1.1), this.mMetal, M4([x - w / 2, floorY + 1.0, z + 0.55]));
    this.batch.add(new THREE.BoxGeometry(0.05, 0.05, 1.1), this.mMetal, M4([x + w / 2, floorY + 1.0, z + 0.55]));
    for (let k = -w / 2; k <= w / 2 + 1e-3; k += 0.13) this.batch.add(new THREE.BoxGeometry(0.02, 1.0, 0.02), this.mMetal, M4([x + k, floorY + 0.5, z + 1.08]));
    // flower box
    this.batch.add(new THREE.BoxGeometry(0.8, 0.22, 0.2), this.mBlack, M4([x - 0.6, floorY + 1.05, z + 1.12]));
  }

  private decal(x: number, y: number, z: number, w: number, h: number, seed: number, rotY = 0): void {
    const t = canvasTexture(512, 256, (g) => {
      g.clearRect(0, 0, 512, 256);
      drawTags(g, 512, 256, seed);
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildWings(): void {
    const r = rng(77);
    const wing = (a: THREE.Vector2, b: THREE.Vector2, mat: THREE.Material, seed: number) => {
      const len = a.distanceTo(b);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const theta = Math.atan2(-(b.y - a.y), b.x - a.x);
      const m = M4([mid.x, 0, mid.y], theta);
      const holes: (Rect & { kind: 'window' | 'shutter' | 'door'; variant?: number })[] = [];
      for (const fy of [4.1, 7.3, 10.5, 13.7])
        for (let cx = -len / 2 + 1.8; cx < len / 2 - 1.2; cx += 3.1) holes.push({ x: cx, y: fy + 0.85, w: 1.2, h: 1.8, kind: 'window', variant: Math.floor(r() * 8) });
      holes.push({ x: -len / 2 + 2.6, y: 0, w: 2.8, h: 2.9, kind: 'shutter' });
      this.facade({ width: len, height: 17.5, holes, wall: mat, m });
      const inv = new THREE.Matrix4().copy(m);
      for (const fy of [3.9, 7.1, 10.3, 13.5]) this.batch.add(new THREE.BoxGeometry(len, 0.14, 0.22), this.mConcrete, new THREE.Matrix4().multiplyMatrices(inv, M4([0, fy, 0.1])));
      // graffiti low on the wall
      const p = new THREE.Vector3(len * 0.12, 1.2, 0.03).applyMatrix4(m);
      this.decal(p.x, p.y, p.z, 3.0, 1.4, seed, theta);
    };
    wing(new THREE.Vector2(-21, 4), new THREE.Vector2(-16, -9.2), this.mBrick, 51);
    wing(new THREE.Vector2(16, -9.2), new THREE.Vector2(21, 4), this.mBrick2, 57);
    // corner pieces closing the gaps between back wall and wings
    this.batch.add(new THREE.BoxGeometry(0.6, 17.5, 0.6), this.mPlaster, M4([-16.1, 8.75, -9.3]));
    this.batch.add(new THREE.BoxGeometry(0.6, 17.5, 0.6), this.mPlaster, M4([16.1, 8.75, -9.3]));
  }

  // ------------------------------------------------------------ stage
  private buildStage(): void {
    const z = -6.6;
    const deckMat = pbr(withRepeat(wood(3), 1 / 1.4, 1 / 1.4));
    this.casters.add(deckMat);
    // deck + skirt
    this.batch.add(new THREE.BoxGeometry(8.4, 0.08, 2.8), deckMat, M4([0, 0.56, z]));
    this.batch.add(new THREE.BoxGeometry(8.4, 0.52, 2.7), this.mFabric, M4([0, 0.26, z]));
    this.casters.add(this.mFabric);
    // aluminium goal-post truss
    this.truss(new THREE.Vector3(-4.3, 0, z - 1.0), new THREE.Vector3(-4.3, 5.0, z - 1.0));
    this.truss(new THREE.Vector3(4.3, 0, z - 1.0), new THREE.Vector3(4.3, 5.0, z - 1.0));
    this.truss(new THREE.Vector3(-4.3, 5.0, z - 1.0), new THREE.Vector3(4.3, 5.0, z - 1.0));
    for (const bx of [-4.3, 4.3]) this.batch.add(new THREE.BoxGeometry(0.7, 0.03, 0.7), this.mAlu, M4([bx, 0.015, z - 1.0]));
    // PAR cans on the truss
    this.parLenses = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(1, 0.6, 0.9), emissiveIntensity: 2.5, roughness: 0.3 });
    this.ledMats.push(this.parLenses);
    const beamGeo = new THREE.CylinderGeometry(0.06, 1.0, 6, 24, 1, true);
    beamGeo.translate(0, -3, 0);
    [-3.0, -1.0, 1.0, 3.0].forEach((px, i) => {
      this.batch.add(new THREE.CylinderGeometry(0.13, 0.15, 0.32, 14), this.mBlack, M4([px, 4.72, z - 0.85], 0, [0.5, 0, 0]));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), this.parLenses);
      lens.position.set(px, 4.6, z - 0.72);
      lens.rotation.x = -(Math.PI / 2 - 0.5);
      this.group.add(lens);
      const col = [0xff4fd0, 0xffffff, 0xffffff, 0x4fc3ff][i];
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(col) }, uIntensity: { value: 0.14 } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN,vV)),1.5); float a = pow(vY,1.8)*e*uIntensity; gl_FragColor = vec4(uColor*a, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(px, 4.6, z - 0.75);
      beam.rotation.set(0.55, 0, (i - 1.5) * 0.18);
      beam.renderOrder = 2;
      this.group.add(beam);
      this.beams.push({ mesh: beam, mat, phase: i * 1.7 });
    });
    // banner hanging from the truss (wavy fabric)
    const bannerTex = canvasTexture(
      1024,
      300,
      (g) => {
        g.fillStyle = '#121014';
        g.fillRect(0, 0, 1024, 300);
        const r = rng(3);
        for (let i = 0; i < 4000; i++) {
          g.fillStyle = `rgba(255,255,255,${r() * 0.04})`;
          g.fillRect(r() * 1024, r() * 300, 2, 2);
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `150px ${DISPLAY_FONT}`;
        g.lineJoin = 'round';
        g.lineWidth = 18;
        g.strokeStyle = '#ff2e88';
        g.strokeText('BLOCK BEATS', 512, 140);
        g.fillStyle = '#f4f1ea';
        g.fillText('BLOCK BEATS', 512, 140);
        g.font = `42px ${DISPLAY_FONT}`;
        g.fillStyle = '#ffc533';
        g.fillText('RAPBRAWL · HINTERHOF SESSIONS', 512, 255);
      },
      true,
    );
    const bannerGeo = new THREE.PlaneGeometry(5.0, 1.45, 40, 6);
    const pos = bannerGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 2.1) * 0.05 + Math.sin(x * 5.3 + y) * 0.015 - Math.abs(y - 0.95) * 0.0);
    }
    bannerGeo.computeVertexNormals();
    this.bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.92, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeo, this.bannerMat);
    banner.position.set(0, 3.45, z - 1.05);
    banner.castShadow = true;
    banner.receiveShadow = true;
    this.group.add(banner);
    // PA speakers: sub + top stacks
    const gr = pbr(withRepeat(grille(), 3, 3), { metalness: 0.6 });
    const cab = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.85 });
    this.casters.add(cab);
    for (const sx of [-3.4, 3.4]) {
      // sub
      this.batch.add(new RoundedBoxGeometry(1.2, 0.9, 0.95, 2, 0.03), cab, M4([sx, 0.6 + 0.45, z + 0.2]));
      this.batch.add(new THREE.PlaneGeometry(1.08, 0.78), gr, M4([sx, 1.05, z + 0.68]));
      // tops (slightly angled)
      for (let k = 0; k < 2; k++) {
        const y = 1.5 + 0.36 + k * 0.72;
        this.batch.add(new RoundedBoxGeometry(0.8, 0.7, 0.6, 2, 0.03), cab, M4([sx, y, z + 0.2], sx < 0 ? 0.18 : -0.18));
        const gm = new THREE.Matrix4().multiplyMatrices(M4([sx, y, z + 0.2], sx < 0 ? 0.18 : -0.18), M4([0, 0, 0.305]));
        this.batch.add(new THREE.PlaneGeometry(0.7, 0.6), gr, gm);
      }
    }
    // DJ booth: table with cloth, decks, mixer, laptop
    this.batch.add(new THREE.BoxGeometry(2.0, 1.0, 0.8), this.mFabric, M4([0, 1.1, z - 0.2]));
    this.batch.add(new THREE.BoxGeometry(2.04, 0.04, 0.84), this.mBlack, M4([0, 1.62, z - 0.2]));
    for (const dx of [-0.6, 0.6]) {
      this.batch.add(new THREE.BoxGeometry(0.5, 0.08, 0.4), this.mAlu, M4([dx, 1.68, z - 0.2]));
      this.batch.add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), this.mBlack, M4([dx, 1.73, z - 0.2]));
    }
    this.batch.add(new THREE.BoxGeometry(0.34, 0.07, 0.36), this.mBlack, M4([0, 1.68, z - 0.2]));
    this.batch.add(new THREE.BoxGeometry(0.36, 0.01, 0.25), this.mAlu, M4([0.05, 1.74, z - 0.38], 0, [-1.2, 0, 0]));
    // LED strip along the stage edge
    const led = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0.9, 0.25, 1), emissiveIntensity: 2.2 });
    this.ledMats.push(led);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.03, 0.03), led);
    strip.position.set(0, 0.6, z + 1.41);
    this.group.add(strip);
    // posters (wheat-paste) on the plinth near the stage
    for (const [px, seed] of [
      [-8.4, 1],
      [-8.4 + 1.25, 2],
      [8.4, 3],
    ]) this.poster(px, 1.75, -9.17, seed);
  }

  private truss(a: THREE.Vector3, b: THREE.Vector3): void {
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const base = new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1));
    const s = 0.15;
    const chord = new THREE.CylinderGeometry(0.024, 0.024, len, 8);
    chord.translate(0, len / 2, 0);
    for (const [cx, cz] of [
      [-s, -s],
      [s, -s],
      [s, s],
      [-s, s],
    ]) this.batch.add(chord, this.mAlu, new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().makeTranslation(cx, 0, cz)));
    const step = 0.42;
    const n = Math.floor(len / step);
    const diagLen = Math.hypot(step, 2 * s);
    const diag = new THREE.CylinderGeometry(0.012, 0.012, diagLen, 6);
    for (let i = 0; i < n; i++) {
      const y = i * step + step / 2;
      for (const face of [0, 1, 2, 3]) {
        const ang = (face * Math.PI) / 2;
        const tilt = (i % 2 ? 1 : -1) * Math.atan2(2 * s, step);
        const m = new THREE.Matrix4()
          .makeRotationY(ang)
          .multiply(new THREE.Matrix4().makeTranslation(0, y, s))
          .multiply(new THREE.Matrix4().makeRotationZ(tilt));
        this.batch.add(diag, this.mAlu, new THREE.Matrix4().multiplyMatrices(base, m));
      }
    }
  }

  private poster(x: number, y: number, z: number, seed: number): void {
    const t = canvasTexture(
      300,
      420,
      (g) => {
        const r = rng(seed * 7 + 1);
        const bg = ['#e9e1cf', '#f2c230', '#2b2b2b'][seed % 3];
        const fg = seed % 3 === 2 ? '#f2f2f2' : '#151515';
        g.fillStyle = bg;
        g.fillRect(0, 0, 300, 420);
        g.fillStyle = seed % 2 ? '#e8364f' : '#2f6fe8';
        g.fillRect(20, 30, 260, 200);
        g.fillStyle = fg;
        g.textAlign = 'left';
        g.font = `64px ${DISPLAY_FONT}`;
        g.fillText('LIVE', 24, 300);
        g.font = `30px ${DISPLAY_FONT}`;
        g.fillText('IM HINTERHOF', 24, 340);
        g.font = '20px sans-serif';
        g.fillText('SA · 20 UHR · EINTRITT FREI', 24, 380);
        // paper wear
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 300; i++) {
          g.fillStyle = `rgba(0,0,0,${r() * 0.6})`;
          g.fillRect(r() * 300, r() < 0.5 ? r() * 30 : 390 + r() * 30, 4 + r() * 10, 2 + r() * 6);
        }
        g.globalCompositeOperation = 'source-over';
      },
      true,
    );
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.6),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    m.position.set(x, y, z);
    m.rotation.z = (seed % 3) * 0.02 - 0.02;
    m.receiveShadow = true;
    this.group.add(m);
  }

  // ------------------------------------------------------------ props
  private buildProps(): void {
    // Berlin-style wheelie bins (grey body, coloured lids) right corner
    const body = new THREE.MeshStandardMaterial({ color: 0x3e4247, roughness: 0.55 });
    this.casters.add(body);
    const lids = [0xffc21a, 0x2a5fd1, 0x6b4a2a, 0x3e4247].map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
      this.casters.add(m);
      return m;
    });
    lids.forEach((lid, i) => {
      const x = 8.2 + i * 1.3;
      const z = -7.9;
      this.batch.add(new RoundedBoxGeometry(1.2, 1.1, 1.0, 2, 0.06), body, M4([x, 0.68, z]));
      this.batch.add(new RoundedBoxGeometry(1.26, 0.08, 1.06, 2, 0.03), lid, M4([x, 1.27, z]));
      for (const wx of [-0.45, 0.45]) this.batch.add(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 14), this.mBlack, M4([x + wx, 0.1, z - 0.35], 0, [0, 0, Math.PI / 2]));
    });
    // drink crates stacked (left)
    const crateTex = canvasTexture(256, 160, (g) => {
      g.fillStyle = '#1f6b3a';
      g.fillRect(0, 0, 256, 160);
      g.fillStyle = '#16502b';
      for (let i = 0; i < 6; i++) g.fillRect(14 + i * 40, 30, 28, 70);
      g.fillStyle = '#ffffff';
      g.font = 'bold 20px sans-serif';
      g.fillText('PFAND', 92, 140);
    });
    const crate = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.6 });
    this.casters.add(crate);
    const stacks: [number, number, number][] = [
      [-6.0, -7.6, 4],
      [-6.55, -6.7, 3],
      [-5.4, -6.75, 2],
    ];
    for (const [x, z, n] of stacks) for (let k = 0; k < n; k++) this.batch.add(new THREE.BoxGeometry(0.42, 0.3, 0.3), crate, M4([x, 0.15 + k * 0.31, z], (k % 2) * 0.08));
    // euro pallets
    const pal = pbr(withRepeat(wood(9), 1, 1));
    this.casters.add(pal);
    for (let k = 0; k < 3; k++) {
      const y = 0.07 + k * 0.145;
      for (let s = -2; s <= 2; s++) this.batch.add(new THREE.BoxGeometry(1.2, 0.022, 0.14), pal, M4([-9.5, y + 0.06, -7.2 + s * 0.2]));
      for (const bx of [-0.5, 0, 0.5]) this.batch.add(new THREE.BoxGeometry(0.14, 0.1, 0.8), pal, M4([-9.5 + bx, y, -7.2]));
    }
    // crowd barriers (galvanised steel)
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.85 });
    this.casters.add(steel);
    for (const [x, z, ry] of [
      [-10.2, -1.6, 0.45],
      [-9.4, 1.2, 0.25],
      [10.2, -1.6, -0.45],
      [9.4, 1.2, -0.25],
    ]) {
      const base = M4([x, 0, z], ry);
      const add = (g: THREE.BufferGeometry, m: THREE.Matrix4) => this.batch.add(g, steel, new THREE.Matrix4().multiplyMatrices(base, m));
      for (const yy of [0.2, 1.05]) add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), M4([0, yy, 0], 0, [0, 0, Math.PI / 2]));
      for (let k = -1.0; k <= 1.0001; k += 0.125) add(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6), M4([k, 0.62, 0]));
      for (const fx of [-1.05, 1.05]) {
        add(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), M4([fx, 0.55, 0]));
        add(new THREE.BoxGeometry(0.05, 0.03, 0.7), M4([fx, 0.015, 0]));
      }
    }
    // bicycle leaning on the left wall
    this.bicycle(-12.6, -7.6);
  }

  private bicycle(x: number, z: number): void {
    const frame = new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: 0.35, metalness: 0.4 });
    this.casters.add(frame);
    const base = M4([x, 0, z], 0.1, [0, 0, 0.06]);
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) => this.batch.add(g, mat, new THREE.Matrix4().multiplyMatrices(base, m));
    for (const wx of [-0.55, 0.55]) {
      add(new THREE.TorusGeometry(0.34, 0.025, 8, 32), this.mBlack, M4([wx, 0.36, 0]));
      for (let k = 0; k < 12; k++) add(new THREE.CylinderGeometry(0.004, 0.004, 0.66, 3), this.mAlu, M4([wx, 0.36, 0], 0, [0, 0, (k / 12) * Math.PI]));
    }
    const tube = (a: [number, number], b: [number, number], r = 0.02) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      add(new THREE.CylinderGeometry(r, r, len, 8), frame, M4([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], 0, [0, 0, -Math.atan2(dx, dy)]));
    };
    tube([-0.55, 0.36], [-0.1, 0.36]);
    tube([-0.1, 0.36], [-0.2, 0.85]);
    tube([-0.2, 0.85], [0.45, 0.85]);
    tube([-0.1, 0.36], [0.45, 0.85]);
    tube([0.45, 0.85], [0.55, 0.36]);
    tube([-0.55, 0.36], [-0.2, 0.85]);
    add(new RoundedBoxGeometry(0.22, 0.05, 0.1, 2, 0.02), this.mBlack, M4([-0.22, 0.92, 0]));
    tube([0.45, 0.85], [0.42, 1.05], 0.016);
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8), this.mAlu, M4([0.42, 1.05, 0], 0, [Math.PI / 2, 0, 0]));
  }

  private buildStringLights(): void {
    const wire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const pts: THREE.Vector3[] = [];
    const strings: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-15.8, 7.0, -8.8), new THREE.Vector3(15.8, 7.2, -2.0)],
      [new THREE.Vector3(-17.0, 6.6, -4.0), new THREE.Vector3(17.0, 6.8, -8.8)],
      [new THREE.Vector3(-18.5, 6.2, 1.5), new THREE.Vector3(18.5, 6.4, 1.5)],
    ];
    for (const [a, b] of strings) {
      const n = 40;
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * 1.4;
        if (i % 2 === 0 && i > 0 && i < n) pts.push(p.clone().add(new THREE.Vector3(0, -0.09, 0)));
        if (prev) {
          const len = prev.distanceTo(p);
          const g = new THREE.CylinderGeometry(0.008, 0.008, len, 4);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize());
          this.batch.add(g, wire, new THREE.Matrix4().compose(prev.clone().lerp(p, 0.5), q, new THREE.Vector3(1, 1, 1)));
        }
        prev = p;
      }
    }
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: new THREE.Color(1, 0.72, 0.38), emissiveIntensity: 4, roughness: 0.3 });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), this.bulbMat, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => bulbs.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    this.group.add(bulbs);
  }

  // ------------------------------------------------------------ runtime
  update(time: number, beat: number): void {
    this.flash *= 0.9;
    const k = 1 - this.dim * 0.75;
    this.bulbMat.emissiveIntensity = (3.4 + Math.sin(time * 2.3) * 0.15 + this.flash * 2) * k;
    for (const m of this.ledMats) {
      if (m === this._atlas) continue;
      const hue = 0.85 + Math.sin(time * (0.35 + this.hype * 0.6)) * 0.08;
      m.emissive.setHSL(hue, 0.9, 0.55);
      m.emissiveIntensity = (1.6 + beat * 0.9 + this.flash * 2) * k;
    }
    if (this._atlas) this._atlas.emissiveIntensity = 1.25 * (1 - this.dim * 0.4);
    for (const b of this.beams) {
      b.mesh.rotation.z = Math.sin(time * 0.5 + b.phase) * 0.35;
      b.mat.uniforms.uIntensity.value = (0.1 + beat * 0.08 + this.flash * 0.25 + this.hype * 0.05) * (1 - this.dim * 0.85);
    }
  }

  setDim(d: number): void {
    this.dim = d;
    for (const l of this.lights) l.intensity = (l.userData.base as number) * (1 - d * 0.72);
    (this.sceneRef as THREE.Scene & { environmentIntensity: number }).environmentIntensity = this.envBase * (1 - d * 0.7);
    this.skyMat.color.setScalar(1 - d * 0.7);
    this.bannerMat.color.setScalar(1 - d * 0.3);
  }

  pulse(amount = 1): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  setHype(h: number): void {
    this.hype = h;
  }
}
