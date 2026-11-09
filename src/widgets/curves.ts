// The three drives read from precomputed curves, at the song time of the step: loud (the recording's loudness), rel
// (louder than around it) and pace (how busy the notes are). Nothing builds up, so playing, seeking and rendering frame
// by frame agree. lab/layers/lines.js has copies (loudCurve, relCurve, paceAt, energyCurve), the same statements in the
// same order: tests/curves.test.ts proves them bit-identical.
import { LOUD_HI, LOUD_LO, REF_LOUDNESS } from '../audio/descriptors';
import type { Chord, EnergyLanesLike, Features } from './types';

/** The song's loudness lane (pack.loudness): sample i covers [i·hop, (i+1)·hop), values 0..1. */
export interface LoudnessLane { hop: number; values: readonly number[] }

/** loud at song time t, 0..1. Everything about where loud comes from is behind this one function. With the pack's
    zero-lag energy lane (`energy`), its momentary (0.4 s) curve is read as it is (energyCurve, lead 0); without it,
    pack.loudness (`lane`) is read `lead` s ahead (it runs late: automation.js LOUDNESS_LAG.open). Either is read
    between its samples' centres linearly, held at its first and last value past its ends. Then the song's own 5th to
    95th percentile is stretched to 0..1 (clamped), so a quiet piece still moves. No lane (and no energy), an empty or
    flat one, or no lead (no layer code): always 0. */
export function makeLoudAt(lane: LoudnessLane | null | undefined, lead: number | undefined, energy?: EnergyLanes | null): (t: number) => number {
  const e = energyCurve({ energy }, 'momentary');
  if (e && Number.isFinite(lead)) { lane = e; lead = 0; }
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

/** Half the window rel judges a moment against, in seconds. */
export const REL_HALF = 8;

const relCache = new WeakMap<object, number[]>();

/** rel of each sample of a 0..1 lane (src/research/energy.ts relative): 0.5 at the median of the ±REL_HALF s around
    it, 0 and 1 a spread below and above (the window's 10th to 95th percentile, at least 0.16), half and half with its
    place between the whole piece's 10th and 95th percentile. The window's percentiles are taken every 0.1 s and held
    in between. A flat lane: all 0. Worked out once, kept by `key`. */
function relValues(key: object, hop: number, vals: readonly number[]): number[] {
  const hit = relCache.get(key);
  if (hit) return hit;
  const n = vals.length, half = Math.round(REL_HALF / hop), step = Math.max(1, Math.round(0.1 / hop)), u: number[] = [], out: number[] = [];
  for (let i = 0; i < n; i++) u.push(Number.isFinite(vals[i]) ? vals[i] : 0);
  const all = u.slice().sort((a, b) => a - b), gLo = all[Math.floor(0.1 * (n - 1))], gHi = all[Math.floor(0.95 * (n - 1))], flat = !(all[n - 1] > all[0]);
  let med = 0, spread = 1;
  for (let i = 0; i < n; i++) {
    if (flat) { out.push(0); continue; }
    if (i % step === 0) {
      const w = u.slice(Math.max(0, i - half), Math.min(n, i + half + 1)).sort((a, b) => a - b), m = w.length - 1;
      med = w[Math.floor(0.5 * m)];
      spread = Math.max(0.16, w[Math.floor(0.95 * m)] - w[Math.floor(0.1 * m)]);
    }
    const a = 0.5 + (u[i] - med) / spread, b = gHi > gLo ? (u[i] - gLo) / (gHi - gLo) : 0;
    out.push(0.5 * (a > 0 ? (a < 1 ? a : 1) : 0) + 0.5 * (b > 0 ? (b < 1 ? b : 1) : 0));
  }
  relCache.set(key, out);
  return out;
}

/** rel at song time t, 0..1: how much louder than around it the recording is now (relValues), so a quiet passage still
    swells while the real climax still wins. The same lane loud reads, chosen as makeLoudAt does (the energy lane's
    momentary curve as it is, else pack.loudness read `lead` s ahead), and read between its samples' centres the same
    way. Worked out on the first read, once per lane object. No lane (and no energy), an empty one, or no lead: always 0. */
export function makeRelAt(lane: LoudnessLane | null | undefined, lead: number | undefined, energy?: EnergyLanes | null): (t: number) => number {
  const e = energyCurve({ energy }, 'momentary');
  let key: object | null | undefined = lane;
  if (e && Number.isFinite(lead)) { lane = e; lead = 0; key = energy; }
  const hop = lane?.hop, vals = lane?.values;
  if (!vals || !vals.length || !(hop! > 0) || !Number.isFinite(lead)) return () => 0;
  let rel: number[] | null = null, n = 0;
  return (t) => {
    if (!rel) { rel = relValues(key!, hop!, vals); n = rel.length; }   // on the first read: a song that never reads rel pays nothing
    const x = (t + lead!) / hop! - 0.5;
    let v: number;
    if (!(x > 0)) v = rel[0];
    else if (x >= n - 1) v = rel[n - 1];
    else { const i = Math.floor(x); v = rel[i] + (rel[i + 1] - rel[i]) * (x - i); }
    return v > 0 ? (v < 1 ? v : 1) : 0;   // NaN → 0
  };
}

/** A pack's zero-lag energy lane (pack.energy, src/audio/energy.ts): dB, sample i centred on (i + 0.5)·hop. */
export type EnergyLanes = EnergyLanesLike;

/** Below this (dB) a moment of the energy lane is silence and does not count toward the piece's level; the
    descriptor's long-term reference skips the same (descriptors.ts, lufs > −55). */
export const ENERGY_GATE = -55;

const levelCache = new WeakMap<object, number>();

/** The master correction for a pack's energy lane, in dB: half of how far the piece's level sits from REF_LOUDNESS
    (−20), clamped to ±6, as the descriptor's loudness does (descriptors.ts). The level is the mean power of the
    momentary lane over the whole piece, leaving out silence (below ENERGY_GATE) and passages more than 15 dB under the
    first mean: the descriptor's gate, but over the whole recording instead of a running 40 s reference. 0 when
    nothing passes. Kept per lane object. */
export function energyCorrection(e: EnergyLanes): number {
  const hit = levelCache.get(e);
  if (hit !== undefined) return hit;
  const db = e.momentary || [];
  let s = 0, n = 0;
  for (let i = 0; i < db.length; i++) if (db[i] > ENERGY_GATE) { s += Math.pow(10, db[i] / 10); n++; }
  let c = 0;
  if (n > 0) {
    const gate = 10 * Math.log10(s / n) - 15;
    s = 0; n = 0;
    for (let i = 0; i < db.length; i++) if (db[i] > ENERGY_GATE && db[i] > gate) { s += Math.pow(10, db[i] / 10); n++; }
    const level = 10 * Math.log10(s / n), d = (REF_LOUDNESS - level) * 0.5;
    c = d > -6 ? (d < 6 ? d : 6) : -6;
  }
  levelCache.set(e, c);
  return c;
}

/** The stored energy lane as a 0..1 lane like pack.loudness (same hop, same indexing), on the loudness lane's own
    scale: the master correction (energyCorrection, from the momentary lane, so both lanes share it), then the
    dB → 0..1 map (descriptors.ts LOUD_LO..LOUD_HI, clamped). Without the correction loud masters sat at 1 for much of
    the piece and quiet ones never got high. null when the pack has none (or a broken one): the reader falls back to
    pack.loudness. Plain numbers, so the lab's copy (lines.js WA.energyCurve) gives the same bits. */
export function energyCurve(pack: { energy?: EnergyLanes | null } | null | undefined, which: 'momentary' | 'shortTerm' = 'momentary'): { hop: number; values: number[] } | null {
  const e = pack && pack.energy, db = e && e[which];
  if (!e || !db || !db.length || !(e.hop > 0)) return null;
  const c = energyCorrection(e), values: number[] = [];
  for (let i = 0; i < db.length; i++) {
    const u = (db[i] + c - LOUD_LO) / (LOUD_HI - LOUD_LO);
    values.push(u > 0 ? (u < 1 ? u : 1) : 0);   // NaN → 0
  }
  return { hop: e.hop, values };
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

/** loud, pace and rel at song time t, into f (lab/layers/slot.js curveFeatures): read from curves, never built up. pace
    counts all the chords the features' listener is given, whatever an intensity curve lets through: thinning does not
    calm it. No relAt: rel is 0. Set apart from advanceFeatures, whose arithmetic stays as it was. */
export function setCurves(f: Features, chords: readonly Chord[], t: number, loudAt: (t: number) => number, relAt?: (t: number) => number): void {
  f.loud = loudAt(t);
  f.pace = paceAt(chords, t);
  f.rel = relAt ? relAt(t) : 0;
}
