/// <reference types="node" />
// Every widget in lab/tools runs headless: three seconds of a small fixed song at 60 Hz against a recording canvas, no throw,
// and no non-finite number reaches a canvas call. A new widget is covered by existing; this file needs no edit for it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { labWidgetIds, readLabHarness } from '../scripts/node/catalogue';
import { groupChords } from '../src/widgets/chords';
import { newFeatures, pitch01 } from '../src/widgets/features';
import { instantiate } from '../src/widgets/instantiate';
import type { Note, WidgetCtx } from '../src/widgets/types';
import { readBack, widgetSource } from './helpers/widget';

/** Widgets that cannot run headless, with why. */
const SKIP: Record<string, string> = {};

const NOTES: Note[] = Array.from({ length: 30 }, (_v, i): Note => [i * 0.1, i * 0.1 + 0.3, 48 + ((i * 7) % 36), 60 + ((i * 13) % 60)]);
const CHORDS = groupChords(NOTES);
const harness = readLabHarness();

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
const KEYS = ['document', 'window', 'Path2D', 'DOMMatrix', 'Image', 'ImageData'];
beforeAll(() => { saved = Object.fromEntries(KEYS.map((k) => [k, G[k]])); });
afterAll(() => { for (const k of KEYS) G[k] = saved[k]; });

/** Same numbers every run. */
function seeded(): () => number {
  let s = 12345;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** A context that draws nothing and notes every non-finite number (or a colour string made of one) it is handed. */
function checking(bad: string[]) {
  const off = (v: unknown) => (typeof v === 'number' ? !Number.isFinite(v) : typeof v === 'string' && (v.includes('NaN') || v.includes('Infinity')));
  return (canvas: unknown) => new Proxy({ canvas } as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : (...a: any[]) => { if (bad.length < 5 && a.some(off)) bad.push(`${String(k)}(${a.join(',')})`); return readBack(String(k), a); }),
    set: (o, k, v) => { o[k as string] = v; if (bad.length < 5 && off(v)) bad.push(`${String(k)}=${v}`); return true; },
  });
}

function run(id: string): string[] {
  const bad: string[] = [];
  const rec = checking(bad);
  const canvasEl = (): Record<string, unknown> => { const c: Record<string, unknown> = { width: 0, height: 0, style: {} }; c.getContext = () => (c.g ??= rec(c)); c.toDataURL = () => 'data:,'; c.addEventListener = () => {}; return c; };
  const stub = function () { return new Proxy({}, { get: (_o, k) => (k === 'then' ? undefined : () => {}) }); };
  G.document = { createElement: (tag: string) => (tag === 'canvas' ? canvasEl() : { style: {}, appendChild() {}, addEventListener() {} }), body: { appendChild() {} } };
  G.window = { NOTES, SONG_NOTES: NOTES, addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
  G.Path2D = stub; G.DOMMatrix = stub; G.Image = stub;
  G.ImageData = function (this: { width: number; height: number; data: Uint8ClampedArray }, w: number, h: number) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); };
  const random = Math.random;
  Math.random = seeded();
  try {
    const tool = instantiate(id, widgetSource(id), { icon: harness.makeIcon(), kit: harness.kit, chords: CHORDS });
    const vals = Object.fromEntries((tool.params ?? []).map((q) => [q.key, q.value]));
    const canvas = canvasEl();
    canvas.width = 1280; canvas.height = 720;
    const x = {
      g: rec(canvas), W: 1280, H: 720, canvas, t: 0, dt: 1 / 60, now: 0, moment: 'dread', level: 0, rate: 0, hit: 0, feat: newFeatures(), tool, picked: false,
      rnd: (a = 0, b = 1) => a + Math.random() * (b - a),
      sounding: () => NOTES.filter((n) => n[0] <= x.t && x.t < n[1]).map((n) => ({ m: n[2], v: n[3], start: n[0], end: n[1] })),
      top: () => x.sounding().reduce<ReturnType<typeof x.sounding>[number] | null>((b, n) => (!b || n.m > b.m ? n : b), null),
      pitch01,
      p: (k: string) => vals[k],
    } as unknown as WidgetCtx;
    tool.reset?.(x);
    let ci = 0;
    for (let f = 1; f <= 180; f++) {
      x.t = f / 60; x.now = x.t;
      while (ci < CHORDS.length && CHORDS[ci].t <= x.t) tool.onChord?.(CHORDS[ci++], x);
      tool.frame?.(x);
    }
  } finally { Math.random = random; }
  return bad;
}

describe('every widget runs headless', () => {
  for (const id of labWidgetIds()) {
    if (SKIP[id]) continue;
    it(id, () => {
      expect(run(id), `non-finite arguments in ${id}`).toEqual([]);
    });
  }
});
