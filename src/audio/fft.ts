/**
 * Our own spectrum analysis, so the same numbers come out live (from the PCM
 * tap) and offline (from a decoded file) — AnalyserNode can't run in Node and
 * hides its window and smoothing.
 *
 * RealFFT packs N real samples into an N/2-point complex FFT and untangles the
 * result (the standard "two-for-one" trick), so a 4096-point transform costs a
 * 2048-point complex radix-2 FFT. Everything is preallocated: no garbage per frame.
 */

/** Hann window of length n (periodic form, the right one for spectral analysis). */
export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

export class RealFFT {
  readonly size: number;
  private half: number;
  private rev: Uint32Array;
  /** Twiddles for the N/2 complex FFT. */
  private cosT: Float64Array;
  private sinT: Float64Array;
  /** Twiddles for the real-to-complex post-processing step (k = 0..N/2). */
  private cosP: Float64Array;
  private sinP: Float64Array;
  private re: Float64Array;
  private im: Float64Array;

  constructor(size: number) {
    if (size < 4 || (size & (size - 1)) !== 0) throw new Error(`FFT size must be a power of two ≥ 4, got ${size}`);
    this.size = size;
    const h = (this.half = size / 2);
    this.rev = new Uint32Array(h);
    const bits = Math.log2(h);
    for (let i = 0; i < h; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cosT = new Float64Array(h / 2);
    this.sinT = new Float64Array(h / 2);
    for (let i = 0; i < h / 2; i++) {
      this.cosT[i] = Math.cos((2 * Math.PI * i) / h);
      this.sinT[i] = -Math.sin((2 * Math.PI * i) / h);
    }
    this.cosP = new Float64Array(h + 1);
    this.sinP = new Float64Array(h + 1);
    for (let k = 0; k <= h; k++) {
      this.cosP[k] = Math.cos((2 * Math.PI * k) / size);
      this.sinP[k] = -Math.sin((2 * Math.PI * k) / size);
    }
    this.re = new Float64Array(h);
    this.im = new Float64Array(h);
  }

  /**
   * Forward transform of `input` (length N, real). Writes bins 0..N/2 into
   * outRe/outIm (each of length ≥ N/2 + 1). X[k] = Σ x[n]·e^(−2πikn/N), unnormalized.
   */
  forward(input: ArrayLike<number>, outRe: Float64Array | Float32Array, outIm: Float64Array | Float32Array) {
    const h = this.half;
    const { re, im, rev } = this;
    // Pack even samples as real, odd as imaginary, in bit-reversed order.
    for (let i = 0; i < h; i++) {
      const j = rev[i];
      re[j] = input[2 * i];
      im[j] = input[2 * i + 1];
    }
    // Iterative radix-2 decimation-in-time.
    for (let len = 2; len <= h; len <<= 1) {
      const halfLen = len >> 1;
      const step = h / len;
      for (let start = 0; start < h; start += len) {
        for (let k = 0; k < halfLen; k++) {
          const tw = k * step;
          const wr = this.cosT[tw];
          const wi = this.sinT[tw];
          const a = start + k;
          const b = a + halfLen;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
    // Untangle: X[k] = E[k] + W^k·O[k], with E/O recovered from Z[k] and conj(Z[h−k]).
    for (let k = 0; k <= h; k++) {
      const k1 = k % h;
      const k2 = (h - k) % h;
      const zr = re[k1], zi = im[k1];
      const cr = re[k2], ci = -im[k2];
      const er = 0.5 * (zr + cr), ei = 0.5 * (zi + ci);
      // O = (Z − conj(Z')) / 2i
      const or = 0.5 * (zi - ci), oi = -0.5 * (zr - cr);
      const wr = this.cosP[k], wi = this.sinP[k];
      outRe[k] = er + or * wr - oi * wi;
      outIm[k] = ei + or * wi + oi * wr;
    }
  }
}

/**
 * Windowed, smoothed magnitude spectrum — a drop-in replacement for
 * AnalyserNode.getFloatFrequencyData, but in linear units.
 *
 * Scale: AnalyserNode uses a Blackman window and |X[k]| / N. We use a Hann
 * window (lower leakage floor near the peak, better for the parabolic peak
 * interpolation the descriptors rely on) and rescale by the ratio of the two
 * windows' coherent gains (0.42 / 0.5), so a steady tone reads the same
 * magnitude as before and FeatureExtractor's absolute thresholds keep meaning
 * what they meant: a full-scale sine peaks at ≈ 0.21.
 */
export class SpectrumAnalyser {
  readonly fftSize: number;
  readonly bins: number;
  /** Same meaning as AnalyserNode.smoothingTimeConstant, defined per 60 Hz frame. */
  smoothing: number;
  readonly magnitudes: Float32Array;
  private fft: RealFFT;
  private window: Float32Array;
  private buf: Float64Array;
  private re: Float64Array;
  private im: Float64Array;
  private scale: number;

  constructor(fftSize = 4096, smoothing = 0.55) {
    this.fftSize = fftSize;
    this.bins = fftSize / 2;
    this.smoothing = smoothing;
    this.fft = new RealFFT(fftSize);
    this.window = hannWindow(fftSize);
    this.buf = new Float64Array(fftSize);
    this.re = new Float64Array(this.bins + 1);
    this.im = new Float64Array(this.bins + 1);
    this.magnitudes = new Float32Array(this.bins);
    this.scale = 0.42 / 0.5 / fftSize;
  }

  /**
   * Analyses the most recent `fftSize` samples of `frame` and updates `magnitudes`.
   * `dt` (seconds since the last call) makes the smoothing frame-rate independent:
   * at 60 fps it is exactly AnalyserNode's  Ŝ = τ·Ŝ + (1 − τ)·|X|; at 120 fps the
   * per-call factor is τ^(dt·60), so a 120 Hz display smooths like a 60 Hz one.
   */
  process(frame: Float32Array, dt = 1 / 60): Float32Array {
    const n = this.fftSize;
    const off = frame.length - n;
    for (let i = 0; i < n; i++) {
      const v = off + i >= 0 ? frame[off + i] : 0;
      this.buf[i] = v * this.window[i];
    }
    this.fft.forward(this.buf, this.re, this.im);
    const tau = this.smoothing <= 0 ? 0 : Math.pow(this.smoothing, Math.max(0, Math.min(0.25, dt)) * 60);
    const m = this.magnitudes;
    for (let k = 0; k < this.bins; k++) {
      const re = this.re[k], im = this.im[k];
      const mag = Math.sqrt(re * re + im * im) * this.scale;
      const s = tau * m[k] + (1 - tau) * mag;
      // Flush denormals/NaN so a glitch can't poison the smoothing forever.
      m[k] = s > 1e-12 && s < 1e6 ? s : 0;
    }
    return m;
  }

  reset() {
    this.magnitudes.fill(0);
  }
}
