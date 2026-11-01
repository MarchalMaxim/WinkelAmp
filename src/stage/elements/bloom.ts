/**
 * Chord bloom: broad soft color fields tinted by the harmony. The chord is read
 * from the chroma (triad templates); its root goes round the circle of fifths onto
 * the hue wheel (so related keys sit side by side), minor chords are cooler and
 * less saturated. On a chord change the fields cross-fade over ~1 s of music time.
 *
 *   fields  large soft drifting clouds
 *   aurora  vertical curtains hanging from the top
 */
import { fifthsPosition } from '../../visual/color';
import type { Rgb } from '../../character/types';
import { tintKeepLuma } from '../../character/palette';
import { clamp01, createProgram, ease, elementColor, fin, hueRgb, mixRgb, PASS_HEAD, type Program, QUAD_VS, setRegion, sizeK, vivid } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, StageElement, StageFrame, StageShared } from '../types';

export const widget = defineWidget({
  type: 'bloom',
  styles: [
    { name: 'fields', doc: 'large soft clouds' },
    { name: 'aurora', doc: 'curtains hanging from the top' },
  ],
  knobs: [{ name: 'fade', min: 0.1, max: 4, value: 1, doc: 'music seconds a chord change takes to cross-fade' }],
  follows: 'the harmony: chord root on the circle of fifths → hue, minor cooler and paler, cross-fades on chord changes',
  use: 'harmony-led, sustained, lush passages; a colour bed',
  layer: 10,
  create: (): StageElement => new Bloom(),
});

export interface Chord {
  root: number;
  minor: boolean;
}

/**
 * The best-matching major/minor triad of a 12-bin chroma, or null when the chroma
 * is too weak or too flat to name one (silence, noise): the caller keeps its chord.
 */
export function chordOf(chroma: ArrayLike<number>): Chord | null {
  let total = 0;
  let peak = 0;
  for (let i = 0; i < 12; i++) {
    const v = Math.max(0, fin(chroma[i] ?? 0));
    total += v;
    peak = Math.max(peak, v);
  }
  if (peak < 0.05 || total < 0.2) return null;
  let best: Chord | null = null;
  let bestScore = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const minor of [false, true]) {
      const tones = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12];
      let inside = 0;
      for (const t of tones) inside += Math.max(0, fin(chroma[t] ?? 0));
      // Root weighted a little more, so C-E-G is C major and not E minor (+6).
      const score = inside + 0.15 * Math.max(0, fin(chroma[root] ?? 0)) - (total - inside) * 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = { root, minor };
      }
    }
  }
  // A triad must hold a clear share of the energy, or it's not a chord.
  return bestScore > total * 0.25 ? best : null;
}

/** A chord's color: root on the fifths wheel; minor cooler (toward blue) and softer. */
export function chordRgb(c: Chord): Rgb {
  let h = fifthsPosition(c.root);
  if (c.minor) {
    // Pull the hue toward blue (0.62) along the short way round.
    let d = 0.62 - h;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    h += d * 0.35;
  }
  return hueRgb(h, c.minor ? 0.55 : 0.85, c.minor ? 0.45 : 0.55);
}

const FIELDS = PASS_HEAD + /* glsl */ `
uniform float uTime, uGain, uSize, uStyle;
uniform vec3 uCol, uOld, uDeep;
uniform float uMix;
void main() {
  vec2 c = (uRegion.xy + uRegion.zw) * 0.5;
  vec2 ext = (uRegion.zw - uRegion.xy) * 0.5;
  vec2 p = vec2((vUv.x - c.x) * uAspect, vUv.y - c.y);
  vec3 tint = mix(uOld, uCol, uMix);
  vec3 col = vec3(0.0);
  if (uStyle < 0.5) {
    // Fields: four big clouds drifting on music time, textured by slow noise.
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 o = vec2(sin(uTime * (0.05 + 0.02 * fi) + fi * 2.3) * ext.x * uAspect * 0.75,
                    cos(uTime * (0.04 + 0.015 * fi) + fi * 1.1) * ext.y * 0.7);
      float r = (0.3 + 0.12 * mod(fi, 2.0)) * uSize;
      float d = length(p - o) / r;
      float g = exp(-d * d * 1.4);
      vec3 ci = mix(tint, uDeep, mod(fi, 2.0) * 0.45);
      col += ci * g;
    }
    col *= 0.6 + 0.6 * fbm(p * 2.2 + vec2(uTime * 0.05, -uTime * 0.03));
  } else {
    // Aurora: curtains with folds that wander on music time, brightest at their lower hem.
    float x = p.x * 1.6;
    float warp = fbm(vec2(x * 0.8, uTime * 0.07)) * 1.6;
    float folds = pow(fbm(vec2((x + warp) * 3.2, uTime * 0.12)), 2.2) * 2.2;
    float y = (vUv.y - uRegion.y) / (uRegion.w - uRegion.y);
    float hem = 0.35 + 0.18 * (fbm(vec2(x * 1.3 + 4.0, uTime * 0.05)) - 0.5) * uSize;
    float above = smoothstep(hem - 0.03, hem + 0.02, y) * exp(-(y - hem) * 2.2 / uSize);
    float rays = 0.7 + 0.3 * vnoise(vec2(x * 40.0, y * 2.0));
    vec3 top = mix(tint, uDeep, 0.6);
    col = mix(tint * 1.3, top, smoothstep(hem, 1.0, y)) * folds * above * rays;
  }
  outColor = vec4(col * uGain * regionMask(vUv, 0.12), 1.0);
}`;

export class Bloom implements StageElement {
  readonly type = 'bloom' as const;
  private gl!: WebGL2RenderingContext;
  private shared!: StageShared;
  private prog!: Program;
  private chord: Chord | null = null;
  private old: Rgb | null = null;
  private fade = 1;
  private level = 0;

  init(gl: WebGL2RenderingContext, shared: StageShared) {
    this.gl = gl;
    this.shared = shared;
    this.prog = createProgram(gl, QUAD_VS, FIELDS, 'stage.bloom');
  }

  draw(fr: StageFrame, member: CastMember) {
    const s = this.shared;
    const prm = member.spec.params;
    const dm = fr.musicDt;
    const now = this.colorOf(this.chord, prm.color);
    // A new chord: the current mix becomes the old color, and the fields fade to the new one.
    if (dm > 0) {
      const c = chordOf(fr.chroma);
      if (c && (!this.chord || c.root !== this.chord.root || c.minor !== this.chord.minor)) {
        this.old = this.chord ? mixRgb(this.old ?? now, now, this.fade) : null;
        this.chord = c;
        this.fade = this.old ? 0 : 1;
      }
      this.fade = Math.min(1, this.fade + dm / widget.knob(fr, member, 'fade'));
    }
    this.level = ease(this.level, clamp01(fin(fr.f.level)), dm, 0.6);
    const gain = member.presence * prm.intensity;
    if (gain < 0.002) return;
    const col = this.colorOf(this.chord, prm.color);
    const old = this.old ?? col;
    const deep = vivid(elementColor(prm.color === 'note' ? 'mood' : prm.color, s, 0.35), 0.15);
    const gl = this.gl;
    const { u, prog } = this.prog;
    gl.useProgram(prog);
    setRegion(gl, this.prog, prm.region, s.aspect);
    gl.uniform1f(u.uTime, fr.clock.time);
    gl.uniform1f(u.uGain, gain * (0.16 + 0.34 * this.level * s.react));
    gl.uniform1f(u.uSize, sizeK(prm.size));
    gl.uniform1f(u.uStyle, widget.style(member) === 'aurora' ? 1 : 0);
    gl.uniform3f(u.uCol, col[0], col[1], col[2]);
    gl.uniform3f(u.uOld, old[0], old[1], old[2]);
    gl.uniform3f(u.uDeep, deep[0], deep[1], deep[2]);
    gl.uniform1f(u.uMix, this.fade * this.fade * (3 - 2 * this.fade));
    s.quad();
  }

  /** 'mood': the palette tinted toward the chord; 'note': the chord's own color; a fixed color stays fixed. */
  private colorOf(chord: Chord | null, color: string): Rgb {
    const s = this.shared;
    if (color !== 'mood' && color !== 'note') return vivid(elementColor(color, s, 0.7));
    const own = chord ? chordRgb(chord) : vivid(elementColor('mood', s, 0.7));
    if (color === 'note' || s.notes) return vivid(own, 0.4);
    return vivid(chord ? tintKeepLuma(elementColor('mood', s, 0.6), own, 0.85) : own, 0.35);
  }

  dispose() {
    this.gl.deleteProgram(this.prog.prog);
  }
}
