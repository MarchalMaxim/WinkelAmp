/**
 * Spark particles, simulated on the GPU with transform feedback (works even without
 * float render targets). They ride the fluid's velocity, rise or sink with the
 * material, and are drawn as additive points: round motes, or star-shaped glints
 * when the material is angular.
 *
 * Spawning uses a ring buffer: each burst claims the next `count` particle slots,
 * passed to the update shader as index ranges.
 */
import type { SparkBurst } from './emit';
import { createProgram, type GL, type Program } from './gl';

const MAX = 65536;
const FLOATS = 12; // pos2 vel2 (age, life) (size, seed) (rgb, phase)
const MAX_SPAWNS = 32;

const UPDATE_VS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aVel;
layout(location = 2) in vec2 aAge;
layout(location = 3) in vec2 aMeta;
layout(location = 4) in vec4 aColor;
out vec2 oPos;
out vec2 oVel;
out vec2 oAge;
out vec2 oMeta;
out vec4 oColor;
uniform sampler2D uVel;
uniform vec2 uVelE;
uniform float uDt, uAspect, uFollow, uLift, uJitter, uDrag, uSeed, uPrism;
uniform int uSpawnN;
uniform vec4 uSA[${MAX_SPAWNS}]; // start, count, x, y
uniform vec4 uSB[${MAX_SPAWNS}]; // vx, vy, spread, radius
uniform vec4 uSC[${MAX_SPAWNS}]; // r, g, b, size
uniform vec4 uSD[${MAX_SPAWNS}]; // life
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd(inout uint s) { s = pcg(s); return float(s) / 4294967295.0; }
void main() {
  oPos = aPos; oVel = aVel; oAge = aAge; oMeta = aMeta; oColor = aColor;
  float id = float(gl_VertexID);
  uint s = uint(gl_VertexID) * 9781u + uint(uSeed);
  for (int i = 0; i < ${MAX_SPAWNS}; i++) {
    if (i >= uSpawnN) break;
    vec4 a = uSA[i];
    if (id >= a.x && id < a.x + a.y) {
      vec4 b = uSB[i], c = uSC[i];
      float ang = rnd(s) * 6.2831853, rad = sqrt(rnd(s)) * b.w;
      oPos = a.zw + vec2(cos(ang), sin(ang)) * rad * vec2(1.0 / uAspect, 1.0);
      float sa = rnd(s) * 6.2831853, sp = b.z * (0.2 + 0.8 * rnd(s));
      oVel = b.xy + vec2(cos(sa), sin(sa)) * sp;
      oAge = vec2(0.0, uSD[i].x * (0.5 + rnd(s)));
      oMeta = vec2(c.w * (0.45 + 1.1 * rnd(s)), rnd(s));
      // Prismatic variety: each glint gets its own tint (candy sparkles).
      vec3 prism = vec3(rnd(s), rnd(s), rnd(s)) - 0.5;
      oColor = vec4(max(c.rgb * (1.0 + prism * uPrism * 1.6), 0.0), rnd(s));
      return;
    }
  }
  if (aAge.x >= aAge.y) return;
  vec2 fluid = texture(uVel, aPos).xy * uVelE.x + uVelE.y;
  vec2 v = mix(aVel, fluid, 1.0 - exp(-uFollow * uDt));
  v.y += uLift * uDt;
  vec2 kick = vec2(rnd(s), rnd(s)) - 0.5;
  v += kick * uJitter * sqrt(uDt) * 4.0;
  v *= exp(-uDrag * uDt);
  vec2 p = aPos + v * uDt * vec2(1.0 / uAspect, 1.0);
  oPos = p;
  oVel = v;
  // Sparks leaving the screen are gone (no piling up at the walls).
  bool out_ = p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02;
  oAge = vec2(out_ ? aAge.y : aAge.x + uDt, aAge.y);
}`;

/**
 * Sparks are drawn as instanced quads (not points): streaked along their motion
 * like embers, or as fixed-orientation star glints when the material is angular.
 */
const RENDER_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aVel;
layout(location = 2) in vec2 aAge;
layout(location = 3) in vec2 aMeta;
layout(location = 4) in vec4 aColor;
uniform float uPx, uTime, uTwinkle, uStar, uGain, uAspect, uStreak;
out vec3 vColor;
out vec2 vQ;
out float vLen;
void main() {
  float t = aAge.x / max(aAge.y, 1e-3);
  if (aAge.x >= aAge.y) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vColor = vec3(0.0); vQ = vec2(0.0); vLen = 0.0;
    return;
  }
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  float fade = smoothstep(0.0, 0.06, t) * pow(1.0 - t, 1.3);
  float tw = pow(0.5 + 0.5 * sin(uTime * (9.0 + 24.0 * aMeta.y) + aColor.a * 6.2831), 5.0) * 2.6;
  float flick = mix(1.0, tw, uTwinkle);
  // Radius in screen heights; star sprites are larger to hold their rays.
  float r = mix(0.0009, 0.008, pow(aMeta.x, 1.5)) * (0.6 + 0.4 * fade);
  float rs = r * (1.0 + uStar * 5.0);
  // Never thinner than ~1.6 px: grow the sprite and dim it (only partly: a mote should
  // stay visible).
  float minR = 1.6 / uPx;
  float energy = 1.0;
  if (rs < minR) { energy = mix((rs / minR) * (rs / minR), 1.0, 0.5); rs = minR; }
  float speed = length(aVel);
  float va = speed > 1e-4 ? atan(aVel.y, aVel.x) : 0.0;
  float ang = mix(va, (aColor.a - 0.5) * 0.5, uStar);
  vec2 dir = vec2(cos(ang), sin(ang));
  float len = speed * uStreak * (1.0 - uStar);
  vec2 local = corner * vec2(rs + len, rs);
  vec2 world = dir * local.x + vec2(-dir.y, dir.x) * local.y;
  gl_Position = vec4((aPos + world * vec2(1.0 / uAspect, 1.0)) * 2.0 - 1.0, 0.0, 1.0);
  vQ = local / rs;
  vLen = len / rs;
  vColor = aColor.rgb * fade * flick * uGain * energy / (1.0 + vLen * 0.35);
}`;

const RENDER_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in vec2 vQ;
in float vLen;
uniform float uStar;
out vec4 outColor;
void main() {
  // Round motes / streaks: a capsule with a soft Gaussian profile.
  vec2 c = vec2(max(abs(vQ.x) - vLen, 0.0), vQ.y);
  float r2 = dot(c, c);
  // Streaks taper: bright head, fading tail.
  float tail = vLen > 0.01 ? mix(0.15, 1.0, clamp((vQ.x / vLen + 1.0) * 0.5, 0.0, 1.0)) : 1.0;
  float round_ = exp(-r2 * 5.0) * (1.0 - smoothstep(0.6, 1.0, r2)) * tail;
  // Star glint: hot core plus crossed rays.
  vec2 p = vQ;
  float p2 = dot(p, p);
  float core = exp(-p2 * 40.0) * 2.0;
  float rays = exp(-abs(p.x) * 40.0) * exp(-abs(p.y) * 3.5) + exp(-abs(p.y) * 40.0) * exp(-abs(p.x) * 3.5);
  rays += 0.3 * (exp(-abs(p.x + p.y) * 30.0) + exp(-abs(p.x - p.y) * 30.0)) * exp(-p2 * 6.0);
  float star = (core + rays) * (1.0 - smoothstep(0.8, 1.0, max(abs(p.x), abs(p.y))));
  outColor = vec4(vColor * mix(round_, star, uStar), 1.0);
}`;

export interface SparkParams {
  dt: number;
  time: number;
  aspect: number;
  /** Fluid-following rate (1/s). */
  follow: number;
  /** Vertical acceleration (+ up). */
  lift: number;
  jitter: number;
  drag: number;
  twinkle: number;
  star: number;
  gain: number;
  /** Seconds of motion each spark is smeared over (ember streaks). */
  streak: number;
  /** Per-spark color variety. */
  prism: number;
}

export class Sparks {
  private buf: WebGLBuffer[] = [];
  private vao: WebGLVertexArrayObject[] = [];
  private drawVao: WebGLVertexArrayObject[] = [];
  private tf: WebGLTransformFeedback[] = [];
  private cur = 0;
  private update: Program;
  private render: Program;
  private cursor = 0;
  private frame = 0;
  /** Seconds since the last spawn (longest life ≈ 9 s). */
  private idle = 1e9;
  private spawnA = new Float32Array(MAX_SPAWNS * 4);
  private spawnB = new Float32Array(MAX_SPAWNS * 4);
  private spawnC = new Float32Array(MAX_SPAWNS * 4);
  private spawnD = new Float32Array(MAX_SPAWNS * 4);
  private cap = 32768;

  /** Particle budget (adaptive quality): only this many are simulated and drawn. */
  get capacity() {
    return this.cap;
  }
  set capacity(n: number) {
    n = Math.max(256, Math.min(MAX, n));
    if (n === this.cap) return;
    // Particles beyond a shrunken budget would freeze and pop back later: start clean.
    this.cap = n;
    this.reset();
  }

  constructor(private gl: GL) {
    this.update = createProgram(gl, UPDATE_VS, `#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`, 'spark-update', ['oPos', 'oVel', 'oAge', 'oMeta', 'oColor']);
    this.render = createProgram(gl, RENDER_VS, RENDER_FS, 'spark-render');
    const zeros = new Float32Array(MAX * FLOATS);
    for (let i = 0; i < 2; i++) {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, zeros, gl.DYNAMIC_COPY);
      // Same buffer, two layouts: per-vertex for the update, per-instance for drawing quads.
      const layout = (divisor: number) => {
        const v = gl.createVertexArray()!;
        gl.bindVertexArray(v);
        let off = 0;
        [2, 2, 2, 2, 4].forEach((n, loc) => {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, n, gl.FLOAT, false, FLOATS * 4, off * 4);
          gl.vertexAttribDivisor(loc, divisor);
          off += n;
        });
        gl.bindVertexArray(null);
        return v;
      };
      const v = layout(0);
      this.drawVao.push(layout(1));
      const t = gl.createTransformFeedback()!;
      this.buf.push(b);
      this.vao.push(v);
      this.tf.push(t);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    for (let i = 0; i < 2; i++) {
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf[i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buf[i]);
    }
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  }

  /** Kills every particle. */
  reset() {
    const gl = this.gl;
    const zeros = new Float32Array(MAX * FLOATS);
    for (const b of this.buf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, zeros);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.cursor = 0;
  }

  step(bursts: SparkBurst[], vel: WebGLTexture, velE: [number, number], p: SparkParams) {
    const gl = this.gl;
    const cap = this.cap;
    if (this.cursor >= cap) this.cursor = 0;
    let n = 0;
    const push = (start: number, count: number, b: SparkBurst) => {
      if (n >= MAX_SPAWNS || count <= 0) return;
      const i = n * 4;
      this.spawnA.set([start, count, b.x, b.y], i);
      this.spawnB.set([b.vx, b.vy, b.spread, b.radius], i);
      this.spawnC.set([b.color[0], b.color[1], b.color[2], b.size], i);
      this.spawnD.set([b.life, 0, 0, 0], i);
      n++;
    };
    for (const b of bursts) {
      const count = Math.min(b.count, cap >> 2);
      const first = Math.min(count, cap - this.cursor);
      push(this.cursor, first, b);
      // Wrap around the ring: the rest goes at the start.
      if (count > first) push(0, count - first, b);
      this.cursor = (this.cursor + count) % cap;
    }

    const { u, prog } = this.update;
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vel);
    gl.uniform1i(u.uVel, 0);
    gl.uniform2fv(u.uVelE, velE);
    gl.uniform1f(u.uDt, p.dt);
    gl.uniform1f(u.uAspect, p.aspect);
    gl.uniform1f(u.uFollow, p.follow);
    gl.uniform1f(u.uLift, p.lift);
    gl.uniform1f(u.uJitter, p.jitter);
    gl.uniform1f(u.uDrag, p.drag);
    gl.uniform1f(u.uPrism, p.prism);
    gl.uniform1f(u.uSeed, (this.frame++ * 7919) % 1000003);
    gl.uniform1i(u.uSpawnN, n);
    this.idle = n ? 0 : this.idle + p.dt;
    if (n) {
      gl.uniform4fv(u.uSA, this.spawnA, 0, n * 4);
      gl.uniform4fv(u.uSB, this.spawnB, 0, n * 4);
      gl.uniform4fv(u.uSC, this.spawnC, 0, n * 4);
      gl.uniform4fv(u.uSD, this.spawnD, 0, n * 4);
    }
    const next = 1 - this.cur;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(this.vao[this.cur]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf[next]);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.cap);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    this.cur = next;
  }

  /** Draws into the currently bound framebuffer with additive blending. */
  draw(pxHeight: number, p: SparkParams) {
    // Nothing alive and nothing spawned recently: skip the 64k instances.
    if (this.idle > 10) return;
    const gl = this.gl;
    const { u, prog } = this.render;
    gl.useProgram(prog);
    gl.uniform1f(u.uPx, pxHeight);
    gl.uniform1f(u.uTime, p.time);
    gl.uniform1f(u.uTwinkle, p.twinkle);
    gl.uniform1f(u.uStar, p.star);
    gl.uniform1f(u.uGain, p.gain);
    gl.uniform1f(u.uAspect, p.aspect);
    gl.uniform1f(u.uStreak, p.streak);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.drawVao[this.cur]);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.cap);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const gl = this.gl;
    this.buf.forEach((b) => gl.deleteBuffer(b));
    this.vao.forEach((v) => gl.deleteVertexArray(v));
    this.drawVao.forEach((v) => gl.deleteVertexArray(v));
    this.tf.forEach((t) => gl.deleteTransformFeedback(t));
    gl.deleteProgram(this.update.prog);
    gl.deleteProgram(this.render.prog);
  }
}
