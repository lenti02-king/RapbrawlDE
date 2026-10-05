// Visual lab: renders rigs in chosen poses for screenshot-based verification.
// /?lab=poses&a=jazeek&b=bonez&pose=stance|crouch|hitHigh|...&zoom=2
import * as THREE from 'three';
import { Arena } from './render/arena';
import { CourtyardArena } from './render/arenas/courtyard';
import { PodcastArena } from './render/arenas/podcast';
import { HinterhofArena } from './render/arenas/hinterhof';
import { type Look, PostFX } from './render/post';
import { ANIM_SETS, motionOf } from './render/animator';
import { getFighter } from './core/registry';
import type { AnimSet } from './render/anims/types';
import { buildCharacter } from './render/characters';
import { Clip, sampleDef, toArr, type PoseDef } from './render/pose';

export function runLab(canvas: HTMLCanvasElement): void {
  if (new URLSearchParams(location.search).get('lab') === 'bake-export') {
    // dev tool: serialise the courtyard for tools/arena/bake.py (read window.__bake)
    const renderer = new THREE.WebGLRenderer({ canvas });
    const arena = new CourtyardArena(new THREE.Scene(), renderer, 'high');
    (window as unknown as { __bake: string }).__bake = JSON.stringify(arena.bakeScene());
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
    if (kind === 'walkF' || kind === 'walkB') return sampleDef(M[kind], Number(key ?? 0));
    if (kind === 'motion' && M[key]) return sampleDef(M[key], Number(fr ?? 0));
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
  /** Re-pose a fighter without reloading (scripts/posesheet.mjs): same syntax as &pose=. */
  const setPose = (i: number, spec: string) => rigs[i].apply(toArr(labPose(ANIM_SETS[ids[i]], spec)), i ? -1 : 1);
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
  const post = new PostFX(renderer, scene, cam, params.get('q') === 'low' ? 'low' : 'high');
  post.applyLook((arena as { look?: Look }).look);
  post.setSize(window.innerWidth, window.innerHeight);
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    arena.update(t, 0.5 + 0.5 * Math.sin(t * 9.4));
    post.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
}
