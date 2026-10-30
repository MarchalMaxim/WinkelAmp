/**
 * Drip: on note attacks, streaks of paint run down from the top of the region,
 * accelerating, so the picture seems to drip off the screen. Each drip is a round
 * head with a short brushed tail (the sketch's 40 px); the streak behind it is the
 * trailed scene's memory, so it melts and is sliced by cuts with the rest of the
 * picture. Everything moves on music time: silence holds the drips mid-fall.
 *
 *   paint  the palette's mid and highlight (mostly mid, as the sketch was mostly blood)
 *   tar    the palette's shadow, near black
 *
 * `intensity` → how many per attack, `size` → how wide.
 */
import type { Rgb } from '../../character/types';
import { Brush, clamp01, fin, mixRgb, regionRect, scale, Shape, sizeK, type StrokePoint, styleOf, vivid } from '../gl';
import { type CastMember, STYLES, type StageElement, type StageFrame, type StageShared } from '../types';

const MAX = 160;
/** Speed gained per music second (× e^ACCEL·dt): the sketch's 1 % a frame at 60 fps. */
const ACCEL = 0.6;
/** The tail drawn above the head, screen heights. */
const TAIL = 0.055;

interface D {
  x: number;
  /** Where it started, and its head (screen y, up). */
  top: number;
  y: number;
  /** Screen heights per music second, downward. */
  v: number;
  /** Head width, screen heights. */
  w: number;
  c: Rgb;
}

export class Drip implements StageElement {
  readonly type = 'drip' as const;
  private shared!: StageShared;
  private ds: D[] = [];

  init(_gl: WebGL2RenderingContext, shared: StageShared) {
    this.shared = shared;
  }

  draw(fr: StageFrame, member: CastMember) {
    const s = this.shared;
    const r = s.rand;
    const prm = member.spec.params;
    const style = styleOf(prm.style, STYLES.drip);
    const [x0, y0, x1, y1] = regionRect(prm.region);
    const dm = fr.musicDt;
    const k = sizeK(prm.size);

    // Spawning, only while the music moves (a frozen drip would hang at the top).
    if (member.presence > 0.05 && dm > 0) {
      for (const e of fr.events) {
        if (!e.onset) continue;
        const st = clamp01(fin(e.strength));
        const want = clamp01(fin(prm.intensity)) * s.react * (0.5 + 3 * st * st);
        const n = Math.floor(want) + (r() < want % 1 ? 1 : 0);
        for (let i = 0; i < n && this.ds.length < MAX; i++) {
          const p = s.palette;
          const c = style === 'tar'
            // Additive light can't darken: tar is the shadow lifted just enough to read as a dark sheen.
            ? vivid(mixRgb(p[0], [0.02, 0.018, 0.015], 0.4), 0.04)
            : vivid(r() < 0.7 ? p[2] : p[3], 0.3);
          const top = y1 + 0.01;
          this.ds.push({
            x: x0 + (x1 - x0) * r(), top, y: top - 0.01,
            v: 0.11 + 0.25 * r(),
            w: (0.006 + 0.016 * r()) * (0.6 + 0.4 * st) * k,
            c,
          });
        }
      }
    }

    if (dm > 0) {
      const acc = Math.exp(ACCEL * dm);
      for (const d of this.ds) {
        d.y -= d.v * dm;
        d.v *= acc;
      }
      this.ds = this.ds.filter((d) => d.y > y0 - 0.1);
    }

    const gain = member.presence * clamp01(fin(prm.intensity));
    if (gain < 0.002 || !this.ds.length) return;
    const bright = gain * (style === 'tar' ? 1 : 1.4);
    for (const d of this.ds) {
      // Only the head and a short tail are drawn: the stem above is the feedback's memory of
      // them, so it fades, melts and is sliced by a cut (a stem redrawn whole every frame would
      // paint over the slice at once).
      const tail = Math.min(TAIL, d.top - d.y);
      const pts: StrokePoint[] = [];
      for (let i = 0; i <= 3; i++) {
        const f = i / 3;
        pts.push({ x: d.x, y: d.y + tail * (1 - f), w: d.w * (0.45 + 0.35 * f), c: scale(d.c, bright * (0.7 + 0.3 * f)), core: 0 });
      }
      s.strokes.add(pts);
      s.sprites.add(d.x, d.y, d.w * 1.1, d.w * 1.25, 0, scale(d.c, bright), Shape.Glow, 1);
    }
    s.strokes.flush(Brush.Ink);
    s.sprites.flush();
  }

  dispose() {
    this.ds = [];
  }
}
