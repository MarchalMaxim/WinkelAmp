/// <reference types="node" />
// The lab cards' layer controls: lab/layer-ui.js's pure parts offer the same parts, places and
// curves as the studio's layer panel (src/studio/ui/layer-controls.ts) and filter as its widget picker does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { defaultRegion, listenLabel, listenOptions, READERS } from '../src/studio/ui/layer-controls';
import { filterWidgets } from '../src/studio/ui/widget-picker';
import { TRACKS, TRACK_IDS } from '../src/studio/pack/instruments';
import { FAMILIES, LINES } from '../src/studio/show/show';
import { NOTE_TYPES } from '../src/widgets/tags';
import type { SongPack } from '../src/studio/pack/pack';
import type { TagWords } from '../src/widgets/tags';
import type { Note, Pivot, Region, WidgetMeta, WidgetTags } from '../src/widgets/types';

interface Opt { group: string; value: string; label: string }
interface Song { id?: string; notes: Note[]; tracks?: unknown; beats?: number[]; loudness?: { hop: number; values: number[] };
  energy?: { hop: number; momentary: number[]; shortTerm: number[] }; moments: (number | string)[][]; dur: number }
interface Filter { feel: string[]; inst: string[] }
interface LabLayerUi {
  listenOptions(tracks: unknown): Opt[]; listenLabel(l: string | undefined): string;
  defaultRegion(widget: string, mode?: string): Region; gateDefault(loud: unknown, span: { start: number; end: number }, lag?: number): number;
  momentSpans(m: Song['moments'], dur: number): { start: number; end: number; label: string }[];
  presetPivots(L: unknown, kind: string, amount: number, span: { start: number; end: number }, song: Song, listen?: string): Pivot[];
  tidyEntry(e: unknown): unknown; parseFilter(s: string): Filter; filterSearch(s: string, f: Filter): string;
  matches(tags: WidgetTags | null | undefined, f: Filter): boolean; filterRows(w: TagWords): { kind: string; label: string; words: string[] }[];
  TRACKS: Record<string, [string, string]>; FAMILIES: string[]; LINES: string[]; NOTE_TYPES: string[]; READERS: string[];
}

const src = readFileSync(new URL('../lab/layer-ui.js', import.meta.url), 'utf8');
const win: { WA_LAYER_UI?: LabLayerUi } = {};
new Function('window', src)(win);
const U = win.WA_LAYER_UI!;
const L = loadLayers();

const read = (f: string) => JSON.parse(readFileSync(new URL(`../lab/${f}`, import.meta.url), 'utf8'));
const words = read('tag-words.json') as TagWords;
const tags = read('tags.json') as Record<string, WidgetTags>;

let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const notesOf = (n: number, at = 0): Note[] => Array.from({ length: n }, (_, i) => [at + i * 0.7, at + i * 0.7 + 0.5, 40 + ((i * 7) % 50), 50 + (i % 60)] as Note);
const track = (id: string, n: number) => ({ label: TRACKS[id as keyof typeof TRACKS].label, family: TRACKS[id as keyof typeof TRACKS].family, notes: notesOf(n, 3) });

describe('the words', () => {
  it('the tracks, families, lines and readers are the studio\'s', () => {
    expect(Object.keys(U.TRACKS)).toEqual(TRACK_IDS);
    for (const id of TRACK_IDS) expect(U.TRACKS[id]).toEqual([TRACKS[id].family, TRACKS[id].label]);
    expect(U.FAMILIES).toEqual(FAMILIES);
    expect(U.LINES).toEqual(LINES);
    expect(U.NOTE_TYPES).toEqual(NOTE_TYPES);
    expect(U.READERS).toEqual(READERS);
  });
  it('a part is named as the studio names it', () => {
    for (const l of ['all', ...TRACK_IDS, ...FAMILIES.map((f) => `family:${f}`), ...LINES, ...NOTE_TYPES]) expect(U.listenLabel(l)).toBe(listenLabel(l));
    expect(U.listenLabel(undefined)).toBe('All notes');
  });
});

describe('listenOptions', () => {
  it('offers what the studio offers, for any set of tracks', () => {
    for (let k = 0; k < 40; k++) {
      const tracks: Record<string, unknown> = {};
      for (const id of [...TRACK_IDS].reverse()) if (rnd() < 0.35) tracks[id] = track(id, Math.floor(rnd() * 3) * 20);   // some with no notes
      expect(U.listenOptions(tracks)).toEqual(listenOptions({ tracks } as unknown as Pick<SongPack, 'tracks'>));
    }
  });
  it('a song with no pack: all notes, the six lines and the note types', () => {
    expect(U.listenOptions(undefined).map((o) => o.value)).toEqual(['all', ...LINES, ...NOTE_TYPES]);
  });
});

describe('the place', () => {
  it('a new region is the studio\'s, in the mode chosen', () => {
    for (const w of [...READERS, 'strings', 'rorschach']) {
      expect(U.defaultRegion(w)).toEqual(defaultRegion(w));
      expect(U.defaultRegion(w, 'window')).toEqual({ ...defaultRegion(w), mode: 'window' });
    }
  });
});

describe('intensity presets', () => {
  const dur = 120;
  const beats = Array.from({ length: 200 }, (_, i) => 0.25 + i * 0.6);
  const loudness = { hop: 0.1, values: Array.from({ length: 1200 }, (_, i) => 0.5 + 0.45 * Math.sin(i / 37)) };
  const tracks = { violin: track('violin', 80), cello: track('cello', 40) };
  const song: Song = { id: 'x', notes: notesOf(160), tracks, beats, loudness, moments: [[0, 'dread', 'One'], [40, 'agitato'], [90, 'casket', 'Three']], dur };
  const whole = { start: 0, end: dur };

  it('over the whole song, pulse, gate and plays write the studio\'s pivots', () => {
    expect(U.presetPivots(L, 'pulse', 2, whole, song)).toEqual(L.presets.pulse(whole, beats, { every: 2 }));
    expect(U.presetPivots(L, 'gate', 0.6, whole, song)).toEqual(L.presets.gate(whole, loudness, { above: 0.6 }));
    for (const listen of [undefined, 'violin', 'melody', 'family:strings'])
      expect(U.presetPivots(L, 'plays', 0, whole, song, listen)).toEqual(L.presets.plays(whole, L.listenNotes({ notes: song.notes, tracks }, listen).notes));
  });
  it('the gate\'s default threshold is 0.5 without a loudness', () => {
    expect(U.gateDefault(undefined, whole)).toBe(0.5);
  });
  it('with an energy lane, gate (its 3 s curve) and follow (its 0.4 s one) read it with no lag', () => {
    const db = Array.from({ length: 1200 }, (_, i) => -40 + 20 * Math.sin(i / 23));
    const energy = { hop: 0.1, momentary: db, shortTerm: db.map((v) => v / 2) };
    const se: Song = { ...song, energy }, none = { open: 0, close: 0 };
    expect(U.presetPivots(L, 'gate', 0.6, whole, se)).toEqual(L.presets.gate(whole, L.energyCurve(se, 'shortTerm')!, { above: 0.6, lag: none }));
    expect(U.presetPivots(L, 'follow', 0.3, whole, se)).toEqual(L.presets.follow(whole, L.energyCurve(se)!, { floor: 0.3, lead: 0 }));
    expect(U.presetPivots(L, 'gate', 0.6, whole, se)).not.toEqual(U.presetPivots(L, 'gate', 0.6, whole, song));
    // energy alone, without a loudness lane, is enough
    expect(U.presetPivots(L, 'follow', 0.3, whole, { ...se, loudness: undefined }).length).toBeGreaterThan(2);
  });
  it('without one, exactly as before: pack.loudness with the measured lag', () => {
    expect(U.presetPivots(L, 'follow', 0.3, whole, song)).toEqual(L.presets.follow(whole, loudness, { floor: 0.3 }));
    expect(U.presetPivots(L, 'gate', 0.6, whole, song)).toEqual(L.presets.gate(whole, loudness, { above: 0.6 }));
    expect(U.presetPivots(L, 'gate', 0.6, whole, { ...song, loudness: undefined })).toEqual([]);
  });
  it("the gate's default threshold reads the span itself with lag 0, 1.7 s later without", () => {
    const step = { hop: 0.1, values: Array.from({ length: 1200 }, (_, i) => (i < 400 ? 0.2 : 0.9)) }, span = { start: 38, end: 40 };
    expect(U.gateDefault(step, span, 0)).toBe(0.2);
    expect(U.gateDefault(step, span)).toBe(0.9);
  });
  it('over one moment: the preset inside it, full before and after', () => {
    const span = { start: 40, end: 90 };
    const p = U.presetPivots(L, 'pulse', 1, span, song);
    const inner = L.presets.pulse(span, beats, { every: 1 });
    for (let t = 0; t <= dur; t += 0.37) {
      const want = t < span.start || t > span.end ? 1 : L.automationAt(inner, t);
      expect(L.automationAt(p, t)).toBeCloseTo(want, 12);
    }
    expect(L.automationAt(p, span.end)).toBe(1);   // the next moment starts full
    for (let i = 1; i < p.length; i++) expect(p[i].t).toBeGreaterThanOrEqual(p[i - 1].t);
  });
  it('over one moment, plays and gate: the bare preset inside it even before its first run, full outside', () => {
    const span = { start: 40, end: 90 };
    const late = notesOf(30, 60);   // the part's first note at 60, well after the moment starts
    const quiet = { hop: 0.1, values: Array.from({ length: 1200 }, (_, i) => (i >= 620 && i < 820 ? 0.9 : 0.1)) };   // loud from 62 to 82 on the lane: open from about 60.75
    const s2: Song = { ...song, notes: late, tracks: undefined, loudness: quiet };
    const cases: [Pivot[], Pivot[]][] = [
      [U.presetPivots(L, 'plays', 0, span, s2), L.presets.plays(span, late, { floor: 0 })],
      [U.presetPivots(L, 'plays', 0.3, span, s2), L.presets.plays(span, late, { floor: 0.3 })],
      [U.presetPivots(L, 'gate', 0.5, span, s2), L.presets.gate(span, quiet, { above: 0.5 })],
    ];
    for (const [p, inner] of cases) {
      expect(inner[0].t).toBeGreaterThan(span.start + 10);
      for (let t = 0; t <= dur; t += 0.37) {
        const want = t < span.start || t > span.end ? 1 : L.automationAt(inner, t);
        expect(L.automationAt(p, t)).toBeCloseTo(want, 12);
      }
      for (const t of [40, 45, 55, 59]) expect(L.automationAt(p, t)).toBeCloseTo(inner[0].v, 12);
      expect(L.automationAt(p, span.end)).toBe(1);
      for (let i = 1; i < p.length; i++) expect(p[i].t).toBeGreaterThanOrEqual(p[i - 1].t);
    }
  });
  it('a padded curve stays within MAX_PIVOTS and still ends full after its moment', () => {
    const span = { start: 40, end: 90 };
    const dense = Array.from({ length: 254 }, (_, i) => 40.1 + i * 0.19);   // the pulse alone writes 255 pivots
    const p = U.presetPivots(L, 'pulse', 1, span, { ...song, beats: dense });
    expect(L.presets.pulse(span, dense, { every: 1 }).length).toBeGreaterThan(L.MAX_PIVOTS - 4);
    expect(p.length).toBeLessThanOrEqual(L.MAX_PIVOTS);
    expect(L.automationAt(p, 20)).toBe(1);
    expect(L.automationAt(p, span.end)).toBe(1);
    expect(L.automationAt(p, 100)).toBe(1);
    const many: Song['moments'] = Array.from({ length: 100 }, (_, i) => [i * 1.2, 'calm'] as Song['moments'][number]);
    const f = U.presetPivots(L, 'fade', 0.2, { start: 0, end: dur }, { ...song, moments: many });
    expect(f.length).toBeLessThanOrEqual(L.MAX_PIVOTS);
    expect(L.automationAt(f, 0.6)).toBe(1);                // the first moment fades and is full in its middle
    expect(L.automationAt(f, 1.2 + 0.1)).toBeCloseTo(0.5, 6);
    expect(L.automationAt(f, 99 * 1.2 + 0.6)).toBe(1);      // a moment past the room: full, not held at 0
  });
  it('fade at moments: each moment fades in from its start and out to its end, at most half its length', () => {
    const p = U.presetPivots(L, 'fade', 4, whole, song);
    for (const m of U.momentSpans(song.moments, dur)) {
      expect(L.automationAt(p, m.start + 0.001)).toBeLessThan(0.01);
      expect(L.automationAt(p, m.start + 2)).toBeCloseTo(0.5, 6);
      expect(L.automationAt(p, (m.start + m.end) / 2)).toBe(1);
    }
    expect(L.automationAt(p, dur)).toBe(0);
    const short = U.presetPivots(L, 'fade', 30, { start: 0, end: 40 }, song);   // a 40 s moment: 20 s each way
    expect(L.automationAt(short, 20)).toBe(1);
    expect(L.automationAt(short, 10)).toBeCloseTo(0.5, 6);
  });
  it('no loudness curve: the gate and follow write nothing', () => {
    expect(U.presetPivots(L, 'gate', 0.5, whole, { ...song, loudness: undefined })).toEqual([]);
    expect(U.presetPivots(L, 'follow', 0.35, whole, { ...song, loudness: undefined })).toEqual([]);
  });
  it('follow writes the shared preset with the amount as its floor, full outside its moment', () => {
    expect(U.presetPivots(L, 'follow', 0.35, whole, song)).toEqual(L.presets.follow(whole, loudness, { floor: 0.35 }));
    const span = { start: 40, end: 90 }, inner = L.presets.follow(span, loudness, { floor: 0.2 });
    const p = U.presetPivots(L, 'follow', 0.2, span, song);
    for (let t = 0; t <= dur; t += 0.37) expect(L.automationAt(p, t)).toBeCloseTo(t < span.start || t > span.end ? 1 : L.automationAt(inner, t), 12);
    expect(p.length).toBeLessThanOrEqual(L.MAX_PIVOTS);
  });
  it('climax writes the shared preset with the amount as its floor, full outside its moment; nothing without loudness', () => {
    const span = { start: 40, end: 90 }, inner = L.presets.toClimax(span, L.climaxLane(song), { floor: 0.3, peaks: L.climaxes(song) });
    const p = U.presetPivots(L, 'climax', 0.3, span, song);
    for (let t = 0; t <= dur; t += 0.37) expect(L.automationAt(p, t)).toBeCloseTo(t < span.start || t > span.end ? 1 : L.automationAt(inner, t), 12);
    expect(p.length).toBeLessThanOrEqual(L.MAX_PIVOTS);
    expect(U.presetPivots(L, 'climax', 0.3, whole, { ...song, loudness: undefined })).toEqual([]);
    expect(inner.length).toBeGreaterThan(2);
  });
  it('the default gate threshold reads the lane 1.7 s later, where the music of the span shows on it', () => {
    const step = { hop: 0.1, values: Array.from({ length: 400 }, (_, i) => (i < 150 ? 0.2 : 0.8)) };   // loud on the lane from 15 s
    expect(U.gateDefault(step, { start: 12, end: 16 })).toBe(0.8);    // read over 13.7 .. 17.7, mostly loud
    expect(U.gateDefault(step, { start: 0, end: 9 })).toBe(0.2);      // read over 1.7 .. 10.7
    expect(U.gateDefault(step, { start: 39, end: 40 })).toBe(0.8);    // past the lane's end: its last value, not 0.5
  });
  it('moments are named by their label, else their mood', () => {
    expect(U.momentSpans(song.moments, dur).map((m) => [m.start, m.end, m.label])).toEqual([[0, 40, 'One'], [40, 90, 'Agitato'], [90, 120, 'Three']]);
  });
});

describe('entries', () => {
  it('what changes nothing is left out, and an empty entry is none', () => {
    expect(U.tidyEntry({ listen: 'all', intensity: [] })).toBeNull();
    expect(U.tidyEntry({ listen: 'melody', region: undefined, intensity: undefined })).toEqual({ listen: 'melody' });
    const r = U.defaultRegion('strings');
    expect(U.tidyEntry({ region: r, intensity: [{ t: 1, v: 0 }] })).toEqual({ region: r, intensity: [{ t: 1, v: 0 }] });
    expect(U.tidyEntry(undefined)).toBeNull();
  });
  it('keeps "keep the strongest" only with a curve, where it does something', () => {
    expect(U.tidyEntry({ intensity: [{ t: 1, v: 0 }], thin: 'loud' })).toEqual({ intensity: [{ t: 1, v: 0 }], thin: 'loud' });
    expect(U.tidyEntry({ listen: 'melody', thin: 'loud' })).toEqual({ listen: 'melody' });
    expect(U.tidyEntry({ thin: 'loud' })).toBeNull();
    expect(U.tidyEntry({ intensity: [{ t: 1, v: 0 }], thin: 'quiet' })).toEqual({ intensity: [{ t: 1, v: 0 }] });
  });
});

describe('the filter', () => {
  const metas: WidgetMeta[] = Object.keys(tags).map((id) => ({ id, name: id, blurb: '', tag: '', verdict: null, params: [], tags: tags[id] }));
  const feelAll = Object.values(words.feel).flatMap((a) => Object.keys(a)), instAll = Object.keys(words.instruments);
  it('keeps the widgets the studio\'s picker keeps (AND within the chips)', () => {
    for (let k = 0; k < 200; k++) {
      const f = { feel: feelAll.filter(() => rnd() < 0.06), inst: instAll.filter(() => rnd() < 0.08) };
      const lab = metas.filter((m) => U.matches(m.tags, f)).map((m) => m.id);
      expect(lab).toEqual(filterWidgets(metas, { feel: f.feel, instruments: f.inst, tracks: null }, words).map((m) => m.id));
    }
  });
  it('dark + alien keeps rorschach; nothing chosen keeps all, untagged ones too', () => {
    expect(metas.filter((m) => U.matches(m.tags, { feel: ['dark', 'alien'], inst: [] })).map((m) => m.id)).toContain('rorschach');
    expect(U.matches(undefined, { feel: [], inst: [] })).toBe(true);
    expect(U.matches(undefined, { feel: ['dark'], inst: [] })).toBe(false);
  });
  it('lives in the URL beside the other parameters', () => {
    expect(U.parseFilter('?song=b5&feel=dark,Liquid&inst=cello')).toEqual({ feel: ['dark', 'liquid'], inst: ['cello'] });
    expect(U.filterSearch('?song=b5&feel=x', { feel: ['dark', 'liquid'], inst: [] })).toBe('?song=b5&feel=dark,liquid');
    expect(U.filterSearch('?feel=dark', { feel: [], inst: [] })).toBe('');
  });
  it('rows: the feel axes, then the instruments by family, every word once', () => {
    const rows = U.filterRows(words);
    expect(rows.filter((r) => r.kind === 'feel').map((r) => r.label)).toEqual(Object.keys(words.feel));
    expect(rows.filter((r) => r.kind === 'inst').flatMap((r) => r.words).sort()).toEqual([...instAll].sort());
    expect(rows.filter((r) => r.kind === 'feel').flatMap((r) => r.words)).toEqual(feelAll);
  });
});
