import { describe, expect, it } from 'vitest';
import { applyEdit, nextPicksId, type EditEnv, type ShowEdit } from '../src/studio/show/edit';
import { canonicalShow, validateShow, type Clip, type Show } from '../src/studio/show/show';
import { Store } from '../src/studio/ui/store';
import type { SongPack } from '../src/studio/pack/pack';
import type { Note } from '../src/widgets/types';

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}
/** Three clips side by side on the bottom track. */
const SHOW: Show = deepFreeze({
  version: 3, id: 'demo', song: 'demo',
  clips: [
    { id: 'c1', start: 0, end: 10, track: 0, widget: 'strings' },
    { id: 'c2', start: 10, end: 20, track: 0, fade: 2, widget: 'squares' },
    { id: 'c3', start: 20, end: 30, track: 0, widget: 'casket' },
  ],
});
const note = (t: number, v = 80): Note => [t, t + 0.5, 60, v];
const AT_12_25 = [note(25), note(12)];
const env: EditEnv = { curve: (p, t) => (p?.[0]?.v ?? t * 0) + 0, duration: () => 40 };

const edit = (s: Show, e: ShowEdit) => {
  const out = applyEdit(s, e, env);
  expect(validateShow(out).errors).toEqual([]);
  return deepFreeze(out);
};
const placed = (notes: Note[] = AT_12_25, widget = 'pointillism') => edit(SHOW, { kind: 'placePicks', widget, notes });
const ofSet = (s: Show, id = 'p1'): Clip[] => s.clips.filter((c) => c.listen === `picks:${id}`);
const store = (s: Show) => {
  const st = new Store(env);
  st.dispatch({ type: 'loaded', song: { id: 'demo' } as SongPack, show: s, origin: 'file' });
  return st;
};

describe('placePicks', () => {
  it('makes set p1, sorted, and one clip around its notes, on top of what plays there', () => {
    const s = placed();
    expect(s.picks).toEqual({ p1: { notes: [note(12), note(25)] } });
    expect(ofSet(s)).toEqual([{ id: 'c4', start: 11, end: 26.5, track: 1, widget: 'pointillism', listen: 'picks:p1' }]);
  });

  it('every pick is heard: no never-heard warning, also for the last pick right at the end', () => {
    expect(validateShow(placed()).warnings).toEqual([]);
    expect(validateShow(placed([note(0.2), note(39.8)])).warnings).toEqual([]);
  });

  it('with no notes, or only malformed ones, is the input', () => {
    expect(applyEdit(SHOW, { kind: 'placePicks', widget: 'pointillism', notes: [] }, env)).toBe(SHOW);
    expect(applyEdit(SHOW, { kind: 'placePicks', widget: 'pointillism', notes: [[2, 1, 60, 80]] }, env)).toBe(SHOW);
  });

  it('a second set of the same widget is p2: two instances, overlapping, no error', () => {
    const s = edit(placed(), { kind: 'placePicks', widget: 'pointillism', notes: [note(13)] });
    expect(Object.keys(s.picks!)).toEqual(['p1', 'p2']);
    expect(ofSet(s, 'p2')[0]).toMatchObject({ start: 12, track: 2 });
  });

  it('nextPicksId is the smallest free', () => {
    expect(nextPicksId(SHOW)).toBe('p1');
    expect(nextPicksId({ ...SHOW, picks: { p1: { notes: [note(1)] }, p3: { notes: [note(1)] } } })).toBe('p2');
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
  const REGION = { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5 } as const;
  /** A set at [12, 25], its clip with knobs and a region. */
  const dressed = (): Show => {
    const s = placed();
    return deepFreeze({ ...s, clips: s.clips.map((c) => (c.listen ? { ...c, knobs: { size: 2 }, region: REGION } : c)) });
  };
  const AT_5_12 = [note(5), note(12)];

  it('new notes: its clip spans them, keeping its knobs and region', () => {
    const s = edit(dressed(), { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: AT_5_12 });
    expect(s.picks!.p1.notes).toEqual(AT_5_12);
    expect(ofSet(s)).toEqual([{ id: 'c4', start: 4, end: 13.5, track: 1, widget: 'pointillism', listen: 'picks:p1', knobs: { size: 2 }, region: REGION }]);
  });

  it('a new widget: the clip rewritten, knobs gone, region kept', () => {
    const s = edit(dressed(), { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: [note(5), note(25)] });
    expect(ofSet(s)[0]).toEqual({ id: 'c4', start: 4, end: 26.5, track: 1, widget: 'lewitt', listen: 'picks:p1', region: REGION });
  });

  it('keeps the other sets', () => {
    const two = edit(placed(), { kind: 'placePicks', widget: 'casket', notes: [note(13)] });
    const s = edit(two, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [note(12)] });
    expect(s.picks!.p2).toBe(two.picks!.p2);
    expect(ofSet(s, 'p2')).toEqual(ofSet(two, 'p2'));
  });

  it('the same notes span again: a moved clip loses no pick, and an update is one undo', () => {
    const s = edit(placed([note(12), note(18)]), { kind: 'moveClip', clip: 'c4', start: 5, track: 1 });
    expect(validateShow(s).warnings.filter((w) => /never heard/.test(w.message)).length).toBeGreaterThan(0);
    const st = store(s);
    st.dispatch({ type: 'edit', edit: { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [note(12), note(18)] } });
    const out = st.state.show!;
    expect(ofSet(out)[0]).toMatchObject({ start: 5, end: 19.5 });
    expect(validateShow(out).warnings.filter((w) => /never heard/.test(w.message))).toEqual([]);
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(s);
  });

  it('the same notes keep a clip a hand made longer', () => {
    const s = edit(placed(), { kind: 'resizeClip', clip: 'c4', edge: 'end', t: 35 });
    expect(ofSet(edit(s, { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: AT_12_25 }))[0]).toMatchObject({ start: 11, end: 35, widget: 'lewitt' });
  });

  it('the same notes place a set that is on no clip', () => {
    const s: Show = deepFreeze({ ...SHOW, picks: { p1: { notes: [note(12)] } } });
    expect(ofSet(edit(s, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [note(12)] }))).toEqual([
      { id: 'c4', start: 11, end: 13.5, track: 1, widget: 'pointillism', listen: 'picks:p1' }]);
  });

  it('the same notes and widget on a span already right, an unknown id, or no notes is the input', () => {
    const s = dressed();
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [note(12), note(25)] }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p9', widget: 'pointillism', notes: AT_5_12 }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [] }, env)).toBe(s);
  });

  it('several clips on the set: those holding no note go, the first and last grow to reach the notes', () => {
    const base = edit(edit(placed(), { kind: 'resizeClip', clip: 'c4', edge: 'end', t: 14 }), { kind: 'duplicateClip', clip: 'c4' });
    expect(ofSet(base).map((c) => [c.start, c.end])).toEqual([[11, 14], [14, 17]]);
    const s = edit(base, { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: [note(12), note(13)] });
    expect(ofSet(s)).toHaveLength(1);
    expect(ofSet(s)[0].widget).toBe('lewitt');
  });

  it('a clip that grows over a neighbour on its track moves up: nothing is lost', () => {
    const s = edit(edit(placed([note(12)]), { kind: 'addClip', widget: 'lazy', start: 15, end: 18, track: 1 }), { kind: 'updatePicks', id: 'p1', widget: 'pointillism', notes: [note(12), note(16)] });
    expect(ofSet(s)[0].track).toBe(2);
  });

  it('through Store: one undo', () => {
    const p = placed(), st = store(p);
    st.dispatch({ type: 'edit', edit: { kind: 'updatePicks', id: 'p1', widget: 'lewitt', notes: [note(5)] } });
    expect(st.state.show!.picks!.p1.notes).toEqual([note(5)]);
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(p);
  });
});

describe('removePicks', () => {
  it('takes every clip of the set and the set: the show before the placement', () => {
    const s = edit(placed(), { kind: 'removePicks', id: 'p1' });
    expect(canonicalShow(s)).toBe(canonicalShow(SHOW));
    expect('picks' in s).toBe(false);
  });

  it('an unknown id is the input', () => {
    const s = placed();
    expect(applyEdit(s, { kind: 'removePicks', id: 'p9' }, env)).toBe(s);
  });

  it('leaves another set', () => {
    const two = edit(placed(), { kind: 'placePicks', widget: 'casket', notes: [note(13)] });
    const s = edit(two, { kind: 'removePicks', id: 'p1' });
    expect(Object.keys(s.picks!)).toEqual(['p2']);
    expect(s.clips.map((c) => c.widget)).toEqual(['strings', 'squares', 'casket', 'casket']);
  });
});

describe('the last clip of a set takes the set with it', () => {
  it('removeClip of one of two keeps it; of the last, it goes, and undo restores both', () => {
    const p = edit(placed(), { kind: 'duplicateClip', clip: 'c4' });
    const one = edit(p, { kind: 'removeClip', clip: 'c5' });
    expect(one.picks).toBe(p.picks);
    const none = edit(one, { kind: 'removeClip', clip: 'c4' });
    expect('picks' in none).toBe(false);
    expect(validateShow(none).warnings).toEqual([]);

    const st = store(one);
    st.dispatch({ type: 'edit', edit: { kind: 'removeClip', clip: 'c4' } });
    expect(st.state.show!.picks).toBeUndefined();
    st.dispatch({ type: 'undo' });
    expect(st.state.show).toBe(one);
  });

  it('setClip to listen null on the last: it goes', () => {
    const out = edit(placed(), { kind: 'setClip', clip: 'c4', patch: { listen: null } });
    expect('listen' in out.clips[3]).toBe(false);
    expect('picks' in out).toBe(false);
  });

  it('a set nobody used before the edit stays: it is hand work, not this edit\'s', () => {
    const s: Show = deepFreeze({ ...SHOW, picks: { p1: { notes: [note(1)] } } });
    expect(edit(s, { kind: 'removeClip', clip: 'c1' }).picks).toBe(s.picks);
  });
});

describe('a picks listen needs its set', () => {
  it('addClip and setClip with picks:p9 are the input', () => {
    const p = placed();
    expect(applyEdit(p, { kind: 'addClip', widget: 'squares', start: 0, end: 5, listen: 'picks:p9' }, env)).toBe(p);
    expect(applyEdit(p, { kind: 'setClip', clip: 'c1', patch: { listen: 'picks:p9' } }, env)).toBe(p);
  });

  it('with the set there they apply', () => {
    const p = placed();
    expect(edit(p, { kind: 'addClip', widget: 'squares', start: 0, end: 5, listen: 'picks:p1' }).clips.at(-1)!.listen).toBe('picks:p1');
    expect(edit(p, { kind: 'setClip', clip: 'c1', patch: { listen: 'picks:p1' } }).clips[0].listen).toBe('picks:p1');
  });
});

describe('the other edits', () => {
  it('a split of a clip on picks: two clips on the same set, each with its own instance', () => {
    const s = edit(placed(), { kind: 'splitClip', clip: 'c4', t: 15 });
    expect(ofSet(s).map((c) => [c.id, c.start, c.end])).toEqual([['c4', 11, 15], ['c5', 15, 26.5]]);
  });

  it('a show without picks through every edit kind: no picks key', () => {
    const edits: ShowEdit[] = [
      { kind: 'moveClip', clip: 'c1', start: 2, track: 1 }, { kind: 'resizeClip', clip: 'c1', edge: 'end', t: 8 }, { kind: 'splitClip', clip: 'c1', t: 5 },
      { kind: 'duplicateClip', clip: 'c1' }, { kind: 'addClip', widget: 'lewitt', start: 1, end: 2 }, { kind: 'removeClip', clip: 'c1' },
      { kind: 'setKnob', clip: 'c1', key: 'size', value: 1 }, { kind: 'setClip', clip: 'c1', patch: { listen: 'melody' } },
    ];
    for (const e of edits) expect('picks' in applyEdit(SHOW, e, env)).toBe(false);
  });
});
