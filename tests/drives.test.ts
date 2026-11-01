import { describe, expect, it } from 'vitest';
import { DRIVES, FeatureTracker, type Knob, knobValue, NEUTRAL_FEAT, type FeatureInput, type MusicFeat } from '../src/stage/kit';

const knob: Knob = { name: 'fade', min: 0, max: 2, value: 1, doc: 'test' };
const feat = (f: Partial<MusicFeat>): MusicFeat => ({ ...NEUTRAL_FEAT, ...f });

describe('knobValue (a knob modulated by its drive)', () => {
  it('is the default when nothing is set and the knob is fixed', () => {
    expect(knobValue(knob, undefined, feat({ level: 1, rate: 1 }))).toBe(1);
  });

  it('a number in the script sets the base value', () => {
    expect(knobValue(knob, 0.4, feat({ level: 1 }))).toBe(0.4);
  });

  it('a drive moves the value by depth × range × feature, up or down', () => {
    // depth 0.5 (default) × range 2 × level 0.6 = 0.6
    expect(knobValue(knob, { drive: '+level' }, feat({ level: 0.6 }))).toBeCloseTo(1.6);
    expect(knobValue(knob, { drive: '-level' }, feat({ level: 0.6 }))).toBeCloseTo(0.4);
    expect(knobValue(knob, { value: 0.5, drive: '+rate', depth: 0.25 }, feat({ rate: 1 }))).toBeCloseTo(1);
  });

  it('pitch drives around the middle (0.5 is no change)', () => {
    expect(knobValue(knob, { drive: '+pitch' }, feat({ pitch: 0.5 }))).toBeCloseTo(1);
    expect(knobValue(knob, { drive: '+pitch' }, feat({ pitch: 1 }))).toBeCloseTo(1.5);
    expect(knobValue(knob, { drive: '-pitch' }, feat({ pitch: 0 }))).toBeCloseTo(1.5);
  });

  it('is clamped to the knob range', () => {
    expect(knobValue(knob, { value: 1.9, drive: '+bass', depth: 1 }, feat({ bass: 1 }))).toBe(2);
    expect(knobValue(knob, { value: 0.1, drive: '-density', depth: 1 }, feat({ density: 1 }))).toBe(0);
  });

  it("the knob's own default drive applies until the script overrides it", () => {
    const driven: Knob = { ...knob, drive: '+level' };
    expect(knobValue(driven, undefined, feat({ level: 1 }))).toBeCloseTo(2);
    expect(knobValue(driven, { drive: '' }, feat({ level: 1 }))).toBe(1);
  });

  it('survives garbage features', () => {
    expect(knobValue(knob, { drive: '+level' }, feat({ level: NaN }))).toBe(1);
  });

  it('lists every feature both ways, plus fixed', () => {
    expect(DRIVES).toHaveLength(11);
    expect(DRIVES[0]).toBe('');
  });
});

const input = (o: Partial<FeatureInput> = {}): FeatureInput => ({
  events: [],
  melody: { pitch: NaN, voiced: false, salience: 0, note: null, noteOn: false },
  chroma: new Float32Array(12),
  bass: 0,
  loudness: 0,
  silence: 0,
  ...o,
});
const onset = (strength: number, height = 0.5) => ({ height, pan: 0, strength, note: 0, color: [1, 1, 1] as [number, number, number], onset: true });

describe('FeatureTracker (the five music features, on music time)', () => {
  it('starts neutral', () => {
    expect(new FeatureTracker().feat).toEqual(NEUTRAL_FEAT);
  });

  it('level jumps to an attack and halves in 0.8 music seconds', () => {
    const t = new FeatureTracker();
    t.update(input({ events: [onset(0.9)] }), 1 / 60);
    expect(t.feat.level).toBeCloseTo(0.9);
    for (let i = 0; i < 48; i++) t.update(input(), 1 / 60);
    expect(t.feat.level).toBeCloseTo(0.45, 2);
  });

  it('level never sits below the loudness', () => {
    const t = new FeatureTracker();
    t.update(input({ loudness: 0.6 }), 1 / 60);
    expect(t.feat.level).toBeCloseTo(0.6);
  });

  it('rate counts attacks per second over 8', () => {
    const t = new FeatureTracker();
    // 4 attacks a second for 10 s → about 4/8.
    for (let i = 0; i < 600; i++) t.update(input({ events: i % 15 === 0 ? [onset(0.5)] : [] }), 1 / 60);
    expect(t.feat.rate).toBeGreaterThan(0.4);
    expect(t.feat.rate).toBeLessThan(0.6);
  });

  it('pitch follows the highest note heard and holds it when nothing sounds', () => {
    const t = new FeatureTracker();
    for (let i = 0; i < 120; i++) t.update(input({ events: [onset(0.5, 0.2), onset(0.5, 0.9)] }), 1 / 60);
    expect(t.feat.pitch).toBeCloseTo(0.9, 2);
    for (let i = 0; i < 120; i++) t.update(input(), 1 / 60);
    expect(t.feat.pitch).toBeCloseTo(0.9, 2);
  });

  it('pitch also follows a voiced melody', () => {
    const t = new FeatureTracker();
    for (let i = 0; i < 120; i++) t.update(input({ melody: { pitch: 96, voiced: true, salience: 1, note: null, noteOn: false } }), 1 / 60);
    expect(t.feat.pitch).toBeGreaterThan(0.8);
  });

  it('bass follows the bass level, density the pitch classes sounding', () => {
    const t = new FeatureTracker();
    const chroma = new Float32Array(12);
    chroma[0] = chroma[4] = chroma[7] = 1;
    for (let i = 0; i < 120; i++) t.update(input({ bass: 0.8, chroma }), 1 / 60);
    expect(t.feat.bass).toBeCloseTo(0.8, 2);
    expect(t.feat.density).toBeCloseTo(0.5, 2);
  });

  it('holds every feature exactly while music time stands still', () => {
    const t = new FeatureTracker();
    for (let i = 0; i < 30; i++) t.update(input({ events: [onset(0.8, 0.7)], bass: 0.5, loudness: 0.3 }), 1 / 60);
    const before = { ...t.feat };
    for (let i = 0; i < 120; i++) t.update(input({ events: [onset(1, 1)], bass: 1, loudness: 1, chroma: new Float32Array(12).fill(1) }), 0);
    expect(t.feat).toEqual(before);
  });

  it('every feature stays in 0..1 and finite on garbage input', () => {
    const t = new FeatureTracker();
    t.update(input({ events: [onset(NaN, NaN), onset(5, 5)], bass: NaN, loudness: Infinity, chroma: new Float32Array(12).fill(NaN) }), 1 / 60);
    for (const v of Object.values(t.feat)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('reset goes back to neutral', () => {
    const t = new FeatureTracker();
    t.update(input({ events: [onset(1)] }), 1 / 60);
    t.reset();
    expect(t.feat).toEqual(NEUTRAL_FEAT);
  });
});
