/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import type { Note, Pivot } from '../src/widgets/types';

const WA = loadLayers();
const P = WA.presets;
const s = { start: 10, end: 30 };

/** Pivots as [t, v, shape?] with t rounded to 1e-9, for comparing. */
const brief = (ps: Pivot[]) => ps.map((p) => (p.shape ? [Math.round(p.t * 1e9) / 1e9, p.v, p.shape] : [Math.round(p.t * 1e9) / 1e9, p.v]));

function sane(ps: Pivot[], span = s) {
  expect(ps.length).toBeLessThanOrEqual(WA.MAX_PIVOTS);
  for (let i = 0; i < ps.length; i++) {
    expect(ps[i].t).toBeGreaterThanOrEqual(span.start);
    expect(ps[i].t).toBeLessThanOrEqual(span.end);
    if (i) expect(ps[i].t).toBeGreaterThanOrEqual(ps[i - 1].t);
  }
}

describe('fades and swell', () => {
  it('fades in and out over the given seconds', () => {
    expect(P.fadeIn(s, 4)).toEqual([{ t: 10, v: 0 }, { t: 14, v: 1 }]);
    expect(P.fadeOut(s, 4)).toEqual([{ t: 26, v: 1 }, { t: 30, v: 0 }]);
    expect(P.fadeIn(s, 40)).toEqual([{ t: 10, v: 0 }, { t: 30, v: 1 }]);
    expect(P.fadeOut(s, 40)).toEqual([{ t: 10, v: 1 }, { t: 30, v: 0 }]);
    sane(P.fadeIn(s, 4)); sane(P.fadeOut(s, 40));
  });

  it('swells: floor, 1 at the peak, floor, eased', () => {
    const w = P.swell(s);
    expect(w).toEqual([{ t: 10, v: 0, shape: 'ease' }, { t: 20, v: 1, shape: 'ease' }, { t: 30, v: 0 }]);
    expect(WA.automationAt(w, 15)).toBe(0.5);
    expect(P.swell(s, { peak: 0.25, floor: 0.3 })).toEqual([{ t: 10, v: 0.3, shape: 'ease' }, { t: 15, v: 1, shape: 'ease' }, { t: 30, v: 0.3 }]);
    sane(w);
  });
});

describe('pulse', () => {
  it('pulses on every 4th beat when the beats cover the span', () => {
    const beats = Array.from({ length: 81 }, (_, i) => i * 0.5);   // 0 … 40
    const p = P.pulse(s, beats, { every: 4 });
    const want: unknown[] = [];
    for (let t = 10; t < 30; t += 2) want.push([t, 1], [t + 1, 0, 'hold']);
    expect(brief(p)).toEqual(want);
    expect(WA.automationAt(p, 10.5)).toBe(0.5);   // falls linearly over half a period
    expect(WA.automationAt(p, 11.5)).toBe(0);     // then held
    sane(p);
  });

  it('builds the grid from the start at the song\'s median gap when the beats do not cover the span', () => {
    const beats = Array.from({ length: 11 }, (_, i) => i * 0.5);   // only 0 … 5
    const p = P.pulse(s, beats, { every: 4, floor: 0.2 });
    expect(brief(p).slice(0, 4)).toEqual([[10, 1], [11, 0.2, 'hold'], [12, 1], [13, 0.2, 'hold']]);
    expect(p.length).toBe(20);
    sane(p);
  });

  it('pulses every N × 0.5 s with no beats, starting with a held floor when the first pulse is late', () => {
    const p = P.pulse(s, [], { every: 4 });
    expect(p.filter((q) => q.v === 1).map((q) => q.t)).toEqual([10, 12, 14, 16, 18, 20, 22, 24, 26, 28]);
    const late = P.pulse(s, [10.7, 11.2, 11.7, 12.2, 12.7, 13.2, 13.7, 14.2, 14.7, 15.2, 15.7, 16.2, 16.7, 17.2, 17.7, 18.2, 18.7, 19.2, 19.7, 20.2, 20.7, 21.2, 21.7, 22.2, 22.7, 23.2, 23.7, 24.2, 24.7, 25.2, 25.7, 26.2, 26.7, 27.2, 27.7, 28.2, 28.7, 29.2, 29.7], { every: 2, floor: 0.1 });
    expect(late[0]).toEqual({ t: 10, v: 0.1, shape: 'hold' });
    expect(late[1]).toEqual({ t: 10.7, v: 1 });
    sane(late);
  });

  it('stays under MAX_PIVOTS by pulsing less often', () => {
    const long = { start: 0, end: 600 };
    const beats = Array.from({ length: 1201 }, (_, i) => i * 0.5);
    const p = P.pulse(long, beats, { every: 1 });
    expect(p.length).toBeLessThanOrEqual(WA.MAX_PIVOTS);
    sane(p, long);
  });
});

describe('gate', () => {
  const curve = (f: (t: number) => number, dur = 40) => ({ hop: 0.1, values: Array.from({ length: dur * 10 }, (_, i) => f(i * 0.1 + 1e-9)) });

  it('opens 0.15 s early with a 0.1 s ramp and closes over 0.1 s', () => {
    const g = P.gate(s, curve((t) => (t >= 15 && t < 20 ? 0.9 : 0.2)), { above: 0.5 });
    expect(brief(g)).toEqual([[14.75, 0], [14.85, 1, 'hold'], [20, 1], [20.1, 0, 'hold']]);
    expect(WA.automationAt(g, 14.85)).toBe(1);
    expect(WA.automationAt(g, 20.1)).toBe(0);
    sane(g);
  });

  it('ignores a 0.2 s blip and bridges a 0.3 s dip', () => {
    expect(P.gate(s, curve((t) => (t >= 15 && t < 15.2 ? 0.9 : 0.2)), { above: 0.5 })).toEqual([]);
    const g = P.gate(s, curve((t) => ((t >= 15 && t < 18) || (t >= 18.3 && t < 22) ? 0.9 : 0.2)), { above: 0.5, floor: 0.25 });
    expect(brief(g)).toEqual([[14.75, 0.25], [14.85, 1, 'hold'], [22, 1], [22.1, 0.25, 'hold']]);
  });

  it('has hysteresis: it stays open down to above − 0.05', () => {
    const g = P.gate(s, curve((t) => (t < 15 ? 0.2 : t < 18 ? 0.6 : t < 21 ? 0.47 : 0.2)), { above: 0.5 });
    expect(brief(g)).toEqual([[14.75, 0], [14.85, 1, 'hold'], [21, 1], [21.1, 0, 'hold']]);
  });

  it('clips a run across the span edges with edge pivots, so the curve inside the span is unchanged', () => {
    const c = curve((t) => (t < 25 ? 0.9 : t < 29.75 ? 0.2 : 0.9));   // open from before 10, then again from 29.8
    const g = P.gate(s, c, { above: 0.5 });
    expect(WA.automationAt(g, 10)).toBe(1);
    expect(WA.automationAt(g, 30)).toBe(1);
    expect(brief(g)).toEqual([[10, 1, 'hold'], [25, 1], [25.1, 0, 'hold'], [29.55, 0], [29.65, 1, 'hold'], [30, 1]]);
    const wide = P.gate({ start: 0, end: 40 }, c, { above: 0.5 });
    for (let t = 10; t <= 30; t += 0.01) expect(WA.automationAt(g, t)).toBeCloseTo(WA.automationAt(wide, t), 12);
    sane(g);
  });

  it('caps 1000 alternating runs at MAX_PIVOTS', () => {
    const long = { start: 0, end: 1000 };
    const g = P.gate(long, curve((t) => (t % 1 < 0.4 ? 0.9 : 0.1), 1000), { above: 0.5 });
    expect(g.length).toBeLessThanOrEqual(WA.MAX_PIVOTS);
    expect(g.length).toBeGreaterThan(200);
    sane(g, long);
  });
});

describe('plays', () => {
  it('opens while the notes sound, bridging gaps under 1 s, with 0.2 s ramps', () => {
    const notes: Note[] = [[12, 13, 60, 80], [13.5, 16, 62, 80]];
    expect(brief(P.plays(s, notes))).toEqual([[11.8, 0], [12, 1, 'hold'], [16, 1], [16.2, 0, 'hold']]);
    const two: Note[] = [[12, 13, 60, 80], [14.5, 16, 62, 80], [40, 41, 60, 80]];
    expect(P.plays(s, two, { floor: 0.1 }).filter((p) => p.v === 1).length).toBe(4);
  });

  it('keeps every result sorted and inside the span, capped', () => {
    const notes: Note[] = [[5, 11, 60, 80], [29.9, 35, 60, 80]];
    const p = P.plays(s, notes);
    sane(p);
    expect(WA.automationAt(p, 10)).toBe(1);   // sounding across the start: open from the start
    expect(WA.automationAt(p, 30)).toBe(1);   // and across the end
    expect(WA.automationAt(p, 20)).toBe(0);
    const many: Note[] = Array.from({ length: 2000 }, (_, i) => [i * 2, i * 2 + 0.5, 60, 80] as Note);
    sane(P.plays({ start: 0, end: 4000 }, many), { start: 0, end: 4000 });
  });
});
