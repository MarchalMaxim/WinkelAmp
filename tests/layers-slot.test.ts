/// <reference types="node" />
// lab/layers/slot.js (T12, the no-region part): what an instance hears, its own pulse, its weight, and the per-slot
// statements in the runtime's order, on a recording fake canvas.
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { groupChords, soundingAt } from '../src/widgets/chords';
import { advanceFeatures, newFeatures } from '../src/widgets/features';
import type { InstanceState, LayerHost, LayeredSlot } from '../src/widgets/layers';
import type { Chord, Note, Pivot, WidgetCtx } from '../src/widgets/types';

const WA = loadLayers();

const notes: Note[] = [];
for (let i = 0; i < 400; i++) notes.push([i * 0.25, i * 0.25 + 0.4, 40 + ((i * 7) % 40), 30 + ((i * 13) % 90)]);
const chords = groupChords(notes);

function inst(over: Partial<InstanceState> = {}): InstanceState {
  return { key: 'strings', widget: 'strings', salt: WA.fnv32('strings'), notes, chords, ci: 0, pulse: { level: 0, rate: 0 },
    feat: newFeatures(), own: false, routed: false, persist: 'redraw', win: null, ...over };
}
function slot(i: InstanceState, over: Partial<LayeredSlot> = {}): LayeredSlot {
  return { inst: i, receiving: true, weight: 1, layer: {}, fired: [], lastT: 0, t: 0, dt: 1 / 60, ...over };
}

/** A context that writes down what is done to it. */
function recorder(name: string, log: string[]): CanvasRenderingContext2D {
  const set = (k: string) => (v: unknown) => log.push(`${name}.${k}=${String(v)}`);
  const o: Record<string, unknown> = {};
  for (const k of ['globalCompositeOperation', 'globalAlpha', 'filter', 'shadowBlur']) Object.defineProperty(o, k, { set: set(k) });
  for (const k of ['save', 'restore', 'drawImage', 'setTransform']) o[k] = (...a: unknown[]) => log.push(`${name}.${k}(${a.map((x) => (typeof x === 'object' ? 'canvas' : String(x))).join(',')})`);
  return o as unknown as CanvasRenderingContext2D;
}
function host(log: string[], S = 1): LayerHost {
  const g = recorder('g', log), sg = recorder('sg', log);
  const canvas = { getContext: () => g } as unknown as HTMLCanvasElement;
  const sc = { getContext: () => sg } as unknown as HTMLCanvasElement;
  return {
    ctx: {} as WidgetCtx, g, canvas, S,
    call: (i, fn, ch) => { log.push(`call ${i.key} ${fn}${ch ? ` ${ch.t}` : ''}`); },
    scratch: () => { log.push('scratch'); return sc; },
    windowOf: () => { throw new Error('no windows in T12'); },
    make: () => { throw new Error('no make in T12'); },
  };
}

describe('coldInstance', () => {
  it('starts at the first chord after t, with a zero pulse and fresh features', () => {
    const i = inst({ ci: 3, pulse: { level: 0.7, rate: 2 } });
    i.feat.pitch = 0.9; i.feat.density = 0.4;
    WA.coldInstance(i, 10);
    expect(i.ci).toBe(chords.findIndex((c) => c.t > 10));
    expect(i.pulse).toEqual({ level: 0, rate: 0 });
    expect(i.feat).toEqual(newFeatures());
    expect(WA.newFeatures()).toEqual(newFeatures());
    WA.coldInstance(i, 1e9);
    expect(i.ci).toBe(chords.length);
  });
});

describe('deliveredChords', () => {
  it('unrouted, no curve: the step\'s fired chords, the same array', () => {
    const fired = chords.slice(4, 7);
    expect(WA.deliveredChords(slot(inst(), { fired }))).toBe(fired);
  });
  it('routed: its own chords crossing (lastT, t], advancing ci', () => {
    const i = inst({ routed: true });
    WA.coldInstance(i, 2);
    const got = WA.deliveredChords(slot(i, { t: 3.1, fired: chords.slice(0, 1) }));
    expect(got).toEqual(chords.filter((c) => c.t > 2 && c.t <= 3.1));
    expect(WA.deliveredChords(slot(i, { t: 3.1 }))).toEqual([]);
  });
  it('a constant-1 curve keeps everything; 0 keeps nothing; 0.5 keeps exactly what passes predicts', () => {
    const fired = chords.slice(0, 200);
    expect(WA.deliveredChords(slot(inst(), { fired, layer: { pivots: [{ t: 0, v: 1 }] } }))).toEqual(fired);
    expect(WA.deliveredChords(slot(inst(), { fired, layer: { pivots: [{ t: 0, v: 0 }] } }))).toEqual([]);
    const half = WA.deliveredChords(slot(inst(), { fired, layer: { pivots: [{ t: 0, v: 0.5 }] } }));
    expect(half).toEqual(fired.filter((c) => WA.passes(c.t, 0.5, WA.fnv32('strings'))));
    expect(half.length).toBeGreaterThan(70);
    expect(half.length).toBeLessThan(130);
  });
  it('reads the curve at each chord\'s own time, frozen at until', () => {
    const pivots: Pivot[] = [{ t: 0, v: 0 }, { t: 10, v: 0 }, { t: 10, v: 1 }];
    const fired = chords.filter((c) => c.t > 8 && c.t < 12);
    expect(WA.deliveredChords(slot(inst(), { fired, layer: { pivots } }))).toEqual(fired.filter((c) => c.t >= 10));
    expect(WA.deliveredChords(slot(inst(), { fired, layer: { pivots, until: 9 } }))).toEqual([]);
  });
});

describe('layerWeight', () => {
  it('is the weight without a curve, weight × vis(a) with one', () => {
    expect(WA.layerWeight(slot(inst(), { weight: 0.3 }))).toBe(0.3);
    const pivots: Pivot[] = [{ t: 0, v: 0.5 }];
    expect(WA.layerWeight(slot(inst(), { weight: 0.5, layer: { pivots } }))).toBe(0.5 * WA.vis(0.5, 'redraw'));
    expect(WA.layerWeight(slot(inst({ persist: 'strokes' }), { weight: 1, layer: { pivots } }))).toBe(0.5);
    expect(WA.layerWeight(slot(inst(), { t: 50, layer: { pivots: [{ t: 0, v: 0 }, { t: 100, v: 1 }], until: 20 } })))
      .toBe(WA.vis(0.2, 'redraw'));
  });
});

describe('drawLayered', () => {
  it('at weight 1: no snapshot; attacks, then save/frame/restore and the four resets, in the runtime\'s order', () => {
    const log: string[] = [];
    const fired = chords.slice(2, 4);
    WA.drawLayered(host(log), slot(inst(), { fired, layer: { pivots: [{ t: 0, v: 1 }] } }));
    expect(log).toEqual([
      `call strings onChord ${fired[0].t}`, `call strings onChord ${fired[1].t}`,
      'g.save()', 'call strings frame', 'g.restore()',
      'g.globalCompositeOperation=source-over', 'g.globalAlpha=1', 'g.filter=none', 'g.shadowBlur=0',
    ]);
  });
  it('below 1: snapshot first, paste back at 1 − w (identity transform at S > 1); not receiving: no attacks', () => {
    const log: string[] = [];
    WA.drawLayered(host(log, 2), slot(inst(), { receiving: false, fired: chords.slice(0, 3), weight: 0.25 }));
    expect(log).toEqual([
      'scratch', 'sg.globalCompositeOperation=copy', 'sg.drawImage(canvas,0,0)', 'sg.globalCompositeOperation=source-over',
      'g.save()', 'call strings frame', 'g.restore()',
      'g.globalCompositeOperation=source-over', 'g.globalAlpha=1', 'g.filter=none', 'g.shadowBlur=0',
      'g.setTransform(1,0,0,1,0,0)', 'g.globalAlpha=0.75', 'g.drawImage(canvas,0,0)', 'g.globalAlpha=1',
    ]);
  });
  it('at a = 0 the frame still runs and the paste-back hides it all', () => {
    const log: string[] = [];
    WA.drawLayered(host(log), slot(inst(), { fired: chords.slice(0, 3), layer: { pivots: [{ t: 0, v: 0 }] } }));
    expect(log).toContain('call strings frame');
    expect(log.some((l) => l.startsWith('call strings onChord'))).toBe(false);
    expect(log).toContain('g.globalAlpha=1');
    expect(log[log.length - 2]).toBe('g.drawImage(canvas,0,0)');
    expect(log[log.length - 3]).toBe('g.globalAlpha=1');   // 1 − 0
  });
  it('an own instance\'s pulse advances on what it was delivered, bit for bit advanceFeatures', () => {
    const i = inst({ own: true, routed: true }), ref = { level: 0, rate: 0 }, rf = newFeatures();
    WA.coldInstance(i, 0);
    let ci = chords.findIndex((c) => c.t > 0);   // cold at 0: the chord at 0 is behind it
    for (let k = 1; k <= 600; k++) {
      const t = k / 60, fired: Chord[] = [];
      while (ci < chords.length && chords[ci].t <= t) fired.push(chords[ci++]);
      WA.drawLayered(host([]), slot(i, { t, dt: 1 / 60 }));
      advanceFeatures(ref, rf, fired, soundingAt(notes, t), 1 / 60);
    }
    expect(i.pulse).toEqual(ref);
    expect(i.feat).toEqual(rf);
  });
});
