import { describe, expect, it } from 'vitest';
import { Conductor, samePreview, showInstances, type ShowRuntime, type ShowSlot } from '../src/studio/show/conductor';
import { applyEdit } from '../src/studio/show/edit';
import type { Show } from '../src/studio/show/show';
import type { InstanceSpec, KnobMap, WidgetMeta } from '../src/widgets/types';

const META: Record<string, WidgetMeta> = Object.fromEntries(['squares', 'kandinsky', 'casket', 'strings'].map((id) => [id, {
  id, name: id, blurb: '', tag: '', verdict: null,
  params: [{ key: 'size', min: 0, max: 2, value: 1 }],
}]));
const meta = (id: string) => META[id];

/** squares plain; strings on the melody (routed); kandinsky with a curve in section 1 only. */
const SHOW: Show = {
  version: 2, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, layers: [{ widget: 'squares' }, { widget: 'strings', listen: 'melody', knobs: { size: 2 } }, { widget: 'kandinsky' }] },
    { start: 10, end: 20, fade: 2, layers: [{ widget: 'kandinsky', intensity: [{ t: 10, v: 0 }, { t: 20, v: 1 }] }, { widget: 'casket' }] },
    { start: 20, end: 30, fade: 0, layers: [{ widget: 'squares' }] },
  ],
};

type Call = [string, ...unknown[]];
class FakeRuntime implements ShowRuntime {
  calls: Call[] = [];
  knobs: Record<string, KnobMap> = {};
  load(specs: readonly (string | InstanceSpec)[]) { this.calls.push(['load', specs.map((s) => (typeof s === 'string' ? s : { ...s }))]); }
  setKnobs(id: string, k: KnobMap) { this.knobs[id] = k; this.calls.push(['setKnobs', id, k]); }
  setMoment(label: string) { this.calls.push(['setMoment', label]); }
  reset(t: number) { this.calls.push(['reset', t]); }
  resetWidget(id: string) { this.calls.push(['resetWidget', id]); }
  step(t: number, dt: number, slots: readonly ShowSlot[]) { this.calls.push(['step', t, dt, slots.map((s) => ({ ...s }))]); }
  steps() { return this.calls.filter((c) => c[0] === 'step') as ['step', number, number, ShowSlot[]][]; }
  loads() { return this.calls.filter((c) => c[0] === 'load').map((c) => c[1]); }
}

describe('Conductor with instances', () => {
  it('loads plain widgets by id and routed or curved instances as specs with own', () => {
    expect(showInstances(SHOW).map((s) => [s.key, s.own])).toEqual([['squares', false], ['strings@melody', true], ['kandinsky', true], ['casket', false]]);
    const rt = new FakeRuntime();
    new Conductor(rt, SHOW, meta);
    expect(rt.loads()).toEqual([[
      'squares',
      { key: 'strings@melody', widget: 'strings', listen: 'melody', own: true },
      { key: 'kandinsky', widget: 'kandinsky', own: true },
      'casket',
    ]]);
  });

  it('knobs go to the instance key, read from the widget\'s meta', () => {
    const rt = new FakeRuntime();
    new Conductor(rt, SHOW, meta);
    expect(rt.knobs['strings@melody']).toEqual({ size: { base: 2, drive: '', depth: 0.5 } });
    expect(rt.knobs.strings).toBeUndefined();
  });

  it('slots carry layer.pivots (until for a decaying one); plain slots have no layer', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    c.reset(4.9);
    c.step(5, 0.1);
    let [, , , slots] = rt.steps()[0];
    expect(slots.map((s) => s.id)).toEqual(['squares', 'strings@melody', 'kandinsky']);
    for (const s of slots) expect('layer' in s).toBe(false);   // section 0: no curve, no region: today's path
    c.reset(14.9);
    c.step(15, 0.1);
    slots = rt.steps()[1][3];
    expect(slots.find((s) => s.id === 'kandinsky')!.layer).toEqual({ pivots: [{ t: 10, v: 0 }, { t: 20, v: 1 }] });
    expect('layer' in slots.find((s) => s.id === 'casket')!).toBe(false);
    c.step(20.5, 0.1);   // kandinsky leaves at 20 with fade 0: gone; a decaying curved instance carries until
    const decaying = applyEdit(SHOW, { kind: 'setSection', section: 2, patch: { fade: 2 } });
    const rt2 = new FakeRuntime(), c2 = new Conductor(rt2, decaying, meta);
    c2.reset(19.9);
    c2.step(20.5, 0.6);
    expect(rt2.steps()[0][3].find((s) => s.id === 'kandinsky')).toMatchObject({ receiving: false, layer: { pivots: [{ t: 10, v: 0 }, { t: 20, v: 1 }], until: 20 } });
  });

  it('a region goes into the slot\'s layer', () => {
    const s = applyEdit(SHOW, { kind: 'setLayer', section: 0, layer: 0, patch: { region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.2, h: 0.2 } } });
    const rt = new FakeRuntime(), c = new Conductor(rt, s, meta);
    c.reset(5);
    c.step(5.1, 0.1);
    expect(rt.steps()[0][3][0]).toEqual({ id: 'squares', receiving: true, weight: 1, layer: { region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.2, h: 0.2 } } });
  });

  it('setShow loads a new part, and loads again an instance a curve made own', () => {
    const rt = new FakeRuntime(), c = new Conductor(rt, SHOW, meta);
    let s = applyEdit(SHOW, { kind: 'addLayer', section: 0, widget: 'strings', listen: 'bassline' });
    c.setShow(s);
    expect(rt.loads()[1]).toEqual([{ key: 'strings@bassline', widget: 'strings', listen: 'bassline', own: true }]);
    s = applyEdit(s, { kind: 'setLayer', section: 2, layer: 0, patch: { intensity: [{ t: 25, v: 0.5 }] } });
    c.setShow(s);
    expect(rt.loads()[2]).toEqual([{ key: 'squares', widget: 'squares', own: true }]);
    c.setShow(s);
    expect(rt.loads()).toHaveLength(3);
  });

  it('samePreview: false after an intensity edit inside the preview window, true after one outside it', () => {
    const t = 17;   // QUICK reaches back to 16, SETTLED to 13: section 1 after its fade
    const inside = applyEdit(SHOW, { kind: 'setLayer', section: 1, layer: 0, patch: { intensity: [{ t: 10, v: 0 }, { t: 20, v: 0.5 }] } });
    expect(samePreview(SHOW, inside, t)).toBe(false);
    // squares is not drawn from 13 to 17 (its decay ended at 12): a curve on it in section 2 changes nothing here
    const outside = applyEdit(SHOW, { kind: 'setLayer', section: 2, layer: 0, patch: { intensity: [{ t: 25, v: 0.5 }] } });
    expect(samePreview(SHOW, outside, t)).toBe(true);
    // a region or a listen inside the window changes the picture
    expect(samePreview(SHOW, applyEdit(SHOW, { kind: 'setLayer', section: 1, layer: 1, patch: { region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.2, h: 0.2 } } }), t)).toBe(false);
    expect(samePreview(SHOW, applyEdit(SHOW, { kind: 'setLayer', section: 1, layer: 1, patch: { listen: 'melody' } }), t)).toBe(false);
  });

  it('samePreview: a curve added in a later section makes an instance drawn in the window own, so the picture changes', () => {
    // casket plays in section 1 (drawn at 15); a curve on it in a new section after makes it own everywhere
    const later = applyEdit(applyEdit(SHOW, { kind: 'addLayer', section: 2, widget: 'casket' }), { kind: 'setLayer', section: 2, layer: 1, patch: { intensity: [{ t: 25, v: 0.5 }] } });
    const plain = applyEdit(SHOW, { kind: 'addLayer', section: 2, widget: 'casket' });
    expect(samePreview(SHOW, plain, 15)).toBe(true);
    expect(samePreview(plain, later, 15)).toBe(false);
  });
});
