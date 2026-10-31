/**
 * Drawing helpers the stage lends its elements: the Living Canvas's WebGL2 helpers
 * (re-exported, not copied), two batched primitives that cover most elements —
 * instanced soft sprites and glowing polyline strokes — and the small pure
 * helpers every element needs (regions, colors, music-time easing).
 *
 * Coordinates are the stage's: x 0..1 left → right, y 0..1 bottom → top; sizes are
 * in units of the screen height, so a circle stays round at any aspect.
 */
import { hslLinear, mixRgb, noteRgb, samplePalette, srgbToLinear, tintKeepLuma } from '../character/palette';
import type { Rgb } from '../character/types';
import { clamp01 } from '../visual/living/emit';
import { createProgram, type GL, type Program } from '../visual/living/gl';
import type { ElementParams, Region, StageShared } from './types';

export {
  createPair, createProgram, createTarget, deletePair, deleteTarget, detectCaps, formats, QUAD_VS,
  type Caps, type GL, type Pair, type Program, type Target,
} from '../visual/living/gl';
export { clamp01, mix, rng, smoothstep } from '../visual/living/emit';
/** 0 for NaN / ±Infinity: one bad audio value must not poison an element's state. */
export const fin = (v: number) => (Number.isFinite(v) ? v : 0);

/**
 * Eases `cur` toward `target` with time constant `tau` in music seconds. With
 * musicDt = 0 (silence) it returns `cur` exactly: smoothed audio values freeze
 * with the picture instead of decaying on wall time.
 */
export const ease = (cur: number, target: number, musicDt: number, tau: number) =>
  musicDt > 0 ? cur + (target - cur) * (1 - Math.exp(-musicDt / tau)) : cur;

/** [x0, y0, x1, y1] of a region, y up. */
export function regionRect(r: Region): [number, number, number, number] {
  switch (r) {
    case 'top': return [0, 0.5, 1, 1];
    case 'bottom': return [0, 0, 1, 0.5];
    case 'left': return [0, 0, 0.5, 1];
    case 'right': return [0.5, 0, 1, 1];
    case 'center': return [0.2, 0.2, 0.8, 0.8];
    default: return [0, 0, 1, 1];
  }
}

/** '#rgb' / '#rrggbb' → linear RGB; null when it isn't a hex color. */
export function parseColor(s: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255)) as Rgb;
}

/** Brightest stop of a color, so a dark palette stop can still glow (additive light wants full chroma). */
export function vivid(c: Rgb, floor = 0.35): Rgb {
  const m = Math.max(c[0], c[1], c[2], 1e-4);
  const k = Math.max(1, floor / m);
  return [c[0] * k, c[1] * k, c[2] * k];
}

/**
 * An element's color at palette position `t` (0 shadow … 1 highlight). `note` is a
 * pitch class (fractional ok) for 'note' coloring, or NaN when there is none.
 * 'mood' follows the stage palette (by pitch when the look says 'notes').
 */
export function elementColor(color: ElementParams['color'], shared: StageShared, t: number, note = NaN): Rgb {
  const base = samplePalette(shared.palette, t);
  if (color === 'note' || (color === 'mood' && shared.notes)) {
    if (!Number.isFinite(note)) return base;
    const n = noteRgb(note);
    // Pitch hue at the palette's brightness, so a dark mood stays dark.
    return mixRgb(n, tintKeepLuma(base, n, 1), 0.35);
  }
  if (color === 'mood') return base;
  return parseColor(color) ?? base;
}

/** A hue (0..1 around the wheel) at the palette's brightness — for chord tints. */
export const hueRgb = (h: number, s = 0.8, l = 0.55): Rgb => hslLinear(((h % 1) + 1) % 1 * 360, s, l);

/** Linear RGB scaled; handy for presence/intensity. */
export const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

// ---------------------------------------------------------------------------------
// Sprites: instanced quads, each a soft shape (glow, star, ring, bead).
// ---------------------------------------------------------------------------------

/** Sprite shapes (the fragment shader's `kind`). Square: a soft-edged box; param = edge softness / half its side. */
export const Shape = { Glow: 0, Star: 1, Ring: 2, Bead: 3, Square: 4 } as const;
export type Shape = (typeof Shape)[keyof typeof Shape];

const SPRITE_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec3 aSize;   // rx, ry (height units), rotation
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec2 aShape;  // kind, param
uniform float uAspect;
out vec2 vP;
out vec3 vColor;
out vec2 vShape;
void main() {
  vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0;
  vec2 o = c * aSize.xy;
  float cs = cos(aSize.z), sn = sin(aSize.z);
  o = vec2(o.x * cs - o.y * sn, o.x * sn + o.y * cs);
  vec2 p = aPos * 2.0 - 1.0 + vec2(o.x * 2.0 / uAspect, o.y * 2.0);
  vP = c;
  vColor = aColor;
  vShape = aShape;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SPRITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vP;
in vec3 vColor;
in vec2 vShape;
out vec4 outColor;
void main() {
  float r = length(vP);
  float k;
  int kind = int(vShape.x + 0.5);
  if (kind == 1) {
    // Star: rays along the axes (count = param), a hot core.
    float a = atan(vP.y, vP.x);
    float ray = pow(abs(cos(a * vShape.y * 0.5)), 24.0);
    float d = r / mix(0.08, 1.0, ray);
    k = exp(-d * d * 6.0) + exp(-r * r * 40.0) * 1.5;
  } else if (kind == 2) {
    // Ring of relative width param.
    float w = max(0.02, vShape.y);
    float d = (r - (1.0 - 2.0 * w)) / w;
    k = exp(-d * d * 1.5);
  } else if (kind == 3) {
    // Bead: a lit sphere with a soft halo.
    float body = smoothstep(0.62, 0.5, r);
    float lit = 0.55 + 0.45 * smoothstep(0.6, -0.4, dot(vP, vec2(0.6, -0.8)) + r * 0.3);
    k = body * lit + exp(-r * r * 5.0) * 0.45 + exp(-pow(length(vP - vec2(-0.18, 0.2)) * 9.0, 2.0)) * 0.8;
  } else if (kind == 4) {
    // Square: a box filling the quad but a margin of 3 · soft, its edges and corners blurred
    // over ±soft, with a faint halo out into the margin (the sketch's shadow blur).
    float p = max(vShape.y, 0.002);
    float a = 1.0 / (1.0 + 3.0 * p);
    float w = p * a;
    vec2 q = abs(vP) - vec2(a - w);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - w;
    float h = max(d, 0.0) / (1.5 * w);
    float edge = smoothstep(w, -w, d);
    k = edge + 0.25 * (1.0 - edge) * exp(-h * h) * smoothstep(1.0, 0.9, max(abs(vP.x), abs(vP.y)));
  } else {
    // Glow: gaussian, sharpened by param (0 soft … 1 crisp).
    float s = mix(3.0, 14.0, vShape.y);
    k = exp(-r * r * s) * smoothstep(1.0, 0.8, r);
  }
  outColor = vec4(vColor * k, 1.0);
}`;

const SPRITE_STRIDE = 10;

/** Collects sprites for one draw call; `flush()` draws everything added since. */
export class SpriteBatch {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private data = new Float32Array(SPRITE_STRIDE * 512);
  private n = 0;

  constructor(private gl: GL, private aspect: () => number) {
    this.prog = createProgram(gl, SPRITE_VS, SPRITE_FS, 'stage.sprite');
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const F = 4;
    const attr = (loc: number, size: number, off: number) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, SPRITE_STRIDE * F, off * F);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr(0, 2, 0);
    attr(1, 3, 2);
    attr(2, 3, 5);
    attr(3, 2, 8);
    gl.bindVertexArray(null);
  }

  /** Adds a sprite at (x, y) with radii rx, ry (height units), rotation, linear color (already scaled). */
  add(x: number, y: number, rx: number, ry: number, rot: number, c: Rgb, shape: Shape = Shape.Glow, param = 0) {
    if (!(rx > 0 && ry > 0) || c[0] + c[1] + c[2] <= 1e-5 || !Number.isFinite(x + y + rx + ry + rot)) return;
    if ((this.n + 1) * SPRITE_STRIDE > this.data.length) {
      const d = new Float32Array(this.data.length * 2);
      d.set(this.data);
      this.data = d;
    }
    const o = this.n++ * SPRITE_STRIDE;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = rx;
    d[o + 3] = ry;
    d[o + 4] = rot;
    d[o + 5] = c[0];
    d[o + 6] = c[1];
    d[o + 7] = c[2];
    d[o + 8] = shape;
    d[o + 9] = param;
  }

  flush() {
    if (!this.n) return;
    const gl = this.gl;
    gl.useProgram(this.prog.prog);
    gl.uniform1f(this.prog.u.uAspect, this.aspect());
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * SPRITE_STRIDE), gl.STREAM_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.bindVertexArray(null);
    this.n = 0;
  }

  dispose() {
    this.gl.deleteProgram(this.prog.prog);
    this.gl.deleteBuffer(this.buf);
    this.gl.deleteVertexArray(this.vao);
  }
}

// ---------------------------------------------------------------------------------
// Strokes: polylines expanded on the CPU into triangle strips with a glowing profile.
// ---------------------------------------------------------------------------------

/** Stroke looks: Glow = a smooth band with a hot core; Ink = a soft dry brush with bristle streaks and ragged edges. */
export const Brush = { Glow: 0, Ink: 1 } as const;
export type Brush = (typeof Brush)[keyof typeof Brush];

const STROKE_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aAcross;  // -1..1 across, distance along (height units)
layout(location = 2) in vec4 aColor;   // rgb, core
out vec2 vAcross;
out vec4 vColor;
void main() {
  vAcross = aAcross;
  vColor = aColor;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`;

const STROKE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vAcross;
in vec4 vColor;
out vec4 outColor;
uniform int uBrush;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(float x) { float i = floor(x); float f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() {
  float a = vAcross.x;
  float k;
  if (uBrush == 1) {
    // Bristles: streaks across the width that run along the stroke.
    float lane = (a * 0.5 + 0.5) * 14.0;
    float bristle = 0.55 + 0.45 * noise(lane * 3.1 + floor(lane) * 7.0 + vAcross.y * 2.0);
    float edge = smoothstep(1.0, 0.55 + 0.3 * noise(vAcross.y * 40.0), abs(a));
    k = edge * bristle * (0.8 + 0.2 * noise(vAcross.y * 9.0));
  } else {
    k = exp(-a * a * 3.5) * 0.7 + exp(-a * a * 30.0) * vColor.a;
  }
  outColor = vec4(vColor.rgb * k, 1.0);
}`;

const STROKE_STRIDE = 8;

/** A point of a polyline: position, half-width (height units), linear color, core brightness. */
export interface StrokePoint {
  x: number;
  y: number;
  w: number;
  c: Rgb;
  core?: number;
}

export class StrokeBatch {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private data = new Float32Array(STROKE_STRIDE * 2048);
  private n = 0;
  private runs: [number, number][] = [];

  constructor(private gl: GL, private aspect: () => number) {
    this.prog = createProgram(gl, STROKE_VS, STROKE_FS, 'stage.stroke');
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const F = 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STROKE_STRIDE * F, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STROKE_STRIDE * F, 2 * F);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STROKE_STRIDE * F, 4 * F);
    gl.bindVertexArray(null);
  }

  private vertex(x: number, y: number, across: number, along: number, c: Rgb, core: number) {
    if ((this.n + 1) * STROKE_STRIDE > this.data.length) {
      const d = new Float32Array(this.data.length * 2);
      d.set(this.data);
      this.data = d;
    }
    const o = this.n++ * STROKE_STRIDE;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = across;
    d[o + 3] = along;
    d[o + 4] = c[0];
    d[o + 5] = c[1];
    d[o + 6] = c[2];
    d[o + 7] = core;
  }

  /** Adds one polyline (≥ 2 points); `closed` joins the last point to the first. */
  add(pts: StrokePoint[], closed = false) {
    const m = pts.length;
    if (m < 2) return;
    const asp = this.aspect();
    const start = this.n;
    let along = 0;
    const count = closed ? m + 1 : m;
    for (let j = 0; j < count; j++) {
      const i = j % m;
      const p = pts[i];
      const prev = pts[closed ? (i - 1 + m) % m : Math.max(0, i - 1)];
      const next = pts[closed ? (i + 1) % m : Math.min(m - 1, i + 1)];
      // Tangent in height units (x stretched by the aspect), so widths are true on screen.
      let tx = (next.x - prev.x) * asp;
      let ty = next.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      if (j > 0) along += Math.hypot((p.x - pts[(i - 1 + m) % m].x) * asp, p.y - pts[(i - 1 + m) % m].y);
      const nx = (-ty * p.w) / asp;
      const ny = tx * p.w;
      const core = p.core ?? 1;
      this.vertex(p.x + nx, p.y + ny, 1, along, p.c, core);
      this.vertex(p.x - nx, p.y - ny, -1, along, p.c, core);
    }
    this.runs.push([start, this.n - start]);
  }

  flush(brush: Brush = Brush.Glow) {
    if (!this.runs.length) return;
    const gl = this.gl;
    gl.useProgram(this.prog.prog);
    gl.uniform1i(this.prog.u.uBrush, brush);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * STROKE_STRIDE), gl.STREAM_DRAW);
    for (const [s, c] of this.runs) gl.drawArrays(gl.TRIANGLE_STRIP, s, c);
    gl.bindVertexArray(null);
    this.runs = [];
    this.n = 0;
  }

  dispose() {
    this.gl.deleteProgram(this.prog.prog);
    this.gl.deleteBuffer(this.buf);
    this.gl.deleteVertexArray(this.vao);
  }
}

/** Shared GLSL for full-screen element passes: region mask and the stage's coordinates. */
export const PASS_HEAD = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec4 uRegion;   // x0, y0, x1, y1
uniform float uAspect;
// 1 inside the region, falling off softly over \`soft\` (height units) outside it.
float regionMask(vec2 uv, float soft) {
  vec2 d = max(uRegion.xy - uv, uv - uRegion.zw);
  d.x *= uAspect;
  float o = length(max(d, 0.0));
  return 1.0 - smoothstep(0.0, soft, o);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

/** Sets the region and aspect uniforms of a full-screen element pass. */
export function setRegion(gl: GL, p: Program, region: Region, aspect: number) {
  const r = regionRect(region);
  gl.uniform4f(p.u.uRegion, r[0], r[1], r[2], r[3]);
  gl.uniform1f(p.u.uAspect, aspect);
}

export { mixRgb, samplePalette };

/** ElementParams.size (0..1, default 0.5) → a scale factor (default 1). */
export const sizeK = (size: number) => 0.4 + 1.2 * clamp01(fin(size));

/** The style an element draws in: '' (or an unknown name) means the type's first style. */
export const styleOf = (style: string, styles: readonly string[]) => (styles.includes(style) ? style : styles[0]);
