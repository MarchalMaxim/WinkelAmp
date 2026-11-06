// Tack (docs/mockups/nature/plans/tack.md): the knobs, the attack in its own step, the tone rule (lighten, alpha 1), stillness
// after the tear, gone at stay, the repeat rule, determinism and seeking, velocity normalisation and the picks floor.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/tack.js', import.meta.url), 'utf8');
const noop = () => {};
const ICON = { ink: '#fff', red: '#f00', rect: noop, line: noop, lines: noop, rng: () => () => 0.5, fade: noop, much: noop } as unknown as IconLib;

let savedRandom: () => number;
beforeAll(() => { savedRandom = Math.random; });
afterAll(() => { Math.random = savedRandom; });

type Log = string[];
function recorder(log: { cur: Log }) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : String(v);
  return new Proxy({} as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.cur.push(`${String(k)}(${a.map(fmt).join(',')})`); },
    set: (o, k, v) => { o[k as string] = v; log.cur.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

function make(notes: Note[], knobs: Record<string, number> = {}, picked = false) {
  const chords: Chord[] = groupChords(notes);
  const tool = instantiate('tack', SRC, { icon: ICON, chords }) as ToolDef;
  const vals: Record<string, number> = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const log = { cur: [] as Log };
  const g = recorder(log);
  const thrower = () => { throw new Error('x.rnd must not be called'); };
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, picked, pitch01: (m: number) => Math.max(0, Math.min(1, (m - 21) / 87)), p: (k: string) => vals[k], rnd: thrower } as unknown as WidgetCtx & { t: number };
  Math.random = () => { throw new Error('Math.random'); };
  const frame = (t: number): Log => { log.cur = []; x.t = t; tool.frame!(x); return log.cur; };
  return { tool, frame, x };
}
const count = (l: Log, name: string) => l.filter((s) => s.startsWith(name + '(')).length;
const paths = (l: Log) => l.filter((s) => s.startsWith('moveTo(') || s.startsWith('lineTo('));

const SONG: Note[] = [];
for (let i = 0; i < 40; i++) SONG.push([0.5 + i * 0.13, 0.7 + i * 0.13, 48 + ((i * 7) % 30), 60 + ((i * 13) % 50)]);
SONG.sort((a, b) => a[0] - b[0]);
const LONE: Note[] = [[1.0, 1.5, 60, 80]];

describe('tack', () => {
  it('has the shape: one tool, five knobs, hints, icons, presence leads', () => {
    const { tool } = make(LONE);
    expect(tool.id).toBe('tack'); expect(tool.name).toBe('Tack'); expect(tool.tag).toBe('new'); expect(typeof tool.blurb).toBe('string');
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['pull', 'comb', 'tack', 'stay', 'presence']);
    expect(ps.length).toBeLessThanOrEqual(6);
    for (const p of ps) {
      expect(p.min).toBeLessThan(p.max); expect(p.value).toBeGreaterThanOrEqual(p.min); expect(p.value).toBeLessThanOrEqual(p.max);
      expect(p.hint).toContain('Left'); expect(p.hint).toContain('Right'); expect(typeof p.icon).toBe('function');
    }
    expect(ps.find((p) => p.key === 'presence')!.leads).toBe(true);
    expect(Object.fromEntries(ps.filter((p) => p.less !== undefined).map((p) => [p.key, p.less]))).toEqual({ pull: 0.6, comb: 1, stay: 0.5 });
  });

  it('attacks in its own step: at least two fills, lighten', () => {
    const { frame } = make(LONE);
    expect(count(frame(1.0 - 1 / 60), 'fill')).toBe(0);
    const l = frame(1.0);
    expect(count(l, 'fill')).toBeGreaterThanOrEqual(2);
    expect(l).toContain('globalCompositeOperation=lighten');
  });

  it('fills only under lighten at alpha 1, with save/restore balanced', () => {
    const { frame } = make(SONG);
    for (let f = 30; f < 360; f += 7) {
      const l = frame(f / 60);
      let op = '', al = '';
      for (const s of l) {
        if (s.startsWith('globalCompositeOperation=')) op = s.split('=')[1];
        if (s.startsWith('globalAlpha=')) al = s.split('=')[1];
        if (s.startsWith('fill(')) { expect(op).toBe('lighten'); expect(al).toBe('1.000'); }
      }
      expect(count(l, 'save')).toBe(count(l, 'restore'));
    }
  });

  it('holds still after the tear: only the colour falls', () => {
    const { frame } = make(LONE, { stay: 1.2 });
    const a = frame(1.5), b = frame(1.9);
    expect(paths(a).length).toBeGreaterThan(0);
    expect(paths(a)).toEqual(paths(b));
    const fs = (l: Log) => l.filter((s) => s.startsWith('fillStyle='));
    expect(fs(a)).not.toEqual(fs(b));
  });

  it('is gone at stay', () => {
    for (const stay of [0.3, 1.2]) {
      const { frame } = make(LONE, { stay });
      expect(count(frame(1.0 + stay - 0.05), 'fill')).toBeGreaterThan(0);
      expect(count(frame(1.0 + stay + 0.02), 'fill')).toBe(0);
    }
  });

  it('shuts a repeated pitch into one slab; two pitches stay two', () => {
    const rep = make([[1.0, 1.2, 60, 80], [1.5, 1.7, 60, 80]]).frame(1.86);
    const two = make([[1.0, 1.2, 60, 80], [1.5, 1.7, 64, 80]]).frame(1.86);
    expect(count(rep, 'moveTo')).toBe(2);
    expect(count(two, 'moveTo')).toBe(4);
  });

  it('is deterministic and seekable', () => {
    const run = () => { const { frame } = make(SONG); const out: Log[] = []; for (let f = 1; f <= 360; f++) out.push(frame(f / 60)); return out; };
    const a = run(), b = run();
    expect(b).toEqual(a);
    const fresh = make(SONG).frame(3.2);
    expect(fresh).toEqual(a[Math.round(3.2 * 60) - 1]);
  });

  it('normalises velocity by the clip: every velocity -20 draws the same', () => {
    const shifted = SONG.map((n) => [n[0], n[1], n[2], n[3] - 20] as Note);
    const a = make(SONG), b = make(shifted);
    for (const t of [1.5, 2.2, 3.7, 4.4]) expect(b.frame(t)).toEqual(a.frame(t));
  });

  it('floors picked notes: a soft slab is wider with picks, and a 1-note song does not throw', () => {
    const song: Note[] = [[1.0, 1.2, 60, 40]];
    for (let i = 0; i < 9; i++) song.push([4 + i * 2, 4.2 + i * 2, 72, i % 2 ? 100 : 40]);
    song.push([30, 30.2, 84, 100]);
    const ext = (l: Log) => { const xs = paths(l).map((s) => parseFloat(s.slice(s.indexOf('(') + 1))); return Math.max(...xs) - Math.min(...xs); };
    const plain = ext(make(song, {}, false).frame(1.5)), pk = ext(make(song, {}, true).frame(1.5));
    expect(pk).toBeGreaterThan(plain);
    expect(() => make(LONE, {}, true).frame(1.5)).not.toThrow();
  });
});
