// The loud, rel and pace drives (src/widgets/curves.ts): their curves, their copies in lab/layers/lines.js, and every place a
// Features object is made or swapped giving them a finite value.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { DRIVES, repairShow, validateShow, type Show } from '../src/studio/show/show';
import { groupChords } from '../src/widgets/chords';
import { relative } from '../src/research/energy';
import { energyCurve, makeLoudAt, makeRelAt, paceAt } from '../src/widgets/curves';
import { knobValue, newFeatures } from '../src/widgets/features';
import { readLabHarness } from '../src/widgets/lab-harness';
import { WidgetRuntime } from '../src/widgets/runtime';
import type { Chord, LabHarness, Note } from '../src/widgets/types';

const WA = loadLayers();
const LEAD = WA.LOUDNESS_LAG.open;

/** mulberry32: a seeded generator, so the random data is the same on every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Attacks at these times, one note each. */
const notesAt = (ts: readonly number[]): Note[] => ts.map((t) => [t, t + 0.2, 60, 80]);
const range = (from: number, to: number, step: number): number[] => { const o: number[] = []; for (let t = from; t < to - 1e-9; t += step) o.push(Math.round(t * 1e4) / 1e4); return o; };

describe('the knob drives', () => {
  const q = { key: 'size', min: 0, max: 2, value: 1 };
  it('+loud and -loud move a knob by loud, +pace and -pace by pace', () => {
    const f = { ...newFeatures(), loud: 0.5, pace: 0.25 };
    expect(knobValue(q, { base: 1, drive: '+loud', depth: 0.4 }, f)).toBeCloseTo(1.4, 12);
    expect(knobValue(q, { base: 1, drive: '-loud', depth: 0.4 }, f)).toBeCloseTo(0.6, 12);
    expect(knobValue(q, { base: 1, drive: '+pace', depth: 0.4 }, f)).toBeCloseTo(1.2, 12);
    expect(knobValue(q, { base: 1, drive: '-pace', depth: 0.4 }, f)).toBeCloseTo(0.8, 12);
  });
  it('+rel and -rel move a knob by rel', () => {
    const f = { ...newFeatures(), loud: 0.9, rel: 0.75 };
    expect(knobValue(q, { base: 1, drive: '+rel', depth: 0.4 }, f)).toBeCloseTo(1.6, 12);
    expect(knobValue(q, { base: 1, drive: '-rel', depth: 0.4 }, f)).toBeCloseTo(0.4, 12);
  });
  it('fresh features hold loud, pace and rel at 0: a driven knob sits at its base', () => {
    for (const d of ['+loud', '-loud', '+pace', '-pace', '+rel', '-rel'] as const) expect(knobValue(q, { base: 1, drive: d, depth: 0.5 }, newFeatures())).toBe(1);
    expect(WA.newFeatures()).toEqual(newFeatures());
  });
});

describe('loud', () => {
  // 0.1 s samples: 0.2 for 2 s, then 0.8 for 2 s, then 0.5 for 1 s. 5th percentile 0.2, 95th 0.8.
  const values = [...Array(20).fill(0.2), ...Array(20).fill(0.8), ...Array(10).fill(0.5)];
  const lane = { hop: 0.1, values };

  it('reads the lane LOUDNESS_LAG.open ahead, stretched from the song\'s 5th to 95th percentile', () => {
    const loud = makeLoudAt(lane, LEAD);
    // The rise sits between the samples' centres 1.95 s and 2.05 s; read LEAD ahead, it lands that much earlier.
    expect(loud(1.95 - LEAD)).toBe(0);
    expect(loud(2.05 - LEAD)).toBeCloseTo(1, 9);
    expect(loud(2 - LEAD)).toBeCloseTo(0.5, 9);   // linear between the two
    expect(loud(4.5 - LEAD)).toBeCloseTo(0.5, 9);  // 0.5 → (0.5 − 0.2) / 0.6
  });
  it('holds the first and last values past the ends', () => {
    const loud = makeLoudAt(lane, LEAD);
    expect(loud(-10)).toBe(0);
    expect(loud(1000)).toBeCloseTo(0.5, 9);
  });
  it('a quiet piece moves over its whole range', () => {
    const quiet = makeLoudAt({ hop: 0.1, values: values.map((v) => v / 10) }, LEAD);
    expect(quiet(0)).toBe(0);
    expect(quiet(3 - LEAD)).toBe(1);
  });
  it('is 0 without a lane, with an empty or flat one, or without a lead; never NaN', () => {
    for (const f of [makeLoudAt(undefined, LEAD), makeLoudAt(null, LEAD), makeLoudAt({ hop: 0.1, values: [] }, LEAD),
      makeLoudAt({ hop: 0.1, values: [0.4, 0.4, 0.4] }, LEAD), makeLoudAt(lane, undefined), makeLoudAt({ hop: 0, values }, LEAD)]) {
      expect([f(0), f(3), f(NaN)]).toEqual([0, 0, 0]);
    }
    expect(makeLoudAt(lane, LEAD)(NaN)).toBe(0);
  });
});

describe('loud from the energy lane', () => {
  // dB, 0.1 s samples: -45 for 2 s, then -15 for 2 s, then -30 for 1 s. The lane that runs late (pack.loudness) says
  // something else entirely, so a reading of it shows.
  const db = [...Array(20).fill(-45), ...Array(20).fill(-15), ...Array(10).fill(-30)];
  const energy = { hop: 0.1, momentary: db, shortTerm: db.map(() => -20) };
  const late = { hop: 0.1, values: Array.from({ length: 50 }, (_, i) => i / 50) };

  it('reads the momentary curve as it is, with no lead, whatever lead and lane the host passes', () => {
    const loud = makeLoudAt(late, LEAD, energy), plain = makeLoudAt(energyCurve({ energy }), 0);
    for (let t = -1; t < 7; t += 0.037) expect(loud(t)).toBe(plain(t));
    // The rise sits between the samples' centres 1.95 s and 2.05 s, where it is in the sound.
    expect(loud(1.95)).toBe(0);
    expect(loud(2)).toBeCloseTo(0.5, 9);
    expect(loud(2.05)).toBeCloseTo(1, 9);
    expect(loud(4.5)).toBeCloseTo(0.5, 9);   // -30 dB is halfway between -45 and -15
  });
  it('without energy (absent, null or empty), exactly the old lane read LOUDNESS_LAG.open ahead', () => {
    const old = makeLoudAt(late, LEAD);
    for (const e of [undefined, null, { hop: 0.1, momentary: [], shortTerm: [] }]) {
      const f = makeLoudAt(late, LEAD, e);
      for (let t = -1; t < 7; t += 0.037) expect(f(t)).toBe(old(t));
    }
  });
  it('without a lead (no layer code), 0 even with energy; energy alone, without a loudness lane, is enough', () => {
    const f = makeLoudAt(late, undefined, energy);
    expect([f(0), f(3), f(NaN)]).toEqual([0, 0, 0]);
    expect(makeLoudAt(undefined, LEAD, energy)(3)).toBe(1);
  });
});

describe('rel', () => {
  // 0.1 s samples over 60 s: a quiet first third (0.2) with a swell to 0.35 at 10..11 s, a loud middle (0.8) with its
  // climax (0.95) at 30..31 s, then a middling end (0.5).
  const values = Array.from({ length: 600 }, (_, i) => (i >= 100 && i < 110 ? 0.35 : i < 200 ? 0.2 : i >= 300 && i < 310 ? 0.95 : i < 400 ? 0.8 : 0.5));
  const lane = () => ({ hop: 0.1, values: values.slice() });

  it('is relative() of src/research/energy.ts, read at the samples\' centres', () => {
    const rel = makeRelAt(lane(), 0), want = relative(values, 0.1);
    for (let i = 0; i < values.length; i++) expect(rel((i + 0.5) * 0.1)).toBeCloseTo(want[i], 6);
  });
  it('a quiet passage still swells, and the real climax still reads highest', () => {
    const rel = makeRelAt(lane(), 0), loud = makeLoudAt(lane(), 0);
    expect(loud(10.5)).toBeLessThan(0.3);                   // loud hardly sees the swell
    expect(rel(10.5) - rel(5)).toBeGreaterThan(0.3);        // rel does, more than loud
    expect(rel(10.5) - rel(5)).toBeGreaterThan(loud(10.5) - loud(5));
    expect(rel(10.5)).toBeGreaterThan(0.5);
    let top = 0;
    for (let t = 0; t < 60; t += 0.05) top = Math.max(top, rel(t));
    expect(rel(30.5)).toBe(top);
    expect(rel(30.5)).toBeGreaterThan(rel(10.5));
  });
  it('chooses its lane as loud does: energy as it is, else pack.loudness read the lead ahead', () => {
    const db = values.map((v) => -50 + 38 * v), energy = { hop: 0.1, momentary: db, shortTerm: db };
    const fromEnergy = makeRelAt(lane(), LEAD, energy), plain = makeRelAt(energyCurve({ energy }), 0);
    for (let t = -1; t < 61; t += 0.37) expect(fromEnergy(t)).toBe(plain(t));
    const led = makeRelAt(lane(), LEAD), unled = makeRelAt(lane(), 0);
    for (let t = 0; t < 58; t += 0.37) expect(led(t)).toBeCloseTo(unled(t + LEAD), 12);
    expect(makeRelAt(lane(), LEAD, { hop: 0.1, momentary: [], shortTerm: [] })(10.5 - LEAD)).toBe(led(10.5 - LEAD));
  });
  it('is 0 without a lane, with an empty or flat one, or without a lead; never NaN, always 0..1', () => {
    for (const f of [makeRelAt(undefined, LEAD), makeRelAt(null, LEAD), makeRelAt({ hop: 0.1, values: [] }, LEAD),
      makeRelAt({ hop: 0.1, values: [0.4, 0.4, 0.4] }, LEAD), makeRelAt(lane(), undefined), makeRelAt({ hop: 0, values }, LEAD),
      makeRelAt(lane(), undefined, { hop: 0.1, momentary: [-20, -30], shortTerm: [-20, -30] })]) {
      expect([f(0), f(3), f(NaN)]).toEqual([0, 0, 0]);
    }
    const r = makeRelAt({ hop: 0.1, values: [0.1, NaN, 0.9, Infinity, 0.5] }, 0);
    for (const t of [NaN, -1, 0.1, 0.17, 0.33, 9]) { const v = r(t); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('is worked out once per lane object', () => {
    const l = lane(), before = makeRelAt(l, 0)(10.5);
    l.values.fill(0.5);   // kept by identity, as pace keeps its chord list
    expect(makeRelAt(l, 0)(10.5)).toBe(before);
    expect(makeRelAt(lane(), 0)(10.5)).toBe(before);
  });
  it('is worked out on the first read, not when made, on both sides', () => {
    for (const make of [makeRelAt, (l: { hop: number; values: number[] }, lead: number) => WA.relCurve(l, lead)]) {
      const l = lane(), r = make(l, 0);
      l.values.fill(0.5);   // a flat lane by the first read: nothing was worked out yet
      expect(r(10.5)).toBe(0);
    }
  });
});

describe('pace', () => {
  // Calm: an attack every second for 20 s. Busy: eight a second for the next 20 s.
  const notes = notesAt([...range(0, 20, 1), ...range(20, 40, 0.125)]);
  it('is high in the busy stretch and low in the calm one', () => {
    const ch = groupChords(notes);
    expect(paceAt(ch, 30)).toBe(1);
    expect(paceAt(ch, 10)).toBeCloseTo(1 / 8, 9);
  });
  it('looks both ways: the window is centred on t', () => {
    const ch = groupChords(notes);
    // 1.5 s before the busy part: half a second of it is in the window already; 2.5 s before, none.
    expect(paceAt(ch, 18.5)).toBeGreaterThan(paceAt(ch, 17.5));
    expect(paceAt(ch, 17.5)).toBeCloseTo(1 / 8, 9);
    expect(paceAt(ch, 20)).toBeCloseTo(((2 * 1) + 16) / 32, 9);   // 2 calm attacks and 16 busy ones in 4 s, over 8/s
  });
  it('is 0 with no attacks, and 0 or more anywhere', () => {
    expect(paceAt([], 3)).toBe(0);
    const one = groupChords(notesAt([5]));
    expect(paceAt(one, 5)).toBeGreaterThanOrEqual(0);
    expect(paceAt(one, 500)).toBe(0);
  });
  it('is worked out once per chord list', () => {
    const ch: Chord[] = groupChords(notes);
    const before = paceAt(ch, 30);
    ch.splice(0, ch.length);   // the list is kept by identity: a changed list is a new list to the callers
    expect(paceAt(ch, 30)).toBe(before);
    expect(paceAt(groupChords(notes), 10)).toBeCloseTo(1 / 8, 9);
  });
});

describe('lab/layers/lines.js has the same curves', () => {
  it('loudCurve and paceAt give the same bits on random data', () => {
    const r = rng(7);
    for (let k = 0; k < 20; k++) {
      const n = 1 + Math.floor(r() * 400), lane = { hop: 0.1, values: Array.from({ length: n }, () => r()) };
      const ts: number[] = []; let t = r() * 3;
      for (let i = 0; i < 300; i++) { t += r() < 0.3 ? r() * 0.03 : r() * (r() < 0.5 ? 0.15 : 1.2); ts.push(t); }
      const chordsTs = groupChords(notesAt(ts)), chordsWa = WA.groupChords(notesAt(ts));
      const a = makeLoudAt(lane, LEAD), b = WA.loudCurve(lane, LEAD);
      for (let i = 0; i < 400; i++) {
        const at = -3 + r() * (n * 0.1 + 6);
        expect(b(at)).toBe(a(at));
        expect(WA.paceAt(chordsWa, at)).toBe(paceAt(chordsTs, at));
      }
    }
  });
  it('loudCurve with an energy lane gives the same bits as makeLoudAt', () => {
    const r = rng(11);
    for (let k = 0; k < 20; k++) {
      const n = 1 + Math.floor(r() * 400), lane = { hop: 0.1, values: Array.from({ length: n }, () => r()) };
      const m = Array.from({ length: n }, () => (r() < 0.05 ? -90 : -60 + r() * 55)), energy = { hop: 0.1, momentary: m, shortTerm: m.map((v) => v + 1) };
      const a = makeLoudAt(lane, LEAD, energy), b = WA.loudCurve(lane, LEAD, energy);
      for (let i = 0; i < 400; i++) { const at = -3 + r() * (n * 0.1 + 6); expect(b(at)).toBe(a(at)); }
    }
  });
  it('relCurve gives the same bits as makeRelAt, with and without an energy lane', () => {
    const r = rng(13);
    for (let k = 0; k < 20; k++) {
      const n = 1 + Math.floor(r() * 600), lane = { hop: 0.1, values: Array.from({ length: n }, () => (r() < 0.02 ? NaN : r())) };
      const m = Array.from({ length: n }, () => (r() < 0.05 ? -90 : -60 + r() * 55)), energy = { hop: 0.1, momentary: m, shortTerm: m.map((v) => v + 1) };
      const a = makeRelAt(lane, LEAD), b = WA.relCurve(lane, LEAD), c = makeRelAt(lane, LEAD, energy), d = WA.relCurve(lane, LEAD, energy);
      for (let i = 0; i < 400; i++) { const at = -3 + r() * (n * 0.1 + 6); expect(b(at)).toBe(a(at)); expect(d(at)).toBe(c(at)); }
    }
    const fine = { hop: 0.025, values: Array.from({ length: 900 }, () => r()) };   // a hop that holds the window's percentiles
    const a = makeRelAt(fine, 0), b = WA.relCurve(fine, 0);
    for (let t = -1; t < 24; t += 0.013) expect(b(t)).toBe(a(t));
    expect([WA.relCurve(undefined, LEAD)(3), WA.relCurve(fine, undefined)(3)]).toEqual([0, 0]);
  });
  it('curveFeatures sets rel from relAt, 0 without it', () => {
    const ch = groupChords(notesAt(range(0, 20, 0.5))), rel = makeRelAt({ hop: 0.1, values: range(0, 1, 0.01) }, LEAD);
    const f = newFeatures();
    WA.curveFeatures(f, ch, 5, undefined, rel);
    expect(f.rel).toBe(rel(5));
    expect(f.rel).toBeGreaterThan(0);
    WA.curveFeatures(f, ch, 5);
    expect(f.rel).toBe(0);
  });
  it('curveFeatures sets loud and pace, and coldInstance starts them at t', () => {
    const ch = groupChords(notesAt(range(0, 20, 0.5))), loud = makeLoudAt({ hop: 0.1, values: range(0, 1, 0.01) }, LEAD);
    const f = newFeatures();
    WA.curveFeatures(f, ch, 5, loud);
    expect(f).toEqual({ ...newFeatures(), loud: loud(5), pace: paceAt(ch, 5) });
    WA.curveFeatures(f, ch, 5);
    expect(f.loud).toBe(0);
  });
});

describe('the drive lists', () => {
  it('the lab\'s menu and the studio\'s show format know the same drives, with the new words', () => {
    const h = readLabHarness(readFileSync(new URL('../lab/index.html', import.meta.url), 'utf8'));
    expect(new Set(h.drives.map(([d]) => d))).toEqual(new Set(DRIVES));
    expect(h.drives).toHaveLength(DRIVES.length);
    expect(h.drives).toContainEqual(['+loud', 'louder sound → more']);
    expect(h.drives).toContainEqual(['-loud', 'louder sound → less']);
    expect(h.drives).toContainEqual(['+pace', 'busier → more']);
    expect(h.drives).toContainEqual(['-pace', 'busier → less']);
    expect(h.drives).toContainEqual(['+rel', 'louder than around it → more']);
    expect(h.drives).toContainEqual(['-rel', 'louder than around it → less']);
    expect(h.drives).toContainEqual(['+level', 'louder notes → more']);
    expect(h.drives).toContainEqual(['-level', 'louder notes → less']);
  });
  it('a show with +loud, +pace and +rel knobs validates and comes through repair unchanged', () => {
    const show: Show = { version: 3, id: 'demo', song: 'demo', clips: [
      { id: 'c1', start: 0, end: 10, track: 0, fade: 0, widget: 'w', knobs: { size: { base: 1, drive: '+loud', depth: 0.6 }, edge: { base: 0.2, drive: '-pace', depth: 0.5 } } },
      { id: 'c2', start: 0, end: 10, track: 1, fade: 0, widget: 'w', knobs: { size: { base: 1, drive: '+pace', depth: 0.3 }, edge: { base: 0.2, drive: '-loud' } } },
      { id: 'c3', start: 0, end: 10, track: 2, fade: 0, widget: 'w', knobs: { size: { base: 1, drive: '+rel', depth: 0.7 }, edge: { base: 0.2, drive: '-rel' } } }] };
    expect(validateShow(show).errors).toEqual([]);
    const r = repairShow(show, {});
    expect(r.fixed).toEqual([]);
    expect(r.show).toEqual(show);
  });
});

// ---- A real WidgetRuntime on stub canvases ------------------------------------------------------------------------------

const fakeG = (canvas: unknown): CanvasRenderingContext2D => new Proxy({ canvas } as Record<string, unknown>, {
  get: (o, k) => (k in o ? o[k as string] : () => {}),
  set: (o, k, v) => { o[k as string] = v; return true; },
}) as unknown as CanvasRenderingContext2D;
function fakeCanvas(w = 1280, h = 720): HTMLCanvasElement {
  const c = { width: w, height: h } as unknown as HTMLCanvasElement & { g?: CanvasRenderingContext2D };
  c.getContext = (() => (c.g ??= fakeG(c))) as never;
  return c;
}
type Seen = Record<string, { t: number; size: number; edge: number }[]>;
const seen = (): Seen => (globalThis as unknown as { __seen: Seen }).__seen;
/** Records its two knobs on every frame and at reset. */
const PROBE = `TOOLS.push({ id: 'probe', name: 'probe',
  params: [{ key: 'size', min: 0, max: 2, value: 1, drive: '+loud' }, { key: 'edge', min: 0, max: 2, value: 1, drive: '+pace' }],
  reset(x) { (window.__seen.reset ??= []).push({ t: x.t, size: x.p('size'), edge: x.p('edge') }); },
  frame(x) { (window.__seen[x.picked ? 'picks' : 'all'] ??= []).push({ t: x.t, size: x.p('size'), edge: x.p('edge') }); },
});`;
const HARNESS: LabHarness = { toolIds: ['probe'], verdicts: {}, drives: [], iconSource: '{ ink: "#000", gauge() {} }' };
/** Busy for 10 s (5 a second), calm for 10 (1 a second). */
const SONG: Note[] = notesAt([...range(0.1, 10, 0.2), ...range(10, 20, 1)]);
/** Picks: calm where the song is busy, busy where it is calm. */
const PICKS: Note[] = notesAt([...range(0.3, 10, 2), ...range(10, 20, 0.25)]);
const LANE = { hop: 0.1, values: Array.from({ length: 200 }, (_, i) => (i < 100 ? 0.3 : 0.9)) };

/** The energy lane of a song that is loud from 10 s, where LATE_LANE (which runs late) is quiet till 14 s. */
const ENERGY = { hop: 0.1, momentary: Array.from({ length: 200 }, (_, i) => (i < 100 ? -45 : -15)), shortTerm: Array.from({ length: 200 }, () => -20) };
const LATE_LANE = { hop: 0.1, values: Array.from({ length: 200 }, (_, i) => (i < 140 ? 0.3 : 0.9)) };

function run(loudness?: typeof LANE, layers: typeof WA | null = WA, energy?: typeof ENERGY) {
  const rt = new WidgetRuntime(fakeCanvas(), { notes: SONG, ...(loudness ? { loudness } : {}), ...(energy ? { energy } : {}) }, { sources: { probe: PROBE }, harness: HARNESS, ...(layers ? { layers } : {}) });
  rt.load(['probe']);
  if (layers) rt.load([{ key: 'probe@picks:p', widget: 'probe', listen: 'picks:p', notes: PICKS }]);
  rt.reset(0);
  const slots = [{ id: 'probe', receiving: true, weight: 1 }, ...(layers ? [{ id: 'probe@picks:p', receiving: true, weight: 1, layer: {} }] : [])];
  for (let i = 1; i <= 20 * 30; i++) rt.step(i / 30, 1 / 30, slots);
  return rt;
}
const at = (rows: { t: number; size: number; edge: number }[], t: number) => rows.find((r) => r.t >= t - 1e-9)!;

describe('every Features object the runtime makes or swaps has loud and pace', () => {
  beforeAll(() => {
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    vi.stubGlobal('NOTES', SONG);
  });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { vi.stubGlobal('__seen', {}); });

  it('with a lane: +loud follows the recording, read ahead; +pace the song\'s attacks', () => {
    const rt = run(LANE);
    expect(rt.errors).toEqual({});
    const all = seen().all;
    for (const r of all) { expect(Number.isFinite(r.size)).toBe(true); expect(Number.isFinite(r.edge)).toBe(true); }
    expect(at(all, 5).size).toBe(1);                // quiet: loud 0
    expect(at(all, 15).size).toBe(2);               // loud: 1, the knob at its top
    expect(at(all, 10 - LEAD + 0.1).size).toBe(2);  // already up, LOUDNESS_LAG.open before the lane rises
    expect(at(all, 5).edge).toBeGreaterThan(at(all, 15).edge);   // the song is busy first
    expect(rt.ctx.feat.loud).toBe(rt.loudAt(20));
  });
  it('with an energy lane: +loud follows it, with no lead, not the loudness lane', () => {
    const rt = run(LATE_LANE, WA, ENERGY);
    expect(rt.errors).toEqual({});
    const all = seen().all;
    expect(at(all, 9.5).size).toBe(1);    // quiet till the energy rises at 10 s (no lead)
    expect(at(all, 10.2).size).toBe(2);   // up at once, though the loudness lane stays low till 14 s
    expect(at(all, 12).size).toBe(2);
    const fromEnergy = makeLoudAt(undefined, LEAD, ENERGY);
    for (const t of [3, 9.95, 10, 10.05, 15]) expect(rt.loudAt(t)).toBe(fromEnergy(t));
    expect(rt.ctx.feat.loud).toBe(rt.loudAt(20));
  });
  it('rel: the runtime reads the lane loud reads, into every Features object', () => {
    const rt = run(LATE_LANE, WA, ENERGY), want = makeRelAt(undefined, LEAD, ENERGY);
    expect(rt.errors).toEqual({});
    for (const t of [3, 9.95, 10, 10.05, 15]) expect(rt.relAt(t)).toBe(want(t));
    expect(rt.ctx.feat.rel).toBe(rt.relAt(20));
    expect(rt.instance('probe@picks:p')!.feat.rel).toBe(rt.relAt(20));
    rt.reset(10.5);
    expect(rt.ctx.feat.rel).toBe(rt.relAt(10.5));
    expect(rt.instance('probe@picks:p')!.feat.rel).toBe(rt.relAt(10.5));
    expect(rt.relAt(10.5)).toBeGreaterThan(rt.relAt(5));
    const bare = run(LANE, null);
    expect([bare.relAt(5), bare.relAt(15), bare.ctx.feat.rel]).toEqual([0, 0, 0]);
  });
  it('an instance on its own notes (a set of picks) gets their pace, the song\'s loud', () => {
    run(LANE);
    const picks = seen().picks;
    for (const r of picks) { expect(Number.isFinite(r.size)).toBe(true); expect(Number.isFinite(r.edge)).toBe(true); }
    expect(at(picks, 15).edge).toBeGreaterThan(at(picks, 5).edge);   // the picks are busy later
    expect(at(picks, 15).size).toBe(2);
  });
  it('without a lane, or without layer code: loud is 0 and the knob finite', () => {
    for (const make of [() => run(undefined), () => run(LANE, null)]) {
      const rt = make();
      expect(rt.errors).toEqual({});
      for (const r of [...seen().all]) { expect(r.size).toBe(1); expect(Number.isFinite(r.edge)).toBe(true); }
      vi.stubGlobal('__seen', {});
    }
  });
  it('a reset already has loud and pace at its time: a seek and play agree', () => {
    const rt = run(LANE);
    vi.stubGlobal('__seen', {});
    Object.assign(rt.ctx.feat, newFeatures());   // as renderSeek does
    rt.reset(15);
    const r = seen().reset.find(() => true)!;
    expect(r.size).toBe(2);
    expect(rt.ctx.feat.pace).toBe(paceAt(rt.chords, 15));
    const own = rt.instance('probe@picks:p')!.feat;
    expect(own.loud).toBe(rt.loudAt(15));
    expect(own.pace).toBe(paceAt(groupChords(PICKS), 15));
  });
});
