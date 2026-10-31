/// <reference types="node" />
// lab/layers/slot.js, the region part (T15): which region a slot is seen in, and the spot and window statements in
// order, on recording fake canvases (the pixels are proven in Chrome by npm run runtime-check).
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { groupChords } from '../src/widgets/chords';
import { newFeatures } from '../src/widgets/features';
import type { InstanceState, LayerHost, LayeredSlot, WaLayers } from '../src/widgets/layers';
import type { Note, Region, WidgetCtx } from '../src/widgets/types';

type Slots = WaLayers & { slotRegion(s: LayeredSlot): Region | null; clearWindow(c: HTMLCanvasElement): void };
const WA = loadLayers() as Slots;

const notes: Note[] = [];
for (let i = 0; i < 40; i++) notes.push([i * 0.25, i * 0.25 + 0.4, 40 + ((i * 7) % 40), 30 + ((i * 13) % 90)]);
const chords = groupChords(notes);

function inst(over: Partial<InstanceState> = {}): InstanceState {
  return { key: 'rorschach', widget: 'rorschach', salt: WA.fnv32('rorschach'), notes, chords, ci: 0, pulse: { level: 0, rate: 0 },
    feat: newFeatures(), own: false, routed: false, persist: 'strokes', win: null, ...over };
}
function slot(i: InstanceState, over: Partial<LayeredSlot> = {}): LayeredSlot {
  return { inst: i, receiving: true, weight: 1, layer: {}, fired: [], lastT: 0, t: 1 / 60, dt: 1 / 60, ...over };
}

/** A canvas whose context writes down every call and every property set, as `name.op(args)` / `name.prop=value`. */
function fakeCanvas(name: string, log: string[], w = 1280, h = 720): HTMLCanvasElement {
  const arg = (x: unknown) => (x && typeof x === 'object' ? ((x as { name?: string }).name ?? 'obj') : typeof x === 'number' ? String(Math.round(x * 1000) / 1000) : String(x));
  const store: Record<string, unknown> = {};
  const g = new Proxy(store, {
    get(_, p: string) {
      if (p in store) return store[p];
      if (p === 'canvas') return c;
      return (...a: unknown[]) => { log.push(`${name}.${p}(${a.map(arg).join(',')})`); return { addColorStop() {} }; };
    },
    set(_, p: string, v) { store[p] = v; log.push(`${name}.${p}=${arg(v)}`); return true; },
  });
  const c = { name, width: w, height: h, getContext: () => g } as unknown as HTMLCanvasElement;
  return c;
}

function host(log: string[], S = 1) {
  const canvas = fakeCanvas('g', log, 1280 * S, 720 * S), sc = fakeCanvas('sg', log, 1280 * S, 720 * S);
  const ctx = { sounding: () => { log.push('sounding'); return []; } } as unknown as WidgetCtx;
  let n = 0;
  const h: LayerHost = {
    ctx, g: canvas.getContext('2d')!, canvas, S,
    call: (_i, fn, ch) => { log.push(`call ${fn}${ch ? ` ${ch.t}` : ''} on ${(h.ctx.canvas as unknown as { name: string } | undefined)?.name ?? 'stage'}`); },
    scratch: () => sc,
    windowOf: (i) => (i.win ??= fakeCanvas('win', log, 1280 * S, 720 * S)),
    make: (w, hh) => { n++; return fakeCanvas(`m${n}`, log, w, hh); },
  };
  return { h, made: () => n };
}

const full = (mode: 'spot' | 'window'): Region => ({ mode, shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, rot: 0, blend: 'over', fit: 'stretch' });

describe('slotRegion', () => {
  it('none without a region; the region; on its way from the last section\'s while gliding', () => {
    const i = inst(), a = full('window'), b: Region = { ...a, x: 0.25, w: 0.5 };
    expect(WA.slotRegion(slot(i))).toBeNull();
    expect(WA.slotRegion(slot(i, { layer: { region: b } }))).toBe(b);
    expect(WA.slotRegion(slot(i, { layer: { region: b, glide: { from: a, u: 0.5 } } }))).toEqual(WA.glideRegion(a, b, 0.5));
    expect(WA.slotRegion(slot(i, { layer: { region: b, glide: { from: a, u: 1 } } }))).toEqual(b);
  });
});

describe('spot', () => {
  it('keeps the picture, runs the widget on the stage, then pastes the picture back through the mask at w', () => {
    const log: string[] = [], { h } = host(log), ch = chords.filter((c) => WA.passes(c.t, 0.5, WA.fnv32('rorschach'))).slice(0, 1);
    WA.drawLayered(h, slot(inst(), { fired: ch, layer: { region: { ...full('spot'), x: 0.25, w: 0.5, rot: 90 }, pivots: [{ t: 0, v: 0.5 }] } }));
    const at = (s: string) => { const k = log.indexOf(s); expect(k, s).toBeGreaterThanOrEqual(0); return k; };
    const copy = at('sg.drawImage(g,0,0)');
    const frame = at('call frame on stage'), out = at('sg.globalCompositeOperation=destination-out');
    expect(copy).toBeLessThan(at(`call onChord ${ch[0].t} on stage`));
    expect(frame).toBeLessThan(out);
    expect(log[out + 1]).toBe(`sg.globalAlpha=${Math.round(WA.vis(0.5, 'strokes') * 1000) / 1000}`);   // the instance's class
    expect(log).toContain('sg.setTransform(1,0,0,1,320,360)');
    expect(log).toContain(`sg.rotate(${Math.round((Math.PI / 2) * 1000) / 1000})`);
    expect(log).toContain('sg.drawImage(m1,-320,-360,640,720)');   // the mask, at the box
    expect(log.slice(-5)).toEqual(['g.setTransform(1,0,0,1,0,0)', 'g.globalCompositeOperation=source-over', 'g.globalAlpha=1',
      'g.drawImage(sg,0,0)', 'g.restore()']);
  });
  it('builds the mask once while the region keeps its size, feather and class', () => {
    const log: string[] = [], { h, made } = host(log), i = inst();
    const r = { ...full('spot'), shape: 'ellipse' as const, feather: 0.3, w: 0.4, h: 0.4 };
    WA.drawLayered(h, slot(i, { layer: { region: r } }));
    WA.drawLayered(h, slot(i, { layer: { region: { ...r, x: 0.2, rot: 30 } } }));   // moved and turned: the same mask
    expect(made()).toBe(1);
    WA.drawLayered(h, slot(i, { layer: { region: { ...r, w: 0.5 } } }));
    expect(made()).toBe(2);
  });
});

describe('window', () => {
  it('the window takes the fade and the calls through its view, then is stamped in the box at w, lightened', () => {
    const log: string[] = [], { h } = host(log), i = inst(), ch = chords.filter((c) => WA.passes(c.t, 0.5, WA.fnv32('rorschach'))).slice(0, 1);
    const region: Region = { ...full('window'), blend: 'lighten', x: 0.75, y: 0.25, w: 0.5, h: 0.5, fit: 'cover' };
    WA.drawLayered(h, slot(i, { fired: ch, weight: 0.8, layer: { region, pivots: [{ t: 0, v: 0.5 }] } }));
    expect(h.ctx.canvas).toBeUndefined();   // the stage's ctx is back
    const k = (s: string) => log.indexOf(s);
    expect(k('win.fillStyle=#000')).toBeLessThan(k('sounding'));   // the window starts black, then the step's top
    expect(k('win.fillStyle=rgba(0,0,0,0.12)')).toBeGreaterThan(k('sounding'));   // and the fade
    expect(log).toContain('win.globalCompositeOperation=color-burn');
    expect(k(`call onChord ${ch[0].t} on win`)).toBeGreaterThan(k('win.globalCompositeOperation=color-burn'));
    expect(k('call frame on win')).toBeGreaterThan(k('win.save()'));
    expect(log).toContain('m2.drawImage(win,0,0,1280,720,0,0,640,360)');   // cover, the same aspect: all of it
    expect(log).toContain('m2.globalCompositeOperation=destination-in');
    expect(log).toContain('g.setTransform(1,0,0,1,960,180)');
    expect(log).toContain('g.globalCompositeOperation=lighten');
    expect(log).toContain(`g.globalAlpha=${Math.round(0.8 * WA.vis(0.5, 'redraw') * 1000) / 1000}`);   // redraw, not strokes
    expect(log[log.length - 2]).toBe('g.drawImage(m2,-320,-180,640,360)');
    expect(log.some((l) => l.startsWith('sg.'))).toBe(false);   // no snapshot of the stage
  });
  it('starts black when it was not drawn in the last step, and only then', () => {
    const log: string[] = [], { h } = host(log), i = inst(), layer = { region: full('window') };
    const clears = () => log.filter((l) => l === 'win.fillStyle=#000').length;
    WA.drawLayered(h, slot(i, { lastT: 0, t: 0.1, layer }));
    WA.drawLayered(h, slot(i, { lastT: 0.1, t: 0.2, layer }));
    expect(clears()).toBe(1);
    WA.drawLayered(h, slot(i, { lastT: 0.3, t: 0.4, layer }));   // back after a step without it
    expect(clears()).toBe(2);
  });
  it('runs what the widget queued during its calls on its window, before the stamp', () => {
    const log: string[] = [], { h } = host(log), i = inst();
    const real = globalThis.queueMicrotask;
    h.call = (_inst, fn) => {
      if (fn === 'frame') { const x = h.ctx; queueMicrotask(() => { log.push(`post on ${(x.canvas as unknown as { name: string }).name}`); queueMicrotask(() => log.push('post 2')); }); }
    };
    WA.drawLayered(h, slot(i, { layer: { region: full('window') } }));
    expect(globalThis.queueMicrotask).toBe(real);
    const stamp = log.findIndex((l) => l.startsWith('g.drawImage('));
    expect(log.indexOf('post on win')).toBeGreaterThan(-1);
    expect(log.indexOf('post 2')).toBeLessThan(stamp);
  });
});
