// "HINTERHOF – BLOCK BEATS": Berlin backyard block party at dusk. Stylized, chunky,
// warm (Clash-Royale-inspired look). Procedural geometry + canvas-painted facades;
// all graffiti/posters are original procedural designs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface ArenaLike {
  readonly group: THREE.Group;
  update(time: number, beat: number): void;
  setDim(d: number): void;
  pulse(amount?: number): void;
  setHype(h: number): void;
}

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const DISPLAY_FONT = "'Lilita One', 'Arial Black', Impact, sans-serif";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, redrawOnFonts = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (redrawOnFonts && document.fonts) {
    void document.fonts.ready.then(() => {
      g.clearRect(0, 0, w, h);
      draw(g);
      t.needsUpdate = true;
    });
  }
  return t;
}

const GRAFFITI_COLORS = ['#ff4fa3', '#36d1ff', '#ffd23a', '#7dff6b', '#ff7a2f', '#b56bff'];

/** Bubble-letter style tag made of rounded blobs (not real letters). */
function graffiti(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  const fill = GRAFFITI_COLORS[Math.floor(r() * GRAFFITI_COLORS.length)];
  const fill2 = GRAFFITI_COLORS[Math.floor(r() * GRAFFITI_COLORS.length)];
  const n = 3 + Math.floor(r() * 4);
  const lw = Math.max(4, h * 0.08);
  const blobs: [number, number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const bw = (w / n) * (1.1 + r() * 0.35);
    const bh = h * (0.6 + r() * 0.4);
    const bx = x + (i * w) / n + (r() - 0.5) * 10;
    const by = y + (h - bh) * r() * 0.6;
    blobs.push([bx, by, bw, bh, (r() - 0.5) * 0.3]);
  }
  for (const pass of [0, 1, 2]) {
    for (const [bx, by, bw, bh, rot] of blobs) {
      g.save();
      g.translate(bx + bw / 2, by + bh / 2);
      g.rotate(rot);
      g.beginPath();
      g.roundRect(-bw / 2, -bh / 2, bw, bh, Math.min(bw, bh) * 0.45);
      if (pass === 0) {
        g.lineWidth = lw * 2.2;
        g.strokeStyle = '#1b1530';
        g.stroke();
      } else if (pass === 1) {
        const grd = g.createLinearGradient(0, -bh / 2, 0, bh / 2);
        grd.addColorStop(0, fill);
        grd.addColorStop(1, fill2);
        g.fillStyle = grd;
        g.fill();
      } else {
        g.lineWidth = lw * 0.5;
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.roundRect(-bw / 2 + lw, -bh / 2 + lw, bw * 0.45, bh * 0.25, bh * 0.1);
        g.stroke();
      }
      g.restore();
    }
  }
}

function drawFacade(g: CanvasRenderingContext2D, w: number, h: number, seed: number, wall: string, floors: number, shutters: boolean): void {
  const r = rng(seed);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, wall);
  grd.addColorStop(1, shade(wall, 0.82));
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // peeling plaster patches
  for (let i = 0; i < 26; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(60,40,30,0.12)';
    g.beginPath();
    g.ellipse(r() * w, r() * h * 0.85, 20 + r() * 70, 12 + r() * 40, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // cornice lines between floors
  const floorH = h / (floors + 0.6);
  for (let f = 1; f <= floors; f++) {
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(0, h - f * floorH - 6, w, 8);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, h - f * floorH + 2, w, 5);
  }
  // windows
  const cols = Math.round(w / 210);
  for (let f = 1; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const ww = 92;
      const wh = floorH * 0.55;
      const x = (c + 0.5) * (w / cols) - ww / 2;
      const y = h - (f + 1) * floorH + floorH * 0.2;
      g.fillStyle = '#f4efe4';
      g.beginPath();
      g.roundRect(x - 10, y - 10, ww + 20, wh + 20, 10);
      g.fill();
      const lit = r() < 0.6;
      const wg = g.createLinearGradient(0, y, 0, y + wh);
      wg.addColorStop(0, lit ? '#ffe2a6' : '#3b4b66');
      wg.addColorStop(1, lit ? '#ffb85c' : '#26324a');
      g.fillStyle = wg;
      g.fillRect(x, y, ww, wh);
      g.fillStyle = '#f4efe4';
      g.fillRect(x + ww / 2 - 4, y, 8, wh);
      g.fillRect(x, y + wh * 0.38, ww, 7);
      if (r() < 0.35) {
        g.fillStyle = r() < 0.5 ? '#d9534f' : '#5bc0de';
        g.fillRect(x + 6, y + 4, ww * 0.35, wh * 0.5);
      }
    }
  }
  // ground floor: rolling shutters with graffiti
  if (shutters) {
    const n = Math.round(w / 300);
    for (let i = 0; i < n; i++) {
      const sw = 220;
      const x = (i + 0.5) * (w / n) - sw / 2;
      const y = h - floorH * 0.95;
      const sh = floorH * 0.95;
      g.fillStyle = '#9aa0a8';
      g.fillRect(x, y, sw, sh);
      for (let k = 0; k < sh; k += 14) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(x, y + k, sw, 4);
      }
      graffiti(g, x + 14, y + sh * 0.35, sw - 28, sh * 0.45, seed * 31 + i);
    }
  }
  // drainpipes
  for (const px of [w * 0.02, w * 0.98]) {
    g.fillStyle = '#8b9096';
    g.fillRect(px - 9, 0, 18, h);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(px - 5, 0, 4, h);
  }
  // sagging cables
  g.strokeStyle = '#2a2430';
  g.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    const y = h - floorH * (1.05 + i * 0.12);
    g.beginPath();
    g.moveTo(0, y);
    g.quadraticCurveTo(w / 2, y + 40, w, y - 10);
    g.stroke();
  }
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
}

export class HinterhofArena implements ArenaLike {
  readonly group = new THREE.Group();
  private lights: THREE.Light[] = [];
  private ledMats: THREE.MeshBasicMaterial[] = [];
  private bulbs!: THREE.InstancedMesh;
  private bulbMat!: THREE.MeshBasicMaterial;
  private beams: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; phase: number }[] = [];
  private fans: { mesh: THREE.Object3D; base: number; phase: number }[] = [];
  private dim = 0;
  private flash = 0;
  private hype = 0;
  private statics: THREE.Mesh[] = [];
  private basicDim: THREE.MeshBasicMaterial[] = [];
  private bg = new THREE.Color(0x3b2b55);
  private bgDark = new THREE.Color(0x140c20);
  private sceneRef: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.sceneRef = scene;
    scene.background = new THREE.Color(0x3b2b55);
    scene.fog = new THREE.Fog(0x6a4d73, 26, 60);
    scene.add(this.group);
    this.buildLights();
    this.buildSky();
    this.buildGround();
    this.buildBuildings();
    this.buildStage();
    this.buildProps();
    this.buildStringLights();
    this.buildFans();
    this.mergeStatics();
  }

  private add(mesh: THREE.Mesh, isStatic = true): THREE.Mesh {
    this.group.add(mesh);
    if (isStatic) this.statics.push(mesh);
    return mesh;
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xffe0bd, 0x5b4868, 1.5);
    const key = new THREE.DirectionalLight(0xfff0dc, 2.5);
    key.position.set(5, 9, 7);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.7);
    fill.position.set(-7, 4, 5);
    const rim = new THREE.DirectionalLight(0xd36bff, 1.6);
    rim.position.set(-3, 5, -8);
    const stageA = new THREE.PointLight(0xff4fd8, 18, 12, 2);
    stageA.position.set(-2.5, 3.2, -5);
    const stageB = new THREE.PointLight(0x6b8bff, 14, 12, 2);
    stageB.position.set(2.5, 3.2, -5);
    for (const l of [hemi, key, fill, rim, stageA, stageB]) {
      this.group.add(l);
      this.lights.push(l);
      l.userData.base = l.intensity;
    }
  }

  private buildSky(): void {
    const tex = canvasTex(512, 512, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, '#2b1f57');
      grd.addColorStop(0.45, '#7b3f8c');
      grd.addColorStop(0.8, '#ff8a5c');
      grd.addColorStop(1, '#ffc27a');
      g.fillStyle = grd;
      g.fillRect(0, 0, 512, 512);
      const r = rng(5);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
        g.fillRect(r() * 512, r() * 180, 2, 2);
      }
    });
    const skyMat = new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false });
    this.basicDim.push(skyMat);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), skyMat);
    sky.position.set(0, 16, -30);
    this.group.add(sky);
  }

  private buildGround(): void {
    const tex = canvasTex(
      2048,
      1024,
      (g) => {
        g.fillStyle = '#77727c';
        g.fillRect(0, 0, 2048, 1024);
        const r = rng(9);
        for (let i = 0; i < 5000; i++) {
          g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
          g.fillRect(r() * 2048, r() * 1024, 2 + r() * 3, 2 + r() * 3);
        }
        // darker wet patches
        for (let i = 0; i < 12; i++) {
          g.fillStyle = 'rgba(40,36,60,0.18)';
          g.beginPath();
          g.ellipse(r() * 2048, r() * 1024, 60 + r() * 140, 30 + r() * 60, r() * 3, 0, Math.PI * 2);
          g.fill();
        }
        // cracks
        g.strokeStyle = 'rgba(30,26,34,0.35)';
        g.lineWidth = 3;
        for (let i = 0; i < 14; i++) {
          let x = r() * 2048;
          let y = r() * 1024;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 6; k++) {
            x += (r() - 0.5) * 80;
            y += (r() - 0.5) * 60;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        // court lines (white)
        g.strokeStyle = 'rgba(250,250,245,0.85)';
        g.lineWidth = 14;
        g.strokeRect(160, 140, 1728, 760);
        g.beginPath();
        g.moveTo(1024, 140);
        g.lineTo(1024, 900);
        g.stroke();
        g.beginPath();
        g.arc(1024, 520, 120, 0, Math.PI * 2);
        g.stroke();
        // chalk scribbles
        const chalk = ['#7fe7ff', '#ff8ad8', '#fff07a', '#9dff8a'];
        g.lineWidth = 6;
        for (let i = 0; i < 9; i++) {
          g.strokeStyle = chalk[i % chalk.length];
          const cx = 200 + r() * 1650;
          const cy = 600 + r() * 380;
          g.beginPath();
          if (i % 3 === 0) {
            g.moveTo(cx - 40, cy);
            g.lineTo(cx + 40, cy);
            g.lineTo(cx + 20, cy - 16);
            g.moveTo(cx + 40, cy);
            g.lineTo(cx + 20, cy + 16);
          } else if (i % 3 === 1) {
            g.arc(cx, cy, 26, 0, Math.PI * 2);
          } else {
            for (let k = 0; k < 4; k++) g.lineTo(cx + k * 30, cy + (k % 2 ? -20 : 20));
          }
          g.stroke();
        }
      },
      false,
    );
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 15),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -1.5);
    this.group.add(ground);
    // puddles
    const puddle = new THREE.MeshStandardMaterial({ color: 0x4a4560, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.55, depthWrite: false });
    for (const [x, z, sx, sz] of [
      [-3.2, 1.8, 1.4, 0.6],
      [4.6, -0.6, 1.1, 0.5],
      [0.8, -3.8, 1.6, 0.6],
    ]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 28), puddle);
      p.rotation.x = -Math.PI / 2;
      p.scale.set(sx, sz, 1);
      p.position.set(x, 0.006, z);
      this.group.add(p);
    }
    // manhole covers
    const manhole = new THREE.MeshStandardMaterial({ color: 0x3b3640, roughness: 0.6, metalness: 0.4 });
    const ring = new THREE.MeshStandardMaterial({ color: 0x2a262f, roughness: 0.7 });
    for (const [x, z] of [
      [-5.2, 2.4],
      [5.8, 1.6],
      [-1.6, -3.4],
    ]) {
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 28), ring)).position.set(x, 0.012, z);
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.04, 28), manhole)).position.set(x, 0.015, z);
    }
  }

  private facadeMesh(w: number, h: number, seed: number, wall: string, floors: number): THREE.Mesh {
    const tex = canvasTex(Math.round(w * 85), Math.round(h * 85), (g) => drawFacade(g, Math.round(w * 85), Math.round(h * 85), seed, wall, floors, true));
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  }

  private buildBuildings(): void {
    // back facade
    const back = this.facadeMesh(26, 15, 3, '#b39a6f', 5);
    back.position.set(0, 7.5, -9);
    this.group.add(back);
    // side wings
    const left = this.facadeMesh(12, 15, 7, '#9c9c78', 5);
    left.position.set(-12.2, 7.5, -4.4);
    left.rotation.y = 0.75;
    this.group.add(left);
    const right = this.facadeMesh(12, 15, 13, '#a7876c', 5);
    right.position.set(12.2, 7.5, -4.4);
    right.rotation.y = -0.75;
    this.group.add(right);
    // 3D balconies on the back facade (parallax depth)
    const slab = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.85 });
    const rail = new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 0.5, metalness: 0.5 });
    const balconies: [number, number][] = [
      [-7, 4.6],
      [0, 4.6],
      [7, 4.6],
      [-3.5, 7.4],
      [3.5, 7.4],
      [0, 10.2],
    ];
    for (const [x, y] of balconies) {
      this.add(new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.22, 1.2, 2, 0.06), slab)).position.set(x, y, -8.4);
      this.add(new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.07, 0.07, 1, 0.02), rail)).position.set(x, y + 1.0, -7.82);
      for (let k = -1.5; k <= 1.5; k += 0.25) this.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.9, 0.035), rail)).position.set(x + k, y + 0.55, -7.82);
    }
    // basketball hoop on the centre balcony
    const board = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.5 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1f, roughness: 0.4, metalness: 0.3 });
    this.add(new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.05, 0.08, 2, 0.04), board)).position.set(0, 6.05, -7.7);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.09), new THREE.MeshStandardMaterial({ color: 0xff6a1f }))).position.set(0, 5.85, -7.68);
    const hoop = this.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24), orange));
    hoop.position.set(0, 5.62, -7.36);
    hoop.rotation.x = Math.PI / 2;
    // laundry + plants on balconies
    const cloth = [0xff4f6e, 0x4fc3ff, 0xffd23a, 0x8dff7a];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), new THREE.MeshStandardMaterial({ color: cloth[i % 4], side: THREE.DoubleSide, roughness: 0.9 }));
      m.position.set(-8.2 + i * 0.6, 8.7, -7.85);
      this.add(m);
    }
    const pot = new THREE.MeshStandardMaterial({ color: 0xb8572e, roughness: 0.8 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3fae55, roughness: 0.8 });
    for (const [x, y] of [
      [-6, 4.6],
      [7.8, 4.6],
      [3, 7.4],
    ]) {
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12), pot)).position.set(x, y + 0.27, -8.1);
      this.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), leaf)).position.set(x, y + 0.6, -8.1);
    }
  }

  private buildStage(): void {
    const z = -6.3;
    const deck = new THREE.MeshStandardMaterial({ color: 0x4a3552, roughness: 0.7 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1d1b22, roughness: 0.55 });
    const cone = new THREE.MeshStandardMaterial({ color: 0x34313c, roughness: 0.35, metalness: 0.4 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xc5c7cf, roughness: 0.35, metalness: 0.7 });
    this.add(new THREE.Mesh(new RoundedBoxGeometry(8, 0.45, 2.4, 2, 0.08), deck)).position.set(0, 0.225, z);
    const strip = new THREE.MeshBasicMaterial({ color: 0xc65cff });
    this.ledMats.push(strip);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.05), strip)).position.set(0, 0.42, z + 1.22);
    // DJ table with decks
    this.add(new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.1, 0.8, 2, 0.03), black)).position.set(0, 1.25, z - 0.1);
    for (const lx of [-0.8, 0.8]) this.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), metal)).position.set(lx, 0.85, z - 0.1);
    for (const dx of [-0.45, 0.45]) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20), cone)).position.set(dx, 1.32, z - 0.1);
    this.add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.06, 0.3, 1, 0.02), new THREE.MeshStandardMaterial({ color: 0x8a8fa0, metalness: 0.5, roughness: 0.3 }))).position.set(0, 1.33, z - 0.1);
    // speaker stacks
    for (const sx of [-3.1, 3.1]) {
      for (let k = 0; k < 2; k++) {
        const y = 0.45 + 0.55 + k * 1.1;
        this.add(new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.05, 0.9, 2, 0.06), black)).position.set(sx, y, z);
        for (const dy of [-0.22, 0.22]) {
          const c = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.06, 20), cone));
          c.rotation.x = Math.PI / 2;
          c.position.set(sx, y + dy, z + 0.46);
        }
      }
    }
    // banner + posters on the wall behind the stage
    const banner = canvasTex(
      1024,
      400,
      (g) => {
        g.clearRect(0, 0, 1024, 400);
        g.fillStyle = 'rgba(30,20,60,0.0)';
        g.fillRect(0, 0, 1024, 400);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.font = `italic 64px ${DISPLAY_FONT}`;
        g.lineWidth = 14;
        g.strokeStyle = '#1b1530';
        g.strokeText('RAPBRAWL', 512, 70);
        g.fillStyle = '#ffd23a';
        g.fillText('RAPBRAWL', 512, 70);
        g.font = `150px ${DISPLAY_FONT}`;
        g.lineWidth = 26;
        g.strokeText('BLOCK BEATS', 512, 230);
        const grd = g.createLinearGradient(0, 160, 0, 300);
        grd.addColorStop(0, '#5fe1ff');
        grd.addColorStop(1, '#3f6dff');
        g.fillStyle = grd;
        g.fillText('BLOCK BEATS', 512, 230);
        g.lineWidth = 6;
        g.strokeStyle = '#ff4fa3';
        g.strokeText('BLOCK BEATS', 512, 230);
      },
      true,
    );
    const bannerMat = new THREE.MeshBasicMaterial({ map: banner, transparent: true, fog: false });
    this.basicDim.push(bannerMat);
    const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.0), bannerMat);
    bannerMesh.position.set(0, 3.0, -8.85);
    this.group.add(bannerMesh);
    for (const [px, seed] of [
      [-4.6, 21],
      [4.6, 22],
    ]) {
      const tex = canvasTex(
        300,
        420,
        (g) => {
          const grd = g.createLinearGradient(0, 0, 0, 420);
          grd.addColorStop(0, seed === 21 ? '#ff4fa3' : '#36d1ff');
          grd.addColorStop(1, '#2b1f57');
          g.fillStyle = grd;
          g.fillRect(0, 0, 300, 420);
          g.fillStyle = 'rgba(10,8,20,0.85)';
          g.beginPath();
          g.ellipse(150, 150, 60, 70, 0, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.roundRect(70, 200, 160, 160, 40);
          g.fill();
          g.textAlign = 'center';
          g.font = `52px ${DISPLAY_FONT}`;
          g.lineWidth = 8;
          g.strokeStyle = '#1b1530';
          g.strokeText('BLOCK', 150, 380);
          g.fillStyle = '#ffd23a';
          g.fillText('BLOCK', 150, 380);
        },
        true,
      );
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.68), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      poster.position.set(px, 2.6, -8.85);
      this.group.add(poster);
    }
    // LED light bars + spot fixtures
    const led = new THREE.MeshBasicMaterial({ color: 0xd06bff });
    this.ledMats.push(led);
    for (const lx of [-2.3, 2.3]) this.add(new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.09, 0.09, 1, 0.03), led)).position.set(lx, 4.35, -8.7);
    const beamGeo = new THREE.CylinderGeometry(0.06, 0.9, 5, 20, 1, true);
    beamGeo.translate(0, -2.5, 0);
    [0xff5be0, 0xffffff, 0xffffff, 0x6b8bff].forEach((col, i) => {
      const x = -2.4 + i * 1.6;
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 12), black)).position.set(x, 4.15, -8.3);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(col) }, uIntensity: { value: 0.25 } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN,vV)),1.5); float a = pow(vY,1.6)*e*uIntensity; gl_FragColor = vec4(uColor*a, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(x, 4.05, -8.2);
      beam.rotation.set(0.45, 0, (i - 1.5) * 0.25);
      beam.renderOrder = 2;
      this.group.add(beam);
      this.beams.push({ mesh: beam, mat, phase: i * 1.7 });
    });
  }

  private buildProps(): void {
    const crateCols = [0xd9483b, 0x3fae55, 0xff9a2f, 0x3f8ff2];
    const crateMats = crateCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    const stacks: [number, number, number][] = [
      [-4.9, -6.2, 3],
      [-5.9, -5.9, 2],
      [4.8, -6.1, 2],
      [5.9, -6.2, 3],
    ];
    let ci = 0;
    for (const [x, z, n] of stacks)
      for (let k = 0; k < n; k++) this.add(new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.55, 0.65, 2, 0.06), crateMats[ci++ % 4])).position.set(x, 0.28 + k * 0.56, z);
    // trash bins (right side)
    const binCols = [0x3f6df2, 0xffd23a, 0x3fae55, 0xd9483b];
    binCols.forEach((col, i) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
      const x = 7.2 + i * 0.95;
      this.add(new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.1, 0.8, 2, 0.08), m)).position.set(x, 0.55, -6.6);
      this.add(new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.12, 0.86, 2, 0.04), m)).position.set(x, 1.15, -6.6);
    });
    // metal crowd barriers at the sides
    const bar = new THREE.MeshStandardMaterial({ color: 0xb9bcc6, roughness: 0.35, metalness: 0.7 });
    for (const [x, z, ry] of [
      [-9.0, -1.5, 0.5],
      [-8.2, 1.2, 0.3],
      [9.0, -1.5, -0.5],
      [8.2, 1.2, -0.3],
    ]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      for (const yy of [0.15, 1.0]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 8), bar);
        t.rotation.z = Math.PI / 2;
        t.position.y = yy;
        g.add(t);
      }
      for (let k = -0.95; k <= 0.95; k += 0.19) {
        const v = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 6), bar);
        v.position.set(k, 0.58, 0);
        g.add(v);
      }
      for (const fx of [-0.95, 0.95]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), bar);
        leg.position.set(fx, 0.03, 0);
        g.add(leg);
      }
      this.group.add(g);
      g.updateMatrixWorld(true);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.updateMatrixWorld(true);
          const clone = new THREE.Mesh(o.geometry.clone().applyMatrix4(o.matrixWorld), bar);
          this.add(clone);
        }
      });
      this.group.remove(g);
    }
    // scooter (left, near the wall)
    const red = new THREE.MeshStandardMaterial({ color: 0xc8463c, roughness: 0.45, metalness: 0.2 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x1c1b20, roughness: 0.8 });
    const sx = -8.6;
    const sz = -6.4;
    this.add(new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.45, 0.5, 3, 0.2), red)).position.set(sx, 0.55, sz);
    this.add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.9, 0.45, 3, 0.15), red)).position.set(sx + 0.62, 0.75, sz);
    this.add(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.14, 0.4, 2, 0.06), tire)).position.set(sx - 0.15, 0.85, sz);
    for (const wx of [-0.55, 0.62]) {
      const w = this.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 10, 18), tire));
      w.position.set(sx + wx, 0.3, sz);
    }
    // basketball on the ground
    this.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff7a2f, roughness: 0.6 }))).position.set(-6.8, 0.24, -2.6);
  }

  private buildStringLights(): void {
    const pts: THREE.Vector3[] = [];
    const lines: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-11, 6.8, -5), new THREE.Vector3(11, 6.8, -5)],
      [new THREE.Vector3(-11, 7.4, -2), new THREE.Vector3(11, 7.4, -2)],
    ];
    const wire = new THREE.MeshStandardMaterial({ color: 0x1d1b22, roughness: 0.8 });
    for (const [a, b] of lines) {
      const n = 26;
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * 1.1;
        if (i % 1 === 0) pts.push(p.clone().add(new THREE.Vector3(0, -0.12, 0)));
        if (prev) {
          const len = prev.distanceTo(p);
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), wire);
          seg.position.copy(prev).lerp(p, 0.5);
          seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize());
          this.add(seg);
        }
        prev = p;
      }
    }
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), this.bulbMat, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => this.bulbs.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    const colors = [0xffe2a0, 0xff7ad8, 0x7ad8ff, 0xffe2a0];
    pts.forEach((_, i) => this.bulbs.setColorAt(i, new THREE.Color(colors[i % colors.length])));
    this.group.add(this.bulbs);
  }

  /** A few chunky spectators on balconies and behind the barriers. */
  private buildFans(): void {
    const r = rng(77);
    const shirt = [0xff4f6e, 0x4fc3ff, 0xffd23a, 0x8dff7a, 0xffffff, 0xb56bff];
    const skin = [0xf0c09c, 0xc58c63, 0x8d5a3b, 0xe9b796];
    const spots: [number, number, number][] = [
      [-7.6, 4.71, -8.2],
      [-6.6, 4.71, -8.2],
      [6.5, 4.71, -8.2],
      [7.6, 4.71, -8.2],
      [-3.0, 7.51, -8.2],
      [3.9, 7.51, -8.2],
      [-9.6, 0, -2.6],
      [-10.3, 0, -1.2],
      [9.7, 0, -2.4],
      [10.4, 0, -0.9],
      [-1.3, 10.31, -8.2],
    ];
    for (const [x, y, z] of spots) {
      const g = new THREE.Group();
      const sm = new THREE.MeshStandardMaterial({ color: shirt[Math.floor(r() * shirt.length)], roughness: 0.7 });
      const km = new THREE.MeshStandardMaterial({ color: skin[Math.floor(r() * skin.length)], roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.45, 4, 10), sm);
      body.position.y = 0.6;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), km);
      head.position.y = 1.2;
      const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 2, 6), km);
      armL.position.set(-0.3, 1.05, 0);
      armL.rotation.z = 0.5;
      const armR = armL.clone();
      armR.position.x = 0.3;
      armR.rotation.z = -0.5;
      g.add(body, head, armL, armR);
      g.position.set(x, y, z);
      g.scale.setScalar(0.95 + r() * 0.2);
      this.group.add(g);
      this.fans.push({ mesh: g, base: y, phase: r() * Math.PI * 2 });
    }
  }

  private mergeStatics(): void {
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const m of this.statics) {
      const mat = m.material as THREE.Material;
      byMat.set(mat, [...(byMat.get(mat) ?? []), m]);
    }
    for (const [mat, meshes] of byMat) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        if (m.parent === this.group) g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = new THREE.Mesh(mergeGeometries(geos), mat);
      for (const m of meshes) this.group.remove(m);
      this.group.add(merged);
    }
  }

  update(time: number, beat: number): void {
    this.flash *= 0.9;
    const glow = (0.75 + beat * 0.25 + this.flash * 0.6) * (1 - this.dim * 0.7);
    for (const m of this.ledMats) m.color.setHSL(0.8 + Math.sin(time * 0.4) * 0.05, 0.85, 0.55 * glow + 0.1);
    this.bulbMat.color.setScalar(0.8 + 0.2 * Math.sin(time * 3) + this.flash * 0.5);
    for (const b of this.beams) {
      b.mesh.rotation.z = Math.sin(time * 0.6 + b.phase) * 0.45;
      b.mat.uniforms.uIntensity.value = (0.2 + beat * 0.15 + this.flash * 0.4) * (1 - this.dim * 0.8);
    }
    const energy = 0.5 + this.hype;
    for (const f of this.fans) {
      f.mesh.position.y = f.base + Math.max(0, Math.sin(time * 5 + f.phase)) * 0.12 * energy;
      const arms = f.mesh.children.slice(2);
      const up = this.hype > 0.5 || Math.sin(time * 0.7 + f.phase) > 0.3;
      arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * (up ? 2.6 + Math.sin(time * 8 + f.phase) * 0.3 : 0.5)));
    }
  }

  setDim(d: number): void {
    this.dim = d;
    for (const l of this.lights) l.intensity = (l.userData.base as number) * (1 - d * 0.72);
    for (const m of this.basicDim) m.color.setScalar(1 - d * 0.65);
    if (this.sceneRef.background instanceof THREE.Color) this.sceneRef.background.copy(this.bg).lerp(this.bgDark, d * 0.85);
  }

  pulse(amount = 1): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  setHype(h: number): void {
    this.hype = h;
  }
}
