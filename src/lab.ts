// Visual lab: renders rigs in chosen poses for screenshot-based verification.
// /?lab=poses&a=jazeek&b=bonez&pose=stance|crouch|hitHigh|...&zoom=2
import * as THREE from 'three';
import { showcasePose } from './render/anims/showcase';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HandProp } from './render/handProps';
import { Crowd, type Behaviour, type CrowdStyle } from './render/crowd';
import type { PropId } from './render/propModels';
import { Arena } from './render/arena';
import { CourtyardArena } from './render/arenas/courtyard';
import { PodcastArena } from './render/arenas/podcast';
import { HinterhofArena } from './render/arenas/hinterhof';
import { type Look, PostFX } from './render/post';
import { ANIM_SETS, motionOf } from './render/animator';
import { getFighter } from './core/registry';
import type { AnimSet } from './render/anims/types';
import { buildCharacter } from './render/characters';
import { CINEMATICS } from './render/cinematics';
import { Clip, compose, sampleDef, stabilizeHead, toArr, type PoseDef } from './render/pose';

export function runLab(canvas: HTMLCanvasElement): void {
  if (new URLSearchParams(location.search).get('lab') === 'bake-export') {
    // dev tool: serialise the courtyard for tools/arena/bake.py (read window.__bake)
    const renderer = new THREE.WebGLRenderer({ canvas });
    const arena = new CourtyardArena(new THREE.Scene(), renderer, 'high');
    (window as unknown as { __bake: string }).__bake = JSON.stringify(arena.bakeScene());
    return;
  }
  if (new URLSearchParams(location.search).get('lab') === 'ui3') {
    void import('./ui/v3/lab3').then((m) => m.ui3Lab(canvas));
    return;
  }
  if (new URLSearchParams(location.search).get('lab') === 'props') {
    propsLab(canvas);
    return;
  }
  if (new URLSearchParams(location.search).get('lab') === 'crowd') {
    crowdLab(canvas);
    return;
  }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const arenaId = new URLSearchParams(location.search).get('arena');
  const arena =
    arenaId === 'club' ? new Arena(scene) : arenaId === 'toon' ? new HinterhofArena(scene) : arenaId === 'courtyard' ? new CourtyardArena(scene, renderer) : new PodcastArena(scene, renderer, 'high');
  const cam = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 200);
  const params = new URLSearchParams(location.search);
  const which = params.get('pose') ?? 'stance';
  const zoom = Number(params.get('zoom') ?? '1');
  const cx = Number(params.get('cx') ?? 0);
  cam.position.set(cx, Number(params.get('cy') ?? 1.35), 9 / zoom);
  cam.lookAt(cx, Number(params.get('ty') ?? 1.0), 0);
  const ids = [params.get('a') ?? 'jazeek', params.get('b') ?? 'bonez'];
  // pose=move:<key>:<frame> samples a move clip (e.g. move:jaz_5L:5), walkF|walkB:<phase 0..4> the walk cycle,
  // motion:<clip>:<frame> a generated movement/reaction clip (hitHigh, land, dashF, ...), else a stance/reaction name
  const labPose = (set: AnimSet, spec: string): PoseDef => {
    const [kind, key, fr] = spec.split(':');
    const M = motionOf(set) as unknown as Record<string, Clip>;
    if (kind === 'move' && set.moves[key]) return sampleDef(set.moves[key], Number(fr ?? 1));
    // cine:<id>:<frame> = the attacker clip of a cinematic, cinedef:<id>:<frame> = its victim clip (root x/y zeroed so
    // the figure stays in the frame; &cineroot=1 keeps them)
    if ((kind === 'cine' || kind === 'cinedef') && CINEMATICS[key]) {
      const cd = CINEMATICS[key];
      const p = sampleDef(kind === 'cine' ? cd.atk : typeof cd.def === 'function' ? cd.def(set) : cd.def, Number(fr ?? 0));
      return params.get('cineroot') ? p : { ...p, x: 0, y: 0 };
    }
    if (kind === 'walkF' || kind === 'walkB') return sampleDef(M[kind], Number(key ?? 0));
    if (kind === 'motion' && M[key]) return sampleDef(M[key], Number(fr ?? 0));
    const pj = params.get('pj'); // pose override as JSON (PoseDef), layered on top: fast pose iteration
    if (pj) return compose(spec === 'showcase' ? showcasePose(set.id, set.stance) : set.stance, JSON.parse(pj) as PoseDef);
    if (spec === 'showcase') return showcasePose(set.id, set.stance);
    return spec === 'stance' ? set.stance : ((set.r as Record<string, PoseDef>)[spec] ?? set.stance);
  };
  const rigs: ReturnType<typeof buildCharacter>[] = [];
  ids.forEach((id, i) => {
    const set = ANIM_SETS[id];
    const pose = labPose(set, which);
    const rig = buildCharacter(id, Number(params.get(i ? 'pb' : 'pa') ?? 0));
    rig.root.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    scene.add(rig.root);
    rig.root.position.set(i ? 0.9 : -0.9, 0, 0);
    rig.apply(toArr(pose), i ? -1 : 1);
    if (params.get('teeth') && rig.props.teeth) rig.props.teeth.visible = true;
    rigs.push(rig);
  });
  // portrait framing: &frame=face|bust|body|full (&who=0|1, &yaw=deg around the fighter, 0 = 3/4 front)
  const frame = params.get('frame');
  if (frame) {
    const who = rigs[Number(params.get('who') ?? 0)];
    scene.updateMatrixWorld(true);
    const head = who.joints.head.getWorldPosition(new THREE.Vector3());
    const hips = who.joints.hips.getWorldPosition(new THREE.Vector3());
    const facing = Number(params.get('who') ?? 0) ? -1 : 1;
    const yaw = (Number(params.get('yaw') ?? 0) * Math.PI) / 180;
    const dir = new THREE.Vector3(facing * Math.cos(0.75 + yaw), 0, Math.sin(0.75 + yaw));
    const hand = who.joints.haL.getWorldPosition(new THREE.Vector3());
    const fy = Number(params.get('fy') ?? 0.07);
    const top = who.joints.head.getWorldPosition(new THREE.Vector3()).y + 0.45;
    const spec = { full: [new THREE.Vector3(hips.x, top * 0.5, hips.z), top * 2.3, 28], hand: [hand, 0.55, 22], face: [head.clone().add(new THREE.Vector3(0, fy, 0)), Number(params.get('fd') ?? 0.75), 18], bust: [head.clone().lerp(hips, 0.35), 1.6, 26], body: [hips.clone().setY(hips.y * 0.95), 4.2, 28] }[frame] as [THREE.Vector3, number, number];
    const [target, dist, fov] = spec;
    cam.fov = fov;
    cam.position.copy(target).addScaledVector(dir, dist).add(new THREE.Vector3(0, 0.03 * dist, 0));
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    if (params.get('hide') === 'other') rigs.forEach((r, i) => (r.root.visible = i === Number(params.get('who') ?? 0)));
  }
  if (params.get('hide') === 'all') rigs.forEach((r) => (r.root.visible = false));
  /** Re-pose a fighter without reloading (scripts/posesheet.mjs): same syntax as &pose=. */
  const setPose = (i: number, spec: string) => {
    const arr = toArr(labPose(ANIM_SETS[ids[i]], spec));
    // same head stabiliser as the in-game animator (moves 0.85, movement 0.7)
    const hw = params.get('head') !== null ? Number(params.get('head')) : spec.startsWith('move:') ? (ANIM_SETS[ids[i]].headFree?.[spec.split(':')[1]] ?? 0.85) : spec.startsWith('walk') ? 0.7 : 0;
    stabilizeHead(arr, hw);
    rigs[i].apply(arr, i ? -1 : 1);
  };
  /** Reach check (scripts/reach.mjs): world positions of fists/feet for a pose, the fighter at the origin facing +x. */
  const reach = (i: number, spec: string) => {
    setPose(i, spec);
    const r = rigs[i];
    const keep = r.root.position.clone();
    r.root.position.set(0, 0, 0);
    r.root.scale.x = Math.abs(r.root.scale.x);
    r.root.updateMatrixWorld(true);
    const out: Record<string, number[]> = {};
    for (const j of ['haL', 'haR', 'ftL', 'ftR', 'knL', 'knR', 'elL', 'elR', 'head'] as const) {
      const v = r.joints[j].getWorldPosition(new THREE.Vector3());
      out[j] = [v.x, v.y, v.z];
    }
    r.root.position.copy(keep);
    return out;
  };
  const moveData = (id: string) => getFighter(id).moves;
  (window as unknown as { __lab: unknown }).__lab = { scene, cam, rigs, setPose, reach, moveData };
  // hand prop test: &hp=mic|joint&hph=haR&hpo=x,y,z&hpr=x,y,z (grip in hand-local axes, see render/handProps.ts)
  const hpId = params.get('hp') as PropId | null;
  const hp = hpId ? new HandProp(hpId, scene) : null;
  const num3 = (v: string | null) => (v ? (v.split(',').map(Number) as [number, number, number]) : undefined);
  const hpGrip = params.get('hpo') || params.get('hpr') ? { pos: num3(params.get('hpo')) ?? [0, 0, 0], rot: num3(params.get('hpr')) ?? [0, 0, 0] } : undefined;
  const post = new PostFX(renderer, scene, cam, params.get('q') === 'low' ? 'low' : 'high');
  post.applyLook((arena as { look?: Look }).look);
  post.setSize(window.innerWidth, window.innerHeight);
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    arena.update(t, 0.5 + 0.5 * Math.sin(t * 9.4));
    hp?.place(rigs[Number(params.get('who') ?? 0)], (params.get('hph') as 'haL' | 'haR') ?? 'haR', true, hpGrip);
    post.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
}

/** /?lab=props&view=front|side|top: every prop of public/assets/props in a row next to a 1.8 m reference column, on a
 *  1 m grid (+X = right/forward, camera looks down -Z), for checking orientation and size of the PO's models. */
function propsLab(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x30304a);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const grid = new THREE.GridHelper(40, 40, 0xffffff, 0x777799);
  scene.add(grid);
  const params = new URLSearchParams(location.search);
  const ids = (params.get('ids') ?? 'joint,heart,mic,diamond,ball,croc,car,palm').split(',');
  const ref = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xff4f7b }));
  ref.position.set(-1.5, 0.9, 0);
  scene.add(ref);
  const zoom = Number(params.get('zoom') ?? 1);
  const loader = new GLTFLoader();
  let x = 0;
  const gap = Number(params.get('gap') ?? 0.6);
  const placed: THREE.Object3D[] = [];
  const done = Promise.all(
    ids.map((id) => loader.loadAsync(`assets/props/${id}.glb`).then((g) => ({ id, g }))),
  ).then((list) => {
    for (const { g } of list) {
      const jaw = g.scene.getObjectByName('jaw');
      if (jaw) jaw.rotation.z = (-Number(params.get('jaw') ?? 0) * Math.PI) / 180;
      const box = new THREE.Box3().setFromObject(g.scene);
      g.scene.position.x = x - box.min.x;
      x += box.max.x - box.min.x + gap;
      scene.add(g.scene);
      placed.push(g.scene);
    }
  });
  const cam = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 200);
  const view = params.get('view') ?? 'front';
  const fit = () => {
    // frame the props (and the reference column only when ref=1)
    const box = new THREE.Box3();
    for (const o of placed) box.expandByObject(o);
    if (params.get('ref') === '1') box.expandByObject(ref);
    ref.visible = params.get('ref') !== '0';
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const d = (Math.max(size.x, size.y, size.z * 0.5) * 2.2) / zoom + 0.05;
    if (view === 'top') cam.position.set(c.x, c.y + d, c.z + 0.001);
    else if (view === 'side') cam.position.set(c.x + d, c.y + d * 0.15, c.z);
    else cam.position.set(c.x, c.y + d * 0.15, c.z + d);
    cam.near = d / 100;
    cam.updateProjectionMatrix();
    cam.lookAt(c);
  };
  void done.then(() => {
    fit();
    (window as unknown as { __propsReady: boolean }).__propsReady = true;
  });
  const loop = () => {
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
}

/** Crowd close-ups: /?lab=crowd&style=hipster|rocker&beh=jump,cheer,..&t=1.3&n=2 (one column per behaviour, n rows). */
function crowdLab(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const params = new URLSearchParams(location.search);
  const style = (params.get('style') ?? 'hipster') as CrowdStyle;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(style === 'hipster' ? 0x8a6a8a : 0x1a1d30);
  scene.add(new THREE.HemisphereLight(0xffe6cc, 0x6a4a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xffc890, 1.8);
  sun.position.set(-3, 5, 6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6ad8ff, 1.0);
  rim.position.set(4, 4, -6);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const all: Behaviour[] = style === 'hipster' ? ['jump', 'cheer', 'film', 'pump', 'clap', 'sway', 'mosh'] : ['crossed', 'nod', 'drink', 'point', 'nod', 'crossed'];
  const behs = (params.get('beh')?.split(',') as Behaviour[] | undefined) ?? all;
  const rows = Number(params.get('n') ?? 2);
  const spots = behs.flatMap((b, i) => Array.from({ length: rows }, (_, r) => ({ x: (i - (behs.length - 1) / 2) * 1.1, z: -r * 1.4, behaviour: b, yaw: -Math.atan2(-((i - (behs.length - 1) / 2) * 1.1) * 0.15, 1) })));
  const crowd = new Crowd(style, spots, Number(params.get('seed') ?? 5), 'high');
  scene.add(crowd.group);
  const ref = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xff4f7b }));
  ref.position.set(((behs.length + 1) / 2) * 1.1, 0.9, 0);
  scene.add(ref);
  const zoom = Number(params.get('zoom') ?? 1);
  const cam = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 200);
  const d = ((behs.length * 1.1 + 1) * 1.9) / zoom;
  cam.position.set(Number(params.get('cx') ?? 0), 1.3 + Number(params.get('cy') ?? 0), d);
  cam.lookAt(Number(params.get('cx') ?? 0), 1.0 + Number(params.get('cy') ?? 0), -0.5);
  const fixed = params.get('t');
  const t0 = performance.now();
  const loop = () => {
    const t = fixed != null ? Number(fixed) : (performance.now() - t0) / 1000;
    crowd.update(t, t * 1.5, Number(params.get('hype') ?? 0.5), 1 / 60);
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as { __crowdReady: boolean }).__crowdReady = true;
}
