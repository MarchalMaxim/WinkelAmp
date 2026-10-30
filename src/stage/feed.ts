/**
 * SongFeed: the streams the stage's elements follow — the melody, the beat and
 * sound events — for one song, from one of three sources:
 *
 *   live()       the live MelodyTracker on this frame's spectrum, beats from the
 *                engine's onsets (unscripted music, the mic)
 *   fromData()   a corpus recording's precomputed SongData, looked up at song time
 *   fromScore()  a study's own score: exact notes, and onsets straight from it
 *
 * `frame(t)` takes song time (AudioEngine.songTime). Precomputed feeds are seek-safe:
 * a frame reports what newly happened in song time since the last one, (prev, t];
 * a jump of more than 0.25 s either way is a seek, after which only what began
 * within one frame before `t` counts as new — nothing in between is replayed, and
 * a pause (t standing still) or a small step back reports nothing twice.
 *
 * Live mode leaves `events` empty: CharacterEngine.events() already turns onsets
 * into events at the tune's pitch, so a second source would double them.
 */
import type { Features } from '../audio/features';
import { melodyLine, MelodyTracker } from '../audio/melody';
import type { StudyScore } from '../audio/studies';
import { midiHeight } from '../character/character';
import { noteRgb } from '../character/palette';
import type { Descriptors, Rgb, SoundEvent } from '../character/types';
import type { MelodyFrame, MelodyNote, SongData, StageFrame } from './types';

export interface FeedFrame {
  melody: MelodyFrame;
  beat: StageFrame['beat'];
  events: SoundEvent[];
}

/** A jump in song time bigger than this, either way, is a seek. */
const SEEK = 0.25;
/** After a seek, a note, beat or onset is new if it began at most this long before `t` (one frame). */
const JUST = 1 / 60;
/** Live voiced salience is ≥ 0.35 of the running maximum; precomputed melody reports the same range. */
const SALIENCE_FLOOR = 0.35;
/** An onset this close to a beat lends the beat its strength; a beat without one gets BEAT_STRENGTH. */
const BEAT_NEAR = 0.07;
const BEAT_STRENGTH = 0.6;
/** A melody note starting this close to an onset gives the onset its pitch. */
const PITCH_NEAR = 0.05;
/** Score onsets (any voice) this close count as one sound. */
const CLUSTER = 0.03;
/** Score beats: accented onsets (≥ this × the loudest within ±2 s), at least BEAT_GAP apart. */
const ACCENT = 0.6;
const BEAT_GAP = 0.3;
/** Events per frame at most (a stalled frame must not burst). */
const MAX_EVENTS = 4;
const UNPITCHED: Rgb = [0.8, 0.8, 0.8];

const unvoiced = (): MelodyFrame => ({ pitch: NaN, voiced: false, salience: 0, note: null, noteOn: false });
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Timed {
  t: number;
  s: number;
}
interface Onset extends Timed {
  /** MIDI pitch of the sound, NaN when unknown. */
  midi: number;
}

/** Precomputed streams in song seconds; they repeat every `length` (Infinity: once). */
interface Track {
  length: number;
  /** Sorted by start, not overlapping. */
  notes: MelodyNote[];
  /** Index i is the heard pitch at i · hop seconds (null: unvoiced). */
  contour: { hop: number; midi: (number | null)[] } | null;
  beats: Timed[];
  onsets: Onset[];
}

/** Index of the last item with key ≤ x, or −1. */
function lastAtOrBefore<T>(items: T[], x: number, key: (v: T) => number): number {
  let lo = 0, hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(items[mid]) <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/**
 * What a frame newly covers in song time, (from, to]. Keeps a high-water mark, so
 * a pause or a small step back (latency estimates wobble) covers nothing, and
 * stepping forward again does not cover the same time twice.
 */
class Span {
  private hi = NaN;

  advance(t: number): { from: number; to: number; seek: boolean } {
    if (!Number.isFinite(this.hi) || Math.abs(t - this.hi) > SEEK) {
      this.hi = t;
      return { from: t - JUST, to: t, seek: true };
    }
    if (t <= this.hi) return { from: t, to: t, seek: false };
    const from = this.hi;
    this.hi = t;
    return { from, to: t, seek: false };
  }

  reset() {
    this.hi = NaN;
  }
}

export class SongFeed {
  private span = new Span();
  private tracker: MelodyTracker | null = null;
  private last: MelodyFrame = unvoiced();
  private lastHit = -Infinity;

  private constructor(
    private readonly track: Track | null,
    private readonly sampleRate = 48000,
  ) {
    if (!track) this.tracker = new MelodyTracker();
  }

  /**
   * Unscripted music: the live MelodyTracker on the analysis spectrum (`mags` of a
   * (fftSize/2 + 1)-bin FFT at `sampleRate`, the engine's AudioContext rate), beats
   * from the engine's onsets.
   */
  static live(sampleRate = 48000): SongFeed {
    return new SongFeed(null, sampleRate);
  }

  /** A corpus recording's precomputed analysis. */
  static fromData(d: SongData): SongFeed {
    const notes = [...d.melody.notes].sort((a, b) => a.start - b.start);
    const pitchAt = (t: number) => {
      const i = lastAtOrBefore(notes, t + PITCH_NEAR, (n) => n.start);
      return i >= 0 && t - notes[i].start <= PITCH_NEAR ? notes[i].midi : NaN;
    };
    const onsets = [...d.onsets].sort((a, b) => a.t - b.t).map((o) => ({ t: o.t, s: o.s, midi: pitchAt(o.t) }));
    return new SongFeed({ length: Infinity, notes, contour: d.melody.contour.midi.length ? d.melody.contour : null, beats: beatStrengths(d.beats, onsets), onsets });
  }

  /**
   * A study's score, repeating every `s.length` (live, later loops are re-composed:
   * this follows the first). The melody is `melodyLine` over `melodyVoices` only
   * (`cluster` as Study.melodyCluster); onsets and beats come from every voice.
   */
  static fromScore(s: StudyScore, melodyVoices: string[], cluster = CLUSTER): SongFeed {
    const notes: MelodyNote[] = melodyLine(s.events, melodyVoices, cluster).map((n) => ({
      start: n.start, end: n.end, midi: n.midi, strength: clamp01(n.vel ?? 0.7), confidence: 1,
    }));
    const onsets: Onset[] = [];
    for (const e of s.events) {
      const o = onsets[onsets.length - 1];
      if (o && e.t - o.t <= CLUSTER) {
        o.s = Math.max(o.s, e.vel);
        if (e.m > o.midi) o.midi = e.m;
      } else onsets.push({ t: e.t, s: e.vel, midi: e.m });
    }
    // A score has no beat grid: its accented onsets stand in.
    const beats: number[] = [];
    for (const o of onsets) {
      let loudest = 0;
      for (const p of onsets) if (Math.abs(p.t - o.t) <= 2) loudest = Math.max(loudest, p.s);
      if (o.s >= ACCENT * loudest && !(o.t - beats[beats.length - 1] < BEAT_GAP)) beats.push(o.t);
    }
    return new SongFeed({ length: s.length > 0 ? s.length : Infinity, notes, contour: null, beats: beatStrengths(beats, onsets), onsets });
  }

  /** Forget the play position (a new track on the same feed): the next frame counts as a seek. */
  reset(): void {
    this.span.reset();
    this.tracker?.reset();
    this.last = unvoiced();
    this.lastHit = -Infinity;
  }

  /** This frame's streams at song time `t`. `mags`/`f` are the live analysis; `d` places unpitched events. */
  frame(t: number, mags: Float32Array, f: Features, d: Descriptors): FeedFrame {
    const w = this.span.advance(t);
    return this.track ? this.recorded(this.track, w, d) : this.live(w, mags, f);
  }

  private live(w: { from: number; to: number; seek: boolean }, mags: Float32Array, f: Features): FeedFrame {
    if (w.seek) {
      // The tracker's running maximum and note segmenter assume time moves forward.
      this.tracker!.reset();
      this.lastHit = -Infinity;
    }
    const t = w.to;
    const moved = w.to > w.from;
    const fftSize = (mags.length - 1) * 2;
    if (moved && fftSize >= 2) this.last = this.tracker!.update(mags, this.sampleRate, fftSize, t);
    else this.last = { ...this.last, noteOn: false };
    const period = f.bpm > 0 ? 60 / f.bpm : 0.5;
    const hit = moved && f.onset && t - this.lastHit >= (f.bpm > 0 ? 0.5 * period : 0.2);
    if (hit) this.lastHit = t;
    const phase = Number.isFinite(this.lastHit) ? ((t - this.lastHit) / period) % 1 : 0;
    return { melody: this.last, beat: { phase, hit, strength: hit ? f.onsetStrength : 0 }, events: [] };
  }

  private recorded(tr: Track, w: { from: number; to: number }, d: Descriptors): FeedFrame {
    const t = w.to;
    const L = tr.length;
    // Song time of the current loop's start, and where we are in it.
    const off = Number.isFinite(L) ? Math.max(0, Math.floor(t / L)) * L : 0;
    const local = t - off;
    const isNew = (start: number) => start + off > w.from && start + off <= w.to;

    // Melody: the note sounding now; the contour (if any) gives the exact pitch.
    const i = lastAtOrBefore(tr.notes, local, (n) => n.start);
    const note = i >= 0 && local < tr.notes[i].end ? tr.notes[i] : null;
    const c = tr.contour;
    const cv = c ? c.midi[Math.round(local / c.hop)] : null;
    const pitch = cv != null && Number.isFinite(cv) ? cv : note ? note.midi : NaN;
    const voiced = Number.isFinite(pitch);
    const melody: MelodyFrame = {
      pitch,
      voiced,
      salience: voiced ? SALIENCE_FLOOR + (1 - SALIENCE_FLOOR) * clamp01(note?.strength ?? 0.5) : 0,
      note,
      noteOn: !!note && isNew(note.start),
    };

    // Beat: phase between the beats around now (across the loop seam), hit if one landed in the span.
    const b = tr.beats;
    let phase = 0;
    if (b.length) {
      const j = lastAtOrBefore(b, local, (x) => x.t);
      const loop = Number.isFinite(L);
      const prev = j >= 0 ? b[j].t : loop ? b[b.length - 1].t - L : NaN;
      const next = j + 1 < b.length ? b[j + 1].t : loop ? b[0].t + L : j >= 1 ? 2 * b[j].t - b[j - 1].t : NaN;
      if (Number.isFinite(prev) && next > prev) phase = (((local - prev) / (next - prev)) % 1 + 1) % 1;
    }
    let strength = 0;
    let hit = false;
    each(b, L, w.from, w.to, (x) => {
      hit = true;
      strength = Math.max(strength, x.s);
    });

    // Events: the onsets in the span, at their pitch (or where the music sits, for unpitched ones).
    const found: Onset[] = [];
    each(tr.onsets, L, w.from, w.to, (o) => found.push(o));
    if (found.length > MAX_EVENTS) found.sort((p, q) => q.s - p.s).length = MAX_EVENTS;
    const register = Number.isFinite(d.register) ? clamp01(d.register) : 0.5;
    const events = found.map((o): SoundEvent => {
      const pitched = Number.isFinite(o.midi);
      const height = pitched ? midiHeight(o.midi) : register;
      const pc = pitched ? ((Math.round(o.midi) % 12) + 12) % 12 : -1;
      return {
        height,
        pan: pitched ? (height * 2 - 1) * 0.7 : 0,
        strength: clamp01(0.35 + 0.65 * o.s),
        note: pc,
        color: pc >= 0 ? noteRgb(pc) : UNPITCHED,
        onset: true,
      };
    });
    return { melody, beat: { phase, hit, strength: hit ? strength : 0 }, events };
  }
}

/** Calls `fn` for every item (sorted by t, repeating every L) in (from, to] of song time; nothing before time 0. */
function each<T extends { t: number }>(items: T[], L: number, from: number, to: number, fn: (v: T) => void) {
  if (!items.length || !(to > from)) return;
  const loop = Number.isFinite(L);
  const k0 = loop ? Math.max(0, Math.floor(from / L)) : 0;
  const k1 = loop ? Math.floor(to / L) : 0;
  for (let k = k0; k <= k1; k++) {
    const off = loop ? k * L : 0;
    for (let i = lastAtOrBefore(items, from - off, (v) => v.t) + 1; i < items.length && items[i].t + off <= to; i++) fn(items[i]);
  }
}

/** Beats with a strength: the strongest onset within BEAT_NEAR, else BEAT_STRENGTH. */
function beatStrengths(beats: number[], onsets: Timed[]): Timed[] {
  return [...beats].sort((a, b) => a - b).map((t) => {
    let s = 0;
    for (let i = Math.max(0, lastAtOrBefore(onsets, t - BEAT_NEAR, (o) => o.t)); i < onsets.length && onsets[i].t <= t + BEAT_NEAR; i++) {
      if (Math.abs(onsets[i].t - t) <= BEAT_NEAR) s = Math.max(s, onsets[i].s);
    }
    return { t, s: s || BEAT_STRENGTH };
  });
}
