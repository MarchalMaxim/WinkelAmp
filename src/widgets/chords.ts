// The lab's note bookkeeping (lab/index.html): chord grouping, the binary search, the notes sounding now.
import type { Chord, Note, SoundingNote } from './types';

/** Notes whose onsets fall within 40 ms of a chord's FIRST note are one attack; notes are taken in the given order. */
export function groupChords(notes: readonly Note[]): Chord[] {
  const out: Chord[] = [];
  for (const [s, e, m, v] of notes) {
    const last = out[out.length - 1];
    if (last && s - last.t < 0.04) {
      last.notes.push({ m, v, d: e - s }); last.vel = Math.max(last.vel, v); last.lo = Math.min(last.lo, m); last.hi = Math.max(last.hi, m);
    } else out.push({ t: s, notes: [{ m, v, d: e - s }], vel: v, lo: m, hi: m });
  }
  return out;
}

/** Index of the first note whose start is ≥ t (the lab's lo(t)). */
export function firstAtOrAfter(notes: readonly Note[], t: number): number {
  let a = 0, b = notes.length;
  while (a < b) { const k = (a + b) >> 1; if (notes[k][0] < t) a = k + 1; else b = k; }
  return a;
}

/** Notes sounding at t: started in [t − 8, t] and not yet ended (the lab's ctx.sounding()). */
export function soundingAt(notes: readonly Note[], t: number): SoundingNote[] {
  const out: SoundingNote[] = [];
  for (let i = firstAtOrAfter(notes, t - 8); i < notes.length && notes[i][0] <= t; i++) {
    const [s, e, m, v] = notes[i];
    if (e > t) out.push({ m, v, start: s, end: e });
  }
  return out;
}
