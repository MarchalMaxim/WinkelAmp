// Fist of spines (lab/tools/fist.js): the entry and its knobs, the SNAP copy, the attack
// in a bone bucket, the black spot, the rest field, a field that does not move between notes, determinism, a stateless seek,
// velocity normalisation, and a repeat that clenches again.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit } from './helpers/widget';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/fist.js', import.meta.url), 'utf8');

function recorder(log: string[]) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? 'obj' : String(v);
  const grad = { addColorStop() {} };
  return new Proxy({} as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return grad; },
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

const rngFn = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ICON = new Proxy({ ink: '#fff', green: '#0f0', rng: rngFn }, { get: (o, k) => k in o ? (o as Record<string | symbol, unknown>)[k] : () => {} }) as unknown as IconLib;

const mk = (rows: number[][]): Chord[] => groupChords(rows.map((r) => [r[0], r[1], r[2], r[3]] as Note));
/** A clip with spread velocities, a repeated pitch pair and a loud note at 3 s. */
const SPREAD: Note[] = [];
for (let i = 0; i < 24; i++) SPREAD.push([0.5 + i * 0.4, 0.8 + i * 0.4, 52 + ((i * 5) % 24), 42 + ((i * 11) % 50)]);
SPREAD.push([3.0, 3.4, 67, 118]);
SPREAD.sort((a, b) => a[0] - b[0]);

interface Opts { knobs?: Record<string, number>; seed?: number; throws?: boolean; steps?: number[]; picked?: boolean }
/** Plays `chords` at 60 Hz and returns the draw log of every step (index = step number). */
function play(chords: Chord[], secs: number, o: Opts = {}) {
  const log: string[] = [], rec = recorder(log);
  const tool = instantiate('fist', SRC, { kit: kit(), icon: ICON, chords }) as ToolDef;
  const vals: Record<string, number> = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...(o.knobs ?? {}) };
  const rnd = rngFn(o.seed ?? 7);
  const x = { g: rec, t: 0, dt: 1 / 60, W: 1280, H: 720, rnd: (a: number, b: number) => a + (b - a) * rnd(), p: (k: string) => vals[k], picked: !!o.picked, level: 0.5, rate: 0.3, hit: 0 } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (o.throws !== false) Math.random = () => { throw new Error('Math.random in fist'); };
  const steps: string[][] = [];
  try {
    tool.reset!(x);
    const want = o.steps ? new Set(o.steps) : null;
    for (let f = 1; f <= secs * 60; f++) {
      if (want && !want.has(f)) continue;
      x.t = f / 60;
      const before = log.length;
      tool.frame!(x);
      steps[f] = log.slice(before);
    }
  } finally { Math.random = random; }
  return steps;
}

const pts = (l: string[]) => l.filter((s) => s.startsWith('moveTo(') || s.startsWith('lineTo(')).map((s) => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number));
const reds = (l: string[]) => l.filter((s) => s.startsWith('fillStyle=rgb(')).map((s) => Number(s.slice(14).split(',')[0]));
const count = (l: string[], name: string) => l.filter((s) => s.startsWith(name + '(')).length;
const joined = (steps: string[][]) => steps.map((s) => (s ?? []).join('|')).join('\n');

describe('fist: the entry', () => {
  const tool = instantiate('fist', SRC, { kit: kit(), icon: ICON, chords: [] }) as ToolDef;
  it('is Fist of spines, new, with the planned knobs', () => {
    expect(tool.id).toBe('fist'); expect(tool.name).toBe('Fist of spines'); expect(tool.tag).toBe('new');
    const keys = tool.params!.map((p) => p.key);
    expect(keys).toEqual(['reach', 'spines', 'stab', 'ring', 'ground', 'presence']);
    expect(keys.filter((k) => k !== 'presence')).toHaveLength(5);
    const less = tool.params!.filter((p) => p.less !== undefined).map((p) => [p.key, p.less]);
    expect(less).toEqual([['spines', 50], ['ring', 0.25]]);
    const pres = tool.params!.find((p) => p.key === 'presence')!;
    expect(pres).toMatchObject({ leads: true, min: 0, max: 1, value: 1 });
    for (const p of tool.params!) { expect(p.hint).toContain('Left:'); expect(p.hint).toContain('Right:'); }
  });
  it('has icons that run on a stub context', () => {
    for (const p of tool.params!) for (const v of [0, 0.5, 1]) expect(() => p.icon!(recorder([]) as unknown as CanvasRenderingContext2D, v, 40, 26)).not.toThrow();
  });
});


describe('fist: the picture', () => {
  const CH = mk(SPREAD as unknown as number[][]);
  it('the attack step of a hard note is lighten, with at least two fills and a bone bucket', () => {
    const f = 180;   // 3.0 s
    expect(CH.some((c) => Math.abs(c.t - 3.0) < 1e-9)).toBe(true);
    const l = play(CH, 3.1, { steps: [f] })[f];
    expect(l).toContain('globalCompositeOperation=lighten');
    expect(count(l, 'fill')).toBeGreaterThanOrEqual(2);
    expect(Math.max(...reds(l))).toBeGreaterThanOrEqual(200);
  });

  it('the struck spot stays black: no point within 10 px on the attack step and two steps after', () => {
    const one = mk([[1.0, 1.5, 64, 90]]);
    const steps = play(one, 1.2, { steps: [60, 61, 62] });
    for (const f of [60, 61, 62]) {
      const p = pts(steps[f]);
      expect(p.length).toBeGreaterThan(0);
      const d = Math.min(...p.map(([px, py]) => Math.hypot(px - 640, py - 301.09)));
      expect(d).toBeGreaterThanOrEqual(10);
    }
  });

  it('draws the rest field: 252, 45 and 594 needles, and no fill at ground 0', () => {
    const one = mk([[5.0, 5.5, 64, 90]]);
    expect(count(play(one, 0.05, { steps: [1] })[1], 'moveTo')).toBe(252);
    expect(count(play(one, 0.05, { steps: [1], knobs: { spines: 50 } })[1], 'moveTo')).toBe(45);
    expect(count(play(one, 0.05, { steps: [1], knobs: { spines: 600 } })[1], 'moveTo')).toBe(594);
    expect(count(play(one, 0.05, { steps: [1], knobs: { ground: 0 } })[1], 'fill')).toBe(0);
  });

  it('nothing moves between notes: a frame before the first chord equals frames long after the last', () => {
    const one = mk([[1.0, 1.5, 64, 90]]);
    const s = play(one, 3, { steps: [10, 1.0 * 60 + 75, 150, 170] });
    expect(s[135]).toEqual(s[10]); expect(s[150]).toEqual(s[10]); expect(s[170]).toEqual(s[10]);
  });

  it('is deterministic: twice the same, another x.rnd seed the same, Math.random never called', () => {
    const a = play(CH, 6), b = play(CH, 6), c = play(CH, 6, { seed: 12345 });
    expect(joined(b)).toBe(joined(a)); expect(joined(c)).toBe(joined(a));
    expect(joined(a).length).toBeGreaterThan(10000);
  });

  it('a seek lands where continuous play is: a fresh instance at chord.t + 0.1', () => {
    const f = Math.round((CH[8].t + 0.1) * 60);
    const cont = play(CH, 6)[f];
    const fresh = play(CH, 6, { steps: [f] })[f];
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh).toEqual(cont);
    const g = Math.round((CH[20].t + 0.3) * 60);
    expect(play(CH, 12, { steps: [g] })[g]).toEqual(play(CH, 12)[g]);
  });

  it('normalises velocity by the clip: every velocity minus 20 draws the same', () => {
    const lowered = mk(SPREAD.map((n) => [n[0], n[1], n[2], n[3] - 20]));
    expect(joined(play(lowered, 5))).toBe(joined(play(CH, 5)));
  });

  it('a repeat clenches again: the second attack step is in a bone bucket as well', () => {
    const rep: Note[] = [[0.5, 0.9, 50, 40], [0.9, 1.2, 76, 40], [1.0, 1.2, 64, 110], [1.1, 1.4, 64, 110], [1.5, 1.8, 60, 80], [1.7, 1.9, 70, 60]];
    const ch = groupChords(rep);
    const s = play(ch, 1.3, { steps: [60, 66] });
    expect(Math.max(...reds(s[60]))).toBeGreaterThanOrEqual(200);
    expect(Math.max(...reds(s[66]))).toBeGreaterThanOrEqual(200);
  });
});
