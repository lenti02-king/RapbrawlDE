// Visual lab: renders rigs in chosen poses for screenshot-based verification.
// /?lab=poses&a=jazeek&b=bonez&pose=stance|crouch|hitHigh|...&zoom=2
import * as THREE from 'three';
import { Arena } from './render/arena';
import { CourtyardArena } from './render/arenas/courtyard';
import { HinterhofArena } from './render/arenas/hinterhof';
import { PostFX } from './render/post';
import { ANIM_SETS } from './render/animator';
import { buildCharacter } from './render/characters';
import { toArr, type PoseDef } from './render/pose';

export function runLab(canvas: HTMLCanvasElement): void {
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
  const arena = arenaId === 'club' ? new Arena(scene) : arenaId === 'toon' ? new HinterhofArena(scene) : new CourtyardArena(scene, renderer);
  const cam = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 200);
  const params = new URLSearchParams(location.search);
  const which = params.get('pose') ?? 'stance';
  const zoom = Number(params.get('zoom') ?? '1');
  const cx = Number(params.get('cx') ?? 0);
  cam.position.set(cx, Number(params.get('cy') ?? 1.35), 9 / zoom);
  cam.lookAt(cx, Number(params.get('ty') ?? 1.0), 0);
  const ids = [params.get('a') ?? 'jazeek', params.get('b') ?? 'bonez'];
  ids.forEach((id, i) => {
    const set = ANIM_SETS[id];
    const pose: PoseDef = which === 'stance' ? set.stance : ((set.r as Record<string, PoseDef>)[which] ?? set.stance);
    const rig = buildCharacter(id, Number(params.get(i ? 'pb' : 'pa') ?? 0));
    rig.root.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    scene.add(rig.root);
    rig.root.position.set(i ? 0.9 : -0.9, 0, 0);
    rig.apply(toArr(pose), i ? -1 : 1);
    if (params.get('teeth') && rig.props.teeth) rig.props.teeth.visible = true;
  });
  const post = new PostFX(renderer, scene, cam, params.get('q') === 'low' ? 'low' : 'high');
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
