/**
 * The aura: a CPPN (compositional pattern-producing network) — a small, fixed,
 * randomly-weighted MLP evaluated per pixel over (x, y, r, slow time, gesture
 * channels). Mixed sin / tanh / Gaussian activations give organic, non-repeating
 * textures that morph as the gesture channels drift. Rendered small and upscaled:
 * it is a background, felt more than seen.
 */
import { createProgram, createTarget, deleteTarget, formats, type GL, type Program, QUAD_VS, type Target } from './gl';
import { HEAD } from './shaders';
import { rng } from './emit';

const INPUTS = 10;
const HIDDEN = 12;

/** Builds the CPPN shader with its weights baked in as constants (no uniform limits to worry about). */
export function cppnShader(seed = 7): string {
  const r = rng(seed);
  const gauss = () => {
    const u = Math.max(1e-6, r());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const arr = (n: number, scale: number) => Array.from({ length: n }, () => (gauss() * scale).toFixed(4));
  const w1 = arr(INPUTS * HIDDEN, 0.7);
  const b1 = arr(HIDDEN, 0.6);
  const w2 = arr(HIDDEN * HIDDEN, 1.0 / Math.sqrt(HIDDEN) * 1.6);
  const b2 = arr(HIDDEN, 0.4);
  const w3 = arr(HIDDEN * 3, 1.0 / Math.sqrt(HIDDEN) * 1.8);
  const glArr = (name: string, a: string[]) => `const float ${name}[${a.length}] = float[${a.length}](${a.join(',')});`;
  return HEAD + /* glsl */ `
uniform float uTime, uAspect, uBreath;
uniform vec4 uExtra;
${glArr('W1', w1)}
${glArr('B1', b1)}
${glArr('W2', w2)}
${glArr('B2', b2)}
${glArr('W3', w3)}
float act(int k, float v) {
  int m = k % 3;
  if (m == 0) return sin(v * 1.7);
  if (m == 1) return tanh(v);
  return exp(-v * v) * 2.0 - 1.0;
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.4;
  // Slow drift and a gentle self-warp so the field never sits still.
  float ca = cos(uTime * 0.013), sa = sin(uTime * 0.013);
  p = mat2(ca, -sa, sa, ca) * p;
  p += 0.25 * vec2(sin(p.y * 1.7 + uTime * 0.05), cos(p.x * 1.3 - uTime * 0.04));
  float in_[${INPUTS}];
  in_[0] = p.x; in_[1] = p.y; in_[2] = length(p);
  in_[3] = sin(uTime * 0.05); in_[4] = cos(uTime * 0.037);
  in_[5] = uExtra.x; in_[6] = uExtra.y; in_[7] = uExtra.z; in_[8] = uExtra.w;
  in_[9] = uBreath * 2.0 - 1.0;
  float h1[${HIDDEN}];
  for (int j = 0; j < ${HIDDEN}; j++) {
    float s = B1[j];
    for (int i = 0; i < ${INPUTS}; i++) s += W1[i * ${HIDDEN} + j] * in_[i];
    h1[j] = act(j, s);
  }
  float h2[${HIDDEN}];
  for (int j = 0; j < ${HIDDEN}; j++) {
    float s = B2[j];
    for (int i = 0; i < ${HIDDEN}; i++) s += W2[i * ${HIDDEN} + j] * h1[i];
    h2[j] = act(j + 1, s);
  }
  vec3 o = vec3(0.0);
  for (int i = 0; i < ${HIDDEN}; i++) {
    o += vec3(W3[i * 3], W3[i * 3 + 1], W3[i * 3 + 2]) * h2[i];
  }
  // x: pattern value, y: ridge mask, z: hue drift — all 0..1.
  o = 0.5 + 0.5 * tanh(o);
  outColor = vec4(o, 1.0);
}
`;
}

/** Tints the raw CPPN output through the palette, at a low resolution. */
const TINT = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec3 uPal[4];
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  // Soft clouds of the palette's middle colors, with a faint lift where layers meet.
  float v = smoothstep(0.1, 1.0, c.x);
  float veil = smoothstep(0.2, 0.95, c.y);
  vec3 col = mix(uPal[1], uPal[2], c.z) * (0.15 + 0.85 * v * v) * (0.5 + 0.5 * veil);
  outColor = vec4(col * 0.8, 1.0);
}
`;

export class Aura {
  private prog: Program;
  private tint: Program;
  private raw!: Target;
  target!: Target;
  private vao: WebGLVertexArrayObject;

  constructor(private gl: GL, private float: boolean) {
    this.prog = createProgram(gl, QUAD_VS, cppnShader(), 'aura');
    this.tint = createProgram(gl, QUAD_VS, TINT, 'aura-tint');
    this.vao = gl.createVertexArray()!;
  }

  allocate(w: number, h: number) {
    const gl = this.gl;
    const f = formats(gl, this.float);
    deleteTarget(gl, this.raw);
    deleteTarget(gl, this.target);
    this.raw = createTarget(gl, w, h, f.rgba);
    this.target = createTarget(gl, w, h, f.rgba);
  }

  render(time: number, aspect: number, breath: number, extra: readonly number[], palette: Float32Array) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.prog.prog);
    gl.uniform1f(this.prog.u.uTime, time);
    gl.uniform1f(this.prog.u.uAspect, aspect);
    gl.uniform1f(this.prog.u.uBreath, breath);
    gl.uniform4f(this.prog.u.uExtra, extra[0], extra[1], extra[2], extra[3]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.raw.fbo);
    gl.viewport(0, 0, this.raw.w, this.raw.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(this.tint.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.raw.tex);
    gl.uniform1i(this.tint.u.uSrc, 0);
    gl.uniform3fv(this.tint.u.uPal, palette);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    deleteTarget(gl, this.raw);
    deleteTarget(gl, this.target);
    gl.deleteProgram(this.prog.prog);
    gl.deleteProgram(this.tint.prog);
    gl.deleteVertexArray(this.vao);
  }
}
