/**
 * YourMT3+ rows into pack v2 tracks, the gap-filled all-notes and estimated velocities (spec Decisions 1–2). Pure.
 */
import type { Note, TrackId } from '../../widgets/types';
import { TRACKS, TRACK_IDS, trackOf } from './instruments';
import type { Track } from './pack';
import { stableByStart } from './notes';

/** One YourMT3 note as ymt3.py writes it: song s, MIDI pitch, vel (always 100 or 0), MT3_FULL_PLUS class name. */
export type Ymt3Row = [start: number, end: number, midi: number, vel: number, cls: string];

/** Pooled percentiles of the three solo-piano packs: quantile → velocity (spec Decisions 2). */
export const ANCHORS: readonly (readonly [number, number])[] = [[0.05, 46], [0.5, 69], [0.95, 95]];
/** A YourMT3 note this close (s) to a piano-model note's start adds nothing to all notes. */
export const HYBRID_PAD = 0.15;
/** A piano-model note of the same pitch this close (s) lends its velocity. */
export const BORROW_WINDOW = 0.05;
/** Below this many piano-model notes, the anchors stand in for the song's own velocity distribution. */
export const MIN_PIANO_FOR_QUANTILES = 50;
/** Level of a frame with no sound (dBFS). */
export const SILENT_DB = -120;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
/** Floating error at the edges (1.15 − 1 vs 0.15): a hair, never a musical distance. */
const HAIR = 1e-9;

/** Indexes into `rows` of the rows cleanRows keeps, in its order. */
export function cleanIndexes(rows: readonly Ymt3Row[]): number[] {
  const keep: number[] = [];
  rows.forEach((r, i) => {
    if (!Array.isArray(r) || r[4] === 'Drums' || typeof r[4] !== 'string') return;
    if (!isNum(r[0]) || !isNum(r[1]) || !isNum(r[2]) || !isNum(r[3])) return;
    if (r[3] <= 0 || r[1] <= r[0]) return;
    keep.push(i);
  });
  // Stable by (start, midi): equal keys keep the file's order.
  return keep.sort((a, b) => rows[a][0] - rows[b][0] || rows[a][2] - rows[b][2]);
}

/** Drops Drums, vel ≤ 0 and end ≤ start; stable-sorted by (start, midi). */
export function cleanRows(rows: readonly Ymt3Row[]): Ymt3Row[] {
  return cleanIndexes(rows).map((i) => rows[i]);
}

/** The share of cleanRows labelled Acoustic or Electric Piano; 0 when there are none. */
export function pianoShare(rows: readonly Ymt3Row[]): number {
  const clean = cleanRows(rows);
  if (!clean.length) return 0;
  let n = 0;
  for (const r of clean) if (trackOf(r[4]) === 'piano') n++;
  return n / clean.length;
}

/** Index of the first of `xs` (ascending) ≥ x. */
function lowerBound(xs: readonly number[], x: number): number {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * All notes of an ensemble song: every piano-model note, plus every extra note whose start is more than `pad` s from
 * every piano-model note's start, stable-sorted by start (ties: piano notes first, then extras in their order).
 */
export function hybridNotes(piano: readonly Note[], extra: readonly Note[], pad = HYBRID_PAD): Note[] {
  const starts = piano.map((n) => n[0]).sort((a, b) => a - b);
  const add = extra.filter((n) => {
    const i = lowerBound(starts, n[0]);
    const near = Math.min(i < starts.length ? starts[i] - n[0] : Infinity, i > 0 ? n[0] - starts[i - 1] : Infinity);
    return near > pad + HAIR;
  });
  return stableByStart([...piano, ...add]);
}

/**
 * Each start's level L in dBFS: the highest RMS of the 10 ms frames (non-overlapping, on a grid from sample 0) that
 * start in [start, start + 0.06). Silence and starts past the end give SILENT_DB.
 */
export function onsetLevels(pcm: Float32Array, rate: number, starts: readonly number[]): number[] {
  const size = Math.max(1, Math.round(rate * 0.01)), frames = Math.ceil(pcm.length / size);
  const cache = new Map<number, number>();
  const frameDb = (k: number): number => {
    let db = cache.get(k);
    if (db === undefined) {
      const a = k * size, b = Math.min(pcm.length, a + size);
      let sum = 0;
      for (let i = a; i < b; i++) sum += pcm[i] * pcm[i];
      const rms = b > a ? Math.sqrt(sum / (b - a)) : 0;
      db = rms > 0 ? Math.max(SILENT_DB, 20 * Math.log10(rms)) : SILENT_DB;
      cache.set(k, db);
    }
    return db;
  };
  return starts.map((s) => {
    if (!isNum(s)) return SILENT_DB;
    const k0 = Math.max(0, Math.ceil((s * rate) / size - HAIR)), k1 = Math.min(frames, Math.ceil(((s + 0.06) * rate) / size - HAIR));
    let best = SILENT_DB;
    for (let k = k0; k < k1; k++) best = Math.max(best, frameDb(k));
    return best;
  });
}

/** Mid-rank percentiles: (#below + (#equal − 1)/2)/(n − 1); a single value gives 0.5. */
export function midRank(xs: readonly number[]): number[] {
  const n = xs.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const out = new Array<number>(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && xs[order[j + 1]] === xs[order[i]]) j++;
    const r = (i + (j - i) / 2) / (n - 1);   // #below = i, #equal = j − i + 1
    for (let k = i; k <= j; k++) out[order[k]] = r;
    i = j + 1;
  }
  return out;
}

/** The value at quantile r (0..1, clamped) of an ascending list, linear between order statistics; NaN when empty. */
export function quantileOf(sorted: readonly number[], r: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const pos = Math.min(1, Math.max(0, r)) * (n - 1), i = Math.floor(pos), f = pos - i;
  return i + 1 < n ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i];
}

/** The anchors, piecewise-linear and extrapolated linearly past both ends. */
function fromAnchors(r: number): number {
  const a = ANCHORS;
  let k = 0;
  while (k < a.length - 2 && r > a[k + 1][0]) k++;
  const [r0, v0] = a[k], [r1, v1] = a[k + 1];
  return v0 + ((r - r0) * (v1 - v0)) / (r1 - r0);
}

const toVel = (v: number): number => Math.min(127, Math.max(1, Math.round(v)));

/**
 * Velocities for YourMT3 rows (spec Decisions 2). A piano-model note of the same pitch within ±0.05 s lends its
 * velocity (the nearest; ties: the earlier). Otherwise the row's level, as a mid-rank among all rows' levels, is read off
 * the song's piano-model velocities (≥ 50 notes) or the anchors. `levels` is aligned with `rows`; integers in 1..127.
 */
export function estimateVelocities(rows: readonly Ymt3Row[], levels: readonly number[], piano: readonly Note[]):
  { vel: number[]; borrowed: boolean[] } {
  const byMidi = new Map<number, { t: number; v: number }[]>();
  for (const n of piano) {
    let l = byMidi.get(n[2]);
    if (!l) byMidi.set(n[2], (l = []));
    l.push({ t: n[0], v: n[3] });
  }
  for (const l of byMidi.values()) l.sort((a, b) => a.t - b.t);
  const pianoVels = piano.map((n) => n[3]).sort((a, b) => a - b);
  const useSong = pianoVels.length >= MIN_PIANO_FOR_QUANTILES;
  const ranks = midRank(rows.map((_, i) => (isNum(levels[i]) ? levels[i] : SILENT_DB)));

  const vel: number[] = [], borrowed: boolean[] = [];
  rows.forEach((r, i) => {
    const l = byMidi.get(r[2]);
    let lent: number | null = null;
    if (l) {
      // The first piano note at or after start − window, then walk while it is within the window.
      let lo = 0, hi = l.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (l[mid].t < r[0] - BORROW_WINDOW - HAIR) lo = mid + 1;
        else hi = mid;
      }
      let bestD = Infinity;
      for (let k = lo; k < l.length && l[k].t <= r[0] + BORROW_WINDOW + HAIR; k++) {
        const d = Math.abs(l[k].t - r[0]);
        if (d < bestD) { bestD = d; lent = l[k].v; }   // strict: a tie keeps the earlier
      }
    }
    if (lent !== null) {
      vel.push(toVel(lent));
      borrowed.push(true);
    } else {
      vel.push(toVel(useSong ? quantileOf(pianoVels, ranks[i]) : fromAnchors(ranks[i])));
      borrowed.push(false);
    }
  });
  return { vel, borrowed };
}

/**
 * The tracks of a song from its cleaned rows and their velocities (aligned). A track is written only with at least
 * max(12, 0.5 % of the rows) notes; share is of all rows; keys follow TRACKS' order.
 */
export function buildTracks(rows: readonly Ymt3Row[], vel: readonly number[], borrowed: readonly boolean[]): Partial<Record<TrackId, Track>> {
  const groups = new Map<TrackId, number[]>();
  rows.forEach((r, i) => {
    const id = trackOf(r[4]);
    if (!id) return;
    let g = groups.get(id);
    if (!g) groups.set(id, (g = []));
    g.push(i);
  });
  const min = Math.max(12, 0.005 * rows.length);
  const out: Partial<Record<TrackId, Track>> = {};
  for (const id of TRACK_IDS) {
    const g = groups.get(id);
    if (!g || g.length < min) continue;
    const notes = stableByStart(g.map((i): Note => [rows[i][0], rows[i][1], rows[i][2], vel[i]]));
    const lent = g.reduce((s, i) => s + (borrowed[i] ? 1 : 0), 0);
    out[id] = {
      label: TRACKS[id].label,
      family: TRACKS[id].family,
      notes,
      share: Math.round((g.length / rows.length) * 1e4) / 1e4,
      vel: { borrowed: lent, level: g.length - lent },
    };
  }
  return out;
}
