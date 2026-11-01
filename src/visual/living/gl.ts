/**
 * Small WebGL2 helpers for the Living Canvas: programs, render targets,
 * ping-pong pairs and capability detection (float vs packed RGBA8 fallback).
 */

export type GL = WebGL2RenderingContext;

export interface Caps {
  /** Half-float color attachments work (EXT_color_buffer_float or _half_float, and a complete FBO). */
  float: boolean;
  /** 32-bit float color attachments work (also from EXT_color_buffer_float). */
  float32: boolean;
  /** [min, max] gl_PointSize. */
  pointSize: [number, number];
  renderer: string;
}

/** A texture plus the framebuffer that renders into it. */
export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

/** Two targets that alternate as source and destination. */
export class Pair {
  constructor(public read: Target, public write: Target) {}
  swap() {
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }
  get w() {
    return this.read.w;
  }
  get h() {
    return this.read.h;
  }
}

export interface Format {
  internal: number;
  format: number;
  type: number;
  filter: number;
}

export function formats(gl: GL, float: boolean) {
  const f = (internal: number, format: number, type: number, filter = gl.LINEAR): Format => ({ internal, format, type, filter });
  return float
    ? {
        rgba: f(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT),
        rg: f(gl.RG16F, gl.RG, gl.HALF_FLOAT),
        r: f(gl.R16F, gl.RED, gl.HALF_FLOAT),
      }
    : {
        // Packed fallback: values are offset/scaled into 0..1 by the shaders (see ENC/DEC).
        rgba: f(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
        rg: f(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
        r: f(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
      };
}

export function createTarget(gl: GL, w: number, h: number, fmt: Format, filter = fmt.filter, mips = false): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, fmt.type, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  return { tex, fbo, w, h };
}

export const createPair = (gl: GL, w: number, h: number, fmt: Format, filter?: number, mips = false) =>
  new Pair(createTarget(gl, w, h, fmt, filter, mips), createTarget(gl, w, h, fmt, filter, mips));

export function deleteTarget(gl: GL, t: Target | null | undefined) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

export function deletePair(gl: GL, p: Pair | null | undefined) {
  if (!p) return;
  deleteTarget(gl, p.read);
  deleteTarget(gl, p.write);
}

/** Can we render into (and blend) this format on this device? Checked for real, not by extension name. */
function renderable(gl: GL, fmt: Format): boolean {
  const t = createTarget(gl, 4, 4, fmt);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  deleteTarget(gl, t);
  return ok;
}

export function detectCaps(gl: GL, forceLowp = false): Caps {
  // Either extension makes 16F renderable (some mobile GPUs only expose the half-float one).
  const ext = gl.getExtension('EXT_color_buffer_float');
  const half = gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  const f16 = formats(gl, true);
  const float = !forceLowp && !!(ext || half) && renderable(gl, f16.rgba) && renderable(gl, f16.rg) && renderable(gl, f16.r);
  const float32 = float && !!ext && renderable(gl, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, filter: gl.NEAREST });
  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return { float, float32, pointSize: [range[0], range[1]], renderer };
}

export interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
}

function compile(gl: GL, type: number, src: string, name: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`[living] shader "${name}" failed:\n${log}\n${numbered}`);
  }
  return s;
}

export function createProgram(gl: GL, vs: string, fs: string, name: string, feedback?: string[]): Program {
  const prog = gl.createProgram()!;
  const v = compile(gl, gl.VERTEX_SHADER, vs, name + '.vs');
  const f = compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs');
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  if (feedback) gl.transformFeedbackVaryings(prog, feedback, gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`[living] program "${name}" failed to link: ${gl.getProgramInfoLog(prog)}`);
  }
  const u: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i)!;
    const key = info.name.replace(/\[0\]$/, '');
    u[key] = gl.getUniformLocation(prog, info.name)!;
  }
  return { prog, u };
}

/** Full-screen triangle; every image pass uses it. */
export const QUAD_VS = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
