// Flee's snap slider (2026-11-05: flee-snap.js folded into flee.js behind a switch, then the switch made a slider): the knob,
// that 0 and 1 draw exactly what the old switch drew off and on (digests of the draw log taken from flee.js before the
// slider, with Math.random seeded on the old side), that the values between are a third look, and that the snap side is
// drawn from song time and x.rnd only, on the note's own step. That 0 draws what flee drew before is also proved on pixels
// by scripts/checks/snap-scenes-check.mjs (Liebesleid has flee on its accents).
/// <reference types="node" />
import { createHash } from 'node:crypto';
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
function play(knobs: Record<string, number>, secs = 6, { flipAt = -1, randomThrows = false, seededRandom = false, noOnPicks = false } = {}) {
  const log: string[] = [], ids = new Map<unknown, number>(), rec = recorder(log, ids);
  G.document = { createElement: () => { const c: Record<string, unknown> = { width: 0, height: 0 }; ids.set(c, ids.size); c.getContext = () => (c.g ??= rec(c)); return c; } };
  const tool = instantiate('flee', SRC, { icon: { ink: '#fff', gauge() {} } as unknown as IconLib, chords: CHORDS }) as ToolDef & Record<string, (...a: unknown[]) => void>;
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  let seed = 7;
  const rnd = (a: number, b: number) => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return a + (b - a) * (((t ^ (t >>> 14)) >>> 0) / 4294967296); };
  const g = rec({});
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, feat: { rate: 0.3, bass: 0.2, level: 0.5, pitch: 0.5, density: 0.3 }, rnd, p: (k: string) => vals[k], picked: false, ...(noOnPicks ? {} : { onPicks: () => false }) } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (randomThrows) Math.random = () => { throw new Error('Math.random on the snap side'); };
  else if (seededRandom) { let r = 99; Math.random = () => { r = (r + 0x6D2B79F5) | 0; let t = Math.imul(r ^ (r >>> 15), 1 | r); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
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

const digest = (log: string[]) => createHash('sha1').update(log.join('|')).digest('hex');
// The draw logs of flee.js at 8a062c4 (the switch), 6 s, the song above: off with Math.random seeded, and on.
const OLD_OFF = 'c38bec9fbf388cc1029c4663052e68ab2980d7e9', OLD_ON = '0d658d328d78f32ae04a507d7bca45553a45f230';

describe('flee: the snap slider', () => {
  it('is a sixth knob, a slider from 0 to 1 that is 0 by default, and flee-snap is gone', () => {
    const { widgets } = loadCatalogue();
    const keys = widgets.get('flee')!.params.map((p) => p.key);
    expect(keys).toEqual(['mix', 'exp', 'twitch', 'streak', 'pal', 'snap', 'presence']);
    const snap = widgets.get('flee')!.params.find((p) => p.key === 'snap')!;
    expect(snap).toMatchObject({ min: 0, max: 1, value: 0 });
    expect(snap.step).toBeUndefined();
    expect(widgets.has('flee-snap')).toBe(false);
  });

  it('at 0 draws exactly what flee drew before; at 1 exactly what the switch drew on', () => {
    expect(digest(play({ snap: 0 }, 6, { seededRandom: true }).log)).toBe(OLD_OFF);
    expect(digest(play({ snap: 1 }, 6, { randomThrows: true }).log)).toBe(OLD_ON);
  });

  it('in between draws a third picture: 0.5 differs from 0 and from 1, and 0.25 from 0.5', () => {
    const half = play({ snap: 0.5 }).log, zero = play({ snap: 0 }, 6, { seededRandom: true }).log, one = play({ snap: 1 }).log;
    expect(half).not.toEqual(zero);
    expect(half).not.toEqual(one);
    expect(play({ snap: 0.25 }).log).not.toEqual(half);
  });

  it('above 0, draws from song time and x.rnd only: no Math.random, and the same picture twice', () => {
    for (const snap of [0.1, 0.5, 1]) {
      const a = play({ snap }, 6, { randomThrows: true }), b = play({ snap }, 6, { randomThrows: true });
      expect(a.log.length).toBeGreaterThan(1000);
      expect(b.log).toEqual(a.log);
    }
  });

  it('above 0, a note is drawn in its own step', () => {
    for (const snap of [0.1, 0.5, 1]) expect(play({ snap }).firstDraw[0]).toBeGreaterThan(0);
  });

  it('runs on the context the lab and the studio give, with x.picked and no x.onPicks', () => {
    for (const snap of [0.5, 1]) expect(play({ snap }, 6, { noOnPicks: true }).log).toEqual(play({ snap }).log);
  });

  it('moved across 0 in the middle, starts afresh without failing, either way', () => {
    expect(() => play({ snap: 0 }, 6, { flipAt: 150 })).not.toThrow();
    expect(() => play({ snap: 1 }, 6, { flipAt: 150 })).not.toThrow();
  });
});
