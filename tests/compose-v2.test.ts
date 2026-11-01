/// <reference types="node" />
// The auto-composer with tags and instruments (plan 2026-10-31 §9, T19).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadCatalogue, readLabTagWords } from '../scripts/node/catalogue';
import { loadLayers } from '../scripts/node/layers';
import { sectionCharacters } from '../src/studio/compose/character';
import { composeShow, type ComposeInput } from '../src/studio/compose/compose';
import { enteringTrack, presence } from '../src/studio/compose/instruments';
import { TASTE } from '../src/studio/compose/taste';
import type { Track } from '../src/studio/pack/pack';
import { TRACKS } from '../src/studio/pack/instruments';
import { canonicalShow, validateShow, type Show } from '../src/studio/show/show';
import type { Note, TrackId, WidgetMeta } from '../src/widgets/types';

const widgets = loadCatalogue().widgets;
const layers = loadLayers(), words = readLabTagWords();
type Register = 'low' | 'mid' | 'high';
interface Part { from: number; to: number; rate: number; vel: number; register: Register; poly?: number; track?: TrackId; len?: number }
const PITCH: Record<Register, number> = { low: 36, mid: 60, high: 84 };
const ms = (t: number) => Math.round(t * 1000) / 1000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** compose.test's makePack, with tracks: a part with `track` also goes into that track's notes (an ensemble's
    hybrid all-notes holds every track's notes). `sections` gives the analysis sections' starts (novelty 1 each). */
function makePack(o: { duration: number; parts: Part[]; every?: number; novelty?: (start: number) => number; sections?: number[] }): ComposeInput['pack'] {
  const notes: Note[] = [], tracks: Partial<Record<TrackId, Track>> = {};
  for (const p of o.parts) {
    for (let i = 0, t = p.from; t < p.to - 1e-9; t = p.from + ++i / p.rate) {
      for (let k = 0; k < (p.poly ?? 2); k++) {
        const n: Note = [ms(t + k * 0.002), ms(t + (p.len ?? 0.4)), PITCH[p.register] + 4 * k, p.vel];
        notes.push(n);
        if (p.track) (tracks[p.track] ??= { label: TRACKS[p.track].label, family: TRACKS[p.track].family, notes: [], share: 0, vel: { borrowed: 0, level: 0 } }).notes.push([...n] as Note);
      }
    }
  }
  notes.sort((a, b) => a[0] - b[0]);
  for (const t of Object.values(tracks)) t!.notes.sort((a, b) => a[0] - b[0]);
  const sections = [];
  if (o.sections) {
    const st = [0, ...o.sections];
    for (let k = 0; k < st.length; k++) sections.push({ start: st[k], end: st[k + 1] ?? o.duration, novelty: k ? 1 : 0 });
  } else {
    const every = o.every ?? 10;
    for (let s = 0; s < o.duration - 1e-9; s += every) {
      sections.push({ start: s, end: Math.min(o.duration, s + every), novelty: s === 0 ? 0 : (o.novelty?.(s) ?? ((s * 7919) % 97) / 97) });
    }
  }
  const pack: ComposeInput['pack'] = { id: 'demo', title: 'Demo', duration: o.duration, notes, sections };
  if (Object.keys(tracks).length) pack.tracks = tracks;
  return pack;
}
const v1 = (pack: ComposeInput['pack'], w: ReadonlyMap<string, WidgetMeta> = widgets): ComposeInput => ({ pack, widgets: w });
const v2 = (pack: ComposeInput['pack'], description = ''): ComposeInput => ({ pack, widgets, description, layers, words });
const tracksOf = (pack: ComposeInput['pack']) => Object.keys(pack.tracks ?? {});
const valid = (show: Show, pack: ComposeInput['pack']) =>
  expect(validateShow(show, { duration: pack.duration, widgets, tracks: tracksOf(pack) })).toEqual({ errors: [], warnings: [] });

const quietLoud = () => makePack({
  duration: 120, novelty: (s) => (s === 60 ? 1 : 0.2),
  parts: [{ from: 0.5, to: 60, rate: 1, vel: 40, register: 'mid' }, { from: 60.3, to: 119, rate: 6, vel: 115, register: 'mid', poly: 5 }],
});
const threeParts = () => makePack({ duration: 600, every: 7.5, parts: [
  { from: 0, to: 200, rate: 1.5, vel: 50, register: 'mid' }, { from: 200, to: 400, rate: 5, vel: 110, register: 'low', poly: 4 },
  { from: 400, to: 600, rate: 3, vel: 80, register: 'high' }] });
/** A quiet low stretch between two louder, faster ones. */
const quietLow = () => makePack({ duration: 90, sections: [30, 60], parts: [
  { from: 0, to: 30, rate: 4, vel: 100, register: 'mid', poly: 3 }, { from: 30, to: 60, rate: 0.7, vel: 35, register: 'low' },
  { from: 60, to: 90, rate: 4, vel: 100, register: 'high', poly: 3 }] });

describe('presence', () => {
  it('counts the 0.5 s bins with a sounding note, the last bin shorter', () => {
    expect(presence([], { start: 0, end: 10 })).toBe(0);
    expect(presence([[0, 10, 60, 80]], { start: 0, end: 10 })).toBe(1);
    // [1, 2) sounds in bins [1, 1.5) and [1.5, 2), not in [2, 2.5): 2 of 20
    expect(presence([[1, 2, 60, 80]], { start: 0, end: 10 })).toBe(0.1);
    // [1.2, 1.3) sounds in one bin
    expect(presence([[1.2, 1.3, 60, 80]], { start: 0, end: 10 })).toBe(0.05);
    // 0..1.25: bins [0,.5) [.5,1) [1,1.25): a note at 1.1 is in the third
    expect(presence([[1.1, 1.2, 60, 80]], { start: 0, end: 1.25 })).toBeCloseTo(1 / 3, 10);
  });

  it('a note crossing an edge of the section counts only inside it; a note without length never', () => {
    expect(presence([[-3, 0.6, 60, 80]], { start: 0, end: 5 })).toBe(0.2);
    expect(presence([[4.6, 9, 60, 80]], { start: 0, end: 5 })).toBe(0.1);
    expect(presence([[2, 2, 60, 80], [-1, 0, 60, 80], [5, 6, 60, 80]], { start: 0, end: 5 })).toBe(0);
  });

  it('needs no sort', () => {
    expect(presence([[4, 4.2, 60, 80], [0, 0.2, 60, 80]], { start: 0, end: 5 })).toBe(0.2);
  });
});

describe('enteringTrack', () => {
  const track = (notes: Note[]): Track => ({ label: '', family: 'brass', notes, share: 0, vel: { borrowed: 0, level: 0 } });
  const every = (from: number, to: number, gap = 0.5, len = 0.4): Note[] => {
    const out: Note[] = [];
    for (let t = from; t < to - 1e-9; t += gap) out.push([ms(t), ms(t + len), 60, 80]);
    return out;
  };
  const s = { start: 20, end: 60 };

  it('finds a part that was silent 5 s and then plays in 4 of the next 6 s', () => {
    expect(enteringTrack({ tracks: { horn: track(every(30, 40)) } }, s)).toBe('horn');
    expect(enteringTrack({ tracks: { horn: track(every(30, 34)) } }, s)).toBe('horn');      // bins 30..34: 4
    expect(enteringTrack({ tracks: { horn: track(every(30, 33)) } }, s)).toBeNull();         // 3
  });

  it('measures the silence across the section start and from the song start', () => {
    expect(enteringTrack({ tracks: { horn: track([...every(10, 15.5), ...every(21, 30)]) } }, s)).toBe('horn');   // last end 15.4: 5.6 s
    expect(enteringTrack({ tracks: { horn: track([...every(10, 16.5), ...every(21, 30)]) } }, s)).toBe(null);     // last end 16.4: 4.6 s
    // 4.8 s into the song: not 5 s of silence
    expect(enteringTrack({ tracks: { horn: track(every(4.8, 20)) } }, { start: 0, end: 30 })).toBeNull();
    expect(enteringTrack({ tracks: { horn: track(every(5, 20)) } }, { start: 0, end: 30 })).toBe('horn');
  });

  it('a note held into the section is not an entry; the first part in TRACKS order wins', () => {
    expect(enteringTrack({ tracks: { horn: track([[5, 28, 60, 80], ...every(30, 40)]) } }, s)).toBe(null);
    expect(enteringTrack({ tracks: { horn: track(every(30, 40)), violin: track(every(40, 50)) } }, s)).toBe('violin');
    expect(enteringTrack({ tracks: { horn: track(every(70, 80)) } }, s)).toBe(null);
    expect(enteringTrack({}, s)).toBe(null);
  });
});

describe('composeShow without layers and words', () => {
  // canonicalShow of last night's composer (HEAD fa22600) for these packs.
  const GOLDEN: Record<string, string> = { quietLoud: '70e349ae1e8560b1', threeParts: 'beb75e5b9289f88b', silent: 'f4f2a5d0d4279555' };
  const fixtures: Record<string, () => ComposeInput['pack']> = { quietLoud, threeParts, silent: () => makePack({ duration: 90, parts: [] }) };

  it('is byte-identical to version 1', () => {
    for (const [name, f] of Object.entries(fixtures)) expect(sha(canonicalShow(composeShow(v1(f())))), name).toBe(GOLDEN[name]);
  });

  it('ignores a description and the tracks', () => {
    const plain = quietLoud();
    const withTracks = makePack({ duration: 120, novelty: (s) => (s === 60 ? 1 : 0.2), parts: [
      { from: 0.5, to: 60, rate: 1, vel: 40, register: 'mid', track: 'violin' }, { from: 60.3, to: 119, rate: 6, vel: 115, register: 'mid', poly: 5, track: 'horn' }] });
    expect(withTracks.tracks).toBeDefined();
    const a = canonicalShow(composeShow(v1(plain)));
    expect(canonicalShow(composeShow({ ...v1(withTracks), description: 'dark and dripping' }))).toBe(a);
    expect(canonicalShow(composeShow({ ...v1(withTracks), layers }))).toBe(a);
    expect(canonicalShow(composeShow({ ...v1(withTracks), words }))).toBe(a);
  });
});

describe('composeShow with layers and words', () => {
  const baseOf = (show: Show, k: number) => show.sections[k].layers[0].widget;

  it('"dark and dripping" moves the base of a quiet low section to rorschach', () => {
    const pack = quietLow();
    const before = composeShow(v2(pack)), after = composeShow(v2(pack, 'Something dark and dripping, please.'));
    expect(before.sections.length).toBe(3);
    const ch = sectionCharacters(pack.notes, before.sections)[1];
    expect(ch.quiet).toBeGreaterThan(0.5);
    expect(ch.low).toBeGreaterThan(0.9);
    expect(baseOf(before, 1)).not.toBe('rorschach');
    expect(baseOf(after, 1)).toBe('rorschach');
    valid(after, pack);
  });

  // A slow, full stretch, then a fast thin one where violins (every 0.8 s, 0.4 s long, over 18 s) play 60 % of it.
  const violins = (more: Part[] = []) => makePack({ duration: 60, sections: [30], parts: [
    { from: 0, to: 30, rate: 1, vel: 50, register: 'mid', poly: 2 }, { from: 30, to: 60, rate: 6, vel: 100, register: 'mid', poly: 1 },
    { from: 30, to: 48, rate: 1.25, vel: 100, register: 'high', poly: 1, track: 'violin' }, ...more] });

  it('routes an accent tagged violin to a violin track that plays 60 % of its section', () => {
    const pack = violins(), show = composeShow(v2(pack)), s = show.sections[1];
    expect(presence(pack.tracks!.violin!.notes, s)).toBeCloseTo(0.6, 1);
    const accent = s.layers[1];
    expect(TASTE.find((t) => t.id === accent.widget)?.role).toBe('accent');
    expect(widgets.get(accent.widget)?.tags?.instruments).toContain('violin');
    expect(accent.listen).toBe('violin');
    expect(s.layers[0].listen).toBeUndefined();   // bases hear all notes
    expect(show.sections[0].layers.every((l) => l.listen === undefined)).toBe(true);   // no violins there
    expect(show.version).toBe(2);
    valid(show, pack);
  });

  it('an accent that suits strings hears the string family when two string tracks play, else the one that does', () => {
    // A fast thin stretch, then a slow loud full one where murmuration is the accent. Its instruments are pinned to
    // strings and cello here (its tags change as the user tunes them; 2026-11-01 they became violin, voice, flute).
    const m = widgets.get('murmuration')!, stringy = new Map(widgets).set('murmuration', { ...m, tags: { ...m.tags!, instruments: ['strings', 'cello'] } });
    const pack = (cello: boolean) => makePack({ duration: 60, sections: [30], parts: [
      { from: 0, to: 30, rate: 6, vel: 50, register: 'mid', poly: 1 }, { from: 30, to: 60, rate: 1, vel: 110, register: 'mid', poly: 3 },
      { from: 30, to: 50, rate: 1.25, vel: 110, register: 'high', poly: 1, track: 'violin' },
      ...(cello ? [{ from: 30, to: 45, rate: 1.25, vel: 110, register: 'low', poly: 1, track: 'cello' } as Part] : [])] });
    const hear = (cello: boolean) => composeShow({ ...v2(pack(cello)), widgets: stringy }).sections[1].layers;
    const one = hear(false), two = hear(true);
    expect(one[1]).toEqual({ widget: 'murmuration', listen: 'violin' });
    expect(two[1]).toEqual({ widget: 'murmuration', listen: 'family:strings' });
  });

  it('gives a horn that enters inside a section one window that plays while it does', () => {
    const pack = makePack({ duration: 80, sections: [20, 60], parts: [
      { from: 0, to: 80, rate: 5, vel: 90, register: 'mid', poly: 3 },
      { from: 30, to: 40, rate: 2, vel: 90, register: 'low', poly: 1, track: 'horn' }] });
    const show = composeShow(v2(pack)), span = show.sections[1];
    expect(show.sections.length).toBe(3);
    expect(span.start).toBeCloseTo(20, 0);
    expect(span.end).toBeCloseTo(60, 0);
    const windows = show.sections.flatMap((s, k) => s.layers.filter((l) => l.region).map((l) => ({ k, l })));
    expect(windows.length).toBe(1);
    const { k, l } = windows[0];
    expect(k).toBe(1);
    expect(l.listen).toBe('horn');
    expect(widgets.get(l.widget)?.tags?.instruments).toContain('horn');
    expect(TASTE.find((t) => t.id === l.widget)?.role).not.toBe('top');
    expect(l.region).toEqual({ mode: 'window', shape: 'ellipse', x: 0.75, y: 0.5, w: 0.4, h: 0.5, feather: 0.3, blend: 'lighten', fit: 'cover' });
    expect([0.25, 0.75]).toContain(l.region!.x);
    expect(l.intensity).toEqual(layers.presets.plays(span, pack.tracks!.horn!.notes));
    expect(l.intensity!.length).toBeGreaterThan(0);
    const last = show.sections[1].layers[show.sections[1].layers.length - 1];
    if (show.sections[1].layers.some((x) => x.widget === 'casket')) expect(last.widget).toBe('casket');
    valid(show, pack);
  });

  it('a piano pack (no tracks): squares, as an accent, listens to the bass line', () => {
    const pack = makePack({ duration: 60, sections: [30], parts: [
      { from: 0, to: 30, rate: 2, vel: 60, register: 'mid' }, { from: 30, to: 60, rate: 2, vel: 110, register: 'low', poly: 1 }] });
    expect(pack.tracks).toBeUndefined();
    const show = composeShow(v2(pack));
    const sq = show.sections.flatMap((s) => s.layers).filter((l) => l.widget === 'squares');
    expect(sq.length).toBeGreaterThan(0);
    for (const l of sq) expect(l.listen).toBe('bassline');
    valid(show, pack);
  });

  it('is deterministic, and every output validates', () => {
    const packs = [quietLoud(), threeParts(), quietLow(), makePack({ duration: 90, parts: [] }),
      makePack({ duration: 180, every: 15, parts: [
        { from: 0, to: 180, rate: 3, vel: 80, register: 'mid', poly: 2, track: 'violin' },
        { from: 0, to: 180, rate: 1, vel: 70, register: 'low', poly: 1, track: 'cello' },
        { from: 50, to: 120, rate: 2, vel: 100, register: 'high', poly: 1, track: 'flute' },
        { from: 90, to: 180, rate: 4, vel: 120, register: 'mid', poly: 4, track: 'piano', len: 0.2 }] })];
    for (const pack of packs) {
      for (const d of ['', 'dark and dripping', 'a hasty, glowing, scary storm']) {
        const a = composeShow(v2(pack, d)), b = composeShow(v2(pack, d));
        expect(canonicalShow(a)).toBe(canonicalShow(b));
        valid(a, pack);
      }
    }
  });
});
