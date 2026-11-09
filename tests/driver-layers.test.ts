// labLayerSpecs and labLayers (src/widgets/driver.ts): the lab's load-order and slot contract with the studio's runtime
// (render.html?layers=). Load order is part of the pixels through load-time randomness, and lab/index.html applyLayers
// keeps the same rules by hand: TOOL_IDS order, then entry order; an instance is own when it listens to a part or has
// a curve; a plain entry (no listen, or 'all') keeps the base instance's key, so a curve on it updates the base in place.
import { describe, expect, it } from 'vitest';
import { labLayerSpecs, labLayers, labLayerKey, type LabLayer } from '../src/widgets/driver';
import type { Slot, WidgetRuntime } from '../src/widgets/runtime';
import type { LabMoment, Pivot, Region } from '../src/widgets/types';

const TOOL_IDS = ['squares', 'strings', 'kandinsky', 'timeslice'];
const curve: Pivot[] = [{ t: 0, v: 0 }, { t: 10, v: 1 }];
const box = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4, feather: 0.2, fit: 'contain' } as unknown as Region;

describe('labLayerKey', () => {
  it('is the widget id unless the entry listens to a part other than all', () => {
    expect(labLayerKey({ widget: 'strings' })).toBe('strings');
    expect(labLayerKey({ widget: 'strings', listen: 'all' })).toBe('strings');
    expect(labLayerKey({ widget: 'strings', listen: 'melody' })).toBe('strings@melody');
    expect(labLayerKey({ widget: 'strings', listen: 'family:strings' })).toBe('strings@family:strings');
  });
});

describe('labLayerSpecs', () => {
  it('lists the instances in TOOL_IDS order, then entry order, whatever order the entries come in', () => {
    const layers: LabLayer[] = [
      { widget: 'kandinsky', listen: 'bassline' },
      { widget: 'strings', listen: 'melody' },
      { widget: 'strings', listen: 'bassline' },
      { widget: 'squares', listen: 'high' },
    ];
    expect(labLayerSpecs(TOOL_IDS, layers).map((s) => s.key)).toEqual(['squares@high', 'strings@melody', 'strings@bassline', 'kandinsky@bassline']);
  });

  it('a listening instance is own and carries its listen; a plain entry without a curve needs nothing new', () => {
    const specs = labLayerSpecs(TOOL_IDS, [{ widget: 'strings', listen: 'melody' }, { widget: 'squares' }, { widget: 'kandinsky', listen: 'all', region: box }]);
    expect(specs).toEqual([{ key: 'strings@melody', widget: 'strings', listen: 'melody', own: true }]);
  });

  it('a plain entry with a curve keeps the base key (so runtime.load only sets own on the base, in place)', () => {
    expect(labLayerSpecs(TOOL_IDS, [{ widget: 'squares', intensity: curve }])).toEqual([{ key: 'squares', widget: 'squares', own: true }]);
    expect(labLayerSpecs(TOOL_IDS, [{ widget: 'squares', listen: 'all', intensity: curve }])).toEqual([{ key: 'squares', widget: 'squares', own: true }]);
    // an empty curve is no curve
    expect(labLayerSpecs(TOOL_IDS, [{ widget: 'squares', intensity: [] }])).toEqual([]);
  });

  it('skips entries for widgets the lab does not have', () => {
    expect(labLayerSpecs(TOOL_IDS, [{ widget: 'nope', listen: 'melody' }, { widget: 'timeslice', listen: 'low' }]).map((s) => s.key)).toEqual(['timeslice@low']);
  });
});

/** A runtime that records what labLayers asks of it; loaded() is the instance keys in load order. */
function fakeRuntime(order: string[]) {
  const steps: { t: number; dt: number; slots: Slot[] }[] = [], moments: string[] = [], resets: number[] = [];
  const rt = {
    loaded: () => order,
    setMoment: (m: string) => { moments.push(m); },
    reset: (t: number) => { resets.push(t); },
    step: (t: number, dt: number, slots: readonly Slot[]) => { steps.push({ t, dt, slots: [...slots] }); },
  } as unknown as WidgetRuntime;
  return { rt, steps, moments, resets };
}
const MOMENTS: LabMoment[] = [[0, 'calm'], [5, 'storm']];

describe('labLayers', () => {
  // What render-page loads: the base tools in TOOL_IDS order, then labLayerSpecs's new keys.
  const layers: LabLayer[] = [
    { widget: 'strings', listen: 'bassline', region: box },
    { widget: 'squares', intensity: curve },
    { widget: 'strings', listen: 'melody', intensity: curve },
  ];
  const order = [...TOOL_IDS, ...labLayerSpecs(TOOL_IDS, layers).map((s) => s.key).filter((k) => !TOOL_IDS.includes(k))];

  it('draws the only widgets and every widget with an entry, in load order, a widget with entries as its instances in entry order', () => {
    const f = fakeRuntime(order);
    labLayers(f.rt, ['kandinsky'], layers, MOMENTS).step(1, 1 / 60);
    expect(f.steps).toHaveLength(1);
    expect(f.steps[0].slots).toEqual([
      { id: 'squares', receiving: true, weight: 1, layer: { pivots: curve } },
      { id: 'strings@bassline', receiving: true, weight: 1, layer: { region: box } },
      { id: 'strings@melody', receiving: true, weight: 1, layer: { pivots: curve } },
      { id: 'kandinsky', receiving: true, weight: 1 },
    ]);
    // the routed keys' own load-order places (after the base tools) give them no slot of their own
    expect(f.steps[0].slots.filter((s) => s.id === 'strings@melody')).toHaveLength(1);
  });

  it('carries "keep the strongest" with a curve, and drops it without one', () => {
    const f = fakeRuntime(TOOL_IDS);
    labLayers(f.rt, [], [{ widget: 'squares', intensity: curve, thin: 'loud' }, { widget: 'kandinsky', thin: 'loud' }], MOMENTS).step(1, 1 / 60);
    expect(f.steps[0].slots.find((s) => s.id === 'squares')?.layer).toEqual({ pivots: curve, thin: 'loud' });
    expect(f.steps[0].slots.find((s) => s.id === 'kandinsky')?.layer).toBeUndefined();
  });

  it('a plain entry without a curve or region is the base slot with no layer; a widget neither only nor entered does not draw', () => {
    const f = fakeRuntime(TOOL_IDS);
    labLayers(f.rt, [], [{ widget: 'timeslice' }], MOMENTS).step(0.5, 0.5);
    expect(f.steps[0].slots).toEqual([{ id: 'timeslice', receiving: true, weight: 1 }]);
  });

  it('probe sets one widget\'s weight on every one of its slots and draws it even without an entry', () => {
    const f = fakeRuntime(order);
    labLayers(f.rt, [], layers, MOMENTS, { id: 'strings', weight: 0.25 }).step(1, 1 / 60);
    expect(f.steps[0].slots.map((s) => [s.id, s.weight])).toEqual([['squares', 1], ['strings@bassline', 0.25], ['strings@melody', 0.25]]);
    const g = fakeRuntime(order);
    labLayers(g.rt, [], [], MOMENTS, { id: 'kandinsky', weight: 0.5 }).step(1, 1 / 60);
    expect(g.steps[0].slots).toEqual([{ id: 'kandinsky', receiving: true, weight: 0.5 }]);
  });

  it('sets the moment before each step and passes resets through', () => {
    const f = fakeRuntime(order), s = labLayers(f.rt, ['squares'], [], MOMENTS);
    s.step(1, 1 / 60); s.step(6, 1 / 60); s.reset(3);
    expect(f.moments).toEqual(['calm', 'storm']);
    expect(f.resets).toEqual([3]);
  });
});
