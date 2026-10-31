import { describe, expect, it } from 'vitest';
import { Conductor, samePreview } from '../src/studio/show/conductor';
import { applyEdit, type ShowEdit } from '../src/studio/show/edit';
import type { Show } from '../src/studio/show/show';
import type { RuntimeLike, Slot } from '../src/widgets/runtime';
import type { KnobMap, WidgetMeta } from '../src/widgets/types';

const META: Record<string, WidgetMeta> = Object.fromEntries(['squares', 'kandinsky', 'casket', 'lewitt'].map((id) => [id, {
  id, name: id, blurb: '', tag: '', verdict: null,
  params: [{ key: 'size', min: 0, max: 2, value: 1 }, { key: 'edges', min: 0, max: 1, value: 0.5, drive: '+level' as const }],
}]));
const meta = (id: string) => META[id];

const SHOW: Show = {
  version: 1, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, label: 'A', layers: [{ widget: 'squares' }, { widget: 'kandinsky' }] },
    { start: 10, end: 20, label: 'A', fade: 3, layers: [{ widget: 'kandinsky', knobs: { edges: 0.9 } }, { widget: 'casket' }] },
    { start: 20, end: 30, fade: 0, layers: [{ widget: 'lewitt' }] },
  ],
};

type Call = [string, ...unknown[]];
class FakeRuntime implements RuntimeLike {
  calls: Call[] = [];
  knobs: Record<string, KnobMap> = {};
  load(ids: readonly string[]) { this.calls.push(['load', [...ids]]); }
  setKnobs(id: string, k: KnobMap) { this.knobs[id] = k; this.calls.push(['setKnobs', id, k]); }
  setMoment(label: string) { this.calls.push(['setMoment', label]); }
  reset(t: number) { this.calls.push(['reset', t]); }
  resetWidget(id: string) { this.calls.push(['resetWidget', id]); }
  step(t: number, dt: number, slots: readonly Slot[]) { this.calls.push(['step', t, dt, slots.map((s) => ({ ...s }))]); }
  names() { return this.calls.map((c) => c[0]); }
  steps() { return this.calls.filter((c) => c[0] === 'step') as ['step', number, number, Slot[]][]; }
}

function play(c: Conductor, from: number, to: number, dt = 0.05) {
  for (let t = from + dt; t <= to + 1e-9; t += dt) c.step(Math.round(t * 1e6) / 1e6, dt);
}

describe('Conductor', () => {
  it('loads every show widget in first-appearance order, with resolved knobs', () => {
    const rt = new FakeRuntime();
    new Conductor(rt, SHOW, meta);
    expect(rt.calls[0]).toEqual(['load', ['squares', 'kandinsky', 'casket', 'lewitt']]);
    expect(rt.knobs.squares).toEqual({ size: { base: 1, drive: '', depth: 0.5 }, edges: { base: 0.5, drive: '+level', depth: 0.5 } });
  });

  it('crossing a boundary resets the entering widget before the step; the leaving one decays first, weight < 1', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(9.9);
    rt.calls = [];
    c.step(10.1, 0.2);
    const names = rt.names();
    expect(names.indexOf('resetWidget')).toBeGreaterThanOrEqual(0);
    expect(rt.calls[names.indexOf('resetWidget')]).toEqual(['resetWidget', 'casket']);
    expect(names.indexOf('resetWidget')).toBeLessThan(names.indexOf('step'));
    const [, t, dt, slots] = rt.steps()[0];
    expect([t, dt]).toEqual([10.1, 0.2]);
    expect(slots[0]).toMatchObject({ id: 'squares', receiving: false });
    expect(slots[0].weight).toBeLessThan(1);
    expect(slots.slice(1).map((s) => [s.id, s.receiving, s.weight])).toEqual([['kandinsky', true, 1], ['casket', true, 1]]);
    expect(rt.knobs.kandinsky.edges.base).toBe(0.9);
  });

  it('every section gets its own moment, even two with the same label (lewitt opens a new wall at each)', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(0);
    play(c, 0, 25, 0.5);
    const moments = rt.calls.filter((x) => x[0] === 'setMoment').map((x) => x[1]);
    expect(new Set(moments).size).toBe(3);
    expect(moments.indexOf(moments[0])).toBe(0);
  });

  it('after a seek nothing decays', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(10.5);
    rt.calls = [];
    c.step(10.55, 0.05);
    expect(rt.steps()[0][3].map((s) => s.id)).toEqual(['kandinsky', 'casket']);
    expect(rt.names()).not.toContain('resetWidget');
  });

  it('the moment is set before the runtime resets, so a seek does not look like a section change', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    rt.calls = [];
    c.reset(25);
    expect(rt.names().slice(0, 2)).toEqual(['setMoment', 'reset']);
  });

  it('setShow with a changed knob sets the knobs, loads new widgets and never resets', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(5); c.step(5.05, 0.05);
    rt.calls = [];
    const next: Show = { ...SHOW, sections: [{ ...SHOW.sections[0], layers: [{ widget: 'squares', knobs: { size: 1.7 } }, { widget: 'kandinsky' }] }, ...SHOW.sections.slice(1)] };
    c.setShow(next);
    expect(rt.names()).not.toContain('reset');
    expect(rt.knobs.squares.size.base).toBe(1.7);
    const withNew: Show = { ...next, sections: [{ ...next.sections[0], layers: [...next.sections[0].layers, { widget: 'flee' }] }, ...next.sections.slice(1)] };
    rt.calls = [];
    c.setShow(withNew);
    expect(rt.calls[0]).toEqual(['load', ['flee']]);
    expect(rt.names()).not.toContain('reset');
  });

  it('preview(t) is a paused seek: reset one second before, then 60 steps up to t', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    rt.calls = [];
    c.preview(15);
    expect(rt.calls.find((x) => x[0] === 'reset')).toEqual(['reset', 14]);
    const steps = rt.steps();
    expect(steps).toHaveLength(60);
    expect(steps[59][1]).toBeCloseTo(15, 9);
    expect(steps[0][2]).toBeCloseTo(1 / 60, 9);
    expect(c.preview(0.5)).toBeUndefined();
    expect(rt.calls.filter((x) => x[0] === 'reset').at(-1)).toEqual(['reset', 0]);
  });
});

describe('samePreview: would preview(t) draw the same picture for the edited show?', () => {
  const ed = (...es: ShowEdit[]) => es.reduce((s, e) => applyEdit(s, e), SHOW);

  it('edits to sections the preview does not reach leave it alone', () => {
    expect(samePreview(SHOW, SHOW, 5)).toBe(true);
    expect(samePreview(SHOW, ed({ kind: 'addLayer', section: 1, widget: 'lewitt' }), 5)).toBe(true);
    expect(samePreview(SHOW, ed({ kind: 'setKnob', section: 0, layer: 0, key: 'size', value: 1.8 }), 25)).toBe(true);
    expect(samePreview(SHOW, ed({ kind: 'addLayer', section: 0, widget: 'casket' }), 25)).toBe(true);
    expect(samePreview(SHOW, ed({ kind: 'setSection', section: 1, patch: { fade: 1 } }), 5)).toBe(true);
  });

  it('a knob or a layer of the section at the playhead changes it', () => {
    expect(samePreview(SHOW, ed({ kind: 'setKnob', section: 0, layer: 0, key: 'size', value: 1.8 }), 5)).toBe(false);
    expect(samePreview(SHOW, ed({ kind: 'addLayer', section: 0, widget: 'casket' }), 5)).toBe(false);
    expect(samePreview(SHOW, ed({ kind: 'removeLayer', section: 2, layer: 0 }), 25)).toBe(false);
    expect(samePreview(SHOW, ed({ kind: 'moveLayer', section: 0, from: 0, to: 1 }), 5)).toBe(false);
  });

  it('so does the fade the playhead is in, and the knobs of what is fading out', () => {
    expect(samePreview(SHOW, ed({ kind: 'setSection', section: 1, patch: { fade: 1 } }), 11)).toBe(false);
    expect(samePreview(SHOW, ed({ kind: 'setKnob', section: 0, layer: 0, key: 'size', value: 1.8 }), 11)).toBe(false);
  });

  it('a boundary moved across the playhead or into the preview second changes it; the far end of its section does not', () => {
    expect(samePreview(SHOW, ed({ kind: 'moveBoundary', index: 1, t: 9 }), 9.5)).toBe(false);
    expect(samePreview(SHOW, ed({ kind: 'moveBoundary', index: 1, t: 10.2 }), 10.5)).toBe(false);
    expect(samePreview(SHOW, ed({ kind: 'moveBoundary', index: 1, t: 12 }), 5)).toBe(true);
  });

  it('a split at the playhead and a new name change nothing on screen', () => {
    expect(samePreview(SHOW, ed({ kind: 'split', section: 0, t: 5 }), 5)).toBe(true);
    expect(samePreview(SHOW, ed({ kind: 'setSection', section: 0, patch: { label: 'Opening' } }), 5)).toBe(true);
  });
});
