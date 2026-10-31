/**
 * Notes for a song pack: reading a notes file, approximating notes from the
 * offline analysis when there is no transcriber, and judging how much of the
 * recording a transcription heard.
 */
import type { SongAnalysis } from '../../audio/song-analysis';
import type { Note } from '../../widgets/types';

/** A note start this close to an onset (or to another note) counts as the same attack. */
const MATCH = 0.06;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

function tuple(x: unknown, i: number): Note {
  const v = Array.isArray(x)
    ? x
    : x && typeof x === 'object'
      ? [(x as Record<string, unknown>).start, (x as Record<string, unknown>).end, (x as Record<string, unknown>).midi, (x as Record<string, unknown>).vel]
      : null;
  if (!v || v.length !== 4 || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    throw new Error(`notes file: note ${i} is not [start, end, midi, vel] or {start, end, midi, vel}`);
  }
  return [v[0], v[1], v[2], v[3]] as Note;
}

/**
 * A lab `notes.js` (`window.NOTES=[…];`), a `transcribe.py` JSON (`{notes:[{start,end,midi,vel}]}`),
 * or a JSON array of tuples or of note objects. The file's order is kept.
 */
export function parseNotesFile(text: string): Note[] {
  const src = text.trim();
  let body = src;
  if (/^window\.NOTES\s*=/.test(src)) body = src.slice(src.indexOf('['), src.lastIndexOf(']') + 1);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('notes file: not JSON, a transcribe.py result or a lab notes.js (window.NOTES=[…])');
  }
  const list = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as { notes?: unknown }).notes : undefined;
  if (!Array.isArray(list)) throw new Error('notes file: no notes array found');
  return list.map(tuple);
}

/** Index of the first value ≥ x in sorted `xs`. */
function lowerBound(xs: ArrayLike<number>, x: number): number {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Whether some value of sorted `xs` lies within ±d of x. */
const near = (xs: Float64Array, x: number, d: number) => {
  const i = lowerBound(xs, x - d);
  return i < xs.length && xs[i] <= x + d;
};

const sortedStarts = (notes: readonly Note[]) => Float64Array.from(notes, (n) => n[0]).sort();

/**
 * Notes made up from the analysis when no transcription exists: a top note from
 * the melody line on every onset, a bass on the stronger ones and a middle chord
 * tone on the strongest (from the chord changes), plus melody notes no onset explains.
 */
export function approximateNotes(a: Pick<SongAnalysis, 'onsets' | 'melody' | 'harmony' | 'duration'>): Note[] {
  const out: Note[] = [];
  const mel = [...a.melody].sort((x, y) => x.start - y.start);
  const melStarts = Float64Array.from(mel, (m) => m.start);
  const hT = Float64Array.from(a.harmony, (h) => h.t);
  const onsetT = Float64Array.from(a.onsets, (o) => o.t).sort();
  for (const o of a.onsets) {
    const vel = Math.round(30 + 90 * o.s);
    // The melody note sounding at the onset (or starting just after it).
    const k = lowerBound(melStarts, o.t + 0.05 + 1e-9) - 1;
    for (let j = k; j >= 0 && j > k - 4; j--) {
      const m = mel[j];
      if (m.start - 0.05 <= o.t && o.t < m.end) {
        out.push([o.t, Math.min(m.end, r4(o.t + 2)), Math.round(m.midi), vel]);
        break;
      }
    }
    const hi = lowerBound(hT, o.t + 1e-9) - 1;
    if (hi < 0) continue;
    const h = a.harmony[hi];
    const next = hi + 1 < a.harmony.length ? a.harmony[hi + 1].t : Infinity;
    if (o.s >= 0.35) out.push([o.t, Math.min(next, r4(o.t + 2)), 36 + h.root, Math.round(0.9 * vel)]);
    if (o.s >= 0.6) out.push([o.t, r4(o.t + 1), 60 + ((h.root + (h.minor ? 3 : 4)) % 12), Math.round(0.8 * vel)]);
  }
  for (const m of mel) {
    if (!near(onsetT, m.start, 0.05)) out.push([m.start, m.end, Math.round(m.midi), Math.round(30 + 70 * m.strength)]);
  }
  const kept: Note[] = [];
  for (const n of out) {
    const end = Math.min(n[1], a.duration);
    if (end > n[0]) kept.push([n[0], end, n[2], n[3]]);
  }
  kept.sort((x, y) => x[0] - y[0] || x[2] - y[2]);
  const last = new Map<number, number>(); // midi → last kept start
  return kept.filter((n) => {
    const prev = last.get(n[2]);
    if (prev !== undefined && n[0] - prev < 0.001) return false;
    last.set(n[2], n[0]);
    return true;
  });
}

/** Share of the onsets with s ≥ 0.3 that have a note starting within ±60 ms (1 when there are none). */
export function onsetCoverage(notes: readonly Note[], onsets: readonly { t: number; s: number }[]): number {
  const strong = onsets.filter((o) => o.s >= 0.3);
  if (!strong.length) return 1;
  const starts = sortedStarts(notes);
  return strong.filter((o) => near(starts, o.t, MATCH)).length / strong.length;
}

/** Every gpu note, plus the approximate notes more than 60 ms from all gpu starts; stable by start. */
export function mergeNotes(gpu: readonly Note[], approx: readonly Note[]): Note[] {
  const starts = sortedStarts(gpu);
  const add = approx.filter((a) => !near(starts, a[0], MATCH));
  return stableByStart([...gpu, ...add]);
}

/** Sorted by start; equal starts keep their order (Array.prototype.sort is stable). */
export const stableByStart = (notes: readonly Note[]): Note[] => [...notes].sort((a, b) => a[0] - b[0]);
