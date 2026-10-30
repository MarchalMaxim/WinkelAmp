import { describe, expect, it } from 'vitest';
import { compare, fingerprint, isMatch } from '../src/audio/fingerprint';

/**
 * Synthetic "music": a seeded score (tempo, key, chord changes, melody,
 * kick/snare/hat) rendered as a function of time, so the same score can be
 * rendered at any sample rate without resampling. Percussion is built from
 * fixed inharmonic partials rather than per-sample noise, for the same reason.
 */
function music(seed: number, seconds: number, rate: number): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = new Float32Array(Math.round(seconds * rate));
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  /** Adds a tone of `partials` ([freq, amp]) from t0 for dur s, with attack and exponential decay. */
  const tone = (t0: number, dur: number, partials: [number, number][], attack: number, decay: number, sweep = 0) => {
    const i0 = Math.round(t0 * rate);
    const i1 = Math.min(out.length, Math.round((t0 + dur) * rate));
    for (let i = Math.max(0, i0); i < i1; i++) {
      const t = (i - i0) / rate;
      const env = Math.min(1, t / attack) * Math.exp(-t / decay) * Math.min(1, (t0 + dur - i / rate) / 0.01);
      // Pitch sweep (kick): phase of f·(1 + sweep·e^(−t/0.05)).
      const ph = sweep ? t + sweep * 0.05 * (1 - Math.exp(-t / 0.05)) : t;
      let v = 0;
      for (const [f, a] of partials) v += a * Math.sin(2 * Math.PI * f * ph);
      out[i] += env * v;
    }
  };

  const beat = 60 / (88 + rnd() * 60);
  const key = 48 + Math.floor(rnd() * 12);
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const snarePartials: [number, number][] = Array.from({ length: 24 }, () => [900 + rnd() * 5000, 0.02]);
  const hatPartials: [number, number][] = Array.from({ length: 16 }, () => [5000 + rnd() * 6000, 0.012]);
  snarePartials.push([180 + rnd() * 40, 0.15]);

  for (let bar = 0, t = 0; t < seconds; bar++, t += 4 * beat) {
    // A chord per bar (sometimes two), root from the scale.
    const halves = rnd() < 0.4 ? 2 : 1;
    for (let h = 0; h < halves; h++) {
      const deg = Math.floor(rnd() * 7);
      const notes = [0, 2, 4].map((k) => key + scale[(deg + k) % 7] + 12 * Math.floor((deg + k) / 7));
      const ct = t + (h * 4 * beat) / halves;
      for (const n of notes) tone(ct, (4 * beat) / halves, [[hz(n), 0.08], [2 * hz(n), 0.03], [3 * hz(n), 0.015]], 0.02, 1.5);
      tone(ct, (4 * beat) / halves, [[hz(notes[0] - 12), 0.12], [2 * hz(notes[0] - 12), 0.04]], 0.01, 0.8);
    }
    // Melody: eighths and quarters wandering over two octaves.
    let deg = 7 + Math.floor(rnd() * 7);
    for (let x = 0; x < 8; ) {
      const len = rnd() < 0.6 ? 1 : 2;
      if (rnd() < 0.85) {
        deg = Math.max(0, Math.min(14, deg + Math.floor(rnd() * 5) - 2));
        const n = key + 12 + scale[deg % 7] + 12 * Math.floor(deg / 7);
        tone(t + (x * beat) / 2, (len * beat) / 2, [[hz(n), 0.12], [2 * hz(n), 0.05], [3 * hz(n), 0.02]], 0.005, 0.3);
      }
      x += len;
    }
    // Percussion with a little seeded swing so hit times differ between songs.
    for (let b = 0; b < 4; b++) {
      const bt = t + b * beat + (rnd() - 0.5) * 0.02;
      if (b % 2 === 0 || rnd() < 0.15) tone(bt, 0.3, [[50, 0.5]], 0.002, 0.12, 1.5);
      if (b % 2 === 1) tone(bt, 0.2, snarePartials, 0.001, 0.06);
      tone(bt, 0.06, hatPartials, 0.001, 0.02);
      if (rnd() < 0.5) tone(bt + beat / 2, 0.06, hatPartials, 0.001, 0.02);
    }
  }
  return out;
}

/** RBJ biquad low-pass. */
function lowpass(x: Float32Array, rate: number, f: number): Float32Array {
  const w = (2 * Math.PI * f) / rate, q = Math.SQRT1_2;
  const alpha = Math.sin(w) / (2 * q), c = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, b2 = b0, a1 = (-2 * c) / a0, a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

const A44 = music(7, 60, 44100);
const A44fp = fingerprint(A44, 44100);

describe('fingerprint', () => {
  it('has the documented shape', () => {
    expect(A44fp.version).toBe(1);
    expect(A44fp.hop).toBe(0.1);
    expect(A44fp.duration).toBeCloseTo(60, 1);
    // 16 bits (2 bytes) per hop, base64.
    const bytes = atob(A44fp.bits).length;
    expect(bytes % 2).toBe(0);
    expect(Math.abs(bytes / 2 - 600)).toBeLessThanOrEqual(2);
  });

  it('same music matches across rates and gain', () => {
    const b = lowpass(music(7, 60, 48000), 48000, 8000).map((v) => v * 0.5);
    const fb = fingerprint(b, 48000);
    const r = compare(A44fp, fb);
    expect(r.ber).toBeLessThan(0.15);
    expect(Math.abs(r.offset)).toBeLessThanOrEqual(0.1);
    expect(isMatch(A44fp, fb)).toBe(true);
  }, 30_000);

  it('different music does not match', () => {
    const fb = fingerprint(music(1234, 60, 44100), 44100);
    expect(compare(A44fp, fb).ber).toBeGreaterThan(0.35);
    expect(isMatch(A44fp, fb)).toBe(false);
  }, 30_000);

  it('time-crop does not match full', () => {
    const crop = fingerprint(A44.subarray(0, 40 * 44100), 44100);
    expect(isMatch(crop, A44fp)).toBe(false);
    expect(isMatch(A44fp, crop)).toBe(false);
  });

  it('leading silence tolerated', () => {
    const padded = new Float32Array(A44.length + Math.round(0.7 * 44100));
    padded.set(A44, Math.round(0.7 * 44100));
    const fb = fingerprint(padded, 44100);
    expect(compare(A44fp, fb).offset).toBe(0);
    expect(isMatch(A44fp, fb)).toBe(true);
  });

  it('is symmetric in its verdict and reports the offset of b against a', () => {
    // b starts 1 s into a: a's hop i lines up with b's hop i − 10.
    const late = fingerprint(A44.subarray(44100), 44100);
    const r = compare(A44fp, late);
    expect(r.ber).toBeLessThan(0.05);
    expect(r.offset).toBeCloseTo(-1, 5);
    expect(compare(late, A44fp).offset).toBeCloseTo(1, 5);
  });

  it('fast', () => {
    const long = new Float32Array(12 * 60 * 44100);
    for (let i = 0; i < 12; i++) long.set(A44.subarray(0, 60 * 44100), i * 60 * 44100);
    const t0 = performance.now();
    const fp = fingerprint(long, 44100);
    const ms = performance.now() - t0;
    expect(fp.duration).toBeCloseTo(720, 0);
    expect(ms).toBeLessThan(3000);
  }, 30_000);

  it('handles silence and tiny inputs without throwing', () => {
    const silent = fingerprint(new Float32Array(44100), 44100);
    expect(silent.duration).toBe(0);
    expect(isMatch(silent, silent)).toBe(false);
    const tiny = fingerprint(A44.subarray(0, 1000), 44100);
    expect(compare(tiny, A44fp).ber).toBeGreaterThanOrEqual(0);
    expect(isMatch(tiny, A44fp)).toBe(false);
  });
});
