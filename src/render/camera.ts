// Gameplay camera: frames both fighters on the 2D plane, zooms with separation,
// supports shake (trauma), directional impulses and FOV punches. Cinematics can
// take over by providing an explicit pose.
import * as THREE from 'three';

export interface CamShot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export class CameraDirector {
  readonly cam: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3(0, 1.45, 8);
  private target = new THREE.Vector3(0, 1.05, 0);
  private fov = 28;
  private trauma = 0;
  private impulse = new THREE.Vector3();
  private impulseVel = new THREE.Vector3();
  private fovPunch = 0;
  private t = 0;
  private override: CamShot | null = null;
  private overrideBlend = 0;
  private aspect = 16 / 9;
  /** Touch layout (D41): keep the fighters between the HUD bars and the card hand on short, wide phone screens. */
  hudSafe = false;

  constructor() {
    this.cam = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 220);
  }

  resize(aspect: number): void {
    this.aspect = aspect;
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Push the camera along a world direction (e.g. hit direction). */
  kick(dx: number, dy: number, dz = 0): void {
    this.impulseVel.x += dx;
    this.impulseVel.y += dy;
    this.impulseVel.z += dz;
  }

  punch(amount: number): void {
    this.fovPunch = Math.min(6, this.fovPunch + amount);
  }

  setOverride(shot: CamShot | null): void {
    this.override = shot;
  }

  /** a/b: fighter visual positions (meters). */
  update(dt: number, ax: number, ay: number, bx: number, by: number, zoomBias = 0): void {
    this.t += dt;
    const mid = (ax + bx) / 2;
    const sep = Math.abs(ax - bx);
    const maxY = Math.max(ay, by);
    const halfW = Math.max(3.0, sep / 2 + 1.45) + zoomBias;
    const vfov = 28;
    const tanH = Math.tan(((vfov / 2) * Math.PI) / 180) * this.aspect;
    let dist = halfW / tanH;
    // a minimum visible height: on a 2.2:1 phone the width-based fit alone frames the fighters head to toe, under
    // the HUD bars and the card hand
    const halfH = this.hudSafe ? 1.75 : 1.3;
    dist = Math.max(dist, halfH / Math.tan(((vfov / 2) * Math.PI) / 180));
    dist = Math.min(18, Math.max(4.6, dist));
    const clampedMid = Math.max(-7.5 + halfW * 0.6, Math.min(7.5 - halfW * 0.6, mid));
    // touch layout: aim a little lower so the feet stand above the cards and the heads stay clear of the bars
    const lift = this.hudSafe ? -0.18 : 0;
    const desiredPos = new THREE.Vector3(clampedMid, 1.3 + lift + maxY * 0.35 + dist * 0.03, dist);
    const desiredTarget = new THREE.Vector3(clampedMid, 1.12 + lift + maxY * 0.45, 0);
    const k = 1 - Math.exp(-dt * 7);
    this.pos.lerp(desiredPos, k);
    this.target.lerp(desiredTarget, k);
    this.fov += (vfov - this.fov) * k;

    // cinematic override blend
    const ob = this.override ? 1 : 0;
    this.overrideBlend += (ob - this.overrideBlend) * (1 - Math.exp(-dt * (this.override ? 30 : 6)));
    let px = this.pos.x;
    let py = this.pos.y;
    let pz = this.pos.z;
    let tx = this.target.x;
    let ty = this.target.y;
    let tz = this.target.z;
    let fov = this.fov;
    if (this.override) {
      const w = this.overrideBlend;
      px += (this.override.pos.x - px) * w;
      py += (this.override.pos.y - py) * w;
      pz += (this.override.pos.z - pz) * w;
      tx += (this.override.target.x - tx) * w;
      ty += (this.override.target.y - ty) * w;
      tz += (this.override.target.z - tz) * w;
      fov += (this.override.fov - fov) * w;
    }

    // impulse spring
    const spring = 140;
    const damp = 14;
    this.impulseVel.addScaledVector(this.impulse, -spring * dt);
    this.impulseVel.multiplyScalar(Math.exp(-damp * dt));
    this.impulse.addScaledVector(this.impulseVel, dt);

    // trauma shake
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const sh = this.trauma * this.trauma;
    const n = (o: number) => Math.sin(this.t * 61 + o) * 0.6 + Math.sin(this.t * 37 + o * 2.3) * 0.4;
    const sx = n(1) * sh * 0.18;
    const sy = n(7) * sh * 0.14;
    this.fovPunch *= Math.exp(-dt * 9);

    this.cam.position.set(px + sx + this.impulse.x, py + sy + this.impulse.y, pz + this.impulse.z);
    this.cam.lookAt(tx + sx * 0.5, ty + sy * 0.5, tz);
    this.cam.rotation.z += n(13) * sh * 0.02;
    this.cam.fov = fov - this.fovPunch;
    this.cam.updateProjectionMatrix();
  }
}
