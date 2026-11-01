import { describe, expect, it } from 'vitest';
import { applyEdit, nextPicksId, type ShowEdit } from '../src/studio/show/edit';
import { entriesBetween } from '../src/studio/show/schedule';
import { canonicalShow, instanceKey, validateShow, type Show } from '../src/studio/show/show';
import { Store } from '../src/studio/ui/store';
import type { SongPack } from '../src/studio/pack/pack';
import type { Note } from '../src/widgets/types';

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}
/** Sections [0,10], [10,20], [20,30]. */
const SHOW: Show = deepFreeze({
  version: 2, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, layers: [{ widget: 'strings' }] },
    { start: 10, end: 20, fade: 2, layers: [{ widget: 'squares' }] },
    { start: 20, end: 30, layers: [{ widget: 'casket' }] },
  ],
});
const note = (t: number, v = 80): Note => [t, t + 0.5, 60, v];
const AT_12_25 = [note(25), note(12)];

const edit = (s: Show, e: ShowEdit) => {
  const out = applyEdit(s, e);
  expect(validateShow(out).errors).toEqual([]);
  return deepFreeze(out);
};
const placed = (notes: Note[] = AT_12_25, widget = 'pointillism') => edit(SHOW, { kind: 'placePicks', widget, notes });
const widgets = (s: Show) => s.sections.map((x) => x.layers.map(instanceKey));
const store = (s: Show) => {
  const st = new Store();
  st.dispatch({ type: 'loaded', song: { id: 'demo' } as SongPack, show: s, origin: 'file' });
  return st;
};

describe('placePicks', () => {
  it('makes set p1, sorted, and a layer on top of every section from the first pick to the last', () => {
    const s = placed();
    expect(s.picks).toEqual({ p1: { notes: [note(12), note(25)] } });
    expect(widgets(s)).toEqual([['strings'], ['squares', 'pointillism@picks:p1'], ['casket', 'pointillism@picks:p1']]);
    expect(s.sections[1].layers[1]).toEqual({ widget: 'pointillism', listen: 'picks:p1' });
  });

  it('with no notes, or only malformed ones, is the input', () => {
    expect(applyEdit(SHOW, { kind: 'placePicks', widget: 'pointillism', notes: [] })).toBe(SHOW);
    expect(applyEdit(SHOW, { kind: 'placePicks', widget: 'pointillism', notes: [[2, 1, 60, 80]] })).toBe(SHOW);
  });

  it('a second set of the same widget is p2: two instances in one section, no error', () => {
    const s = edit(placed(), { kind: 'placePicks', widget: 'pointillism', notes: [note(13)] });
    expect(Object.keys(s.picks!)).toEqual(['p1', 'p2']);
    expect(widgets(s)[1]).toEqual(['squares', 'pointillism@picks:p1', 'pointillism@picks:p2']);
  });

  it('nextPicksId is the smallest free', () => {
    expect(nextPicksId(SHOW)).toBe('p1');
    expect(nextPicksId({ ...SHOW, picks: { p1: { notes: [note(1)] }, p3: { notes: [note(1)] } } })).toBe('p2');
  });

  it('a last pick that a step can carry over the boundary takes the next section too', () => {
    const s = placed([note(12), note(19.99)]);
    expect(widgets(s)).toEqual([['strings'], ['squares', 'pointillism@picks:p1'], ['casket', 'pointillism@picks:p1']]);
    expect(widgets(placed([note(12), note(19.9)]))[2]).toEqual(['casket']);
    expect(widgets(placed([note(29.99)]))).toEqual([['strings'], ['squares'], ['casket', 'pointillism@picks:p1']]);
  });

  it('through Store: a placement is one undo, which gives the show before; redo brings it back', () => {
    const st = store(SHOW);
    st.dispatch({ type: 'edit', edit: { kind: 'placePicks', widget: 'pointillism', notes: AT_12_25 } });
    const after = st.state.show!;
    expect(after.picks).toBeDefined();
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(SHOW);
    expect(st.history.canUndo).toBe(false);
    st.dispatch({ type: 'redo' });
    expect(st.state.show).toBe(after);
  });
});

describe('updatePicks', () => {
  /** A set at [12, 25], its layer in section 1 with knobs and a region and a layer above it. */
  const REGION = { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5 } as const;
  const dressed = (): Show => {
    const s = placed();
    return deepFreeze({ ...s, sections: s.sections.map((x, i) => (i !== 1 ? x : {
      ...x, layers: [{ ...x.layers[1], knobs: { size: 2 }, region: REGION }, x.layers[0]],
    })) });
  };
  const AT_5_12 = [note(5), note(12)];

  it('re-spans: new sections get it on top with the nearest knobs and region, sections left lose it, others keep their place', () => {
    const s = edit(dressed(), { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: AT_5_12 });
    expect(s.picks!.p1.notes).toEqual(AT_5_12);
    expect(widgets(s)).toEqual([['strings', 'pointillism@picks:p1'], ['pointillism@picks:p1', 'squares'], ['casket']]);
    expect(s.sections[0].layers[1]).toEqual({ widget: 'pointillism', listen: 'picks:p1', knobs: { size: 2 }, region: REGION });
    expect(s.sections[1].layers[0].knobs).toEqual({ size: 2 });
  });

  it('a new widget: every layer rewritten, knobs gone, region kept', () => {
    const s = edit(dressed(), { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: [note(5), note(25)] });
    expect(widgets(s)).toEqual([['strings', 'lewitt@picks:p1'], ['lewitt@picks:p1', 'squares'], ['casket', 'lewitt@picks:p1']]);
    expect(s.sections[1].layers[0]).toEqual({ widget: 'lewitt', listen: 'picks:p1', region: REGION });
    expect(s.sections[0].layers[1]).toEqual({ widget: 'lewitt', listen: 'picks:p1', region: REGION });
  });

  it('keeps the other sets and the set\'s curve', () => {
    const two = edit(placed(), { kind: 'placePicks', widget: 'casket', notes: [note(13)] });
    const s = edit(two, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [note(12)] });
    expect(s.picks!.p2).toBe(two.picks!.p2);
    expect(widgets(s)[1]).toEqual(['squares', 'pointillism@picks:p1', 'casket@picks:p2']);
  });

  it('no change, an unknown id, or no notes is the input', () => {
    const s = dressed();
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: AT_12_25 })).toBe(s);
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p9', widget: 'pointillism', notes: AT_5_12 })).toBe(s);
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [] })).toBe(s);
  });

  it('one layer per section, even when a hand-written show had two widgets on the set', () => {
    const p = placed();
    const s: Show = deepFreeze({ ...p, sections: p.sections.map((x, i) => (i !== 1 ? x : { ...x, layers: [...x.layers, { widget: 'casket', listen: 'picks:p1' }] })) });
    const out = edit(s, { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: [note(12), note(13)] });
    expect(widgets(out)[1]).toEqual(['squares', 'lewitt@picks:p1']);
  });

  it('through Store: one undo, however many sections it touches', () => {
    const p = placed(), st = store(p);
    st.dispatch({ type: 'edit', edit: { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: [note(5)] } });
    expect(st.state.show!.picks!.p1.notes).toEqual([note(5)]);
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(p);
  });
});

describe('removePicks', () => {
  it('takes every layer of the set and the set: the show before the placement', () => {
    const s = edit(placed(), { kind: 'removePicks', id: 'p1' });
    expect(canonicalShow(s)).toBe(canonicalShow(SHOW));
    expect('picks' in s).toBe(false);
  });

  it('an unknown id is the input', () => {
    const s = placed();
    expect(applyEdit(s, { kind: 'removePicks', id: 'p9' })).toBe(s);
  });

  it('leaves another set', () => {
    const two = edit(placed(), { kind: 'placePicks', widget: 'casket', notes: [note(13)] });
    const s = edit(two, { kind: 'removePicks', id: 'p1' });
    expect(Object.keys(s.picks!)).toEqual(['p2']);
    expect(widgets(s)[1]).toEqual(['squares', 'casket@picks:p2']);
  });
});

describe('the last layer of a set takes the set with it', () => {
  it('removeLayer of one of two keeps it; of the last, it goes, and undo restores both', () => {
    const p = placed();
    const one = edit(p, { kind: 'removeLayer', section: 1, layer: 1 });
    expect(one.picks).toBe(p.picks);
    const none = edit(one, { kind: 'removeLayer', section: 2, layer: 1 });
    expect('picks' in none).toBe(false);
    expect(validateShow(none).warnings).toEqual([]);

    const st = store(one);
    st.dispatch({ type: 'edit', edit: { kind: 'removeLayer', section: 2, layer: 1 } });
    expect(st.state.show!.picks).toBeUndefined();
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(one);
  });

  it('merge that drops the last layer of a set: it goes', () => {
    const s = placed([note(25)]);
    const m = edit(s, { kind: 'merge', section: 1 });
    expect(m.sections.map((x) => x.layers.map(instanceKey))).toEqual([['strings'], ['squares']]);
    expect('picks' in m).toBe(false);
  });

  it('merge that keeps a layer of the set keeps it', () => {
    const m = edit(placed(), { kind: 'merge', section: 1 });
    expect(m.picks).toBeDefined();
    expect(widgets(m)).toEqual([['strings'], ['squares', 'pointillism@picks:p1']]);
  });

  it('setLayer to listen null on the last: it goes', () => {
    const s = placed([note(25)]);
    const out = edit(s, { kind: 'setLayer', section: 2, layer: 1, patch: { listen: null } });
    expect(out.sections[2].layers[1]).toEqual({ widget: 'pointillism' });
    expect('picks' in out).toBe(false);
  });

  it('a set nobody used before the edit stays: it is hand work, not this edit\'s', () => {
    const s: Show = deepFreeze({ ...SHOW, picks: { p1: { notes: [note(1)] } } });
    const out = edit(s, { kind: 'removeLayer', section: 0, layer: 0 });
    expect(out.picks).toBe(s.picks);
  });
});

describe('a picks listen needs its set', () => {
  it('addLayer and setLayer with picks:p9 are the input', () => {
    const p = placed();
    expect(applyEdit(p, { kind: 'addLayer', section: 0, widget: 'squares', listen: 'picks:p9' })).toBe(p);
    expect(applyEdit(p, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'picks:p9' } })).toBe(p);
  });

  it('with the set there they apply', () => {
    const p = placed();
    expect(edit(p, { kind: 'addLayer', section: 0, widget: 'squares', listen: 'picks:p1' }).sections[0].layers[1]).toEqual({ widget: 'squares', listen: 'picks:p1' });
    expect(edit(p, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'picks:p1' } }).sections[0].layers[0]).toEqual({ widget: 'strings', listen: 'picks:p1' });
  });
});

describe('the other edits', () => {
  it('split of a section with a picks layer: both have the same key, and nothing enters there', () => {
    const s = edit(placed(), { kind: 'split', section: 1, t: 15 });
    expect(widgets(s)[1]).toEqual(widgets(s)[2]);
    expect(widgets(s)[1]).toContain('pointillism@picks:p1');
    expect(entriesBetween(s, 14.9, 15.1)).toEqual([]);
  });

  it('a show without picks through every old edit kind: no picks key', () => {
    const edits: ShowEdit[] = [
      { kind: 'moveBoundary', index: 1, t: 8 }, { kind: 'split', section: 0, t: 5 }, { kind: 'merge', section: 0 },
      { kind: 'addLayer', section: 0, widget: 'lewitt' }, { kind: 'removeLayer', section: 0, layer: 0 },
      { kind: 'moveLayer', section: 0, from: 0, to: 0 }, { kind: 'setKnob', section: 0, layer: 0, key: 'size', value: 1 },
      { kind: 'setSection', section: 0, patch: { label: 'x' } }, { kind: 'setLayer', section: 0, layer: 0, patch: { listen: 'melody' } },
    ];
    for (const e of edits) expect('picks' in applyEdit(SHOW, e)).toBe(false);
  });
});
