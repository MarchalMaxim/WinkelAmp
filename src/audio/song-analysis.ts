/**
 * The offline song analysis a song pack needs (sections, beats, loudness, chord
 * changes, onsets, the melody line), shared by the study tool, the ingest CLI and
 * the studio's in-browser fallback (a Worker): no Node imports here.
 * Times are song seconds of the decoded audio (when the sound is heard).
 */
import type { MelodyNote, SongData } from '../stage/types';
import { extractMelody } from './melody';
import { analyzeOffline } from './offline';
import { segment } from './structure';

/**
 * Descriptor onsets (and the onset function behind the beat grid) come out this
 * much after the sound, even dated to the hop before the detector fires: the new
 * attack sits in the Hann window's tapered tail at first. Measured on rendered
 * piano scores (median 38–40 ms) and synthetic tone bursts (25 ms).
 */
export const ONSET_LAG = 0.035;
/** Beats are kept only where the music has a pulse to speak of (descriptor pulseClarity, 0..1). */
export const PULSE_MIN = 0.3;
/** Loudness lane resolution (seconds). */
export const LOUDNESS_HOP = 0.1;

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Values in a loudness lane of this duration: ceil(duration / 0.1), robust to 12 / 0.1 = 119.99…. */
export const loudnessLength = (duration: number) => Math.max(0, Math.ceil(duration / LOUDNESS_HOP - 1e-6));

export interface SongAnalysis {
  duration: number;
  /** Novelty sections, contiguous over [0, duration]. */
  sections: { start: number; end: number; novelty: number }[];
  beats: number[];
  loudness: { hop: 0.1; values: number[] };
  harmony: { t: number; root: number; minor: boolean }[];
  onsets: { t: number; s: number }[];
  melody: MelodyNote[];
}

/**
 * A beat grid over the onset function (Ellis 2007): the tempo from its
 * autocorrelation (preferring ~120 BPM), then dynamic programming for beats that
 * sit on onsets and keep that period. Returns hop indices and the period (hops).
 */
export function trackBeats(odf: Float32Array, fps: number): { beats: number[]; period: number } {
  const n = odf.length;
  // High-pass (minus a 1 s moving mean), rectified, unit sd.
  const env = new Float32Array(n);
  const w = Math.round(fps / 2);
  let acc = 0;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + odf[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w), b = Math.min(n, i + w + 1);
    env[i] = Math.max(0, odf[i] - (pre[b] - pre[a]) / (b - a));
    acc += env[i] * env[i];
  }
  const sd = Math.sqrt(acc / Math.max(1, n)) || 1;
  for (let i = 0; i < n; i++) env[i] /= sd;
  // Tempo: autocorrelation over 40–240 BPM, log-Gaussian weight around 0.5 s.
  let best = 0, period = Math.round(fps / 2);
  for (let lag = Math.round(fps * 0.25); lag <= Math.round(fps * 1.5); lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += env[i] * env[i - lag];
    const wgt = Math.exp(-0.5 * (Math.log2(lag / fps / 0.5) / 1) ** 2);
    if (s * wgt > best) [best, period] = [s * wgt, lag];
  }
  // DP: score[t] = env[t] + max over the previous beat (t − 2P … t − P/2) of score − α·log²(gap / P).
  const ALPHA = 400;
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let m = 0, arg = -1;
    for (let p = t - 2 * period; p <= t - Math.round(period / 2); p++) {
      if (p < 0) continue;
      const v = score[p] - ALPHA * Math.log((t - p) / period) ** 2;
      if (arg < 0 || v > m) [m, arg] = [v, p];
    }
    score[t] = env[t] + (arg >= 0 ? Math.max(0, m) : 0);
    back[t] = arg >= 0 && m > 0 ? arg : -1;
  }
  let t = n - 1;
  for (let i = Math.max(0, n - period); i < n; i++) if (score[i] > score[t]) t = i;
  const beats: number[] = [];
  for (; t >= 0; t = back[t]) beats.push(t);
  return { beats: beats.reverse(), period };
}

/** Major / minor triads against chroma: cosine of the mean-removed vectors. */
const TRIADS = (() => {
  const out: { root: number; minor: boolean; v: Float64Array }[] = [];
  for (let root = 0; root < 12; root++) {
    for (const minor of [false, true]) {
      const v = new Float64Array(12).fill(-0.25);
      for (const k of [0, minor ? 3 : 4, 7]) v[(root + k) % 12] = 0.75;
      out.push({ root, minor, v });
    }
  }
  return out;
})();

/**
 * Chord changes from chroma averaged over 0.5 s, judged every 0.1 s: a new chord
 * must win four judgements running (0.4 s), so passing notes don't count.
 */
export function chordChanges(chroma: Float32Array, quiet: Uint8Array, fps: number, latency: number) {
  const hops = quiet.length;
  const pre = new Float64Array((hops + 1) * 12);
  for (let h = 0; h < hops; h++) for (let k = 0; k < 12; k++) pre[(h + 1) * 12 + k] = pre[h * 12 + k] + chroma[h * 12 + k];
  const step = Math.round(fps / 10), half = Math.round(fps / 4);
  const out: SongData['chords'] = [];
  let cur = -1, cand = -1, run = 0, candT = 0;
  const v = new Float64Array(12);
  for (let h = 0; h < hops; h += step) {
    const a = Math.max(0, h - half), b = Math.min(hops, h + half);
    let mean = 0;
    for (let k = 0; k < 12; k++) mean += (v[k] = (pre[b * 12 + k] - pre[a * 12 + k]) / (b - a)) / 12;
    let bestI = -1, best = 0.5; // a weak match is no chord
    if (!quiet[h]) {
      let n2 = 0;
      for (let k = 0; k < 12; k++) n2 += (v[k] - mean) ** 2;
      for (let i = 0; i < TRIADS.length && n2 > 1e-6; i++) {
        let d = 0;
        for (let k = 0; k < 12; k++) d += (v[k] - mean) * TRIADS[i].v[k];
        const cos = d / Math.sqrt(n2 * 0.75);
        if (cos > best) [best, bestI] = [cos, i];
      }
    }
    if (bestI === cur || bestI < 0) {
      cand = -1;
      run = 0;
      continue;
    }
    if (bestI !== cand) [cand, run, candT] = [bestI, 0, (h + 1) / fps - latency];
    if (++run >= 4) {
      cur = cand;
      const peak = Math.max(1e-9, ...v);
      out.push({ t: r3(Math.max(0, candT)), root: TRIADS[cur].root, minor: TRIADS[cur].minor, chroma: [...v].map((x) => r2(x / peak)) });
      cand = -1;
      run = 0;
    }
  }
  return out;
}

/**
 * What a song pack keeps of the study analysis: one pass of the live chain with the
 * melody tracker (no character engine, no plots), then the same post-processing as
 * `npm run study` for these fields. `onProgress` gets 0..1.
 */
export function analyzeSong(pcm: Float32Array, sampleRate: number, onProgress?: (f: number) => void): SongAnalysis {
  const fps = 60;
  const duration = pcm.length / sampleRate;
  const hops = Math.floor((pcm.length * fps) / sampleRate);
  const chroma = new Float32Array(hops * 12);
  const odf = new Float32Array(hops);
  const res = analyzeOffline(pcm, sampleRate, {
    fps,
    melody: true,
    onProgress: onProgress && ((f) => onProgress(0.85 * f)),
    onHop(h, chain) {
      chroma.set(chain.features.chroma, h * 12);
      odf[h] = chain.descriptorExtractor.debug.odf;
    },
  });
  const D = res.descriptors;
  const at = (t: number) => D[Math.max(0, Math.min(hops - 1, Math.round(t * fps) - 1))];
  const quiet = Uint8Array.from(D, (d) => (d.silence > 0.5 ? 1 : 0));

  const latency = res.melody!.latency;
  const mel = hops > 0 ? extractMelody(res.melody!.salience, fps, { latency }).notes : [];
  res.melody = undefined;
  const melody: MelodyNote[] = mel.map((n) => ({ start: r3(n.start), end: r3(n.end), midi: r2(n.midi), strength: r2(n.strength), confidence: r2(n.confidence) }));
  onProgress?.(0.92);

  // Onsets and beats exactly as study.ts.
  const onsetHops: number[] = [];
  for (let h = 1; h < hops; h++) if (res.onsets[h]) onsetHops.push(h - 1); // it fires a hop late
  const peakOdf = onsetHops.map((h) => odf[h]).sort((a, b) => a - b);
  const odfRef = peakOdf[Math.floor(0.95 * (peakOdf.length - 1))] || 1;
  const onsets = onsetHops
    .map((h) => ({ t: r3(res.times[h] - ONSET_LAG), s: r2(clamp01(Math.sqrt(odf[h] / odfRef))) }))
    .filter((o) => o.t >= 0);
  const beats = hops > 0
    ? trackBeats(odf, fps).beats.map((h) => res.times[h] - ONSET_LAG)
      .filter((t) => t >= 0 && at(t).pulseClarity >= PULSE_MIN && at(t).silence < 0.5).map(r3)
    : [];

  // Sections: segment() ends at hops / fps, up to a hop short of the audio; the pack's run to its very end.
  const rows = D.map((d, h) => ({
    chroma: chroma.subarray(h * 12, h * 12 + 12), loudness: d.loudness, register: d.register,
    brightness: d.brightness, onsetRate: d.onsetRate, sustain: d.sustain,
  }));
  const seg = segment(rows, 1 / fps).map((s) => ({ start: r3(s.start), end: r3(s.end), novelty: r2(s.novelty) }));
  const sections = seg.length ? seg : [{ start: 0, end: duration, novelty: 0 }];
  sections[0].start = 0;
  for (let i = 1; i < sections.length; i++) sections[i - 1].end = sections[i].start;
  sections[sections.length - 1].end = duration;

  const harmony = chordChanges(chroma, quiet, fps, latency).map(({ t, root, minor }) => ({ t, root, minor }));

  // Loudness: the descriptor's mean over each 0.1 s (hop h is heard at (h + 1) / fps); an empty window holds the last value.
  const values: number[] = [];
  let last = 0;
  for (let i = 0, n = loudnessLength(duration); i < n; i++) {
    const h0 = Math.round(i * LOUDNESS_HOP * fps) - 1, h1 = Math.round((i + 1) * LOUDNESS_HOP * fps) - 1;
    let s = 0, c = 0;
    for (let h = Math.max(0, h0); h < Math.min(hops, h1); h++) [s, c] = [s + D[h].loudness, c + 1];
    if (c) last = r3(clamp01(s / c));
    values.push(last);
  }
  onProgress?.(1);
  return { duration, sections, beats, loudness: { hop: LOUDNESS_HOP, values }, harmony, onsets, melody };
}
