/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { canonicalShow, repairShow, validateShow, type Show, type ShowContext } from '../src/studio/show/show';

const c: ShowContext = { duration: 100, widgets: loadCatalogue().widgets };
const good = (): Show => ({
  version: 1, id: 'demo', song: 'demo', title: 'Demo', composer: { by: 'user', at: '2026-10-31T00:00:00.000Z' },
  sections: [
    { start: 0, end: 30, label: 'Dread', layers: [{ widget: 'squares' }] },
    { start: 30, end: 60, label: 'Agitato', fade: 3, layers: [{ widget: 'kandinsky', knobs: { edges: 0.9 } }] },
    { start: 60, end: 100, fade: 0, layers: [{ widget: 'kandinsky', knobs: { edges: { base: 0.5, drive: '-level', depth: 0.3 } } }, { widget: 'casket', restart: true }] },
  ],
});
const spans = (...s: [number, number][]): Show => ({ ...good(), sections: s.map(([start, end]) => ({ start, end, layers: [{ widget: 'kandinsky' }] })) });
const withSection = (i: number, patch: object): Show => { const s = good(); Object.assign(s.sections[i], patch); return s; };
const errs = (x: unknown) => validateShow(x, c).errors;
const warns = (x: unknown) => validateShow(x, c).warnings;
const at = (issues: { path: string; message: string }[], path: string) => issues.filter((i) => i.path === path);

describe('validateShow', () => {
  it('passes a good show', () => {
    expect(validateShow(good(), c)).toEqual({ errors: [], warnings: [] });
  });

  it('names both sections and the times of an overlap', () => {
    const e = at(errs(spans([0, 50], [45, 100])), 'sections[1].start');
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/overlap/);
    expect(e[0].message).toMatch(/45/);
    expect(e[0].message).toMatch(/50/);
    expect(e[0].message).toMatch(/sections\[0\]/);
  });

  it('names both sections and the times of a gap', () => {
    const e = at(errs(spans([0, 40], [50, 100])), 'sections[1].start');
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/gap/);
    expect(e[0].message).toMatch(/40/);
    expect(e[0].message).toMatch(/50/);
  });

  it('allows 0.05 s of slack at the joins and 0.5 s at the end', () => {
    expect(errs(spans([0.04, 50], [50.04, 99.6]))).toEqual([]);
  });

  it('wants the show to start at 0 and end at the song', () => {
    expect(at(errs(spans([2, 50], [50, 100])), 'sections[0].start')).toHaveLength(1);
    expect(at(errs(spans([0, 50], [50, 90])), 'sections[1].end')).toHaveLength(1);
    expect(errs(spans([0, 50], [50, 90])).length).toBe(1);
    expect(validateShow(spans([0, 50], [50, 90])).errors).toEqual([]);   // no duration: no end check
  });

  it('rejects empty, unsorted and backwards sections', () => {
    expect(at(errs({ ...good(), sections: [] }), 'sections')).toHaveLength(1);
    expect(errs(spans([50, 100], [0, 50])).some((e) => /sort/.test(e.message))).toBe(true);
    expect(at(errs(spans([0, 50], [50, 50], [50, 100])), 'sections[1].end')).toHaveLength(1);
  });

  it('rejects unknown widgets and a widget twice in a section', () => {
    expect(at(errs(withSection(0, { layers: [{ widget: 'nope' }] })), 'sections[0].layers[0].widget')).toHaveLength(1);
    expect(at(errs(withSection(0, { layers: [{ widget: 'squares' }, { widget: 'squares' }] })), 'sections[0].layers[1].widget')).toHaveLength(1);
    expect(at(errs(withSection(0, { layers: [{ widget: 'shatter' }] })), 'sections[0].layers[0].widget')).toHaveLength(1);   // dropped
  });

  it('rejects bad drives, depths, versions and ids', () => {
    expect(at(errs(withSection(1, { layers: [{ widget: 'kandinsky', knobs: { edges: { drive: '+loud' } } }] })), 'sections[1].layers[0].knobs.edges.drive')).toHaveLength(1);
    expect(at(errs(withSection(1, { layers: [{ widget: 'kandinsky', knobs: { edges: { depth: 2 } } }] })), 'sections[1].layers[0].knobs.edges.depth')).toHaveLength(1);
    expect(at(errs({ ...good(), version: 2 }), 'version')).toHaveLength(1);
    expect(at(errs({ ...good(), id: 'Not A Slug' }), 'id')).toHaveLength(1);
    expect(at(errs({ ...good(), song: '../x' }), 'song')).toHaveLength(1);
    expect(at(errs(withSection(1, { layers: [{ widget: 'kandinsky', knobs: { edges: 'high' } }] })), 'sections[1].layers[0].knobs.edges')).toHaveLength(1);
    expect(errs(null)).toHaveLength(1);
  });

  it('warns about unknown knobs, bases out of range, wild fades, crowded and short sections, typos', () => {
    expect(at(warns(withSection(0, { layers: [{ widget: 'squares', knobs: { nonsense: 1 } }] })), 'sections[0].layers[0].knobs.nonsense')).toHaveLength(1);
    expect(at(warns(withSection(0, { layers: [{ widget: 'squares', knobs: { size: 9 } }] })), 'sections[0].layers[0].knobs.size')).toHaveLength(1);
    expect(at(warns(withSection(0, { layers: [{ widget: 'squares', knobs: { size: { base: -1 } } }] })), 'sections[0].layers[0].knobs.size.base')).toHaveLength(1);
    expect(at(warns(withSection(1, { fade: 12 })), 'sections[1].fade')).toHaveLength(1);
    const seven = ['squares', 'kandinsky', 'casket', 'rorschach', 'current', 'strings', 'fields'].map((widget) => ({ widget }));
    expect(at(warns(withSection(0, { layers: seven })), 'sections[0].layers')).toHaveLength(1);
    expect(at(warns(withSection(0, { layers: [{ widget: 'squares', knob: { size: 1 } }] })), 'sections[0].layers[0].knob')).toHaveLength(1);
    expect(at(warns({ ...good(), sectoins: [] }), 'sectoins')).toHaveLength(1);
    expect(at(warns(spans([0, 50], [50, 50.5], [50.5, 100])), 'sections[1]')).toHaveLength(1);
    expect(at(warns(withSection(1, { layers: [] })), 'sections[1].layers')[0].message).toMatch(/no layers/);
    expect(errs(withSection(1, { layers: [] }))).toEqual([]);
    for (const s of [withSection(1, { fade: 12 }), withSection(0, { layers: seven })]) expect(errs(s)).toEqual([]);
  });
});

describe('repairShow', () => {
  it('ends an overlapping section where the next starts', () => {
    const { show, fixed } = repairShow(spans([0, 50], [45, 100]), c);
    expect(show.sections.map((s) => [s.start, s.end])).toEqual([[0, 45], [45, 100]]);
    expect(fixed.length).toBeGreaterThan(0);
    expect(validateShow(show, c).errors).toEqual([]);
  });

  it('closes a gap by extending the earlier section', () => {
    const { show } = repairShow(spans([0, 40], [50, 100]), c);
    expect(show.sections.map((s) => [s.start, s.end])).toEqual([[0, 50], [50, 100]]);
  });

  it('snaps the ends to 0 and the duration', () => {
    const { show } = repairShow(spans([2, 50], [50, 90]), c);
    expect(show.sections.map((s) => [s.start, s.end])).toEqual([[0, 50], [50, 100]]);
  });

  it('merges a section under 1 s into the previous one', () => {
    const { show } = repairShow(spans([0, 50], [50, 50.4], [50.4, 100]), c);
    expect(show.sections.map((s) => [s.start, s.end])).toEqual([[0, 50.4], [50.4, 100]]);
  });

  it('cuts a show longer than the song (a shorter recording under the same id) down to the song', () => {
    for (const [duration, want] of [[20, [[0, 20]]], [45, [[0, 30], [30, 45]]], [60.5, [[0, 30], [30, 60.5]]]] as const) {
      const cd = { ...c, duration };
      const { show, fixed } = repairShow(spans([0, 30], [30, 60], [60, 100]), cd);
      expect(show.sections.map((s) => [s.start, s.end])).toEqual(want);
      expect(validateShow(show, cd).errors).toEqual([]);
      expect(fixed.map((f) => f.message).join('\n')).not.toMatch(/lasted -/);
    }
  });

  it('drops unknown and doubled widgets, clamps bases, drives and depths, sorts', () => {
    const s = withSection(1, { fade: 12, layers: [{ widget: 'nope' }, { widget: 'kandinsky', knobs: { edges: 4, rings: { base: -1, drive: '+loud', depth: 3 } } }, { widget: 'kandinsky' }] });
    s.sections.reverse();
    const { show, fixed } = repairShow(s, c);
    expect(show.sections[1].layers).toEqual([{ widget: 'kandinsky', knobs: { edges: 1, rings: { base: 0, depth: 1 } } }]);
    expect(show.sections[1].fade).toBe(10);
    expect(fixed.length).toBeGreaterThanOrEqual(5);
    expect(validateShow(show, c)).toEqual({ errors: [], warnings: [] });
  });

  it('leaves a good show alone and never mutates its input', () => {
    const s = good(), before = JSON.stringify(s);
    const r = repairShow(s, c);
    expect(r.fixed).toEqual([]);
    expect(r.show).toEqual(s);
    expect(JSON.stringify(s)).toBe(before);
    repairShow(spans([0, 50], [45, 100]), c);
  });
});

describe('canonicalShow', () => {
  it('is a fixed point of parse ∘ canonical', () => {
    const once = canonicalShow(good());
    expect(canonicalShow(JSON.parse(once) as Show)).toBe(once);
    expect(once.endsWith('}\n')).toBe(true);
    expect(once).toContain('\n  "version": 1,');
  });

  it('orders the keys and rounds times to ms', () => {
    const messy = {
      sections: [{ layers: [{ restart: true, knobs: { size: { depth: 0.5, drive: '', base: 1 } }, widget: 'squares' }], fade: 2.00049, label: 'a', end: 100.0004, start: 0.0001 }],
      composer: { at: 'x', by: 'claude' }, title: 'T', song: 's', id: 's', version: 1,
    } as unknown as Show;
    const o = JSON.parse(canonicalShow(messy));
    expect(Object.keys(o)).toEqual(['version', 'id', 'song', 'title', 'composer', 'sections']);
    expect(Object.keys(o.composer)).toEqual(['by', 'at']);
    expect(Object.keys(o.sections[0])).toEqual(['start', 'end', 'label', 'fade', 'layers']);
    expect(Object.keys(o.sections[0].layers[0])).toEqual(['widget', 'knobs', 'restart']);
    expect(Object.keys(o.sections[0].layers[0].knobs.size)).toEqual(['base', 'drive', 'depth']);
    expect([o.sections[0].start, o.sections[0].end, o.sections[0].fade]).toEqual([0, 100, 2]);
  });
});
