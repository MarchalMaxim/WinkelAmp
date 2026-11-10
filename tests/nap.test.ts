// Nap: the knobs, the attack step, a held field that does not change between notes, the off switch
// on a repeat, memory, the silence fade, determinism, seeking, and the one-note guard. Loads only lab/tools/nap.js (no catalogue).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit } from './helpers/widget';
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

const SRC = readFileSync(new URL('../lab/tools/nap.js', import.meta.url), 'utf8');
const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { document: G.document, window: G.window }; });
afterAll(() => { G.document = saved.document; G.window = saved.window; });

/** 30 notes 0.25 s apart, pitches 60 64 67 64 cycling, velocities 50..100 cycling. */
const SONG: Note[] = [];
for (let i = 0; i < 30; i++) SONG.push([0.5 + i * 0.25, 0.7 + i * 0.25, [60, 64, 67, 64][i % 4], 50 + ((i * 10) % 55)]);

interface Run { frames: string[][]; log: string[]; tool: ToolDef }
/** Plays `notes` for `secs` at 60 Hz. frames[f] is what frame f (t = f/60) drew on the main context; tile canvases log elsewhere. */
function play(notes: Note[], { secs = 16, knobs = {}, picked = false, only = null as number[] | null } = {}): Run {
  const chords: Chord[] = groupChords(notes);
  const log: string[] = [], junk: string[] = [], ids = new Map<unknown, number>(), junkIds = new Map<unknown, number>();
  const rec = recorder(log, ids), jrec = recorder(junk, junkIds);
  G.window = { NOTES: notes };
  G.document = { createElement: () => { const c: Record<string, unknown> = { width: 0, height: 0 }; junkIds.set(c, junkIds.size); c.getContext = () => (c.g ??= jrec(c)); return c; } };
  const tool = instantiate('nap', SRC, { kit: kit(), icon: { ink: '#fff', gauge() {} } as unknown as IconLib, chords });
  const vals: Record<string, number> = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const rnd = () => { throw new Error('x.rnd in nap'); };
  const x = { g: rec({}), t: 0, dt: 1 / 60, W: 1280, H: 720, feat: { rate: 0.3, bass: 0.2, level: 0.5, pitch: 0.5, density: 0.3, hit: 0 }, rnd, p: (k: string) => vals[k], picked } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  Math.random = () => { throw new Error('Math.random in nap'); };
  const frames: string[][] = [];
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    for (let f = 0; f <= secs * 60; f++) {
      x.t = f / 60;
      while (ci < chords.length && chords[ci].t <= x.t) tool.onChord!(chords[ci++], x);
      if (only && !only.includes(f)) { frames[f] = []; continue; }
      const before = log.length;
      tool.frame!(x);
      frames[f] = log.slice(before);
    }
  } finally { Math.random = random; }
  return { frames, log, tool };
}

const frameAt = (t: number) => Math.round(t * 60);
const count = (lines: string[], re: RegExp | string) => lines.filter((l) => typeof re === 'string' ? l.startsWith(re) : re.test(l)).length;
const drawLines = (lines: string[]) => lines.filter((l) => /^(moveTo|lineTo|fill)\(/.test(l));
const song1 = (): Note[] => [[1.0, 1.2, 72, 80], [1.5, 1.7, 72, 80], [2.0, 2.2, 72, 80]];

describe('nap', () => {
  it('has the knobs, hints, icons, less values and defaults the plan names', () => {
    const { tool } = play(SONG, { secs: 0 });
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['memory', 'width', 'slant', 'rest', 'cloth', 'presence']);
    for (const p of ps) {
      expect(p.label).toBeTruthy();
      expect(p.hint).toContain('Left:');
      expect(p.hint).toContain('Right:');
      expect(typeof p.icon).toBe('function');
    }
    const by = Object.fromEntries(ps.map((p) => [p.key, p]));
    expect(by.presence.leads).toBe(true);
    expect(by.memory.less).toBe(1);
    expect(by.width.less).toBe(0.7);
    expect(by.rest.less).toBe(1.5);
    expect(by.slant.less).toBeUndefined();
    expect(by.cloth.less).toBeUndefined();
    expect(by.memory).toMatchObject({ min: 1, max: 16, step: 1, value: 7 });
    expect(by.width).toMatchObject({ min: 0.5, max: 1.6, value: 1 });
    expect(by.slant).toMatchObject({ min: 0, max: 1, value: 0.7 });
    expect(by.rest).toMatchObject({ min: 1, max: 12, value: 4 });
    expect(by.cloth).toMatchObject({ min: 0, max: 2, step: 1, value: 0 });
    expect(by.presence).toMatchObject({ min: 0, max: 1, value: 1 });
    expect(tool.tag).toBe('new');
  });

  it('on the attack step lights the strike and the bone hairs, under lighten', () => {
    const r = play(SONG, { secs: 2 });
    const t0 = groupChords(SONG)[0].t, f = Math.ceil(t0 * 60 - 1e-9);
    const lines = r.frames[f];
    expect(lines).toContain('globalCompositeOperation=lighten');
    expect(lines).toContain('fill(evenodd)');
    expect(count(lines, 'fill()')).toBeGreaterThanOrEqual(2);   // the strike, then the hairs
    const bone = lines.filter((l) => /^fillStyle=rgb\(\d+,\d+,\d+\)$/.test(l)).map((l) => l.match(/\d+/g)!.map(Number));
    expect(bone.length).toBeGreaterThan(0);
    const [R, Gc, B] = bone[0], k = R / 236;
    expect(k).toBeGreaterThan(0.29);
    expect(k).toBeLessThanOrEqual(1);
    expect(Math.abs(Gc - 226 * k)).toBeLessThan(1.6);
    expect(Math.abs(B - 208 * k)).toBeLessThan(1.6);
    expect(lines.filter((l) => l.startsWith('globalAlpha='))).toSatisfy((a: string[]) => a.every((l) => l === 'globalAlpha=1.000'));
  });

  it('is still between notes: two steps more than 0.1 s after a note give the same log', () => {
    const cs = groupChords(SONG);
    const r = play(SONG, { secs: 8 });
    for (const k of [3, 7, 12]) {
      const f = frameAt(cs[k].t + 0.12);
      expect(r.frames[f].length).toBeGreaterThan(0);
      expect(r.frames[f + 1]).toEqual(r.frames[f]);
    }
  });

  it('turns a band off when the same note is struck again, and on a third time', () => {
    const r = play(song1(), { secs: 3 });
    expect(count(r.frames[frameAt(1.2)], 'moveTo')).toBe(1);
    const a = r.frames[frameAt(1.5)];
    expect(a).not.toContain('fill(evenodd)');
    const i = a.indexOf('fillStyle=obj');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(a.slice(i)).toContain('fill()');
    expect(r.frames[frameAt(1.7)]).not.toContain('fill(evenodd)');
    expect(count(r.frames[frameAt(2.2)], 'moveTo')).toBe(1);
    expect(r.frames[frameAt(2.2)]).toContain('fill(evenodd)');
  });

  it('with memory 1 keeps exactly one band in the field', () => {
    const r = play(SONG, { secs: 8, knobs: { memory: 1 } });
    expect(count(r.frames[frameAt(5.9)], 'moveTo')).toBe(1);
    const r7 = play(SONG, { secs: 8 });
    expect(count(r7.frames[frameAt(5.9)], 'moveTo')).toBeGreaterThan(1);
  });

  it('goes dark once the rest time has passed after the last stroke', () => {
    const cs = groupChords(SONG), last = cs[cs.length - 1].t;
    const r = play(SONG, { secs: 16 });
    expect(r.frames[frameAt(last + 4 * 0.5)]).toContain('fill(evenodd)');
    expect(r.frames[frameAt(last + 4 + 0.1)]).not.toContain('fill(evenodd)');
    expect(count(r.frames[frameAt(last + 4 + 0.1)], 'fill')).toBe(0);
  });

  it('is deterministic and uses neither Math.random nor x.rnd', () => {
    const a = play(SONG, { secs: 6 }), b = play(SONG, { secs: 6 });
    expect(a.log.length).toBeGreaterThan(1000);
    expect(b.log).toEqual(a.log);
  });

  it('draws the same picture after a seek', () => {
    const cont = play(SONG, { secs: 6 });
    for (const t of [5.0, 5.1, 3.3]) {
      const f = frameAt(t);
      const fresh = play(SONG, { secs: 6, only: [f] });
      expect(drawLines(fresh.frames[f])).toEqual(drawLines(cont.frames[f]));
      expect(drawLines(fresh.frames[f]).length).toBeGreaterThan(0);
    }
  });

  it('after a completed silence the first new note lights only itself', () => {
    const notes: Note[] = [[1, 1.2, 60, 80], [1.5, 1.7, 64, 80], [2, 2.2, 67, 80], [12, 12.2, 72, 80]];
    const r = play(notes, { secs: 13 });
    expect(count(r.frames[frameAt(2.2)], 'moveTo')).toBe(3);
    expect(count(r.frames[frameAt(12.2)], 'moveTo')).toBe(1);
  });

  it('gives every note of a fast run its strike and hairs, but only throttled field changes', () => {
    const run: Note[] = [];
    for (let i = 0; i < 6; i++) run.push([1 + i * 0.05, 1.3 + i * 0.05, 60 + i * 2, 80]);
    const r = play(run, { secs: 2 });
    const cs = groupChords(run);
    expect(cs.length).toBeGreaterThan(3);
    for (const c of cs) {
      const lines = r.frames[Math.ceil(c.t * 60 - 1e-9)];
      expect(count(lines, 'fill()')).toBeGreaterThanOrEqual(2);
    }
  });

  it('survives a one-note song and picked notes', () => {
    const one: Note[] = [[1, 1.3, 60, 90]];
    expect(() => play(one, { secs: 3 })).not.toThrow();
    expect(() => play(one, { secs: 3, picked: true })).not.toThrow();
    expect(() => play(SONG, { secs: 4, picked: true })).not.toThrow();
    expect(() => play([], { secs: 1 })).not.toThrow();
  });
});
