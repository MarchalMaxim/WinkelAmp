// Cut (nature widgets, 2026-11-06): slabs erode only on later attacks. Knobs, the lazily baked stages and their corner-first masks, the attack step, stillness between
// notes, stage counts, silence, determinism and seek. Plan: docs/mockups/nature/plans/cut.md.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

const SRC = readFileSync(new URL('../lab/tools/cut.js', import.meta.url), 'utf8');
const PITCH = [48, 55, 60, 60, 64, 67, 72, 60, 52, 57];
const NOTES: Note[] = PITCH.map((m, i) => [0.5 + i * 0.7, 1.1 + i * 0.7, m, 50 + i * 5]);
for (const m of [55, 62, 67]) NOTES.push([7.8, 8.4, m, 80]);
NOTES.sort((a, b) => a[0] - b[0]);
const CHORDS: Chord[] = groupChords(NOTES);
const ATTACKS = CHORDS.map((c) => c.t);

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { document: G.document, window: G.window }; G.window = { NOTES }; });
afterAll(() => { G.document = saved.document; G.window = saved.window; });

const ICON = new Proxy({ ink: '#fff', of: new Proxy({}, { get: () => () => () => {} }) }, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : (() => {})) }) as unknown as IconLib;

function recorder(log: string[]) {
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(3) : v && typeof v === 'object' ? ('__id' in v ? `c${(v as { __id: number }).__id}` : 'obj') : String(v));
  return () => new Proxy({} as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return undefined; }),
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

interface Run { log: string[]; marks: Map<number, number>; sprites: { w: number; h: number; data: Uint8ClampedArray; id: number }[]; tool: ToolDef }
function play(knobs: Record<string, number> = {}, secs = 12, { throwRandom = false, only = -1, mark = [] as number[], chords = CHORDS } = {}): Run {
  const log: string[] = [], sprites: Run['sprites'] = [], rec = recorder(log), marks = new Map<number, number>();
  G.document = {
    createElement: () => {
      const c: Record<string, unknown> = { width: 0, height: 0 };
      c.getContext = () => ({
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img: { width: number; height: number; data: Uint8ClampedArray }) => { c.__id = sprites.length; sprites.push({ w: img.width, h: img.height, data: img.data, id: sprites.length }); },
      });
      return c;
    },
  };
  const tool = instantiate('cut', SRC, { icon: ICON, chords });
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  let sd = 7;
  const rnd = (a = 0, b = 1) => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return a + (b - a) * (((t ^ (t >>> 14)) >>> 0) / 4294967296); };
  const g = rec();
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, rnd, p: (k: string) => vals[k], picked: false } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (throwRandom) Math.random = () => { throw new Error('Math.random'); };
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    const times = only >= 0 ? [only] : Array.from({ length: secs * 60 }, (_, f) => (f + 1) / 60);
    for (const t of times) {
      x.t = t;
      while (ci < chords.length && chords[ci].t <= x.t) tool.onChord!(chords[ci++], x);
      const before = log.length;
      tool.frame!(x);
      if (only >= 0 || mark.some((m) => Math.abs(m - t) < 1e-9)) marks.set(t, before);
    }
  } finally { Math.random = random; }
  return { log, marks, sprites, tool };
}
// frames are 1/60 apart, so the frame of an attack is the first frame time at or after it
const frameOf = (t: number) => Math.ceil(t * 60 - 1e-9) / 60;
// marks only the frames asked for, so a frame's log would run on to the next mark: mark the following frame too
const withNext = (ts: number[]) => ts.flatMap((t) => [t, t + 1 / 60]);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const stepOf = (r: Run, t: number) => {
  const key = [...r.marks.keys()].find((k) => near(k, t))!;
  const a = r.marks.get(key)!;
  const nk = [...r.marks.keys()].find((k) => near(k, key + 1 / 60));
  return r.log.slice(a, nk === undefined ? r.log.length : r.marks.get(nk));
};

describe('cut', () => {
  it('has the entry and the knobs the plan says', () => {
    const tool = play({}, 0).tool;
    expect(tool).toMatchObject({ id: 'cut', name: 'Cut', tag: 'new' });
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['steps', 'size', 'grain', 'goneBy', 'wet', 'presence']);
    expect(ps.length - 1).toBe(5);
    const pr = ps.find((p) => p.key === 'presence')!;
    expect(pr).toMatchObject({ min: 0, max: 1, value: 1, label: 'how present', leads: true });
    expect('less' in pr).toBe(false);
    for (const k of ['steps', 'size', 'goneBy']) {
      const p = ps.find((q) => q.key === k)! as (typeof ps)[number] & { less: number };
      expect(p.less).toBeGreaterThanOrEqual(p.min); expect(p.less).toBeLessThanOrEqual(p.max); expect(p.less).not.toBe(p.value);
    }
  });

  // The stage of a baked sprite, read from its colour: at the default wet the lit R of level 0 is round(150 * F[s]).
  type Sp = Run['sprites'][number];
  const R0 = [150, 141, 131, 122, 113, 103, 94, 84, 75];
  const stageOf = (sp: Sp) => { let m = 0; for (let p = 0; p < sp.data.length; p += 4) m = Math.max(m, sp.data[p]); return R0.indexOf(m); };
  const lit = (sp: Sp) => { let c = 0; for (let p = 0; p < sp.data.length; p += 4) if (sp.data[p] > 0) c++; return c; };
  const at = (sp: Sp, x: number, y: number) => sp.data[(y * sp.w + x) * 4] > 0;
  // level 0 sprites by size: "w x h" -> stage -> sprite
  const byShape = (r: Run) => {
    const m = new Map<string, Map<number, Sp>>();
    for (const sp of r.sprites) { const s = stageOf(sp); if (s < 1) continue; const k = sp.w + 'x' + sp.h; if (!m.has(k)) m.set(k, new Map()); m.get(k)!.set(s, sp); }
    return m;
  };

  it('bakes sprites lazily, opaque, with fewer lit pixels at every stage', () => {
    expect(play({}, 1).sprites.length).toBe(0);   // one slab at stage 0 needs no sprite
    const r = play({}, 12);
    expect(r.sprites.length).toBeGreaterThan(8);
    expect(r.sprites.length).toBeLessThan(96 * 3);
    for (const s of r.sprites) for (let p = 3; p < s.data.length; p += 4) { if (s.data[p] !== 255) throw new Error('alpha'); }
    let full = 0;
    for (const m of byShape(r).values()) {
      if (![1, 2, 3, 4, 5, 6, 7, 8].every((s) => m.has(s))) continue;
      full++;
      for (let s = 2; s <= 8; s++) expect(lit(m.get(s)!)).toBeLessThan(lit(m.get(s - 1)!));
      expect(lit(m.get(8)!)).toBeGreaterThan(0);
    }
    expect(full).toBeGreaterThan(0);
  });

  it('sprites come in 96, 192 and 384 px long sides', () => {
    for (const sp of play({}, 12).sprites) expect([96, 192, 384]).toContain(Math.max(sp.w, sp.h));
  });

  it('erodes corners first: stage 2 only removes cells near corners, face middles stand through stage 4', () => {
    const r = play({}, 12);
    let checked = 0;
    for (const m of byShape(r).values()) {
      if (![2, 4].every((s) => m.has(s))) continue;
      checked++;
      const s2 = m.get(2)!, mh = Math.min(s2.w, s2.h) / 2;
      for (let y = 0; y < s2.h; y++) for (let x = 0; x < s2.w; x++) {
        if (at(s2, x, y)) continue;
        const d = Math.min(...[[0, 0], [s2.w, 0], [0, s2.h], [s2.w, s2.h]].map(([X, Y]) => Math.hypot(x + 0.5 - X, y + 0.5 - Y))) / mh;
        expect(d).toBeLessThan(0.8);
      }
      for (const s of [2, 4]) {
        const sp = m.get(s)!;
        const band = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (at(sp, x, y)) return true; return false; };
        const cw = Math.round(sp.w / 10), ch = Math.round(sp.h / 10);   // the middle fifth of each face, in its outermost 6 px
        expect(band((sp.w >> 1) - cw, 0, (sp.w >> 1) + cw, 5)).toBe(true); expect(band((sp.w >> 1) - cw, sp.h - 6, (sp.w >> 1) + cw, sp.h - 1)).toBe(true);
        expect(band(0, (sp.h >> 1) - ch, 5, (sp.h >> 1) + ch)).toBe(true); expect(band(sp.w - 6, (sp.h >> 1) - ch, sp.w - 1, (sp.h >> 1) + ch)).toBe(true);
      }
      const s4 = m.get(4)!;
      expect(at(s4, 0, 0) || at(s4, s4.w - 1, s4.h - 1)).toBe(false);   // the corner tips are long gone by stage 4
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('draws with lighten and a fillRect on the attack step of each note', () => {
    const r = play({}, 12, { mark: withNext(ATTACKS.map(frameOf)) });
    for (const t of ATTACKS) {
      const s = stepOf(r, frameOf(t));
      expect(s.some((l) => l === 'globalCompositeOperation=lighten')).toBe(true);
      expect(s.some((l) => l.startsWith('fillRect'))).toBe(true);
    }
  });

  it('does not move between notes: 0.40 s and 0.55 s after an attack are identical', () => {
    const ts: number[] = [];
    for (const t of ATTACKS.slice(0, 10)) ts.push(frameOf(t + 0.4), frameOf(t + 0.55));
    const r = play({}, 12, { mark: withNext(ts) });
    for (const t of ATTACKS.slice(0, 10)) {
      const a = stepOf(r, frameOf(t + 0.4)), b = stepOf(r, frameOf(t + 0.55));
      expect(a.length).toBeGreaterThan(0);
      expect(b).toEqual(a);
    }
  });

  it('shows min(n, 8) sprites on attack n, at stages n..1 from the oldest, and at most 2 with steps 2', () => {
    const ts = withNext(ATTACKS.map(frameOf));
    const r = play({}, 12, { mark: ts }), r2 = play({ steps: 2 }, 12, { mark: ts });
    ATTACKS.forEach((t, n) => {
      if (n < 1) return;
      const ids = stepOf(r, frameOf(t)).filter((l) => l.startsWith('drawImage')).map((l) => Number(/drawImage\(c(\d+),/.exec(l)![1]));
      expect(ids.length).toBe(Math.min(n, 8));
      if (n < 10) expect(ids.map((id) => stageOf(r.sprites[id]))).toEqual(Array.from({ length: Math.min(n, 8) }, (_, q) => Math.min(n, 8) - q));
      expect(stepOf(r2, frameOf(t)).filter((l) => l.startsWith('drawImage')).length).toBeLessThanOrEqual(2);
    });
  });

  const firstRect = (lines: string[]) => (/fillRect\(([-\d.]+),([-\d.]+),([-\d.]+),/.exec(lines.find((l) => l.startsWith('fillRect'))!)!).slice(1).map(Number);

  it('a repeated pitch stands beside its twin, not on it', () => {
    const r = play({}, 12, { mark: withNext([frameOf(ATTACKS[2]), frameOf(ATTACKS[3])]) });
    const [x2, , w2] = firstRect(stepOf(r, frameOf(ATTACKS[2]))), [x3, , w3] = firstRect(stepOf(r, frameOf(ATTACKS[3])));
    expect(Math.abs(x3 - x2)).toBeGreaterThan(0.25 * Math.min(w2, w3));
  });

  it('normalises velocity to the clip: softest note 60 px wide, loudest 220, a lone note 156', () => {
    const r = play({}, 12, { mark: withNext([frameOf(ATTACKS[0]), frameOf(ATTACKS[9])]) });
    expect(firstRect(stepOf(r, frameOf(ATTACKS[0])))[2]).toBe(60);
    expect(firstRect(stepOf(r, frameOf(ATTACKS[9])))[2]).toBe(220);
    const one = groupChords([[0.5, 1.1, 60, 80]] as Note[]);
    expect(firstRect(play({}, 1, { only: frameOf(0.6), chords: one }).log)[2]).toBe(156);
  });

  it('dims in two quiet steps in silence: levels 1 and 2 use their own tones', () => {
    const last = ATTACKS[ATTACKS.length - 1];
    const r1 = play({}, 12, { only: frameOf(last + 3 + 0.1) }), r2 = play({}, 12, { only: frameOf(last + 3 + 0.35) });
    expect(r1.log).toContain('fillStyle=rgb(83,57,28)');
    expect(r2.log).toContain('fillStyle=rgb(45,31,15)');
    expect(r1.log).not.toContain('fillStyle=rgb(150,104,50)');
  });

  it('an empty CHORDS draws nothing and does not throw', () => {
    const r = play({}, 3, { chords: [] });
    expect(r.log.some((l) => l.startsWith('fillRect') || l.startsWith('drawImage'))).toBe(false);
  });

  it('draws nothing at the last attack + goneBy + 0.6 s', () => {
    const last = ATTACKS[ATTACKS.length - 1];
    const r = play({}, 12, { only: frameOf(last + 3 + 0.6) });
    expect(r.log.some((l) => l.startsWith('fillRect') || l.startsWith('drawImage'))).toBe(false);
  });

  it('is deterministic with Math.random throwing', () => {
    const a = play({}, 12, { throwRandom: true }), b = play({}, 12, { throwRandom: true });
    expect(a.log.length).toBeGreaterThan(1000);
    expect(b.log).toEqual(a.log);
  });

  it('a seek to 5.2 s draws what a full play drew there', () => {
    const t = frameOf(5.2);
    const full = play({}, 12, { mark: withNext([t]) });
    const fa = stepOf(full, t);
    const seek = play({}, 12, { only: t });
    expect(fa.length).toBeGreaterThan(0);
    const named = (r: Run, ls: string[]) => ls.map((l) => l.replace(/drawImage\(c(\d+),/, (_, id) => `drawImage(stage${stageOf(r.sprites[Number(id)])},`));
    expect(named(seek, seek.log)).toEqual(named(full, fa));
  });
});
