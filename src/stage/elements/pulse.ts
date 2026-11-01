/**
 * Pulse: the beat, when there is one. Hidden while the pulse clarity is below 0.3
 * (rubato piano has no beat to show); otherwise every beat hit fires:
 *
 *   rings  a ring expanding from the region's centre
 *   grid   a lattice that throbs
 *   flash  the region lights up and decays
 *
 * Ages and decays run on music time, so a held silence holds the last throb.
 */
import { clamp01, createProgram, ease, elementColor, fin, PASS_HEAD, type Program, QUAD_VS, regionRect, scale, setRegion, Shape, sizeK, vivid } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, StageElement, StageFrame, StageShared } from '../types';

/** Below this pulse clarity there is no beat to show (the `gate` knob's default). */
export const CLARITY = 0.3;
/** The director casts the pulse only above this pulse clarity. */
const CAST_CLARITY = 0.35;

export const widget = defineWidget({
  type: 'pulse',
  styles: [
    { name: 'rings', doc: "a ring from the region's centre" },
    { name: 'grid', doc: 'a throbbing lattice' },
    { name: 'flash', doc: 'the region lights up' },
  ],
  knobs: [
    { name: 'gate', min: 0, max: 1, value: CLARITY, doc: 'the pulse clarity below which there is no beat to show' },
    { name: 'decay', min: 0.25, max: 3, value: 1, doc: "how fast each throb dies away (× the style's own rate)" },
  ],
  follows: 'the beat (hidden while pulse clarity < 0.3)',
  use: 'music with a clear, steady beat (dance, march, ragtime). Not for rubato',
  layer: 40,
  crisp: true,
  stream: (s) => (fin(s.pulse) > CAST_CLARITY ? 1 : 0),
  create: (): StageElement => new Pulse(),
});

const PASS = PASS_HEAD + /* glsl */ `
uniform float uEnv, uGain, uStyle, uCell;
uniform vec3 uCol;
void main() {
  vec2 c = (uRegion.xy + uRegion.zw) * 0.5;
  vec2 p = vec2((vUv.x - c.x) * uAspect, vUv.y - c.y);
  float m = regionMask(vUv, 0.03);
  vec3 col;
  if (uStyle < 0.5) {
    // Grid: lines that brighten on the beat, the lattice breathing outward a touch.
    vec2 g = p * (1.0 - 0.05 * uEnv) / uCell;
    vec2 f = abs(fract(g) - 0.5);
    float line = exp(-pow((0.5 - max(f.x, f.y)) * uCell * 260.0, 2.0));
    float node = exp(-dot(f - 0.5, f - 0.5) * 120.0);
    float fall = exp(-dot(p, p) * 1.2);
    col = uCol * (line * (0.06 + 0.9 * uEnv) + node * 0.6 * uEnv) * (0.3 + 0.7 * fall);
  } else {
    // Flash: the region fills with light, strongest at its middle.
    float fall = exp(-dot(p, p) * 3.0);
    col = uCol * uEnv * (0.04 + 0.96 * fall);
  }
  outColor = vec4(col * uGain * m, 1.0);
}`;

interface Ring {
  t: number;
  s: number;
}

export class Pulse implements StageElement {
  readonly type = 'pulse' as const;
  private gl!: WebGL2RenderingContext;
  private shared!: StageShared;
  private prog!: Program;
  private rings: Ring[] = [];
  private env = 0;
  private vis = 0;

  init(gl: WebGL2RenderingContext, shared: StageShared) {
    this.gl = gl;
    this.shared = shared;
    this.prog = createProgram(gl, QUAD_VS, PASS, 'stage.pulse');
  }

  draw(fr: StageFrame, member: CastMember) {
    const s = this.shared;
    const prm = member.spec.params;
    const style = widget.style(member);
    const now = fr.clock.time;
    const dm = fr.musicDt;
    const clear = fin(fr.d.pulseClarity) >= widget.knob(fr, member, 'gate');
    this.vis = clear ? ease(this.vis, 1, dm, 0.3) : ease(this.vis, 0, dm, 0.15);
    if (dm > 0) this.env *= Math.exp(-dm * (style === 'flash' ? 7 : 5) * widget.knob(fr, member, 'decay'));
    // Only while the music moves: with the clock frozen a ring would never expand or fade.
    if (fr.beat.hit && clear && dm > 0) {
      const st = clamp01(fin(fr.beat.strength) || 1);
      this.env = Math.max(this.env, st);
      this.rings.push({ t: now, s: st });
    }
    this.rings = this.rings.filter((r) => now - r.t < 2.5);
    const gain = member.presence * prm.intensity * this.vis;
    if (gain < 0.002) return;
    const c = vivid(elementColor(prm.color, s, 0.85, fr.f.note), 0.45);
    const k = sizeK(prm.size);
    if (style === 'rings') {
      const [x0, y0, x1, y1] = regionRect(prm.region);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      for (const r of this.rings) {
        const age = Math.max(0, now - r.t);
        const rad = (0.03 + age * 0.42 * s.react) * k;
        const a = gain * r.s * Math.exp(-age * 2.2) * 1.2;
        s.sprites.add(cx, cy, rad, rad, 0, scale(c, a), Shape.Ring, Math.max(0.03, 0.12 - age * 0.04));
      }
      s.sprites.flush();
      return;
    }
    const gl = this.gl;
    const { u, prog } = this.prog;
    gl.useProgram(prog);
    setRegion(gl, this.prog, prm.region, s.aspect);
    gl.uniform1f(u.uEnv, this.env * s.react);
    gl.uniform1f(u.uGain, gain * (style === 'flash' ? 0.5 : 1));
    gl.uniform1f(u.uStyle, style === 'grid' ? 0 : 1);
    gl.uniform1f(u.uCell, 0.11 * k);
    gl.uniform3f(u.uCol, c[0], c[1], c[2]);
    s.quad();
  }

  dispose() {
    this.gl.deleteProgram(this.prog.prog);
    this.rings = [];
  }
}
