// Plucked corner (lab/tools/pluck.js): the entry and its knobs, the pasted SNAP block, that nothing is drawn without a note,
// that nothing is curved, that a quiet strand does not move, that it is gone on time, that a repeat moves the corner, and that
// it is stateless (a seek, or a run from the middle, draws exactly what the continuous run drew).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit } from './helpers/widget';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/pluck.js', import.meta.url), 'utf8');

function recorder(log: string[]) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? 'obj' : String(v);
  const grad = { addColorStop() {} };
  return new Proxy({} as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return grad; },
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

type Run = { log: string[]; frames: string[][] };
/** Plays `notes` at 60 Hz from `from` to `to` seconds (onChord for every chord passed from 0), one frame per step. */
function play(notes: Note[], knobs: Record<string, number> = {}, to = 6, { from = 0, picked = false, randomThrows = false } = {}): Run {
  const chords: Chord[] = groupChords(notes);
  const tool = instantiate('pluck', SRC, { kit: kit(), icon: { ink: '#fff', gauge() {} } as unknown as IconLib, chords }) as ToolDef & Record<string, (...a: unknown[]) => void>;
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const log: string[] = [], g = recorder(log);
  let seed = 3;
  const rnd = (a: number, b: number) => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return a + (b - a) * (((t ^ (t >>> 14)) >>> 0) / 4294967296); };
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, rnd, p: (k: string) => vals[k], picked, feat: { rate: 0.3, bass: 0.2, level: 0.5, pitch: 0.5, density: 0.3 } } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (randomThrows) Math.random = () => { throw new Error('Math.random'); };
  const frames: string[][] = [];
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    for (let f = Math.round(from * 60) || 1; f <= to * 60; f++) {
      x.t = f / 60;
      while (ci < chords.length && chords[ci].t <= x.t) { if (f >= Math.round(from * 60)) tool.onChord!(chords[ci], x); ci++; }
      const before = log.length;
      tool.frame!(x);
      frames.push(log.slice(before));
    }
  } finally { Math.random = random; }
  return { log, frames };
}

const N = (s: number, e: number, m: number, v: number): Note => [s, e, m, v];
const MELODY: Note[] = [];
for (let i = 0; i < 30; i++) MELODY.push(N(0.5 + i * 0.17, 0.9 + i * 0.17, 40 + ((i * 7) % 40), 50 + ((i * 11) % 50)));
const draws = (fr: string[]) => fr.filter((l) => l.startsWith('stroke(') || l.startsWith('fillRect(')).length;
const lastDraw = (r: Run) => { let at = -1; r.frames.forEach((f, i) => { if (draws(f)) at = i; }); return (at + 1) / 60; };

describe('pluck', () => {
  it('has the entry and the six knobs', () => {
    const tool = instantiate('pluck', SRC, { kit: kit(), icon: { ink: '#fff', gauge() {} } as unknown as IconLib, chords: [] }) as ToolDef;
    expect(tool).toMatchObject({ id: 'pluck', name: 'Plucked corner', tag: 'new' });
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['pull', 'corner', 'shiver', 'ring', 'touch', 'presence']);
    expect(ps.map((p) => p.value)).toEqual([1, 1, 0.09, 1, 2, 1]);
    expect(ps.find((p) => p.key === 'touch')!.step).toBe(1);
    expect(ps.find((p) => p.key === 'presence')!.leads).toBe(true);
    expect(ps.filter((p) => p.less !== undefined).map((p) => [p.key, p.less])).toEqual([['pull', 0.6], ['ring', 0.25]]);
    for (const p of ps) { expect(p.hint).toBeTruthy(); expect(typeof p.icon).toBe('function'); }
  });


  it('draws nothing before the first chord', () => {
    const r = play([N(1, 1.3, 60, 80)], {}, 0.9);
    expect(r.frames.every((f) => f.length === 0)).toBe(true);
  });

  it('on the attack step of a 3-note chord draws 3 strokes and 6 anchors, lightened, 4 px wide', () => {
    const r = play([N(0.5, 1, 48, 80), N(0.5, 1, 60, 80), N(0.5, 1, 72, 80)], {}, 0.6);
    const f = r.frames.find((fr) => fr.length)!;
    expect(f.filter((l) => l.startsWith('stroke(')).length).toBe(3);
    expect(f.filter((l) => l.startsWith('fillRect(')).length).toBe(6);
    expect(f).toContain('globalCompositeOperation=lighten');
    expect(f).toContain('lineWidth=4.000');
  });

  it('is never curved', () => {
    const r = play(MELODY, {}, 6);
    expect(r.log.length).toBeGreaterThan(500);
    for (const bad of ['arc(', 'ellipse(', 'quadraticCurveTo(', 'bezierCurveTo(', 'createLinearGradient(', 'createRadialGradient(', 'shadowBlur=', 'arcTo(']) {
      expect(r.log.some((l) => l.startsWith(bad))).toBe(false);
    }
  });

  it('does not move between notes, and only gets dimmer', () => {
    const r = play([N(0, 0.5, 60, 70)], {}, 0.86);
    const fr = r.frames.slice(36, 51).map((f) => f.filter((l) => /^(moveTo|lineTo)\(/.test(l)));
    expect(fr.length).toBeGreaterThan(10);
    expect(fr[0].length).toBe(2);
    for (const f of fr) expect(f).toEqual(fr[0]);
    const chans = r.frames.slice(2).map((f) => (f.find((l) => l.startsWith('strokeStyle=')) || '').match(/\d+/g)!.map(Number)).filter((c) => c.length === 3);
    for (let i = 1; i < chans.length; i++) for (let k = 0; k < 3; k++) expect(chans[i][k]).toBeLessThanOrEqual(chans[i - 1][k]);
  });

  it('is gone on time: 1.2 s at ring 1, 0.4 s at ring 0.25', () => {
    expect(lastDraw(play([N(0, 0.5, 60, 70)], {}, 3))).toBeLessThan(1.2);
    expect(lastDraw(play([N(0, 0.5, 60, 70)], {}, 3))).toBeGreaterThan(0.3);
    expect(lastDraw(play([N(0, 0.5, 60, 70)], { ring: 0.25 }, 3))).toBeLessThan(0.4);
  });

  it('a repeat keeps the anchors and moves the corner', () => {
    const r = play([N(30 / 60, 1, 60, 80), N(48 / 60, 1.2, 60, 80)], {}, 1);
    const pts = (f: string[]) => f.filter((l) => /^(moveTo|lineTo)\(/.test(l));
    const a = pts(r.frames[29]), b = pts(r.frames[47]);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(b.length).toBeGreaterThanOrEqual(3);
    expect(b[0]).toBe(a[0]);
    expect(b[b.length - 1]).toBe(a[a.length - 1]);
    expect(b.slice(1, -1)).not.toEqual(a.slice(1, -1));
  });

  it('is deterministic and stateless: no Math.random, and a run from the middle draws what the continuous run drew', () => {
    const a = play(MELODY, {}, 5, { randomThrows: true }), b = play(MELODY, {}, 5, { randomThrows: true });
    expect(b.log).toEqual(a.log);
    const tail = play(MELODY, {}, 5, { from: 3 });
    const k = tail.frames.length;
    expect(tail.frames).toEqual(a.frames.slice(a.frames.length - k));
  });

  it('survives a clip of one note and picked notes, with no NaN', () => {
    const one = play([N(0.5, 1, 60, 90)], {}, 2);
    expect(one.frames.some((f) => draws(f) > 0)).toBe(true);
    expect(one.log.some((l) => l.includes('NaN'))).toBe(false);
    const pk = play(MELODY, {}, 3, { picked: true });
    expect(pk.log.some((l) => l.includes('NaN'))).toBe(false);
  });
});
