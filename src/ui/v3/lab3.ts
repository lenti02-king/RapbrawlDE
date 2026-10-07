// Design v3 render bench (?lab=ui3): the 3D menu arena rendered for one screen's plate (the 1672x941 layout plus the
// 400 px wings each side = 2472x941 reference px). The camera is solved per screen so the ring canvas lies exactly
// under the live fighter's feet anchor and a 1.85 m fighter is as tall as the anchor box. scripts/ui3-plates.mjs reads
// window.__ui3 to render the colour pass (with the game's bloom/tone mapping) and a depth pass for the living plate.
import * as THREE from 'three';
import { PostFX } from '../../render/post';
import { buildArena3D } from './arena3d';
import { SHOTS, type Shot } from './shots';

const W = 2472;
const H = 941;
const X0 = -400; // reference x of the render's left edge

/** Camera that puts the ring point under the fighter anchor's feet at the anchor's height. */
export function solveCamera(s: Shot, ringTop: number): THREE.PerspectiveCamera {
  const fov = s.fov ?? 38;
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 120);
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  const D = (1.85 * H) / (2 * s.figH * t); // distance at which 1.85 m spans figH px
  const cy = H / 2;
  const cx = W / 2;
  // vertical: the feet (ring top) at s.feet[1]; a pitch (deg, + = looking down) tilts the whole view
  const pitch = ((s.pitch ?? 0) * Math.PI) / 180;
  const dyN = (s.feet[1] - cy) / cy; // + below centre
  const dxN = (s.feet[0] - X0 - cx) / cx;
  // point on the ring the fighter stands on (world), camera straight in front of it at distance D
  const P = new THREE.Vector3(s.at?.[0] ?? 0, ringTop, s.at?.[1] ?? 0);
  // direction from the camera to P in camera space: (dxN*t*aspect, -dyN*t, -1); rotate by the pitch
  const dirCam = new THREE.Vector3(dxN * t * (W / H), -dyN * t, -1).normalize();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, ((s.yaw ?? 0) * Math.PI) / 180, 0, 'YXZ'));
  const dirWorld = dirCam.clone().applyQuaternion(q);
  const dist = D / Math.max(0.2, -dirCam.z);
  cam.position.copy(P).addScaledVector(dirWorld, -dist);
  cam.quaternion.copy(q);
  cam.updateMatrixWorld(true);
  return cam;
}

export function ui3Lab(canvas: HTMLCanvasElement): void {
  const params = new URLSearchParams(location.search);
  const scale = Number(params.get('scale') ?? 1);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W * scale, H * scale, false);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  const logo = new Image();
  logo.src = 'assets/ui2/shared/logo.webp';
  const fonts = ['900 100px "Rubik Wet Paint"', '400 100px "Lilita One"', '400 100px "Anton"'].map((f) => document.fonts.load(f).catch(() => []));
  const ready = Promise.all([
    new Promise<void>((res) => {
      logo.onload = () => res();
      logo.onerror = () => res();
    }),
    ...fonts,
  ]).then(() => undefined);
  void ready.then(() => {
    const shotId = params.get('shot') ?? 'home';
    const sh0 = SHOTS[shotId] ?? SHOTS.home;
    const arena = buildArena3D({ logo: logo.naturalWidth ? logo : null, quality: 'high', spots: sh0.spots ?? [sh0.at ?? [0, 0]] });
    let cam = solveCamera(SHOTS[shotId] ?? SHOTS.home, arena.ringTop);
    const post = new PostFX(renderer, arena.scene, cam, 'high');
    post.applyLook({ exposure: 1.05, bloomThreshold: 0.9, bloomStrength: 0.5, bloomRadius: 0.45, saturation: 1.08, contrast: 1.04 });
    const depthMat = new THREE.ShaderMaterial({
      // (instancing: the crowd is instanced; without it every instance landed at the origin)
      vertexShader: `varying float vD;
        void main(){
          vec4 p = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            p = instanceMatrix * p;
          #endif
          vec4 mv = modelViewMatrix * p; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float vD; void main(){ float v = clamp(3.2 / max(vD, 0.1), 0.0, 1.0); gl_FragColor = vec4(v, v, v, 1.0); }',
    });
    const api = {
      shot(id: string, t = 2.0) {
        cam = solveCamera(SHOTS[id] ?? SHOTS.home, arena.ringTop);
        post.setCamera(cam);
        arena.update(t, 0.5);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        post.render(arena.scene, cam);
      },
      depth(id: string) {
        cam = solveCamera(SHOTS[id] ?? SHOTS.home, arena.ringTop);
        const hidden: THREE.Object3D[] = [];
        arena.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if ((o as THREE.Sprite).isSprite || (m && (m as THREE.Material).blending === THREE.AdditiveBlending)) {
            if (o.visible) hidden.push(o);
            o.visible = false;
          }
        });
        const bg = arena.scene.background;
        const fog = arena.scene.fog;
        arena.scene.background = new THREE.Color(0);
        arena.scene.fog = null;
        arena.scene.overrideMaterial = depthMat;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(null);
        renderer.render(arena.scene, cam);
        arena.scene.overrideMaterial = null;
        arena.scene.background = bg;
        arena.scene.fog = fog;
        for (const o of hidden) o.visible = true;
      },
      shots: Object.keys(SHOTS),
      ready: true,
    };
    (window as unknown as { __ui3: typeof api }).__ui3 = api;
    api.shot(shotId);
  });
}
