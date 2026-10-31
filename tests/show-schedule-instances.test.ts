import { describe, expect, it } from 'vitest';
import { entriesBetween, scheduleAt } from '../src/studio/show/schedule';
import type { Show } from '../src/studio/show/show';
import type { Region } from '../src/widgets/types';

const spot = (x: number): Region => ({ mode: 'spot', shape: 'ellipse', x, y: 0.5, w: 0.3, h: 0.3 });
const win = (x: number): Region => ({ mode: 'window', shape: 'rect', x, y: 0.5, w: 0.3, h: 0.3 });

/** A [0,10] {strings@melody, strings@bassline}, B [10,20] {strings@melody with a region}, fade 2. */
const show = (o: { a?: Region; b?: Region; bassPivots?: boolean } = {}): Show => ({
  version: 2, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, layers: [
      { widget: 'strings', listen: 'melody', ...(o.a ? { region: o.a } : {}) },
      { widget: 'strings', listen: 'bassline', ...(o.bassPivots ? { intensity: [{ t: 2, v: 0.2 }, { t: 8, v: 1 }] } : {}) },
    ] },
    { start: 10, end: 20, fade: 2, layers: [{ widget: 'strings', listen: 'melody', region: o.b ?? spot(0.7) }] },
  ],
});

describe('scheduleAt with instances', () => {
  it('two instances of one widget in a section are two slots with distinct ids', () => {
    const s = scheduleAt(show(), 5);
    expect(s.map((w) => [w.id, w.widget, w.listen, w.receiving, w.weight])).toEqual([
      ['strings@melody', 'strings', 'melody', true, 1], ['strings@bassline', 'strings', 'bassline', true, 1],
    ]);
  });

  it('across the boundary: the bassline decays (until 10), the melody continues and receives', () => {
    const s = scheduleAt(show(), 10.5);
    expect(s.map((w) => [w.id, w.receiving])).toEqual([['strings@bassline', false], ['strings@melody', true]]);
    expect(s[0]).toMatchObject({ until: 10, section: 0 });
    expect(s[0].weight).toBeCloseTo((1 - 0.25) ** 2, 12);
    expect(s[1]).toMatchObject({ region: spot(0.7), section: 1 });
    expect(s[1].glide).toBeUndefined();   // A's melody had no region: the region cuts in
    expect(s[1].until).toBeUndefined();
  });

  it('a decaying instance carries its section\'s pivots', () => {
    const s = scheduleAt(show({ bassPivots: true }), 11);
    expect(s[0]).toMatchObject({ id: 'strings@bassline', pivots: [{ t: 2, v: 0.2 }, { t: 8, v: 1 }], until: 10 });
    expect(scheduleAt(show({ bassPivots: true }), 5)[1].pivots).toEqual([{ t: 2, v: 0.2 }, { t: 8, v: 1 }]);
    expect(scheduleAt(show(), 5)[1].pivots).toBeUndefined();
  });

  it('a moved spot glides over the fade: at 11, u = 0.5', () => {
    const sh = show({ a: spot(0.2), b: spot(0.7) });
    expect(scheduleAt(sh, 11)[1].glide).toEqual({ from: spot(0.2), u: 0.5 });
    expect(scheduleAt(sh, 10)[1].glide).toEqual({ from: spot(0.2), u: 0 });
    expect(scheduleAt(sh, 12).find((w) => w.id === 'strings@melody')!.glide).toBeUndefined();
    expect(scheduleAt(sh, 5)[0].region).toEqual(spot(0.2));
  });

  it('no glide when the mode changes, the region is the same, or the fade is 0', () => {
    expect(scheduleAt(show({ a: spot(0.2), b: win(0.7) }), 11)[1].glide).toBeUndefined();
    expect(scheduleAt(show({ a: spot(0.2), b: spot(0.2) }), 11)[1].glide).toBeUndefined();
    const cut = show({ a: spot(0.2), b: spot(0.7) });
    cut.sections[1].fade = 0;
    expect(scheduleAt(cut, 10.5).find((w) => w.id === 'strings@melody')!.glide).toBeUndefined();
  });

  it('a v1 layer has no listen, region, pivots or glide fields', () => {
    const v1: Show = { version: 1, id: 'demo', song: 'demo', sections: [
      { start: 0, end: 10, layers: [{ widget: 'squares' }] }, { start: 10, end: 20, layers: [{ widget: 'casket' }] }] };
    for (const w of scheduleAt(v1, 11)) {
      for (const k of ['listen', 'region', 'pivots', 'glide']) expect(k in w).toBe(false);
    }
  });
});

describe('entriesBetween with instances', () => {
  it('a continuing instance does not enter; a new part of the same widget does', () => {
    expect(entriesBetween(show(), 9.9, 10.1)).toEqual([]);
    const s = show();
    s.sections[1].layers.push({ widget: 'strings', listen: 'inner' }, { widget: 'strings' });
    expect(entriesBetween(s, 9.9, 10.1)).toEqual([{ id: 'strings@inner', at: 10 }, { id: 'strings', at: 10 }]);
  });
});
