import { describe, expect, it } from 'vitest';
import { DescriptorExtractor, MAG_POWER_TO_RMS, groupHarmonics, keyEstimate, roughnessMap } from '../src/audio/descriptors';
import { emptyFeatures } from '../src/audio/features';
import { SpectrumAnalyser } from '../src/audio/fft';
import { AnalysisChain, analyzeOffline } from '../src/audio/offline';
import { PcmRing } from '../src/audio/pcm';
import type { Descriptors } from '../src/character/types';

const SR = 44100;

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A harmonic tone (partials 1/h) so harmonic grouping is exercised, not just pure sines. */
function addTone(out: Float32Array, start: number, dur: number, hz: number, amp: number, env: (t: number) => number, partials = 6) {
  const a = Math.round(start * SR), b = Math.min(out.length, Math.round((start + dur) * SR));
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR;
    let s = 0;
    for (let h = 1; h <= partials; h++) if (hz * h < SR / 2.2) s += Math.sin(2 * Math.PI * hz * h * t) / h;
    out[i] += amp * env(t) * s;
  }
}

const steady = (dur: number) => (t: number) => Math.min(1, t / 0.01, (dur - t) / 0.01);
/** Plucked: 1 ms attack, fast exponential decay. */
const pluck = (tau: number) => (t: number) => Math.min(1, t / 0.001) * Math.exp(-t / tau);
/** Bowed: slow 120 ms swell, then held. */
const bowed = (dur: number) => (t: number) => Math.min(1, t / 0.12, (dur - t) / 0.03);

/** Mean of each descriptor over [from, to) seconds. */
function mean(r: ReturnType<typeof analyzeOffline>, from: number, to = r.duration): Descriptors {
  const a = Math.round(from * r.fps), b = Math.round(to * r.fps);
  const out = { ...r.descriptors[0] };
  for (const k of Object.keys(out) as (keyof Descriptors)[]) {
    let s = 0;
    for (let i = a; i < b; i++) s += r.descriptors[i][k];
    out[k] = s / (b - a);
  }
  return out;
}

const run = (pcm: Float32Array, rate = SR) => analyzeOffline(pcm, rate);
const secs = (s: number, rate = SR) => new Float32Array(Math.round(s * rate));

describe('level & loudness', () => {
  it('converts magnitudes to RMS (Parseval) for sines and noise', () => {
    const N = 4096;
    const an = new SpectrumAnalyser(N, 0);
    const check = (x: Float32Array) => {
      const m = an.process(x);
      let p = 0;
      for (let i = 1; i < m.length; i++) p += m[i] * m[i];
      let s = 0;
      for (const v of x.subarray(0, N)) s += v * v;
      return { spec: MAG_POWER_TO_RMS * Math.sqrt(p), true: Math.sqrt(s / N) };
    };
    const sine = Float32Array.from({ length: N }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 1000.3 * i) / SR));
    const s = check(sine);
    expect(20 * Math.log10(s.spec)).toBeCloseTo(20 * Math.log10(s.true), 0); // −23 dBFS within 0.5 dB
    const wn = Float32Array.from({ length: N }, () => 0.05 * noise());
    const n = check(wn);
    expect(Math.abs(20 * Math.log10(n.spec / n.true))).toBeLessThan(0.5);
  });

  it('reads −20 dBFS as −20 dBFS from the hop PCM and from magnitudes alone', () => {
    const amp = 0.1 * Math.SQRT2; // RMS 0.1 = −20 dBFS
    const pcm = secs(2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = amp * Math.sin((2 * Math.PI * 997 * i) / SR);
    const chain = new AnalysisChain();
    const ring = new PcmRing(SR);
    ring.write(pcm);
    const src = { sampleRate: SR, written: pcm.length, latest: (o: Float32Array) => ring.latest(o), copyEndingAt: (e: number, o: Float32Array) => ring.copyEndingAt(e, o) };
    for (let h = 1; h <= 100; h++) chain.runHop(src, Math.round((h * SR) / 60));
    expect(chain.descriptorExtractor.debug.dbfs).toBeCloseTo(-20, 0);
    // Without PCM (magnitudes only), the same within ~0.5 dB.
    const ex = new DescriptorExtractor();
    const an = new SpectrumAnalyser(4096, 0.55);
    for (let h = 1; h <= 60; h++) {
      const end = Math.round((h * SR) / 60) + 4096;
      ex.update(emptyFeatures(), an.process(pcm.subarray(end - 4096, end)), SR, 4096, h / 60);
    }
    expect(Math.abs(ex.debug.dbfs + 20)).toBeLessThan(0.6);
  });

  it('is loud for loud sound, soft for soft sound, and knows silence', () => {
    const make = (amp: number) => {
      const p = secs(8);
      addTone(p, 0, 8, 330, amp, steady(8));
      return mean(run(p), 4, 8);
    };
    const loud = make(0.5);
    const soft = make(0.005);
    expect(loud.loudness).toBeGreaterThan(soft.loudness + 0.3);
    expect(loud.silence).toBeLessThan(0.05);
    const quiet = mean(run(secs(4)), 2, 4);
    expect(quiet.silence).toBeGreaterThan(0.95);
    expect(quiet.loudness).toBeLessThan(0.05);
  });

  it('dynamics: swells read higher than a steady level', () => {
    const steadyTone = secs(10);
    addTone(steadyTone, 0, 10, 220, 0.2, steady(10));
    const swell = secs(10);
    addTone(swell, 0, 10, 220, 0.2, (t) => 0.03 + 0.97 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * 0.5)));
    expect(mean(run(swell), 5).dynamics).toBeGreaterThan(mean(run(steadyTone), 5).dynamics + 0.4);
  });
});

describe('pitch', () => {
  it('register follows pitch height (C1 → 0 … C8 → 1)', () => {
    const at = (midi: number) => {
      const p = secs(6);
      addTone(p, 0, 6, midiHz(midi), 0.2, steady(6));
      return mean(run(p), 4, 6).register * 84 + 24;
    };
    // Harmonic-rich tones read as their fundamental, not their partials.
    expect(at(45)).toBeCloseTo(45, -0.5); // within ±1.5
    expect(Math.abs(at(81) - 81)).toBeLessThan(1.5);
    expect(Math.abs(at(33) - 33)).toBeLessThan(2);
  });

  it('a bass note rich in harmonics reads near its fundamental, not up among its partials', () => {
    // A1 with 20 partials (1/h): most of its audible energy is at 200–1000 Hz.
    // Weighing the note at its fundamental read ≈ MIDI 40, 7 semitones high.
    const p = secs(6);
    addTone(p, 0, 6, midiHz(33), 0.15, steady(6), 20);
    expect(Math.abs(mean(run(p), 4, 6).register * 84 + 24 - 33)).toBeLessThan(5);
  });

  it('groups partials into notes', () => {
    const f0 = 110;
    const notes = groupHarmonics([1, 2, 3, 4, 5].map((h) => ({ freq: f0 * h * (1 + 0.003 * (h - 3)), mag: 1 / h })));
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBeCloseTo(45, 0);
  });

  it('registerSpread: bass + treble at once is wider than one voice', () => {
    const one = secs(6);
    addTone(one, 0, 6, midiHz(60), 0.2, steady(6));
    const wide = secs(6);
    addTone(wide, 0, 6, midiHz(36), 0.2, steady(6));
    addTone(wide, 0, 6, midiHz(84), 0.2, steady(6));
    expect(mean(run(wide), 4).registerSpread).toBeGreaterThan(mean(run(one), 4).registerSpread + 0.3);
  });

  it('pitchMotion: a running scale moves, a repeated note does not', () => {
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2];
    const run1 = secs(10), same = secs(10);
    for (let i = 0; i < 50; i++) {
      addTone(run1, i * 0.2, 0.2, midiHz(60 + 2 * scale[i % scale.length]), 0.2, steady(0.2));
      addTone(same, i * 0.2, 0.2, midiHz(67), 0.2, steady(0.2));
    }
    expect(mean(run(run1), 4).pitchMotion).toBeGreaterThan(mean(run(same), 4).pitchMotion + 0.3);
  });
});

describe('harmony', () => {
  /** A I–IV–V–I style progression, chords every 0.5 s, voiced with a bass note. */
  function progression(chords: number[][]) {
    const p = secs(12);
    for (let i = 0; i < 24; i++) {
      const c = chords[i % chords.length];
      for (const n of c) addTone(p, i * 0.5, 0.5, midiHz(n), 0.08, steady(0.5));
      addTone(p, i * 0.5, 0.5, midiHz(c[0] - 12), 0.1, steady(0.5));
    }
    return mean(run(p), 9);
  }

  it('major vs minor', () => {
    // C major: C E G | F A C | G B D | C E G
    const major = progression([[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]]);
    // A minor: A C E | D F A | E G♯ B | A C E
    const minor = progression([[57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64]]);
    expect(major.majorness).toBeGreaterThan(0.3);
    expect(minor.majorness).toBeLessThan(-0.3);
    expect(major.keyClarity).toBeGreaterThan(0.4);
    expect(minor.keyClarity).toBeGreaterThan(0.4);
  });

  it('key profiles find the key of a scale', () => {
    const c = new Array(12).fill(0);
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) c[pc] = 1;
    c[0] = c[7] = 2;
    c[4] = 1.5;
    const k = keyEstimate(c);
    expect(k.majorKey).toBe(0);
    expect(k.major).toBeGreaterThan(k.minor);
  });

  it('harmonicChange: moving chords change more than one held chord', () => {
    const moving = progression([[60, 64, 67], [65, 69, 72], [67, 71, 74], [57, 60, 64]]);
    const held = progression([[60, 64, 67]]);
    expect(moving.harmonicChange).toBeGreaterThan(held.harmonicChange + 0.3);
  });

  it('keyClarity is low for noise', () => {
    const p = secs(8);
    for (let i = 0; i < p.length; i++) p[i] = 0.1 * noise();
    expect(mean(run(p), 5).keyClarity).toBeLessThan(0.15);
  });
});

describe('timbre', () => {
  it('noisiness: noise ≫ tone', () => {
    const n = secs(5), t = secs(5);
    for (let i = 0; i < n.length; i++) n[i] = 0.1 * noise();
    addTone(t, 0, 5, 440, 0.2, steady(5));
    expect(mean(run(n), 3).noisiness).toBeGreaterThan(0.8);
    expect(mean(run(t), 3).noisiness).toBeLessThan(0.15);
  });

  it('roughness: a semitone cluster beats, an octave does not', () => {
    const cluster = secs(5), octave = secs(5);
    for (const m of [60, 61, 62]) addTone(cluster, 0, 5, midiHz(m), 0.1, steady(5));
    for (const m of [48, 60, 72]) addTone(octave, 0, 5, midiHz(m), 0.1, steady(5));
    expect(mean(run(cluster), 3).roughness).toBeGreaterThan(mean(run(octave), 3).roughness + 0.25);
  });

  it('roughness map is linear where music lives and does not pin dense chords at 1', () => {
    expect(roughnessMap(0.01 + 0.14 * 0.5)).toBeCloseTo(0.5, 6);
    // Raw values of dense low piano chords (rendered Rachmaninoff p10 / p50 / p90).
    const [a, b, c] = [0.18, 0.26, 0.35].map(roughnessMap);
    expect(a).toBeGreaterThan(0.75);
    expect(b - a).toBeGreaterThan(0.05);
    expect(c - b).toBeGreaterThan(0.03);
    expect(c).toBeLessThan(0.99);
  });

  it('brightness: few partials darker than many', () => {
    const dull = secs(4), bright = secs(4);
    addTone(dull, 0, 4, 220, 0.2, steady(4), 1);
    addTone(bright, 0, 4, 220, 0.2, steady(4), 30);
    expect(mean(run(bright), 2).brightness).toBeGreaterThan(mean(run(dull), 2).brightness + 0.2);
  });
});

describe('rhythm & articulation', () => {
  function clicks(times: number[], dur: number) {
    const p = secs(dur);
    for (const t of times) {
      const a = Math.round(t * SR);
      for (let i = 0; i < 400 && a + i < p.length; i++) p[a + i] += 0.5 * noise() * Math.exp(-i / 60);
    }
    return p;
  }

  it('onsetRate counts onsets per second', () => {
    const two = mean(run(clicks(Array.from({ length: 24 }, (_, i) => 0.5 + i / 2), 12)), 6, 12);
    const six = mean(run(clicks(Array.from({ length: 70 }, (_, i) => 0.5 + i / 6), 12)), 6, 12);
    expect(two.onsetRate).toBeCloseTo(0.2, 1);
    expect(six.onsetRate).toBeCloseTo(0.6, 1);
  });

  it('tempo and pulse clarity from regular clicks', () => {
    const r = run(clicks(Array.from({ length: 24 }, (_, i) => 0.3 + i * 0.5), 12)); // 120 BPM
    const d = mean(r, 8, 12);
    expect(d.tempo * 200).toBeCloseTo(120, -1); // ±5 BPM
    expect(d.pulseClarity).toBeGreaterThan(0.8);
  });

  it('irregularity: jittered clicks are erratic, regular ones are not', () => {
    seed = 3;
    const regular: number[] = [], jittered: number[] = [];
    for (let i = 0, t = 0.3; i < 60; i++, t += 0.2) regular.push(t);
    for (let t = 0.3; t < 12; t += 0.08 + rnd() * 0.32) jittered.push(t);
    const reg = mean(run(clicks(regular, 12)), 8, 12);
    const jit = mean(run(clicks(jittered, 12)), 8, 12);
    expect(reg.irregularity).toBeLessThan(0.25);
    expect(jit.irregularity).toBeGreaterThan(reg.irregularity + 0.35);
    expect(reg.pulseClarity).toBeGreaterThan(jit.pulseClarity + 0.3);
  });

  it('dense and syncopated but in-time rhythms are not irregular', () => {
    seed = 11;
    const sixteenths: number[] = [], synco: number[] = [];
    const step = 60 / 174 / 4; // drum'n'bass 16ths, ≈ 11.6 per second
    for (let k = 0; k * step < 11.5; k++) sixteenths.push(0.3 + k * step);
    for (let k = 0; k * 0.125 < 11.5; k++) if (k % 4 === 0 || rnd() < 0.45) synco.push(0.3 + k * 0.125);
    expect(mean(run(clicks(sixteenths, 12)), 8, 12).irregularity).toBeLessThan(0.3);
    expect(mean(run(clicks(synco, 12)), 8, 12).irregularity).toBeLessThan(0.3);
  });

  it('staccato plucks: sharp attack, low sustain; bowed legato: soft attack, high sustain', () => {
    const stacc = secs(12), leg = secs(12);
    const melody = [69, 72, 76, 74, 72, 71, 69, 76];
    for (let i = 0; i < 48; i++) {
      addTone(stacc, 0.25 + i * 0.25, 0.25, midiHz(melody[i % 8]), 0.3, pluck(0.04));
      addTone(leg, 0.25 + i * 0.25, 0.25, midiHz(melody[i % 8]), 0.3, bowed(0.25));
    }
    const s = mean(run(stacc), 6);
    const l = mean(run(leg), 6);
    expect(s.attack).toBeGreaterThan(l.attack + 0.3);
    expect(l.sustain).toBeGreaterThan(s.sustain + 0.3);
  });

  it('plucks still read sharp over a sustained pad 12 dB below', () => {
    const pad = (p: Float32Array) => {
      for (const m of [48, 55, 60]) addTone(p, 0, 12, midiHz(m), 0.3 * 10 ** (-12 / 20), (t) => Math.min(1, t / 0.5));
      return p;
    };
    const stacc = pad(secs(12)), leg = pad(secs(12));
    const melody = [69, 72, 76, 74, 72, 71, 69, 76];
    for (let i = 0; i < 48; i++) {
      addTone(stacc, 0.25 + i * 0.25, 0.25, midiHz(melody[i % 8]), 0.3, pluck(0.04));
      addTone(leg, 0.25 + i * 0.25, 0.25, midiHz(melody[i % 8]), 0.3, bowed(0.25));
    }
    expect(mean(run(stacc), 6).attack).toBeGreaterThan(mean(run(leg), 6).attack + 0.2);
  });

  it('a held drone is sustained', () => {
    const p = secs(8);
    addTone(p, 0, 8, 147, 0.2, steady(8));
    expect(mean(run(p), 5).sustain).toBeGreaterThan(0.8);
  });
});

describe('one code path, any frame rate, any sample rate', () => {
  function piece(rate: number) {
    seed = 5;
    const p = secs(10, rate);
    const out = new Float32Array(p.length);
    const melody = [64, 67, 71, 72, 71, 67];
    for (let i = 0; i < 40; i++) {
      const t0 = 0.2 + i * 0.24;
      const a = Math.round(t0 * rate);
      const hz = midiHz(melody[i % 6]);
      for (let j = 0; j < rate * 0.24 && a + j < out.length; j++) {
        const t = j / rate;
        out[a + j] += 0.2 * Math.exp(-t / 0.08) * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(4 * Math.PI * hz * t));
      }
    }
    return out;
  }

  it('a NaN or Inf sample does not poison the running state', () => {
    const clean = piece(SR);
    const bad = clean.slice();
    bad[Math.round(3 * SR)] = NaN;
    bad[Math.round(5 * SR)] = Infinity;
    const a = run(clean).descriptors.at(-1)!, b = run(bad).descriptors.at(-1)!;
    for (const k of Object.keys(a) as (keyof Descriptors)[]) {
      expect(Number.isFinite(b[k])).toBe(true);
      expect(Math.abs(a[k] - b[k])).toBeLessThan(0.1);
    }
  });

  it('live stepping in irregular chunks equals offline analysis exactly', () => {
    const pcm = piece(SR);
    const offline = analyzeOffline(pcm, SR);
    const chain = new AnalysisChain();
    const ring = new PcmRing(SR);
    const src = {
      sampleRate: SR,
      get written() {
        return ring.written;
      },
      latest: (o: Float32Array) => ring.latest(o),
      copyEndingAt: (e: number, o: Float32Array) => ring.copyEndingAt(e, o),
    };
    // Audio arrives in 128-sample quanta (worklet chunks of 512); the "display"
    // polls at a jittery 30–165 Hz.
    let pos = 0;
    while (pos < pcm.length) {
      const n = Math.min(pcm.length - pos, 512 * (1 + Math.floor(rnd() * 3)));
      ring.write(pcm.subarray(pos, pos + n));
      pos += n;
      chain.step(src, 8);
    }
    const hops = Math.floor((pcm.length * 60) / SR);
    // The live chain starts on the first chunk boundary, so compare the end state.
    const last = offline.descriptors[hops - 1];
    for (const k of Object.keys(last) as (keyof Descriptors)[]) {
      expect(chain.descriptors[k], k).toBeCloseTo(last[k], 2);
    }
  });

  it('44.1 kHz and 48 kHz agree', () => {
    const a = mean(analyzeOffline(piece(44100), 44100), 5);
    const b = mean(analyzeOffline(piece(48000), 48000), 5);
    for (const k of Object.keys(a) as (keyof Descriptors)[]) {
      expect(Math.abs(a[k] - b[k]), k).toBeLessThan(0.08);
    }
  });
});
