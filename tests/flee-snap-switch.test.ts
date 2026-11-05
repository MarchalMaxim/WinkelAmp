// Flee's snap switch (2026-11-05, flee-snap.js folded into flee.js): the knob, and that the snap side is drawn from song
// time and x.rnd only, on the note's own step. That the switch off draws exactly what flee drew before is proved on pixels
// by scripts/checks/snap-scenes-check.mjs (Liebesleid has flee on its accents).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

/** A 2D context that writes every call and every set into `log` (canvases by number, numbers to 3 places). */
function recorder(log: string[], ids: Map<unknown, number>) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : ids.has(v) ? `#${ids.get(v)}` : typeof v === 'object' ? 'obj' : String(v);
  const grad = { addColorStop() {} };
  return (canvas: unknown) => new Proxy({ canvas } as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return grad; },
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

const SRC = readFileSync(new URL('../lab/tools/flee.js', import.meta.url), 'utf8');
const NOTES: Note[] = [];
for (let i = 0; i < 40; i++) NOTES.push([0.5 + i * 0.21, 0.7 + i * 0.21, 60 + ((i * 7) % 24), 60 + ((i * 13) % 50)]);
for (let i = 0; i < 6; i++) NOTES.push([1 + i * 1.3, 1.5 + i * 1.3, 36 + i, 110]); // bass hits under them
NOTES.sort((a, b) => a[0] - b[0]);
const CHORDS: Chord[] = groupChords(NOTES);

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => {
  saved = { document: G.document, window: G.window };
  G.window = { NOTES };
});
afterAll(() => { G.document = saved.document; G.window = saved.window; });

/** Plays the song in one fresh flee for `secs` at 60 Hz with these knobs; returns the draw log and the frame of each chord. */
function play(knobs: Record<string, number>, secs = 6, { flipAt = -1, randomThrows = false } = {}) {
  const log: string[] = [], ids = new Map<unknown, number>(), rec = recorder(log, ids);
  G.document = { createElement: () => { const c: Record<string, unknown> = { width: 0, height: 0 }; ids.set(c, ids.size); c.getContext = () => (c.g ??= rec(c)); return c; } };
  const tool = instantiate('flee', SRC, { icon: { ink: '#fff', gauge() {} } as unknown as IconLib, chords: CHORDS }) as ToolDef & Record<string, (...a: unknown[]) => void>;
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  let seed = 7;
  const rnd = (a: number, b: number) => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return a + (b - a) * (((t ^ (t >>> 14)) >>> 0) / 4294967296); };
  const g = rec({});
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, feat: { rate: 0.3, bass: 0.2, level: 0.5, pitch: 0.5, density: 0.3 }, rnd, p: (k: string) => vals[k], onPicks: () => false } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (randomThrows) Math.random = () => { throw new Error('Math.random on the snap side'); };
  const firstDraw: number[] = [];
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    for (let f = 1; f <= secs * 60; f++) {
      x.t = f / 60;
      if (f === flipAt) vals.snap = 1 - vals.snap;
      const heard = ci;
      while (ci < CHORDS.length && CHORDS[ci].t <= x.t) tool.onChord!(CHORDS[ci++], x);
      const before = log.length;
      tool.frame!(x);
      if (ci > heard) firstDraw.push(log.slice(before).filter((l) => l.startsWith('drawImage')).length);
    }
  } finally { Math.random = random; }
  return { log, firstDraw };
}

describe('flee: the snap switch', () => {
  it('is a sixth knob, an off/on switch that is off by default, and flee-snap is gone', () => {
    const { widgets } = loadCatalogue();
    const keys = widgets.get('flee')!.params.map((p) => p.key);
    expect(keys).toEqual(['mix', 'exp', 'twitch', 'streak', 'pal', 'snap', 'presence']);
    expect(widgets.get('flee')!.params.find((p) => p.key === 'snap')).toMatchObject({ min: 0, max: 1, step: 1, value: 0 });
    expect(widgets.has('flee-snap')).toBe(false);
  });

  it('on, draws from song time and x.rnd only: no Math.random, and the same picture twice', () => {
    const a = play({ snap: 1 }, 6, { randomThrows: true }), b = play({ snap: 1 }, 6, { randomThrows: true });
    expect(a.log.length).toBeGreaterThan(1000);
    expect(b.log).toEqual(a.log);
  });

  it('on, a note is drawn in its own step; off, the old flee draws something else', () => {
    const on = play({ snap: 1 }), off = play({ snap: 0 });
    expect(on.firstDraw[0]).toBeGreaterThan(0);
    expect(on.log).not.toEqual(off.log);
  });

  it('flipped in the middle, starts afresh without failing, either way', () => {
    expect(() => play({ snap: 0 }, 6, { flipAt: 150 })).not.toThrow();
    expect(() => play({ snap: 1 }, 6, { flipAt: 150 })).not.toThrow();
  });
});
