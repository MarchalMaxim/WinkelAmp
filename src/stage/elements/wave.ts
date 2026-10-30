/**
 * Wave: an oscilloscope of the raw waveform — the finest detail of the sound.
 * The trace starts at a rising zero crossing so a steady tone stands still instead
 * of crawling, and its gain follows the recent peak (on music time), so quiet
 * passages still show their shape.
 *
 *   line    across the region
 *   circle  wrapped round the region's centre
 */
import { clamp01, ease, elementColor, fin, regionRect, scale, sizeK, type StrokePoint, styleOf, vivid } from '../gl';
import { type CastMember, STYLES, type StageElement, type StageFrame, type StageShared } from '../types';

/** Samples shown, and points drawn. */
const SPAN = 1024;
const POINTS = 256;

/** Index of the first rising zero crossing in the first half of `w` (0 if none). */
export function trigger(w: ArrayLike<number>): number {
  const end = Math.max(1, w.length - SPAN);
  for (let i = 1; i < end; i++) if (w[i - 1] < 0 && w[i] >= 0) return i;
  return 0;
}

export class Wave implements StageElement {
  readonly type = 'wave' as const;
  private shared!: StageShared;
  private peak = 0.2;
  /**
   * The waveform and level last seen while the music moved. With the clock frozen the
   * scope holds this instead of the live feed, so room noise can't make it jitter.
   * Starts flat: a scope born in silence (or after a track change) is a still line.
   */
  private held = new Float32Array(SPAN * 2);
  private level = 0;

  init(_gl: WebGL2RenderingContext, shared: StageShared) {
    this.shared = shared;
  }

  draw(fr: StageFrame, member: CastMember) {
    const s = this.shared;
    if (fr.musicDt > 0) {
      const live = fr.wave;
      if (live.length !== this.held.length) this.held = new Float32Array(live.length);
      this.held.set(live);
      this.level = clamp01(fin(fr.f.level));
    }
    const w = this.held;
    let pk = 0;
    for (let i = 0; i < w.length; i++) pk = Math.max(pk, Math.abs(fin(w[i])));
    this.peak = ease(this.peak, pk, fr.musicDt, pk > this.peak ? 0.05 : 0.8);
    const prm = member.spec.params;
    const gain = member.presence * prm.intensity;
    if (gain < 0.002 || w.length < 2) return;
    const [x0, y0, x1, y1] = regionRect(prm.region);
    const k = sizeK(prm.size);
    const norm = 0.9 / Math.max(0.08, this.peak);
    const start = trigger(w);
    const n = Math.min(SPAN, w.length - start);
    const level = this.level;
    const c =vivid(elementColor(prm.color, s, 0.92, fr.f.note), 0.5);
    const bright = gain * (0.7 + 0.9 * level);
    const width = (0.0022 + 0.003 * level) * k;
    const sample = (j: number) => {
      // Average the samples under each point: a cheap low-pass, so the trace isn't aliased hash.
      const a = start + Math.floor((j * n) / POINTS);
      const b = start + Math.max(Math.floor(((j + 1) * n) / POINTS), a + 1);
      let sum = 0;
      for (let i = a; i < b; i++) sum += fin(w[i]);
      return Math.max(-1.2, Math.min(1.2, (sum / (b - a)) * norm));
    };
    const pts: StrokePoint[] = [];
    if (styleOf(prm.style, STYLES.wave) === 'circle') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const r0 = 0.22 * Math.min(y1 - y0, (x1 - x0) * s.aspect) * k;
      const amp = r0 * 0.45 * s.react;
      for (let j = 0; j < POINTS; j++) {
        const a = (j / POINTS) * Math.PI * 2 + Math.PI / 2;
        const r = r0 + sample(j) * amp;
        pts.push({ x: cx + (Math.cos(a) * r) / s.aspect, y: cy + Math.sin(a) * r, w: width, c: scale(c, bright), core: 1.4 });
      }
      s.strokes.add(pts, true);
    } else {
      const cy = (y0 + y1) / 2;
      const amp = (y1 - y0) * 0.3 * k * s.react;
      for (let j = 0; j < POINTS; j++) {
        const x = x0 + (x1 - x0) * (0.04 + (0.92 * j) / (POINTS - 1));
        // Taper the ends so the trace floats rather than being cut off.
        const edge = Math.min(1, j / 20, (POINTS - 1 - j) / 20);
        pts.push({ x, y: cy + sample(j) * amp * edge, w: width * (0.3 + 0.7 * edge), c: scale(c, bright * edge), core: 1.4 });
      }
      s.strokes.add(pts);
    }
    s.strokes.flush();
  }

  dispose() {}
}
