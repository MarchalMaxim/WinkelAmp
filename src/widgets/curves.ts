// The two drives read from precomputed curves, at the song time of the step: loud (the recording's loudness) and pace
// (how busy the notes are). Nothing builds up, so playing, seeking and rendering frame by frame agree. lab/layers/lines.js
// has copies (loudCurve, paceAt), the same statements in the same order: tests/curves.test.ts proves them bit-identical.
import type { Chord, Features } from './types';

/** The song's loudness lane (pack.loudness): sample i covers [i·hop, (i+1)·hop), values 0..1. */
export interface LoudnessLane { hop: number; values: readonly number[] }

/** loud at song time t, 0..1. Everything about where loud comes from is behind this one function: a lane without the
    lag can replace this one without touching a drive. The lane is read `lead` s ahead (it runs late: automation.js
    LOUDNESS_LAG.open), between its samples' centres linearly, held at its first and last value past its ends. Then the
    song's own 5th to 95th percentile is stretched to 0..1 (clamped), so a quiet piece still moves. No lane, an empty
    or flat one, or no lead: always 0. */
export function makeLoudAt(lane: LoudnessLane | null | undefined, lead: number | undefined): (t: number) => number {
  const hop = lane?.hop, vals = lane?.values;
  if (!vals || !vals.length || !(hop! > 0) || !Number.isFinite(lead)) return () => 0;
  const n = vals.length, sorted = vals.map((v) => (Number.isFinite(v) ? v : 0)).sort((a, b) => a - b);
  const lo = sorted[Math.floor(0.05 * (n - 1))], hi = sorted[Math.floor(0.95 * (n - 1))];
  if (!(hi > lo)) return () => 0;
  return (t) => {
    const x = (t + lead!) / hop! - 0.5;
    let v: number;
    if (!(x > 0)) v = vals[0];
    else if (x >= n - 1) v = vals[n - 1];
    else { const i = Math.floor(x); v = vals[i] + (vals[i + 1] - vals[i]) * (x - i); }
    const u = (v - lo) / (hi - lo);
    return u > 0 ? (u < 1 ? u : 1) : 0;   // NaN → 0
  };
}

/** Half the window pace counts attacks in, in seconds. */
export const PACE_HALF = 2;

interface PaceCurve { times: number[]; top: number }
const paceCache = new WeakMap<readonly Chord[], PaceCurve>();

/** Index of the first time ≥ t in sorted times. */
function firstAt(times: readonly number[], t: number): number {
  let a = 0, b = times.length;
  while (a < b) { const k = (a + b) >> 1; if (times[k] < t) a = k + 1; else b = k; }
  return a;
}

/** Attacks per second in [t − 2, t + 2): centred, as it can look ahead. The window is cut at 0, before which there is
    no song. */
function paceRaw(times: readonly number[], t: number): number {
  const a = t - PACE_HALF, b = t + PACE_HALF, len = b - (a > 0 ? a : 0);
  if (!(len > 0)) return 0;
  return (firstAt(times, b) - firstAt(times, a)) / len;
}

function paceCurve(chords: readonly Chord[]): PaceCurve {
  let c = paceCache.get(chords);
  if (c) return c;
  const times = chords.map((ch) => ch.t).sort((a, b) => a - b);
  const xs: number[] = [];
  if (times.length) for (let i = 0, t0 = times[0], t1 = times[times.length - 1]; t0 + i * 0.1 <= t1 + 1e-9; i++) xs.push(paceRaw(times, t0 + i * 0.1));
  xs.sort((a, b) => a - b);
  c = { times, top: xs.length ? xs[Math.floor(0.95 * (xs.length - 1))] : 0 };
  paceCache.set(chords, c);
  return c;
}

/** pace at song time t, 0..1: the attacks (the chords an instance is given) per second in a centred 4 s window, over
    the 95th percentile of that measure taken every 0.1 s from the first attack to the last, clamped. Worked out once
    per chord list (kept by the list). No chords, or too few to have a busy part: 0. */
export function paceAt(chords: readonly Chord[], t: number): number {
  const c = paceCurve(chords);
  if (!(c.top > 0)) return 0;
  const u = paceRaw(c.times, t) / c.top;
  return u > 0 ? (u < 1 ? u : 1) : 0;
}

/** loud and pace at song time t, into f (lab/layers/slot.js curveFeatures): read from curves, never built up. pace
    counts all the chords the features' listener is given, whatever an intensity curve lets through: thinning does not
    calm it. Set apart from advanceFeatures, whose arithmetic stays as it was. */
export function setCurves(f: Features, chords: readonly Chord[], t: number, loudAt: (t: number) => number): void {
  f.loud = loudAt(t);
  f.pace = paceAt(chords, t);
}
