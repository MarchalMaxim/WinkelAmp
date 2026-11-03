import { describe, expect, it } from 'vitest';
import { FeatureExtractor, estimateBpm, pitchClass } from '../src/audio/features';
import { fifthsPosition, noteHue, paletteColor, PALETTES } from '../src/visual/color';

const SR = 48000;
const FFT = 4096;
const BINS = FFT / 2;

/** A spectrum with peaks at the given frequencies (plus harmonics). */
function spectrum(freqs: number[], amp = 0.2, noise = 0.0005) {
  const m = new Float32Array(BINS).fill(noise);
  for (const f of freqs) {
    for (let h = 1; h <= 3; h++) {
      const bin = Math.round((f * h * FFT) / SR);
      if (bin < BINS - 1) {
        m[bin] += amp / h;
        m[bin - 1] += (amp / h) * 0.4;
        m[bin + 1] += (amp / h) * 0.4;
      }
    }
  }
  return m;
}

const wave = new Float32Array(1024);

function run(ex: FeatureExtractor, frames: (i: number) => Float32Array, n: number, fps = 60) {
  let f = ex.features;
  for (let i = 0; i < n; i++) {
    f = ex.update({ magnitudes: frames(i), waveform: wave, sampleRate: SR, fftSize: FFT, time: i / fps });
  }
  return f;
}

describe('pitchClass', () => {
  it('maps standard pitches', () => {
    expect(pitchClass(440)).toBe(9); // A
    expect(pitchClass(261.63)).toBe(0); // C
    expect(pitchClass(392)).toBe(7); // G
    expect(pitchClass(880)).toBe(9);
  });
});

describe('FeatureExtractor', () => {
  it('finds the dominant note of a chord', () => {
    const ex = new FeatureExtractor();
    // A minor: A3, C4, E4 with A emphasized.
    const f = run(ex, () => {
      const s = spectrum([220, 261.63, 329.63], 0.1);
      const a = Math.round((220 * FFT) / SR);
      s[a] += 0.3;
      return s;
    }, 30);
    expect(f.note).toBe(9);
    expect(f.chroma[0]).toBeGreaterThan(0.1); // C present
    expect(f.chroma[4]).toBeGreaterThan(0.1); // E present
    expect(f.tonality).toBeGreaterThan(0.3);
  });

  it('calls noise atonal', () => {
    const ex = new FeatureExtractor();
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const f = run(ex, () => Float32Array.from({ length: BINS }, () => 0.05 * rnd()), 60);
    expect(f.tonality).toBeLessThan(0.3);
  });

  it('detects onsets on a steady kick and estimates the tempo', () => {
    const ex = new FeatureExtractor();
    const fps = 100;
    const beatEvery = 50; // frames → 120 BPM at 100 fps
    let onsets = 0;
    let bpm = 0;
    for (let i = 0; i < 600; i++) {
      const phase = i % beatEvery;
      const hit = phase < 4 ? 1 - phase / 4 : 0;
      const s = spectrum([55, 110], 0.02 + hit * 0.5, 0.0005);
      const f = ex.update({ magnitudes: s, waveform: wave, sampleRate: SR, fftSize: FFT, time: i / fps });
      if (f.onset) onsets++;
      bpm = f.bpm || bpm;
    }
    // 12 beats in 6 s; allow the first to be missed while history fills.
    expect(onsets).toBeGreaterThanOrEqual(10);
    expect(onsets).toBeLessThanOrEqual(13);
    expect(Math.abs(bpm - 120)).toBeLessThanOrEqual(2);
  });

  it('auto-gains quiet input to a usable level', () => {
    const ex = new FeatureExtractor();
    const f = run(ex, () => spectrum([100, 1000, 5000], 0.002, 0.00001), 60);
    expect(f.level).toBeGreaterThan(0.5);
    expect(f.bass).toBeGreaterThan(0.5);
  });

  it('separates bass from treble', () => {
    const ex = new FeatureExtractor();
    run(ex, () => spectrum([60, 4000], 0.2), 60);
    // Now only bass.
    const f = run(ex, () => spectrum([60], 0.2), 60);
    expect(f.bass).toBeGreaterThan(0.6);
    expect(f.treble).toBeLessThan(0.3);
  });
});

describe('estimateBpm', () => {
  it('handles straight and syncopated pulses', () => {
    const straight = Array.from({ length: 16 }, (_, i) => i * 0.5);
    expect(estimateBpm(straight)).toBe(120);
    const fast = Array.from({ length: 16 }, (_, i) => i * (60 / 174));
    expect(Math.abs(estimateBpm(fast) - 174)).toBeLessThanOrEqual(1);
  });
  it('needs some evidence', () => {
    expect(estimateBpm([0, 0.5])).toBe(0);
  });
});

describe('color', () => {
  it('places fifths next to each other', () => {
    expect(fifthsPosition(0)).toBe(0); // C
    expect(fifthsPosition(7)).toBeCloseTo(1 / 12); // G
    expect(fifthsPosition(2)).toBeCloseTo(2 / 12); // D
    expect(noteHue(0)).toBe(0);
  });
  it('glides continuously between notes', () => {
    const mid = fifthsPosition(0.5); // halfway C → C♯ (C♯ is 7 fifths away, i.e. -5)
    expect(mid).toBeGreaterThan(0.7);
  });
  it('samples palettes and wraps', () => {
    const sunset = PALETTES.find((p) => p.id === 'sunset')!;
    expect(paletteColor(sunset, 0)).toEqual(paletteColor(sunset, 1));
    const c = paletteColor(sunset, 0.37);
    expect(c.h).toBeGreaterThanOrEqual(0);
    expect(c.h).toBeLessThan(360);
  });
});
