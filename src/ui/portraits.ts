// Character renders for menus, HUD and card art, rendered once from the real 3D fighters in a short-lived
// offscreen WebGL context (transparent background, studio lighting with a gold and a violet rim).
//   bust  — HUD/avatar head shot          card — select-screen 3/4 body
//   hero  — tall full-body key art         art:<cardId> — the fighter at the card move's first active frame
import * as THREE from 'three';
import { getCard, getFighter, getMove } from '../core/registry';
import { ANIM_SETS } from '../render/animator';
import { buildCharacter } from '../render/characters';
import { toArr, type PoseDef } from '../render/pose';
import { JOINTS } from '../render/rig';

export type PortraitKind = 'card' | 'bust' | 'hero' | `art:${string}`;
const cache = new Map<string, string>();

const SIZE: Record<string, [number, number]> = { bust: [192, 192], card: [320, 400], hero: [560, 800], art: [384, 512] };

function frameBox(rig: ReturnType<typeof buildCharacter>): THREE.Box3 {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const j of JOINTS) {
    const o = rig.joints[j];
    if (o) box.expandByPoint(o.getWorldPosition(v));
  }
  return box;
}

/** Render portraits for the given fighters. Returns data URLs keyed `${id}:${kind}`. */
export function renderPortraits(ids: string[], kinds: PortraitKind[] = ['card', 'bust', 'hero'], withArt = true): Map<string, string> {
  const jobs: [string, PortraitKind][] = [];
  for (const id of ids) {
    for (const k of kinds) jobs.push([id, k]);
    if (withArt) for (const c of getFighter(id).cards) jobs.push([id, `art:${c.id}`]);
  }
  const todo = jobs.filter(([id, k]) => !cache.has(`${id}:${k}`));
  if (!todo.length) return cache;
  const canvas = document.createElement('canvas');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return cache;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8e2ff, 0x2a2230, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.8);
  key.position.set(4, 3.5, 5);
  const goldRim = new THREE.DirectionalLight(0xffb23a, 3.2);
  goldRim.position.set(-4, 3, -3);
  const violetRim = new THREE.DirectionalLight(0x9a5cff, 2.4);
  violetRim.position.set(5, 2, -4);
  const fill = new THREE.DirectionalLight(0xbcc8ff, 0.5);
  fill.position.set(-2, 1, 5);
  scene.add(key, goldRim, violetRim, fill);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const rigs = new Map<string, ReturnType<typeof buildCharacter>>();
  for (const [id, kind] of todo) {
    let rig = rigs.get(id);
    if (!rig) {
      rig = buildCharacter(id, 0);
      rigs.set(id, rig);
    }
    const set = ANIM_SETS[id];
    let pose = toArr((set?.stance ?? {}) as PoseDef);
    if (kind.startsWith('art:')) {
      const card = getCard(id, kind.slice(4));
      const clip = set?.moves[card.move];
      if (clip) {
        const mv = getMove(id, card.move);
        pose = new Float32Array(pose.length);
        const at = mv.hits[0]?.start ?? mv.projectile?.frame ?? mv.meterGain?.frame ?? Math.round(mv.total * 0.4);
        clip.sample(at + 1, pose);
      }
    }
    rig.apply(pose, 1);
    scene.add(rig.root);
    rig.root.updateMatrixWorld(true);
    const head = rig.joints.head.getWorldPosition(new THREE.Vector3());
    const box = frameBox(rig);
    const [w, h] = SIZE[kind.startsWith('art:') ? 'art' : kind];
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const dir = new THREE.Vector3(0.55, 0.06, 1).normalize();
    if (kind === 'bust') {
      cam.fov = 24;
      cam.position.set(head.x + 0.55, head.y - 0.02, 1.55);
      cam.lookAt(head.x + 0.03, head.y - 0.08, 0);
    } else {
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const tall = kind === 'card' ? 0.62 : 1;
      const fitH = (Math.max(size.y + 0.35, (size.x + 0.5) / cam.aspect) * tall) / 2;
      cam.fov = kind === 'hero' ? 26 : 30;
      const dist = fitH / Math.tan(((cam.fov / 2) * Math.PI) / 180);
      const target = kind === 'card' ? new THREE.Vector3(c.x, head.y - size.y * 0.25, c.z) : c.add(new THREE.Vector3(0, 0.08, 0));
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target);
    }
    cam.updateProjectionMatrix();
    renderer.clear();
    renderer.render(scene, cam);
    try {
      cache.set(`${id}:${kind}`, canvas.toDataURL('image/png'));
    } catch {
      /* tainted / unsupported */
    }
    scene.remove(rig.root);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return cache;
}

export function portrait(id: string, kind: PortraitKind): string {
  return cache.get(`${id}:${kind}`) ?? '';
}
