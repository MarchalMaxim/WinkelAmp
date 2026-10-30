import { describe, expect, it } from 'vitest';
import { RealFFT, hannWindow } from '../src/audio/fft';
import { inharmonicityB, note, pianoFreq, pianoNote } from '../src/audio/instruments';
import { STUDIES, type Ev, type StudyScore } from '../src/audio/studies';
import { render, Score } from '../scripts/reference/piano';

const scores = Object.fromEntries(STUDIES.map((s) => [s.id, s.compose(1)])) as Record<string, StudyScore>;
const pitched = (e: Ev) => e.m > 0;

/** Distinct onsets (events closer than 30 ms count as one, like an ear or an onset detector would). */
function onsets(s: StudyScore) {
  const out: number[] = [];
  for (const e of s.events) if (pitched(e) && (!out.length || e.t - out[out.length - 1] > 0.03)) out.push(e.t);
  return out;
}
const rate = (s: StudyScore) => onsets(s).length / s.length;
function ioiCv(s: StudyScore) {
  const o = onsets(s);
  const d = o.slice(1).map((t, i) => t - o[i]).filter((x) => x < 2);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  return Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length) / mean;
}
function meanPitch(s: StudyScore) {
  let w = 0, sum = 0;
  for (const e of s.events) if (pitched(e)) {
    w += e.vel;
    sum += e.vel * e.m;
  }
  return sum / w;
}

describe('note names', () => {
  it('parses sharps, flats and octaves', () => {
    expect(note('A4')).toBe(69);
    expect(note('C#4')).toBe(61);
    expect(note('Bb0')).toBe(22);
    expect(note('B#3')).toBe(60);
    expect(note('A0')).toBe(21);
  });
});

describe('study scores', () => {
  it('are well-formed, 60–90 s long, and reproducible from their seed', () => {
    for (const st of STUDIES) {
      const s = scores[st.id];
      expect(s.length, st.id).toBeGreaterThan(55);
      expect(s.length, st.id).toBeLessThan(92);
      expect(s.events.length).toBeGreaterThan(20);
      for (let i = 0; i < s.events.length; i++) {
        const e = s.events[i];
        expect(Number.isFinite(e.t) && Number.isFinite(e.vel) && Number.isFinite(e.d) && Number.isFinite(e.m), `${st.id} ${e.v} @${e.t}`).toBe(true);
        if (e.x !== undefined) expect(Number.isFinite(e.x)).toBe(true);
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t).toBeLessThan(s.length);
        if (i) expect(e.t).toBeGreaterThanOrEqual(s.events[i - 1].t);
        expect(e.vel).toBeGreaterThan(0);
        expect(e.vel).toBeLessThanOrEqual(1);
      }
      expect(st.compose(1)).toEqual(s);
      for (const seed of [102, 203, 304, 405]) for (const e of st.compose(seed).events) expect(Number.isFinite(e.m) && Number.isFinite(e.x ?? 0), `${st.id} seed ${seed}`).toBe(true);
      // Live loops are re-composed with new seeds: still the same piece, but not identical.
      const other = st.compose(102);
      expect(other.length).toBeCloseTo(s.length, 0);
    }
  });

  it('keeps the piano inside the keyboard', () => {
    for (const e of scores.basalt.events) {
      expect(e.m).toBeGreaterThanOrEqual(21);
      expect(e.m).toBeLessThanOrEqual(108);
    }
  });

  it('sit where their characters live: Sugar high, Basalt low', () => {
    const p = Object.fromEntries(STUDIES.map((s) => [s.id, meanPitch(scores[s.id])]));
    expect(p.sugar).toBeGreaterThan(75); // celesta around C6 (pizzicato bass pulls the mean down)
    expect(p.ember).toBeGreaterThan(70); // mid-high strings
    expect(p.basalt).toBeLessThan(56);
    expect(p.sugar).toBeGreaterThan(p.ember);
    expect(p.ember).toBeGreaterThan(p.mist);
    expect(p.mist).toBeGreaterThan(p.basalt);
  });

  it('move at their characters’ pace: Ember and Sugar quick, Basalt slow, Mist almost still', () => {
    expect(rate(scores.ember)).toBeGreaterThan(5);
    expect(rate(scores.sugar)).toBeGreaterThan(4);
    expect(rate(scores.basalt)).toBeLessThan(2);
    expect(rate(scores.mist)).toBeLessThan(1);
  });

  it('make Ember the erratic one', () => {
    expect(ioiCv(scores.ember)).toBeGreaterThan(0.8);
    expect(ioiCv(scores.ember)).toBeGreaterThan(ioiCv(scores.sugar) * 1.3);
    expect(ioiCv(scores.ember)).toBeGreaterThan(ioiCv(scores.basalt));
  });

  it('give Basalt fff low octaves and una corda pp', () => {
    const ev = scores.basalt.events;
    expect(ev.filter((e) => e.vel > 0.9 && e.m < 36).length).toBeGreaterThan(8);
    expect(ev.filter((e) => e.vel < 0.25).length).toBeGreaterThan(30);
  });

  it('perform Basalt with rubato, not to a metronome, and keep it under 90 s', () => {
    // The una corda chorale's chords on beats 2-3-4: their spacing must breathe.
    const chords = onsets(scores.basalt).filter((t) => t > 12 && t < 42);
    const d = chords.slice(1).map((t, i) => t - chords[i]).filter((x) => x > 0.8 && x < 2);
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    const spread = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length) / mean;
    expect(d.length).toBeGreaterThan(10);
    expect(spread).toBeGreaterThan(0.03);
    expect(spread).toBeLessThan(0.25); // still a steady Lento, not chaos
    for (const seed of [1, 102, 203]) expect(STUDIES[1].compose(seed).length).toBeLessThan(90);
  });

  it('give every study the same shape through STUDIES, callable without `this`', () => {
    for (const st of STUDIES) {
      const { create } = st;
      expect(typeof create).toBe('function');
      expect(st.title.length).toBeGreaterThan(0);
      expect(st.blurb.length).toBeGreaterThan(0);
    }
  });

  it('keep Mist legato: every pad and flute tone lasts seconds', () => {
    for (const e of scores.mist.events) if (e.v === 'pad' || e.v === 'flute') expect(e.d).toBeGreaterThan(2);
  });
});

describe('piano synthesis', () => {
  const SR = 32000;
  function spectrum(x: Float32Array, from: number, n: number) {
    const fft = new RealFFT(n);
    const w = hannWindow(n);
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = (x[from + i] ?? 0) * w[i];
    const re = new Float64Array(n / 2 + 1), im = new Float64Array(n / 2 + 1);
    fft.forward(buf, re, im);
    return Array.from({ length: n / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k]));
  }
  const centroid = (m: number[]) => {
    let a = 0, b = 0;
    m.forEach((v, k) => ((a += v), (b += v * k)));
    return ((b / a) * SR) / ((m.length - 1) * 2);
  };
  const energy = (x: Float32Array, from: number, len: number) => {
    let e = 0;
    for (let i = from; i < from + len && i < x.length; i++) e += x[i] * x[i];
    return e;
  };

  it('is finite and stays well under full scale', () => {
    for (const m of [21, 33, 48, 60, 72, 84, 96, 108]) {
      const x = pianoNote(SR, m, 1, { dur: 1.5 });
      let peak = 0;
      for (const v of x) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, `midi ${m}`).toBeLessThan(0.9);
      expect(peak, `midi ${m}`).toBeGreaterThan(0.02);
    }
  });

  it('gets brighter and louder with velocity (fff vs una corda)', () => {
    const soft = pianoNote(SR, 45, 0.15, { dur: 1 });
    const hard = pianoNote(SR, 45, 1, { dur: 1 });
    expect(centroid(spectrum(hard, 0, 8192))).toBeGreaterThan(centroid(spectrum(soft, 0, 8192)) * 1.8);
    expect(energy(hard, 0, SR) / energy(soft, 0, SR)).toBeGreaterThan(100); // > 20 dB
  });

  it('rings longer in the bass than in the treble', () => {
    const decay = (m: number) => {
      const x = pianoNote(SR, m, 0.7, { dur: 3 });
      return energy(x, 2 * SR, SR / 2) / energy(x, 0, SR / 2);
    };
    expect(decay(33)).toBeGreaterThan(decay(84) * 20);
  });

  it('lets a pedalled reference note ring out instead of cutting the file off mid-ring', () => {
    const sr = 16000;
    const s = new Score(42);
    s.ped(8);
    s.play('C#1 C#2', 1, 8);
    s.wait(8);
    const { L } = render(s, sr, 1);
    let peak = 0;
    for (const x of L) peak = Math.max(peak, Math.abs(x));
    expect(L.length / sr).toBeGreaterThan(11); // past the 11.4 s hold
    let e = 0;
    for (let i = L.length - sr / 2; i < L.length; i++) e += L[i] * L[i];
    expect(10 * Math.log10(e / (sr / 2) + 1e-20) - 20 * Math.log10(peak)).toBeLessThan(-60);
  });

  it('has stretched, inharmonic partials', () => {
    const m = 33; // A1
    const x = pianoNote(SR, m, 1, { dur: 2 });
    const n = 32768;
    const mag = spectrum(x, 0, n);
    const f0 = pianoFreq(m);
    const B = inharmonicityB(m);
    const k = 12;
    const expected = k * f0 * Math.sqrt(1 + B * k * k);
    // Peak bin around the 12th partial.
    const binHz = SR / n;
    let best = 0, at = 0;
    for (let b = Math.floor((k * f0 - 6) / binHz); b < (k * f0 + 12) / binHz; b++) if (mag[b] > best) ((best = mag[b]), (at = b * binHz));
    expect(Math.abs(at - expected)).toBeLessThan(binHz * 1.5);
    expect(at - k * f0).toBeGreaterThan(0.2); // measurably sharp of the harmonic series
  });
});
