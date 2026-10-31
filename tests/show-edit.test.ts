import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/studio/show/edit';
import { validateShow, type Show } from '../src/studio/show/show';

function freeze<T>(x: T): T {
  if (x && typeof x === 'object') { Object.freeze(x); for (const v of Object.values(x)) freeze(v); }
  return x;
}
const SHOW: Show = freeze({
  version: 1, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, label: 'Dread', layers: [{ widget: 'squares' }, { widget: 'current', knobs: { size: 0.5 } }] },
    { start: 10, end: 20, fade: 2, layers: [{ widget: 'kandinsky' }] },
    { start: 20, end: 30, label: 'Coda', layers: [{ widget: 'kandinsky' }, { widget: 'casket' }] },
  ],
});
const valid = (s: Show) => expect(validateShow(s, { duration: 30 }).errors).toEqual([]);

describe('applyEdit', () => {
  it('moveBoundary moves both neighbours and clamps so each keeps ≥ 1 s', () => {
    const a = applyEdit(SHOW, { kind: 'moveBoundary', index: 1, t: 12.3456 });
    expect([a.sections[0].end, a.sections[1].start]).toEqual([12.346, 12.346]);
    const b = applyEdit(SHOW, { kind: 'moveBoundary', index: 1, t: 19.9 });
    expect([b.sections[0].end, b.sections[1].start]).toEqual([19, 19]);
    const c = applyEdit(SHOW, { kind: 'moveBoundary', index: 1, t: -5 });
    expect(c.sections[1].start).toBe(1);
    expect(applyEdit(SHOW, { kind: 'moveBoundary', index: 0, t: 3 })).toBe(SHOW);
    expect(applyEdit(SHOW, { kind: 'moveBoundary', index: 3, t: 3 })).toBe(SHOW);
    for (const s of [a, b, c]) valid(s);
  });

  it('split gives two sections with the same layers and label, the second fading in 3 s', () => {
    const s = applyEdit(SHOW, { kind: 'split', section: 0, t: 4 });
    expect(s.sections).toHaveLength(4);
    expect(s.sections[0]).toEqual({ start: 0, end: 4, label: 'Dread', layers: SHOW.sections[0].layers });
    expect(s.sections[1]).toEqual({ start: 4, end: 10, label: 'Dread', fade: 3, layers: SHOW.sections[0].layers });
    expect(s.sections[1].layers).not.toBe(s.sections[0].layers);
    valid(s);
  });

  it('a split under 1 s from an edge returns the input', () => {
    expect(applyEdit(SHOW, { kind: 'split', section: 0, t: 0.5 })).toBe(SHOW);
    expect(applyEdit(SHOW, { kind: 'split', section: 0, t: 9.5 })).toBe(SHOW);
    expect(applyEdit(SHOW, { kind: 'split', section: 7, t: 5 })).toBe(SHOW);
  });

  it('merge keeps the first one’s layers and label and the second one’s end; the last section returns the input', () => {
    const s = applyEdit(SHOW, { kind: 'merge', section: 0 });
    expect(s.sections).toHaveLength(2);
    expect(s.sections[0]).toEqual({ start: 0, end: 20, label: 'Dread', layers: SHOW.sections[0].layers });
    valid(s);
    expect(applyEdit(SHOW, { kind: 'merge', section: 2 })).toBe(SHOW);
  });

  it('addLayer adds on top or at a place; a widget already there returns the input', () => {
    const s = applyEdit(SHOW, { kind: 'addLayer', section: 1, widget: 'casket' });
    expect(s.sections[1].layers.map((l) => l.widget)).toEqual(['kandinsky', 'casket']);
    const t = applyEdit(SHOW, { kind: 'addLayer', section: 1, widget: 'flee', at: 0 });
    expect(t.sections[1].layers.map((l) => l.widget)).toEqual(['flee', 'kandinsky']);
    expect(applyEdit(SHOW, { kind: 'addLayer', section: 2, widget: 'casket' })).toBe(SHOW);
    valid(s); valid(t);
  });

  it('moveLayer and removeLayer', () => {
    const m = applyEdit(SHOW, { kind: 'moveLayer', section: 0, from: 0, to: 1 });
    expect(m.sections[0].layers.map((l) => l.widget)).toEqual(['current', 'squares']);
    expect(applyEdit(SHOW, { kind: 'moveLayer', section: 0, from: 0, to: 5 }).sections[0].layers.map((l) => l.widget)).toEqual(['current', 'squares']);
    expect(applyEdit(SHOW, { kind: 'moveLayer', section: 0, from: 1, to: 1 })).toBe(SHOW);
    const r = applyEdit(SHOW, { kind: 'removeLayer', section: 2, layer: 0 });
    expect(r.sections[2].layers.map((l) => l.widget)).toEqual(['casket']);
    expect(applyEdit(SHOW, { kind: 'removeLayer', section: 2, layer: 4 })).toBe(SHOW);
    valid(m); valid(r);
  });

  it('setKnob sets a value; null takes the key away, and an empty knobs with it', () => {
    const s = applyEdit(SHOW, { kind: 'setKnob', section: 1, layer: 0, key: 'size', value: 1.2 });
    expect(s.sections[1].layers[0].knobs).toEqual({ size: 1.2 });
    const d = applyEdit(SHOW, { kind: 'setKnob', section: 1, layer: 0, key: 'edges', value: { base: 0.4, drive: '+level' } });
    expect(d.sections[1].layers[0].knobs).toEqual({ edges: { base: 0.4, drive: '+level' } });
    const n = applyEdit(SHOW, { kind: 'setKnob', section: 0, layer: 1, key: 'size', value: null });
    expect(n.sections[0].layers[1]).toEqual({ widget: 'current' });
    expect('knobs' in n.sections[0].layers[1]).toBe(false);
    valid(s); valid(d); valid(n);
  });

  it('setSection sets the label and clamps the fade to 0..10', () => {
    const s = applyEdit(SHOW, { kind: 'setSection', section: 1, patch: { label: 'Storm', fade: 14 } });
    expect(s.sections[1]).toMatchObject({ label: 'Storm', fade: 10 });
    expect(applyEdit(SHOW, { kind: 'setSection', section: 1, patch: { fade: -1 } }).sections[1].fade).toBe(0);
    expect('label' in applyEdit(SHOW, { kind: 'setSection', section: 0, patch: { label: '  ' } }).sections[0]).toBe(false);
    valid(s);
  });

  it('never mutates its input (the fixture is deep-frozen) and leaves other sections shared', () => {
    const s = applyEdit(SHOW, { kind: 'setKnob', section: 1, layer: 0, key: 'size', value: 2 });
    expect(s.sections[0]).toBe(SHOW.sections[0]);
    expect(s.sections[2]).toBe(SHOW.sections[2]);
  });
});
