import { describe, expect, it } from 'vitest';
import { ChangeDetector, findDrops, segment, type StructureRow } from '../src/audio/structure';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jitter = (amp: number) => (rnd() * 2 - 1) * amp;

/** A scale's chroma: tonic triad strong, other scale tones medium, the rest faint. */
function scaleChroma(tonic: number, minor: boolean): number[] {
  const steps = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const triad = minor ? [0, 3, 7] : [0, 4, 7];
  const c = new Array(12).fill(0.05);
  for (const s of steps) c[(tonic + s) % 12] = 0.4;
  for (const s of triad) c[(tonic + s) % 12] = 1;
  return c;
}

type State = Omit<StructureRow, 'chroma'> & { chroma: number[] };
const C_QUIET_LEGATO: State = { chroma: scaleChroma(0, false), loudness: 0.25, register: 0.45, brightness: 0.3, onsetRate: 0.1, sustain: 0.8 };
const FS_LOUD_STACCATO: State = { chroma: scaleChroma(6, true), loudness: 0.8, register: 0.6, brightness: 0.6, onsetRate: 0.7, sustain: 0.2 };

/** One row of `s` with ±`amp` noise on every value. */
function row(s: State, amp = 0.03): StructureRow {
  const n = (v: number) => Math.min(1, Math.max(0, v + jitter(amp)));
  return {
    chroma: s.chroma.map(n), loudness: n(s.loudness), register: n(s.register), brightness: n(s.brightness),
    onsetRate: n(s.onsetRate), sustain: n(s.sustain),
  };
}

/** Rows every `hop` seconds for `seconds`, the state chosen by time. */
function rows(seconds: number, hop: number, at: (t: number) => State, amp?: number): StructureRow[] {
  return Array.from({ length: Math.round(seconds / hop) }, (_, i) => row(at(i * hop), amp));
}

const boundaries = (s: { start: number }[]) => s.slice(1).map((x) => x.start);

describe('segment', () => {
  it('finds a key/texture change', () => {
    const r = rows(60, 0.5, (t) => (t < 30 ? C_QUIET_LEGATO : FS_LOUD_STACCATO));
    const s = segment(r, 0.5);
    const b = boundaries(s);
    expect(b).toHaveLength(1);
    expect(Math.abs(b[0] - 30)).toBeLessThanOrEqual(2);
    expect(s[0].start).toBe(0);
    expect(s[1].end).toBeCloseTo(60, 6);
    expect(s[1].novelty).toBeGreaterThan(0.5);
  });

  it('finds the change from 60 Hz rows too', () => {
    const b = boundaries(segment(rows(60, 1 / 60, (t) => (t < 30 ? C_QUIET_LEGATO : FS_LOUD_STACCATO)), 1 / 60));
    expect(b).toHaveLength(1);
    expect(Math.abs(b[0] - 30)).toBeLessThanOrEqual(2);
  });

  it('no boundaries in steady music', () => {
    const s = segment(rows(60, 0.5, () => C_QUIET_LEGATO), 0.5);
    expect(boundaries(s)).toHaveLength(0);
    expect(s).toEqual([{ start: 0, end: 60, novelty: 0 }]);
  });

  it('min section length respected', () => {
    const b = boundaries(segment(rows(90, 0.5, (t) => (Math.floor(t / 3) % 2 ? FS_LOUD_STACCATO : C_QUIET_LEGATO)), 0.5));
    expect(b.length).toBeGreaterThan(2);
    for (let i = 1; i < b.length; i++) expect(b[i] - b[i - 1]).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(b[0]).toBeGreaterThanOrEqual(6);
    expect(90 - b[b.length - 1]).toBeGreaterThanOrEqual(6);
  });
});

describe('findDrops', () => {
  const hop = 1 / 60;
  const signal = (seconds: number, at: (t: number) => number) =>
    Float32Array.from({ length: Math.round(seconds / hop) }, (_, i) => at(i * hop));

  it('finds a drop', () => {
    const d = findDrops(signal(40, (t) => (t < 20 ? 0.1 : 0.8)), hop);
    expect(d).toHaveLength(1);
    expect(Math.abs(d[0].time - 20)).toBeLessThanOrEqual(0.5);
    expect(d[0].strength).toBeGreaterThan(0.5);
    expect(d[0].strength).toBeLessThanOrEqual(1);
    // Steady kicks: a punch every 0.5 s, or the bass alternating 0.7 / 0.2 every 0.5 s.
    expect(findDrops(signal(40, (t) => (t % 0.5 < 0.15 ? 0.7 : 0.2)), hop)).toHaveLength(0);
    expect(findDrops(signal(40, (t) => (Math.floor(t / 0.5) % 2 ? 0.2 : 0.7)), hop)).toHaveLength(0);
  });
});

describe('ChangeDetector', () => {
  /** Feeds 60 Hz frames; returns the events with their times. */
  function run(det: ChangeDetector, seconds: number, at: (t: number) => { s: State; bass: number }, t0 = 0) {
    const out: { time: number; kind: string; strength: number }[] = [];
    for (let i = 0; i < seconds * 60; i++) {
      const t = t0 + i / 60;
      const { s, bass } = at(t);
      const e = det.update(row(s), bass, t);
      if (e) out.push({ time: t, ...e });
    }
    return out;
  }

  it('live detector min gap', () => {
    const ev = run(new ChangeDetector(), 90, (t) => ({ s: Math.floor(t / 5) % 2 ? FS_LOUD_STACCATO : C_QUIET_LEGATO, bass: 0.3 }));
    expect(ev.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ev.length; i++) expect(ev[i].time - ev[i - 1].time).toBeGreaterThanOrEqual(15);
  });

  it('live detector: one section on a change, a drop pre-empts it, nothing in steady music', () => {
    const det = new ChangeDetector();
    expect(run(det, 40, () => ({ s: C_QUIET_LEGATO, bass: 0.2 }))).toHaveLength(0);
    const sec = run(det, 40, (t) => ({ s: t < 60 ? C_QUIET_LEGATO : FS_LOUD_STACCATO, bass: 0.2 }), 40);
    expect(sec.map((e) => e.kind)).toEqual(['section']);
    expect(sec[0].time).toBeGreaterThan(60);
    expect(sec[0].time).toBeLessThan(64);

    // A seek back resets: the same change with the bass coming in hard is a drop, reported at once.
    const drop = run(det, 40, (t) => (t < 20 ? { s: C_QUIET_LEGATO, bass: 0.1 } : { s: FS_LOUD_STACCATO, bass: 0.8 }));
    expect(drop.map((e) => e.kind)).toEqual(['drop']);
    expect(drop[0].time - 20).toBeLessThan(0.5);
    expect(drop[0].time - 20).toBeGreaterThanOrEqual(0);
  });
});
