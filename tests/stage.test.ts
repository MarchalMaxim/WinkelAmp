import { describe, expect, it } from 'vitest';
import { chordOf, chordRgb } from '../src/stage/elements/bloom';
import { pitchHeight } from '../src/stage/elements/melody';
import { trigger } from '../src/stage/elements/wave';
import { ELEMENTS } from '../src/stage/elements';
import { ease, parseColor, regionRect, styleOf } from '../src/stage/gl';
import { reconcile } from '../src/stage/stage';
import { normalizeSpec } from '../src/stage/script';
import { type CastMember, type ElementType, STYLES } from '../src/stage/types';

const member = (id: string, type: ElementType): CastMember => ({ spec: normalizeSpec({ id, type }), presence: 1 });

describe('stage cast reconcile', () => {
  it('creates new ids and drops ids no longer cast', () => {
    const live = new Map<string, ElementType>([['a', 'melody'], ['b', 'bass']]);
    const r = reconcile(live, [member('a', 'melody'), member('c', 'sparks')]);
    expect(r.drop).toEqual(['b']);
    expect(r.create.map((m) => m.spec.id)).toEqual(['c']);
  });
  it('recreates an id whose type changed', () => {
    const r = reconcile(new Map([['x', 'melody']]), [member('x', 'wave')]);
    expect(r.drop).toEqual(['x']);
    expect(r.create.map((m) => `${m.spec.id}:${m.spec.type}`)).toEqual(['x:wave']);
  });
  it('keeps an instance at presence 0 (fading out keeps its state)', () => {
    const r = reconcile(new Map([['x', 'melody']]), [{ ...member('x', 'melody'), presence: 0 }]);
    expect(r).toEqual({ create: [], drop: [] });
  });
  it('creates a duplicated id once', () => {
    const r = reconcile(new Map(), [member('x', 'melody'), member('x', 'melody')]);
    expect(r.create).toHaveLength(1);
  });
});

describe('element registry', () => {
  it('has a factory for every element type, producing that type', () => {
    for (const type of Object.keys(STYLES) as ElementType[]) expect(ELEMENTS[type]().type).toBe(type);
  });
});

describe('chord reading', () => {
  const chroma = (tones: number[], rest = 0.05) => {
    const c = new Float32Array(12).fill(rest);
    tones.forEach((t, i) => (c[t] = [1, 0.8, 0.85][i]));
    return c;
  };
  it('names major and minor triads', () => {
    expect(chordOf(chroma([0, 4, 7]))).toEqual({ root: 0, minor: false });
    expect(chordOf(chroma([9, 0, 4]))).toEqual({ root: 9, minor: true });
    expect(chordOf(chroma([7, 11, 2]))).toEqual({ root: 7, minor: false });
  });
  it('names nothing in silence or noise (the caller keeps its chord)', () => {
    expect(chordOf(new Float32Array(12))).toBeNull();
    expect(chordOf(new Float32Array(12).fill(1))).toBeNull();
    expect(chordOf(new Float32Array(12).fill(NaN))).toBeNull();
  });
  it('colors minor chords cooler than their major', () => {
    const blue = (c: number[]) => c[2] / (c[0] + c[1] + c[2]);
    for (const root of [0, 2, 7]) expect(blue(chordRgb({ root, minor: true }))).toBeGreaterThan(blue(chordRgb({ root, minor: false })));
  });
});

describe('stage helpers', () => {
  it('maps pitch over the melody range, clamped', () => {
    expect(pitchHeight(36)).toBe(0);
    expect(pitchHeight(66)).toBeCloseTo(0.5);
    expect(pitchHeight(96)).toBe(1);
    expect(pitchHeight(120)).toBe(1);
  });
  it('freezes eased values when no music time passes', () => {
    expect(ease(0.3, 1, 0, 0.1)).toBe(0.3);
    expect(ease(0.3, 1, 1, 0.1)).toBeCloseTo(1, 3);
  });
  it('parses #rgb and #rrggbb to linear RGB', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1]);
    expect(parseColor('#000000')).toEqual([0, 0, 0]);
    expect(parseColor('#ff0000')![0]).toBe(1);
    expect(parseColor('mood')).toBeNull();
  });
  it('places regions with y up', () => {
    expect(regionRect('bottom')).toEqual([0, 0, 1, 0.5]);
    expect(regionRect('top')).toEqual([0, 0.5, 1, 1]);
    expect(regionRect('full')).toEqual([0, 0, 1, 1]);
  });
  it('falls back to the first style', () => {
    expect(styleOf('', STYLES.melody)).toBe('ribbon');
    expect(styleOf('nope', STYLES.pulse)).toBe('rings');
    expect(styleOf('beads', STYLES.melody)).toBe('beads');
  });
  it('triggers the scope on a rising zero crossing', () => {
    const w = new Float32Array(2048).map((_, i) => Math.sin(((i - 100) / 64) * Math.PI * 2));
    const i = trigger(w);
    expect(w[i - 1]).toBeLessThan(0);
    expect(w[i]).toBeGreaterThanOrEqual(0);
    expect(trigger(new Float32Array(2048))).toBe(0);
  });
});
