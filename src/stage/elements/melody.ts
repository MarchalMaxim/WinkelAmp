/**
 * Melody thread: traces the tune. The head sits at a fixed x and the past scrolls
 * left with music time, so the last ~4 music seconds of the phrase stay readable:
 * higher notes higher, a held note a long smooth segment, a leap a visible jump
 * (the stroke breaks and restarts), an unvoiced stretch a gap.
 *
 *   ribbon  a smooth glowing band
 *   beads   one glowing bead per note, its size growing with the note's duration
 *   ink     dye poured into the fluid when one is on stage, otherwise dry brush strokes
 *
 * Under a mirror the thread lays itself out inside the part of the frame the mirror
 * keeps (melodyLayout), so the note sounding now is always on screen.
 */
import { MELODY_RANGE } from '../../audio/melody';
import type { SoundEvent } from '../../character/types';
import { Brush, clamp01, ease, elementColor, fin, regionRect, scale, Shape, sizeK, type StrokePoint, vivid } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, Region, StageElement, StageFrame, StageShared } from '../types';

/** Music seconds of trail (the `trail` knob's default). */
const LIFE = 4;
/** The director casts the melody only while a tune is voiced this much of the time. */
const VOICED = 0.4;

export const widget = defineWidget({
  type: 'melody',
  styles: [
    { name: 'ribbon', doc: 'a smooth glowing band' },
    { name: 'beads', doc: 'one bead per note, bigger for longer notes' },
    { name: 'ink', doc: 'dye poured into a fluid when one is on stage, else dry brush strokes' },
  ],
  knobs: [{ name: 'trail', min: 1, max: 8, value: LIFE, doc: 'music seconds of the phrase left on screen' }],
  follows: 'the predominant melody: pitch, note on/off, duration (precomputed for a scripted song, so it is exact and on time)',
  use: 'whenever a clear tune is present. Higher notes sit higher (further out under a kaleidoscope mirror); the last ~4 s of the phrase stay visible',
  layer: 70,
  crisp: true,
  stream: (s) => (fin(s.melodyVoiced) > VOICED ? 1 : 0),
  create: (): StageElement => new Melody(),
});
/** Head position across the region. */
const HEAD = 0.8;
/** Under a kaleidoscope: the ring's radius (in screen heights) for the lowest and the highest pitch. */
const RING: [number, number] = [0.1, 0.45];
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

/** Where the thread is drawn: (age in music seconds, 0 = the note sounding now; pitch height 0..1) → stage x, y. */
export type MelodyPlace = (age: number, height: number) => [number, number];

/** A region's extent on a mirrored axis, fitted into the kept [0, 0.5]: its part there, or (too little there) all of it squeezed in. */
const fit = (lo: number, hi: number): [number, number] =>
  Math.min(hi, 0.5) - lo >= 0.25 ? [lo, Math.min(hi, 0.5)] : [lo / 2, hi / 2];

/**
 * The thread's layout. The post pass's mirror shows only part of the frame, reflected
 * (2: the left half, 4: the bottom-left quarter, 6 and up: a wedge above the centre), so
 * the thread is laid out inside that part, or the note sounding now is never on screen:
 *   1     the region, the head at HEAD across it, the past scrolling left;
 *   2, 4  the region fitted into the kept half / quarter, the head on the vertical seam:
 *         one head on the centre line, the past flowing out both ways (under 4 the
 *         highest notes meet in the middle);
 *   6+    round the centre, whatever the region: pitch is the radius, and time runs round
 *         the wedge from its upright edge, so the reflections close the thread into a ring
 *         with a head on each of `mirror` spokes, one straight above the centre.
 */
export function melodyLayout(region: Region, mirror: number, aspect: number, life = LIFE): MelodyPlace {
  if (mirror > 4) {
    /** The kept wedge: half of one 2π / mirror segment. */
    const sweep = Math.PI / mirror;
    return (age, h) => {
      const a = Math.PI / 2 - (age / life) * sweep;
      const r = RING[0] + (RING[1] - RING[0]) * h;
      return [0.5 + (r * Math.cos(a)) / aspect, 0.5 + r * Math.sin(a)];
    };
  }
  let [x0, y0, x1, y1] = regionRect(region);
  let head = HEAD;
  if (mirror === 2 || mirror === 4) {
    [x0, x1] = fit(x0, x1);
    head = 1;
  }
  if (mirror === 4) [y0, y1] = fit(y0, y1);
  const hx = x0 + (x1 - x0) * head;
  return (age, h) => [hx - (age / life) * (hx - x0), y0 + (y1 - y0) * (0.06 + 0.88 * h)];
}

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

  private update(fr: StageFrame, life: number) {
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
      while (this.pts.length && now - this.pts[0].t > life) this.pts.shift();
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
      while (this.beads.length && now - this.beads[0].t1 > life) this.beads.shift();
    }
  }

  draw(fr: StageFrame, member: CastMember) {
    const life = widget.knob(fr, member, 'trail');
    this.update(fr, life);
    const s = this.shared;
    const prm = member.spec.params;
    const style = widget.style(member);
    const gain = member.presence * prm.intensity;
    if (gain < 0.002) return;
    const now = fr.clock.time;
    // The mirror the post pass applies this frame (pins included), so the head is never folded away.
    const place = melodyLayout(prm.region, fr.directives.look.mirror, s.aspect, life);
    /** Where a point of the tune, drawn at music time t with pitch p, is now. */
    const at = (t: number, p: number) => place(now - t, pitchHeight(p));
    const k = sizeK(prm.size);
    const fade = (t: number) => Math.pow(clamp01(1 - (now - t) / life), 1.3);
    const colorAt = (p: number, bright: number) => scale(vivid(elementColor(prm.color, s, 0.55 + 0.45 * pitchHeight(p), p)), bright);

    if (style === 'beads') {
      // A faint thread through the notes keeps the contour readable between beads.
      this.thread(at, fade, colorAt, gain * 0.35, 0.0018 * k);
      for (const b of this.beads) {
        const dur = Math.max(0, b.t1 - b.t0);
        const r = (0.012 + 0.032 * Math.sqrt(Math.min(2.5, dur))) * k * (0.6 + 0.4 * s.react) * (0.7 + 0.5 * b.s);
        const a = fade(b.t1) * gain * (0.6 + 0.8 * b.s);
        const [x, y] = at(b.t0, b.p);
        s.sprites.add(x, y, r, r, 0, colorAt(b.p, a * 1.6), Shape.Bead);
        s.sprites.add(x, y, r * 2.4, r * 2.4, 0, colorAt(b.p, a * 0.25), Shape.Glow);
      }
      s.sprites.flush();
      return;
    }

    if (style === 'ink' && s.fluid) {
      // Ink feeds the fluid at the head (SoundEvent: pan/height in the fluid's emitter space).
      const mel = fr.melody;
      if (mel.voiced && Number.isFinite(mel.pitch)) {
        const [x, y] = at(now, mel.pitch);
        const c = colorAt(mel.pitch, 1);
        const ev: SoundEvent = {
          height: clamp01((y - 0.07) / 0.84), pan: Math.max(-1, Math.min(1, (x - 0.5) / 0.38)),
          strength: clamp01(fin(mel.salience) * gain * 1.3), note: ((Math.round(mel.pitch) % 12) + 12) % 12,
          color: c, onset: mel.noteOn,
        };
        s.ink.push(ev);
      }
      // A thin bright line still shows exactly where the tune is.
      this.thread(at, fade, colorAt, gain * 0.5, 0.0015 * k);
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
      const [x, y] = at(p.t, p.p);
      run.push({ x, y, w, c: colorAt(p.p, bright), core: ink ? 0 : 1.2 });
    }
    flushRun();
    s.strokes.flush(ink ? Brush.Ink : Brush.Glow);
    // The head: where the tune is now.
    const last = this.pts[this.pts.length - 1];
    if (!ink && last && Number.isFinite(last.p)) {
      const r = (0.01 + 0.03 * last.s) * k;
      const [x, y] = at(last.t, last.p);
      s.sprites.add(x, y, r, r, 0, colorAt(last.p, gain * (0.8 + 1.5 * last.s)), Shape.Glow, 0.3);
      s.sprites.flush();
    }
  }

  /** A thin line through the recent contour. */
  private thread(
    at: (t: number, p: number) => [number, number], fade: (t: number) => number,
    colorAt: (p: number, b: number) => [number, number, number], gain: number, w: number,
  ) {
    let run: StrokePoint[] = [];
    for (const p of this.pts) {
      if (!Number.isFinite(p.p)) {
        if (run.length >= 2) this.shared.strokes.add(run);
        run = [];
        continue;
      }
      const [x, y] = at(p.t, p.p);
      run.push({ x, y, w, c: colorAt(p.p, gain * fade(p.t)), core: 1 });
    }
    if (run.length >= 2) this.shared.strokes.add(run);
    this.shared.strokes.flush();
  }

  dispose() {
    this.pts = [];
    this.beads = [];
  }
}
