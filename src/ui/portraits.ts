// Character portraits for menus/HUD, rendered once from the real 3D rigs in a short-lived
// offscreen WebGL context (transparent background, same look as in-game).
import * as THREE from 'three';
import { ANIM_SETS } from '../render/animator';
import { buildCharacter } from '../render/characters';
import { toArr, type PoseDef } from '../render/pose';

export type PortraitKind = 'card' | 'bust';
const cache = new Map<string, string>();

function framing(kind: PortraitKind, head: THREE.Vector3): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
  if (kind === 'bust') {
    return { pos: new THREE.Vector3(head.x + 0.55, head.y - 0.02, 1.55), target: new THREE.Vector3(head.x + 0.03, head.y - 0.08, 0), fov: 24 };
  }
  return { pos: new THREE.Vector3(head.x + 0.9, head.y - 0.35, 3.4), target: new THREE.Vector3(head.x + 0.05, head.y - 0.62, 0), fov: 30 };
}

/** Render portraits for the given fighters. Returns data URLs keyed `${id}:${kind}`. */
export function renderPortraits(ids: string[], kinds: PortraitKind[] = ['card', 'bust']): Map<string, string> {
  const todo = ids.flatMap((id) => kinds.map((k) => [id, k] as const)).filter(([id, k]) => !cache.has(`${id}:${k}`));
  if (!todo.length) return cache;
  const canvas = document.createElement('canvas');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return cache;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a3a66, 1.7));
  const key = new THREE.DirectionalLight(0xfff2e2, 2.6);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0x9fc6ff, 1.8);
  rim.position.set(-3, 3, -4);
  scene.add(key, rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  for (const [id, kind] of todo) {
    const rig = buildCharacter(id, 0);
    const set = ANIM_SETS[id];
    const pose: PoseDef = set?.stance ?? {};
    rig.apply(toArr(pose), 1);
    scene.add(rig.root);
    rig.root.updateMatrixWorld(true);
    const head = rig.joints.head.getWorldPosition(new THREE.Vector3());
    const [w, h] = kind === 'bust' ? [192, 192] : [300, 380];
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const f = framing(kind, head);
    cam.fov = f.fov;
    cam.position.copy(f.pos);
    cam.lookAt(f.target);
    cam.updateProjectionMatrix();
    renderer.clear();
    renderer.render(scene, cam);
    try {
      cache.set(`${id}:${kind}`, canvas.toDataURL('image/png'));
    } catch {
      /* tainted / unsupported */
    }
    scene.remove(rig.root);
    rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return cache;
}

export function portrait(id: string, kind: PortraitKind): string {
  return cache.get(`${id}:${kind}`) ?? '';
}
