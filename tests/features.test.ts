/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FeatureExtractor, estimateBpm, pitchClass } from '../src/audio/features';
import { DRIVES, advanceFeatures, knobValue, newFeatures } from '../src/widgets/features';
import { evalLabHarness } from '../src/widgets/lab-harness';
import type { Chord } from '../src/widgets/types';

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

// The widgets' pulse (src/widgets/features.ts), not the audio extractor above: the +hit drive, "each note → jump".
describe('feat.hit, the +hit drive', () => {
  const chord = (vel: number): Chord => ({ t: 0, notes: [{ m: 60, v: vel, d: 1 }], vel, lo: 60, hi: 60 });
  const pulse = () => ({ level: 0, rate: 0, hit: 0 });

  it('a full-strength note lifts it to 1 in its own step, and half of it is gone 0.08 s later', () => {
    const p = pulse(), f = newFeatures();
    advanceFeatures(p, f, [chord(127)], [], 1 / 60);
    expect(f.hit).toBe(1);
    advanceFeatures(p, f, [], [], 0.08);
    expect(f.hit).toBeCloseTo(0.5, 12);
    advanceFeatures(p, f, [], [], 0.08);
    expect(f.hit).toBeCloseTo(0.25, 12);
    // in 60 Hz steps too: about 70 ms above half
    const q = pulse(), g = newFeatures();
    advanceFeatures(q, g, [chord(127)], [], 1 / 60);
    let n = 0; while (g.hit > 0.5) { advanceFeatures(q, g, [], [], 1 / 60); n++; }
    expect(n).toBe(5);
  });

  it('a soft note after a loud one still makes it jump, where level does not move', () => {
    const p = pulse(), f = newFeatures();
    advanceFeatures(p, f, [chord(120)], [], 1 / 60);
    advanceFeatures(p, f, [], [], 0.1);
    const hit0 = f.hit, level0 = f.level;
    advanceFeatures(p, f, [chord(40)], [], 1 / 60);
    expect(f.level).toBeLessThan(level0);          // level only decays: max(level, 40/115) is still the old level
    const decayed = hit0 * Math.pow(0.5, (1 / 60) / 0.08);
    expect(f.hit).toBeGreaterThan(decayed + 0.1);  // the soft note added its share
    expect(f.hit).toBeLessThanOrEqual(1);
  });

  it('two notes at once never pass 1, and louder notes kick harder', () => {
    const p = pulse(), f = newFeatures();
    advanceFeatures(p, f, [chord(127), chord(127)], [], 1 / 60);
    expect(f.hit).toBe(1);
    const soft = pulse(), fs = newFeatures(), loud = pulse(), fl = newFeatures();
    advanceFeatures(soft, fs, [chord(40)], [], 1 / 60);
    advanceFeatures(loud, fl, [chord(100)], [], 1 / 60);
    expect(fs.hit).toBeGreaterThan(0.1);
    expect(fl.hit).toBeGreaterThan(fs.hit);
  });

  it('drives a knob up or down like any other drive', () => {
    const q = { key: 'size', min: 0, max: 2, value: 1 };
    const f = { ...newFeatures(), hit: 0.5 };
    expect(knobValue(q, { base: 1, drive: '+hit', depth: 0.3 }, f)).toBeCloseTo(1.3, 12);
    expect(knobValue(q, { base: 1, drive: '-hit', depth: 0.3 }, f)).toBeCloseTo(0.7, 12);
    expect(knobValue(q, { base: 1, drive: '+hit', depth: 0.3 }, newFeatures())).toBe(1);
  });

  it("is in the lab's drive menu with its words, and the studio accepts it in a show", () => {
    const h = evalLabHarness(readFileSync(new URL('../lab/harness.js', import.meta.url), 'utf8'), readFileSync(new URL('../lab/kit.js', import.meta.url), 'utf8'));
    expect(h.drives).toContainEqual(['+hit', 'each note → jump']);
    expect(h.drives).toContainEqual(['-hit', 'each note → dip']);
    expect(DRIVES).toContain('+hit');
    expect(DRIVES).toContain('-hit');
    for (const [d] of h.drives) expect(DRIVES).toContain(d);
  });
});
