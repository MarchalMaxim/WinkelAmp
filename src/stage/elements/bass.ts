/**
 * Bass masses: big, soft, heavy shapes low in the region. Their size follows the
 * bass level and the music's weight; they drift slowly with the reservoir gesture.
 *
 *   orbs   three soft glowing bodies that swell with the bass
 *   tides  horizontal swells rolling along the bottom
 */
import { createProgram, ease, elementColor, fin, mix, PASS_HEAD, type Program, QUAD_VS, scale, setRegion, Shape, sizeK, vivid, regionRect, clamp01 } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, StageElement, StageFrame, StageShared } from '../types';

/** Music seconds the shapes take to sink after the bass drops (the `sink` knob's default). */
const SINK = 0.35;

export const widget = defineWidget({
  type: 'bass',
  styles: [
    { name: 'orbs', doc: 'three soft bodies that swell with the bass' },
    { name: 'tides', doc: 'swells rolling along the bottom' },
  ],
  knobs: [{ name: 'sink', min: 0.05, max: 2, value: SINK, doc: 'music seconds the shapes take to settle after the bass drops' }],
  follows: "the bass level and the music's weight",
  use: 'heavy, low, dark music; a bass line that matters',
  layer: 20,
  stream: (s) => clamp01(fin(s.bass)),
  create: (): StageElement => new Bass(),
});

const TIDES = PASS_HEAD + /* glsl */ `
uniform float uTime, uAmp, uWeight, uGain;
uniform vec3 uColA, uColB;
void main() {
  float h = uRegion.w - uRegion.y;
  float y = (vUv.y - uRegion.y) / h;
  float x = vUv.x * uAspect;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float base = 0.08 + 0.08 * fi;
    float amp = uAmp * (0.05 + 0.025 * fi);
    float w = base + amp * sin(x * (1.6 + fi * 0.9) + uTime * (0.45 + 0.2 * fi) + fi * 1.7)
                   + amp * 0.45 * sin(x * (4.1 + fi) - uTime * (0.7 + 0.1 * fi) + fi * 2.9);
    float d = y - w;
    float crest = exp(-d * d / (0.00025 + 0.0012 * uWeight));
    float body = smoothstep(0.0, -0.35, d) * exp(d * 2.5) * 0.35;
    col += mix(uColA, uColB, fi / 3.0) * (crest + body) * (1.0 - 0.18 * fi);
  }
  outColor = vec4(col * uGain * regionMask(vUv, 0.04), 1.0);
}`;

export class Bass implements StageElement {
  readonly type = 'bass' as const;
  private gl!: WebGL2RenderingContext;
  private shared!: StageShared;
  private prog: Program | null = null;
  private level = 0;
  private hit = 0;
  private prev = 0;

  init(gl: WebGL2RenderingContext, shared: StageShared) {
    this.gl = gl;
    this.shared = shared;
  }

  draw(fr: StageFrame, member: CastMember) {
    const dm = fr.musicDt;
    const bass = clamp01(fin(fr.f.bass));
    // Swell fast, sink slowly; a jump in the bass is a hit that briefly inflates the shapes.
    this.level = ease(this.level, bass, dm, bass > this.level ? 0.05 : widget.knob(fr, member, 'sink'));
    if (dm > 0) {
      if (bass - this.prev > 0.12) this.hit = Math.max(this.hit, bass);
      this.hit *= Math.exp(-dm * 4);
      this.prev = bass;
    }
    const prm = member.spec.params;
    const gain = member.presence * prm.intensity;
    if (gain < 0.002) return;
    const s = this.shared;
    const weight = clamp01(fin(fr.character.axes.weight));
    const k = sizeK(prm.size);
    const lv = clamp01((this.level + this.hit * 0.4) * s.react);
    const g = fr.gesture;
    const t = fr.clock.time;
    if (widget.style(member) === 'tides') {
      const gl = this.gl;
      this.prog ??= createProgram(gl, QUAD_VS, TIDES, 'stage.tides');
      const { u, prog } = this.prog;
      gl.useProgram(prog);
      setRegion(gl, this.prog, prm.region, s.aspect);
      gl.uniform1f(u.uTime, t * 0.8 + fin(g.x) * 0.6);
      gl.uniform1f(u.uAmp, (0.25 + 0.8 * lv) * (0.7 + 0.6 * weight) * k);
      gl.uniform1f(u.uWeight, weight);
      gl.uniform1f(u.uGain, gain * (0.2 + 0.6 * lv));
      const a = vivid(elementColor(prm.color, s, 0.45, fr.f.note));
      const b = vivid(elementColor(prm.color, s, 0.8, fr.f.note));
      gl.uniform3f(u.uColA, a[0], a[1], a[2]);
      gl.uniform3f(u.uColB, b[0], b[1], b[2]);
      s.quad();
      return;
    }
    const [x0, y0, x1, y1] = regionRect(prm.region);
    const w = x1 - x0;
    const h = y1 - y0;
    for (let i = 0; i < 3; i++) {
      const mid = i === 1;
      const x = x0 + w * (0.22 + 0.28 * i) + fin(g.x) * 0.06 * w + Math.sin(t * 0.11 + i * 2.1) * 0.04 * w;
      const y = y0 + h * (0.2 + 0.05 * Math.sin(t * 0.09 + i * 1.3)) + fin(g.y) * 0.04 * h;
      const r = (0.07 + 0.2 * lv) * (0.6 + 0.8 * weight) * k * (mid ? 1.2 : 0.85) * Math.min(1, h * 1.6);
      const c = vivid(elementColor(prm.color, s, mix(0.35, 0.65, i / 2), fr.f.note), 0.45);
      const bright = gain * (0.25 + 0.95 * lv);
      s.sprites.add(x, y, r * 1.9, r * 1.6, 0, scale(c, bright * 0.18), Shape.Glow, 0);
      s.sprites.add(x, y, r, r * 0.9, 0, scale(c, bright * 1.1), Shape.Glow, 0.15);
    }
    s.sprites.flush();
  }

  dispose() {
    if (this.prog) this.gl.deleteProgram(this.prog.prog);
    this.prog = null;
  }
}
