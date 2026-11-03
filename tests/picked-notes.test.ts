/// <reference types="node" />
// On a set of picks the composer chose the notes, so a widget's own idea of which notes count gives way (x.picked).
// Off picks these widgets are as they were.
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { newFeatures } from '../src/widgets/features';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib, ToolDef, WidgetCtx } from '../src/widgets/types';

const icon = { ink: '#fff', rng: () => () => 0.5 } as unknown as IconLib;
const tool = (id: string): ToolDef => instantiate(id, readFileSync(new URL(`../lab/tools/${id}.js`, import.meta.url), 'utf8'), { icon, chords: [] });
const attack = (t: number, m: number, v: number, d = 0.5): Chord => ({ t, notes: [{ m, v, d }], vel: v, lo: m, hi: m });

/** A context that takes every call, and counts the rectangles and what is painted. */
function ctxOf(t: ToolDef, picked: boolean) {
  const rects: number[] = [], base: Record<string, unknown> = { canvas: { width: 1280, height: 720 } };
  let calls = 0;
  const g: unknown = new Proxy(base, {
    get: (o, k) => (k in o ? o[k as string] : k === 'fillRect' ? (_x: number, _y: number, w: number) => { calls++; rects.push(w); }
      : () => { calls++; return g; }),
    set: (o, k, v) => { o[k as string] = v; return true; },
  });
  const x = {
    g, W: 1280, H: 720, canvas: base.canvas, t: 0, dt: 1 / 60, now: 0, moment: 'dread', level: 0.5, rate: 1, picked, feat: newFeatures(),
    rnd: (a = 0, b = 1) => (a + b) / 2, sounding: () => [], top: () => null, pitch01: (m: number) => m / 127,
    p: (key: string) => t.params?.find((q) => q.key === key)?.value,
  } as unknown as WidgetCtx;
  return { x, rects, calls: () => calls };
}

beforeAll(() => {
  vi.stubGlobal('window', globalThis); vi.stubGlobal('NOTES', []);
  const canvas = () => { const c = ctxOf({} as ToolDef, false).x.g; return { width: 0, height: 0, getContext: () => c }; };
  vi.stubGlobal('document', { createElement: canvas });
});
beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.99); });

describe('Dread squares', () => {
  const play = (picked: boolean, m: number, v = 80) => {
    const t = tool('squares'), c = ctxOf(t, picked);
    t.reset?.(c.x); t.onChord?.(attack(1, m, v), c.x); t.frame?.(c.x);
    return c.rects;
  };
  it('off picks, only notes below its limit make a square', () => {
    expect(play(false, 40).length).toBe(1);
    expect(play(false, 84)).toEqual([]);
  });
  it('on picks, every note makes a square', () => {
    for (const m of [29, 49, 50, 62, 86, 108]) expect(play(true, m).length, `midi ${m}`).toBe(1);
  });
  it('a picked note over the limit is its smallest size, never gone or inside out', () => {
    const atLimit = play(true, 50)[0], high = play(true, 108)[0], low = play(true, 40)[0];
    expect(high).toBeGreaterThan(40);
    expect(high).toBe(atLimit);
    expect(low).toBeGreaterThan(atLimit);
  });
  it('a low note is the same square on picks and off', () => {
    expect(play(true, 40)).toEqual(play(false, 40));
  });
});

describe('Flee', () => {
  const painted = (picked: boolean, m: number) => {
    const t = tool('flee'), c = ctxOf(t, picked);
    t.reset?.(c.x); t.frame?.(c.x);
    const before = c.calls();
    t.onChord?.(attack(1, m, 80), c.x); t.frame?.(c.x);
    return c.calls() - before;
  };
  it('off picks a low note calls up nothing, and a high one only by chance', () => {
    expect(painted(false, 40)).toBe(painted(false, 41));
    expect(painted(false, 84)).toBe(painted(false, 40));
  });
  it('on picks any note calls up a shape, however the dice fall', () => {
    expect(painted(true, 84)).toBeGreaterThan(painted(false, 84));
    expect(painted(true, 40)).toBeGreaterThan(painted(false, 40));
  });
});

describe('Martin', () => {
  const inkAfter = (picked: boolean, v: number) => {
    const t = tool('martin'), c = ctxOf(t, picked), alphas: number[] = [];
    Object.defineProperty(c.x.g, 'globalAlpha', { set: (a: number) => { alphas.push(a); }, get: () => 1, configurable: true });
    t.reset?.(c.x); t.onChord?.(attack(1, 60, v), c.x);
    for (let i = 0; i < 60; i++) t.frame?.(c.x);
    return alphas.reduce((a, b) => a + b, 0);
  };
  it('on picks a loud note marks about as much as a soft one', () => {
    expect(inkAfter(true, 110)).toBeCloseTo(inkAfter(true, 60), 1);
    expect(inkAfter(false, 110)).toBeLessThan(inkAfter(false, 60));
  });
});
