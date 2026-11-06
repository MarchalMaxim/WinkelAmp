// Leidenfrost (2026-11-06): one big drop to start; a note pushes, splits into equal halves (burst) or boils off a small bead;
// beads boil away by themselves; an empty plate gets a new big drop; seeded, so the same run draws the same.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/leidenfrost.js', import.meta.url), 'utf8');
type Drop = { x: number; y: number; r: number; vanish: boolean };
type Tool = ToolDef & { peek(): Drop[] };

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { document: G.document }; });
afterAll(() => { G.document = saved.document; });

const ICON = new Proxy({ ink: '#fff', of: new Proxy({}, { get: () => () => () => {} }) }, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : (() => {})) }) as unknown as IconLib;

// A 2D context that records every call; gradients are objects that take colour stops.
function ctx2d(log: string[]) {
  const grad = () => ({ addColorStop: () => {} });
  const img = (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
  return new Proxy({} as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : k === 'createRadialGradient' || k === 'createLinearGradient' ? grad : k === 'createImageData' ? img
      : (...a: unknown[]) => { log.push(`${String(k)}(${a.map((v) => (typeof v === 'number' ? v.toFixed(2) : typeof v)).join(',')})`); }),
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${typeof v === 'number' ? v.toFixed(3) : String(v)}`); return true; },
  });
}

interface Opts { secs?: number; notes?: Note[]; throwRandom?: boolean; seed?: number; each?: (t: number, tool: Tool) => void }
function play(knobs: Record<string, number> = {}, { secs = 4, notes = [], throwRandom = false, seed = 7, each }: Opts = {}) {
  const log: string[] = [];
  G.document = { createElement: () => { const c: Record<string, unknown> = { width: 0, height: 0 }; c.getContext = () => ctx2d(log); return c; } };
  const chords: Chord[] = groupChords([...notes].sort((a, b) => a[0] - b[0]));
  const tool = instantiate('leidenfrost', SRC, { icon: ICON, chords }) as Tool;
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  let sd = seed;
  const rnd = (a = 0, b = 1) => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return a + (b - a) * (((t ^ (t >>> 14)) >>> 0) / 4294967296); };
  const x = { g: ctx2d(log), t: 0, dt: 1 / 60, W: 1280, H: 720, rnd, p: (k: string) => vals[k], picked: false,
    pitch01: (m: number) => Math.max(0, Math.min(1, (m - 36) / 60)) } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (throwRandom) Math.random = () => { throw new Error('Math.random'); };
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    for (let f = 1; f <= Math.round(secs * 60); f++) {
      x.t = f / 60;
      while (ci < chords.length && chords[ci].t <= x.t) tool.onChord!(chords[ci++], x);
      tool.frame!(x);
      each?.(x.t, tool);
    }
  } finally { Math.random = random; }
  return { log, tool, drops: tool.peek() };
}
const live = (ds: Drop[]) => ds.filter((d) => !d.vanish);
const loud = (t: number, m = 40): Note => [t, t + 0.3, m, 120];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('leidenfrost', () => {
  it('has the knobs: push, burst (follows each note), boil, erratic, steam, plate, and how present', () => {
    const tool = play({}, { secs: 0 }).tool;
    expect(tool).toMatchObject({ id: 'leidenfrost', name: 'Leidenfrost', tag: 'new' });
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['push', 'burst', 'boil', 'erratic', 'steam', 'plate', 'presence']);
    expect(ps.find((p) => p.key === 'burst')!.drive).toBe('+hit');
    expect(ps.find((p) => p.key === 'presence')).toMatchObject({ leads: true, value: 1 });
    for (const p of ps) if (p.less !== undefined) { expect(p.less).toBeGreaterThanOrEqual(p.min); expect(p.less).toBeLessThan(p.value); }
  });

  it('starts with one big drop that keeps wandering without notes', () => {
    const at: Drop[] = [];
    const r = play({}, { secs: 3, each: (t, tool) => { if (near(t, 30 / 60)) at.push(...tool.peek()); } });
    expect(r.drops.length).toBe(1);
    expect(r.drops[0].r).toBeGreaterThan(50);
    expect(Math.hypot(r.drops[0].x - at[0].x, r.drops[0].y - at[0].y)).toBeGreaterThan(5);
  });

  it('a burst splits the drop into two equal halves', () => {
    const ds = live(play({ burst: 1 }, { secs: 1, notes: [loud(0.5)] }).drops);
    expect(ds.length).toBe(2);
    expect(Math.abs(ds[0].r - ds[1].r)).toBeLessThan(0.5);
    expect(ds[0].r).toBeGreaterThan(36); expect(ds[0].r).toBeLessThan(40.5);   // 56 / √2 = 39.6, less what boiled
  });

  it('without bursts a note only pushes: still one drop, sent off fast', () => {
    const quiet = play({ burst: 0, erratic: 0 }, { secs: 1.5 }).drops[0];
    const hit = play({ burst: 0, erratic: 0 }, { secs: 1.5, notes: [loud(0.5)] }).drops;
    expect(hit.length).toBe(1);
    expect(Math.hypot(hit[0].x - quiet.x, hit[0].y - quiet.y)).toBeGreaterThan(60);
  });

  it('a note that reaches a small bead boils it off at once, and an empty plate gets a new big drop', () => {
    // Five bursts break the big drop into a handful; then every drop is hit again and again: a big one splits until it is a
    // bead under 20 (boil 1), which the next note boils off.
    const splits = [0.3, 0.6, 0.9, 1.2, 1.5].map((t) => loud(t)), counts: number[] = [];
    const later = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7].flatMap((t) => [55, 60, 65, 70, 75, 80, 85, 90].map((m): Note => [t, t + 0.05, m, 120]));
    const run = play({ burst: 1, boil: 1 }, { secs: 6, notes: [...splits, ...later], each: (t, tool) => { if (near(t, 114 / 60)) counts.push(live(tool.peek()).length); } });
    expect(counts[0]).toBeGreaterThan(2);
    expect(run.drops.length).toBe(1);   // every bead gone; a fresh big drop landed
    expect(run.drops[0].r).toBeGreaterThan(50);
  });

  it('small beads boil away by themselves within seconds; the big drop lasts', () => {
    const big = play({}, { secs: 20 }).drops;
    expect(big.length).toBe(1); expect(big[0].r).toBeGreaterThan(54);
    // High notes reach the smallest drop: five bursts leave pieces from 39.6 down to a bead of 9.9.
    const notes = [0.3, 0.6, 0.9, 1.2, 1.5].map((t) => loud(t, 96));
    const early = live(play({ burst: 1 }, { secs: 1.8, notes }).drops), after = live(play({ burst: 1 }, { secs: 12, notes }).drops);
    expect(early.some((d) => d.r < 12)).toBe(true);
    expect(after.length).toBeLessThan(early.length);   // the bead is gone (the next smallest is shrinking), the bigger pieces stay
    expect(after.some((d) => d.r > 35)).toBe(true);
  });

  it('is seeded: the same run draws the same, and Math.random is never used', () => {
    const notes = [0.4, 0.9, 1.3, 1.8].map((t, i) => loud(t, 40 + i * 12));
    const a = play({ burst: 0.5 }, { secs: 3, notes, throwRandom: true });
    const b = play({ burst: 0.5 }, { secs: 3, notes });
    expect(a.log.length).toBeGreaterThan(1000);
    expect(a.log).toEqual(b.log);
  });

  it('the plate glows in embers by default, and is left out at plate 0', () => {
    const on = play({}, { secs: 0.1 }).log, off = play({ plate: 0 }, { secs: 0.1 }).log;
    expect(on.filter((l) => l.startsWith('putImageData(')).length).toBe(6);
    expect(off.some((l) => l.startsWith('putImageData('))).toBe(false);
  });

  it('lays its picture on the shared canvas with lighten at full alpha', () => {
    const r = play({}, { secs: 0.1 });
    const i = r.log.lastIndexOf('globalCompositeOperation=lighten');
    expect(i).toBeGreaterThan(-1);
    expect(r.log.slice(i).some((l) => l.startsWith('drawImage('))).toBe(true);
  });
});
