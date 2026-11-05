// A real WidgetRuntime and Conductor on stub canvases: the attacks a widget answers are exactly groupChords(picks).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { Conductor, samePreview, showInstances } from '../src/studio/show/conductor';
import { applyEdit } from '../src/studio/show/edit';
import type { Clip, Show } from '../src/studio/show/show';
import { groupChords } from '../src/widgets/chords';
import { WidgetRuntime } from '../src/widgets/runtime';
import type { LabHarness, Note, WidgetMeta } from '../src/widgets/types';

const WA = loadLayers();

/** A 2D context that takes every call. */
const fakeG = (canvas: unknown): CanvasRenderingContext2D => new Proxy({ canvas } as Record<string, unknown>, {
  get: (o, k) => (k in o ? o[k as string] : () => {}),
  set: (o, k, v) => { o[k as string] = v; return true; },
}) as unknown as CanvasRenderingContext2D;
function fakeCanvas(w = 1280, h = 720): HTMLCanvasElement {
  const c = { width: w, height: h } as unknown as HTMLCanvasElement & { g?: CanvasRenderingContext2D };
  c.getContext = (() => (c.g ??= fakeG(c))) as never;
  return c;
}

/** What the probes saw, in the global the widget source reads. */
interface Log { heard: Record<string, [number, number, number][]>; resets: Record<string, number>; loaded: Record<string, [number, number]>;
  frames: Record<string, { t: number; level: number; size: number | undefined }[]>; late: Record<string, { t: number; sounding: number; level: number }[]> }
const log = (): Log => (globalThis as unknown as { __probe: Log }).__probe;

const probe = (id: string) => `TOOLS.push({ id: '${id}', name: '${id}', params: [{ key: 'size', min: 0, max: 9, value: 1 }],
  init: (() => { window.__probe.loaded['${id}'] = [window.NOTES.length, CHORDS.length]; })(),
  reset() { window.__probe.resets['${id}'] = (window.__probe.resets['${id}'] || 0) + 1; },
  onChord(ch) { (window.__probe.heard['${id}'] ??= []).push([ch.t, ch.vel, ch.notes.length]); },
  frame(x) { (window.__probe.frames['${id}'] ??= []).push({ t: x.t, level: x.level, size: x.p('size') }); },
});`;
/** A widget with a pass "after the others", and one that queues again from it (stella's two hops): what they read. */
const LATE = `TOOLS.push({ id: 'late', name: 'late',
  frame(x) {
    const seen = (hop) => (window.__probe.late[hop] ??= []).push({ t: x.t, sounding: x.sounding().length, level: x.level });
    queueMicrotask(() => { seen('one'); queueMicrotask(() => seen('two')); });
  },
});`;
/** Fails to load on a set of 5 notes. */
const FUSSY = `if (window.NOTES.length === 5) throw new Error('not on five');
${probe('fussy')}`;
/** What x.picked says while it runs. */
const ASKS = `TOOLS.push({ id: 'asks', name: 'asks', onChord(ch, x) { (window.__asked ??= []).push(x.picked); }, frame() {} });`;
const SOURCES = { pick: probe('pick'), plain: probe('plain'), other: probe('other'), late: LATE, fussy: FUSSY, asks: ASKS };
const HARNESS: LabHarness = { toolIds: Object.keys(SOURCES), verdicts: {}, drives: [], iconSource: '{ ink: "#000", gauge() {} }' };
const META: WidgetMeta = { id: 'x', name: 'x', blurb: '', tag: '', verdict: null, params: [{ key: 'size', min: 0, max: 9, value: 1 }] };

/** 100 attacks, one every 0.3 s from 0.1 s. */
const SONG: Note[] = Array.from({ length: 100 }, (_, i) => [Math.round((0.1 + i * 0.3) * 1e4) / 1e4, 0.3 + i * 0.3, 60 + (i % 12), 70]);
/** 5 notes making 4 attacks, two of them 30 ms apart. Not all of them are in SONG: a pick is the note itself. */
const PICKS: Note[] = [[1.234, 1.5, 72, 60], [4.1, 4.4, 74, 110], [4.13, 4.5, 77, 40], [6.05, 6.5, 70, 30], [8.2, 8.6, 79, 90]];
const asHeard = (notes: Note[]) => groupChords(notes).map((c) => [c.t, c.vel, c.notes.length]);

const pickClip: Clip = { id: 'p', start: 0, end: 30, track: 0, fade: 0, widget: 'pick', listen: 'picks:p1' };
const show = (notes: Note[] = PICKS): Show => ({
  version: 3, id: 'demo', song: 'demo',
  clips: [pickClip, { id: 'q', start: 0, end: 30, track: 1, fade: 0, widget: 'plain' }],
  picks: { p1: { notes } },
});
const KEY = 'pick@picks:p1#p';
const song = (...clips: Clip[]): Show => ({ version: 3, id: 'demo', song: 'demo', clips });

const start = (s: Show = show()) => {
  const rt = new WidgetRuntime(fakeCanvas(), { notes: SONG }, { sources: SOURCES, harness: HARNESS, layers: WA });
  const c = new Conductor(rt, s, () => META);
  rt.deliveredLog = [];
  return { rt, c };
};
/** Steps at 1/60 s from `from` to `to`. */
function play(c: Conductor, from: number, to: number): void {
  const n = Math.round((to - from) * 60);
  for (let i = 1; i <= n; i++) c.step(from + i / 60, 1 / 60);
}

beforeAll(() => {
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  vi.stubGlobal('NOTES', SONG);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { vi.stubGlobal('__probe', { heard: {}, resets: {}, loaded: {}, frames: {}, late: {} } satisfies Log); });

describe('a widget on a set of picks', () => {
  it('answers exactly the picked attacks and none between; a plain one in the same show hears all', () => {
    const { rt, c } = start();
    c.reset(0);
    play(c, 0, 31);
    expect(log().heard.pick).toEqual(asHeard(PICKS));
    expect(rt.deliveredLog!.filter(([k]) => k === KEY).map(([, t]) => t)).toEqual(groupChords(PICKS).map((x) => x.t));
    expect(log().heard.plain).toHaveLength(100);
    expect(rt.errors).toEqual({});
  });

  it('a pick\'s loudness sets the strength: the level at its frame is at least vel / 115', () => {
    const { c } = start();
    c.reset(0);
    play(c, 0, 10);
    const f = log().frames.pick, at = (t: number) => f.find((x) => x.t >= t)!.level;
    for (const ch of groupChords(PICKS)) expect(at(ch.t)).toBeGreaterThanOrEqual(ch.vel / 115 - 1e-9);
    // After 2 s of decay (0.5^(2/0.8) = 0.18), a loud pick lifts it high and a soft one hardly at all.
    expect(at(8.2)).toBeGreaterThan(at(6.05));
    expect(at(6.05)).toBeLessThan(0.4);
  });

  it('at load the routed copy sees the picks, not the song', () => {
    start();
    expect(log().loaded.pick).toEqual([5, 4]);
    expect(log().loaded.plain).toEqual([100, 100]);
  });

  it('entering: a pick in the first step of its clip is heard, and it is reset as it starts', () => {
    const s: Show = { ...show([[5, 5.5, 72, 80], [8, 8.5, 72, 80]]), clips: [
      { id: 'q', start: 0, end: 30, track: 0, widget: 'plain' }, { ...pickClip, start: 5, track: 1 },
    ] };
    const { c } = start(s);
    c.reset(0);
    const before = log().resets.pick;
    play(c, 0, 10);
    expect(log().heard.pick).toEqual(asHeard(s.picks!.p1.notes as Note[]));
    expect(log().resets.pick).toBe(before + 1);
  });

  it('a placement holds the last pick, whatever a step does', () => {
    const notes: Note[] = [[1, 1.5, 72, 80], [4.995, 5.2, 72, 90]];
    const { c } = start(applyEdit(song({ id: 'q', start: 0, end: 30, track: 0, widget: 'plain' }), { kind: 'placePicks', widget: 'pick', notes }));
    c.reset(0);
    play(c, 0, 8);
    expect(log().heard.pick).toEqual(asHeard(notes));
  });

  it('a pick after the clip\'s end is not heard', () => {
    const s: Show = { ...show([[1, 1.5, 72, 80], [5.5, 6, 72, 80]]), clips: [{ ...pickClip, end: 5 }, { id: 'q', start: 5, end: 30, track: 0, widget: 'plain' }] };
    const { c } = start(s);
    c.reset(0);
    play(c, 0, 10);
    expect(log().heard.pick).toEqual([[1, 80, 1]]);
  });

  it('two clips on one set: independent instances, each hearing its own stretch of it', () => {
    const s: Show = { ...show(), clips: [{ ...pickClip, end: 5 }, { ...pickClip, id: 'p2', start: 5, end: 30 }] };
    const { rt, c } = start(s);
    c.reset(0);
    play(c, 0, 10);
    expect(rt.loaded().filter((k) => k.startsWith('pick@'))).toHaveLength(2);
    expect(rt.deliveredLog!.filter(([k]) => k === KEY).map(([, t]) => t)).toEqual([1.234, 4.1]);
    expect(rt.deliveredLog!.filter(([k]) => k === 'pick@picks:p1#p2').map(([, t]) => t)).toEqual([6.05, 8.2]);
  });

  it('a seek: only attacks after it; a seek exactly onto a pick does not fire it, a seek back before it does', () => {
    const { c } = start();
    c.reset(5);
    play(c, 5, 10);
    expect(log().heard.pick).toEqual(asHeard(PICKS).slice(2));
    log().heard.pick = [];
    c.reset(8.2);
    play(c, 8.2, 10);
    expect(log().heard.pick ?? []).toEqual([]);
    c.reset(8.1);
    play(c, 8.1, 10);
    expect(log().heard.pick).toEqual(asHeard(PICKS).slice(3));
  });

  it('an update reaches the running widget: only the new picks from there, its notes the new ones, a knob kept, no error', () => {
    const a = show(), { rt, c } = start(a);
    rt.setKnobs(KEY, { size: { base: 7, drive: '', depth: 0.5 } });
    c.reset(0);
    play(c, 0, 2);
    expect(log().heard.pick).toEqual(asHeard(PICKS).slice(0, 1));

    const NEW: Note[] = [[3, 3.5, 60, 50], [5, 5.5, 62, 55], [9, 9.5, 64, 60]];
    const b = applyEdit(a, { kind: 'updatePicks', id: 'p1', widget: 'pick', notes: NEW });
    log().heard.pick = [];
    const resets = log().resets.pick ?? 0;
    c.setShow(b);
    expect(log().loaded.pick).toEqual([3, 3]);
    expect(log().resets.pick).toBe(resets + 1);
    expect(rt.loaded().filter((k) => k === KEY)).toHaveLength(1);
    play(c, 2, 10);
    expect(log().heard.pick).toEqual(asHeard(NEW));
    expect(log().frames.pick.at(-1)!.size).toBe(7);
    expect(rt.errors).toEqual({});

    // Undo: only the old picks again.
    log().heard.pick = [];
    c.setShow(a);
    expect(log().loaded.pick).toEqual([5, 4]);
    play(c, 10, 11);
    expect(log().heard.pick ?? []).toEqual([]);
    c.reset(0);
    play(c, 0, 10);
    expect(log().heard.pick).toEqual(asHeard(PICKS));
    expect(rt.errors).toEqual({});
  });

  it('an update picks up after the time it comes at: nothing already played fires again', () => {
    const a = show(), { c } = start(a);
    c.reset(0);
    play(c, 0, 5);
    log().heard.pick = [];
    c.setShow(applyEdit(a, { kind: 'updatePicks', id: 'p1', widget: 'pick', notes: [[1, 1.5, 60, 50], [7, 7.5, 62, 55]] }));
    play(c, 5, 10);
    expect(log().heard.pick).toEqual([[7, 55, 1]]);
  });

  it('a show set again with the same picks does not reload', () => {
    const a = show(), { c } = start(a);
    c.reset(0);
    const resets = log().resets.pick;
    log().loaded.pick = [0, 0];
    c.setShow({ ...a, picks: { p1: { notes: JSON.parse(JSON.stringify(PICKS)) as Note[] } } });
    expect(log().loaded.pick).toEqual([0, 0]);
    expect(log().resets.pick).toBe(resets);
  });

  it('samePreview sees a change of picks, and only that', () => {
    const a = show();
    const b = applyEdit(a, { kind: 'updatePicks', id: 'p1', widget: 'pick', notes: [[3, 3.5, 60, 50]] });
    expect(samePreview(a, b, 5)).toBe(false);
    expect(samePreview(a, { ...a }, 5)).toBe(true);
    expect(samePreview(a, { ...a, picks: { p1: { notes: JSON.parse(JSON.stringify(PICKS)) as Note[] } } }, 5)).toBe(true);
  });

  it('an unknown set hears nothing: never all the notes', () => {
    const s = song({ ...pickClip, listen: 'picks:p9' });
    const { rt, c } = start(s);
    c.reset(0);
    play(c, 0, 31);
    expect(log().heard.pick ?? []).toEqual([]);
    expect(log().loaded.pick).toEqual([0, 0]);
    expect(rt.instance('pick@picks:p9#p')!.routed).toBe(true);
    expect(rt.errors).toEqual({});
  });

  it('an empty set hears nothing too', () => {
    const { c } = start(show([]));
    c.reset(0);
    play(c, 0, 31);
    expect(log().heard.pick ?? []).toEqual([]);
  });

  it('a malformed picks listen hears nothing', () => {
    const s = song({ ...pickClip, listen: 'picks:' });
    const { c } = start(s);
    c.reset(0);
    play(c, 0, 31);
    expect(log().heard.pick ?? []).toEqual([]);
  });

  it('showInstances of a show without picks has no notes key on any spec; with picks only that spec has', () => {
    const plain = song({ id: 'q', start: 0, end: 30, track: 0, widget: 'plain' }, { id: 'o', start: 0, end: 30, track: 1, widget: 'other', listen: 'melody' });
    for (const s of showInstances(plain)) expect('notes' in s).toBe(false);
    const specs = showInstances(show());
    expect(specs.find((s) => s.key === KEY)!.notes).toBe(PICKS);
    expect('notes' in specs.find((s) => s.key === 'plain#q')!).toBe(false);
  });

  describe('a queued pass', () => {
    /** Plays with queueMicrotask routed to rt.post, as the render page does. */
    const playLate = (layer: Pick<Clip, 'widget' | 'listen'>) => {
      const { rt, c } = start({ ...show(), clips: [{ id: 'l', start: 0, end: 30, track: 0, fade: 0, listen: undefined, ...layer }] });
      const real = globalThis.queueMicrotask;
      vi.stubGlobal('queueMicrotask', (f: () => void) => { rt.post.push(f); });
      try { c.reset(0); play(c, 0, 5); }
      finally { vi.stubGlobal('queueMicrotask', real); }
      expect(rt.errors).toEqual({});
      return rt;
    };
    const during = (hop: string, a: number, b: number) => log().late[hop].filter((x) => x.t >= a && x.t < b);

    it('on a set of picks reads its notes, also when it queues again: no note sounds between picks, whatever the song plays', () => {
      const rt = playLate({ widget: 'late', listen: 'picks:p1' });
      for (const hop of ['one', 'two']) {
        expect(during(hop, 2, 4).length).toBeGreaterThan(100);
        expect(during(hop, 2, 4).every((x) => x.sounding === 0)).toBe(true);
        expect(during(hop, 1.3, 1.45).every((x) => x.sounding === 1)).toBe(true);
        expect(during(hop, 1.3, 1.45).every((x) => x.level > 0)).toBe(true);
      }
      expect(rt.ctx.sounding().length).toBe(1);   // the song's notes back: at 5 s it has one, the picks none
    });

    it('queueMicrotask is back as it was after each call', () => {
      const real = globalThis.queueMicrotask, { c } = start({ ...show(), clips: [{ id: 'l', start: 0, end: 30, track: 0, widget: 'late', listen: 'picks:p1' }] });
      c.reset(0);
      c.step(1 / 60, 1 / 60);
      expect(globalThis.queueMicrotask).toBe(real);
    });

    it('on the song, as today: it reads the song', () => {
      playLate({ widget: 'late' });
      expect(during('one', 2, 4).some((x) => x.sounding > 0)).toBe(true);
    });
  });

  it('a widget that failed to load on a set tries again on another, not on the same; its knobs kept', () => {
    const s = (notes: Note[]): Show => ({ ...show(notes), clips: [{ id: 'f', start: 0, end: 30, track: 0, widget: 'fussy', listen: 'picks:p1' }] });
    const K = 'fussy@picks:p1#f', a = s(PICKS), { rt, c } = start(a);
    expect(rt.errors[K]).toContain('not on five');
    rt.setKnobs(K, { size: { base: 7, drive: '', depth: 0.5 } });
    rt.load(showInstances(a));
    expect(rt.tool(K)).toBeUndefined();
    expect(rt.errors[K]).toContain('not on five');

    const NEW: Note[] = [[3, 3.5, 60, 50], [5, 5.5, 62, 55]];
    c.setShow(applyEdit(a, { kind: 'updatePicks', id: 'p1', widget: 'fussy', notes: NEW }));
    expect(rt.errors[K]).toBeUndefined();
    expect(log().loaded.fussy).toEqual([2, 2]);
    expect(log().resets.fussy).toBeGreaterThan(0);
    c.reset(0);
    play(c, 0, 6);
    expect(log().heard.fussy).toEqual(asHeard(NEW));
    expect(log().frames.fussy.at(-1)!.size).toBe(7);
  });

  it('a set shared by two widgets: each hears it', () => {
    const s: Show = { ...show(), clips: [pickClip, { ...pickClip, id: 'o', track: 1, widget: 'other' }] };
    const { c } = start(s);
    c.reset(0);
    play(c, 0, 10);
    expect(log().heard.pick).toEqual(asHeard(PICKS));
    expect(log().heard.other).toEqual(asHeard(PICKS));
  });
});

describe('Dread squares and the notes it is given', () => {
  const SQUARES = readFileSync('lab/tools/squares.js', 'utf8');
  const META_SQ: WidgetMeta = { id: 'squares', name: 'squares', blurb: '', tag: '', verdict: null, params: [] };
  /** The sizes it draws, by song time: its squares are the only rectangles centred on the origin. */
  function sizes(clip: Partial<Clip>, song: Note[], picks?: Note[]): number[] {
    const canvas = fakeCanvas(), seen: number[] = [];
    (canvas.getContext('2d') as unknown as { fillRect: unknown }).fillRect = (x: number, _y: number, w: number) => { if (x < 0) seen.push(w); };
    const rt = new WidgetRuntime(canvas, { notes: song }, { sources: { squares: SQUARES }, harness: { ...HARNESS, toolIds: ['squares'] }, layers: WA });
    const s: Show = { version: 3, id: 'demo', song: 'demo', clips: [{ id: 'p', start: 0, end: 5, track: 0, fade: 0, widget: 'squares', ...clip }], ...(picks ? { picks: { p1: { notes: picks } } } : {}) };
    const c = new Conductor(rt, s, () => META_SQ);
    c.reset(0);
    play(c, 0, 0.2);
    expect(rt.errors).toEqual({});
    return seen;
  }
  const high: Note[] = [[0.1, 0.5, 77, 100]], low: Note[] = [[0.1, 0.5, 40, 100]];

  it('draws a picked note however high it is, at a real size', () => {
    const drawn = sizes({ listen: 'picks:p1' }, high, high);
    expect(drawn.length).toBeGreaterThan(0);
    expect(Math.min(...drawn)).toBeGreaterThan(50);
  });
  it('still skips a high note it was not given by hand', () => {
    expect(sizes({}, high)).toEqual([]);
    expect(sizes({ listen: 'melody' }, high)).toEqual([]);
  });
  it('draws a low note as it did, picked or not', () => {
    expect(Math.max(...sizes({ listen: 'picks:p1' }, low, low))).toBeCloseTo(Math.max(...sizes({}, low)));
  });
});

describe('x.picked', () => {
  const asked = () => (globalThis as unknown as { __asked?: boolean[] }).__asked;
  const heardWith = (clip: Partial<Clip>, s: Partial<Show> = {}) => {
    delete (globalThis as unknown as { __asked?: boolean[] }).__asked;
    const { c } = start({ ...song({ id: 'a', start: 0, end: 30, track: 0, fade: 0, widget: 'asks', ...clip }), ...s });
    c.reset(0); play(c, 0, 5);
    return asked();
  };
  it('is true for a widget on a set of picks, and false for one on all notes, a track or a line', () => {
    expect(heardWith({ listen: 'picks:p1' }, { picks: { p1: { notes: PICKS } } })).toEqual([true, true]);
    expect(heardWith({})!.every((a) => a === false)).toBe(true);
    expect(heardWith({ listen: 'melody' })!.every((a) => a === false)).toBe(true);
  });
});
