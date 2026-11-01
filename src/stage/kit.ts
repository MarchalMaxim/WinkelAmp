/**
 * The widget kit: what one stage element (a "widget") declares about itself, its
 * knobs, and the five music features a knob can be driven by. Every widget is one
 * file in elements/ exporting `defineWidget({...})`; elements/index.ts lists them,
 * and the element types, styles, the script validator's knob checks, the director's
 * casting and docs/CAST.md all derive from that list.
 *
 * Knobs work as in the sketch lab (lab/index.html): a knob has a range and a base
 * value, and may be driven by a music feature, up ('+') or down ('-'), by `depth`
 * of its range (0.5 unless set):
 *
 *   value = clamp(base ± depth · (max − min) · (feature − (pitch ? 0.5 : 0)), min, max)
 *
 * The features, each 0..1, smoothed on music time like the lab's `ctx.feat` (they
 * hold still while music time does, so silence still freezes the picture):
 *
 *   level    how loud: the strongest attack, halving in 0.8 s, never below the loudness
 *   rate     attacks per second / 8 (each attack counts, the count halving every 1 s)
 *   pitch    the top note's height (onset events, the voiced melody), C1 0 … C8 1; held when nothing sounds
 *   bass     the bass level (Features.bass)
 *   density  pitch classes sounding at once (chroma bins ≥ 0.5) / 6
 *
 * Pitch, bass and density ease toward their targets with a 0.25 s half-life.
 */
import { midiHeight } from '../character/character';
import type { SoundEvent } from '../character/types';
import type { CastMember, MelodyFrame, StageElement, StageFrame, Streams } from './types';

export const FEATURES = ['level', 'rate', 'pitch', 'bass', 'density'] as const;
export type Feature = (typeof FEATURES)[number];
export type MusicFeat = Record<Feature, number>;

/** Fixed (''), or a feature pushing the knob up ('+') or down ('-'). */
export const DRIVES = ['', ...FEATURES.flatMap((f) => [`+${f}`, `-${f}`] as const)] as const;
export type Drive = '' | `${'+' | '-'}${Feature}`;

/** The features before any music: pitch sits in the middle (no push either way). */
export const NEUTRAL_FEAT: Readonly<MusicFeat> = Object.freeze({ level: 0, rate: 0, pitch: 0.5, bass: 0, density: 0 });

/** How far a drive moves its knob, as a fraction of the knob's range, unless the script says. */
export const DEFAULT_DEPTH = 0.5;

/** One of a widget's own knobs. */
export interface Knob<K extends string = string> {
  /** As a script writes it in `params.knobs` (letters and digits). */
  name: K;
  min: number;
  max: number;
  /** Default base value. */
  value: number;
  /** Default drive ('' or absent: fixed). */
  drive?: Drive;
  /** One line: what it does, in the composer's words. */
  doc: string;
}

/** What a script sets for a knob: a base value, or any of base value, drive and depth. */
export type KnobSetting = number | { value?: number; drive?: Drive; depth?: number };

const fin = (v: number) => (Number.isFinite(v) ? v : 0);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The knob's value now: its base (the script's or the default) moved by its drive. */
export function knobValue(k: Knob, set: KnobSetting | undefined, feat: Readonly<MusicFeat>): number {
  const o = typeof set === 'number' ? { value: set } : (set ?? {});
  let v = o.value ?? k.value;
  const drive = o.drive ?? k.drive ?? '';
  if (drive) {
    const f = drive.slice(1) as Feature;
    const x = fin(feat[f]) - (f === 'pitch' ? 0.5 : 0);
    v += (drive[0] === '+' ? 1 : -1) * (o.depth ?? DEFAULT_DEPTH) * (k.max - k.min) * x;
  }
  return Math.max(k.min, Math.min(k.max, v));
}

/** What the features are computed from (the stage maps a StageFrame onto this). */
export interface FeatureInput {
  events: readonly SoundEvent[];
  melody: MelodyFrame;
  chroma: ArrayLike<number>;
  /** Features.bass, 0..1. */
  bass: number;
  /** Descriptors.loudness, 0..1. */
  loudness: number;
  /** Descriptors.silence, 0..1. */
  silence: number;
}

const LEVEL_HALF = 0.8;
const RATE_HALF = 1;
const RATE_FULL = 8;
const EASE_HALF = 0.25;
const PC_ON = 0.5;
const PC_FULL = 6;

/** The five features, on music time. One per stage (reset with the stage on a new track). */
export class FeatureTracker {
  feat: MusicFeat = { ...NEUTRAL_FEAT };
  /** Attacks per second (an accumulator, each attack worth ln 2 / RATE_HALF). */
  private rate = 0;

  reset(): void {
    this.feat = { ...NEUTRAL_FEAT };
    this.rate = 0;
  }

  /** One frame; with `musicDt` 0 (silence, pause) nothing changes. Returns the features. */
  update(x: FeatureInput, musicDt: number): Readonly<MusicFeat> {
    const dt = fin(musicDt);
    if (!(dt > 0)) return this.feat;
    const f = this.feat;
    let hit = 0;
    let top = -1;
    let attacks = 0;
    for (const e of x.events) {
      if (e.onset) {
        attacks++;
        hit = Math.max(hit, clamp01(fin(e.strength)));
      }
      if (e.note >= 0 && Number.isFinite(e.height)) top = Math.max(top, clamp01(e.height));
    }
    if (x.melody.voiced && Number.isFinite(x.melody.pitch)) top = Math.max(top, midiHeight(x.melody.pitch));

    f.level = Math.max(f.level * Math.pow(0.5, dt / LEVEL_HALF), hit, clamp01(fin(x.loudness)));
    this.rate = this.rate * Math.pow(0.5, dt / RATE_HALF) + (attacks * Math.LN2) / RATE_HALF;
    f.rate = clamp01(this.rate / RATE_FULL);

    const k = 1 - Math.pow(0.5, dt / EASE_HALF);
    if (top >= 0) f.pitch += (top - f.pitch) * k;
    f.bass += (clamp01(fin(x.bass)) - f.bass) * k;
    let n = 0;
    for (let i = 0; i < x.chroma.length; i++) if (fin(x.chroma[i]) >= PC_ON) n++;
    f.density += (clamp01(n / PC_FULL) * (1 - clamp01(fin(x.silence))) - f.density) * k;
    return f;
  }
}

/** A widget's look, named as a script writes it. */
export interface WidgetStyle {
  name: string;
  /** A few words: what it looks like. */
  doc: string;
}

/** What one widget file declares. */
export interface WidgetDef<T extends string = string, K extends string = string> {
  /** The element type a script names. */
  type: T;
  /** Its looks; the first is the default. */
  styles: readonly WidgetStyle[];
  /** Its own knobs (besides the params every element has: intensity, size, region, color, style). */
  knobs: readonly Knob<K>[];
  /** The composer's cast table: what it follows in the music… */
  follows: string;
  /** …and when to use it. */
  use: string;
  /**
   * Draw order (additive, so it matters only for hand-offs: lower draws first). The
   * built-in cast spans 10 (bloom) … 90 (slash); the melody (70) writes ink a fluid (80) reads.
   */
  layer: number;
  /** Carries its own history: drawn sharp, with only a faint echo in the feedback. */
  crisp?: boolean;
  /** The live director's casting: how much of its stream the music has now, 0..1 (default: always 1). */
  stream?: (s: Streams) => number;
  /** A fresh instance (the stage keeps one per cast id). */
  create: () => StageElement;
}

/** A widget as the registry holds it: its declaration plus helpers for its own draw code. */
export interface Widget<T extends string = string, K extends string = string> extends WidgetDef<T, K> {
  /** Style names in order (the first is the default). */
  readonly styleNames: readonly string[];
  /** The member's style, or the default when it names none of ours. */
  style(member: CastMember): string;
  /** The knob's value this frame: the script's setting, moved by its drive and the frame's features. */
  knob(fr: StageFrame, member: CastMember, name: K): number;
}

export function defineWidget<const T extends string, const K extends string = never>(def: WidgetDef<T, K>): Widget<T, K> {
  const styleNames = def.styles.map((s) => s.name);
  const byName = new Map<string, Knob>(def.knobs.map((k) => [k.name, k]));
  return {
    ...def,
    styleNames,
    style: (m) => (styleNames.includes(m.spec.params.style) ? m.spec.params.style : styleNames[0]),
    knob(fr, member, name) {
      const k = byName.get(name);
      if (!k) throw new Error(`${def.type} has no knob "${name}"`);
      return knobValue(k, member.spec.params.knobs?.[name], fr.feat ?? NEUTRAL_FEAT);
    },
  };
}
