/**
 * Stable-fluids simulation on the GPU (Stam 1999, in the style of Harris's GPU Gems
 * chapter): splat → body forces → projection (divergence, Jacobi pressure, gradient
 * subtraction) → advection of velocity and dye.
 *
 * Units: uv for positions; velocity in screen-heights per second, so the look
 * doesn't change when adaptive quality resizes the grid. Dye is RGB light plus
 * heat in alpha.
 */
import type { Splat } from './emit';
import { createPair, createProgram, createTarget, deletePair, deleteTarget, formats, type GL, type Pair, type Program, QUAD_VS, type Target } from './gl';
import * as S from './shaders';

/**
 * Field encodings for the RGBA8 fallback: value = stored * e.x + e.y. Signed fields put
 * zero exactly on byte 128 (not 127.5), so "no motion" doesn't drift.
 */
const signed = (range: number): [number, number] => [range, (-range * 128) / 255];
const ENC = {
  vel: signed(8),
  p: signed(2),
  div: signed(1),
  curl: signed(2),
  dye: [3, 0] as [number, number],
};
const IDENT: [number, number] = [1, 0];

export interface StepParams {
  dt: number;
  time: number;
  curl: number;
  buoyancy: number;
  gravity: number;
  swirl: number;
  turbulence: number;
  thickness: number;
  velFade: number;
  dyeFade: number;
  heatFade: number;
  grid: number;
  wind: [number, number];
  iterations: number;
  maccormack: boolean;
  /** Soft ceiling for dye brightness. */
  cap: number;
  /** Mean dye brightness allowed before extra fading. */
  budget: number;
  /** MacCormack correction, 0..0.5: crisp materials keep detail, soft ones blur. */
  sharp: number;
}

const SPLAT_FLOATS = 16;
const MAX_SPLATS = 512;

export class Fluid {
  vel!: Pair;
  dye!: Pair;
  private dyeHat!: Target;
  private p!: Pair;
  private div!: Target;
  private curl!: Target;
  simW = 0;
  simH = 0;
  dyeW = 0;
  dyeH = 0;

  private progs: Record<string, Program> = {};
  private splatProg: Program;
  private splatVao: WebGLVertexArrayObject;
  private splatBuf: WebGLBuffer;
  private splatData = new Float32Array(MAX_SPLATS * SPLAT_FLOATS);
  private quadVao: WebGLVertexArrayObject;
  readonly enc: { vel: [number, number]; dye: [number, number]; p: [number, number]; div: [number, number]; curl: [number, number] };

  constructor(private gl: GL, readonly float: boolean) {
    this.enc = float ? { vel: IDENT, dye: IDENT, p: IDENT, div: IDENT, curl: IDENT } : ENC;
    const list: [string, string][] = [
      ['copy', S.COPY], ['scale', S.SCALE], ['advect', S.ADVECT], ['mac', S.MACCORMACK], ['curl', S.CURL],
      ['forces', S.FORCES], ['div', S.DIVERGENCE], ['pressure', S.PRESSURE], ['gradient', S.GRADIENT],
    ];
    for (const [k, fs] of list) this.progs[k] = createProgram(gl, QUAD_VS, fs, k);
    this.splatProg = createProgram(gl, S.SPLAT_VS, S.SPLAT_FS, 'splat');
    this.quadVao = gl.createVertexArray()!;

    this.splatVao = gl.createVertexArray()!;
    this.splatBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.splatVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.splatData.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, SPLAT_FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * (Re)allocates the fields for a canvas aspect and grid sizes, carrying over
   * the current picture so quality changes don't wipe the canvas.
   */
  allocate(aspect: number, simShort: number, dyeShort: number) {
    const gl = this.gl;
    const dims = (short: number) => (aspect >= 1 ? [Math.round(short * aspect), short] : [short, Math.round(short / aspect)]);
    const [sw, sh] = dims(simShort);
    const [dw, dh] = dims(dyeShort);
    if (sw === this.simW && sh === this.simH && dw === this.dyeW && dh === this.dyeH) return;
    const f = formats(gl, this.float);
    const oldVel = this.vel;
    const oldDye = this.dye;
    this.vel = createPair(gl, sw, sh, f.rg);
    // Dye keeps mipmaps: the top level is its mean brightness (see the budget in shaders.ts).
    this.dye = createPair(gl, dw, dh, f.rgba, undefined, true);
    if (!this.float) {
      // Zero in the packed encoding isn't 0 bytes: clear to the encoded zero.
      this.clearTo(this.vel.read, ENC.vel);
      this.clearTo(this.vel.write, ENC.vel);
    }
    if (oldVel) {
      this.blit(oldVel.read, this.vel.read, this.enc.vel, this.enc.vel);
      this.blit(oldDye.read, this.dye.read, this.enc.dye, this.enc.dye);
      deletePair(gl, oldVel);
      deletePair(gl, oldDye);
    }
    deleteTarget(gl, this.dyeHat);
    deletePair(gl, this.p);
    deleteTarget(gl, this.div);
    deleteTarget(gl, this.curl);
    this.dyeHat = createTarget(gl, dw, dh, f.rgba);
    this.p = createPair(gl, sw, sh, f.r, gl.NEAREST);
    this.div = createTarget(gl, sw, sh, f.r, gl.NEAREST);
    this.curl = createTarget(gl, sw, sh, f.r, gl.NEAREST);
    if (!this.float) {
      this.clearTo(this.p.read, ENC.p);
      this.clearTo(this.p.write, ENC.p);
    }
    this.simW = sw;
    this.simH = sh;
    this.dyeW = dw;
    this.dyeH = dh;
  }

  /** Clears every field (fresh canvas). */
  reset() {
    const gl = this.gl;
    const zero = (t: Target, e: [number, number]) => this.clearTo(t, e);
    zero(this.vel.read, this.enc.vel);
    zero(this.vel.write, this.enc.vel);
    zero(this.dye.read, this.enc.dye);
    zero(this.dye.write, this.enc.dye);
    zero(this.p.read, this.enc.p);
    zero(this.p.write, this.enc.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private clearTo(t: Target, e: [number, number]) {
    const gl = this.gl;
    const z = -e[1] / e[0];
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.clearColor(z, z, z, z);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(0, 0, 0, 0);
  }

  private frame = 0;

  private use(name: string) {
    const p = this.progs[name];
    this.gl.useProgram(p.prog);
    if (p.u.uDither) this.gl.uniform1f(p.u.uDither, (this.frame * 17.13) % 997);
    return p.u;
  }

  private tex(unit: number, t: Target) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    return unit;
  }

  private draw(target: Target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private blit(src: Target, dst: Target, se: [number, number], de: [number, number]) {
    const gl = this.gl;
    const u = this.use('copy');
    gl.uniform1i(u.uSrc, this.tex(0, src));
    gl.uniform2fv(u.uSrcE, se);
    gl.uniform2fv(u.uOutE, de);
    this.draw(dst);
  }

  /** Adds a batch of splats to velocity and dye. */
  splat(list: Splat[], aspect: number, grain = 0) {
    if (!list.length) return;
    const gl = this.gl;
    const n = Math.min(MAX_SPLATS, list.length);
    const d = this.splatData;
    for (let i = 0; i < n; i++) {
      const s = list[i];
      const o = i * SPLAT_FLOATS;
      d[o] = s.x; d[o + 1] = s.y; d[o + 2] = s.rx; d[o + 3] = s.ry;
      d[o + 4] = s.color[0]; d[o + 5] = s.color[1]; d[o + 6] = s.color[2]; d[o + 7] = s.heat;
      d[o + 8] = s.fx; d[o + 9] = s.fy; d[o + 10] = s.radial; d[o + 11] = s.rot;
      d[o + 12] = s.star; d[o + 13] = s.points; d[o + 14] = s.square; d[o + 15] = s.hard;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * SPLAT_FLOATS);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const { u, prog } = this.splatProg;
    gl.useProgram(prog);
    gl.bindVertexArray(this.splatVao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uGrain, grain);
    gl.uniform1f(u.uSeed, (this.frame * 7.31) % 101);
    for (const [mode, pair, e] of [[0, this.vel, this.enc.vel], [1, this.dye, this.enc.dye]] as const) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, pair.read.fbo);
      gl.viewport(0, 0, pair.w, pair.h);
      gl.uniform1i(u.uMode, mode);
      gl.uniform2fv(u.uE, e);
      if (this.float) {
        gl.uniform1i(u.uSign, 0);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      } else {
        // Packed fields are linear in their encoding, so a change of Δ is a change of
        // Δ / scale in the stored value: blend the positive part in, then subtract the
        // negative part (dye only ever adds).
        gl.uniform1i(u.uSign, 1);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        if (mode === 0) {
          gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
          gl.uniform1i(u.uSign, -1);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
          gl.blendEquation(gl.FUNC_ADD);
        }
      }
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  step(s: StepParams, aspect: number) {
    const gl = this.gl;
    this.frame++;
    const e = this.enc;
    const simTexel = [1 / this.simW, 1 / this.simH];
    gl.disable(gl.BLEND);

    // Curl, then all body forces.
    let u = this.use('curl');
    gl.uniform2fv(u.uTexel, simTexel);
    gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
    gl.uniform2fv(u.uVelE, e.vel);
    gl.uniform2fv(u.uOutE, e.curl);
    this.draw(this.curl);

    u = this.use('forces');
    gl.uniform2fv(u.uTexel, simTexel);
    gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
    gl.uniform1i(u.uCurl, this.tex(1, this.curl));
    gl.uniform1i(u.uDye, this.tex(2, this.dye.read));
    gl.uniform2fv(u.uVelE, e.vel);
    gl.uniform2fv(u.uCurlE, e.curl);
    gl.uniform2fv(u.uDyeE, e.dye);
    gl.uniform1f(u.uDt, s.dt);
    gl.uniform1f(u.uCurlK, s.curl);
    // Confinement acts at the grid scale; rescale so the look survives resolution changes.
    gl.uniform1f(u.uResK, this.simH / 128);
    gl.uniform1f(u.uBuoy, s.buoyancy);
    gl.uniform1f(u.uGrav, s.gravity);
    gl.uniform1f(u.uSwirl, s.swirl);
    gl.uniform1f(u.uTurb, s.turbulence);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uThick, s.thickness);
    gl.uniform1f(u.uGrid, s.grid);
    gl.uniform2fv(u.uWind, s.wind);
    this.draw(this.vel.write);
    this.vel.swap();

    // Projection: make the velocity divergence-free.
    u = this.use('div');
    gl.uniform2fv(u.uTexel, simTexel);
    gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
    gl.uniform2fv(u.uVelE, e.vel);
    gl.uniform2fv(u.uOutE, e.div);
    this.draw(this.div);

    // Warm start from a decayed copy of last frame's pressure.
    u = this.use('scale');
    gl.uniform1i(u.uSrc, this.tex(0, this.p.read));
    gl.uniform2fv(u.uE, e.p);
    gl.uniform1f(u.uK, 0.8);
    this.draw(this.p.write);
    this.p.swap();

    u = this.use('pressure');
    gl.uniform2fv(u.uTexel, simTexel);
    gl.uniform1i(u.uDiv, this.tex(1, this.div));
    gl.uniform2fv(u.uPE, e.p);
    gl.uniform2fv(u.uDivE, e.div);
    for (let i = 0; i < s.iterations; i++) {
      gl.uniform1i(u.uP, this.tex(0, this.p.read));
      this.draw(this.p.write);
      this.p.swap();
    }

    u = this.use('gradient');
    gl.uniform2fv(u.uTexel, simTexel);
    gl.uniform1i(u.uP, this.tex(0, this.p.read));
    gl.uniform1i(u.uVel, this.tex(1, this.vel.read));
    gl.uniform2fv(u.uPE, e.p);
    gl.uniform2fv(u.uVelE, e.vel);
    this.draw(this.vel.write);
    this.vel.swap();

    // Advect velocity (its damping is the viscosity), then dye.
    const stepUv = [s.dt / aspect, s.dt];
    u = this.use('advect');
    const vk = Math.exp(-s.velFade * s.dt);
    gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
    gl.uniform1i(u.uSrc, this.tex(1, this.vel.read));
    gl.uniform2fv(u.uVelE, e.vel);
    gl.uniform2fv(u.uSrcE, e.vel);
    gl.uniform2fv(u.uStep, stepUv);
    gl.uniform4f(u.uFade, vk, vk, 1, 1);
    gl.uniform1f(u.uCap, 0);
    gl.uniform1f(u.uBudget, -1);
    gl.uniform1f(u.uDt, s.dt);
    this.draw(this.vel.write);
    this.vel.swap();

    const dk = Math.exp(-s.dyeFade * s.dt);
    const hk = Math.exp(-s.heatFade * s.dt);
    const cap = s.cap;
    if (s.maccormack) {
      gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
      gl.uniform1i(u.uSrc, this.tex(1, this.dye.read));
      gl.uniform2fv(u.uSrcE, e.dye);
      gl.uniform4f(u.uFade, 1, 1, 1, 1);
      gl.uniform1f(u.uCap, 0);
      gl.uniform1f(u.uBudget, -1);
      this.draw(this.dyeHat);
      u = this.use('mac');
      gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
      gl.uniform1i(u.uSrc, this.tex(1, this.dye.read));
      gl.uniform1i(u.uHat, this.tex(2, this.dyeHat));
      gl.uniform2fv(u.uVelE, e.vel);
      gl.uniform2fv(u.uSrcE, e.dye);
      gl.uniform2f(u.uSrcTexel, 1 / this.dyeW, 1 / this.dyeH);
      gl.uniform1f(u.uSharp, s.sharp);
      gl.uniform2fv(u.uStep, stepUv);
      gl.uniform4f(u.uFade, dk, dk, dk, hk);
      gl.uniform1f(u.uCap, cap);
      gl.uniform1f(u.uBudget, s.budget);
      gl.uniform1f(u.uDt, s.dt);
      this.draw(this.dye.write);
    } else {
      gl.uniform1i(u.uVel, this.tex(0, this.vel.read));
      gl.uniform1i(u.uSrc, this.tex(1, this.dye.read));
      gl.uniform2fv(u.uSrcE, e.dye);
      gl.uniform4f(u.uFade, dk, dk, dk, hk);
      gl.uniform1f(u.uCap, cap);
      gl.uniform1f(u.uBudget, s.budget);
      gl.uniform1f(u.uDt, s.dt);
      this.draw(this.dye.write);
    }
    this.dye.swap();
    gl.bindTexture(gl.TEXTURE_2D, this.dye.read.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    deletePair(gl, this.vel);
    deletePair(gl, this.dye);
    deletePair(gl, this.p);
    deleteTarget(gl, this.dyeHat);
    deleteTarget(gl, this.div);
    deleteTarget(gl, this.curl);
    for (const p of Object.values(this.progs)) gl.deleteProgram(p.prog);
    gl.deleteProgram(this.splatProg.prog);
    gl.deleteVertexArray(this.splatVao);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteBuffer(this.splatBuf);
  }
}
