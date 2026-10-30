import { describe, expect, it } from 'vitest';
import { RealFFT, SpectrumAnalyser, hannWindow } from '../src/audio/fft';

function naiveDft(x: Float64Array) {
  const n = x.length;
  const re = new Float64Array(n / 2 + 1);
  const im = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    let sr = 0, si = 0;
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * k * t) / n;
      sr += x[t] * Math.cos(a);
      si += x[t] * Math.sin(a);
    }
    re[k] = sr;
    im[k] = si;
  }
  return { re, im };
}

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

describe('RealFFT', () => {
  for (const n of [4, 8, 64, 512]) {
    it(`matches a naive DFT at N=${n}`, () => {
      const x = Float64Array.from({ length: n }, rnd);
      const fft = new RealFFT(n);
      const re = new Float64Array(n / 2 + 1);
      const im = new Float64Array(n / 2 + 1);
      fft.forward(x, re, im);
      const ref = naiveDft(x);
      let err = 0;
      for (let k = 0; k <= n / 2; k++) err = Math.max(err, Math.abs(re[k] - ref.re[k]), Math.abs(im[k] - ref.im[k]));
      expect(err).toBeLessThan(1e-9 * n);
    });
  }

  it('rejects non-powers of two', () => {
    expect(() => new RealFFT(1000)).toThrow();
  });

  it('does 4096 points in well under a millisecond', () => {
    const n = 4096;
    const fft = new RealFFT(n);
    const x = Float64Array.from({ length: n }, rnd);
    const re = new Float64Array(n / 2 + 1);
    const im = new Float64Array(n / 2 + 1);
    for (let i = 0; i < 200; i++) fft.forward(x, re, im); // warm up the JIT
    const reps = 1000;
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fft.forward(x, re, im);
    const ms = (performance.now() - t0) / reps;
    expect(ms).toBeLessThan(0.5);
  });
});

describe('SpectrumAnalyser', () => {
  const SR = 48000;
  const N = 4096;
  const sine = (freq: number, amp: number) => Float32Array.from({ length: N }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / SR));

  it('puts a sine at the right bin with AnalyserNode-compatible scale', () => {
    const an = new SpectrumAnalyser(N, 0);
    const bin = 100;
    const m = an.process(sine((bin * SR) / N, 1));
    let best = 0;
    for (let k = 0; k < m.length; k++) if (m[k] > m[best]) best = k;
    expect(best).toBe(bin);
    // AnalyserNode (Blackman, |X|/N): full-scale sine on a bin ≈ 0.42 / 2 = 0.21.
    expect(m[bin]).toBeCloseTo(0.21, 2);
    // Hann main lobe is ±2 bins; far bins are tiny.
    expect(m[bin + 10]).toBeLessThan(1e-4);
  });

  it('smooths like smoothingTimeConstant, independent of frame rate', () => {
    const tone = sine(1000, 1);
    const silent = new Float32Array(N);
    const a = new SpectrumAnalyser(N, 0.55);
    const b = new SpectrumAnalyser(N, 0.55);
    a.process(tone); // first frame: (1 − τ)·|X|
    const bin = Math.round((1000 * N) / SR);
    const full = new SpectrumAnalyser(N, 0).process(tone)[bin];
    expect(a.magnitudes[bin]).toBeCloseTo(0.45 * full, 6);
    // Decay over 1/6 s: 10 frames at 60 Hz vs 20 frames at 120 Hz.
    for (let i = 0; i < 10; i++) a.process(silent, 1 / 60);
    b.process(tone);
    for (let i = 0; i < 20; i++) b.process(silent, 1 / 120);
    expect(b.magnitudes[bin]).toBeCloseTo(a.magnitudes[bin], 6);
  });

  it('zero-pads a short frame and uses the tail of a long one', () => {
    const an = new SpectrumAnalyser(N, 0);
    const long = new Float32Array(N * 2);
    long.set(sine(3000, 0.5), N);
    const m = an.process(long);
    const bin = Math.round((3000 * N) / SR);
    expect(m[bin]).toBeGreaterThan(0.08);
    expect(new SpectrumAnalyser(N, 0).process(new Float32Array(10)).every((v) => v === 0)).toBe(true);
  });

  it('hann window is periodic and peaks at 1', () => {
    const w = hannWindow(8);
    expect(w[0]).toBe(0);
    expect(w[4]).toBeCloseTo(1, 12);
    expect(w[1]).toBeCloseTo(w[7], 12);
  });
});
