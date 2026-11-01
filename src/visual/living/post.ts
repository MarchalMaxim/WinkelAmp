/**
 * Image pipeline after the simulation: compose the HDR scene (dye light, heat glow,
 * glints, aura), let the caller add sparks, then bloom and the final grade to the
 * screen.
 */
import { createProgram, createTarget, deleteTarget, formats, type GL, type Program, QUAD_VS, type Target } from './gl';
import * as S from './shaders';

export interface SceneParams {
  emissive: number;
  gloss: number;
  aura: number;
  heatGlow: number;
  flash: number;
  gain: number;
  grid: number;
  shade: number;
  time: number;
}

export interface FinalParams {
  time: number;
  bloom: number;
  exposure: number;
  shimmer: number;
  aberration: number;
  grade: number;
  contrast: number;
  grain: number;
  vignette: number;
}

const BLOOM_LEVELS = 6;

export class Post {
  scene!: Target;
  private bloom: Target[] = [];
  private p: Record<string, Program> = {};
  private vao: WebGLVertexArrayObject;
  w = 0;
  h = 0;

  constructor(private gl: GL, private float: boolean) {
    const list: [string, string][] = [
      ['scene', S.SCENE], ['pre', S.BLOOM_PRE], ['down', S.BLOOM_DOWN], ['up', S.BLOOM_UP], ['final', S.FINAL],
    ];
    for (const [k, fs] of list) this.p[k] = createProgram(gl, QUAD_VS, fs, k);
    this.vao = gl.createVertexArray()!;
  }

  allocate(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    const f = formats(gl, this.float).rgba;
    deleteTarget(gl, this.scene);
    this.bloom.forEach((t) => deleteTarget(gl, t));
    this.scene = createTarget(gl, w, h, f);
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

  private draw(t: Target | null, w: number, h: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bind(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return unit;
  }

  /** Renders the scene; leaves its framebuffer bound so sparks can be added on top. */
  compose(dye: Target, dyeE: [number, number], aura: Target, palette: Float32Array, s: SceneParams) {
    const gl = this.gl;
    const { u, prog } = this.p.scene;
    gl.useProgram(prog);
    gl.uniform1i(u.uDye, this.bind(0, dye.tex));
    gl.uniform1i(u.uAura, this.bind(1, aura.tex));
    gl.uniform2fv(u.uDyeE, dyeE);
    gl.uniform2f(u.uDyeTexel, 1 / dye.w, 1 / dye.h);
    gl.uniform3fv(u.uPal, palette);
    gl.uniform1f(u.uEmissive, s.emissive);
    gl.uniform1f(u.uGloss, s.gloss);
    gl.uniform1f(u.uAuraAmt, s.aura);
    gl.uniform1f(u.uHeatGlow, s.heatGlow);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform1f(u.uFlash, s.flash);
    gl.uniform1f(u.uGain, s.gain);
    gl.uniform1f(u.uGrid, s.grid);
    gl.uniform1f(u.uShade, s.shade);
    gl.uniform1f(u.uAspect, this.w / this.h);
    this.draw(this.scene, this.w, this.h);
  }

  finish(dye: Target, dyeE: [number, number], palette: Float32Array, outW: number, outH: number, f: FinalParams) {
    const gl = this.gl;
    const b = this.bloom;
    let pr = this.p.pre;
    gl.useProgram(pr.prog);
    gl.uniform1i(pr.u.uSrc, this.bind(0, this.scene.tex));
    gl.uniform2f(pr.u.uTexel, 1 / this.w, 1 / this.h);
    gl.uniform1f(pr.u.uThreshold, 0.55);
    gl.uniform1f(pr.u.uKnee, 0.4);
    this.draw(b[0], b[0].w, b[0].h);
    pr = this.p.down;
    gl.useProgram(pr.prog);
    for (let i = 1; i < b.length; i++) {
      gl.uniform1i(pr.u.uSrc, this.bind(0, b[i - 1].tex));
      gl.uniform2f(pr.u.uTexel, 1 / b[i - 1].w, 1 / b[i - 1].h);
      this.draw(b[i], b[i].w, b[i].h);
    }
    pr = this.p.up;
    gl.useProgram(pr.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = b.length - 1; i > 0; i--) {
      gl.uniform1i(pr.u.uSrc, this.bind(0, b[i].tex));
      gl.uniform2f(pr.u.uTexel, 0.5 / b[i].w, 0.5 / b[i].h);
      this.draw(b[i - 1], b[i - 1].w, b[i - 1].h);
    }
    gl.disable(gl.BLEND);

    pr = this.p.final;
    const u = pr.u;
    gl.useProgram(pr.prog);
    gl.uniform1i(u.uScene, this.bind(0, this.scene.tex));
    gl.uniform1i(u.uBloom, this.bind(1, b[0].tex));
    gl.uniform1i(u.uDye, this.bind(2, dye.tex));
    gl.uniform2fv(u.uDyeE, dyeE);
    gl.uniform2f(u.uRes, outW, outH);
    gl.uniform3fv(u.uPal, palette);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1f(u.uBloomAmt, f.bloom);
    gl.uniform1f(u.uExposure, f.exposure);
    gl.uniform1f(u.uShimmer, f.shimmer);
    gl.uniform1f(u.uAberr, f.aberration);
    gl.uniform1f(u.uGrade, f.grade);
    gl.uniform1f(u.uContrast, f.contrast);
    gl.uniform1f(u.uGrain, f.grain);
    gl.uniform1f(u.uVignette, f.vignette);
    gl.uniform1f(u.uAspect, outW / outH);
    this.draw(null, outW, outH);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    deleteTarget(gl, this.scene);
    this.bloom.forEach((t) => deleteTarget(gl, t));
    Object.values(this.p).forEach((p) => gl.deleteProgram(p.prog));
    gl.deleteVertexArray(this.vao);
  }
}
