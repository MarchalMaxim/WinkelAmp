// Energy lanes, a research demo (docs/research/audio-to-picture.md): what a TouchDesigner-style chain would hand our
// widgets next to what they feel today. Pure arithmetic over arrays; lab/energy.html feeds it a decoded recording.
// Nothing in the app reads this module.
import { advanceFeatures, newFeatures, type Pulse } from '../widgets/features';
import { groupChords } from '../widgets/chords';
import type { Note } from '../widgets/types';

/** Our loudness lane's own dB → 0..1 map (descriptors.ts LOUD_LO / LOUD_HI), so the curves share one scale. */
export const LOUD_LO = -50, LOUD_HI = -12;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Mean square of each `hop`-second block (the power the ear's K-weighting has already shaped, when it has). */
export function blockPower(pcm: Float32Array, sampleRate: number, hop: number): Float32Array {
  const n = Math.max(1, Math.round(hop * sampleRate)), count = Math.floor(pcm.length / n);
  const out = new Float32Array(count);
  for (let b = 0; b < count; b++) {
    let s = 0;
    for (let i = b * n, e = i + n; i < e; i++) s += pcm[i] * pcm[i];
    out[b] = s / n;
  }
  return out;
}

/** dB (LUFS-like: BS.1770's −0.691 offset) of a CENTRED moving mean of power over `window` seconds: no lag, as only an
    offline tool can do. The edges average what there is. */
export function centredDb(power: Float32Array, hop: number, window: number): Float32Array {
  const half = Math.max(0, Math.round(window / hop / 2)), n = power.length;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + power[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half), b = Math.min(n, i + half + 1);
    out[i] = -0.691 + 10 * Math.log10((pre[b] - pre[a]) / (b - a) + 1e-12);
  }
  return out;
}

/** dB → 0..1 on our loudness lane's scale. */
export const unitOfDb = (db: ArrayLike<number>): Float32Array => Float32Array.from(db as ArrayLike<number>, (d) => clamp01((d - LOUD_LO) / (LOUD_HI - LOUD_LO)));

/** The Lag CHOP / MilkDrop *_att follower: climbs with time constant `up`, falls with `down` (seconds). */
export function follow(x: ArrayLike<number>, hop: number, up: number, down: number): Float32Array {
  const ku = 1 - Math.exp(-hop / up), kd = 1 - Math.exp(-hop / down);
  const out = new Float32Array(x.length);
  let y = x.length ? x[0] : 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]; y += (v - y) * (v > y ? ku : kd); out[i] = y; }
  return out;
}

/** What a widget feels today as `level`, sampled every `hop` s: the real advanceFeatures stepped at `hz` over the
    chords of `notes` (the runtime's own arithmetic, so the comparison is exact). Also returns `hit`. */
export function todayLevel(notes: readonly Note[], duration: number, hop: number, hz = 60): { level: Float32Array; hit: Float32Array } {
  const sorted = [...notes].sort((a, b) => a[0] - b[0]);
  const chords = groupChords(sorted);
  const count = Math.floor(duration / hop), level = new Float32Array(count), hit = new Float32Array(count);
  const p: Pulse = { level: 0, rate: 0, hit: 0 }, f = newFeatures(), dt = 1 / hz;
  let c = 0, t = 0, next = 0;
  for (let step = 0; next < count; step++) {
    t = step * dt;
    const fired = [];
    while (c < chords.length && chords[c].t <= t) fired.push(chords[c++]);
    advanceFeatures(p, f, fired, [], dt); // level and hit read only the fired chords; the sounding notes move pitch etc.
    while (next < count && next * hop <= t) { level[next] = f.level; hit[next] = f.hit; next++; }
  }
  return { level, hit };
}

/** Linear resampling of a lane from one hop to another (lane i is the value at i·hop). */
export function resample(x: ArrayLike<number>, from: number, to: number, count: number): Float32Array {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = (i * to) / from, a = Math.min(x.length - 1, Math.floor(u)), b = Math.min(x.length - 1, a + 1), w = u - a;
    out[i] = x.length ? x[a] * (1 - w) + x[b] * w : 0;
  }
  return out;
}

const pearson = (a: ArrayLike<number>, b: ArrayLike<number>, shift: number): number => {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i + shift < b.length && i < a.length; i++) {
    const x = a[i], y = b[i + shift];
    n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  const cov = sab - (sa * sb) / n, va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
};

/** How late `late` runs behind `ref` (seconds, same hop): the shift in 0..maxLag with the best correlation. */
export function bestLag(ref: ArrayLike<number>, late: ArrayLike<number>, hop: number, maxLag: number): { lag: number; r: number } {
  let best = { lag: 0, r: -2 };
  for (let s = 0; s * hop <= maxLag + 1e-9; s++) { const r = pearson(ref, late, s); if (r > best.r) best = { lag: s * hop, r }; }
  return best;
}

export interface Pivot { t: number; v: number }

/** Douglas–Peucker on (t, v), then a looser tolerance until it fits `max` points. */
export function simplify(pts: Pivot[], max: number, tol0 = 0.02): Pivot[] {
  const dp = (tol: number): Pivot[] => {
    if (pts.length <= 2) return pts.slice();
    const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
    const stack: [number, number][] = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      const A = pts[a], B = pts[b];
      let worst = -1, at = -1;
      for (let i = a + 1; i < b; i++) {
        const u = (pts[i].t - A.t) / (B.t - A.t || 1), d = Math.abs(pts[i].v - (A.v + (B.v - A.v) * u));
        if (d > worst) { worst = d; at = i; }
      }
      if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };
  let tol = tol0, out = dp(tol);
  while (out.length > max) { tol *= 1.3; out = dp(tol); }
  return out;
}

export interface FollowOptions { floor?: number; up?: number; down?: number; lead?: number; maxPivots?: number; lo?: number; hi?: number }

/** The "follows the sound" intensity preset (report item 1): the energy inside the span, climbing fast and falling slowly,
    normalised to the span's own 5th–95th percentile, mapped to floor..1, simplified to a few linear pivots. `lead`
    reads the curve that many seconds later (to undo a lane's lag). */
export function followPreset(unit: ArrayLike<number>, hop: number, span: { start: number; end: number }, o: FollowOptions = {}): Pivot[] {
  const floor = o.floor ?? 0.35, lead = o.lead ?? 0, maxPivots = o.maxPivots ?? 48;
  const a = Math.max(0, Math.floor(span.start / hop)), b = Math.min(unit.length, Math.ceil(span.end / hop));
  const raw: number[] = [];
  for (let i = a; i < b; i++) raw.push(unit[Math.min(unit.length - 1, i + Math.round(lead / hop))]);
  if (!raw.length) return [];
  const sm = follow(raw, hop, o.up ?? 0.2, o.down ?? 1.5);
  const sorted = Array.from(sm).sort((x, y) => x - y);
  const lo = o.lo ?? sorted[Math.floor(0.05 * (sorted.length - 1))], hi = o.hi ?? sorted[Math.floor(0.95 * (sorted.length - 1))];
  const pts: Pivot[] = [];
  for (let i = 0; i < sm.length; i++) {
    const v = hi > lo ? clamp01((sm[i] - lo) / (hi - lo)) : 1;
    pts.push({ t: (a + i) * hop, v: floor + (1 - floor) * v });
  }
  return simplify(pts, maxPivots).map((p) => ({ t: Math.round(p.t * 100) / 100, v: Math.round(p.v * 1000) / 1000 }));
}

/** The value of linear pivots at t (held before the first and after the last). */
export function pivotAt(p: readonly Pivot[], t: number): number {
  if (!p.length) return 0;
  if (t <= p[0].t) return p[0].v;
  for (let i = 1; i < p.length; i++) if (t <= p[i].t) { const A = p[i - 1], B = p[i]; return A.v + ((B.v - A.v) * (t - A.t)) / (B.t - A.t || 1); }
  return p[p.length - 1].v;
}

/** The music's own loudest moments, as suggestions (report item 7): peaks of the lane smoothed over ±smooth s, scored by
    height × prominence, at least `gap` s apart. */
export function climaxes(unit: ArrayLike<number>, hop: number, o: { smooth?: number; gap?: number; n?: number } = {}): { t: number; v: number; score: number }[] {
  const half = Math.round((o.smooth ?? 1.5) / hop), n = unit.length, sm = new Float32Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + unit[i];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - half), b = Math.min(n, i + half + 1); sm[i] = (pre[b] - pre[a]) / (b - a); }
  const peaks: { i: number; score: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (!(sm[i] >= sm[i - 1] && sm[i] > sm[i + 1])) continue;
    let l = sm[i], r = sm[i];
    for (let j = i - 1; j >= 0 && sm[j] <= sm[i]; j--) l = Math.min(l, sm[j]);
    for (let j = i + 1; j < n && sm[j] <= sm[i]; j++) r = Math.min(r, sm[j]);
    const prom = sm[i] - Math.max(l, r);
    peaks.push({ i, score: sm[i] * prom });
  }
  peaks.sort((x, y) => y.score - x.score);
  const out: { t: number; v: number; score: number }[] = [], gap = o.gap ?? 20;
  for (const p of peaks) {
    if (out.length >= (o.n ?? 3)) break;
    if (out.some((q) => Math.abs(q.t - p.i * hop) < gap)) continue;
    out.push({ t: p.i * hop, v: sm[p.i], score: p.score });
  }
  return out;
}

/** Loudness judged against its surroundings (MilkDrop's "1.0 is normal for right now", dynaudnorm's centred window):
    0.5 at the median of the ±`local` s around it, 0 and 1 a spread (10th–95th percentile, at least 0.16) below and
    above, blended `blend` with its place in the whole piece, so a steady ff still beats the peaks of a pp passage. */
export function relative(unit: ArrayLike<number>, hop: number, local = 8, blend = 0.5): Float32Array {
  const n = unit.length, half = Math.round(local / hop), out = new Float32Array(n);
  const all = Array.from(unit).sort((a, b) => a - b);
  const gLo = all[Math.floor(0.1 * (n - 1))] ?? 0, gHi = all[Math.floor(0.95 * (n - 1))] ?? 1;
  const step = Math.max(1, Math.round(0.1 / hop)); // percentiles every 0.1 s, held in between
  let med = 0, spread = 1;
  for (let i = 0; i < n; i++) {
    if (i % step === 0) {
      const w = Array.from({ length: Math.min(n, i + half + 1) - Math.max(0, i - half) }, (_, k) => unit[Math.max(0, i - half) + k]).sort((a, b) => a - b);
      med = w[Math.floor(0.5 * (w.length - 1))];
      spread = Math.max(0.16, w[Math.floor(0.95 * (w.length - 1))] - w[Math.floor(0.1 * (w.length - 1))]);
    }
    const loc = clamp01(0.5 + (unit[i] - med) / spread), glob = gHi > gLo ? clamp01((unit[i] - gLo) / (gHi - gLo)) : 0;
    out[i] = blend * loc + (1 - blend) * glob;
  }
  return out;
}
