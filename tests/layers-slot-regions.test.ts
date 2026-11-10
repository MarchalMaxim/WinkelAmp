/// <reference types="node" />
// lab/layers/slot.js, the region part: which region a slot is seen in, and the spot and window statements in
// order, on recording fake canvases.
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
  return { key: 'rorschach', widget: 'rorschach', salt: WA.fnv32('rorschach'), notes, chords, ci: 0, pulse: { level: 0, rate: 0, hit: 0 },
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
  it('hands what the widget queues to the host\'s queue: each pass, nested ones too, runs later between a copy of the stage and the paste through the mask', async () => {
    const log: string[] = [], { h } = host(log), i = inst(), errs: string[] = [];
    const real = globalThis.queueMicrotask;
    h.call = (_inst, fn) => {
      if (fn === 'frame') queueMicrotask(() => { log.push('hop 1'); queueMicrotask(() => { log.push('hop 2'); throw new Error('boom'); }); });
    };
    (h as LayerHost & { error(i: InstanceState, e: unknown): void }).error = (j, e) => errs.push(`${j.key}: ${String(e)}`);
    WA.drawLayered(h, slot(i, { layer: { region: { ...full('spot'), x: 0.25, w: 0.5 } } }));
    expect(globalThis.queueMicrotask).toBe(real);
    expect(log).not.toContain('hop 1');   // not at the slot
    const atSlot = log.length;
    await new Promise<void>((res) => setTimeout(res, 0));
    const later = log.slice(atSlot);
    const k1 = later.indexOf('hop 1'), k2 = later.indexOf('hop 2');
    expect(k1).toBeGreaterThan(0);
    expect(k2).toBeGreaterThan(k1);
    expect(later.slice(0, k1)).toContain('sg.drawImage(g,0,0)');   // the stage kept before the pass
    for (const [from, to] of [[k1, k2], [k2, later.length]]) {
      const seg = later.slice(from, to);
      expect(seg).toContain('sg.globalCompositeOperation=destination-out');
      expect(seg).toContain('g.drawImage(sg,0,0)');   // pasted back through the mask after the pass
    }
    expect(errs).toEqual(['rorschach: Error: boom']);   // the error kept, the paste still done
    expect(later[later.length - 1]).toBe('g.restore()');
  });
  it('runs a queued pass clipped to the region\'s footprint (the rotated box, or the ellipse in it), then lifts the clip before the paste', async () => {
    for (const [shape, path] of [['rect', 'g.rect(-160,-90,320,180)'], ['ellipse', `g.ellipse(0,0,160,90,0,0,${Math.round(2 * Math.PI * 1000) / 1000})`]] as const) {
      const log: string[] = [], { h } = host(log, 2), i = inst();
      h.call = (_inst, fn) => { if (fn === 'frame') queueMicrotask(() => { log.push('pass'); }); };
      WA.drawLayered(h, slot(i, { layer: { region: { ...full('spot'), shape, x: 0.25, y: 0.25, w: 0.125, h: 0.125, rot: 90 } } }));
      const atSlot = log.length;
      await new Promise<void>((res) => setTimeout(res, 0));
      const later = log.slice(atSlot), k = (s: string) => later.indexOf(s);
      expect(k('pass'), shape).toBeGreaterThan(0);
      const save = k('g.save()'), clip = k('g.clip()'), pass = k('pass');
      expect(save).toBeGreaterThan(k('sg.drawImage(g,0,0)'));   // the stage kept, then the clip
      expect(later.slice(save, clip)).toEqual(['g.save()', 'g.setTransform(1,0,0,1,640,360)', `g.rotate(${Math.round((Math.PI / 2) * 1000) / 1000})`,
        'g.beginPath()', path]);
      expect(later.slice(clip + 1, pass)).toEqual(['g.beginPath()', 'g.setTransform(2,0,0,2,0,0)']);   // widget units at S = 2
      expect(later[pass + 1]).toBe('g.restore()');   // the clip lifted before pasteThrough
      expect(later.indexOf('sg.globalCompositeOperation=destination-out', pass)).toBeGreaterThan(pass + 1);
    }
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
    expect(log.slice(-3)).toEqual(['g.drawImage(m2,-320,-180,640,360)', 'g.restore()', 'sounding']);   // then the window's put-back
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
  it('hands an error in queued code to h.error, drains the rest of the queue and stamps', () => {
    const log: string[] = [], { h } = host(log), i = inst(), errs: string[] = [];
    h.call = (_inst, fn) => {
      if (fn === 'frame') { queueMicrotask(() => { throw new Error('boom'); }); queueMicrotask(() => log.push('post after')); }
    };
    (h as LayerHost & { error(i: InstanceState, e: unknown): void }).error = (j, e) => errs.push(`${j.key}: ${String(e)}`);
    WA.drawLayered(h, slot(i, { layer: { region: full('window') } }));
    expect(errs).toEqual(['rorschach: Error: boom']);
    expect(log).toContain('post after');
    expect(log.some((l) => l.startsWith('g.drawImage('))).toBe(true);
  });
});

describe("the 'clear' stamp", () => {
  const px = (...v: number[]) => [...WA.clearPixels(new Uint8ClampedArray(v))];

  it('black goes see-through, and anything lit stays solid', () => {
    expect(px(0, 0, 0, 255)[3]).toBe(0);
    expect(px(200, 10, 0, 255)).toEqual([200, 10, 0, 255]);   // hi × 3 is past 1: solid, the colour as it was
    expect(px(85, 85, 85, 255)).toEqual([85, 85, 85, 255]);   // a third of full is already solid
  });

  it('a dim pixel is its colour at less alpha, and looks the same over black', () => {
    const [r, g, b, a] = px(30, 15, 0, 255);
    expect([r, g, b, a]).toEqual([85, 42, 0, 90]);            // a = 30 × 3, rgb = rgb / a
    expect(Math.round(r * a / 255)).toBe(30);
    expect(Math.round(g * a / 255)).toBe(15);
  });

  it('what is already part clear keeps that (the edge of a letterbox)', () => {
    expect(px(0, 0, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(px(200, 0, 0, 128)[3]).toBe(128);
  });

  it('is the default for a window; an explicit over or lighten does not run it', () => {
    const keyed = (blend?: Region['blend']) => {
      const log: string[] = [], stage = fakeCanvas('g', log);
      const h: LayerHost = { ctx: { g: stage.getContext('2d'), canvas: stage, sounding() {} } as unknown as WidgetCtx,
        g: stage.getContext('2d')!, canvas: stage, S: 1, call() {}, scratch: () => fakeCanvas('sg', log),
        windowOf: () => fakeCanvas('win', log), make: (w, hh) => fakeCanvas('m', log, w, hh) };
      const region = { ...full('window'), fit: 'cover' } as Region;
      if (blend) region.blend = blend; else delete region.blend;
      const keep = WA.clearBox; let n = 0;
      WA.clearBox = () => { n++; };
      try { WA.drawLayered(h, slot(inst(), { layer: { region } })); } finally { WA.clearBox = keep; }
      return n;
    };
    expect([keyed(), keyed('clear'), keyed('over'), keyed('lighten')]).toEqual([1, 1, 0, 0]);
  });
});
