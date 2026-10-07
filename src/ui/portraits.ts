// Character renders for menus, HUD and card art, rendered once from the real 3D fighters in a short-lived
// offscreen WebGL context (transparent background, studio lighting with a gold and a violet rim).
//   bust  — HUD/avatar head shot          card — select-screen 3/4 body
//   hero  — tall full-body key art         art:<cardId> — the fighter at the card move's first active frame
import { showcasePose } from '../render/anims/showcase';
import * as THREE from 'three';
import { getCard, getFighter, getMove } from '../core/registry';
import { ANIM_SETS } from '../render/animator';
import { buildCharacter } from '../render/characters';
import { toArr, type PoseDef } from '../render/pose';
import { JOINTS, POSE_LEN } from '../render/rig';
import { heartGeometry, heartMaterial, makeCrocRunner, makePalm, makeSpotlight, makeSunset, noteTexture, smokeTexture } from '../render/props';
import { makeDiamondRain, makeTunerCar } from '../render/specials';
import { crocRunnerModel, palmModel, propModel, tunerCarModel } from '../render/propModels';
import { burstSprite, crewRig, makeOffroader, runPose, starTexture, textSprite } from '../render/abilities11';
import { makeNine, makeSofa } from '../render/cines11';

/**
 * Card art props: what the ability looks like (wave, spotlight, notes, hearts, diamonds, croc, smoke, wrecking ball,
 * gold glint, palms, car) staged around the fighter (local space: fighter at the origin facing +x). `wide` widens the
 * framing so big props fit on the card.
 */
function artProps(cardId: string): { group: THREE.Group; wide?: number; shiftX?: number } | null {
  const g = new THREE.Group();
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T => (o.position.set(x, y, z), g.add(o), o);
  const additive = (color: number, opacity = 0.9) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  switch (cardId) {
    case 'jaz_wave': {
      for (let i = 0; i < 5; i++) {
        const arc = add(new THREE.Mesh(new THREE.TorusGeometry(0.22 + i * 0.16, 0.035, 6, 32, 1.9), additive(i % 2 ? 0xff6fd8 : 0x6ff7ff)), 0.75 + i * 0.12, 1.35, 0.1);
        arc.rotation.z = -0.95;
      }
      return { group: g, wide: 1.25, shiftX: 0.35 };
    }
    case 'jaz_spot': {
      const sp = makeSpotlight(0xfff0c8);
      sp.setIntensity(1);
      sp.group.scale.set(1.1, 0.36, 1.1);
      add(sp.group, 0, 0, 0);
      for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.PlaneGeometry(0.8 - i * 0.12, 0.05), additive(0x7cf08f, 0.85)), -0.65 - i * 0.04, 0.6 + i * 0.25, 0.2);
      return { group: g };
    }
    case 'jaz_counter':
    case 'jaz_mvp': {
      const tex = noteTexture();
      for (let i = 0; i < 7; i++) {
        const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: [0x6ff7ff, 0xff6fd8, 0xffe066][i % 3], transparent: true, depthWrite: false })), Math.cos(i * 0.9) * 0.75, 0.9 + (i % 4) * 0.32, 0.35);
        sp.scale.setScalar(0.32);
      }
      if (cardId === 'jaz_mvp')
        for (let i = 0; i < 5; i++) {
          const line = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9 - i * 0.1, 0.05), additive(0xffd23a, 0.8)), -0.7 - i * 0.05, 0.7 + i * 0.22, 0.2);
          line.rotation.z = 0.05;
        }
      return { group: g };
    }
    case 'jaz_blunt': {
      // the PO's joint, oversized for the card, with a curling smoke trail
      const joint = propModel('joint');
      if (joint) {
        joint.scale.setScalar(3.2);
        joint.rotation.set(0.2, -0.4, 0.5);
        add(joint, 0.85, 1.25, 0.4);
      }
      const tex = smokeTexture();
      for (let i = 0; i < 7; i++) {
        const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: i % 2 ? 0xdfe6d6 : 0xc9d8bf, transparent: true, opacity: 0.8, depthWrite: false })), 1.1 + Math.sin(i * 1.1) * 0.25, 1.5 + i * 0.22, 0.3);
        sp.scale.setScalar(0.35 + i * 0.07);
      }
      const ember = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), additive(0xff7a2a, 1)), 1.1, 1.38, 0.5);
      void ember;
      return { group: g, wide: 1.2, shiftX: 0.4 };
    }
    case 'jaz_heart': {
      const geo = heartGeometry();
      for (let i = 0; i < 7; i++) {
        const h = add(new THREE.Mesh(geo, heartMaterial(i % 2 ? 0xff3d7f : 0xff8fb8)), Math.cos(i * 1.3) * 0.7 + 0.2, 0.7 + ((i * 3) % 7) * 0.2, 0.3);
        h.scale.setScalar(0.18 + (i % 3) * 0.06);
        h.rotation.z = Math.sin(i) * 0.4;
      }
      return { group: g };
    }
    case 'jaz_rain': {
      const rain = add(makeDiamondRain(), 1.1, 1.0, 0);
      rain.children.forEach((c, i) => {
        const d = c.userData as { lane: number; z: number; glint?: boolean; size?: number };
        if (d.glint) return;
        c.position.set(d.lane, 1.4 - ((i * 0.37) % 1) * 2.3, d.z);
        c.rotation.set(i, i * 1.3, 0.3);
        const sc = d.size ?? 1;
        c.scale.set(sc, sc * 1.4, sc);
      });
      return { group: g, wide: 1.4, shiftX: 0.5 };
    }
    case 'bon_croc': {
      // the little croc scurrying toward the opponent, jaws open
      const model = crocRunnerModel();
      const croc = model ?? makeCrocRunner();
      croc.setOpacity(1);
      croc.setOpen(model ? 28 : 40);
      croc.waddle(0.9, 1);
      croc.group.scale.setScalar(model ? 1.05 : 1.15);
      croc.group.rotation.set(0, -0.35, 0);
      add(croc.group, 0.75, 0, 0.35);
      return { group: g, wide: 1.3, shiftX: 0.55 };
    }
    case 'bon_smoke': {
      const tex = smokeTexture();
      for (let i = 0; i < 9; i++) {
        const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: i % 2 ? 0xd9d3e6 : 0xbab2cc, transparent: true, opacity: 0.85, depthWrite: false })), 0.9 + (i % 3) * 0.25, 0.3 + Math.floor(i / 3) * 0.55, 0.2);
        sp.scale.setScalar(0.85);
      }
      return { group: g, wide: 1.2, shiftX: 0.4 };
    }
    case 'bon_abriss': {
      const model = propModel('ball');
      if (model) {
        // the PO's wrecking ball, swinging in on its chain (origin at the top of the chain)
        model.rotation.z = 0.35;
        add(model, 1.6, 2.9, -0.3);
      } else {
        const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), new THREE.MeshStandardMaterial({ color: 0x2b2140, metalness: 0.7, roughness: 0.35 })), 1.25, 1.2, -0.2);
        ball.castShadow = true;
        for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), new THREE.MeshStandardMaterial({ color: 0x9a94b0, metalness: 0.8, roughness: 0.3 })), 1.25 + i * 0.03, 1.7 + i * 0.13, -0.2).rotation.y = i % 2 ? Math.PI / 2 : 0;
      }
      for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.05), additive(0xff6a3d, 0.85)), 0.55 - i * 0.12, 1.0 + i * 0.18, 0.1);
      return { group: g, wide: 1.25, shiftX: 0.45 };
    }
    case 'bon_grin': {
      const glint = noteTexture();
      void glint;
      for (let i = 0; i < 8; i++) {
        const st = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.08 + (i % 3) * 0.04, 0), additive(i % 2 ? 0xffd65a : 0xfff6b0, 1)), 0.3 + Math.cos(i * 0.8) * 0.5, 1.65 + Math.sin(i * 0.8) * 0.45, 0.5);
        st.scale.set(0.6, 2.4, 0.6);
        st.rotation.z = i * 0.4;
      }
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 40), additive(0xffd23a, 0.8)), 0.15, 1.7, 0.3);
      void ring;
      return { group: g };
    }
    case 'bon_palm': {
      const sun = add(makeSunset(3.2), 0.4, 1.4, -2.2);
      void sun;
      add(palmModel(2.8, 0.4) ?? makePalm(2.8, 0.4), -0.9, 0, -1.4);
      add(palmModel(3.2, -0.3) ?? makePalm(3.2, -0.3), 1.4, 0, -1.6);
      return { group: g, wide: 1.2 };
    }
    case 'bon_car': {
      const car = tunerCarModel() ?? makeTunerCar();
      car.scale.setScalar(car.userData.wheels.length ? 0.7 : 0.6);
      car.rotation.y = -0.5;
      add(car, 0.9, 0, -0.9);
      return { group: g, wide: 1.35, shiftX: 0.45 };
    }
    // ---- D43 cards (session 11)
    case 'manu_kurden': {
      // the crew charging behind him, fists up, and the gold "5000"
      const arr = new Float32Array(POSE_LEN);
      for (let i = 0; i < 4; i++) {
        const rig = crewRig(i);
        rig.apply(toArr(runPose(0.15 + i * 0.27, i !== 2), arr), 1);
        add(rig.root, -0.7 + i * 0.5, 0, -0.9 - (i % 2) * 0.5);
      }
      const n = add(textSprite('5000', { width: 1.3, color: '#ffd23c', stroke: '#2a1200' }), 0.75, 2.25, 0.4);
      void n;
      return { group: g, wide: 1.3, shiftX: 0.2 };
    }
    case 'manu_beton': {
      const stone = new THREE.MeshToonMaterial({ color: 0x8c8a86 });
      for (let i = 0; i < 9; i++) {
        const c = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + (i % 3) * 0.04, 0), stone), 0.75 + Math.cos(i * 1.7) * 0.35, 1.2 + Math.sin(i * 2.3) * 0.4, 0.3 + (i % 2) * 0.2);
        c.rotation.set(i, i * 0.6, 0);
      }
      for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.05), additive(0xd8d2c4, 0.8)), 0.3 - i * 0.1, 1.05 + i * 0.16, 0.1);
      const crack = add(new THREE.Mesh(new THREE.RingGeometry(0.25, 0.55, 7), new THREE.MeshBasicMaterial({ color: 0x3a3632, transparent: true, opacity: 0.55 })), 0.1, 0.01, 0.1);
      crack.rotation.x = -Math.PI / 2;
      return { group: g, wide: 1.15, shiftX: 0.3 };
    }
    case 'manu_sofa': {
      const sofa = add(makeSofa(), 1.45, 0, -0.35);
      sofa.rotation.y = 0.35;
      add(burstSprite('BATSCH!', '#ff5a5a', 1.0), 1.05, 2.05, 0.5);
      return { group: g, wide: 1.3, shiftX: 0.45 };
    }
    case 'laca_blick': {
      const tex = starTexture();
      for (let i = 0; i < 3; i++) {
        const st = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xeef8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), 0.45 + i * 0.42, 1.6 - i * 0.02, 0.35);
        st.scale.setScalar(0.55 - i * 0.12);
      }
      add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.05), additive(0xcfe9ff, 0.85)), 1.0, 1.6, 0.3);
      return { group: g, wide: 1.2, shiftX: 0.35 };
    }
    case 'laca_weste': {
      const shell = add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshToonMaterial({ color: 0xf2f4f8, transparent: true, opacity: 0.35, depthWrite: false })), 0.15, 1.15, 0);
      shell.scale.set(1, 1.15, 0.9);
      for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.PlaneGeometry(0.8 - i * 0.08, 0.05), additive(0xffffff, 0.8)), -0.55 - i * 0.05, 0.75 + i * 0.2, 0.2);
      return { group: g, wide: 1.15, shiftX: 0.2 };
    }
    case 'laca_gwagon': {
      const car = add(makeOffroader(), 1.1, 0, -1.3);
      car.scale.setScalar(0.75);
      car.rotation.y = -0.55;
      add(textSprite('70', { width: 0.9, color: '#ffd23c', stroke: '#2a1200' }), 1.0, 2.2, 0.4);
      return { group: g, wide: 1.4, shiftX: 0.55 };
    }
    case 'jaz_99': {
      const nine = add(makeNine(), 0.95, 1.25, -0.4);
      nine.scale.setScalar(0.8);
      nine.rotation.z = -0.15;
      for (let i = 0; i < 6; i++) {
        const st = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), additive(0xcff2ff, 1)), 0.5 + Math.cos(i * 1.1) * 0.6, 1.4 + Math.sin(i * 1.1) * 0.6, 0.5);
        st.scale.set(0.6, 2.2, 0.6);
      }
      return { group: g, wide: 1.3, shiftX: 0.45 };
    }
    case 'bon_team': {
      add(makeSunset(3.2), 0.4, 1.4, -2.4);
      add(palmModel(2.8, 0.4) ?? makePalm(2.8, 0.4), -1.0, 0, -1.6);
      add(palmModel(3.2, -0.3) ?? makePalm(3.2, -0.3), 1.6, 0, -1.8);
      const arr = new Float32Array(POSE_LEN);
      for (let i = 0; i < 2; i++) {
        const rig = crewRig(i + 1);
        rig.apply(toArr(runPose(0.3 + i * 0.4, true), arr), 1);
        add(rig.root, 0.9 + i * 0.6, 0, -0.7 - i * 0.4);
      }
      return { group: g, wide: 1.25, shiftX: 0.3 };
    }
    default:
      return null;
  }
}

export type PortraitKind = 'card' | 'bust' | 'hero' | `art:${string}`;
const cache = new Map<string, string>();

const SIZE: Record<string, [number, number]> = { bust: [256, 256], card: [320, 400], hero: [560, 800], art: [384, 512] };

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
    // menus show the fighters standing tall (D42), the art cards keep the move's pose
    let pose = toArr(showcasePose(id, (set?.stance ?? {}) as PoseDef));
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
    const props = kind.startsWith('art:') ? artProps(kind.slice(4)) : null;
    if (props) {
      props.group.position.copy(rig.root.position);
      scene.add(props.group);
    }
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
      const tall = (kind === 'card' ? 0.62 : 1) * (props?.wide ?? 1);
      const fitH = (Math.max(size.y + 0.35, (size.x + 0.5) / cam.aspect) * tall) / 2;
      cam.fov = kind === 'hero' ? 26 : 30;
      const dist = fitH / Math.tan(((cam.fov / 2) * Math.PI) / 180);
      const target = kind === 'card' ? new THREE.Vector3(c.x, head.y - size.y * 0.25, c.z) : c.add(new THREE.Vector3(props?.shiftX ?? 0, 0.08, 0));
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
    if (props) scene.remove(props.group);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  canvas.width = canvas.height = 1; // the backing store counts against iOS's canvas memory until GC (S12)
  return cache;
}

/** Drop cached renders (models arrived after the menus were drawn). */
export function clearPortraits(): void {
  cache.clear();
}

export function portrait(id: string, kind: PortraitKind): string {
  return cache.get(`${id}:${kind}`) ?? '';
}
