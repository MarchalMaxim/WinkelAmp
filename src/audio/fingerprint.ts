/**
 * Recording fingerprint: recognises "this exact recording" across encodings,
 * sample rates and gain, so a corpus script can be found for a file the user
 * drops in — and, just as important, NOT found for another performance of the
 * same piece or another song of similar length (those fall back to Live).
 *
 * Haitsma–Kalker sub-fingerprints: every 0.1 s, the energy in 17 log-spaced
 * bands (150–4000 Hz) gives 16 bits, each the sign of how the energy step
 * between two adjacent bands changed since the previous hop. Signs of
 * differences ignore gain and a smooth EQ tilt (a low-pass above 4 kHz is
 * invisible), and are coarse enough to survive lossy coding. Matching is the bit
 * error rate at the best alignment within ±2 s, plus a duration check: a crop or
 * edit of the same recording has the same bits, but beyond 2 % of the duration
 * it must not match, because the script's times would be wrong for it. Smaller
 * trims (within 2 % and ±2 s) do match; `compare().offset` says how far to shift
 * the script's times for them.
 *
 * Runs identically in the browser (decoded AudioBuffer) and in Node (ffmpeg
 * decode); everything is in seconds and Hz, so the sample rate doesn't matter.
 */
import { RealFFT, hannWindow } from './fft';

export interface Fingerprint {
  version: 1;
  /** Seconds of audio after the leading silence. */
  duration: number;
  hop: 0.1;
  /** Base64 of one little-endian uint16 per hop (bit m = band pair m), from the second hop on. */
  bits: string;
}

const HOP = 0.1;
const FFT_SIZE = 2048;
const BANDS = 17;
const F_LO = 150;
const F_HI = 4000;
/** FFT frames averaged per hop, placed at fixed times so every sample rate sees the same instants. */
const FRAMES_PER_HOP = 4;
/** Leading silence ends at the first sample within 50 dB of the peak (relative, so gain can't move it). */
const SILENCE_DB = -50;
/** Alignment search range, in hops (±2 s). */
const MAX_SHIFT = 20;

/**
 * Bin→band weights for one sample rate. Bands are only ~21 % wide (the lowest
 * spans ~1.5 bins), so each bin counts by its fractional overlap with a band:
 * hard assignment would land differently on the 44.1 and 48 kHz grids and flip
 * the low bits between them.
 */
function bandWeights(sampleRate: number) {
  const edges = Array.from({ length: BANDS + 1 }, (_, i) => F_LO * (F_HI / F_LO) ** (i / BANDS));
  const df = sampleRate / FFT_SIZE;
  const bin: number[] = [], band: number[] = [], weight: number[] = [];
  const kMax = Math.min(FFT_SIZE / 2, Math.ceil(F_HI / df) + 1);
  for (let k = Math.max(1, Math.floor(F_LO / df) - 1); k <= kMax; k++) {
    const lo = (k - 0.5) * df, hi = (k + 0.5) * df;
    for (let b = 0; b < BANDS; b++) {
      const overlap = Math.min(hi, edges[b + 1]) - Math.max(lo, edges[b]);
      if (overlap > 0) bin.push(k), band.push(b), weight.push(overlap / df);
    }
  }
  return { bin: Uint16Array.from(bin), band: Uint8Array.from(band), weight: Float64Array.from(weight) };
}

/** Index of the first sample within SILENCE_DB of the peak, or −1 for silence. */
function leadingSilence(mono: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) peak = a;
  }
  if (!(peak > 1e-6)) return -1;
  const thr = peak * 10 ** (SILENCE_DB / 20);
  for (let i = 0; i < mono.length; i++) if (Math.abs(mono[i]) >= thr) return i;
  return -1;
}

export function fingerprint(mono: Float32Array, sampleRate: number): Fingerprint {
  const start = leadingSilence(mono);
  const length = start < 0 ? 0 : mono.length - start;
  const hops = Math.floor(length / (HOP * sampleRate));
  const rows = new Uint16Array(Math.max(0, hops - 1));

  const fft = new RealFFT(FFT_SIZE);
  const win = hannWindow(FFT_SIZE);
  const buf = new Float64Array(FFT_SIZE);
  const re = new Float64Array(FFT_SIZE / 2 + 1);
  const im = new Float64Array(FFT_SIZE / 2 + 1);
  const { bin, band, weight } = bandWeights(sampleRate);
  let prev = new Float64Array(BANDS);
  let cur = new Float64Array(BANDS);

  for (let n = 0; n < hops; n++) {
    cur.fill(0);
    for (let j = 0; j < FRAMES_PER_HOP; j++) {
      // Frame centred at a fixed time inside the hop; samples outside the trimmed audio read as 0.
      const c = start + Math.round((n + (j + 0.5) / FRAMES_PER_HOP) * HOP * sampleRate);
      const off = c - FFT_SIZE / 2;
      for (let i = 0; i < FFT_SIZE; i++) {
        const s = off + i;
        buf[i] = s >= start && s < mono.length ? mono[s] * win[i] : 0;
      }
      fft.forward(buf, re, im);
      for (let w = 0; w < bin.length; w++) {
        const k = bin[w];
        cur[band[w]] += weight[w] * (re[k] * re[k] + im[k] * im[k]);
      }
    }
    if (n > 0) {
      let row = 0;
      for (let m = 0; m < BANDS - 1; m++) {
        if (cur[m] - cur[m + 1] - (prev[m] - prev[m + 1]) > 0) row |= 1 << m;
      }
      rows[n - 1] = row;
    }
    [prev, cur] = [cur, prev];
  }

  return { version: 1, duration: length / sampleRate, hop: HOP, bits: encode(rows) };
}

/**
 * Bit error rate of `b` against `a` at the best alignment within ±2 s.
 * `offset` is what to add to a time in `a` to reach the same moment in `b`
 * (b has 0.7 s more leading audio → +0.7). A shift only counts if at least half
 * the shorter fingerprint (and ≥ 1 s) overlaps, so a sliver at the edge can't
 * win; with nothing comparable the result is chance, ber 0.5.
 */
export function compare(a: Fingerprint, b: Fingerprint): { ber: number; offset: number } {
  if (a.version !== 1 || b.version !== 1) return { ber: 0.5, offset: 0 };
  const ra = decode(a.bits), rb = decode(b.bits);
  const minOverlap = Math.max(10, Math.ceil(Math.min(ra.length, rb.length) / 2));
  let best = { ber: 0.5, offset: 0 };
  let bestBer = Infinity;
  // Nearest shifts first, so a tie keeps the smaller offset.
  for (let d = 0; d <= MAX_SHIFT; d++) {
    for (const k of d === 0 ? [0] : [d, -d]) {
      const i0 = Math.max(0, -k), i1 = Math.min(ra.length, rb.length - k);
      const overlap = i1 - i0;
      if (overlap < minOverlap) continue;
      let errors = 0;
      for (let i = i0; i < i1; i++) errors += popcount16(ra[i] ^ rb[i + k]);
      const ber = errors / (16 * overlap);
      if (ber < bestBer) {
        bestBer = ber;
        best = { ber, offset: Math.round(k * HOP * 1000) / 1000 }; // 1.9, not 1.9000000000000001
      }
    }
  }
  return best;
}

/** Same recording: bits agree (BER < 0.25) at an alignment within 2 s, and durations agree within 2 %. */
export function isMatch(a: Fingerprint, b: Fingerprint): boolean {
  const longer = Math.max(a.duration, b.duration);
  if (!(longer > 0) || Math.abs(a.duration - b.duration) > 0.02 * longer) return false;
  const { ber, offset } = compare(a, b);
  return ber < 0.25 && Math.abs(offset) <= 2;
}

function popcount16(x: number): number {
  x -= (x >> 1) & 0x5555;
  x = (x & 0x3333) + ((x >> 2) & 0x3333);
  x = (x + (x >> 4)) & 0x0f0f;
  return (x + (x >> 8)) & 0x1f;
}

/** Rows → base64 (little-endian uint16), in chunks: fromCharCode on a huge array overflows the stack. */
function encode(rows: Uint16Array): string {
  const bytes = new Uint8Array(rows.length * 2);
  for (let i = 0; i < rows.length; i++) {
    bytes[2 * i] = rows[i] & 0xff;
    bytes[2 * i + 1] = rows[i] >> 8;
  }
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function decode(bits: string): Uint16Array {
  const s = atob(bits);
  const rows = new Uint16Array(s.length >> 1);
  for (let i = 0; i < rows.length; i++) rows[i] = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8);
  return rows;
}
