/**
 * The large-scale shape of a piece: where the music turns into something else.
 *
 *   rows binned to 2 Hz → z-normalised per dimension → cosine self-similarity →
 *   Foote checkerboard novelty (8 s, Gaussian-tapered) → peaks
 */
import type { Section, StructureRow } from './types';

export type { Section, StructureRow };

/** Structure works on 2 Hz rows: fast enough to place a boundary, slow enough to ignore single chords. */
const ROW_BIN = 0.5;
/** Kernel half-width, rows: 4 s each side of a candidate boundary (an 8 s kernel). */
const HALF = 8;
/**
 * Gaussian taper (sd, rows): rows near the boundary count most. A gentle one (the
 * kernel edge still weighs 0.64): a narrow taper averages fewer rows, and on
 * steady noise its peaks came close to the weakest real section changes.
 */
const TAPER = HALF;
/**
 * Per-dimension sd floor (values are 0..1): a dimension that barely moves stays
 * small after z-normalisation instead of being blown up to unit variance.
 */
const SD_FLOOR = 0.05;
/**
 * Vectors shorter than this (z units) are shrunk rather than normalised, so
 * cosine similarity sees noise as "no direction" rather than a random one.
 */
const NORM_FLOOR = 1;
/** Chroma's 12 dimensions together weigh as much as 2 scalar ones: harmony is one aspect among register, texture, loudness. */
const CHROMA_WEIGHT = Math.sqrt(2 / 12);
/**
 * Offline: a boundary must reach this novelty whatever the piece does (steady music
 * has peaks too). Measured: steady rows with noise peak at ≤ 0.16; the strongest
 * boundary of real pieces (Sugar Plum, Rachmaninoff, Hungarian Dance, waltz) 0.22–0.51.
 */
const NOVELTY_FLOOR = 0.2;
const DIMS = 17;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function rowVector(r: StructureRow, out: Float64Array) {
  for (let i = 0; i < 12; i++) out[i] = r.chroma[i] ?? 0;
  out[12] = r.loudness;
  out[13] = r.register;
  out[14] = r.brightness;
  out[15] = r.onsetRate;
  out[16] = r.sustain;
  return out;
}

/**
 * Averages samples into fixed-width time bins; `onBin(index, mean)` fires as each
 * bin closes. Bins a sparse input skips repeat the last mean, so bin k always
 * covers [k·width, (k+1)·width).
 */
class Binner {
  private sum: Float64Array;
  private mean: Float64Array;
  private n = 0;
  private bin = NaN;

  constructor(private width: number, dims: number) {
    this.sum = new Float64Array(dims);
    this.mean = new Float64Array(dims);
  }

  push(time: number, v: ArrayLike<number>, onBin: (index: number, mean: Float64Array) => void) {
    const b = Math.floor(time / this.width + 1e-9);
    if (Number.isNaN(this.bin)) this.bin = b;
    if (b > this.bin) {
      this.close();
      for (; this.bin < b; this.bin++) onBin(this.bin, this.mean);
    }
    for (let i = 0; i < this.sum.length; i++) this.sum[i] += v[i];
    this.n++;
  }

  /** Closes the open bin (end of input). */
  flush(onBin: (index: number, mean: Float64Array) => void) {
    if (this.n === 0) return;
    this.close();
    onBin(this.bin++, this.mean);
  }

  private close() {
    if (this.n === 0) return;
    for (let i = 0; i < this.sum.length; i++) this.mean[i] = this.sum[i] / this.n;
    this.sum.fill(0);
    this.n = 0;
  }
}

/**
 * z-normalises a row against `mean` / `sd` (floored), weights chroma down and
 * scales to unit length, or shrinks it when it is shorter than NORM_FLOOR.
 */
function direction(x: ArrayLike<number>, mean: ArrayLike<number>, sd: ArrayLike<number>, out: Float64Array) {
  let n2 = 0;
  for (let d = 0; d < DIMS; d++) {
    const z = ((x[d] - mean[d]) / Math.max(sd[d], SD_FLOOR)) * (d < 12 ? CHROMA_WEIGHT : 1);
    out[d] = z;
    n2 += z * z;
  }
  const k = 1 / Math.max(Math.sqrt(n2), NORM_FLOOR);
  for (let d = 0; d < DIMS; d++) out[d] *= k;
  return out;
}

const dot = (a: Float64Array, b: Float64Array) => {
  let s = 0;
  for (let d = 0; d < DIMS; d++) s += a[d] * b[d];
  return s;
};

/**
 * Checkerboard novelty between two runs of rows, 0..1: the mean similarity within
 * each run minus the similarity across them, halved (two runs pointing opposite
 * ways score 1). `wa` / `wb` weight the rows of each run.
 */
function novelty(a: Float64Array[], wa: ArrayLike<number>, b: Float64Array[], wb: ArrayLike<number>) {
  const within = (v: Float64Array[], w: ArrayLike<number>) => {
    let s = 0, ws = 0;
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++) {
        s += w[i] * w[j] * dot(v[i], v[j]);
        ws += w[i] * w[j];
      }
    return ws > 0 ? s / ws : 0;
  };
  let cross = 0, wc = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      cross += wa[i] * wb[j] * dot(a[i], b[j]);
      wc += wa[i] * wb[j];
    }
  return clamp01(((within(a, wa) + within(b, wb)) / 2 - cross / wc) / 2);
}

/** Bins rows (one every `hop` seconds) to 2 Hz. */
function binRows(rows: StructureRow[], hop: number) {
  const out: Float64Array[] = [];
  const bin = new Binner(ROW_BIN, DIMS);
  const v = new Float64Array(DIMS);
  const take = (_: number, m: Float64Array) => out.push(Float64Array.from(m));
  rows.forEach((r, i) => bin.push(i * hop, rowVector(r, v), take));
  bin.flush(take);
  return out;
}

/**
 * Sections of a whole piece from rows sampled every `hop` seconds. Boundaries are
 * novelty peaks above both mean + 1 sd of the piece's novelty and an absolute
 * floor, at least `minSection` apart and from either end; the strongest win.
 */
export function segment(rows: StructureRow[], hop: number, opts: { minSection?: number } = {}): Section[] {
  const minSection = opts.minSection ?? 6;
  const duration = rows.length * hop;
  if (rows.length === 0) return [];
  const x = binRows(rows, hop);
  const n = x.length;
  const none: Section[] = [{ start: 0, end: duration, novelty: 0 }];
  if (n < 2 * HALF + 1) return none;

  const mean = new Float64Array(DIMS), sd = new Float64Array(DIMS);
  for (const r of x) for (let d = 0; d < DIMS; d++) mean[d] += r[d] / n;
  for (const r of x) for (let d = 0; d < DIMS; d++) sd[d] += (r[d] - mean[d]) ** 2 / n;
  for (let d = 0; d < DIMS; d++) sd[d] = Math.sqrt(sd[d]);
  const v = x.map((r) => direction(r, mean, sd, new Float64Array(DIMS)));

  // Taper by distance from the boundary (row centres at 0.5, 1.5, … rows away).
  const wBefore = Array.from({ length: HALF }, (_, i) => Math.exp(-0.5 * ((HALF - i - 0.5) / TAPER) ** 2));
  const wAfter = [...wBefore].reverse();
  // Novelty only where the whole kernel fits: a half-empty kernel invents edges.
  const nov = new Float64Array(n + 1);
  const valid: number[] = [];
  for (let k = HALF; k <= n - HALF; k++) {
    nov[k] = novelty(v.slice(k - HALF, k), wBefore, v.slice(k, k + HALF), wAfter);
    valid.push(k);
  }
  let m = 0, s2 = 0;
  for (const k of valid) m += nov[k] / valid.length;
  for (const k of valid) s2 += (nov[k] - m) ** 2 / valid.length;
  const threshold = Math.max(m + Math.sqrt(s2), NOVELTY_FLOOR);

  const peaks = valid.filter((k) => nov[k] > threshold && nov[k] >= nov[k - 1] && nov[k] >= nov[k + 1]);
  peaks.sort((a, b) => nov[b] - nov[a]);
  const chosen: number[] = [];
  for (const k of peaks) {
    const t = k * ROW_BIN;
    if (t < minSection || duration - t < minSection) continue;
    if (chosen.some((c) => Math.abs(c - k) * ROW_BIN < minSection)) continue;
    chosen.push(k);
  }
  if (chosen.length === 0) return none;
  chosen.sort((a, b) => a - b);
  const starts = [0, ...chosen.map((k) => k * ROW_BIN)];
  return starts.map((start, i) => ({
    start,
    end: i + 1 < starts.length ? starts[i + 1] : duration,
    novelty: i === 0 ? 0 : nov[chosen[i - 1]],
  }));
}
