// Design v3 (S13, PO: "Hintergrund und Screens komplett neu, im gleichen Layout, aber alles stylized cartoon 3D mobile
// game art, damit es mit den Charakteren verschmilzt"): the menus' world is a real 3D rap-battle arena built in the
// fighters' own look - cel-shaded toon materials on the same light ramp, the same black ink outline, neon that blooms.
// A ring with ropes and turnbuckles in the middle, a giant LED wall with the RAP BRAWL logo behind it, banner towers,
// a lighting truss with moving heads and volumetric beams, tiers of cheering fans with phone lights, haze.
// Used two ways: rendered once per screen into the plate images (scripts/ui3-plates.mjs, lab ?lab=ui3) that the
// living-plate runtime shows on phones, and live where a screen wants it. Presentation only.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { addOutline, toonRamp } from '../../render/cel';
import { Crowd, type CrowdSpot } from '../../render/crowd';

const RING = 6.4; // ring floor (m, square)
const RING_H = 0.95; // canvas height above the arena floor
const POST_H = 1.55;

export interface Arena3D {
  scene: THREE.Scene;
  /** Ring canvas height (the fighters stand on it). */
  ringTop: number;
  /** Animate lights, beams, crowd (t = seconds). */
  update(t: number, beat?: number): void;
  dispose(): void;
}

const toon = (color: THREE.ColorRepresentation, o: { emissive?: THREE.ColorRepresentation; ei?: number; map?: THREE.Texture | null } = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map ?? null });

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Brush/poster lettering with a thick dark outline (the cartoon sign style). */
function poster(g: CanvasRenderingContext2D, lines: { text: string; color: string; size: number }[], w: number, h: number, bg: string, stroke = '#0b0710') {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // grunge speckle so the banners do not read as flat UI
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
  const total = lines.reduce((s, l) => s + l.size * 1.02, 0);
  let y = (h - total) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const l of lines) {
    g.font = `900 ${l.size}px "Rubik Wet Paint", "Anton", "Impact", sans-serif`;
    g.lineJoin = 'round';
    g.lineWidth = l.size * 0.16;
    g.strokeStyle = stroke;
    g.strokeText(l.text, w / 2, y);
    g.fillStyle = l.color;
    g.fillText(l.text, w / 2, y);
    y += l.size * 1.02;
  }
}

/** Soft additive light cone (a moving head's beam in haze). */
function beamMesh(color: number, len: number, r: number): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, len, 28, 1, true);
  g.translate(0, -len / 2, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uLen: { value: len }, uAlpha: { value: 0.45 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLen; uniform float uAlpha; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float k = clamp(-vY / uLen, 0.0, 1.0); float edge = pow(abs(dot(vN, vV)), 1.6);
      float a = uAlpha * (1.0 - k) * (0.35 + 0.65 * (1.0 - k)) * edge; gl_FragColor = vec4(uColor * a, a); }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 5;
  return mesh;
}

function glowSprite(color: number, size: number, alpha = 1): THREE.Sprite {
  const tex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: alpha, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

const inked: THREE.Mesh[] = [];
function add<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, ink = true): T {
  parent.add(o);
  if (ink && (o as unknown as THREE.Mesh).isMesh) inked.push(o as unknown as THREE.Mesh);
  return o;
}

export function buildArena3D(o: { logo?: HTMLImageElement | null; quality?: 'low' | 'medium' | 'high'; crowd?: boolean; spots?: [number, number][] } = {}): Arena3D {
  inked.length = 0;
  const q = o.quality ?? 'high';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0816);
  scene.fog = new THREE.Fog(0x140b22, 24, 64);
  const root = new THREE.Group();
  scene.add(root);

  // ---------------------------------------------------------------- light (same idea as the fighters' menu light)
  scene.add(new THREE.HemisphereLight(0x8a7cff, 0x1c1026, 0.42));
  const key = new THREE.SpotLight(0xffe6c4, 120, 30, 0.36, 0.6, 1.6);
  key.position.set(1.5, 11, 6);
  key.target.position.set(0, RING_H, 0);
  scene.add(key, key.target);
  const rimL = new THREE.SpotLight(0xff4fd0, 220, 28, 0.5, 0.6, 1.6);
  rimL.position.set(-8, 7, -4);
  rimL.target.position.set(0, RING_H + 1, 0);
  const rimR = new THREE.SpotLight(0x4f8dff, 220, 28, 0.5, 0.6, 1.6);
  rimR.position.set(8, 7, -4);
  rimR.target.position.set(0, RING_H + 1, 0);
  scene.add(rimL, rimL.target, rimR, rimR.target);

  // ---------------------------------------------------------------- floor
  const floorTex = canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#17101f';
    g.fillRect(0, 0, 1024, 1024);
    // concentric neon rings around the ring (magenta / blue)
    for (const [r, c, w] of [
      [430, 'rgba(255,79,208,0.55)', 10],
      [470, 'rgba(79,141,255,0.45)', 6],
      [505, 'rgba(255,200,90,0.25)', 4],
    ] as const) {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.beginPath();
      g.arc(512, 512, r, 0, Math.PI * 2);
      g.stroke();
    }
    const gr = g.createRadialGradient(512, 512, 120, 512, 512, 520);
    gr.addColorStop(0, 'rgba(120,70,200,0.35)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 1024);
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 64), toon(0xffffff, { map: floorTex, emissive: 0xffffff, ei: 0.0 }));
  (floor.material as THREE.MeshToonMaterial).emissiveMap = floorTex;
  (floor.material as THREE.MeshToonMaterial).emissiveIntensity = 0.32;
  floor.rotation.x = -Math.PI / 2;
  floor.scale.setScalar(1);
  add(root, floor, false);

  // ---------------------------------------------------------------- the ring
  const ring = new THREE.Group();
  root.add(ring);
  const canvasMat = canvasTex(1024, 1024, (g) => {
    const gr = g.createRadialGradient(512, 512, 60, 512, 512, 720);
    gr.addColorStop(0, '#3c1a6e');
    gr.addColorStop(1, '#170a2e');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 1024);
    // gold border band
    g.strokeStyle = '#f4c542';
    g.lineWidth = 34;
    g.strokeRect(40, 40, 944, 944);
    g.strokeStyle = '#0b0710';
    g.lineWidth = 8;
    g.strokeRect(20, 20, 984, 984);
    g.strokeRect(62, 62, 900, 900);
    // centre crown mark
    g.save();
    g.translate(512, 520);
    g.fillStyle = 'rgba(214,166,52,0.22)';
    g.strokeStyle = 'rgba(244,197,66,0.55)';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(-190, 90);
    g.lineTo(-210, -110);
    g.lineTo(-95, -10);
    g.lineTo(0, -150);
    g.lineTo(95, -10);
    g.lineTo(210, -110);
    g.lineTo(190, 90);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  });
  const top = new THREE.Mesh(new RoundedBoxGeometry(RING, 0.18, RING, 3, 0.06), toon(0xffffff, { map: canvasMat }));
  top.position.y = RING_H - 0.09;
  add(ring, top);
  // apron skirt with the lettering
  const apronTex = canvasTex(2048, 256, (g) => {
    g.fillStyle = '#120a1c';
    g.fillRect(0, 0, 2048, 256);
    g.fillStyle = '#ff4fd0';
    g.fillRect(0, 0, 2048, 14);
    g.fillStyle = '#4f8dff';
    g.fillRect(0, 242, 2048, 14);
    g.font = '900 150px "Rubik Wet Paint", "Anton", "Impact", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const x of [512, 1536]) {
      g.lineWidth = 22;
      g.strokeStyle = '#0b0710';
      g.strokeText('RAP BRAWL', x, 132);
      g.fillStyle = '#ffd25e';
      g.fillText('RAP BRAWL', x, 132);
    }
  });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(RING - 0.06, RING_H - 0.18, RING - 0.06), [
    toon(0xffffff, { map: apronTex, emissive: 0xffffff, ei: 0.35 }),
    toon(0xffffff, { map: apronTex, emissive: 0xffffff, ei: 0.35 }),
    toon(0x120a1c),
    toon(0x120a1c),
    toon(0xffffff, { map: apronTex, emissive: 0xffffff, ei: 0.35 }),
    toon(0xffffff, { map: apronTex, emissive: 0xffffff, ei: 0.35 }),
  ]);
  for (const m of apron.material as THREE.MeshToonMaterial[]) if (m.map) m.emissiveMap = apronTex;
  apron.position.y = (RING_H - 0.18) / 2;
  add(ring, apron);
  // neon strip under the canvas edge
  const strip = new THREE.Mesh(new THREE.BoxGeometry(RING + 0.04, 0.05, RING + 0.04), new THREE.MeshBasicMaterial({ color: 0xff5fd8 }));
  strip.position.y = RING_H - 0.2;
  add(ring, strip, false);
  // posts, turnbuckle pads, ropes
  const postMat = toon(0xd9b24a);
  const padMats = [toon(0xd8283a), toon(0x2a5fd8), toon(0xd8283a), toon(0x2a5fd8)];
  const ropeMats = [toon(0xd8283a), toon(0xd9d2c4), toon(0x2a5fd8)];
  const h = RING / 2 - 0.12;
  const corners: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  corners.forEach(([x, z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, POST_H, 18), postMat);
    post.position.set(x, RING_H + POST_H / 2 - 0.05, z);
    add(ring, post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), postMat);
    cap.position.set(x, RING_H + POST_H - 0.04, z);
    add(ring, cap);
    for (let k = 0; k < 3; k++) {
      const pad = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.22, 0.26, 2, 0.06), padMats[i]);
      pad.position.set(x, RING_H + 0.45 + k * 0.4, z);
      add(ring, pad);
    }
  });
  // the side facing the camera has no ropes (they would run through the fighters standing in the ring)
  for (let s = 0; s < 4; s++) {
    if (s === 2) continue;
    const [ax, az] = corners[s];
    const [bx, bz] = corners[(s + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    for (let k = 0; k < 3; k++) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 10), ropeMats[k]);
      rope.position.set((ax + bx) / 2, RING_H + 0.45 + k * 0.4, (az + bz) / 2);
      rope.rotation.z = Math.PI / 2;
      rope.rotation.y = -Math.atan2(bz - az, bx - ax);
      add(ring, rope);
    }
  }
  // steps at the front corners
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const st = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.3, 0.42, 2, 0.04), toon(0x241632));
      st.position.set(sx * (RING / 2 - 0.9), 0.15 + k * 0.3 - 0.0, RING / 2 + 0.95 - k * 0.38);
      st.scale.y = (3 - k) / 3 + 0.0001;
      st.position.y = ((3 - k) * 0.3) / 2;
      add(ring, st);
    }
  }

  // where the fighters stand: a warm light pool and a soft contact shadow on the canvas (the live figure is drawn
  // over the plate, so its ground contact is painted into the plate)
  const poolTex = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,230,190,0.55)');
    gr.addColorStop(0.5, 'rgba(255,170,220,0.22)');
    gr.addColorStop(1, 'rgba(255,170,220,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
  const shadowTex = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
  for (const [sx, sz] of o.spots ?? []) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(sx, RING_H + 0.004, sz);
    ring.add(pool);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(sx, RING_H + 0.006, sz);
    ring.add(sh);
  }

  // ---------------------------------------------------------------- LED wall + banner towers behind the ring
  const back = new THREE.Group();
  back.position.z = -19;
  root.add(back);
  const ledTex = canvasTex(2048, 900, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 900);
    gr.addColorStop(0, '#2a0e4a');
    gr.addColorStop(0.55, '#4b1374');
    gr.addColorStop(1, '#13081f');
    g.fillStyle = gr;
    g.fillRect(0, 0, 2048, 900);
    // LED pixel grid
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let x = 0; x < 2048; x += 8) g.fillRect(x, 0, 2, 900);
    for (let y = 0; y < 900; y += 8) g.fillRect(0, y, 2048, 2);
    // light burst behind the logo
    const rb = g.createRadialGradient(1024, 430, 40, 1024, 430, 700);
    rb.addColorStop(0, 'rgba(255,190,90,0.85)');
    rb.addColorStop(0.35, 'rgba(255,79,208,0.45)');
    rb.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rb;
    g.fillRect(0, 0, 2048, 900);
    if (o.logo) {
      const lw = 520;
      const lh = (o.logo.naturalHeight / o.logo.naturalWidth) * lw;
      g.drawImage(o.logo, 1024 - lw / 2, 450 - lh / 2, lw, lh);
    } else poster(g, [{ text: 'RAP BRAWL', color: '#ffd25e', size: 260 }], 2048, 900, 'rgba(0,0,0,0)');
  });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(22, 9.7), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: true }));
  (led.material as THREE.MeshBasicMaterial).color.setScalar(1.1);
  led.position.set(0, 8.35, 0);
  add(back, led, false);
  const frame = new THREE.Mesh(new RoundedBoxGeometry(15.6, 7.2, 0.5, 3, 0.12), toon(0x15101c));
  frame.position.set(0, 8.35, -0.3);
  frame.scale.set(22.8 / 15.6, 10.4 / 7.2, 1);
  add(back, frame);
  const towers: [number, string[], string][] = [
    [-16.5, ['FIGHT', 'RAP', 'REIGN'], '#ff4fd0'],
    [16.5, ['BARS', 'HIT', 'HARDER'], '#ffd25e'],
  ];
  for (const [x, words, col] of towers) {
    const tex = canvasTex(512, 1024, (g) =>
      poster(
        g,
        words.map((w, i) => ({ text: w, color: i === 1 ? '#ffffff' : col, size: 170 })),
        512,
        1024,
        '#1b1026',
      ),
    );
    const tw = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 10.4), new THREE.MeshBasicMaterial({ map: tex, color: 0xb8b0c4 }));
    tw.position.set(x, 7.2, 1.2);
    tw.rotation.y = -Math.sign(x) * 0.35;
    add(back, tw, false);
    const tf = new THREE.Mesh(new RoundedBoxGeometry(5.7, 10.9, 0.4, 3, 0.1), toon(0x15101c));
    tf.position.set(x, 7.2, 0.95);
    tf.rotation.y = tw.rotation.y;
    add(back, tf);
    // neon edge lights on the towers
    for (const ex of [-2.85, 2.85]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 10.9, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6) }));
      tube.position.set(ex, 0, 0.25);
      const holder = new THREE.Group();
      holder.position.copy(tf.position);
      holder.rotation.y = tw.rotation.y;
      holder.add(tube);
      back.add(holder);
    }
  }

  // ---------------------------------------------------------------- LED barrier boards around the ring floor
  const boardTex = canvasTex(1024, 128, (g) => {
    g.fillStyle = '#0d0716';
    g.fillRect(0, 0, 1024, 128);
    const gr = g.createLinearGradient(0, 0, 1024, 0);
    gr.addColorStop(0, '#ff4fd0');
    gr.addColorStop(0.5, '#7a5cff');
    gr.addColorStop(1, '#4fb4ff');
    g.fillStyle = gr;
    g.fillRect(0, 8, 1024, 6);
    g.fillRect(0, 114, 1024, 6);
    g.font = '400 74px "Lilita One", "Anton", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [x, w] of [
      [180, 'RAP BRAWL'],
      [512, '♛'],
      [844, 'RAP BRAWL'],
    ] as const) {
      g.fillStyle = '#ffd25e';
      g.fillText(w, x, 68);
    }
  });
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex, color: 0xd8d0e8 });
  for (const [x, z, ry, w] of [
    [0, -6.2, 0, 12],
    [-6.6, -1.5, Math.PI / 2.6, 7],
    [6.6, -1.5, -Math.PI / 2.6, 7],
  ] as const) {
    const bd = new THREE.Mesh(new THREE.BoxGeometry(w, 0.75, 0.12), [toon(0x0d0716), toon(0x0d0716), toon(0x0d0716), toon(0x0d0716), boardMat, toon(0x0d0716)]);
    bd.position.set(x, 0.375, z);
    bd.rotation.y = ry;
    add(root, bd);
  }
  // the LED wall lights the backs of the crowd and the haze
  const ledLight = new THREE.PointLight(0xb05cff, 90, 26, 1.6);
  ledLight.position.set(0, 6, -16);
  scene.add(ledLight);

  // ---------------------------------------------------------------- lighting truss + moving heads + beams
  const truss = new THREE.Group();
  truss.position.y = 8.2;
  root.add(truss);
  const trussMat = toon(0x2b2433);
  for (const [x, z, w, d] of [
    [0, -4.2, 10, 0.4],
    [0, 4.2, 10, 0.4],
    [-5, 0, 0.4, 8.8],
    [5, 0, 0.4, 8.8],
  ] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), trussMat);
    bar.position.set(x, 0, z);
    add(truss, bar);
  }
  const beams: { mesh: THREE.Mesh; base: THREE.Euler; ph: number }[] = [];
  const heads: [number, number, number][] = [
    [-4, -4.2, 0xff4fd0],
    [-1.5, -4.2, 0xffd25e],
    [1.5, -4.2, 0x4f8dff],
    [4, -4.2, 0xff4fd0],
    [-4.6, 3.6, 0x4f8dff],
    [4.6, 3.6, 0xffd25e],
  ];
  heads.forEach(([x, z, c], i) => {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 16), toon(0x18141e));
    can.position.set(x, -0.45, z);
    add(truss, can);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2) }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, -0.71, z);
    truss.add(lens);
    const b = beamMesh(c, 15, 1.7);
    b.position.set(x, -0.7, z);
    const base = new THREE.Euler((z < 0 ? 0.42 : -0.32) + (i % 2) * 0.08, 0, (x < 0 ? -0.25 : 0.25) * (1 + (i % 3) * 0.3));
    b.rotation.copy(base);
    truss.add(b);
    beams.push({ mesh: b, base, ph: i * 1.7 });
    const flare = glowSprite(c, 1.1, 0.9);
    flare.position.set(x, -0.75, z);
    truss.add(flare);
  });

  // ---------------------------------------------------------------- stands + crowd
  const stands = new THREE.Group();
  root.add(stands);
  const tierMat = toon(0x221830);
  const crowds: Crowd[] = [];
  const arcs = [
    { r: 13.3, y: 0.3, n: 52 },
    { r: 14.6, y: 1.2, n: 58 },
    { r: 15.9, y: 2.1, n: 64 },
    { r: 17.2, y: 3.0, n: 70 },
  ];
  arcs.forEach(({ r, y, n }, ti) => {
    // a tier of seating boxes around the back half of the ring; the front stays open to the camera
    const seg = 24;
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI * (0.06 + (0.88 * i) / seg);
      const z = Math.sin(a) * r * 0.62 - 1.2;
      if (-z < -2.5) continue;
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0 + y, 1.5), tierMat);
      box.position.set(Math.cos(a) * -r, (1.0 + y) / 2 - 1.0, -z);
      box.rotation.y = -(a - Math.PI / 2);
      add(stands, box, false);
    }
    const spots: CrowdSpot[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.05 + (0.9 * (i + 0.5)) / n);
      const x = Math.cos(a) * -r + Math.sin(i * 12.9 + ti) * 0.22;
      const z = -(Math.sin(a) * r * 0.62 - 1.2);
      if (z > 2.2) continue;
      spots.push({ x, z });
    }
    if (o.crowd !== false) {
      const c = new Crowd('hipster', spots, 13 + ti * 7, q);
      c.group.position.y = y;
      c.group.traverse((m) => ((m as THREE.Mesh).frustumCulled = false));
      stands.add(c.group);
      crowds.push(c);
    }
  });

  // phone lights and bokeh in the stands
  const bokeh: THREE.Sprite[] = [];
  for (let i = 0; i < 60; i++) {
    const a = Math.PI * (0.05 + 0.9 * Math.random());
    const r = 13 + Math.random() * 4;
    const s = glowSprite([0xffffff, 0xffe2a8, 0xff9ee6, 0x9ec4ff][i % 4], 0.12 + Math.random() * 0.12, 0.8);
    s.position.set(Math.cos(a) * -r, 1.6 + Math.random() * 2.2, Math.min(2, -(Math.sin(a) * r * 0.62 - 1.2)));
    stands.add(s);
    bokeh.push(s);
  }
  // far stadium lights (bokeh dots high up)
  for (let i = 0; i < 40; i++) {
    const s = glowSprite([0xffd9a0, 0xff7fd8, 0x8fb4ff][i % 3], 0.6 + Math.random() * 0.9, 0.55);
    s.position.set((Math.random() - 0.5) * 44, 9 + Math.random() * 7, -18 - Math.random() * 6);
    root.add(s);
  }

  // ---------------------------------------------------------------- haze
  const hazeTex = canvasTex(256, 128, (g) => {
    const gr = g.createRadialGradient(128, 64, 4, 128, 64, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
  });
  const haze: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 3.5),
      new THREE.MeshBasicMaterial({ map: hazeTex, color: i % 2 ? 0xb07cff : 0xff8ad8, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.position.set((i - 4) * 3.2, 0.8 + (i % 3) * 0.9, -4 - (i % 4) * 2.5);
    m.renderOrder = 4;
    root.add(m);
    haze.push(m);
  }

  for (const m of inked) addOutline(m);
  inked.length = 0;

  return {
    scene,
    ringTop: RING_H,
    update(t: number, beat = 0) {
      beams.forEach((b, i) => {
        b.mesh.rotation.x = b.base.x + Math.sin(t * 0.55 + b.ph) * 0.16;
        b.mesh.rotation.z = b.base.z + Math.sin(t * 0.4 + b.ph * 1.3) * 0.22;
        (b.mesh.material as THREE.ShaderMaterial).uniforms.uAlpha.value = 0.38 + 0.12 * Math.sin(t * 1.3 + i) + beat * 0.08;
      });
      bokeh.forEach((s, i) => ((s.material as THREE.SpriteMaterial).opacity = 0.55 + 0.4 * Math.max(0, Math.sin(t * (1.2 + (i % 5) * 0.3) + i))));
      haze.forEach((m, i) => (m.position.x += Math.sin(t * 0.2 + i) * 0.002));
      for (const c of crowds) c.update(t, beat, 0.8);
    },
    dispose() {
      scene.traverse((ob) => {
        const m = ob as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mt of mats) {
          for (const v of Object.values(mt)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
          mt.dispose();
        }
      });
    },
  };
}
