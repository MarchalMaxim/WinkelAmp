/**
 * The large-scale shape of a piece: where the music turns into something else
 * (sections) and where the low end comes back hard (drops). Scene changes hang
 * on these. The target music is classical, so sections are the primary signal
 * and drops the secondary one.
 *
 *   sections: rows binned to 2 Hz → z-normalised per dimension → cosine
 *   self-similarity → Foote checkerboard novelty (8 s, Gaussian-tapered) → peaks
 *   drops:    bass binned to 20 Hz → 0.5 s level against the 6 s / 2 s before it
 *
 * `segment` / `findDrops` see the whole piece (study packs); `ChangeDetector`
 * runs the same pieces live, looking back only.
 */
import type { Drop, Section, StructureRow } from './types';

export type { Drop, Section, StructureRow };

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
/**
 * Live: a section event needs novelty above mean + 1 sd of the recent novelty (as
 * offline, but running) and above this floor.
 */
const LIVE_FLOOR = 0.25;
/** Live: no section events until the novelty level has been watched this long (rows). */
const LIVE_WARMUP = 16;
/** Live windows, rows: the last 3 s against the 8 s before them. */
const LIVE_RECENT = 6;
const LIVE_BEFORE = 16;
/** Live: a jump in time bigger than this (seconds; back, or forward) is a seek and resets. */
const SEEK_BACK = 0.25;
const SEEK_FORWARD = 1;
/** Live running statistics (row scale, novelty level): time constant, seconds. */
const LIVE_TAU = 60;

/** Drops: bass binned to 20 Hz. */
const DROP_BIN = 0.05;
const DROP_NOW = 0.5;
const DROP_PRE = 6;
const DROP_PRE_SHORT = 2;
const DROP_MIN = 0.35;
/** Offline: drops closer than this are one drop (the stronger kept). */
const DROP_MERGE = 2;

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

  reset() {
    this.sum.fill(0);
    this.n = 0;
    this.bin = NaN;
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

/**
 * The drop test on 20 Hz bass bins, looking back only: the last 0.5 s against the
 * 6 s before it (at least twice as loud, and ≥ DROP_MIN) and the 2 s before it
 * (at most half as loud: the low end really was away). Needs the full 6 s of
 * history: the first notes of a track are not a drop.
 */
class DropCore {
  private ring: Float64Array;
  private count = 0;
  private now = Math.round(DROP_NOW / DROP_BIN);
  private pre = Math.round(DROP_PRE / DROP_BIN);
  private preShort = Math.round(DROP_PRE_SHORT / DROP_BIN);

  constructor() {
    this.ring = new Float64Array(this.now + this.pre);
  }

  /** Adds one bin; returns the drop strength when the test passes, else 0. */
  update(bass: number) {
    this.ring[this.count++ % this.ring.length] = bass;
    const history = this.count - this.now;
    if (history < this.pre) return 0;
    const at = (back: number) => this.ring[(this.count - 1 - back) % this.ring.length];
    let now = 0, pre = 0, preShort = 0;
    for (let i = 0; i < this.now; i++) now += at(i);
    now /= this.now;
    for (let i = 0; i < this.pre; i++) {
      const b = at(this.now + i);
      pre += b;
      if (i < this.preShort) preShort += b;
    }
    pre /= this.pre;
    preShort /= this.preShort;
    return now >= DROP_MIN && now >= 2 * pre && preShort <= 0.5 * now ? clamp01(now - pre) : 0;
  }

  reset() {
    this.ring.fill(0);
    this.count = 0;
  }
}

/** The 0.5 s "now" window starts this long before the bin that completes it: a drop is dated to where the bass came in. */
const DROP_LEAD = DROP_NOW - DROP_BIN;

/**
 * Bass drops in a whole piece (`bass` sampled every `hop` seconds, 0..1). Each run
 * of passing bins is one drop, placed at its strongest bin; drops closer than
 * DROP_MERGE keep the stronger.
 */
export function findDrops(bass: Float32Array, hop: number): Drop[] {
  const core = new DropCore();
  const bin = new Binner(DROP_BIN, 1);
  const out: Drop[] = [];
  let run: Drop | null = null;
  const close = (r: Drop) => {
    const last = out[out.length - 1];
    if (!last || r.time - last.time >= DROP_MERGE) out.push(r);
    else if (r.strength > last.strength) out[out.length - 1] = r;
  };
  const take = (k: number, m: Float64Array) => {
    const s = core.update(m[0]);
    if (s > 0) {
      if (!run || s > run.strength) run = { time: k * DROP_BIN - DROP_LEAD, strength: s };
    } else if (run) {
      close(run);
      run = null;
    }
  };
  const one = new Float64Array(1);
  bass.forEach((b, i) => {
    one[0] = b;
    bin.push(i * hop, one, take);
  });
  bin.flush(take);
  if (run) close(run);
  return out;
}

/**
 * Live structure events for the director: `section` when the last 3 s differ
 * enough from the 8 s before them, `drop` when the bass comes back hard (it
 * pre-empts a section due at the same moment). At most one event per `minGap`,
 * so busy music does not flicker. Call every frame; a jump in time (a seek) resets.
 *
 * `time` is the playback position (it keeps running through rests and silence),
 * not MusicClock.time: a clock that freezes in a break would squeeze the break
 * out of the windows and hide the drop that ends it. Do not call it while paused.
 */
export class ChangeDetector {
  private minGap: number;
  private rowBin = new Binner(ROW_BIN, DIMS);
  private bassBin = new Binner(DROP_BIN, 1);
  private drops = new DropCore();
  private wasDropping = false;
  private dropDue = 0;
  private sectionDue = 0;
  private rows: Float64Array[] = [];
  private mean = new Float64Array(DIMS);
  private var = new Float64Array(DIMS);
  private stats = 0;
  private novMean = 0;
  private novVar = 0;
  private novCount = 0;
  private lastTime = -Infinity;
  private lastEvent = -Infinity;
  private v = new Float64Array(DIMS);
  private one = new Float64Array(1);

  constructor(opts: { minGap?: number } = {}) {
    this.minGap = opts.minGap ?? 15;
  }

  update(row: StructureRow, bass: number, time: number): { kind: 'section' | 'drop'; strength: number } | null {
    if (time < this.lastTime - SEEK_BACK || time > this.lastTime + SEEK_FORWARD) this.reset();
    this.lastTime = time;
    this.one[0] = bass;
    this.bassBin.push(time, this.one, (_, m) => this.onBass(m[0]));
    this.rowBin.push(time, rowVector(row, this.v), (_, m) => this.onRow(m));

    let event: { kind: 'section' | 'drop'; strength: number } | null = null;
    if (this.dropDue > 0) event = { kind: 'drop', strength: this.dropDue };
    else if (this.sectionDue > 0) event = { kind: 'section', strength: this.sectionDue };
    this.dropDue = this.sectionDue = 0;
    if (!event || time - this.lastEvent < this.minGap) return null;
    this.lastEvent = time;
    return event;
  }

  private onBass(b: number) {
    const s = this.drops.update(b);
    if (s > 0 && !this.wasDropping) this.dropDue = s;
    this.wasDropping = s > 0;
  }

  private onRow(m: Float64Array) {
    // Running mean / variance (for the per-dimension scale); the first row seeds them.
    const a = this.stats++ === 0 ? 1 : 1 - Math.exp(-ROW_BIN / LIVE_TAU);
    for (let d = 0; d < DIMS; d++) {
      const dx = m[d] - this.mean[d];
      this.mean[d] += a * dx;
      this.var[d] = (1 - a) * (this.var[d] + a * dx * dx);
    }
    this.rows.push(Float64Array.from(m));
    const size = LIVE_RECENT + LIVE_BEFORE;
    if (this.rows.length > size) this.rows.shift();
    if (this.rows.length < size) return;
    // Centre on the window itself (a running mean sits near whatever played longest,
    // which leaves those rows directionless); scale by the running sd.
    const centre = new Float64Array(DIMS);
    for (const r of this.rows) for (let d = 0; d < DIMS; d++) centre[d] += r[d] / size;
    const sd = this.var.map(Math.sqrt);
    const v = this.rows.map((r) => direction(r, centre, sd, new Float64Array(DIMS)));
    const before = v.slice(0, LIVE_BEFORE), recent = v.slice(LIVE_BEFORE);
    const nv = novelty(before, new Array(LIVE_BEFORE).fill(1), recent, new Array(LIVE_RECENT).fill(1));
    if (this.novCount >= LIVE_WARMUP && nv >= Math.max(LIVE_FLOOR, this.novMean + Math.sqrt(this.novVar))) this.sectionDue = nv;
    const b = this.novCount++ === 0 ? 1 : 1 - Math.exp(-ROW_BIN / LIVE_TAU);
    const dn = nv - this.novMean;
    this.novMean += b * dn;
    this.novVar = (1 - b) * (this.novVar + b * dn * dn);
  }

  reset() {
    this.rowBin.reset();
    this.bassBin.reset();
    this.drops.reset();
    this.wasDropping = false;
    this.dropDue = this.sectionDue = 0;
    this.rows = [];
    this.mean.fill(0);
    this.var.fill(0);
    this.stats = 0;
    this.novMean = this.novVar = this.novCount = 0;
    this.lastTime = -Infinity;
    this.lastEvent = -Infinity;
  }
}
