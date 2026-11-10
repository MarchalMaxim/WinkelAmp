// Film: one ink-blue sail whose corners are the last notes. Drawn statelessly from CHORDS and x.t.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit } from './helpers/widget';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/film.js', import.meta.url), 'utf8');
const mkIcon = () => new Proxy({ ink: '#fff', blue: '#4f86c6', dim: '#6d635b', red: '#c43a2c' } as Record<string, unknown>, { get: (o, k) => (k in o ? o[k as string] : () => {}) }) as unknown as IconLib;

function recorder(log: string[]) {
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? 'obj' : String(v));
  return new Proxy({} as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); }),
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

const DEFAULTS = { corners: 3, slack: 0.6, kick: 0.14, stay: 2, tips: 1, presence: 1 };
type Knobs = Partial<typeof DEFAULTS>;
function make(notes: Note[]) {
  const chords: Chord[] = groupChords(notes);
  const tool = instantiate('film', SRC, { kit: kit(), icon: mkIcon(), chords }) as ToolDef;
  return { chords, tool };
}
const frameAt = (tool: ToolDef, t: number, knobs: Knobs, log: string[]) => {
  const vals = { ...DEFAULTS, ...knobs } as Record<string, number>;
  const x = { g: recorder(log), t, dt: 1 / 60, W: 1280, H: 720, picked: false, rnd: () => { throw new Error('x.rnd used'); }, p: (k: string) => vals[k] } as unknown as WidgetCtx;
  tool.frame!(x);
};
/** Plays at 60 Hz from 0 to secs; returns the log of each frame, by time. */
function play(notes: Note[], knobs: Knobs = {}, secs = 8) {
  const { tool } = make(notes);
  const frames: { t: number; log: string[] }[] = [];
  const rand = Math.random; Math.random = () => { throw new Error('Math.random used'); };
  try {
    for (let f = 1; f <= secs * 60; f++) { const t = f / 60, log: string[] = []; frameAt(tool, t, knobs, log); frames.push({ t, log }); }
  } finally { Math.random = rand; }
  return frames;
}
const at = (frames: { t: number; log: string[] }[], t: number) => frames.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b)).log;
const paths = (log: string[]) => log.filter((l) => /^(moveTo|quadraticCurveTo|lineTo|arc|closePath)\(/.test(l));
const sailCount = (log: string[]) => { const c = log.indexOf('closePath()'); return log.slice(0, c).filter((l) => l.startsWith('quadraticCurveTo') || l.startsWith('lineTo')).length; };

const note = (t: number, m: number, v = 80): Note => [t, t + 0.4, m, v];
const sparse: Note[] = []; for (let i = 0; i < 12; i++) sparse.push(note(1 + i * 1.5, 60 + ((i * 7) % 25), 50 + ((i * 13) % 60)));
const run: Note[] = []; for (let i = 0; i < 40; i++) run.push(note(1 + i * 0.08, 60 + ((i * 5) % 24), 70));
const chordThenSingles: Note[] = [];
for (let k = 0; k < 6; k++) chordThenSingles.push(note(1, 48 + k * 5, 90));
for (let i = 0; i < 8; i++) chordThenSingles.push(note(2 + i * 0.3, 60 + ((i * 3) % 12), 80));
const repeat: Note[] = []; for (let i = 0; i < 6; i++) repeat.push(note(1 + i * 0.6, 67, 80));
const single: Note[] = [note(1, 64, 80)];
const gap: Note[] = [];
for (let k = 0; k < 6; k++) gap.push(note(1, 48 + k * 5, 90));
gap.push(note(6, 70, 80));
const songs = { sparse, run, chordThenSingles, repeat, single, gap };

describe('film', () => {
  it('has the entry and knobs of the plan', () => {
    const { tool } = make(sparse);
    expect(tool).toMatchObject({ id: 'film', name: 'Film', tag: 'new', on: false });
    expect(typeof tool.blurb).toBe('string');
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['corners', 'slack', 'kick', 'stay', 'tips', 'presence']);
    const by = Object.fromEntries(ps.map((p) => [p.key, p]));
    expect(by.corners).toMatchObject({ min: 3, max: 7, value: 3, step: 1 });
    expect(by.slack).toMatchObject({ min: 0, max: 1, value: 0.6 });
    expect(by.kick).toMatchObject({ min: 0, max: 0.4, value: 0.14 });
    expect(by.stay).toMatchObject({ min: 0.3, max: 4, value: 2, less: 0.6 });
    expect(by.tips).toMatchObject({ min: 0, max: 1, value: 1, less: 0.3 });
    expect(by.presence).toMatchObject({ min: 0, max: 1, value: 1, leads: true });
    for (const p of ps) { expect(p.key === 'stay' || p.key === 'tips' ? true : p.less === undefined).toBe(true); expect(p.hint).toMatch(/Left/); expect(p.hint).toMatch(/Right/); }
    for (const p of ps) for (const v of [0, 1]) expect(() => p.icon!(recorder([]) as unknown as CanvasRenderingContext2D, v, 30, 30)).not.toThrow();
  });

  it('draws on the attack step: a fill, lighten, a bone tip, and ends on source-over', () => {
    const f = play(sparse, {}, 3);
    const log = f.find((q) => q.t >= 1)!.log;
    expect(log.some((l) => l.startsWith('fill('))).toBe(true);
    expect(log).toContain('globalCompositeOperation=lighten');
    expect(log).toContain('fillStyle=rgb(236,226,208)');
    const modes = log.filter((l) => l.startsWith('globalCompositeOperation='));
    expect(modes[modes.length - 1]).toBe('globalCompositeOperation=source-over');
  });

  it('moves nothing between notes; the blue only falls', () => {
    const f = play(sparse, {}, 5);
    const a = at(f, 1.6), b = at(f, 2.2);   // 0.6 s and 1.2 s after the attack at 1.0
    expect(paths(a)).toEqual(paths(b));
    const blue = (l: string[]) => Number(/fillStyle=rgb\(\d+,\d+,(\d+)\)/.exec(l.find((s) => s.startsWith('fillStyle='))!)![1]);
    expect(blue(b)).toBeLessThanOrEqual(blue(a));
  });

  it('is gone from stay + 0.25', () => {
    for (const stay of [2, 0.3]) {
      const f = play(single, { stay }, 5);
      expect(at(f, 1 + stay + 0.2).length).toBeGreaterThan(0);
      expect(at(f, 1 + stay + 0.26)).toEqual([]);
      expect(at(f, 4.5)).toEqual([]);
    }
  });

  it('is stateless: a fresh instance draws the same frame', () => {
    const notes = [...sparse, ...run.map((n) => [n[0] + 20, n[1] + 20, n[2], n[3]] as Note)];
    const played = play(notes, {}, 30);
    for (const base of [1, 2.5, 4, 21.2, 22]) for (const d of [0, 0.1, 0.3, 1.0]) {
      const t = Math.round((base + d) * 60) / 60, log: string[] = [];
      frameAt(make(notes).tool, t, {}, log);
      expect(log).toEqual(at(played, t));
    }
  });

  it('is deterministic and finite, and never uses Math.random or x.rnd', () => {
    for (const [name, s] of Object.entries(songs)) {
      const a = play(s, {}, 8), b = play(s, {}, 8);
      expect(a.map((f) => f.log)).toEqual(b.map((f) => f.log));
      const all = a.flatMap((f) => f.log);
      expect(all.some((l) => /NaN|Infinity/.test(l)), name).toBe(false);
    }
  });

  it('counts its corners: 3 for singles, 6/5/4/3 after a six-note chord, 5 with corners=5, pads after silence', () => {
    expect(sailCount(at(play(sparse, {}, 20), 3.5 + 0.6))).toBe(3);
    const f = play(chordThenSingles, { stay: 4 }, 6);
    // held frames 0.28 s after each attack: the chord at 1, then singles at 2.0, 2.3, 2.6
    expect([1, 2.0, 2.3, 2.6].map((t) => sailCount(at(f, t + 0.28)))).toEqual([6, 5, 4, 3]);
    const f5 = play(sparse, { corners: 5, stay: 4 }, 14);
    expect(sailCount(at(f5, 1 + 5 * 1.5 + 0.6))).toBe(5);
    const g = play(gap, { corners: 5 }, 8);
    expect(sailCount(at(g, 6.6))).toBe(3);
  });

  it('changes shape on a repeat', () => {
    const f = play(repeat, { stay: 4 }, 5);
    const shape = (k: number) => paths(at(f, 1 + k * 0.6 + 0.55));
    expect(shape(2)).not.toEqual(shape(3));
    expect(shape(3)).not.toEqual(shape(4));
  });
});
