/// <reference types="node" />
// How present writes the widget's other knobs (lab/layers/present.js). The show keeps ordinary knob values.
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { loadCatalogue } from '../scripts/node/catalogue';
import { applyEdit } from '../src/studio/show/edit';
import { validateShow, type Show } from '../src/studio/show/show';
import { presentEdit } from '../src/studio/ui/knobs';
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
  const params = [knob({ key: 'a', less: 0.1 }), knob({ key: 'b', less: 0.2, value: 0.4 }), how];
  const show = (knobs?: Show['sections'][number]['layers'][number]['knobs']) =>
    ({ sections: [{ start: 0, end: 10, layers: [{ widget: 'w', ...(knobs ? { knobs } : {}) }] }] }) as unknown as Show;
  const layerAfter = (s: Show, values: ReturnType<typeof presentEdit>) => applyEdit(s, { kind: 'setKnobs', section: 0, layer: 0, values }).sections[0].layers[0];

  it('overwrites a hand-set knob, keeps its drive, and writes a real value for each follower', () => {
    const cur = { a: 0.9, b: { base: 0.3, drive: '+level' as const } };
    const v = presentEdit(params, how, { base: 0, drive: '', depth: 0.5 }, cur, WA.presentValues(params, 0));
    const l = layerAfter(show(cur), v);
    expect(l.knobs).toEqual({ howmuch: 0, a: 0.1, b: { base: 0.2, drive: '+level' } });
  });
  it('leaves nothing in the show at the right end', () => {
    const v = presentEdit(params, how, { base: 1, drive: '', depth: 0.5 }, { howmuch: 0.2, a: 0.1, b: 0.2 }, WA.presentValues(params, 1));
    expect(layerAfter(show({ howmuch: 0.2, a: 0.1, b: 0.2 }), v).knobs).toBeUndefined();
  });
});

describe('the widgets', () => {
  const { widgets } = loadCatalogue();
  const warned = (knobs: Record<string, number>) => validateShow({ version: 1, id: 's', song: 's', sections: [{ start: 0, end: 10, layers: [{ widget: 'vine', knobs }] }] },
    { widgets }).warnings.filter((w) => w.path.endsWith('knobs.howmuch'));

  it('check-show says so when a file sets how present and none of what follows it', () => {
    expect(warned({ howmuch: 0.3 })).toHaveLength(1);
    expect(warned({ howmuch: 0.3, branch: 0.1 })).toEqual([]);
    expect(warned({ howmuch: 1 })).toEqual([]);
  });
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
