/// <reference types="node" />
// How present writes the widget's other knobs (lab/layers/present.js). The show keeps ordinary knob values.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { loadCatalogue } from '../scripts/node/catalogue';
import type { KnobSetting } from '../src/studio/show/show';
import { knobWrites } from '../src/studio/ui/how-present';
import type { Param } from '../src/widgets/types';

const WA = loadLayers();
const knob = (over: Partial<Param>): Param => ({ key: 'k', min: 0, max: 1, value: 0.5, ...over });

describe('presentValues', () => {
  const params = [knob({ key: 'a', less: 0.1 }), knob({ key: 'n', min: 4, max: 60, value: 22, step: 1, less: 4 }), knob({ key: 'free' }),
    knob({ key: 'rarer', value: 0.8, less: 0.97 })];

  it('gives the knob its own value at the right end, whatever the arithmetic would round to', () => {
    expect(WA.presentValues(params, 1)).toEqual({ a: 0.5, n: 22, rarer: 0.8 });
  });
  it('gives `less` at the left end, and leaves alone a knob that declares none', () => {
    expect(WA.presentValues(params, 0)).toEqual({ a: 0.1, n: 4, rarer: 0.97 });
  });
  it('goes straight between them, either way up, and a count stays whole', () => {
    const v = WA.presentValues(params, 0.5);
    expect(v.a).toBeCloseTo(0.3, 6);
    expect(v.rarer).toBeCloseTo(0.885, 6);
    expect(v.n).toBe(13);
    for (let s = 0; s <= 1; s += 0.01) expect(Number.isInteger(WA.presentValues(params, s).n)).toBe(true);
  });
  it('holds outside 0..1 and has nothing to say without params', () => {
    expect(WA.presentValues(params, 3)).toEqual(WA.presentValues(params, 1));
    expect(WA.presentValues(params, NaN)).toEqual(WA.presentValues(params, 0));
    expect(WA.presentValues(undefined, 0.5)).toEqual({});
  });
});

describe('in the studio', () => {
  const how = knob({ key: 'presence', value: 1, leads: true });
  const params = [knob({ key: 'a', less: 0.1 }), knob({ key: 'b', less: 0.2, value: 0.4 }), knob({ key: 'free' }), how];
  const at = (s: number, now?: Record<string, KnobSetting>) => Object.fromEntries(knobWrites(params, how, { base: s, drive: '', depth: 0.5 }, now).map((w) => [w.key, w.value]));

  it('overwrites a hand-set knob, keeps its drive, and leaves a knob that does not follow', () => {
    expect(at(0, { a: 0.9, b: { base: 0.3, drive: '+level' }, free: 0.7 })).toEqual({ presence: 0, a: 0.1, b: { base: 0.2, drive: '+level' } });
  });
  it('clears them all at the right end', () => {
    expect(at(1, { presence: 0.2, a: 0.1, b: 0.2 })).toEqual({ presence: null, a: null, b: null });
  });
  it('an ordinary knob writes only itself', () => {
    expect(knobWrites(params, params[0], { base: 0.7, drive: '', depth: 0.5 }, undefined)).toEqual([{ key: 'a', value: 0.7 }]);
  });
});

describe('the widgets', () => {
  const { widgets } = loadCatalogue();
  const list = [...widgets.values()];

  it('a follower is in range, moves, and belongs to a widget with the slider', () => {
    for (const m of list) {
      const followers = m.params.filter((q) => typeof q.less === 'number'), how = m.params.filter((q) => q.leads);
      expect(how.length, `${m.id}: one slider leads, and only with knobs to move`).toBe(followers.length ? 1 : 0);
      if (how[0]) {
        expect([how[0].key, how[0].min, how[0].max, how[0].value, how[0].label], m.id).toEqual(['presence', 0, 1, 1, 'how present']);
        expect(how[0].drive ?? '', m.id).toBe('');
        expect(how[0].less, m.id).toBeUndefined();
      }
      for (const q of followers) {
        expect(q.less, `${m.id}.${q.key}`).toBeGreaterThanOrEqual(q.min);
        expect(q.less, `${m.id}.${q.key}`).toBeLessThanOrEqual(q.max);
        expect(q.less, `${m.id}.${q.key}`).not.toBe(q.value);
      }
    }
  });
  it('a widget with the slider never reads it: all it does is move the other knobs', () => {
    for (const m of list) if (m.params.some((q) => q.leads)) expect(readFileSync(new URL(`../lab/tools/${m.id}.js`, import.meta.url), 'utf8'), m.id).not.toMatch(/\bp\(\s*'presence'/);
  });
  it('at the right end every knob is where the widget always had it', () => {
    for (const m of list) for (const [key, v] of Object.entries(WA.presentValues(m.params, 1))) expect(v, `${m.id}.${key}`).toBe(m.params.find((q) => q.key === key)!.value);
  });
});

describe('how present on the graph', () => {
  const params = [knob({ key: 'presence', value: 1, leads: true }), knob({ key: 'a', less: 0.1 }), knob({ key: 'n', min: 4, max: 60, value: 22, step: 1, less: 4 }),
    knob({ key: 'rarer', value: 0.8, less: 0.97 }), knob({ key: 'free' })];

  it('at the top of the graph every knob is as it is set, hand-set or not', () => {
    expect(WA.presentAt(params, { a: 0.9, n: 30 }, 1)).toEqual({ a: 0.9, n: 30, rarer: 0.8 });
  });
  it('at the bottom it makes the least, and a knob that does not follow stays out of it', () => {
    expect(WA.presentAt(params, { free: 0.7 }, 0)).toEqual({ a: 0.1, n: 4, rarer: 0.97 });
  });
  it('between them a knob goes from its least to where it is set: the slider is the ceiling, the graph a share of it', () => {
    const set = WA.presentValues(params, 0.8), v = WA.presentAt(params, set, 0.5), same = WA.presentValues(params, 0.4);
    expect(v.a).toBeCloseTo(same.a, 6);
    expect(v.rarer).toBeCloseTo(same.rarer, 6);
    expect(WA.presentAt(params, { a: 0.9 }, 0.5).a).toBeCloseTo(0.5, 6);
    for (let g = 0; g <= 1; g += 0.01) expect(Number.isInteger(WA.presentAt(params, {}, g).n)).toBe(true);
  });
  it('a knob set beyond its least holds: a falling graph never makes more', () => {
    expect(WA.presentAt(params, { a: 0.05, rarer: 0.99 }, 0)).toMatchObject({ a: 0.05, rarer: 0.99 });
  });
  it('a slider the widget reads itself is what moves, from where it is set down to 0', () => {
    const plain = [knob({ key: 'presence', value: 0.7 }), knob({ key: 'free' })];
    expect(WA.presentAt(plain, {}, 1)).toEqual({ presence: 0.7 });
    expect(WA.presentAt(plain, {}, 0.5).presence).toBeCloseTo(0.35, 6);
    expect(WA.presentAt(plain, { presence: 0.4 }, 0)).toEqual({ presence: 0 });
  });
  it('a widget with no slider has nothing to move', () => {
    expect(WA.presentAt([knob({ key: 'free' })], {}, 0.5)).toEqual({});
  });
  it('every widget with a slider moves something on the graph', () => {
    for (const m of loadCatalogue().widgets.values()) if (m.params.some((q) => q.key === 'presence')) expect(Object.keys(WA.presentAt(m.params, {}, 0.5)).length, m.id).toBeGreaterThan(0);
  });
});
