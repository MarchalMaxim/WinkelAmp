import { describe, expect, it } from 'vitest';
import { Conductor, SETTLED, momentAt, samePreview, showInstances, showWidgets } from '../src/studio/show/conductor';
import { applyEdit, type ShowEdit } from '../src/studio/show/edit';
import type { Clip, Show } from '../src/studio/show/show';
import type { Slot } from '../src/widgets/runtime';
import type { InstanceSpec, KnobMap, WidgetMeta } from '../src/widgets/types';

const META: Record<string, WidgetMeta> = Object.fromEntries(['squares', 'kandinsky', 'casket', 'lewitt'].map((id) => [id, {
  id, name: id, blurb: '', tag: '', verdict: null,
  params: [{ key: 'size', min: 0, max: 2, value: 1 }, { key: 'edges', min: 0, max: 1, value: 0.5, drive: '+level' as const }],
}]));
const meta = (id: string) => META[id];

const clip = (id: string, start: number, end: number, track: number, widget: string, more: Partial<Clip> = {}): Clip => ({ id, start, end, track, widget, ...more });
const SHOW: Show = {
  version: 3, id: 'demo', song: 'demo',
  clips: [
    clip('c1', 0, 12, 0, 'squares', { fade: 1 }),
    clip('c2', 0, 22, 1, 'kandinsky', { fade: 1, knobs: { edges: 0.9 } }),
    clip('c3', 10, 20, 2, 'casket', { fade: 1 }),
    clip('c4', 11, 18, 3, 'casket', { fade: 1, knobs: { size: 2 } }),
  ],
};

type Call = [string, ...unknown[]];
class FakeRuntime {
  calls: Call[] = [];
  knobs: Record<string, KnobMap> = {};
  load(specs: readonly (string | InstanceSpec)[]) { this.calls.push(['load', [...specs]]); }
  setKnobs(id: string, k: KnobMap) { this.knobs[id] = k; this.calls.push(['setKnobs', id, k]); }
  setMoment(label: string) { this.calls.push(['setMoment', label]); }
  reset(t: number) { this.calls.push(['reset', t]); }
  resetWidget(id: string) { this.calls.push(['resetWidget', id]); }
  step(t: number, dt: number, slots: readonly Slot[]) { this.calls.push(['step', t, dt, slots.map((s) => ({ ...s }))]); }
  names() { return this.calls.map((c) => c[0]); }
  steps() { return this.calls.filter((c) => c[0] === 'step') as ['step', number, number, Slot[]][]; }
}
const slotsOf = (rt: FakeRuntime, t: number) => rt.steps().find((c) => Math.abs(c[1] - t) < 1e-6)?.[3];

function play(c: Conductor, from: number, to: number, dt = 0.05) {
  for (let i = 1; from + i * dt <= to + 1e-9; i++) c.step(Math.round((from + i * dt) * 1e6) / 1e6, dt);
}

describe('showInstances', () => {
  it('one per clip, in the order a show is saved: overlapping copies are distinct', () => {
    expect(showWidgets(SHOW)).toEqual(['squares#c1', 'kandinsky#c2', 'casket#c3', 'casket#c4']);
  });
  it('own: a part or a curve; notes for a set of picks', () => {
    const s: Show = { ...SHOW, clips: [clip('a', 0, 1, 0, 'squares', { listen: 'melody' }), clip('b', 0, 1, 1, 'squares', { intensity: [{ t: 0, v: 1 }] }), clip('c', 0, 1, 2, 'squares', { listen: 'picks:p1' }), clip('d', 0, 1, 3, 'squares')],
      picks: { p1: { notes: [[0, 1, 60, 80]] } } };
    expect(showInstances(s)).toEqual([
      { key: 'squares@melody#a', widget: 'squares', listen: 'melody', own: true },
      { key: 'squares#b', widget: 'squares', own: true },
      { key: 'squares@picks:p1#c', widget: 'squares', listen: 'picks:p1', own: true, notes: [[0, 1, 60, 80]] },
      { key: 'squares#d', widget: 'squares', own: false },
    ]);
  });
});

describe('Conductor', () => {
  it('loads every clip as a spec, with its own resolved knobs', () => {
    const rt = new FakeRuntime();
    new Conductor(rt, SHOW, meta);
    const loaded = rt.calls[0][1] as InstanceSpec[];
    expect(loaded.map((s) => s.key)).toEqual(['squares#c1', 'kandinsky#c2', 'casket#c3', 'casket#c4']);
    expect(loaded.every((s) => typeof s === 'object')).toBe(true);
    expect(rt.knobs['casket#c3'].size.base).toBe(1);
    expect(rt.knobs['casket#c4'].size.base).toBe(2);
  });

  it('crossing a clip start resets it before the step; the slots go bottom track first', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(9.9);
    rt.calls = [];
    c.step(10.1, 0.2);
    const names = rt.names();
    expect(rt.calls[names.indexOf('resetWidget')]).toEqual(['resetWidget', 'casket#c3']);
    expect(names.indexOf('resetWidget')).toBeLessThan(names.indexOf('step'));
    expect(slotsOf(rt, 10.1)!.map((s) => s.id)).toEqual(['squares#c1', 'kandinsky#c2', 'casket#c3']);
  });

  it('each clip fades at its edges, gone at its end, its neighbours untouched', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(10);
    play(c, 10, 13);
    expect(slotsOf(rt, 10.5)!.find((s) => s.id === 'casket#c3')!.weight).toBeCloseTo(0.25, 6);
    expect(slotsOf(rt, 11.5)!.find((s) => s.id === 'squares#c1')!.weight).toBeCloseTo(0.25, 6);
    expect(slotsOf(rt, 11.5)!.find((s) => s.id === 'kandinsky#c2')!.weight).toBe(1);
    expect(slotsOf(rt, 12.5)!.map((s) => s.id)).not.toContain('squares#c1');
  });

  it('a gap has no slots, and the runtime still steps (the canvas keeps fading)', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, { ...SHOW, clips: [clip('a', 0, 5, 0, 'squares')] }, meta);
    c.reset(0);
    c.step(6, 1);
    expect(slotsOf(rt, 6)).toEqual([]);
  });

  it('a seek hands the runtime what playing there does: the same slots from any history', () => {
    const a = new FakeRuntime(), b = new FakeRuntime();
    const ca = new Conductor(a, SHOW, meta), cb = new Conductor(b, SHOW, meta);
    ca.reset(0); play(ca, 0, 12);
    for (const t of [10.5, 11.25, 11.75]) {
      cb.preview(t);
      expect(slotsOf(b, t)).toEqual(slotsOf(a, t));
    }
  });

  it('a preview replays the clip starts it passes, as playing does', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.preview(10.5, { seconds: 1, hz: 20 });
    expect(rt.calls.filter((x) => x[0] === 'resetWidget')).toEqual([['resetWidget', 'casket#c3']]);
    expect(rt.calls.filter((x) => x[0] === 'reset')).toEqual([['reset', 9.5]]);
  });

  it('a live edit never resets the picture, but a clip added at this time starts with its reset', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(5);
    rt.calls = [];
    const added = applyEdit(SHOW, { kind: 'addClip', widget: 'lewitt', start: 4, end: 8 });
    c.setShow(added);
    expect(rt.names()).not.toContain('reset');
    expect((rt.calls.find((x) => x[0] === 'load')![1] as InstanceSpec[]).map((s) => s.key)).toEqual(['lewitt#c5']);
    expect(rt.calls.filter((x) => x[0] === 'resetWidget')).toEqual([['resetWidget', 'lewitt#c5']]);
    rt.calls = [];
    c.setShow(applyEdit(added, { kind: 'setKnob', clip: 'c5', key: 'size', value: 2 }));
    expect(rt.names()).not.toContain('resetWidget');
    expect(rt.knobs['lewitt#c5'].size.base).toBe(2);
  });

  it('a changed part is a new instance: the runtime never re-routes a loaded one', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    rt.calls = [];
    c.setShow(applyEdit(SHOW, { kind: 'setClip', clip: 'c1', patch: { listen: 'melody' } }));
    expect((rt.calls.find((x) => x[0] === 'load')![1] as InstanceSpec[]).map((s) => s.key)).toEqual(['squares@melody#c1']);
  });

  it('a curve added loads the instance again as own', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    rt.calls = [];
    c.setShow(applyEdit(SHOW, { kind: 'setClip', clip: 'c1', patch: { intensity: [{ t: 0, v: 1 }] } }));
    expect(rt.calls.find((x) => x[0] === 'load')![1]).toEqual([{ key: 'squares#c1', widget: 'squares', own: true }]);
  });

  it('the slot carries the curve and the region', () => {
    const r = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5 } as const, p = [{ t: 0, v: 1 }];
    const rt = new FakeRuntime(), c = new Conductor(rt, { ...SHOW, clips: [clip('a', 0, 10, 0, 'squares', { region: r, intensity: p })] }, meta);
    c.reset(4); c.step(5, 1);
    expect(slotsOf(rt, 5)).toEqual([{ id: 'squares#a', receiving: true, weight: 1, layer: { pivots: p, region: r } }]);
  });
});

describe('moments', () => {
  it('follow the song\'s marks, a function of the time alone', () => {
    expect(momentAt([], 5)).toBe('0');
    expect(momentAt([10, 20], 5)).toBe('0');
    expect(momentAt([10, 20], 10)).toBe('1');
    expect(momentAt([10, 20], 25)).toBe('2');
  });
  it('are set when they change, before the reset that remembers them', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta, [10, 20]);
    rt.calls = [];
    c.reset(12);
    expect(rt.names().slice(0, 2)).toEqual(['setMoment', 'reset']);
    expect(rt.calls[0]).toEqual(['setMoment', '1']);
    rt.calls = [];
    c.step(13, 1);
    expect(rt.names()).not.toContain('setMoment');
    c.step(21, 8);
    expect(rt.calls).toContainEqual(['setMoment', '2']);
  });
});

describe('samePreview', () => {
  const edit = (s: Show, e: ShowEdit) => applyEdit(s, e);
  it('an edit to a clip the preview does not reach leaves the picture as it is', () => {
    expect(samePreview(SHOW, edit(SHOW, { kind: 'setKnob', clip: 'c4', key: 'size', value: 1 }), 5)).toBe(true);
    expect(samePreview(SHOW, edit(SHOW, { kind: 'moveClip', clip: 'c4', start: 30, track: 3 }), 5)).toBe(true);
  });
  it('an edit it reaches does not, within the settled warm-up too', () => {
    expect(samePreview(SHOW, edit(SHOW, { kind: 'setKnob', clip: 'c1', key: 'size', value: 2 }), 5)).toBe(false);
    expect(samePreview(SHOW, edit(SHOW, { kind: 'moveClip', clip: 'c4', start: 6, track: 3 }), 5 + SETTLED.seconds)).toBe(false);
    expect(samePreview(SHOW, edit(SHOW, { kind: 'removeClip', clip: 'c3' }), 12)).toBe(false);
    expect(samePreview(SHOW, edit(SHOW, { kind: 'setClip', clip: 'c1', patch: { fade: 4 } }), 2)).toBe(false);
  });
  it('picks count', () => {
    expect(samePreview(SHOW, { ...SHOW, picks: { p1: { notes: [[1, 2, 60, 80]] } } }, 5)).toBe(false);
  });
});
