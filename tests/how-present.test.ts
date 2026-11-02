/// <reference types="node" />
// How present writes the widget's other knobs (lab/layers/present.js). The show keeps ordinary knob values.
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

describe('an old knob', () => {
  const q = knob({ key: 'presence', value: 1, old: true });
  it('stays off the card at its default, and shows as soon as a scene has moved it', () => {
    expect(WA.oldHidden(q, { base: 1, drive: '', depth: 0.5 })).toBe(true);
    expect(WA.oldHidden(q, { base: 0.4, drive: '', depth: 0.5 })).toBe(false);
    expect(WA.oldHidden(q, { base: 1, drive: '+level', depth: 0.5 })).toBe(false);
    expect(WA.oldHidden({ ...q, old: false }, { base: 1, drive: '', depth: 0.5 })).toBe(false);
  });
});

describe('in the studio', () => {
  const how = knob({ key: 'howmuch', value: 1 });
  const params = [knob({ key: 'a', less: 0.1 }), knob({ key: 'b', less: 0.2, value: 0.4 }), knob({ key: 'free' }), how];
  const at = (s: number, now?: Record<string, KnobSetting>) => Object.fromEntries(knobWrites(params, how, { base: s, drive: '', depth: 0.5 }, now).map((w) => [w.key, w.value]));

  it('overwrites a hand-set knob, keeps its drive, and leaves a knob that does not follow', () => {
    expect(at(0, { a: 0.9, b: { base: 0.3, drive: '+level' }, free: 0.7 })).toEqual({ howmuch: 0, a: 0.1, b: { base: 0.2, drive: '+level' } });
  });
  it('clears them all at the right end', () => {
    expect(at(1, { howmuch: 0.2, a: 0.1, b: 0.2 })).toEqual({ howmuch: null, a: null, b: null });
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
      const followers = m.params.filter((q) => typeof q.less === 'number'), how = m.params.find((q) => q.key === 'howmuch');
      if (how) {
        expect(followers.length, `${m.id}: a slider with nothing to move`).toBeGreaterThan(0);
        expect([how.min, how.max, how.value, how.label], m.id).toEqual([0, 1, 1, 'how present']);
        expect(how.drive ?? '', m.id).toBe('');
        expect(how.less, m.id).toBeUndefined();
        const old = m.params.find((q) => q.key === 'presence');
        if (old) expect(old.old, `${m.id}: two sliders called how present`).toBe(true);
      } else expect(followers, m.id).toEqual([]);
      for (const q of followers) {
        expect(q.less, `${m.id}.${q.key}`).toBeGreaterThanOrEqual(q.min);
        expect(q.less, `${m.id}.${q.key}`).toBeLessThanOrEqual(q.max);
        expect(q.less, `${m.id}.${q.key}`).not.toBe(q.value);
        expect(q.old, `${m.id}.${q.key}`).toBeFalsy();
      }
    }
  });
  it('at the right end every knob is where the widget always had it', () => {
    for (const m of list) for (const [key, v] of Object.entries(WA.presentValues(m.params, 1))) expect(v, `${m.id}.${key}`).toBe(m.params.find((q) => q.key === key)!.value);
  });
});
