/**
 * Dread squares (the sketch lab's `squares`, v2): low notes land as big, soft-edged,
 * dark-red squares that drop in with weight (16 % too big, settling in 0.1 s), glow
 * for a moment, sink, and fade out in about 1.4 s; the loudest attacks shake them.
 *
 * The sketch read a transcription; the stage hears audio, and an onset event's pitch
 * is the tune's, not the bass's. So on the frame of an attack the squares look at the
 * waveform itself (`bassAttack`): how much of the newest ~16 ms lies below the split
 * (a low-pass at the split's pitch), and how much that low part just rose. A clearly
 * low attack makes a square, a very low one also its octave (the sketch's left-hand
 * octaves), deeper is bigger. Everything lives on music time: silence holds the
 * squares, and the shake, where they are.
 *
 *   blood   the sketch's dark red, whatever the palette
 *   shadow  the palette's shadow and mid instead
 *
 * Sizes and speeds are the sketch's pixels at 720p, in screen heights. Drawn crisp: the
 * squares carry their own fade, so scene trails don't stretch it (melt and cuts pass them by).
 */
import { srgbToLinear } from '../../character/palette';
import type { Rgb } from '../../character/types';
import { clamp01, elementColor, fin, regionRect, Shape, sizeK, vivid } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, StageElement, StageFrame, StageShared } from '../types';

export const widget = defineWidget({
  type: 'squares',
  styles: [
    { name: 'blood', doc: "the sketch's dark red, whatever the palette" },
    { name: 'shadow', doc: "the palette's shadow and mid instead" },
  ],
  knobs: [
    { name: 'scale', min: 0.3, max: 2, value: 1, doc: "how big the squares are (the sketch's size): small tiles … huge slabs" },
    { name: 'life', min: 0.3, max: 4, value: 1.4, doc: 'music seconds a square stays: a blink … lingers' },
    { name: 'blur', min: 0, max: 3, value: 1, doc: 'how soft the edges are: sharp … blurred and glowing' },
    { name: 'split', min: 36, max: 72, value: 50, doc: 'MIDI note below which an attack counts as low: only the deepest bass … up to the middle of the piano' },
    { name: 'shake', min: 0, max: 2, value: 1, drive: '+level', doc: 'how hard the squares jolt when a low note is struck very loud' },
  ],
  follows: 'low notes (attacks whose sound lies below `split`, on the frame they are struck): each lands as a big square that sinks and fades',
  use: 'dread, weight, a tolling bass: funeral bells, low octaves, hammered left hands. Few and heavy; keep it apart from other big shapes. `intensity` → how bright, `size` → how big',
  layer: 15,
  crisp: true,
  stream: (s) => clamp01(fin(s.bass)),
  create: (): StageElement => new Squares(),
});

/** Samples (≈ 16 ms at 48 kHz) of the newest and the oldest part of the waveform compared. */
const WIN = 768;
/** The waveform's sample rate: the app's AudioContext is 48 kHz (44.1 kHz shifts the split by ~1.5 semitones). */
const RATE = 48000;
/** How far the low part may count as having risen (a bass out of silence would be ∞). */
const RISE_MAX = 3;
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/**
 * How much of this frame's attack is a low note, ≥ 0 (0 for silence): the share of the
 * newest samples below the `split` note (a two-pole low-pass there), times how much that
 * low part rose against the oldest samples (at most 3×; 0 when it fell). Calibrated on
 * the user's Prelude and Beethoven 5 against their transcriptions: low attacks mostly
 * score 0.25–1.2, high ones mostly under 0.25 (dense, pedalled climaxes blur the two).
 */
export function bassAttack(wave: ArrayLike<number>, split: number): number {
  const n = wave.length;
  const win = Math.min(WIN, Math.floor(n / 2));
  if (win < 32) return 0;
  const k = 1 - Math.exp((-2 * Math.PI * midiHz(fin(split) || 50)) / RATE);
  let a = 0;
  let b = 0;
  let lowNew = 0;
  let lowOld = 0;
  let full = 0;
  for (let i = 0; i < n; i++) {
    const x = fin(wave[i]);
    a += k * (x - a);
    b += k * (a - b);
    if (i < win) lowOld += b * b;
    if (i >= n - win) {
      lowNew += b * b;
      full += x * x;
    }
  }
  if (!(full > 1e-12)) return 0;
  const rise = Math.sqrt(lowNew / Math.max(lowOld, 1e-12));
  // A low part dying away is a bass already sounding, not a new low note.
  if (!(rise >= 1)) return 0;
  const s = Math.sqrt(lowNew / full) * Math.min(RISE_MAX, rise);
  return Number.isFinite(s) ? s : 0;
}

/** An attack counts as low from this score; from OCTAVE it is deep enough to strike its octave too. */
const LOW = 0.25;
const OCTAVE = 0.35;

export interface NewSquare {
  /** Semitones below the split (the sketch's `lim − m`): deeper is bigger. */
  depth: number;
  /** The sketch's key velocity (its sizes and reds are written in it). */
  v: number;
}

/**
 * The squares an attack makes: none unless it scores LOW (and music time moves and there
 * is an attack of strength `strength` 0..1); the deeper it scores, the further below the
 * split; a very low one also its octave above.
 */
export function lowSquares(score: number, strength: number, musicDt: number): NewSquare[] {
  if (!(musicDt > 0) || !(fin(strength) > 0) || !(fin(score) >= LOW)) return [];
  const v = 55 + 60 * clamp01(strength);
  const depth = 10 + 15 * clamp01((score - LOW) / 0.5);
  const out: NewSquare[] = [{ depth, v }];
  if (score >= OCTAVE && depth - 12 >= 1) out.push({ depth: depth - 12, v });
  return out;
}

/** A square's side in screen heights: the sketch's (110 + 9 px per semitone below the split) at 720p, by velocity, × `scale`. */
export const squareSize = (depth: number, v: number, scale: number) => ((110 + depth * 9) * (0.55 + (0.45 * v) / 110) * scale) / 720;

/** At `age` music seconds: `k` the landing overshoot (1.16 → 1 in 0.1 s), `lit` the strike's glow (1 → 0.35 in 0.3 s), `fade` 1 → 0 over `life`. */
export function squareEnvelope(age: number, life: number): { k: number; lit: number; fade: number } {
  const land = Math.min(1, age / 0.1);
  return {
    k: 1 + (1 - land) * 0.16,
    lit: 0.35 + 0.65 * Math.max(0, 1 - age / 0.3),
    fade: Math.pow(Math.max(0, 1 - age / Math.max(0.05, life)), 1.6),
  };
}

/**
 * How opaque a square drawn at opacity `a` looks in the sketch: its canvas fades 12 % toward
 * black each frame and the square is drawn again over it, so it settles at a / (0.12 + 0.88 a).
 * That keeps a fading square bright for most of its life, then lets it go.
 */
export const held = (a: number) => {
  const x = clamp01(fin(a));
  return x / (0.12 + 0.88 * x);
};

/** The jolt (px at 720p) a strike of velocity `v` gives: only over 95, as in the sketch. */
export const shakeKick = (v: number, knob: number) => (v > 95 ? (v - 90) * 0.9 * Math.max(0, knob) : 0);

/** The jolt dying away on music time (the sketch's 0.86 a frame at 60 fps). */
export const shakeDecay = (shake: number, musicDt: number) => (musicDt > 0 ? shake * Math.pow(0.86, musicDt * 60) : shake);

const MAX = 48;
/** Sinking speed: the sketch's 18 px a second at 720p. */
const SINK = 18 / 720;
/** Below this many px the jolt stops. */
const STILL = 0.3;

interface Sq {
  x: number;
  y: number;
  /** Side, screen heights. */
  s: number;
  age: number;
  v: number;
  rot: number;
  /** Pitch class of the attack's event (for color: 'note'), or NaN. */
  note: number;
}

/**
 * The scene light that shows as linear `y` on screen: the inverse of the final pass's
 * exposure (0.9) and ACES tone map (post.ts), which lift dim colours about 2× in sRGB.
 * The sketch's reds are what the eye should get, so they are undone here (glow still adds).
 */
export function untone(y: number): number {
  const v = Math.min(0.95, Math.max(0, fin(y)));
  const a = 2.51 - 2.43 * v;
  const b = 0.03 - 0.59 * v;
  return (-b + Math.sqrt(b * b + 4 * a * 0.14 * v)) / (2 * a) / 0.9;
}

/** sRGB 0..255 → the scene light that shows as it. */
const shown = (r: number, g: number, b: number): Rgb => [r, g, b].map((c) => untone(srgbToLinear(clamp01(c / 255)))) as Rgb;

export class Squares implements StageElement {
  readonly type = 'squares' as const;
  private shared!: StageShared;
  private sq: Sq[] = [];
  private shake = 0;
  /** This frame's jolt, screen heights (held while music time stands still). */
  private dx = 0;
  private dy = 0;

  init(_gl: WebGL2RenderingContext, shared: StageShared) {
    this.shared = shared;
  }

  draw(fr: StageFrame, member: CastMember) {
    const s = this.shared;
    const r = s.rand;
    const prm = member.spec.params;
    const dm = Math.max(0, fin(fr.musicDt));
    const scale = widget.knob(fr, member, 'scale') * sizeK(prm.size);
    const life = widget.knob(fr, member, 'life');
    const blur = widget.knob(fr, member, 'blur');
    const split = widget.knob(fr, member, 'split');

    // A strike: the frame's strongest onset, if the sound it makes is low.
    if (member.presence > 0.05 && dm > 0) {
      let hit = 0;
      let note = NaN;
      for (const e of fr.events) {
        if (!e.onset || !(fin(e.strength) > hit)) continue;
        hit = fin(e.strength);
        note = e.note >= 0 ? e.note : NaN;
      }
      const made = hit > 0 ? lowSquares(bassAttack(fr.wave, split), hit, dm) : [];
      if (made.length) {
        const [x0, y0, x1, y1] = regionRect(prm.region);
        const asp = s.aspect;
        for (const m of made) {
          const side = squareSize(m.depth, m.v, scale);
          const half = side / 2 / asp;
          const xs = x1 - x0 > 2 * half ? x0 + half + (x1 - x0 - 2 * half) * r() : (x0 + x1) / 2;
          // The sketch's 0.3–0.8 of the height from the top.
          this.sq.push({ x: xs, y: y0 + (y1 - y0) * (0.2 + 0.5 * r()), s: side, age: 0, v: m.v, rot: (r() * 2 - 1) * 0.06, note });
          this.shake = Math.max(this.shake, shakeKick(m.v, widget.knob(fr, member, 'shake')));
        }
        if (this.sq.length > MAX) this.sq.splice(0, this.sq.length - MAX);
      }
    }

    if (dm > 0) {
      for (const q of this.sq) {
        q.age += dm;
        q.y -= SINK * dm;
      }
      this.sq = this.sq.filter((q) => q.age < life);
      if (this.shake > STILL) {
        this.dx = ((r() * 2 - 1) * this.shake) / 720;
        this.dy = ((r() * 2 - 1) * this.shake) / 720;
        this.shake = shakeDecay(this.shake, dm);
      } else {
        this.shake = 0;
        this.dx = this.dy = 0;
      }
    }

    const gain = member.presence * clamp01(fin(prm.intensity)) / 0.7;
    if (gain < 0.002 || !this.sq.length) return;
    const blood = widget.style(member) === 'blood' && prm.color === 'mood';
    for (const q of this.sq) {
      const e = squareEnvelope(q.age, life);
      // The sketch draws at 0.92 opacity, every frame, over its fading black: its sRGB values × how
      // opaque that looks (held), then to the light that shows as them.
      const a = Math.min(1, held(e.fade * 0.92) * gain);
      if (a < 0.003) continue;
      let c: Rgb;
      if (blood) {
        c = shown(a * (70 + (90 * e.lit * q.v) / 110), a * (4 + 10 * e.lit), a * (6 + 8 * e.lit));
      } else {
        const base = vivid(elementColor(prm.color, s, 0.15 + 0.35 * e.lit, q.note), 0.3);
        const k = a * (0.45 + (0.55 * e.lit * q.v) / 110);
        c = [base[0] * k * k, base[1] * k * k, base[2] * k * k];
      }
      const side = q.s * e.k;
      // The sketch's blur(4 + 2.5 % of the side) px (a gaussian σ), as an edge ±1.8 σ wide.
      const soft = 1.8 * (4 / 720 + side * 0.025) * blur;
      const p = Math.max(0.002, soft / (side / 2));
      const R = (side / 2) * (1 + 3 * p);
      s.sprites.add(q.x + this.dx / s.aspect, q.y + this.dy, R, R, q.rot, c, Shape.Square, p);
    }
    s.sprites.flush();
  }

  dispose() {
    this.sq = [];
    this.shake = 0;
    this.dx = this.dy = 0;
  }
}

