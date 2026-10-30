/**
 * Melody thread: traces the tune. The head sits at a fixed x and the past scrolls
 * left with music time, so the last ~4 music seconds of the phrase stay readable:
 * higher notes higher, a held note a long smooth segment, a leap a visible jump
 * (the stroke breaks and restarts), an unvoiced stretch a gap.
 *
 *   ribbon  a smooth glowing band
 *   beads   one glowing bead per note, its size growing with the note's duration
 *   ink     dye poured into the fluid when one is on stage, otherwise dry brush strokes
 */
import { MELODY_RANGE } from '../../audio/melody';
import type { SoundEvent } from '../../character/types';
import { Brush, clamp01, ease, elementColor, fin, regionRect, scale, Shape, sizeK, type StrokePoint, styleOf, vivid } from '../gl';
import { type CastMember, STYLES, type StageElement, type StageFrame, type StageShared } from '../types';

/** Music seconds of trail. */
const LIFE = 4;
/** Head position across the region. */
const HEAD = 0.8;
/** A pitch move larger than this (semitones) between frames is a leap: the stroke breaks. */
const LEAP = 2.5;

interface Pt {
  /** Music time it was drawn at. */
  t: number;
  /** MIDI pitch (smoothed); NaN = gap. */
  p: number;
  /** 0..1 salience. */
  s: number;
}

interface Bead {
  t0: number;
  t1: number;
  p: number;
  s: number;
}

/** MIDI → 0..1 over MELODY_RANGE. */
export const pitchHeight = (midi: number) => clamp01((midi - MELODY_RANGE[0]) / (MELODY_RANGE[1] - MELODY_RANGE[0]));

export class Melody implements StageElement {
  readonly type = 'melody' as const;
  private shared!: StageShared;
  private pts: Pt[] = [];
  private beads: Bead[] = [];
  private bead: Bead | null = null;
  private smooth = NaN;

  init(_gl: WebGL2RenderingContext, shared: StageShared) {
    this.shared = shared;
  }

  private update(fr: StageFrame) {
    const now = fr.clock.time;
    const mel = fr.melody;
    const voiced = mel.voiced && Number.isFinite(mel.pitch) && mel.salience > 0.02;
    if (fr.musicDt > 0) {
      if (voiced) {
        if (!Number.isFinite(this.smooth) || Math.abs(mel.pitch - this.smooth) > LEAP) {
          // A leap (or the first note after a gap): break and start where the note is.
          if (Number.isFinite(this.smooth)) this.pts.push({ t: now, p: NaN, s: 0 });
          this.smooth = mel.pitch;
        } else {
          // Steps bend quickly but smoothly; vibrato survives as a gentle wave.
          this.smooth = ease(this.smooth, mel.pitch, fr.musicDt, 0.03);
        }
        this.pts.push({ t: now, p: this.smooth, s: clamp01(fin(mel.salience)) });
      } else if (this.pts.length && Number.isFinite(this.pts[this.pts.length - 1].p)) {
        this.pts.push({ t: now, p: NaN, s: 0 });
        this.smooth = NaN;
      }
      while (this.pts.length && now - this.pts[0].t > LIFE) this.pts.shift();
      // Beads: one per note; a new note (or a pitch change without a noteOn) starts the next.
      if (voiced) {
        if (!this.bead || mel.noteOn || Math.abs(mel.pitch - this.bead.p) > 0.7) {
          this.bead = { t0: now, t1: now, p: mel.pitch, s: clamp01(fin(mel.salience)) };
          this.beads.push(this.bead);
        } else {
          this.bead.t1 = now;
          this.bead.s = Math.max(this.bead.s, clamp01(fin(mel.salience)));
        }
      } else this.bead = null;
      while (this.beads.length && now - this.beads[0].t1 > LIFE) this.beads.shift();
    }
  }

  draw(fr: StageFrame, member: CastMember) {
    this.update(fr);
    const s = this.shared;
    const prm = member.spec.params;
    const style = styleOf(prm.style, STYLES.melody);
    const gain = member.presence * prm.intensity;
    if (gain < 0.002) return;
    const [x0, y0, x1, y1] = regionRect(prm.region);
    const headX = x0 + (x1 - x0) * HEAD;
    const now = fr.clock.time;
    const k = sizeK(prm.size);
    const xAt = (t: number) => headX - ((now - t) / LIFE) * (headX - x0);
    const yAt = (p: number) => y0 + (y1 - y0) * (0.06 + 0.88 * pitchHeight(p));
    const fade = (t: number) => Math.pow(clamp01(1 - (now - t) / LIFE), 1.3);
    const colorAt = (p: number, bright: number) => scale(vivid(elementColor(prm.color, s, 0.55 + 0.45 * pitchHeight(p), p)), bright);

    if (style === 'beads') {
      // A faint thread through the notes keeps the contour readable between beads.
      this.thread(xAt, yAt, fade, colorAt, gain * 0.35, 0.0018 * k);
      for (const b of this.beads) {
        const dur = Math.max(0, b.t1 - b.t0);
        const r = (0.012 + 0.032 * Math.sqrt(Math.min(2.5, dur))) * k * (0.6 + 0.4 * s.react) * (0.7 + 0.5 * b.s);
        const a = fade(b.t1) * gain * (0.6 + 0.8 * b.s);
        s.sprites.add(xAt(b.t0), yAt(b.p), r, r, 0, colorAt(b.p, a * 1.6), Shape.Bead);
        s.sprites.add(xAt(b.t0), yAt(b.p), r * 2.4, r * 2.4, 0, colorAt(b.p, a * 0.25), Shape.Glow);
      }
      s.sprites.flush();
      return;
    }

    if (style === 'ink' && s.fluid) {
      // Ink feeds the fluid at the head (SoundEvent: pan/height in the fluid's emitter space).
      const mel = fr.melody;
      if (mel.voiced && Number.isFinite(mel.pitch)) {
        const y = yAt(mel.pitch);
        const c = colorAt(mel.pitch, 1);
        const ev: SoundEvent = {
          height: clamp01((y - 0.07) / 0.84), pan: Math.max(-1, Math.min(1, (headX - 0.5) / 0.38)),
          strength: clamp01(fin(mel.salience) * gain * 1.3), note: ((Math.round(mel.pitch) % 12) + 12) % 12,
          color: c, onset: mel.noteOn,
        };
        s.ink.push(ev);
      }
      // A thin bright line still shows exactly where the tune is.
      this.thread(xAt, yAt, fade, colorAt, gain * 0.5, 0.0015 * k);
      return;
    }

    const ink = style === 'ink';
    let run: StrokePoint[] = [];
    const flushRun = () => {
      if (run.length >= 2) s.strokes.add(run);
      run = [];
    };
    for (const p of this.pts) {
      if (!Number.isFinite(p.p)) {
        flushRun();
        continue;
      }
      const f = fade(p.t);
      const w = ink
        ? (0.006 + 0.03 * p.s) * k * (0.4 + 0.6 * f) * (0.6 + 0.4 * s.react)
        : (0.003 + 0.016 * p.s * prm.intensity) * k * (0.35 + 0.65 * f) * (0.6 + 0.4 * s.react);
      const bright = gain * f * (ink ? 1.4 : 0.9 + 2 * p.s);
      run.push({ x: xAt(p.t), y: yAt(p.p), w, c: colorAt(p.p, bright), core: ink ? 0 : 1.2 });
    }
    flushRun();
    s.strokes.flush(ink ? Brush.Ink : Brush.Glow);
    // The head: where the tune is now.
    const last = this.pts[this.pts.length - 1];
    if (!ink && last && Number.isFinite(last.p)) {
      const r = (0.01 + 0.03 * last.s) * k;
      s.sprites.add(xAt(last.t), yAt(last.p), r, r, 0, colorAt(last.p, gain * (0.8 + 1.5 * last.s)), Shape.Glow, 0.3);
      s.sprites.flush();
    }
  }

  /** A thin line through the recent contour. */
  private thread(
    xAt: (t: number) => number, yAt: (p: number) => number, fade: (t: number) => number,
    colorAt: (p: number, b: number) => [number, number, number], gain: number, w: number,
  ) {
    let run: StrokePoint[] = [];
    for (const p of this.pts) {
      if (!Number.isFinite(p.p)) {
        if (run.length >= 2) this.shared.strokes.add(run);
        run = [];
        continue;
      }
      run.push({ x: xAt(p.t), y: yAt(p.p), w, c: colorAt(p.p, gain * fade(p.t)), core: 1 });
    }
    if (run.length >= 2) this.shared.strokes.add(run);
    this.shared.strokes.flush();
  }

  dispose() {
    this.pts = [];
    this.beads = [];
  }
}
