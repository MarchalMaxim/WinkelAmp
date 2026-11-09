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
  const lag = WA.LOUDNESS_LAG;

  it('has the measured lag of the loudness lane', () => {
    expect(lag).toEqual({ open: 1.1, close: 2.4, mean: 1.7 });
  });

  it('opens 1.1 + 0.15 s before the lane does, closes 2.4 s before it, with 0.1 s ramps', () => {
    const g = P.gate(s, curve((t) => (t >= 15 && t < 20 ? 0.9 : 0.2)), { above: 0.5 });
    expect(brief(g)).toEqual([[13.65, 0], [13.75, 1, 'hold'], [17.6, 1], [17.7, 0, 'hold']]);
    expect(WA.automationAt(g, g[1].t)).toBe(1);
    expect(WA.automationAt(g, g[3].t)).toBe(0);
    sane(g);
  });

  it('a step up in the lane at t opens at about t − 1.1 − 0.15', () => {
    for (const t of [12, 17.3, 24.6]) {
      const g = P.gate(s, curve((x) => (x >= t ? 0.9 : 0.2)), { above: 0.5 });
      const open = g.find((p) => p.v === 1)!;
      expect(open.t).toBeCloseTo(t - 1.1 - 0.15, 6);
      expect(WA.automationAt(g, 30)).toBe(1);   // still loud at the end of the lane: it stays open to the end
    }
  });

  it('a short run keeps 0.25 s from its shifted start', () => {
    const g = P.gate(s, curve((t) => (t >= 15 && t < 15.5 ? 0.9 : 0.2)), { above: 0.5 });
    expect(brief(g)).toEqual([[13.65, 0], [13.75, 1, 'hold'], [14.15, 1], [14.25, 0, 'hold']]);
  });

  it('clamps at 0: a run near the song start opens from 0 and keeps 0.25 s', () => {
    const g = P.gate({ start: 0, end: 10 }, curve((t) => (t >= 0.5 && t < 1 ? 0.9 : 0.2)), { above: 0.5 });
    expect(WA.automationAt(g, 0)).toBe(1);
    expect(WA.automationAt(g, 0.25)).toBe(1);
    expect(WA.automationAt(g, 0.36)).toBe(0);
    sane(g, { start: 0, end: 10 });
    const two = P.gate({ start: 0, end: 10 }, curve((t) => (t < 0.3 || (t >= 0.9 && t < 5) ? 0.9 : 0.2)), { above: 0.5 });
    expect(WA.automationAt(two, 1.5)).toBe(1);   // the second run is not lost under the first, both held at 0
    sane(two, { start: 0, end: 10 });
  });

  it('ignores a 0.2 s blip and bridges a 0.3 s dip in the lane', () => {
    expect(P.gate(s, curve((t) => (t >= 15 && t < 15.2 ? 0.9 : 0.2)), { above: 0.5 })).toEqual([]);
    const g = P.gate(s, curve((t) => ((t >= 15 && t < 18) || (t >= 18.3 && t < 22) ? 0.9 : 0.2)), { above: 0.5, floor: 0.25 });
    expect(brief(g)).toEqual([[13.65, 0.25], [13.75, 1, 'hold'], [19.6, 1], [19.7, 0.25, 'hold']]);
  });

  it('has hysteresis: it stays open down to above − 0.05', () => {
    const g = P.gate(s, curve((t) => (t < 15 ? 0.2 : t < 18 ? 0.6 : t < 21 ? 0.47 : 0.2)), { above: 0.5 });
    expect(brief(g)).toEqual([[13.65, 0], [13.75, 1, 'hold'], [18.6, 1], [18.7, 0, 'hold']]);
  });

  it('clips a run across the span edges with edge pivots, so the curve inside the span is unchanged', () => {
    const c = curve((t) => (t < 25 ? 0.9 : t < 29.75 ? 0.2 : 0.9));   // open from before 10, then again from 29.8
    const g = P.gate(s, c, { above: 0.5 });
    expect(WA.automationAt(g, 10)).toBe(1);
    expect(WA.automationAt(g, 30)).toBe(1);
    expect(brief(g)).toEqual([[10, 1, 'hold'], [22.6, 1], [22.7, 0, 'hold'], [28.45, 0], [28.55, 1, 'hold'], [30, 1]]);
    const wide = P.gate({ start: 0, end: 40 }, c, { above: 0.5 });
    for (let t = 10; t <= 30; t += 0.01) expect(WA.automationAt(g, t)).toBeCloseTo(WA.automationAt(wide, t), 12);
    sane(g);
  });

  it('with lag { open: 0, close: 0 } (the energy lane): full 0.15 s before the lane rises, closing where it falls', () => {
    const none = { open: 0, close: 0 };
    const g = P.gate(s, curve((t) => (t >= 15 && t < 20 ? 0.9 : 0.2)), { above: 0.5, lag: none });
    expect(brief(g)).toEqual([[14.75, 0], [14.85, 1, 'hold'], [20, 1], [20.1, 0, 'hold']]);
    for (const t of [12, 17.3, 24.6]) {
      const open = P.gate(s, curve((x) => (x >= t ? 0.9 : 0.2)), { above: 0.5, lag: none }).find((p) => p.v === 1)!;
      expect(open.t).toBeCloseTo(t - 0.15, 6);
    }
    // a short run keeps its own 0.5 s; with no lag given, the default is the measured lag, as before
    expect(brief(P.gate(s, curve((t) => (t >= 15 && t < 15.5 ? 0.9 : 0.2)), { above: 0.5, lag: none }))).toEqual([[14.75, 0], [14.85, 1, 'hold'], [15.5, 1], [15.6, 0, 'hold']]);
    const c = curve((t) => (t >= 15 && t < 20 ? 0.9 : 0.2));
    expect(P.gate(s, c, { above: 0.5, lag: WA.LOUDNESS_LAG })).toEqual(P.gate(s, c, { above: 0.5 }));
  });

  it('caps 1000 alternating runs at MAX_PIVOTS', () => {
    const long = { start: 0, end: 1000 };
    const g = P.gate(long, curve((t) => (t % 1 < 0.4 ? 0.9 : 0.1), 1000), { above: 0.5 });
    expect(g.length).toBeLessThanOrEqual(WA.MAX_PIVOTS);
    expect(g.length).toBeGreaterThan(200);
    sane(g, long);
  });
});

describe('loudSource: where gate and follow read loudness', () => {
  const loudness = { hop: 0.1, values: [0.1, 0.5, 0.9] };
  const energy = { hop: 0.1, momentary: [-50, -31, -12], shortTerm: [-40, -40, -40] };
  it('the energy curve with no lag when the pack has it, momentary unless asked', () => {
    expect(WA.loudSource({ loudness, energy })).toEqual({ curve: WA.energyCurve({ energy }), lag: { open: 0, close: 0, mean: 0 }, energy: true });
    expect(WA.loudSource({ loudness, energy }, 'shortTerm')!.curve).toEqual(WA.energyCurve({ energy }, 'shortTerm'));
    const c = WA.energyCorrection(energy);
    expect(WA.loudSource({ energy })!.curve.values).toEqual(energy.momentary.map((d) => Math.min(1, Math.max(0, (d + c + 50) / 38))));
  });
  it('else pack.loudness with LOUDNESS_LAG; null with neither', () => {
    for (const e of [undefined, null]) expect(WA.loudSource({ loudness, energy: e })).toEqual({ curve: loudness, lag: WA.LOUDNESS_LAG, energy: false });
    expect(WA.loudSource({})).toBeNull();
    expect(WA.loudSource(null)).toBeNull();
  });
});

describe('follow', () => {
  const lane = (f: (t: number) => number, dur = 40) => ({ hop: 0.1, values: Array.from({ length: Math.round(dur * 10) }, (_, i) => f(i * 0.1)) });
  const at = (ps: Pivot[], t: number) => WA.automationAt(ps, t);

  it('a ramp: from the floor up to 1, few pivots, the ends of the span exact', () => {
    const p = P.follow(s, lane((t) => t / 40), { lead: 0 });
    sane(p);
    expect(p[0].t).toBe(10); expect(p[p.length - 1].t).toBe(30);
    expect(p[0].v).toBeCloseTo(0.35, 3);
    expect(p[p.length - 1].v).toBe(1);
    expect(p.length).toBeLessThan(12);
    for (let i = 1; i < p.length; i++) expect(p[i].v).toBeGreaterThanOrEqual(p[i - 1].v);
    expect(at(p, 20)).toBeGreaterThan(0.55); expect(at(p, 20)).toBeLessThan(0.8);
  });

  it('a step: climbs fast, falls slowly', () => {
    const up = P.follow(s, lane((t) => (t >= 20 ? 0.8 : 0.2)), { lead: 0 });
    expect(at(up, 19.9)).toBeCloseTo(0.35, 2);
    expect(at(up, 20.6)).toBeGreaterThan(0.9);
    const down = P.follow(s, lane((t) => (t >= 20 ? 0.2 : 0.8)), { lead: 0 });
    expect(at(down, 19.9)).toBeCloseTo(1, 2);
    expect(at(down, 20.6)).toBeGreaterThan(0.6);   // still coming down
    expect(at(down, 24)).toBeLessThan(0.4);
  });

  it('reads the lane ahead by the lead (1.1 s by default)', () => {
    const c = lane((t) => (t >= 20 ? 0.8 : 0.2));
    const d = P.follow(s, c), z = P.follow(s, c, { lead: 0 });
    for (const t of [18, 18.95, 19.2, 19.5, 21]) expect(at(d, t)).toBeCloseTo(at(z, t + 1.1), 1);
    expect(at(d, 19.6)).toBeGreaterThan(0.9);
  });

  it('a flat span is all 1; an empty span or lane writes nothing', () => {
    expect(P.follow(s, lane(() => 0.4))).toEqual([{ t: 10, v: 1 }, { t: 30, v: 1 }]);
    expect(P.follow({ start: 12, end: 12 }, lane((t) => t / 40))).toEqual([]);
    expect(P.follow(s, { hop: 0.1, values: [] })).toEqual([]);
  });

  it('does not stretch a calm span: a wobble of a dB or two stays near 1', () => {
    const p = P.follow(s, lane((t) => 0.4 + 0.004 * Math.sin(t * 2)));
    for (const q of p) expect(q.v).toBeGreaterThan(0.9);
  });

  it('keeps to the floor, rounds, stays within its budget and is the same every time', () => {
    const long = { start: 0, end: 600 };
    const noisy = lane((t) => 0.5 + 0.3 * Math.sin(t / 7) + 0.2 * Math.sin(t * 3.1) * Math.sin(t / 2.3), 600);
    const p = P.follow(long, noisy, { floor: 0.5 });
    sane(p, long);
    expect(p.length).toBeLessThanOrEqual(248);
    expect(p.length).toBeGreaterThan(20);
    for (const q of p) {
      expect(q.v).toBeGreaterThanOrEqual(0.5); expect(q.v).toBeLessThanOrEqual(1);
      expect(Math.abs(q.t * 100 - Math.round(q.t * 100))).toBeLessThan(1e-6);
      expect(Math.abs(q.v * 1000 - Math.round(q.v * 1000))).toBeLessThan(1e-6);
      expect(q.shape).toBeUndefined();
    }
    expect(P.follow(long, noisy, { floor: 0.5 })).toEqual(p);
    const few = P.follow(long, noisy, { floor: 0.5, maxPivots: 20 });
    expect(few.length).toBeLessThanOrEqual(20);
    sane(few, long);
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

describe('toClimax and climaxes: building to the loudest moment', () => {
  const lane = (f: (t: number) => number, dur = 120) => ({ hop: 0.1, values: Array.from({ length: Math.round(dur * 10) }, (_, i) => f(i * 0.1)) });
  const at = (ps: Pivot[], t: number) => WA.automationAt(ps, t);
  // Quiet, a dip at 20 s, a wobbly climb to a peak at 60 s, quieter after.
  const shape = (t: number) => (t < 20 ? 0.4 - 0.01 * t : t <= 60 ? 0.2 + 0.6 * ((t - 20) / 40) + 0.04 * Math.sin(t * 2) : Math.max(0.3, 0.8 - 0.1 * (t - 60)));
  const L0 = lane(shape), whole = { start: 0, end: 120 };

  it('holds at the floor to the low point, then only grows up to 1 at the peak', () => {
    const p = P.toClimax(whole, L0);
    sane(p, whole);
    expect(p[0]).toEqual({ t: 0, v: 0.35 }); expect(p[p.length - 1].t).toBe(120);
    expect(at(p, 10)).toBeCloseTo(0.35, 3); expect(at(p, 19.9)).toBeCloseTo(0.35, 2);
    let last = 0;
    for (let t = 0; t <= 60; t += 0.25) { const v = at(p, t); expect(v).toBeGreaterThanOrEqual(last - 1e-9); last = v; }
    expect(at(p, 60)).toBeCloseTo(1, 2);
    expect(at(p, 40)).toBeGreaterThan(0.5); expect(at(p, 40)).toBeLessThan(0.9);
  });

  it('stays at 1 while the sound is near the peak, at most 4 s, then settles over 3 s and holds the floor', () => {
    const p = P.toClimax(whole, L0);
    const top = p.filter((q) => q.v === 1);
    expect(top.length).toBeGreaterThanOrEqual(1);
    const end = top[top.length - 1].t;
    expect(end).toBeGreaterThanOrEqual(60); expect(end).toBeLessThanOrEqual(64);
    expect(at(p, end + 1.5)).toBeCloseTo(1 - 0.65 / 2, 1);
    expect(at(p, end + 3)).toBeCloseTo(0.35, 2);
    for (let t = end + 3; t <= 120; t += 1) expect(at(p, t)).toBeCloseTo(0.35, 3);
    // A long top is cut at 4 s.
    const flatTop = P.toClimax(whole, lane((t) => (t < 50 ? 0.2 + t / 100 : t < 80 ? 0.7 : 0.2)), { floor: 0.4 });
    expect(flatTop.filter((q) => q.v === 1).pop()!.t).toBeCloseTo(53.9, 0);
    expect(at(flatTop, 70)).toBeCloseTo(0.4, 3);
  });

  it('no dip before the peak', () => {
    const p = P.toClimax(whole, L0);
    for (let i = 1; i < p.length && p[i].t <= 60; i++) expect(p[i].v).toBeGreaterThanOrEqual(p[i - 1].v);
  });

  it('is clipped to the span and finds the peak inside it', () => {
    const sp = { start: 30, end: 50 }, p = P.toClimax(sp, L0);
    sane(p, sp);
    expect(p[0].t).toBe(30); expect(p[p.length - 1].t).toBe(50);
    expect(Math.max(...p.map((q) => q.v))).toBe(1);
    // The peak of the piece (60 s) is not in this span: its own loudest point is, near its end.
    expect(p.find((q) => q.v === 1)!.t).toBeGreaterThan(45);
  });

  it('takes the first of the given peaks that lies in the span', () => {
    const two = lane((t) => 0.2 + 0.5 * Math.exp(-(((t - 30) / 3) ** 2)) + 0.6 * Math.exp(-(((t - 90) / 3) ** 2)));
    const p = P.toClimax(whole, two, { peaks: [{ t: 200 }, { t: 30 }, { t: 90 }] });
    expect(at(p, 30)).toBeCloseTo(1, 2);
    expect(at(p, 90)).toBeCloseTo(0.35, 2);   // after the chosen peak it holds the floor
    const q = P.toClimax(whole, two);         // no peaks given: the span's own loudest point
    expect(at(q, 90)).toBeCloseTo(1, 2); expect(at(q, 30)).toBeLessThan(1);
  });

  it('a nearly flat span, no curve or an empty span: nothing', () => {
    expect(P.toClimax(whole, lane((t) => 0.5 + 0.04 * Math.sin(t)))).toEqual([]);
    expect(P.toClimax(whole, null)).toEqual([]);
    expect(P.toClimax({ start: 5, end: 5 }, L0)).toEqual([]);
  });

  it('keeps to the pivot budget', () => {
    const noisy = lane((t) => 0.1 + (t / 2000) * 0.8 + 0.1 * Math.sin(t * 7) * Math.sin(t * 1.3), 2000);
    const sp = { start: 0, end: 2000 };
    sane(P.toClimax(sp, noisy), sp);
    expect(P.toClimax(sp, noisy).length).toBeLessThanOrEqual(WA.MAX_PIVOTS - 8);
    expect(P.toClimax(sp, noisy, { maxPivots: 10 }).length).toBeLessThanOrEqual(10);
  });

  it('always reaches 1: the turns are kept through the simplifying, also on a tight budget', () => {
    // Wandering loudness (smoothed random walks, 60 s) and random spans: before the turns were kept, a few of these
    // topped out just under 1.
    let seed = 7, n = 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 400; k++) {
      const v: number[] = [];
      for (let i = 0, x = 0.5, d = 0; i < 600; i++) { d = 0.9 * d + 0.02 * (rnd() - 0.5); x = Math.min(1, Math.max(0, x + d)); v.push(x); }
      for (let j = 0; j < 5; j++) {
        const a = rnd() * 40, sp = { start: a, end: a + 5 + rnd() * (55 - a) };
        for (const maxPivots of [undefined, 12]) {
          const p = P.toClimax(sp, { hop: 0.1, values: v }, { maxPivots });
          if (!p.length) continue;
          n++;
          expect(Math.max(...p.map((q) => q.v))).toBe(1);
          expect(p.length).toBeLessThanOrEqual(maxPivots ?? WA.MAX_PIVOTS - 8);
        }
      }
    }
    expect(n).toBeGreaterThan(3000);
    // With room for only the span's ends and one more, the turns give way and the budget holds.
    expect(P.toClimax(whole, L0, { maxPivots: 4 }).length).toBeLessThanOrEqual(4);
  });

  it('reads the lane at its own start time', () => {
    const shifted = { ...L0, start: -1.7 }, p = P.toClimax(whole, shifted);
    expect(at(p, 58.3)).toBeCloseTo(1, 2);
  });

  const dbSong = (f: (t: number) => number, dur = 200) => {
    const db = Array.from({ length: dur * 10 }, (_, i) => f((i + 0.5) * 0.1));
    return { energy: { hop: 0.1, momentary: db, shortTerm: db } };
  };

  it('climaxes: a real peak beats a long plateau that the 0..1 lane cuts off at its top', () => {
    // A minute at about -4 dB (above the lane's top even after the level correction) and a short swell to +2 dB.
    const song = dbSong((t) => (t > 40 && t < 100 ? -4 + 0.5 * Math.sin(t) : t > 140 && t < 150 ? 2 - Math.abs(t - 145) : -30));
    const c = WA.climaxes(song);
    expect(c[0].t).toBeGreaterThan(143); expect(c[0].t).toBeLessThan(147);
    // On the cut-off lane both tie at 1 and the plateau's first wobble wins.
    const cut = WA.energyCurve(song, 'shortTerm')!;
    expect(Math.max(...cut.values.slice(400, 1000))).toBe(1); expect(Math.max(...cut.values.slice(1400, 1500))).toBe(1);
  });

  it('climaxes: the best first, 20 s apart, at most 3, the energy lane centred on its samples', () => {
    const song = dbSong((t) => -30 + 15 * Math.exp(-(((t - 50) / 2) ** 2)) + 10 * Math.exp(-(((t - 60) / 2) ** 2)) + 12 * Math.exp(-(((t - 120) / 2) ** 2)) + 5 * Math.exp(-(((t - 170) / 2) ** 2)) + 3 * Math.exp(-(((t - 190) / 2) ** 2)));
    const c = WA.climaxes(song);
    expect(c.map((x) => Math.round(x.t))).toEqual([50, 120, 170]);
    for (let i = 1; i < c.length; i++) expect(c[i].score).toBeLessThanOrEqual(c[i - 1].score);
    expect(WA.climaxes(song, { n: 1 }).length).toBe(1);
    expect(WA.climaxes(song)).toEqual(c);   // the same again (kept per lane)
  });

  it('climaxes without an energy lane: pack.loudness moved earlier by the lag; none without either', () => {
    const loud = lane((t) => 0.2 + 0.6 * Math.exp(-(((t - 60) / 3) ** 2)));
    const c = WA.climaxes({ loudness: loud });
    expect(c[0].t).toBeCloseTo(60 - WA.LOUDNESS_LAG.mean, 1);
    expect(WA.climaxes({})).toEqual([]); expect(WA.climaxLane(null)).toBeNull();
    expect(WA.climaxes({ loudness: { hop: 0.1, values: [] } })).toEqual([]);
  });
});
