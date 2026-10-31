/// <reference types="node" />
// The layer panel's pure parts (plan 2026-10-31 T16): what a layer can listen to, where a new region sits, and the
// widget picker's tag filter.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultRegion, describePlace, listenOptions, partWords, READERS } from '../src/studio/ui/layer-controls';
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
  it('a centred soft ellipse: a spot for the canvas readers, else a window', () => {
    expect(defaultRegion('casket').mode).toBe('spot');
    expect(defaultRegion('kandinsky').mode).toBe('window');
    for (const id of READERS) expect(defaultRegion(id).mode).toBe('spot');
    expect(defaultRegion('kandinsky')).toEqual({ mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w: 0.5, h: 0.5, feather: 0.25 });
    expect(defaultRegion('a')).not.toBe(defaultRegion('a'));   // a fresh object each time
  });

  it('names a part in running text', () => {
    expect(partWords('horn')).toBe('French horns');
    expect(partWords('bassline')).toBe('bass line');
    expect(partWords('family:strings')).toBe('all strings');
  });

  it('says the place in words', () => {
    expect(describePlace(undefined)).toBe('');
    expect(describePlace(defaultRegion('casket'))).toBe('in a spotlight');
    expect(describePlace(defaultRegion('kandinsky'))).toBe('in a window');
  });
});

describe('filterWidgets', () => {
  const none = { feel: [], instruments: [], tracks: null };
  it('with no filter: every widget, in order', () => {
    expect(filterWidgets(metas, none, words).map((m) => m.id)).toEqual(metas.map((m) => m.id));
  });

  it('feel words: AND across the chosen words', () => {
    const ids = filterWidgets(metas, { ...none, feel: ['dark', 'liquid'] }, words).map((m) => m.id);
    expect(ids).toContain('rorschach');
    expect(ids).not.toContain('kandinsky');
    for (const id of ids) expect(tags[id].feel).toEqual(expect.arrayContaining(['dark', 'liquid']));
  });

  it('instrument words: AND too, combined with feel', () => {
    const ids = filterWidgets(metas, { ...none, instruments: ['cello', 'bassoon'] }, words).map((m) => m.id);
    expect(ids).toContain('rorschach');
    for (const id of ids) expect(tags[id].instruments).toEqual(expect.arrayContaining(['cello', 'bassoon']));
    expect(filterWidgets(metas, { feel: ['vivid'], instruments: ['cello', 'bassoon'], tracks: null }, words)).toEqual([]);
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
    expect(filterWidgets(metas, { ...none, tracks: [] }, words)).toEqual([]);
  });

  it('an untagged widget only shows when nothing is chosen', () => {
    const plain: WidgetMeta = { id: 'plain', name: 'plain', blurb: '', tag: '', verdict: null, params: [] };
    expect(filterWidgets([plain], none, words)).toEqual([plain]);
    expect(filterWidgets([plain], { ...none, feel: ['dark'] }, words)).toEqual([]);
  });
});
