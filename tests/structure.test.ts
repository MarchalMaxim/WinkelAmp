import { describe, expect, it } from 'vitest';
import { segment, type StructureRow } from '../src/audio/structure';

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
