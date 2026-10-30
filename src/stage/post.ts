/**
 * The stage's image pipeline after the elements have drawn. Elements draw into one
 * of two targets: `scene` (trailed: sparks, bass, bloom) or `crisp` (elements that
 * carry their own history — the melody's 4 s trail, expanding rings, the scope —
 * and would only smear into filled discs and bands under full feedback):
 *
 *   feedback  F = max(scene, crisp · ECHO, warp(F_prev) · persist)
 *   combine   D = max(F, crisp)          (crisp shows sharp, its echoes faint)
 *   glow      bloom of D (the Living Canvas's Kawase chain)
 *   final     mirror → accents → tone map → fluid layers → × dim → sRGB
 *
 * Feedback is a max, not a sum: a static scene is a fixed point of it, so when
 * the music stops (musicDt = 0 → persist = 1, no warp) the picture is exactly
 * frozen instead of brightening or fading frame by frame. Persistence and warp are
 * per music second, so trails also don't depend on the frame rate.
 */
import { BLOOM_DOWN, BLOOM_PRE, BLOOM_UP } from '../visual/living/shaders';
import { createPair, createProgram, createTarget, deletePair, deleteTarget, formats, type GL, type Pair, type Program, QUAD_VS, type Target } from './gl';
import type { Accent, Look } from './types';

const FEEDBACK = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uCrisp, uPrev;
uniform float uEcho;
uniform float uPersist, uZoom, uRot, uAspect;
uniform bool uIdentity;
void main() {
  vec3 prev = vec3(0.0);
  if (uPersist > 0.0) {
    vec2 uv = vUv;
    // An exact texel-centre read when nothing moves: repeated resampling would blur a frozen picture.
    if (!uIdentity) {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float c = cos(uRot), s = sin(uRot);
      p = mat2(c, -s, s, c) * p / uZoom;
      uv = p / vec2(uAspect, 1.0) + 0.5;
    }
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    prev = texture(uPrev, uv).rgb * uPersist * inside.x * inside.y;
  }
  outColor = vec4(max(max(texture(uScene, vUv).rgb, texture(uCrisp, vUv).rgb * uEcho), prev), 1.0);
}`;

const COMBINE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFb, uCrisp;
void main() { outColor = vec4(max(texture(uFb, vUv).rgb, texture(uCrisp, vUv).rgb), 1.0); }
`;

const FINAL = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFb, uBloom, uLayer0, uLayer1;
uniform float uGain0, uGain1, uGlow, uDim, uTime, uAspect;
uniform int uMirror;
uniform vec4 uAcc[4];     // kind (0 flash, 1 shock, 2 swell, -1 none), strength, age, -
uniform vec3 uAccCol[4];
uniform vec2 uRes;
const float ACCENT_LIFE = 1.5;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 mirrorUv(vec2 uv) {
  if (uMirror == 2) {
    uv.x = 0.5 - abs(uv.x - 0.5);
  } else if (uMirror == 4) {
    uv = 0.5 - abs(uv - 0.5);
  } else if (uMirror > 4) {
    // Kaleidoscope: fold the angle into one wedge, reflected so the seams are continuous.
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    float seg = 6.2831853 / float(uMirror);
    float a = mod(atan(p.y, p.x) + 1.5707963, seg);
    a = abs(a - seg * 0.5) + 1.5707963 - seg * 0.5;
    p = length(p) * vec2(cos(a), sin(a));
    uv = p / vec2(uAspect, 1.0) + 0.5;
  }
  return uv;
}
void main() {
  vec2 uv = vUv;
  float exposure = 1.0;
  float aberr = 0.0;
  vec3 flash = vec3(0.0);
  vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
  for (int i = 0; i < 4; i++) {
    vec4 a = uAcc[i];
    if (a.x < -0.5) continue;
    float life = clamp(a.z / ACCENT_LIFE, 0.0, 1.0);
    if (a.x < 0.5) {
      flash += uAccCol[i] * a.y * exp(-a.z * 6.0) * 1.6;
    } else if (a.x < 1.5) {
      // Shock: a ring of displacement rushing out from the centre, with a colour split.
      float r = length(q);
      float R = a.z * 1.1;
      float band = exp(-pow((r - R) / 0.07, 2.0)) * a.y * (1.0 - life);
      vec2 dir = r > 1e-4 ? q / r : vec2(0.0);
      uv -= dir / vec2(uAspect, 1.0) * band * 0.035;
      aberr += band;
      flash += uAccCol[i] * band * 0.35;
    } else {
      // Swell: the whole picture breathes up and back.
      exposure *= 1.0 + a.y * 0.8 * sin(3.14159 * life);
    }
  }
  uv = mirrorUv(uv);
  vec3 col;
  if (aberr > 0.001) {
    vec2 d = (uv - 0.5) * aberr * 0.02;
    col = vec3(texture(uFb, uv + d).r, texture(uFb, uv).g, texture(uFb, uv - d).b);
  } else {
    col = texture(uFb, uv).rgb;
  }
  col += texture(uBloom, uv).rgb * uGlow * (0.6 + 0.4 * exposure);
  col += flash;
  col = aces(col * exposure * 0.9);
  // The fluid arrives finished (its own bloom and grade): screen it over, don't tone-map it twice.
  vec3 l0 = toLinear(texture(uLayer0, uv).rgb) * uGain0;
  vec3 l1 = toLinear(texture(uLayer1, uv).rgb) * uGain1;
  col = 1.0 - (1.0 - col) * (1.0 - clamp(l0, 0.0, 1.0)) * (1.0 - clamp(l1, 0.0, 1.0));
  col *= mix(1.0, smoothstep(1.3, 0.3, length(q)), 0.25);
  col *= uDim;
  vec3 o = toSrgb(clamp(col, 0.0, 1.0));
  // Dither seeded by music time: frozen with the picture.
  o += (hash12(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5) / 255.0;
  outColor = vec4(o, 1.0);
}`;

const BLOOM_LEVELS = 6;
/** How bright a crisp element's own trail starts in the feedback. */
const ECHO = 0.3;
const ACCENT_KIND = { flash: 0, shock: 1, swell: 2 } as const;

export interface FinishParams {
  look: Look;
  accents: Accent[];
  layers: { tex: WebGLTexture; gain: number }[];
  dim: number;
  time: number;
}

export class StagePost {
  scene!: Target;
  crisp!: Target;
  private display!: Target;
  private fb!: Pair;
  private bloom: Target[] = [];
  private p: Record<string, Program> = {};
  private vao: WebGLVertexArrayObject;
  /** A 1×1 black texture for unused layer slots. */
  private black: WebGLTexture;
  w = 0;
  h = 0;

  constructor(private gl: GL, private float: boolean) {
    const list: [string, string][] = [['feedback', FEEDBACK], ['combine', COMBINE], ['final', FINAL], ['pre', BLOOM_PRE], ['down', BLOOM_DOWN], ['up', BLOOM_UP]];
    for (const [k, fs] of list) this.p[k] = createProgram(gl, QUAD_VS, fs, 'stage.' + k);
    this.vao = gl.createVertexArray()!;
    this.black = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.black);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  allocate(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    const f = formats(gl, this.float).rgba;
    for (const t of [this.scene, this.crisp, this.display]) deleteTarget(gl, t);
    deletePair(gl, this.fb);
    this.bloom.forEach((t) => deleteTarget(gl, t));
    this.scene = createTarget(gl, w, h, f);
    this.crisp = createTarget(gl, w, h, f);
    this.display = createTarget(gl, w, h, f);
    this.fb = createPair(gl, w, h, f);
    this.bloom = [];
    let bw = w >> 1;
    let bh = h >> 1;
    for (let i = 0; i < BLOOM_LEVELS && bw >= 4 && bh >= 4; i++) {
      this.bloom.push(createTarget(gl, bw, bh, f));
      bw >>= 1;
      bh >>= 1;
    }
    this.w = w;
    this.h = h;
  }

  /** Draws the full-screen triangle into `t` (null = the canvas). */
  quad() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  private target(t: Target | null, w: number, h: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, w, h);
  }

  private bind(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return unit;
  }

  /** Clears both element targets. */
  beginScene() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 1);
    for (const t of [this.scene, this.crisp]) {
      this.target(t, this.w, this.h);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  /** Forgets the trails: clears the feedback pair to zero, as a freshly allocated one is. */
  clearHistory() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    for (const t of [this.fb.read, this.fb.write]) {
      this.target(t, this.w, this.h);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  /** Binds the trailed (`crisp` = false) or the crisp element target, without clearing. */
  bindScene(crisp: boolean) {
    this.target(crisp ? this.crisp : this.scene, this.w, this.h);
  }

  /**
   * Folds the scene into the feedback buffer. `musicDt` drives everything: trails
   * last ~0.03…1.2 music seconds with `look.trails`, and the old image zooms and turns
   * by `look.warp × musicDt` (direction from the gesture's swirl).
   */
  feedback(look: Look, musicDt: number, swirl: number) {
    const gl = this.gl;
    const tau = 0.03 + 1.2 * Math.pow(Math.min(1, Math.max(0, look.trails)), 2);
    const persist = musicDt > 0 ? Math.exp(-musicDt / tau) : 1;
    const warp = Math.min(1, Math.max(0, look.warp)) * musicDt;
    const zoom = 1 + warp * 0.15;
    const rot = warp * 0.25 * (swirl >= 0 ? 1 : -1) * (0.3 + 0.7 * Math.min(1, Math.abs(swirl)));
    const { u, prog } = this.p.feedback;
    gl.useProgram(prog);
    gl.uniform1i(u.uScene, this.bind(0, this.scene.tex));
    gl.uniform1i(u.uPrev, this.bind(1, this.fb.read.tex));
    gl.uniform1i(u.uCrisp, this.bind(2, this.crisp.tex));
    gl.uniform1f(u.uEcho, ECHO);
    gl.uniform1f(u.uPersist, look.trails <= 0 ? 0 : persist);
    gl.uniform1f(u.uZoom, zoom);
    gl.uniform1f(u.uRot, rot);
    gl.uniform1f(u.uAspect, this.w / this.h);
    gl.uniform1i(u.uIdentity, zoom === 1 && rot === 0 ? 1 : 0);
    this.target(this.fb.write, this.w, this.h);
    this.quad();
    this.fb.swap();
    const c = this.p.combine;
    gl.useProgram(c.prog);
    gl.uniform1i(c.u.uFb, this.bind(0, this.fb.read.tex));
    gl.uniform1i(c.u.uCrisp, this.bind(1, this.crisp.tex));
    this.target(this.display, this.w, this.h);
    this.quad();
  }

  finish(outW: number, outH: number, f: FinishParams) {
    const gl = this.gl;
    const src = this.display;
    const b = this.bloom;
    let pr = this.p.pre;
    gl.useProgram(pr.prog);
    gl.uniform1i(pr.u.uSrc, this.bind(0, src.tex));
    gl.uniform2f(pr.u.uTexel, 1 / this.w, 1 / this.h);
    gl.uniform1f(pr.u.uThreshold, 0.35);
    gl.uniform1f(pr.u.uKnee, 0.35);
    this.target(b[0], b[0].w, b[0].h);
    this.quad();
    pr = this.p.down;
    gl.useProgram(pr.prog);
    for (let i = 1; i < b.length; i++) {
      gl.uniform1i(pr.u.uSrc, this.bind(0, b[i - 1].tex));
      gl.uniform2f(pr.u.uTexel, 1 / b[i - 1].w, 1 / b[i - 1].h);
      this.target(b[i], b[i].w, b[i].h);
      this.quad();
    }
    pr = this.p.up;
    gl.useProgram(pr.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = b.length - 1; i > 0; i--) {
      gl.uniform1i(pr.u.uSrc, this.bind(0, b[i].tex));
      gl.uniform2f(pr.u.uTexel, 0.5 / b[i].w, 0.5 / b[i].h);
      this.target(b[i - 1], b[i - 1].w, b[i - 1].h);
      this.quad();
    }
    gl.disable(gl.BLEND);

    pr = this.p.final;
    const u = pr.u;
    gl.useProgram(pr.prog);
    gl.uniform1i(u.uFb, this.bind(0, src.tex));
    gl.uniform1i(u.uBloom, this.bind(1, b[0].tex));
    const layers = f.layers.slice().sort((x, y) => y.gain - x.gain);
    gl.uniform1i(u.uLayer0, this.bind(2, layers[0]?.tex ?? this.black));
    gl.uniform1i(u.uLayer1, this.bind(3, layers[1]?.tex ?? this.black));
    gl.uniform1f(u.uGain0, layers[0]?.gain ?? 0);
    gl.uniform1f(u.uGain1, layers[1]?.gain ?? 0);
    gl.uniform1f(u.uGlow, 0.25 + 1.6 * Math.min(1, Math.max(0, f.look.glow)));
    gl.uniform1f(u.uDim, Math.min(1, Math.max(0, f.dim)));
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1f(u.uAspect, outW / outH);
    gl.uniform2f(u.uRes, outW, outH);
    gl.uniform1i(u.uMirror, f.look.mirror);
    const acc = new Float32Array(16).fill(-1);
    const col = new Float32Array(12);
    f.accents.slice(-4).forEach((a, i) => {
      acc.set([ACCENT_KIND[a.kind] ?? -1, Math.max(0, a.strength), Math.max(0, a.age), 0], i * 4);
      col.set(a.color.map((c) => Math.pow(Math.min(1, Math.max(0, c)), 2.2)), i * 3);
    });
    gl.uniform4fv(u.uAcc, acc);
    gl.uniform3fv(u.uAccCol, col);
    this.target(null, outW, outH);
    this.quad();
  }

  dispose() {
    const gl = this.gl;
    for (const t of [this.scene, this.crisp, this.display]) deleteTarget(gl, t);
    deletePair(gl, this.fb);
    this.bloom.forEach((t) => deleteTarget(gl, t));
    Object.values(this.p).forEach((p) => gl.deleteProgram(p.prog));
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.black);
  }
}
