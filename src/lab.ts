// Visual lab: renders rigs in chosen poses for screenshot-based verification.
// Open with ?lab=poses
import * as THREE from 'three';
import { Arena } from './render/arena';
import { buildCharacter } from './render/characters';
import { BRICK_STANCE, VOLT_STANCE, reactions } from './render/anims/stances';
import { toArr, type PoseDef } from './render/pose';

export function runLab(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const arena = new Arena(scene);
  const cam = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 200);
  const params = new URLSearchParams(location.search);
  const which = params.get('pose') ?? 'stance';
  const zoom = Number(params.get('zoom') ?? '1');
  cam.position.set(0, 1.35, 9 / zoom);
  cam.lookAt(0, 1.0, 0);
  const rv = reactions(VOLT_STANCE, 0.92);
  const rb = reactions(BRICK_STANCE, 0.98);
  const pick = (r: ReturnType<typeof reactions>, st: PoseDef): PoseDef =>
    which === 'stance' ? st : ((r as Record<string, PoseDef>)[which] ?? st);
  const volt = buildCharacter('volt', 0);
  const brick = buildCharacter('brick', 0);
  scene.add(volt.root, brick.root);
  volt.root.position.set(-0.9, 0, 0);
  brick.root.position.set(0.9, 0, 0);
  volt.apply(toArr(pick(rv, VOLT_STANCE)), 1);
  brick.apply(toArr(pick(rb, BRICK_STANCE)), -1);
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    arena.update(t, 0.5 + 0.5 * Math.sin(t * 9.4));
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as { __labReady: boolean }).__labReady = true;
}
