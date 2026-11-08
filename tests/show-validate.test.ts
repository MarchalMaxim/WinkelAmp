/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { canonicalShow, freeTrack, instanceKey, isListen, nextClipId, repairShow, topTrack, validateShow, widgetOfKey, type Clip, type Show, type ShowContext } from '../src/studio/show/show';

const c: ShowContext = { duration: 100, widgets: loadCatalogue().widgets };
const clip = (id: string, start: number, end: number, track: number, widget = 'kandinsky', more: Partial<Clip> = {}): Clip => ({ id, start, end, track, widget, ...more });
const show = (...clips: Clip[]): Show => ({ version: 3, id: 'demo', song: 'demo', clips });
const good = (): Show => ({
  version: 3, id: 'demo', song: 'demo', title: 'Demo', composer: { by: 'user', at: '2026-10-31T00:00:00.000Z' },
  clips: [
    clip('c1', 0, 30, 0, 'squares'),
    clip('c2', 20, 60, 1, 'kandinsky', { fade: 3, knobs: { edges: 0.9 } }),
    clip('c3', 25, 40, 2, 'kandinsky', { knobs: { edges: { base: 0.5, drive: '-level', depth: 0.3 } } }),
  ],
});
const errs = (x: unknown) => validateShow(x, c).errors;
const warns = (x: unknown) => validateShow(x, c).warnings;
const at = (issues: { path: string; message: string }[], path: string) => issues.filter((i) => i.path === path);

describe('validateShow', () => {
  it('passes a show whose clips overlap across tracks, the same widget over itself, with gaps', () => {
    expect(validateShow(good(), c)).toEqual({ errors: [], warnings: [] });
    expect(validateShow(show(clip('a', 5, 10, 0), clip('b', 7, 9, 1), clip('c', 50, 60, 0)), c)).toEqual({ errors: [], warnings: [] });
  });

  it('passes an empty timeline', () => {
    expect(validateShow(show(), c)).toEqual({ errors: [], warnings: [] });
  });

  it('reads no other version, and says so', () => {
    const e = at(errs({ version: 2, id: 'demo', song: 'demo', sections: [] }), 'version');
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/version 3/);
    expect(at(errs({ version: 2, id: 'demo', song: 'demo', sections: [] }), 'clips')).toHaveLength(1);
  });

  it('wants clips that end after they start, in the song, each with an id of its own', () => {
    expect(at(errs(show(clip('a', 5, 5, 0))), 'clips[0].end')).toHaveLength(1);
    expect(at(errs(show(clip('a', -1, 5, 0))), 'clips[0].start')).toHaveLength(1);
    expect(at(errs(show(clip('a', 0, 5, 0), clip('a', 6, 7, 0))), 'clips[1].id')).toHaveLength(1);
    expect(at(errs(show(clip('A b', 0, 5, 0))), 'clips[0].id')).toHaveLength(1);
    expect(at(errs(show(clip('a', 0, 5, 1.5))), 'clips[0].track')).toHaveLength(1);
    expect(at(errs(show(clip('a', 0, 5, -1))), 'clips[0].track')).toHaveLength(1);
    expect(at(errs({ ...show(), clips: [{ start: 'x', end: 1 }] }), 'clips[0].start')).toHaveLength(1);
  });

  it('one track holds no overlaps, but clips may touch', () => {
    const e = at(errs(show(clip('a', 0, 50, 0), clip('b', 45, 100, 0))), 'clips[1].track');
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/clips\[0\]/);
    expect(errs(show(clip('a', 0, 50, 0), clip('b', 50, 100, 0)))).toEqual([]);
  });

  it('warns of a very short clip, one past the song, too many at once', () => {
    expect(at(warns(show(clip('a', 0, 0.1, 0))), 'clips[0]')[0].message).toMatch(/hard to see/);
    expect(at(warns(show(clip('a', 90, 120, 0))), 'clips[0].end')[0].message).toMatch(/120.*100/);
    expect(warns(show(clip('a', 90, 100.4, 0)))).toEqual([]);
    const many = Array.from({ length: 7 }, (_, i) => clip(`c${i}`, 0, 10, i));
    expect(at(warns(show(...many)), 'clips')[0].message).toMatch(/7 clips/);
    expect(warns(show(...many.slice(0, 6)))).toEqual([]);
  });

  it('rejects unknown widgets, bad knobs, ids; warns of out-of-range knobs and typos', () => {
    expect(at(errs(show(clip('a', 0, 5, 0, 'nope'))), 'clips[0].widget')).toHaveLength(1);
    expect(at(errs(show(clip('a', 0, 5, 0, 'kandinsky', { knobs: { edges: { drive: '+loudness' } as never } }))), 'clips[0].knobs.edges.drive')).toHaveLength(1);
    expect(at(errs(show(clip('a', 0, 5, 0, 'kandinsky', { knobs: { edges: { depth: 2 } } }))), 'clips[0].knobs.edges.depth')).toHaveLength(1);
    expect(at(errs({ ...good(), id: 'Not A Slug' }), 'id')).toHaveLength(1);
    expect(at(warns(show(clip('a', 0, 5, 0, 'kandinsky', { knobs: { edges: 99 } }))), 'clips[0].knobs.edges')).toHaveLength(1);
    expect(at(warns(show(clip('a', 0, 5, 0, 'kandinsky', { knobs: { nope: 1 } }))), 'clips[0].knobs.nope')).toHaveLength(1);
    expect(at(warns({ ...show(), clips: [{ ...clip('a', 0, 5, 0), lable: 'x' }] }), 'clips[0].lable')).toHaveLength(1);
    expect(at(warns(show(clip('a', 0, 5, 0, 'kandinsky', { fade: 11 }))), 'clips[0].fade')).toHaveLength(1);
    expect(at(errs(show(clip('a', 0, 5, 0, 'kandinsky', { fade: 'x' as never }))), 'clips[0].fade')).toHaveLength(1);
  });

  it('a note type a clip holds none of is a warning; one it holds is not', () => {
    const noteTypes = { runs: [50, 51, 52] };
    const here = (start: number, end: number) => validateShow(show(clip('a', start, end, 0, 'kandinsky', { listen: 'runs' })), { ...c, noteTypes }).warnings;
    expect(at(here(0, 10), 'clips[0].listen')[0].message).toMatch(/no fast runs/);
    expect(here(45, 55)).toEqual([]);
  });
});

describe('instance keys', () => {
  it('two clips of one widget are two instances, and a part makes a new one', () => {
    expect(instanceKey({ id: 'c1', widget: 'strings' })).toBe('strings#c1');
    expect(instanceKey({ id: 'c2', widget: 'strings' })).toBe('strings#c2');
    expect(instanceKey({ id: 'c1', widget: 'strings', listen: 'all' })).toBe('strings#c1');
    expect(instanceKey({ id: 'c1', widget: 'strings', listen: 'melody' })).toBe('strings@melody#c1');
    expect(instanceKey({ id: 'c1', widget: 'strings', listen: 'picks:p1' })).toBe('strings@picks:p1#c1');
    expect(widgetOfKey('strings@family:brass#c1')).toBe('strings');
    expect(widgetOfKey('strings#c1')).toBe('strings');
  });
  it('parts', () => {
    for (const x of ['all', 'piano', 'horn', 'saxophone', 'family:strings', 'family:voice', 'melody', 'bassline', 'inner', 'low', 'high', 'accents']) expect(isListen(x)).toBe(true);
    for (const x of ['', 'Melody', 'drums', 'family:', 'family:drums', 'family:melody', 3, null, undefined]) expect(isListen(x)).toBe(false);
  });
});

describe('tracks', () => {
  const cs = [clip('a', 0, 10, 0), clip('b', 5, 15, 1), clip('c', 20, 30, 0)];
  it('freeTrack: the nearest free one at or above the one wanted, a new one if it must', () => {
    expect(freeTrack(cs, { start: 12, end: 14 }, 0)).toBe(0);
    expect(freeTrack(cs, { start: 8, end: 9 }, 0)).toBe(2);
    expect(freeTrack(cs, { start: 8, end: 9 }, 1)).toBe(2);
    expect(freeTrack(cs, { start: 8, end: 9 }, 0, 'a')).toBe(0);
    expect(freeTrack(cs, { start: 10, end: 20 }, 0)).toBe(0);   // touching is free
  });
  it('topTrack: above every clip it plays with', () => {
    expect(topTrack(cs, { start: 7, end: 8 })).toBe(2);
    expect(topTrack(cs, { start: 16, end: 18 })).toBe(0);
    expect(topTrack(cs, { start: 12, end: 25 })).toBe(2);
  });
  it('nextClipId: one past the highest, so no delete hands out a used id', () => {
    expect(nextClipId([])).toBe('c1');
    expect(nextClipId([{ id: 'c1' }, { id: 'c7' }, { id: 'x' }])).toBe('c8');
  });
});

describe('repairShow', () => {
  const fixedOk = (s: Show) => {
    const r = repairShow(s, c);
    expect(validateShow(r.show, c).errors).toEqual([]);
    return r;
  };

  it('moves an overlapping clip to a free track, losing nothing', () => {
    const r = fixedOk(show(clip('a', 0, 50, 0), clip('b', 45, 100, 0)));
    expect(r.show.clips.map((x) => x.track)).toEqual([0, 1]);
    expect(r.fixed.some((f) => /taken/.test(f.message))).toBe(true);
  });

  it('cuts a clip at the song, drops one past it, swaps a backwards one', () => {
    expect(fixedOk(show(clip('a', 90, 120, 0))).show.clips[0].end).toBe(100);
    expect(fixedOk(show(clip('a', 120, 130, 0))).show.clips).toEqual([]);
    const r = fixedOk(show(clip('a', 20, 10, 0))).show.clips[0];
    expect([r.start, r.end]).toEqual([10, 20]);
  });

  it('gives each clip an id of its own', () => {
    const r = fixedOk(show(clip('c1', 0, 5, 0), clip('c1', 6, 7, 0), clip('Bad Id', 8, 9, 0)));
    expect(new Set(r.show.clips.map((x) => x.id)).size).toBe(3);
  });

  it('drops an unknown widget, clamps knobs and fades, and never mutates its input', () => {
    const before = show(clip('a', 0, 5, 0, 'nope'), clip('b', 0, 5, 0, 'kandinsky', { fade: 99, knobs: { edges: 99 } }));
    const text = JSON.stringify(before);
    const r = fixedOk(before);
    expect(r.show.clips.map((x) => x.id)).toEqual(['b']);
    expect(r.show.clips[0].fade).toBe(10);
    expect(r.show.clips[0].knobs!.edges).toBeLessThan(99);
    expect(JSON.stringify(before)).toBe(text);
  });

  it('a show without a list of clips becomes an empty timeline', () => {
    const r = repairShow({ version: 3, id: 'demo', song: 'demo' } as Show, c);
    expect(r.show.clips).toEqual([]);
  });
});

describe('canonicalShow', () => {
  it('writes clips by start, then track, keys in schema order, times to ms, unknown keys gone, and is a fixed point', () => {
    const s = show(
      { widget: 'kandinsky', end: 8.12345, start: 2.00049, track: 1, id: 'b', knobs: { edges: 1 }, junk: 1 } as Clip,
      clip('a', 2.00049, 9, 0), clip('c', 1, 3, 3, 'squares', { listen: 'all', intensity: [] }));
    const text = canonicalShow(s), back = JSON.parse(text) as Show;
    expect(back.version).toBe(3);
    expect(back.clips.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(Object.keys(back.clips[2])).toEqual(['id', 'start', 'end', 'track', 'widget', 'knobs']);
    expect(back.clips[2].end).toBe(8.123);
    expect(Object.keys(back.clips[0])).toEqual(['id', 'start', 'end', 'track', 'widget']);
    expect(text).not.toContain('junk');
    expect(canonicalShow(back)).toBe(text);
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('writes one line per pivot, rounded, region numbers to 4 decimals', () => {
    const text = canonicalShow(show(clip('a', 0, 10, 0, 'kandinsky', {
      intensity: [{ v: 0.123456, t: 1.23456 }, { bend: 0.333333, shape: 'ease', v: 1, t: 5 }, { t: 9, v: 0 }],
      region: { fit: 'cover', blend: 'lighten', feather: 0.3, rot: 12.3456789, h: 0.4, w: 0.5, y: 0.25, x: 0.333333333, shape: 'ellipse', mode: 'window' },
    })));
    expect(text).toContain('{ "t": 1.235, "v": 0.1235 },\n');
    expect(text).toContain('{ "t": 5, "v": 1, "shape": "ease", "bend": 0.3333 },\n');
    const r = (JSON.parse(text) as Show).clips[0].region!;
    expect(Object.keys(r)).toEqual(['mode', 'shape', 'x', 'y', 'w', 'h', 'rot', 'feather', 'blend', 'fit']);
    expect(r.x).toBe(0.3333);
  });
});

describe('intensityMoves', () => {
  const curve = [{ t: 0, v: 0 }, { t: 30, v: 1 }];
  const on = (widget: string, more: Partial<Clip> = {}) => show(clip('c1', 0, 30, 0, widget, { intensity: curve, intensityMoves: 'present', ...more }));

  it('passes on a widget with the slider', () => {
    expect(errs(on('vine'))).toEqual([]);
    expect(at(warns(on('vine')), 'clips[0].intensityMoves')).toEqual([]);
  });
  it('says so on a widget without one: it keeps fading', () => {
    expect(at(warns(on('fold')), 'clips[0].intensityMoves')).toHaveLength(1);
  });
  it('refuses anything else', () => {
    expect(at(errs(on('vine', { intensityMoves: 'loud' as never })), 'clips[0].intensityMoves')).toHaveLength(1);
  });
  it('a repair removes anything else', () => {
    const fixed = repairShow(on('vine', { intensityMoves: 'loud' as never }), c).show;
    expect(fixed.clips[0].intensityMoves).toBeUndefined();
  });
  it('is saved after the curve', () => {
    const text = canonicalShow(on('vine'));
    expect(text.indexOf('"intensityMoves": "present"')).toBeGreaterThan(text.indexOf('"intensity":'));
  });
});
