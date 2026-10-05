// Post-processing: multisampled HDR render -> bloom (lights, neon, windows) -> tone mapping
// -> colour grade + vignette. Quality tiers keep phones fast.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type Quality = 'low' | 'medium' | 'high';

export function detectQuality(): Quality {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  try {
    const saved = JSON.parse(localStorage.getItem('rapbrawl.quality') ?? 'null');
    if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  } catch {
    /* storage unavailable */
  }
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return coarse ? 'medium' : 'high';
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.06 },
    uLift: { value: new THREE.Vector3(0.012, 0.008, 0.02) },
    uGain: { value: new THREE.Vector3(1.02, 1.0, 0.97) },
    /** 0..1: manga impact frame (ink / paper / red tri-tone), see ToonFX.impactFrame */
    uImpact: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform float uSaturation; uniform float uContrast;
    uniform vec3 uLift; uniform vec3 uGain; uniform float uImpact; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      col = col * uGain + uLift * (1.0 - col);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.25, 1.0)));
      col *= mix(1.0 - uVignette, 1.0, v);
      if (uImpact > 0.0) {
        // impact frame: bright shapes turn to ink, dark ones to paper, a red band in between
        float il = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
        vec3 paper = vec3(1.0, 0.96, 0.9);
        vec3 ink = vec3(0.07, 0.02, 0.07);
        vec3 red = vec3(0.86, 0.08, 0.2);
        vec3 tri = mix(paper, red, smoothstep(0.3, 0.34, il));
        tri = mix(tri, ink, smoothstep(0.5, 0.54, il));
        col = mix(col, tri, uImpact);
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/** Per-arena post settings (an arena may expose `look`, e.g. the podcast set's AgX + neon-only bloom). */
export interface Look {
  toneMapping?: THREE.ToneMapping;
  bloomThreshold: number;
  bloomStrength: number;
  bloomRadius: number;
  exposure: number;
  saturation?: number;
  contrast?: number;
}

export class PostFX {
  readonly composer: EffectComposer | null = null;
  readonly bloom: UnrealBloomPass | null = null;
  readonly grade: ShaderPass | null = null;
  private renderPass: RenderPass | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    readonly quality: Quality,
  ) {
    if (quality === 'low') return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: quality === 'high' ? 4 : 2,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    const res = new THREE.Vector2(size.x, size.y).multiplyScalar(quality === 'high' ? 0.5 : 0.35);
    this.bloom = new UnrealBloomPass(res, 0.55, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  applyLook(look: Look | undefined): void {
    if (!look) return;
    this.renderer.toneMappingExposure = look.exposure;
    if (look.toneMapping !== undefined) this.renderer.toneMapping = look.toneMapping;
    if (this.grade && look.saturation !== undefined) this.grade.uniforms.uSaturation.value = look.saturation;
    if (this.grade && look.contrast !== undefined) this.grade.uniforms.uContrast.value = look.contrast;
    if (this.bloom) {
      this.bloom.threshold = look.bloomThreshold;
      this.bloom.strength = look.bloomStrength;
      this.bloom.radius = look.bloomRadius;
    }
  }

  setCamera(cam: THREE.Camera): void {
    if (this.renderPass) this.renderPass.camera = cam;
  }

  setSize(w: number, h: number): void {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
