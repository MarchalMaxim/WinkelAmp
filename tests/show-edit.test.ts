import { describe, expect, it } from 'vitest';
import { applyEdit, editGroup, type EditEnv, type ShowEdit } from '../src/studio/show/edit';
import { validateShow, type Clip, type Show } from '../src/studio/show/show';
import type { Pivot } from '../src/widgets/types';

const clip = (id: string, start: number, end: number, track: number, more: Partial<Clip> = {}): Clip => ({ id, start, end, track, widget: 'squares', ...more });
const show = (...clips: Clip[]): Show => ({ version: 3, id: 'demo', song: 'demo', clips });
/** A straight-line curve, enough for edge pivots. */
const curve: EditEnv['curve'] = (p, t) => {
  if (!p?.length) return 1;
  if (t <= p[0].t) return p[0].v;
  for (let i = 0; i + 1 < p.length; i++) if (t <= p[i + 1].t) return p[i].v + ((p[i + 1].v - p[i].v) * (t - p[i].t)) / (p[i + 1].t - p[i].t || 1);
  return p[p.length - 1].v;
};
const env: EditEnv = { curve, duration: () => 100 };
const apply = (s: Show, e: ShowEdit) => {
  const before = JSON.stringify(s), next = applyEdit(s, e, env);
  expect(JSON.stringify(s)).toBe(before);   // never mutates
  expect(validateShow(next).errors).toEqual([]);
  return next;
};
const of = (s: Show, id: string) => s.clips.find((c) => c.id === id)!;

describe('addClip', () => {
  it('lands on top of what plays with it, on the lowest track where nothing plays', () => {
    let s = apply(show(), { kind: 'addClip', widget: 'squares', start: 5, end: 15 });
    expect(s.clips[0]).toEqual({ id: 'c1', start: 5, end: 15, track: 0, widget: 'squares' });
    s = apply(s, { kind: 'addClip', widget: 'squares', start: 10, end: 20 });
    expect(of(s, 'c2').track).toBe(1);
    s = apply(s, { kind: 'addClip', widget: 'casket', start: 50, end: 60 });
    expect(of(s, 'c3').track).toBe(0);
  });
  it('keeps to the song and takes a part', () => {
    const s = apply(show(), { kind: 'addClip', widget: 'squares', start: 95, end: 130, listen: 'melody' });
    expect(s.clips[0]).toMatchObject({ start: 95, end: 100, listen: 'melody' });
    expect(apply(show(), { kind: 'addClip', widget: 'squares', start: 100, end: 130 }).clips[0]).toMatchObject({ start: 99.75, end: 100 });
  });
  it('refuses what it cannot make', () => {
    const s = show();
    expect(applyEdit(s, { kind: 'addClip', widget: '', start: 1, end: 2 }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'addClip', widget: 'squares', start: NaN, end: 2 }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'addClip', widget: 'squares', start: 1, end: 2, listen: 'drums' }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'addClip', widget: 'squares', start: 1, end: 2, listen: 'picks:p9' }, env)).toBe(s);
  });
  it('never reuses an id', () => {
    let s = apply(show(clip('c1', 0, 1, 0), clip('c2', 2, 3, 0)), { kind: 'removeClip', clip: 'c1' });
    s = apply(s, { kind: 'addClip', widget: 'squares', start: 4, end: 5 });
    expect(s.clips.map((c) => c.id)).toEqual(['c2', 'c3']);
  });
});

describe('moveClip', () => {
  const two = () => show(clip('a', 10, 20, 0), clip('b', 30, 40, 0));
  it('moves a clip in time and across tracks, sharing the others', () => {
    const s0 = two(), s = apply(s0, { kind: 'moveClip', clip: 'a', start: 12.5, track: 3 });
    expect(of(s, 'a')).toMatchObject({ start: 12.5, end: 22.5, track: 3 });
    expect(of(s, 'b')).toBe(of(s0, 'b'));
  });
  it('a clip landing on an occupied spot goes to a free track above it, and comes back when the spot is free', () => {
    let s = apply(two(), { kind: 'moveClip', clip: 'a', start: 35, track: 0 });
    expect(of(s, 'a')).toMatchObject({ start: 35, end: 45, track: 1 });
    s = apply(s, { kind: 'moveClip', clip: 'a', start: 50, track: 0 });
    expect(of(s, 'a')).toMatchObject({ start: 50, track: 0 });
  });
  it('stays in the song', () => {
    expect(of(apply(two(), { kind: 'moveClip', clip: 'a', start: -5, track: 0 }), 'a').start).toBe(0);
    expect(of(apply(two(), { kind: 'moveClip', clip: 'b', start: 200, track: 0 }), 'b')).toMatchObject({ start: 90, end: 100 });
  });
  it('its curve moves along', () => {
    const s = apply(show(clip('a', 10, 20, 0, { intensity: [{ t: 10, v: 0 }, { t: 20, v: 1, shape: 'ease' }] })), { kind: 'moveClip', clip: 'a', start: 15, track: 0 });
    expect(of(s, 'a').intensity).toEqual([{ t: 15, v: 0 }, { t: 25, v: 1, shape: 'ease' }]);
  });
  it('nothing changed, nothing to record', () => {
    const s = two();
    expect(applyEdit(s, { kind: 'moveClip', clip: 'a', start: 10, track: 0 }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'moveClip', clip: 'zz', start: 1, track: 0 }, env)).toBe(s);
  });
});

describe('resizeClip', () => {
  const two = () => show(clip('a', 10, 20, 0), clip('b', 30, 40, 0), clip('c', 12, 35, 1));
  it('moves one edge, stopping at the neighbour on its track, the other edge and the song', () => {
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'a', edge: 'end', t: 25 }), 'a')).toMatchObject({ start: 10, end: 25, track: 0 });
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'a', edge: 'end', t: 33 }), 'a').end).toBe(30);
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'b', edge: 'start', t: 15 }), 'b').start).toBe(20);
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'a', edge: 'start', t: -3 }), 'a').start).toBe(0);
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'a', edge: 'end', t: 5 }), 'a').end).toBe(10.25);
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'a', edge: 'start', t: 50 }), 'a').start).toBe(19.75);
    expect(of(apply(two(), { kind: 'resizeClip', clip: 'b', edge: 'end', t: 500 }), 'b').end).toBe(100);
  });
  it('shortening keeps the curve drawn there, and a drag back brings the rest back', () => {
    const p: Pivot[] = [{ t: 10, v: 0 }, { t: 20, v: 1 }];
    const s0 = show(clip('a', 10, 20, 0, { intensity: p }));
    const s1 = apply(s0, { kind: 'resizeClip', clip: 'a', edge: 'end', t: 15, from: p });
    expect(of(s1, 'a').intensity).toEqual([{ t: 10, v: 0 }, { t: 15, v: 0.5 }]);
    const s2 = apply(s1, { kind: 'resizeClip', clip: 'a', edge: 'end', t: 20, from: p });
    expect(of(s2, 'a').intensity).toEqual(p);
  });
  it('a cut at the start carries the shape of the segment it cuts', () => {
    const s = apply(show(clip('a', 10, 20, 0, { intensity: [{ t: 10, v: 0, shape: 'ease' }, { t: 20, v: 1 }] })), { kind: 'resizeClip', clip: 'a', edge: 'start', t: 15 });
    expect(of(s, 'a').intensity).toEqual([{ t: 15, v: 0.5, shape: 'ease' }, { t: 20, v: 1 }]);
  });
  it('nothing changed, nothing to record', () => {
    const s = two();
    expect(applyEdit(s, { kind: 'resizeClip', clip: 'a', edge: 'end', t: 20 }, env)).toBe(s);
  });
});

describe('duplicateClip', () => {
  it('a copy of its own right after it, its curve along', () => {
    const s = apply(show(clip('c1', 10, 20, 0, { knobs: { size: 1 }, intensity: [{ t: 12, v: 0.5 }] })), { kind: 'duplicateClip', clip: 'c1' });
    expect(of(s, 'c2')).toEqual({ id: 'c2', start: 20, end: 30, track: 0, widget: 'squares', knobs: { size: 1 }, intensity: [{ t: 22, v: 0.5 }] });
    expect(of(s, 'c2').knobs).not.toBe(of(s, 'c1').knobs);
  });
  it('with no room after it, over it on a free track: the widget overlaps itself', () => {
    const s = apply(show(clip('c1', 10, 20, 0), clip('c2', 25, 30, 0)), { kind: 'duplicateClip', clip: 'c1' });
    expect(of(s, 'c3')).toMatchObject({ start: 10, end: 20, track: 1 });
    const e = apply(show(clip('c1', 90, 100, 0)), { kind: 'duplicateClip', clip: 'c1' });
    expect(of(e, 'c2')).toMatchObject({ start: 90, end: 100, track: 1 });
  });
});

describe('splitClip', () => {
  it('two clips, each with its part of the curve', () => {
    const s = apply(show(clip('c1', 10, 20, 2, { fade: 0.5, intensity: [{ t: 10, v: 0 }, { t: 20, v: 1 }] })), { kind: 'splitClip', clip: 'c1', t: 15 });
    expect(of(s, 'c1')).toMatchObject({ start: 10, end: 15, track: 2, fade: 0.5, intensity: [{ t: 10, v: 0 }, { t: 15, v: 0.5 }] });
    expect(of(s, 'c2')).toMatchObject({ start: 15, end: 20, track: 2, fade: 0.5, intensity: [{ t: 15, v: 0.5 }, { t: 20, v: 1 }] });
  });
  it('not too close to an edge', () => {
    const s = show(clip('c1', 10, 20, 0));
    expect(applyEdit(s, { kind: 'splitClip', clip: 'c1', t: 10.1 }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'splitClip', clip: 'c1', t: 25 }, env)).toBe(s);
  });
});

describe('setKnob and setClip', () => {
  const s0 = () => show(clip('a', 0, 10, 0, { knobs: { size: 1 } }), clip('b', 0, 10, 1));
  it('sets a knob, null for the default', () => {
    expect(of(apply(s0(), { kind: 'setKnob', clip: 'a', key: 'edges', value: 2 }), 'a').knobs).toEqual({ size: 1, edges: 2 });
    expect('knobs' in of(apply(s0(), { kind: 'setKnob', clip: 'a', key: 'size', value: null }), 'a')).toBe(false);
  });
  it('sets a listen (the same one on two copies is fine), region, curve and fade', () => {
    let s = apply(s0(), { kind: 'setClip', clip: 'a', patch: { listen: 'melody' } });
    s = apply(s, { kind: 'setClip', clip: 'b', patch: { listen: 'melody' } });
    expect([of(s, 'a').listen, of(s, 'b').listen]).toEqual(['melody', 'melody']);
    expect('listen' in of(apply(s, { kind: 'setClip', clip: 'a', patch: { listen: 'all' } }), 'a')).toBe(false);
    s = apply(s, { kind: 'setClip', clip: 'a', patch: { region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5 } } });
    expect(of(s, 'a').region?.mode).toBe('spot');
    s = apply(s, { kind: 'setClip', clip: 'a', patch: { intensity: [{ t: -3, v: 2 }, { t: 5, v: 0 }] } });
    expect(of(s, 'a').intensity).toEqual([{ t: 0, v: 1 }, { t: 5, v: 0 }]);
    s = apply(s, { kind: 'setClip', clip: 'a', patch: { fade: 99 } });
    expect(of(s, 'a').fade).toBe(10);
    expect('fade' in of(apply(s, { kind: 'setClip', clip: 'a', patch: { fade: null } }), 'a')).toBe(false);
  });
  it('refuses a part that does not exist, and records nothing when nothing changes', () => {
    const s = s0();
    expect(applyEdit(s, { kind: 'setClip', clip: 'a', patch: { listen: 'drums' } }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'setClip', clip: 'a', patch: { listen: 'picks:p1' } }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'setClip', clip: 'a', patch: { listen: null } }, env)).toBe(s);
    expect(applyEdit(s, { kind: 'setClip', clip: 'zz', patch: { fade: 1 } }, env)).toBe(s);
  });
});

describe('editGroup', () => {
  it('a region or intensity edit groups by clip, others not', () => {
    expect(editGroup({ kind: 'setClip', clip: 'a', patch: { region: null } })).toBe('region:a');
    expect(editGroup({ kind: 'setClip', clip: 'a', patch: { intensity: null } })).toBe('intensity:a');
    expect(editGroup({ kind: 'setClip', clip: 'a', patch: { listen: null } })).toBeUndefined();
    expect(editGroup({ kind: 'removeClip', clip: 'a' })).toBeUndefined();
  });
});
