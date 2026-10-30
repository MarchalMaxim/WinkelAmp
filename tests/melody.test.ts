import { describe, expect, it } from 'vitest';
import { MELODY_RANGE, MelodyTracker, SALIENCE_BINS, extractMelody, salience } from '../src/audio/melody';
import { analyzeOffline } from '../src/audio/offline';
import { melodyLine, onsetF1, referenceContour, scoreContour, type RefEvent } from '../scripts/eval/melody-metrics';

const SR = 44100;

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const db = (d: number) => 10 ** (d / 20);

/** A harmonic tone (partials 1/h) with an envelope. */
function addTone(out: Float32Array, start: number, dur: number, midi: number, amp: number, env: (t: number) => number, partials = 6) {
  const hz = midiHz(midi);
  const a = Math.round(start * SR), b = Math.min(out.length, Math.round((start + dur) * SR));
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR;
    let s = 0;
    for (let h = 1; h <= partials; h++) if (hz * h < SR / 2.2) s += Math.sin(2 * Math.PI * hz * h * t) / h;
    out[i] += amp * env(t) * s;
  }
}

/** Struck then held: 8 ms attack, gentle decay, 15 ms release at the end of `dur`. */
const struck = (dur: number) => (t: number) => Math.min(1, t / 0.008, (dur - t) / 0.015) * Math.exp(-t / 0.8);
const held = (dur: number) => (t: number) => Math.min(1, t / 0.05, (dur - t) / 0.05);

/** Plays `notes` as 8th notes (100 BPM) at `amp`, 90 % legato. Returns the events (truth). */
function line(out: Float32Array, notes: number[], amp: number, t0 = 0.2, ioi = 0.3, voice = 'mel'): RefEvent[] {
  return notes.map((m, i) => {
    const t = t0 + i * ioi;
    addTone(out, t, ioi * 0.9, m, amp, struck(ioi * 0.9));
    return { t, m, d: ioi * 0.9, v: voice };
  });
}

/** A random walk of `n` notes inside [lo, hi], steps of up to a fourth. */
function walk(n: number, lo: number, hi: number) {
  const out: number[] = [];
  let m = Math.round((lo + hi) / 2);
  for (let i = 0; i < n; i++) {
    out.push(m);
    let step = Math.round((rnd() * 2 - 1) * 5);
    if (m + step < lo || m + step > hi) step = -step;
    m += step;
  }
  return out;
}

/** Live frames and offline extraction over one signal, scored against the truth line. */
function evaluate(pcm: Float32Array, truth: RefEvent[]) {
  const r = analyzeOffline(pcm, SR, { melody: true });
  const m = r.melody!;
  const ref = melodyLine(truth);
  const off = extractMelody(m.salience, r.fps);
  const offScore = scoreContour(referenceContour(ref, r.times), off.contour);
  const liveContour = new Float32Array(m.frames.map((f) => (f.voiced ? f.pitch : NaN)));
  const lag = m.latency;
  const liveRef = referenceContour(ref, r.times.map((t) => t - lag));
  const liveScore = scoreContour(liveRef, liveContour);
  return { r, m, ref, off, offScore, liveScore, liveContour };
}

describe('melody', () => {
  it('follows a melody over accompaniment', () => {
    const dur = 13;
    const pcm = new Float32Array(dur * SR);
    const A = 0.22;
    const truth = line(pcm, walk(40, 67, 79), A);
    const pads = [[55, 60, 64], [57, 60, 65], [55, 59, 62], [55, 60, 64], [57, 60, 64]];
    const bass = [36, 41, 43, 36, 45];
    pads.forEach((chord, i) => {
      for (const p of chord) addTone(pcm, 0.2 + i * 2.4, 2.4, p, A * db(-9), held(2.4));
      addTone(pcm, 0.2 + i * 2.4, 2.4, bass[i], A * db(-6), held(2.4));
    });
    const { offScore, liveScore } = evaluate(pcm, truth);
    expect(offScore.rawPitch).toBeGreaterThanOrEqual(0.85);
    expect(liveScore.rawPitch).toBeGreaterThanOrEqual(0.75);
  });

  it('top line is not always the melody', () => {
    const dur = 11;
    const pcm = new Float32Array(dur * SR);
    const A = 0.25;
    const truth = line(pcm, walk(34, 60, 67), A);
    const arp = [84, 88, 91, 96];
    for (let i = 0; i < 68; i++) addTone(pcm, 0.2 + i * 0.15, 0.14, arp[i % 4], A * db(-12), struck(0.14), 3);
    const { offScore } = evaluate(pcm, truth);
    expect(offScore.rawPitch).toBeGreaterThanOrEqual(0.75);
  });

  it('unvoiced on drums', () => {
    const dur = 8;
    const pcm = new Float32Array(dur * SR);
    const beat = 0.5;
    for (let b = 0; b * beat < dur - 0.5; b++) {
      const t = 0.1 + b * beat;
      const a = Math.round(t * SR);
      if (b % 2 === 0) {
        // Kick: a sine sweeping 120 → 45 Hz.
        let ph = 0;
        for (let i = 0; i < 0.35 * SR; i++) {
          const tt = i / SR;
          ph += (2 * Math.PI * (45 + 75 * Math.exp(-tt / 0.04))) / SR;
          pcm[a + i] += 0.8 * Math.exp(-tt / 0.12) * Math.sin(ph);
        }
      } else {
        for (let i = 0; i < 0.25 * SR; i++) pcm[a + i] += 0.4 * Math.exp(-i / SR / 0.06) * noise(); // snare
      }
      for (const off of [0, beat / 2]) {
        const h = Math.round((t + off) * SR);
        for (let i = 0; i < 0.05 * SR; i++) pcm[h + i] += 0.12 * Math.exp(-i / SR / 0.015) * noise(); // hat
      }
    }
    const r = analyzeOffline(pcm, SR, { melody: true });
    const m = r.melody!;
    const off = extractMelody(m.salience, r.fps);
    const offVoiced = off.contour.filter((p) => Number.isFinite(p)).length / off.contour.length;
    const liveVoiced = m.frames.filter((f) => f.voiced).length / m.frames.length;
    expect(offVoiced).toBeLessThanOrEqual(0.1);
    expect(liveVoiced).toBeLessThanOrEqual(0.1);
  });

  it('note segmentation', () => {
    const dur = 11;
    const pcm = new Float32Array(dur * SR);
    // Repeated notes on purpose: each must count as its own onset.
    const notes = [64, 64, 67, 67, 67, 65, 64, 64, 62, 62, 60, 62, 64, 64, 64, 72, 71, 71, 69, 67, 67, 65, 64, 64, 62, 60, 60, 67, 67, 72];
    const truth = line(pcm, notes, 0.25, 0.2, 0.33);
    for (let i = 0; i < 4; i++) addTone(pcm, 0.2 + i * 2.5, 2.5, [48, 53, 55, 48][i], 0.25 * db(-12), held(2.5));
    const { off, m, ref } = evaluate(pcm, truth);
    const refOn = ref.map((n) => n.start);
    const offF1 = onsetF1(refOn, off.notes.map((n) => n.start), 0.05);
    const liveNotes: number[] = [];
    for (const f of m.frames) if (f.noteOn && f.note) liveNotes.push(f.note.start);
    const liveF1 = onsetF1(refOn, liveNotes, 0.05);
    expect(offF1.f1).toBeGreaterThanOrEqual(0.8);
    expect(liveF1.f1).toBeGreaterThanOrEqual(0.8);
  });

  it('stable under silence', () => {
    const pcm = new Float32Array(4 * SR);
    addTone(pcm, 0.1, 0.8, 69, 0.2, struck(0.8));
    const r = analyzeOffline(pcm, SR, { melody: true });
    const m = r.melody!;
    for (const s of m.salience) for (const v of s) expect(Number.isFinite(v)).toBe(true);
    const quiet = m.frames.filter((_, k) => r.times[k] > 2);
    expect(quiet.length).toBeGreaterThan(60);
    for (const f of quiet) expect(f.voiced).toBe(false);

    // Pure digital silence, straight into the tracker.
    const t = new MelodyTracker();
    const out = new Float32Array(SALIENCE_BINS);
    const zeros = new Float32Array(2048);
    salience(zeros, SR, 4096, out);
    for (const v of out) expect(v).toBe(0);
    for (let k = 0; k < 120; k++) {
      const f = t.update(zeros, SR, 4096, k / 60);
      expect(f.voiced).toBe(false);
      expect(f.salience).toBe(0);
      expect(f.note).toBeNull();
    }
    const off = extractMelody(m.salience, r.fps);
    expect(off.contour.length).toBe(m.salience.length);
    expect(MELODY_RANGE).toEqual([36, 96]);
  });
});
