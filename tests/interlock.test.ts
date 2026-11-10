// Interlock: pairs of straight needles from above and below along a seam; stateless from CHORDS, no randomness.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit } from './helpers/widget';
import type { IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

function recorder(log: string[]) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? 'obj' : String(v);
  const grad = { addColorStop() {} };
  return new Proxy({} as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return grad; },
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

const SRC = readFileSync(new URL('../lab/tools/interlock.js', import.meta.url), 'utf8');

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { document: G.document, window: G.window }; });
afterAll(() => { G.document = saved.document; G.window = saved.window; });

const SONG: Note[] = [];
for (let i = 0; i < 30; i++) SONG.push([0.5 + i * 0.23, 0.7 + i * 0.23, 48 + ((i * 7) % 30), 50 + ((i * 13) % 60)]);
SONG.sort((a, b) => a[0] - b[0]);

/** Plays notes in a fresh interlock; returns one log slice per frame (from frame `cold` seconds if given, else from 1/60). */
function play(notes: Note[], knobs: Record<string, number>, secs: number, { cold = -1, picked = false } = {}) {
  G.window = { NOTES: notes };
  const log: string[] = [];
  const g = recorder(log);
  const tool = instantiate('interlock', SRC, { kit: kit(), icon: { ink: '#fff', gauge() {} } as unknown as IconLib, chords: groupChords(notes) }) as ToolDef;
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, feat: { rate: 0.3, bass: 0.2, level: 0.5, pitch: 0.5, density: 0.3 },
    rnd: () => { throw new Error('x.rnd used'); }, p: (k: string) => vals[k], picked } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  Math.random = () => { throw new Error('Math.random used'); };
  const frames: string[][] = [];
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    const from = cold > 0 ? Math.round(cold * 60) : 1;
    for (let f = from; f <= Math.round(secs * 60); f++) {
      x.t = f / 60;
      const before = log.length;
      tool.frame!(x);
      frames.push(log.slice(before));
    }
  } finally { Math.random = random; }
  return { frames, tool };
}

type Tri = { fill: string; pts: [number, number][] };
/** The triangles of a frame: each with the fill colour it is drawn in and its three points. */
function tris(frame: string[]): Tri[] {
  const out: Tri[] = [];
  let fill = '', pending: [number, number][] = [];
  for (const l of frame) {
    const m = /^(moveTo|lineTo)\(([-\d.]+),([-\d.]+)\)/.exec(l);
    if (l.startsWith('fillStyle=')) fill = l.slice(10);
    else if (l.startsWith('beginPath')) pending = [];
    else if (m) { pending.push([+m[2], +m[3]]); if (pending.length === 3) { out.push({ fill, pts: pending }); pending = []; } }
  }
  return out;
}
const one = (t: number, m: number, v: number): Note => [t, t + 0.2, m, v];
const BONE = 'rgb(236,226,208)';
const atFrame = (frames: string[][], t: number) => frames[Math.round(t * 60) - 1];

describe('interlock', () => {
  it('has the catalogue entry', () => {
    const { tool } = play(SONG, {}, 0.1);
    expect(tool.id).toBe('interlock');
    expect(tool.tag).toBe('new');
    expect(tool.params!.map((p) => p.key)).toEqual(['bite', 'width', 'stays', 'ratchet', 'presence']);
    const P = (k: string) => tool.params!.find((p) => p.key === k) as unknown as Record<string, unknown>;
    expect(P('presence').leads).toBe(true);
    expect(P('stays').less).toBe(0.3);
    expect(P('width').less).toBe(0.6);
    for (const p of tool.params!) { const q = p as unknown as Record<string, unknown>; expect(q.label).toBeTruthy(); expect(q.hint).toBeTruthy(); expect(typeof q.icon).toBe('function'); }
  });


  it('strikes bone and hot on the attack step', () => {
    const { frames } = play([one(0.2, 50, 40), one(1, 60, 80)], {}, 1.2);
    const f = atFrame(frames, 1).join('\n');
    expect(f).toContain('fillStyle=' + BONE);
    expect(f).toContain('fillStyle=rgb(214,58,40)');
  });

  it('fills only in lighten at alpha 1', () => {
    const { frames } = play(SONG, {}, 5);
    let op = '', al = '', fills = 0;
    for (const l of frames.flat()) {
      if (l.startsWith('globalCompositeOperation=')) op = l.slice(25);
      if (l.startsWith('globalAlpha=')) al = l.slice(12);
      if (l.startsWith('fill(')) { fills++; expect(op).toBe('lighten'); expect(+al).toBe(1); }
    }
    expect(fills).toBeGreaterThan(0);
  });

  it('stands still between attacks: only the colour changes', () => {
    const { frames } = play([one(0.2, 50, 40), one(1, 60, 80)], {}, 2);
    const geo = (f: string[]) => f.filter((l) => /^(moveTo|lineTo)/.test(l)).join('|');
    const a = atFrame(frames, 1.3), b = atFrame(frames, 1.4);
    expect(geo(a).length).toBeGreaterThan(0);
    expect(geo(a)).toBe(geo(b));
    const fs = (f: string[]) => f.filter((l) => l.startsWith('fillStyle=')).join();
    expect(fs(a)).not.toBe(fs(b));
  });

  it('is gone after stays', () => {
    const n = [one(0.2, 50, 40), one(1, 60, 80)];
    const a = play(n, {}, 3).frames;
    for (let f = Math.ceil((2.4 + 1 / 60) * 60); f <= 180; f++) expect(a[f - 1].some((l) => l.startsWith('fill('))).toBe(false);
    const b = play(n, { stays: 0.3 }, 3).frames;
    for (let f = Math.ceil((1.3 + 1 / 60) * 60); f <= 180; f++) expect(b[f - 1].some((l) => l.startsWith('fill('))).toBe(false);
  });

  it('ratchets a repeated pitch deeper, 24 px a time, capped', () => {
    const rep = [0, 1, 2, 3].map((i) => one(1 + i * 0.3, 60, 80));
    const apex = (knobs: Record<string, number>) => {
      const { frames } = play(rep, knobs, 3);
      return [0, 1, 2, 3].map((i) => {
        const up = tris(atFrame(frames, 1 + i * 0.3)).find((t) => t.fill === BONE)!;
        return Math.max(...up.pts.map((p) => p[1]));
      });
    };
    const a = apex({});
    for (let i = 1; i < 4; i++) { expect(Math.abs(a[i] - a[i - 1] - 24)).toBeLessThan(0.5); expect(a[i]).toBeLessThanOrEqual(360 + 200 + 1); }
    const z = apex({ ratchet: 0 });
    for (let i = 1; i < 4; i++) expect(Math.abs(z[i] - z[0])).toBeLessThan(0.5);
    const b0 = apex({ bite: 0 });
    expect(Math.abs(b0[0] - 360)).toBeLessThan(1);
  });

  it('runs full height', () => {
    const { frames } = play(SONG, { width: 2, bite: 2 }, 6);
    let n = 0;
    for (const f of frames) for (const t of tris(f)) {
      n++;
      const ys = t.pts.map((p) => p[1]);
      expect(Math.min(...ys) < 0 || Math.max(...ys) > 720).toBe(true);
      expect(Math.min(...ys) < 0 && Math.max(...ys) > 720).toBe(false);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('copes with one note and with none', () => {
    const solo = play([one(0.5, 60, 70)], {}, 1).frames;
    expect(solo.flat().some((l) => l.startsWith('fill('))).toBe(true);
    const none = play([], {}, 1).frames;
    expect(none.flat().some((l) => l.startsWith('fill('))).toBe(false);
  });

  it('draws the same after a cold seek, and the same on every run', () => {
    const a = play(SONG, {}, 2.5).frames, b = play(SONG, {}, 2.5, { cold: 2.5 }).frames;
    expect(b[0].join('|')).toBe(a[a.length - 1].join('|'));
    const r1 = play(SONG, {}, 6).frames.flat().join('|'), r2 = play(SONG, {}, 6).frames.flat().join('|');
    expect(r1).toBe(r2);
  });

  it('gives every triangle the same winding, so same-colour overlaps are never punched out', () => {
    const area = (p: [number, number][]) => (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    const chord = [60, 61, 62].map((m): Note => [0.2, 1, m, 80]);
    const dense = play([...chord, ...SONG.map((n): Note => [n[0] + 1, n[1] + 1, n[2], n[3]])], { width: 2 }, 5);
    let n = 0;
    for (const f of dense.frames) for (const t of tris(f)) { n++; expect(area(t.pts)).toBeGreaterThan(0); }
    expect(n).toBeGreaterThan(0);
    // once the flash has gone, upper and lower needles of the chord share the body colour and overlap: all in one group
    const late = tris(atFrame(play(chord, {}, 1).frames, 0.8));
    expect(new Set(late.map((t) => t.fill)).size).toBe(1);
    expect(late.length).toBe(6);
  });

  it('cools the strike without a pink midpoint', () => {
    const { frames } = play([one(0.2, 50, 40), one(1, 60, 80)], {}, 2);
    for (let t = 1; t <= 1.5; t += 1 / 60) for (const tr of tris(atFrame(frames, t))) {
      const [r, g, b] = /(\d+),(\d+),(\d+)/.exec(tr.fill)!.slice(1).map(Number);
      // pink/salmon would have g and b well above the body's low values while r is not far above them
      if (t > 1.4) { expect(g).toBeLessThan(0.45 * r + 2); expect(b).toBeLessThan(0.45 * r + 2); }
    }
  });

  it('strikes the softest upper needles hot once a loud chord passes the bone budget', () => {
    const big = Array.from({ length: 12 }, (_, i): Note => [1, 2, 36 + i * 6, 127 - (i % 3)]);
    const { frames } = play([one(0.2, 50, 10), one(0.4, 52, 12), one(0.6, 54, 14), ...big], { width: 1 }, 1.2);
    const f = tris(atFrame(frames, 1));
    const upper = f.filter((t) => t.pts[1][1] < 0);
    expect(upper.some((t) => t.fill === BONE)).toBe(true);
    expect(upper.some((t) => t.fill === 'rgb(214,58,40)')).toBe(true);
    expect(upper.findIndex((t) => t.fill === BONE)).toBeLessThan(upper.findIndex((t) => t.fill === 'rgb(214,58,40)'));
  });

  it('lifts a soft note on picks: u = 0.25 + 0.75u', () => {
    const song: Note[] = [one(0.2, 50, 30), one(0.5, 60, 100), one(0.8, 70, 120)];
    const base = (picked: boolean) => {
      const { frames } = play(song, {}, 0.3, { picked });
      const t = tris(atFrame(frames, 0.2 + 1 / 60)).find((q) => q.pts[1][1] < 0)!;
      return t.pts[2][0] - t.pts[1][0];
    };
    expect(base(false)).toBeCloseTo(8, 0);
    expect(base(true)).toBeGreaterThanOrEqual(8 + 36 * 0.25 - 0.5);
  });

  it('draws the same at several instants after a cold seek, ratchet chains included', () => {
    const rep = [0, 1, 2, 3].map((i) => one(1 + i * 0.12, 60, 80));
    const full = play([...rep, ...SONG], {}, 4).frames;
    for (const t of [0.9, 1.05, 1.2, 1.4, 2, 3.5]) {
      const cold = play([...rep, ...SONG], {}, t, { cold: t }).frames;
      expect(cold[0].join('|')).toBe(atFrame(full, t).join('|'));
    }
  });
});
