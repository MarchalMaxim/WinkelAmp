import { describe, expect, it } from 'vitest';
import { advanceFeatures, knobValue, liveClock, newFeatures, resolveKnobs } from '../src/widgets/features';
import type { Chord, Features, Param, SoundingNote } from '../src/widgets/types';

const feat = (o: Partial<Features> = {}): Features => ({ ...newFeatures(), ...o });

describe('knobValue (the lab ctx.p)', () => {
  const q: Param = { key: 'k', min: 0, max: 2, value: 1 };
  it('a drive moves the base by depth·range·feature', () => {
    expect(knobValue(q, { base: 1, drive: '+level', depth: 0.5 }, feat({ level: 0.2 }))).toBeCloseTo(1.2, 12);
    expect(knobValue(q, { base: 1, drive: '+level', depth: 0.5 }, feat({ level: 1 }))).toBe(2);
  });
  it('pitch drives are centred on 0.5', () => {
    expect(knobValue(q, { base: 1, drive: '-pitch', depth: 0.5 }, feat({ pitch: 0.5 }))).toBe(1);
    expect(knobValue(q, { base: 1, drive: '-pitch', depth: 0.5 }, feat({ pitch: 1 }))).toBeCloseTo(1 - 0.25 * 2, 12);
  });
  it('fixed is the base, clamped', () => {
    expect(knobValue(q, { base: 1.5, drive: '', depth: 0.5 }, feat({ level: 1 }))).toBe(1.5);
    expect(knobValue(q, { base: 5, drive: '', depth: 0.5 }, feat())).toBe(2);
    expect(knobValue(q, { base: -1, drive: '', depth: 0.5 }, feat())).toBe(0);
  });
});

describe('resolveKnobs', () => {
  const params: Param[] = [{ key: 'a', min: 0, max: 1, value: 0.3 }, { key: 'b', min: 0, max: 10, value: 4, drive: '+rate' }];
  it('defaults are the lab PST defaults', () => {
    expect(resolveKnobs(params)).toEqual({ a: { base: 0.3, drive: '', depth: 0.5 }, b: { base: 4, drive: '+rate', depth: 0.5 } });
  });
  it('a number sets base, an object merges, unknown keys are ignored', () => {
    const k = resolveKnobs(params, { a: 0.9, b: { drive: '-rate' }, zzz: 3 });
    expect(k).toEqual({ a: { base: 0.9, drive: '', depth: 0.5 }, b: { base: 4, drive: '-rate', depth: 0.5 } });
  });
});

describe('advanceFeatures (the lab step arithmetic)', () => {
  const chord = (vel: number): Chord => ({ t: 0, notes: [{ m: 60, v: vel, d: 1 }], vel, lo: 60, hi: 60 });
  const snd = (...ms: [number, number][]): SoundingNote[] => ms.map(([m, v]) => ({ m, v, start: 0, end: 1 }));

  it('level halves in 0.8 s, rate in 1 s', () => {
    const p = { level: 0.5, rate: 1 }, f = feat();
    advanceFeatures(p, f, [], [], 0.8);
    expect(p.level).toBeCloseTo(0.25, 12);
    const p2 = { level: 0, rate: 1 };
    advanceFeatures(p2, feat(), [], [], 1);
    expect(p2.rate).toBeCloseTo(0.5, 12);
  });

  it('a chord sets level from its velocity and adds to rate', () => {
    const p = { level: 0, rate: 0 }, f = feat();
    advanceFeatures(p, f, [chord(115)], [], 0.01);
    expect(p.level).toBe(1);
    expect(p.rate).toBeCloseTo(1 / 1.44, 12);
    expect(f.level).toBe(1);
    expect(f.rate).toBeCloseTo(Math.min(1, 1 / 1.44 / 8), 12);
  });

  it('pitch, bass and density move halfway in 0.25 s', () => {
    const f = feat();
    advanceFeatures({ level: 0, rate: 0 }, f, [], snd([40, 127], [45, 127], [108, 60], [70, 60], [72, 60]), 0.25);
    expect(f.pitch).toBeCloseTo(0.5 + (1 - 0.5) * 0.5, 12);   // top 108 → 1
    expect(f.bass).toBeCloseTo(0.5, 12);                      // two m < 50 at 127 → target 1
    expect(f.density).toBeCloseTo(0.25, 12);                  // five sounding → target 0.5
  });

  it('nothing sounding: pitch holds', () => {
    const f = feat({ pitch: 0.8 });
    advanceFeatures({ level: 0, rate: 0 }, f, [], [], 0.25);
    expect(f.pitch).toBe(0.8);
  });
});

describe('liveClock', () => {
  it('jumps over 0.5 s reset, with dt 0', () => {
    expect(liveClock(10, 10.6, false)).toEqual({ reset: true, dt: 0 });
    expect(liveClock(10, 11, true)).toEqual({ reset: true, dt: 0 });
    expect(liveClock(10, 9, false)).toEqual({ reset: true, dt: 0 });
  });
  it('dt is the song time moved, at most 0.05, 0 when paused', () => {
    expect(liveClock(10, 10.02, false).dt).toBeCloseTo(0.02, 12);
    expect(liveClock(10, 10.02, false).reset).toBe(false);
    expect(liveClock(10, 10.2, false)).toEqual({ reset: false, dt: 0.05 });
    expect(liveClock(10, 10.02, true)).toEqual({ reset: false, dt: 0 });
    expect(liveClock(10, 9.9, false)).toEqual({ reset: false, dt: 0 });
  });
});
