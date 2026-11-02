import { describe, expect, it } from 'vitest';
import { clipsAt, edgeSeconds, edgeWeight, entriesBetween, scheduleAt } from '../src/studio/show/schedule';
import type { Clip, Show } from '../src/studio/show/show';

const clip = (id: string, start: number, end: number, track: number, more: Partial<Clip> = {}): Clip => ({ id, start, end, track, widget: 'squares', ...more });
const show = (...clips: Clip[]): Show => ({ version: 3, id: 'demo', song: 'demo', clips });

describe('edgeWeight', () => {
  const c = clip('a', 10, 20, 0, { fade: 2 });
  it('fades in and out inside the clip, full in between', () => {
    expect(edgeWeight(c, 10)).toBe(0);
    expect(edgeWeight(c, 11)).toBeCloseTo(0.25, 9);
    expect(edgeWeight(c, 12)).toBe(1);
    expect(edgeWeight(c, 15)).toBe(1);
    expect(edgeWeight(c, 18)).toBe(1);
    expect(edgeWeight(c, 19)).toBeCloseTo(0.25, 9);
    expect(edgeWeight(c, 20)).toBe(0);
  });
  it('a fade is at most half the clip, so the two meet in the middle', () => {
    const short = clip('a', 0, 1, 0, { fade: 5 });
    expect(edgeSeconds(short)).toBe(0.5);
    expect(edgeWeight(short, 0.5)).toBe(1);
    expect(edgeWeight(short, 0.25)).toBeCloseTo(0.25, 9);
  });
  it('the default fade, and 0 is a cut', () => {
    expect(edgeWeight(clip('a', 0, 10, 0), 0.5)).toBeCloseTo(0.25, 9);
    expect(edgeWeight(clip('a', 0, 10, 0, { fade: 0 }), 0)).toBe(1);
  });
});

describe('scheduleAt', () => {
  const s = show(clip('top', 0, 30, 2), clip('mid', 5, 15, 1, { widget: 'kandinsky' }), clip('low', 10, 20, 0, { widget: 'casket' }), clip('later', 40, 50, 0));
  it('the clips playing at t, bottom track first, all receiving', () => {
    expect(scheduleAt(s, 12).map((w) => w.clip)).toEqual(['low', 'mid', 'top']);
    expect(scheduleAt(s, 12).every((w) => w.receiving)).toBe(true);
    expect(scheduleAt(s, 3).map((w) => w.clip)).toEqual(['top']);
  });
  it('start ≤ t < end, and a gap is empty', () => {
    expect(clipsAt(s, 5).map((c) => c.id)).toContain('mid');
    expect(clipsAt(s, 15).map((c) => c.id)).not.toContain('mid');
    expect(scheduleAt(s, 35)).toEqual([]);
    expect(scheduleAt(s, 400)).toEqual([]);
  });
  it('an instance per clip: the same widget over itself is two', () => {
    const w = scheduleAt(show(clip('a', 0, 10, 0), clip('b', 0, 10, 1)), 5);
    expect(w.map((x) => x.id)).toEqual(['squares#a', 'squares#b']);
  });
  it('carries what the clip has, and nothing it does not', () => {
    const r = { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5 } as const, p = [{ t: 1, v: 1 }];
    const [w] = scheduleAt(show(clip('a', 0, 10, 0, { listen: 'melody', region: r, intensity: p, knobs: { size: 1 } })), 5);
    expect(w).toEqual({ id: 'squares@melody#a', clip: 'a', widget: 'squares', receiving: true, weight: 1, knobs: { size: 1 }, listen: 'melody', region: r, pivots: p });
    expect(scheduleAt(show(clip('b', 0, 10, 0)), 5)[0]).toEqual({ id: 'squares#b', clip: 'b', widget: 'squares', receiving: true, weight: 1, knobs: {} });
  });
  it('depends on the time alone: the same at t from any history', () => {
    expect(scheduleAt(s, 12.25)).toEqual(scheduleAt(JSON.parse(JSON.stringify(s)) as Show, 12.25));
  });
});

describe('entriesBetween', () => {
  const s = show(clip('a', 0, 30, 0), clip('b', 5, 15, 1), clip('c', 5, 6, 2), clip('d', 10, 20, 3));
  it('the clips starting in (t0, t1], not at t0', () => {
    expect(entriesBetween(s, 4.9, 5).map((e) => e.id)).toEqual(['squares#b', 'squares#c']);
    expect(entriesBetween(s, 5, 9)).toEqual([]);
    expect(entriesBetween(s, 0, 10).map((e) => e.at)).toEqual([5, 5, 10]);
    expect(entriesBetween(s, -1, 0).map((e) => e.id)).toEqual(['squares#a']);
  });
});
