/**
 * The predominant melody of polyphonic music — the line a listener would hum —
 * for the melody thread. Target music is piano and orchestra (the tune is often
 * in the strings while the piano arpeggiates), so this is a salience tracker in
 * the spirit of Melodia (Salamon & Gómez 2012), not a "top voice" picker:
 *
 *   spectral peaks (parabolic) → harmonic summation on 10-cent bins → ≤ 5 pitch
 *   candidates per hop → live: greedy continuity; offline: Viterbi over the piece
 *   → voicing → notes (stable pitch, or a re-attack at the same pitch).
 *
 * Input is the analysis chain's smoothed magnitude spectrum (4096-point FFT, one
 * hop per 1/60 s), so live and offline see the very same numbers.
 */
import type { MelodyFrame, MelodyNote } from './types';
import { aWeightSqrt } from './descriptors';

export type { MelodyFrame, MelodyNote };

/** MIDI C2..C7: the range a melody can sit in. */
export const MELODY_RANGE: [number, number] = [36, 96];
/** Salience bins: 10 cents each over MELODY_RANGE, both ends included. */
export const SALIENCE_BINS = (MELODY_RANGE[1] - MELODY_RANGE[0]) * 10 + 1;
/** Salience bin → MIDI. */
export const binMidi = (b: number) => MELODY_RANGE[0] + b / 10;

const HARMONICS = 8;
const HARMONIC_DECAY = 0.8;
/** A partial spreads over ±1 semitone of f0 candidates (cos² window), so slightly mistuned partials still add up. */
const SPREAD = 10;
const MAX_SPEC_PEAKS = 48;
const MAX_CANDIDATES = 5;
/** Highest partial frequency used: above this a melody's partials are weak and cymbals dominate. */
const TOP_HZ = 6000;
/** A spectral peak quieter than this (≈ −86 dBFS sine) is noise, whatever else is going on. */
const PEAK_FLOOR = 1e-5;
/** Absolute salience floor for voicing (≈ a −50 dBFS harmonic tone). */
const SAL_FLOOR = 0.02;
/** Pitch-jump cost, per semitone, against salience normalised to the recent maximum. */
const JUMP_COST = 0.08;
/** Live voicing: the line must reach this fraction of its 4 s running maximum. */
const LIVE_VOICING = 0.35;
/**
 * A pitch needs partials: where one spectral peak makes more than 1 − SUPPORT of a
 * bin's salience (a kick drum's sine, one noise peak and its subharmonics) the bin
 * fades out, linearly to 0 when that peak is all there is.
 */
const SUPPORT = 0.25;
/** Notes: pitch stable within this (semitones) for at least NOTE_MIN seconds. */
const NOTE_TOL = 0.6;
const NOTE_MIN = 0.06;
/** The spectrum's smoothing (0.55 per hop) delays what a hop reports by about one more hop (measured: best alignment at 46 + 15 ms). */
const SMOOTHING_LAG = 0.015;

/**
 * Equal-loudness weighting of each peak before summation (Melodia filters the same
 * way): a bass line is loud in the spectrum, not to the ear, and without it a
 * −6 dB bass outvotes the tune. Half the A-weighting in dB: gentle enough to keep
 * a low melody.
 */
const LOUDNESS = aWeightSqrt;
const midiOfHz = (hz: number) => 69 + 12 * Math.log2(hz / 440);

// ---------------------------------------------------------------------------
// Salience
// ---------------------------------------------------------------------------

const peakFreq = new Float64Array(MAX_SPEC_PEAKS);
const peakMag = new Float64Array(MAX_SPEC_PEAKS);
/** Largest single-peak contribution per salience bin (scratch for SUPPORT). */
let single = new Float32Array(0);

/**
 * Local spectral maxima that stand out from their neighbourhood, parabolically
 * interpolated (on log magnitude), strongest MAX_SPEC_PEAKS kept. Returns the count.
 */
function spectralPeaks(mags: Float32Array, hz: number): number {
  const lo = Math.max(2, Math.floor(55 / hz));
  const hi = Math.min(mags.length - 3, Math.ceil(TOP_HZ / hz));
  let max = 0;
  for (let i = lo; i <= hi; i++) if (mags[i] > max) max = mags[i];
  if (!(max >= PEAK_FLOOR)) return 0;
  const floor = Math.max(PEAK_FLOOR, max * 0.01); // −40 dB below the strongest
  let n = 0;
  let weakest = 0;
  const R = 8;
  for (let i = lo; i <= hi; i++) {
    const v = mags[i];
    if (v < floor || v <= mags[i - 1] || v < mags[i + 1]) continue;
    let sum = 0;
    const a = Math.max(0, i - R), b = Math.min(mags.length - 1, i + R);
    for (let j = a; j <= b; j++) sum += mags[j];
    if (v < (2 * sum) / (b - a + 1)) continue;
    const la = Math.log(mags[i - 1] + 1e-12), lb = Math.log(v + 1e-12), lc = Math.log(mags[i + 1] + 1e-12);
    const den = la - 2 * lb + lc;
    const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (la - lc)) / den)) : 0;
    const f = (i + shift) * hz;
    const m = Math.exp(lb - 0.25 * (la - lc) * shift);
    if (n < MAX_SPEC_PEAKS) {
      peakFreq[n] = f;
      peakMag[n] = m;
      if (n === 0 || m < peakMag[weakest]) weakest = n;
      n++;
    } else if (m > peakMag[weakest]) {
      peakFreq[weakest] = f;
      peakMag[weakest] = m;
      for (let k = 0; k < n; k++) if (peakMag[k] < peakMag[weakest]) weakest = k;
    }
  }
  return n;
}

/**
 * Harmonic-summation salience over MELODY_RANGE in 10-cent bins: every spectral
 * peak votes for the f0s it could be harmonic 1..8 of, with weight 0.8^(h−1) and
 * its magnitude compressed by √ (so one loud partial can't outvote a full harmonic
 * series), peaks weighted for equal loudness. Bins carried by a single peak fade
 * (SUPPORT). Zero in silence, never NaN.
 */
export function salience(mags: Float32Array, sampleRate: number, fftSize: number, out: Float32Array): void {
  out.fill(0);
  const n = spectralPeaks(mags, sampleRate / fftSize);
  const bins = out.length;
  if (single.length !== bins) single = new Float32Array(bins);
  single.fill(0);
  for (let p = 0; p < n; p++) {
    const w = Math.sqrt(peakMag[p] * LOUDNESS(peakFreq[p]));
    const m = midiOfHz(peakFreq[p]);
    let g = w;
    for (let h = 1; h <= HARMONICS; h++, g *= HARMONIC_DECAY) {
      const x = (m - 12 * Math.log2(h) - MELODY_RANGE[0]) * 10;
      if (x > bins - 1 + SPREAD) continue;
      if (x < -SPREAD) break;
      const b0 = Math.max(0, Math.ceil(x - SPREAD)), b1 = Math.min(bins - 1, Math.floor(x + SPREAD));
      for (let b = b0; b <= b1; b++) {
        const c = Math.cos((Math.PI / 2) * ((b - x) / SPREAD));
        const v = g * c * c;
        out[b] += v;
        if (v > single[b]) single[b] = v;
      }
    }
  }
  for (let b = 0; b < bins; b++) {
    const s = out[b];
    if (s > 0) out[b] = s * Math.min(1, (s - single[b]) / (SUPPORT * s));
  }
}

/** A pitch candidate: MIDI (interpolated) and its salience. */
interface Candidate {
  midi: number;
  sal: number;
}

/** The ≤ 5 strongest salience peaks that are at least a quarter of the frame's best, into `out` (strongest first). */
function candidates(sal: Float32Array, out: Candidate[]) {
  out.length = 0;
  let max = 0;
  for (let b = 0; b < sal.length; b++) if (sal[b] > max) max = sal[b];
  if (!(max > 0)) return;
  const min = 0.25 * max;
  for (let b = 1; b < sal.length - 1; b++) {
    const v = sal[b];
    if (v < min || v <= sal[b - 1] || v < sal[b + 1]) continue;
    const den = sal[b - 1] - 2 * v + sal[b + 1];
    const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (sal[b - 1] - sal[b + 1])) / den)) : 0;
    const c = { midi: binMidi(b + shift), sal: v - 0.25 * (sal[b - 1] - sal[b + 1]) * shift };
    if (out.length < MAX_CANDIDATES) out.push(c);
    else if (c.sal > out[out.length - 1].sal) out[out.length - 1] = c;
    else continue;
    out.sort((p, q) => q.sal - p.sal);
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * Turns a voiced pitch track into notes: a note is a pitch held within ±0.6
 * semitone for ≥ 60 ms; a new note also starts when the line is struck again at
 * the same pitch (its salience jumps up from a dip). Shared by live and offline.
 */
class NoteSegmenter {
  /** Finished notes (offline keeps them all; live callers may clear it). */
  readonly notes: MelodyNote[] = [];
  private cur: MelodyNote | null = null;
  private confirmed = false;
  private pitches: number[] = [];
  private sals: number[] = [];
  private recent: number[] = [];
  private gap = 0;
  private lastTime = 0;

  /** One hop at `time` (already latency-corrected); `pitch` NaN when unvoiced; `level` = salience / recent max. */
  push(time: number, pitch: number, level: number, keep: boolean): { note: MelodyNote | null; noteOn: boolean } {
    let noteOn = false;
    if (!Number.isFinite(pitch)) {
      this.recent.length = 0;
      if (this.cur && ++this.gap >= 3) this.close(this.lastTime + 1 / 60, keep);
      return { note: this.confirmed ? this.cur : null, noteOn };
    }
    this.gap = 0;
    const r = this.recent;
    const dip = r.length >= 3 ? Math.min(...r) : Infinity;
    const reattack = this.cur !== null && time - this.cur.start >= 0.1 && level > 1.35 * dip && level > r[r.length - 1];
    r.push(level);
    if (r.length > 4) r.shift();
    if (this.cur && (reattack || Math.abs(pitch - this.center()) > NOTE_TOL)) this.close(time, keep);
    if (!this.cur) {
      this.cur = { start: time, end: time, midi: pitch, strength: 0, confidence: 0 };
      this.confirmed = false;
      this.pitches.length = 0;
      this.sals.length = 0;
    }
    const n = this.cur;
    this.pitches.push(pitch);
    this.sals.push(level);
    n.end = time;
    n.midi = this.center();
    let s = 0;
    for (const v of this.sals) s += v;
    n.strength = Math.min(1, s / this.sals.length);
    n.confidence = Math.min(1, n.strength * Math.min(1, (time - n.start) / 0.15));
    if (!this.confirmed && time - n.start >= NOTE_MIN - 1e-6) {
      this.confirmed = true;
      noteOn = true;
    }
    this.lastTime = time;
    return { note: this.confirmed ? n : null, noteOn };
  }

  /** Ends the current note (if any) at `time`. */
  close(time: number, keep = true) {
    if (this.cur && this.confirmed) {
      this.cur.end = Math.max(this.cur.end, time);
      if (keep) this.notes.push(this.cur);
    }
    this.cur = null;
    this.confirmed = false;
    this.gap = 0;
  }

  reset() {
    this.notes.length = 0;
    this.cur = null;
    this.confirmed = false;
    this.recent.length = 0;
    this.gap = 0;
  }

  /** Median pitch so far (robust to a glide into the note). */
  private center() {
    const p = this.pitches;
    if (!p.length) return NaN;
    const s = [...p].sort((a, b) => a - b);
    return s[s.length >> 1];
  }
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

/**
 * The live melody: one update per analysis hop. Greedy continuity (the candidate
 * maximising salience − 0.08 · |jump in semitones|, both against the 4 s running
 * maximum), voiced when the line is ≥ 0.35 × that maximum and above an absolute
 * floor. Frame pitch and note times are for when the sound was heard: `latency`
 * seconds before the hop's time. A live note is reported (noteOn) once it has held
 * for 60 ms, with its start backdated to when it began; the frame's `note` is the
 * same object while it sounds (its end and pitch keep updating): copy it to keep it.
 */
export class MelodyTracker {
  /** The salience of the last update (SALIENCE_BINS). */
  readonly salience = new Float32Array(SALIENCE_BINS);
  /** Seconds between a sound and the hop that reports it: half the FFT window (its centre) plus SMOOTHING_LAG. */
  latency = 0;
  private cands: Candidate[] = [];
  private prev = NaN;
  private prevTime = -Infinity;
  private maxT: number[] = [];
  private maxV: number[] = [];
  private notes = new NoteSegmenter();

  update(mags: Float32Array, sampleRate: number, fftSize: number, time: number): MelodyFrame {
    this.latency = fftSize / 2 / sampleRate + SMOOTHING_LAG;
    const at = time - this.latency;
    salience(mags, sampleRate, fftSize, this.salience);
    candidates(this.salience, this.cands);
    const norm = this.runningMax(time, this.cands.length ? this.cands[0].sal : 0);
    const continuing = Number.isFinite(this.prev) && at - this.prevTime < 0.3;
    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (const c of this.cands) {
      const score = c.sal / norm - (continuing ? JUMP_COST * Math.abs(c.midi - this.prev) : 0);
      if (score > bestScore) [best, bestScore] = [c, score];
    }
    const voiced = best !== null && best.sal >= SAL_FLOOR && best.sal >= LIVE_VOICING * norm;
    const pitch = voiced ? best!.midi : NaN;
    if (voiced) {
      this.prev = pitch;
      this.prevTime = at;
    }
    const level = best ? Math.min(1, best.sal / norm) : 0;
    const { note, noteOn } = this.notes.push(at, pitch, level, false);
    return { pitch, voiced, salience: voiced ? level : 0, note, noteOn };
  }

  reset() {
    this.prev = NaN;
    this.prevTime = -Infinity;
    this.maxT.length = 0;
    this.maxV.length = 0;
    this.notes.reset();
    this.salience.fill(0);
  }

  /** Max of `v` over the last 4 s (a monotonic deque), never below the voicing floor. */
  private runningMax(time: number, v: number) {
    const T = this.maxT, V = this.maxV;
    while (V.length && V[V.length - 1] <= v) {
      V.pop();
      T.pop();
    }
    T.push(time);
    V.push(v);
    while (T[0] < time - 4) {
      T.shift();
      V.shift();
    }
    return Math.max(V[0], SAL_FLOOR);
  }
}

// ---------------------------------------------------------------------------
// Offline
// ---------------------------------------------------------------------------

export interface ExtractOptions {
  /** Seconds between a sound and the hop that reports it (default: as MelodyTracker for a 4096 window at 44.1 kHz). */
  latency?: number;
}

/**
 * The melody of a whole piece from its salience frames (one per hop, from
 * analyzeOffline's `melody` option): Viterbi over the per-hop candidates (jump
 * cost, octave-error penalty), contours voiced by comparing their mean salience
 * with the piece's (Melodia-style), then the same note segmentation as live.
 * `contour[k]` is the pitch heard at hop k's time ((k + 1) / fps): the analysis
 * latency is already taken out, so the line is on time with the music. `path` is
 * the Viterbi pitch before voicing (NaN only where a hop had no candidate), on
 * the same time line: a pitch guess for every frame, for MIREX-style scoring.
 */
export function extractMelody(
  frames: Float32Array[],
  fps: number,
  opts: ExtractOptions = {},
): { notes: MelodyNote[]; contour: Float32Array; path: Float32Array } {
  const H = frames.length;
  const latency = opts.latency ?? 2048 / 44100 + SMOOTHING_LAG;
  const cands: Candidate[][] = [];
  const top = new Float32Array(H);
  for (let k = 0; k < H; k++) {
    const list: Candidate[] = [];
    candidates(frames[k], list);
    top[k] = list.length ? list[0].sal : 0;
    cands.push(list);
  }
  // Loudness-adaptive normaliser: the strongest frame within ±2 s.
  const norm = slidingMax(top, Math.round(2 * fps));
  for (let k = 0; k < H; k++) norm[k] = Math.max(norm[k], SAL_FLOOR);
  // Gate: above the floor, not negligible against the neighbourhood.
  for (let k = 0; k < H; k++) cands[k] = cands[k].filter((c) => c.sal >= SAL_FLOOR && c.sal >= 0.15 * norm[k]);

  // Viterbi over each run of hops that have candidates.
  const path = new Float32Array(H).fill(NaN);
  const level = new Float32Array(H);
  for (let k = 0; k < H; ) {
    if (!cands[k].length) {
      k++;
      continue;
    }
    let e = k;
    while (e < H && cands[e].length) e++;
    viterbi(cands, norm, k, e, path, level);
    k = e;
  }

  // Contours: runs of the path without a jump; voiced by mean level against the piece's distribution.
  let n = 0, s = 0, s2 = 0;
  for (let k = 0; k < H; k++) {
    if (!Number.isFinite(path[k])) continue;
    n++;
    s += level[k];
    s2 += level[k] * level[k];
  }
  const mu = n ? s / n : 0;
  const sd = n ? Math.sqrt(Math.max(0, s2 / n - mu * mu)) : 0;
  const threshold = Math.max(LIVE_VOICING, mu - 0.5 * sd);
  const voiced = new Float32Array(H).fill(NaN);
  for (let k = 0; k < H; ) {
    if (!Number.isFinite(path[k])) {
      k++;
      continue;
    }
    let e = k + 1;
    while (e < H && Number.isFinite(path[e]) && Math.abs(path[e] - path[e - 1]) <= 1) e++;
    let m = 0;
    for (let j = k; j < e; j++) m += level[j];
    if (m / (e - k) >= threshold) for (let j = k; j < e; j++) voiced[j] = path[j];
    k = e;
  }

  // Notes, on the true (latency-corrected) time line.
  const seg = new NoteSegmenter();
  const t0 = -latency;
  for (let k = 0; k < H; k++) seg.push(t0 + (k + 1) / fps, voiced[k], level[k], true);
  seg.close(t0 + (H + 1) / fps);
  const shift = Math.round(latency * fps);
  const contour = new Float32Array(H).fill(NaN);
  const best = new Float32Array(H).fill(NaN);
  for (let k = 0; k + shift < H; k++) {
    contour[k] = voiced[k + shift];
    best[k] = path[k + shift];
  }
  return { notes: seg.notes, contour, path: best };
}

/** Best path through candidates[k0..k1): maximise Σ level − jump cost − octave penalty. */
function viterbi(cands: Candidate[][], norm: Float32Array, k0: number, k1: number, path: Float32Array, level: Float32Array) {
  const score: Float64Array[] = [];
  const back: Int8Array[] = [];
  for (let k = k0; k < k1; k++) {
    const cur = cands[k];
    const sc = new Float64Array(cur.length);
    const bk = new Int8Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      const emit = cur[i].sal / norm[k];
      if (k === k0) {
        sc[i] = emit;
        continue;
      }
      const prev = cands[k - 1];
      const ps = score[k - 1 - k0];
      let best = -Infinity, arg = 0;
      for (let j = 0; j < prev.length; j++) {
        const v = ps[j] - transition(prev[j].midi, cur[i].midi);
        if (v > best) [best, arg] = [v, j];
      }
      sc[i] = best + emit;
      bk[i] = arg;
    }
    score.push(sc);
    back.push(bk);
  }
  const last = score[score.length - 1];
  let i = 0;
  for (let j = 1; j < last.length; j++) if (last[j] > last[i]) i = j;
  for (let k = k1 - 1; k >= k0; k--) {
    const c = cands[k][i];
    path[k] = c.midi;
    level[k] = Math.min(1, c.sal / norm[k]);
    i = back[k - k0][i];
  }
}

/** Cost of moving between two pitches in one hop: per semitone, plus extra for an (near-)octave leap. */
function transition(a: number, b: number) {
  const d = Math.abs(a - b);
  const octave = Math.abs(d - 12) < 0.5 || Math.abs(d - 24) < 0.5 ? 0.3 : 0;
  return JUMP_COST * d + octave;
}

/** Centered sliding maximum over ±r samples (monotonic deque). */
function slidingMax(x: Float32Array, r: number): Float32Array {
  const out = new Float32Array(x.length);
  const dq: number[] = [];
  let head = 0;
  for (let i = 0, j = 0; i < x.length; i++) {
    for (; j < x.length && j <= i + r; j++) {
      while (dq.length > head && x[dq[dq.length - 1]] <= x[j]) dq.pop();
      dq.push(j);
    }
    while (dq[head] < i - r) head++;
    out[i] = x[dq[head]];
  }
  return out;
}
