/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { applyEdit, editGroup, type EditEnv, type ShowEdit } from '../src/studio/show/edit';
import { MAX_PIVOTS, instanceKey, validateShow, type Show } from '../src/studio/show/show';
import { Store } from '../src/studio/ui/store';
import type { SongPack } from '../src/studio/pack/pack';
import type { Pivot } from '../src/widgets/types';

const env: EditEnv = { curve: loadLayers().automationAt };
const curve = env.curve;

/** Two sections; the same strings instance in both, a squares only in the first. Frozen: edits must not mutate. */
const make = (a?: Pivot[], b?: Pivot[], split = 10): Show => deepFreeze({
  version: 2, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: split, layers: [{ widget: 'strings', ...(a ? { intensity: a } : {}) }, { widget: 'squares' }] },
    { start: split, end: 20, fade: 2, layers: [{ widget: 'strings', ...(b ? { intensity: b } : {}) }] },
  ],
});
function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}
const edit = (s: Show, e: ShowEdit) => {
  const out = applyEdit(s, e, env);
  expect(validateShow(out).errors).toEqual([]);
  return out;
};
const piv = (s: Show, i: number, j = 0) => s.sections[i].layers[j].intensity;
/** The curve a section shows over [a, b], sampled. */
const samples = (p: readonly Pivot[] | undefined, a: number, b: number, n = 200) =>
  Array.from({ length: n + 1 }, (_, i) => curve(p, a + ((b - a) * i) / n));
const close = (xs: number[], ys: number[]) => { expect(xs.length).toBe(ys.length); xs.forEach((x, i) => expect(x).toBeCloseTo(ys[i], 9)); };

describe('setLayer', () => {
  const S = make();

  it('listen changes the instance key; refused when that key is already in the section', () => {
    const s = edit(S, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'melody' } });
    expect(instanceKey(s.sections[0].layers[0])).toBe('strings@melody');
    expect(s.sections[1]).toBe(S.sections[1]);
    const two = edit(s, { kind: 'addLayer', section: 0, widget: 'strings' });   // plain strings next to strings@melody
    expect(two.sections[0].layers.map(instanceKey)).toEqual(['strings@melody', 'squares', 'strings']);
    expect(applyEdit(two, { kind: 'setLayer', section: 0, layer: 2, patch: { listen: 'melody' } }, env)).toBe(two);
    expect(applyEdit(two, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: null } }, env)).toBe(two);
    expect(applyEdit(S, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'drums' } }, env)).toBe(S);
  });

  it('null (and listen all) removes a field; setting what is there changes nothing', () => {
    const s = edit(S, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'bassline', region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.3, h: 0.3 }, intensity: [{ t: 1, v: 1 }] } });
    expect(Object.keys(s.sections[0].layers[0])).toEqual(['widget', 'listen', 'region', 'intensity']);
    const back = edit(s, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'all', region: null, intensity: null } });
    expect(back.sections[0].layers[0]).toEqual({ widget: 'strings' });
    expect(applyEdit(back, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: null, region: null } }, env)).toBe(back);
    expect(applyEdit(s, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'bassline' } }, env)).toBe(s);
  });

  it('a region is repaired (sizes clamped) and refused when it cannot be one', () => {
    const s = edit(S, { kind: 'setLayer', section: 0, layer: 0, patch: { region: { mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w: 5, h: 0.3, rot: 270 } } });
    expect(s.sections[0].layers[0].region).toEqual({ mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w: 2, h: 0.3, rot: -90 });
    expect(applyEdit(S, { kind: 'setLayer', section: 0, layer: 0, patch: { region: { mode: 'clip' } as never } }, env)).toBe(S);
  });

  it('intensity is sorted, clamped (v to 0..1, t to the section) and capped', () => {
    const s = edit(S, { kind: 'setLayer', section: 1, layer: 0, patch: { intensity: [{ t: 30, v: 2 }, { t: 15, v: 0.5 }, { t: 5, v: -1 }] } });
    expect(piv(s, 1)).toEqual([{ t: 10, v: 0 }, { t: 15, v: 0.5 }, { t: 20, v: 1 }]);
    const many = Array.from({ length: 300 }, (_, i) => ({ t: 10 + i / 30, v: (i % 2) }));
    expect(piv(edit(S, { kind: 'setLayer', section: 1, layer: 0, patch: { intensity: many } }), 1)).toHaveLength(MAX_PIVOTS);
    expect(piv(edit(S, { kind: 'setLayer', section: 1, layer: 0, patch: { intensity: [] } }), 1)).toBeUndefined();
  });

  it('a region or intensity edit has its own undo group', () => {
    expect(editGroup({ kind: 'setLayer', section: 1, layer: 2, patch: { intensity: [] } })).toBe('intensity:1:2');
    expect(editGroup({ kind: 'setLayer', section: 0, layer: 0, patch: { region: null } })).toBe('region:0:0');
    expect(editGroup({ kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'melody' } })).toBeUndefined();
    expect(editGroup({ kind: 'merge', section: 0 })).toBeUndefined();
  });
});

describe('addLayer with listen', () => {
  it('strings on the melody next to strings is allowed; the same instance twice is not', () => {
    const S = make();
    const s = edit(S, { kind: 'addLayer', section: 0, widget: 'strings', listen: 'melody', at: 1 });
    expect(s.sections[0].layers).toEqual([{ widget: 'strings' }, { widget: 'strings', listen: 'melody' }, { widget: 'squares' }]);
    expect(applyEdit(s, { kind: 'addLayer', section: 0, widget: 'strings', listen: 'melody' }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'addLayer', section: 0, widget: 'strings', listen: 'all' }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'addLayer', section: 0, widget: 'strings', listen: 'nonsense' }, env)).toBe(s);
    expect(edit(S, { kind: 'addLayer', section: 1, widget: 'squares', listen: 'all' }).sections[1].layers[1]).toEqual({ widget: 'squares' });
  });
});

describe('moveBoundary over pivots', () => {
  const A: Pivot[] = [{ t: 2, v: 0 }, { t: 8, v: 1 }], B: Pivot[] = [{ t: 12, v: 1 }, { t: 18, v: 0 }];

  it('shrinking a section drops the pivots outside and adds an edge pivot with the old value there', () => {
    const S = make(A, B);
    const s = edit(S, { kind: 'moveBoundary', index: 1, t: 5 });
    expect(piv(s, 0)).toEqual([{ t: 2, v: 0 }, { t: 5, v: 0.5 }]);
    expect(s.sections[1].layers).toBe(S.sections[1].layers);   // nothing of B fell outside: shared
    close(samples(piv(s, 0), 0, 5), samples(A, 0, 5));
    const r = edit(S, { kind: 'moveBoundary', index: 1, t: 15 });
    expect(piv(r, 1)).toEqual([{ t: 15, v: 0.5 }, { t: 18, v: 0 }]);
    expect(r.sections[0].layers).toBe(S.sections[0].layers);
    close(samples(piv(r, 1), 15, 20), samples(B, 15, 20));
    for (const x of [...piv(s, 0)!, ...piv(r, 1)!]) expect(x.v).toBe(curve(x.t < 10 ? A : B, x.t));
  });

  it('every pivot outside: one edge pivot holds the value; a pivot already at the edge needs none', () => {
    const S = make([{ t: 7, v: 0.2 }, { t: 9, v: 0.8 }]);
    expect(piv(edit(S, { kind: 'moveBoundary', index: 1, t: 4 }), 0)).toEqual([{ t: 4, v: 0.2 }]);
    const at = make([{ t: 2, v: 0 }, { t: 5, v: 0.5 }, { t: 8, v: 1 }]);
    expect(piv(edit(at, { kind: 'moveBoundary', index: 1, t: 5 }), 0)).toEqual([{ t: 2, v: 0 }, { t: 5, v: 0.5 }]);
  });

  it('hold and bent linear segments look the same before the edge', () => {
    for (const a of [[{ t: 2, v: 0.3, shape: 'hold' }, { t: 8, v: 1 }], [{ t: 2, v: 0, bend: 0.6 }, { t: 8, v: 1 }]] as Pivot[][]) {
      const s = edit(make(a), { kind: 'moveBoundary', index: 1, t: 5 });
      close(samples(piv(s, 0), 0, 5), samples(a, 0, 5));
    }
  });

  it('without env the edge pivot takes the nearest cut value', () => {
    const s = applyEdit(make(A, B), { kind: 'moveBoundary', index: 1, t: 5 });
    expect(piv(s, 0)).toEqual([{ t: 2, v: 0 }, { t: 5, v: 1 }]);
  });
});

describe('split and merge over pivots', () => {
  const one = (p: Pivot[]): Show => deepFreeze({ version: 2, id: 'demo', song: 'demo', sections: [{ start: 0, end: 30, layers: [{ widget: 'strings', intensity: p }] }] });

  it('split at 15 of [{10,0},{20,1}] gives [{10,0},{15,0.5}] and [{15,0.5},{20,1}]', () => {
    const S = one([{ t: 10, v: 0 }, { t: 20, v: 1 }]);
    const s = edit(S, { kind: 'split', section: 0, t: 15 });
    expect(piv(s, 0)).toEqual([{ t: 10, v: 0 }, { t: 15, v: 0.5 }]);
    expect(piv(s, 1)).toEqual([{ t: 15, v: 0.5 }, { t: 20, v: 1 }]);
    close(samples(piv(s, 0), 0, 15), samples(piv(S, 0), 0, 15));
    close(samples(piv(s, 1), 15, 30), samples(piv(S, 0), 15, 30));
  });

  it('a split cuts a hold segment exactly, and the later piece keeps its shape', () => {
    const S = one([{ t: 10, v: 0.2, shape: 'hold' }, { t: 20, v: 1 }]);
    const s = edit(S, { kind: 'split', section: 0, t: 15 });
    expect(piv(s, 1)![0]).toEqual({ t: 15, v: 0.2, shape: 'hold' });
    close(samples(piv(s, 0), 0, 15), samples(piv(S, 0), 0, 15));
    close(samples(piv(s, 1), 15, 30), samples(piv(S, 0), 15, 30));
  });

  it('merge concatenates the same instance\'s pivots, so split then merge gives the curve back', () => {
    const p: Pivot[] = [{ t: 10, v: 0 }, { t: 20, v: 1 }];
    const s = edit(one(p), { kind: 'split', section: 0, t: 15 });
    const back = piv(edit(s, { kind: 'merge', section: 0 }), 0);
    expect(back).toEqual([{ t: 10, v: 0 }, { t: 15, v: 0.5 }, { t: 20, v: 1 }]);   // the split's edge pivot stays
    close(samples(back, 0, 30), samples(p, 0, 30));
    const m = edit(make([{ t: 2, v: 0 }, { t: 10, v: 1 }], [{ t: 10, v: 1 }, { t: 18, v: 0 }]), { kind: 'merge', section: 0 });
    expect(piv(m, 0)).toEqual([{ t: 2, v: 0 }, { t: 10, v: 1 }, { t: 18, v: 0 }]);
  });

  it('merge keeps each side\'s visible curve (no curve = 1), joined at the boundary', () => {
    const cases: [Pivot[] | undefined, Pivot[] | undefined][] = [
      [[{ t: 2, v: 0 }, { t: 8, v: 1 }], [{ t: 12, v: 0.2 }, { t: 16, v: 0.6, shape: 'ease' }]],
      [undefined, [{ t: 12, v: 0.2 }]],
      [[{ t: 3, v: 0.4 }], undefined],
    ];
    for (const [a, b] of cases) {
      const S = make(a, b);
      const m = edit(S, { kind: 'merge', section: 0 });
      const p = piv(m, 0);
      close(samples(p, 0, 9.999), samples(a, 0, 9.999));
      close(samples(p, 10, 20), samples(b, 10, 20));
    }
    const plain = make();
    expect(edit(plain, { kind: 'merge', section: 0 }).sections[0].layers).toBe(plain.sections[0].layers);
  });
});

describe('Store', () => {
  it('passes its env to applyEdit', () => {
    const S = make([{ t: 2, v: 0 }, { t: 8, v: 1 }]);
    const store = new Store(env);
    store.dispatch({ type: 'loaded', song: {} as SongPack, show: S, origin: 'file' });
    store.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 5 } });
    expect(piv(store.state.show!, 0)).toEqual([{ t: 2, v: 0 }, { t: 5, v: 0.5 }]);
    const bare = new Store();
    bare.dispatch({ type: 'loaded', song: {} as SongPack, show: S, origin: 'file' });
    bare.dispatch({ type: 'edit', edit: { kind: 'moveBoundary', index: 1, t: 5 } });
    expect(piv(bare.state.show!, 0)).toEqual([{ t: 2, v: 0 }, { t: 5, v: 1 }]);
  });

  it('pivot drags on one layer are one undo step', () => {
    const S = make();
    const store = new Store(env);
    store.dispatch({ type: 'loaded', song: {} as SongPack, show: S, origin: 'file' });
    for (const v of [0.2, 0.4, 0.6]) store.dispatch({ type: 'edit', edit: { kind: 'setLayer', section: 0, layer: 0, patch: { intensity: [{ t: 1, v }] } } });
    expect(piv(store.state.show!, 0)).toEqual([{ t: 1, v: 0.6 }]);
    store.dispatch({ type: 'undo' });
    expect(store.state.show).toBe(S);
  });
});
