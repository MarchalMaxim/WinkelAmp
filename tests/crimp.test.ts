// Crimp: fuzzy to sharp. The entry, the straight strike, the wool,
// the still between notes, the gone time, the repeat in place, velocity gain, the one-note guard, the cap, the bone
// budget, and that it is stateless (determinism and seeks).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit, recorder } from './helpers/widget';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/crimp.js', import.meta.url), 'utf8');
const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { document: G.document, window: G.window }; });
afterAll(() => { G.document = saved.document; G.window = saved.window; });

const COLS = ['ink', 'dim', 'red', 'gold', 'blue', 'green', 'violet'];
const icon = new Proxy({}, { get: (_o, k) => (COLS.includes(String(k)) ? '#abc' : () => {}) }) as unknown as IconLib;

type Frames = Map<number, string[]>;
/** Plays `notes` at 60 Hz for `secs`; returns what `frame` drew at each step (step f is x.t = f / 60), only for steps in `keep`. */
function play(notes: Note[], knobs: Record<string, number> = {}, { secs = 6, picked = false, throwRandom = false, only }: { secs?: number; picked?: boolean; throwRandom?: boolean; only?: number[] } = {}) {
  const chords: Chord[] = groupChords(notes);
  const log: string[] = [], ids = new Map<unknown, number>(), rec = recorder(log, ids);
  G.document = { createElement: () => { const c: Record<string, unknown> = { width: 0, height: 0 }; ids.set(c, ids.size); c.getContext = () => (c.g ??= rec(c)); return c; } };
  const tool = instantiate('crimp', SRC, { kit: kit(), icon, chords }) as ToolDef & Record<string, (...a: unknown[]) => void>;
  const vals: Record<string, number> = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const x = { g: rec({}), t: 0, dt: 1 / 60, W: 1280, H: 720, rnd: (a: number) => a, p: (k: string) => vals[k], picked } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (throwRandom) Math.random = () => { throw new Error('Math.random'); };
  const frames: Frames = new Map();
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    const steps = only ?? Array.from({ length: Math.round(secs * 60) }, (_v, i) => i + 1);
    for (const f of steps) {
      x.t = f / 60;
      while (ci < chords.length && chords[ci].t <= x.t) tool.onChord!(chords[ci++], x);
      const before = log.length;
      tool.frame!(x);
      frames.set(f, log.slice(before));
    }
  } finally { Math.random = random; }
  return frames;
}

const step = (t: number) => Math.round(t * 60);
const count = (fr: string[], what: string) => fr.filter((l) => l.startsWith(`${what}(`)).length;
const rects = (fr: string[]) => fr.filter((l) => l.startsWith('rect(')).map((l) => l.slice(5, -1).split(',').map(Number));   // [x, y, w, h]
const imgs = (fr: string[]) => fr.filter((l) => l.startsWith('drawImage(')).map((l) => l.slice(10, -1).split(','));
const fills = (fr: string[]) => fr.filter((l) => l.startsWith('fillStyle=rgb(')).map((l) => l.slice(14, -1).split(',').map(Number));
const note = (t: number, m: number, v: number): Note => [t, t + 0.3, m, v];
/** Twenty quiet-to-loud filler notes high up after `from`, so the clip's p10/p90 are spread and the guard does not fire. */
const filler = (from: number, n = 20): Note[] => Array.from({ length: n }, (_v, i) => note(from + 0.3 * i, 80 + (i % 10), 40 + Math.round((60 * i) / (n - 1))));
const ys = (fr: string[]) => rects(fr).map((r) => r[1]);

describe('crimp: the entry', () => {
  it('is one tool with the right shape and knobs', () => {
    const chords: Chord[] = [];
    G.document = { createElement: () => ({ getContext: () => recorder([], new Map())({}) }) };
    const tool = instantiate('crimp', SRC, { kit: kit(), icon, chords });
    expect(tool).toMatchObject({ id: 'crimp', name: 'Crimp', tag: 'new' });
    expect(tool.blurb!.length).toBeGreaterThan(20);
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['slack', 'reach', 'fibres', 'stays', 'presence']);
    const by = Object.fromEntries(ps.map((p) => [p.key, p]));
    expect(by.slack).toMatchObject({ min: 1, max: 6.5, value: 5 });
    expect(by.reach).toMatchObject({ min: 0.3, max: 1.4, value: 1, less: 0.3 });
    expect(by.fibres).toMatchObject({ min: 3, max: 21, value: 15, less: 3, step: 1 });
    expect(by.stays).toMatchObject({ min: 0.4, max: 3, value: 1.2, less: 0.4 });
    expect(by.presence).toMatchObject({ min: 0, max: 1, value: 1, leads: true });
    expect(by.slack.less).toBeUndefined();
    for (const p of ps) { expect(p.hint).toContain('Left:'); expect(p.hint).toContain('Right:'); }
    for (const p of ps) for (const v of [0, 0.5, 1]) expect(() => p.icon!(recorder([], new Map())({}) as never, v, 40, 26)).not.toThrow();
    const cat = loadCatalogue().widgets.get('crimp')!;
    expect(cat.params.map((p) => p.key)).toEqual(['slack', 'reach', 'fibres', 'stays', 'presence']);
    expect(SRC).not.toMatch(/\bp\(\s*'presence'/);
    expect(SRC).not.toContain('Math.random');
  });
});

describe('crimp: the picture', () => {
  const one = [note(1.0, 60, 90)];

  it('strikes dead straight on the attack step: one lighten fill of 15 rects, hot red-bone, no sprites', () => {
    const fr = play(one, {}, { only: [step(1.0)] }).get(step(1.0))!;
    expect(fr).toContain('globalCompositeOperation=lighten');
    expect(count(fr, 'fill')).toBe(1);
    expect(count(fr, 'rect')).toBe(15);
    expect(count(fr, 'drawImage')).toBe(0);
    expect(fills(fr)[0][0]).toBeGreaterThanOrEqual(214);
  });

  it('turns to wool: 15 sprite crops and no rects a tenth of a second later', () => {
    const fr = play(one, {}, { only: [step(1.1)] }).get(step(1.1))!;
    expect(count(fr, 'drawImage')).toBe(15);
    expect(count(fr, 'rect')).toBe(0);
    expect(fr).toContain('globalCompositeOperation=lighten');
  });

  it('stands still between notes: the same crops two steps apart (only the tone strip may change)', () => {
    const fr = play(one, { stays: 3 }, { only: [step(1.8), step(1.9)] });
    const a = imgs(fr.get(step(1.8))!), b = imgs(fr.get(step(1.9))!);
    expect(a.length).toBe(15);
    expect(b.map((r) => r.slice(1))).toEqual(a.map((r) => r.slice(1)));
  });

  it('is gone from born + stays - 0.25', () => {
    const fr = play(one, { stays: 3 }, { only: [step(1.0 + 2.75), step(1.0 + 3.2), step(1.0 + 2.7)] });
    for (const t of [3.75, 4.2]) { const f = fr.get(step(t))!; expect(count(f, 'drawImage') + count(f, 'rect') + count(f, 'fill')).toBe(0); }
    expect(count(fr.get(step(3.7))!, 'drawImage')).toBe(15);
    const d = play(one, {}, { only: [step(1.96), step(1.9)] });
    const f = d.get(step(1.96))!;
    expect(count(f, 'drawImage') + count(f, 'rect') + count(f, 'fill')).toBe(0);
    expect(count(d.get(step(1.9))!, 'drawImage')).toBe(15);
  });

  it('a repeat yanks its strip straight in place, longer when louder', () => {
    const notes = [note(1.0, 60, 60), note(1.5, 60, 110), ...filler(2.5)];
    const fr = play(notes, {}, { only: [step(1.0), step(1.5)] });
    const a = rects(fr.get(step(1.0))!), b = rects(fr.get(step(1.5))!);
    expect(a.length).toBe(15);
    expect(b.length).toBe(15);
    expect(count(fr.get(step(1.5))!, 'drawImage')).toBe(0);
    expect(ys(fr.get(step(1.5))!)).toEqual(ys(fr.get(step(1.0))!));
    for (let i = 0; i < 15; i++) {
      expect(b[i][2]).toBeGreaterThan(a[i][2]);
      expect(Math.abs(b[i][0] + b[i][2] / 2 - (a[i][0] + a[i][2] / 2))).toBeLessThanOrEqual(1);
    }
  });

  it('gives velocity real gain: the loudest ribbon is 500 px longer than the softest', () => {
    const notes = Array.from({ length: 20 }, (_v, i) => note(1 + 0.5 * i, 40 + 2 * i, 40 + Math.round((60 * i) / 19)));
    const at = (i: number) => play(notes, {}, { only: [step(1 + 0.5 * i)] }).get(step(1 + 0.5 * i))!;
    const mean = (fr: string[]) => rects(fr).reduce((s, r) => s + r[2], 0) / rects(fr).length;
    expect(mean(at(19)) - mean(at(0))).toBeGreaterThanOrEqual(500);
  });

  it('a one-note clip has no NaN and lands 1080 px wide', () => {
    const fr = play(one, {}, { only: [step(1.0)] }).get(step(1.0))!;
    expect(fr.join('|')).not.toContain('NaN');
    const w = rects(fr).reduce((s, r) => s + r[2], 0) / 15;
    expect(Math.abs(w - 1080)).toBeLessThanOrEqual(60);
  });

  it('caps the crowd: twenty pitches in 0.4 s never draw more than 240 rects and crops', () => {
    const notes = Array.from({ length: 20 }, (_v, i) => note(1 + 0.02 * i, 40 + 2 * i, 40 + 3 * i));
    const fr = play(notes, {}, { secs: 3 });
    let worst = 0;
    for (const f of fr.values()) worst = Math.max(worst, count(f, 'rect') + count(f, 'drawImage'));
    expect(worst).toBeGreaterThan(100);
    expect(worst).toBeLessThanOrEqual(240);
  });

  it('spends a bone budget: of six struck ribbons at most two stay bone, the rest are HOT', () => {
    const chord = [48, 52, 55, 60, 64, 67].map((m) => note(1.0, m, 110));
    const fr = play([...chord, ...filler(2.5)], { fibres: 21, reach: 1.4 }, { only: [step(1.0)] }).get(step(1.0))!;
    const fs = fills(fr);
    expect(count(fr, 'fill')).toBe(6);
    expect(fs.length).toBe(6);
    expect(fs.filter((c) => c[1] >= 150).length).toBeLessThanOrEqual(2);
    for (const c of fs.filter((c) => c[1] < 150)) expect(c).toEqual([214, 58, 40]);
  });
});

describe('crimp: stateless', () => {
  const song = Array.from({ length: 24 }, (_v, i) => note(0.4 + 0.25 * i, 50 + ((i * 7) % 30), 40 + ((i * 13) % 60)));

  it('draws the same twice, with Math.random replaced by a thrower', () => {
    const a = play(song, {}, { throwRandom: true }), b = play(song, {}, { throwRandom: true });
    expect([...b]).toEqual([...a]);
    expect([...a.values()].some((f) => f.length > 20)).toBe(true);
  });

  it('after a seek, a fresh tool draws the same frame as the played run', () => {
    const full = play(song).get(step(4.2))!;
    const fresh = play(song, {}, { only: [step(4.2)] }).get(step(4.2))!;
    expect(fresh.length).toBeGreaterThan(10);
    expect(fresh).toEqual(full);
  });
});
