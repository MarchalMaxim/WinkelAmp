/// <reference types="node" />
// The layer panel's pure parts (plan 2026-10-31 T16): what a layer can listen to, where a new region sits, and the
// widget picker's tag filter.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { defaultRegion, describePlace, gateDefault, listenOptions, partWords, presetPivots, READERS } from '../src/studio/ui/layer-controls';
import { filterWidgets } from '../src/studio/ui/widget-picker';
import type { SongPack } from '../src/studio/pack/pack';
import type { TagWords } from '../src/widgets/tags';
import type { Note, WidgetMeta, WidgetTags } from '../src/widgets/types';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../lab/${f}`, import.meta.url), 'utf8'));
const words = read('tag-words.json') as TagWords;
const tags = read('tags.json') as Record<string, WidgetTags>;
const metas: WidgetMeta[] = Object.keys(tags).map((id) => ({ id, name: id, blurb: '', tag: '', verdict: null, params: [], tags: tags[id] }));

const notes = (n: number): Note[] => Array.from({ length: n }, (_, i) => [i, i + 0.5, 60 + i, 80] as Note);
const track = (family: string, label: string, n: number) => ({ label, family, notes: notes(n), share: 0.3, vel: { borrowed: 0, level: n } });
const LINES = ['melody', 'bassline', 'inner', 'low', 'high', 'accents'];

describe('listenOptions', () => {
  it('all notes, the present tracks in TRACKS order with their note counts, families of 2+, then the lines', () => {
    const pack = { tracks: { horn: track('brass', 'French horns', 3), viola: track('strings', 'Violas', 5), violin: track('strings', 'Violins', 7) } } as unknown as Pick<SongPack, 'tracks'>;
    const o = listenOptions(pack);
    expect(o.map((x) => x.value)).toEqual(['all', 'violin', 'viola', 'horn', 'family:strings', ...LINES]);
    expect(o[0]).toEqual({ group: '', value: 'all', label: 'All notes' });
    expect(o.slice(1, 4).every((x) => x.group === 'In this recording')).toBe(true);
    expect(o[1].label).toBe('Violins (7 notes)');
    expect(o[4].group).toBe('Families');
    expect(o.slice(5).every((x) => x.group === 'From the notes')).toBe(true);
    expect(o.slice(5).map((x) => x.label)).toEqual(['Melody', 'Bass line', 'Inner voices', 'Low notes', 'High notes', 'Accents']);
  });

  it('without tracks (or with empty ones): all notes and the lines', () => {
    expect(listenOptions({}).map((x) => x.value)).toEqual(['all', ...LINES]);
    const empty = { tracks: { violin: track('strings', 'Violins', 0) } } as unknown as Pick<SongPack, 'tracks'>;
    expect(listenOptions(empty).map((x) => x.value)).toEqual(['all', ...LINES]);
  });
});

describe('defaultRegion', () => {
  it('a small copy of the whole widget: a centred soft box, the picture contained, for every widget', () => {
    for (const id of ['kandinsky', 'casket', ...READERS]) {
      expect(defaultRegion(id)).toEqual({ mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4, feather: 0.2, fit: 'contain' });
    }
    expect(defaultRegion('a')).not.toBe(defaultRegion('a'));   // a fresh object each time
  });

  it('names a part in running text', () => {
    expect(partWords('horn')).toBe('French horns');
    expect(partWords('bassline')).toBe('bass line');
    expect(partWords('family:strings')).toBe('all strings');
  });

  it('says the place in words', () => {
    expect(describePlace(undefined)).toBe('');
    expect(describePlace({ ...defaultRegion('casket'), mode: 'spot' })).toBe('as a mask');
    expect(describePlace(defaultRegion('kandinsky'))).toBe('as a small copy');
  });
});

describe('gateDefault', () => {
  const loud = (values: number[]) => ({ hop: 0.1 as const, values });
  const one = { start: 0, end: 1 };   // the first ten values

  it("the section's 60th percentile, to 0.05", () => {
    // sorted: 0.05 0.12 0.22 0.33 0.41 0.62 0.67 0.71 0.88 0.95; floor(0.6 * 9) = 5 -> 0.62 -> 0.6
    expect(gateDefault(loud([0.12, 0.95, 0.33, 0.41, 0.88, 0.22, 0.67, 0.71, 0.05, 0.62]), one)).toBeCloseTo(0.6, 12);
    expect(gateDefault(loud(Array(10).fill(0.46)), one)).toBeCloseTo(0.45, 12);
    expect(gateDefault(loud(Array(10).fill(0.48)), one)).toBeCloseTo(0.5, 12);
  });

  it('reads only the values inside the span', () => {
    const v = [...Array(10).fill(0.2), ...Array(10).fill(0.7)];
    expect(gateDefault(loud(v), { start: 1, end: 2 })).toBeCloseTo(0.7, 12);
    expect(gateDefault(loud(v), one)).toBeCloseTo(0.2, 12);
  });

  it('kept between 0.1 and 0.9', () => {
    expect(gateDefault(loud(Array(10).fill(0.02)), one)).toBe(0.1);
    expect(gateDefault(loud(Array(10).fill(0)), one)).toBe(0.1);
    expect(gateDefault(loud(Array(10).fill(0.98)), one)).toBe(0.9);
    expect(gateDefault(loud(Array(10).fill(1)), one)).toBe(0.9);
  });

  it('0.5 for an empty span, and NaN values are left out', () => {
    expect(gateDefault(loud([]), one)).toBe(0.5);
    expect(gateDefault(loud(Array(10).fill(0.3)), { start: 5, end: 6 })).toBe(0.5);   // past the end
    expect(gateDefault(loud(Array(10).fill(0.3)), { start: 0.5, end: 0.5 })).toBe(0.5);
    expect(gateDefault(loud(Array(10).fill(NaN)), one)).toBe(0.5);
    expect(gateDefault(loud([NaN, NaN, NaN, NaN, NaN, 0.8, 0.8, NaN, NaN, NaN]), one)).toBeCloseTo(0.8, 12);
  });
});

describe('presetPivots', () => {
  const L = loadLayers();
  const P = L.presets;
  const span = { start: 10, end: 30 };
  const beats = Array.from({ length: 81 }, (_, i) => i * 0.5);
  const all: Note[] = [[11, 12, 60, 80], [15, 16, 72, 90], [24, 25, 48, 70]];
  const violin: Note[] = [[18, 22, 76, 100]];
  const pack = {
    notes: all, beats,
    tracks: { violin: { label: 'Violins', family: 'strings', notes: violin, share: 0.3, vel: { borrowed: 0, level: 1 } } },
    loudness: { hop: 0.1 as const, values: Array.from({ length: 400 }, (_, i) => (i % 20) / 20) },
  } as unknown as Pick<SongPack, 'notes' | 'tracks' | 'beats' | 'loudness'>;

  it('a pulse every bar is a pulse every 4 beats', () => {
    const bars = presetPivots(L, { kind: 'pulse', every: 1, unit: 'bars' }, span, pack, undefined);
    expect(bars).toEqual(P.pulse(span, beats, { every: 4 }));
    expect(bars).not.toEqual(P.pulse(span, beats, { every: 1 }));
    expect(presetPivots(L, { kind: 'pulse', every: 2, unit: 'bars' }, span, pack, undefined)).toEqual(P.pulse(span, beats, { every: 8 }));
    expect(presetPivots(L, { kind: 'pulse', every: 2, unit: 'beats' }, span, pack, undefined)).toEqual(P.pulse(span, beats, { every: 2 }));
  });

  it("'while it plays' follows the listened part's notes", () => {
    const v = presetPivots(L, { kind: 'plays' }, span, pack, 'violin');
    expect(v).toEqual(P.plays(span, violin));
    expect(v).not.toEqual(P.plays(span, all));
    expect(presetPivots(L, { kind: 'plays' }, span, pack, undefined)).toEqual(P.plays(span, all));
    expect(presetPivots(L, { kind: 'plays' }, span, pack, 'horn')).toEqual(P.plays(span, all));   // not in this song
  });

  it('fades, swell and gate are the presets themselves', () => {
    expect(presetPivots(L, { kind: 'fadeIn', seconds: 3 }, span, pack, undefined)).toEqual(P.fadeIn(span, 3));
    expect(presetPivots(L, { kind: 'fadeOut', seconds: 5 }, span, pack, undefined)).toEqual(P.fadeOut(span, 5));
    expect(presetPivots(L, { kind: 'swell' }, span, pack, undefined)).toEqual(P.swell(span));
    expect(presetPivots(L, { kind: 'gate', above: 0.4 }, span, pack, undefined)).toEqual(P.gate(span, pack.loudness, { above: 0.4 }));
  });
});

describe('filterWidgets', () => {
  const none = { feel: [], instruments: [], tracks: null };
  it('with no filter: every widget, in order', () => {
    expect(filterWidgets(metas, none, words).map((m) => m.id)).toEqual(metas.map((m) => m.id));
  });

  it('feel words: AND across the chosen words', () => {
    const ids = filterWidgets(metas, { ...none, feel: ['dark', 'alien'] }, words).map((m) => m.id);
    expect(ids).toContain('rorschach');
    expect(ids).not.toContain('kandinsky');
    for (const id of ids) expect(tags[id].feel).toEqual(expect.arrayContaining(['dark', 'alien']));
  });

  it('instrument words: AND too, combined with feel', () => {
    const ids = filterWidgets(metas, { ...none, instruments: ['contrabass', 'timpani'] }, words).map((m) => m.id);
    expect(ids).toContain('rorschach');
    for (const id of ids) expect(tags[id].instruments).toEqual(expect.arrayContaining(['contrabass', 'timpani']));
    expect(filterWidgets(metas, { feel: ['vivid'], instruments: ['contrabass', 'timpani'], tracks: null }, words)).toEqual([]);
  });

  it('suits this song: one of its instruments maps to one of the tracks (a family word to any track of it)', () => {
    const ids = filterWidgets(metas, { ...none, tracks: ['violin'] }, words).map((m) => m.id);
    expect(ids).toContain('strings');
    expect(ids).toContain('current');
    expect(ids).not.toContain('rorschach');   // cello, contrabass, bassoon
    // 'strings' (family:strings) suits a song with only violas
    const fam = metas.filter((m) => m.tags?.instruments.includes('strings') && !m.tags.instruments.includes('viola'));
    const viola = filterWidgets(metas, { ...none, tracks: ['viola'] }, words).map((m) => m.id);
    for (const m of fam) expect(viola).toContain(m.id);
    // tutti suits an ensemble of 2+ tracks, not a song with one
    expect(filterWidgets(metas, { ...none, tracks: ['horn', 'oboe'] }, words).map((m) => m.id)).toContain('kandinsky');
    expect(filterWidgets(metas, { ...none, tracks: ['horn'] }, words).map((m) => m.id)).not.toContain('kandinsky');   // tutti, trumpet, cello
    expect(filterWidgets(metas, { ...none, tracks: [] }, words)).toEqual([]);
  });

  it('an untagged widget only shows when nothing is chosen', () => {
    const plain: WidgetMeta = { id: 'plain', name: 'plain', blurb: '', tag: '', verdict: null, params: [] };
    expect(filterWidgets([plain], none, words)).toEqual([plain]);
    expect(filterWidgets([plain], { ...none, feel: ['dark'] }, words)).toEqual([]);
  });
});
