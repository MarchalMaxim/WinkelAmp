/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { sectionCharacters } from '../src/studio/compose/character';
import { composeShow, pickSections, type ComposeInput } from '../src/studio/compose/compose';
import { TASTE } from '../src/studio/compose/taste';
import { canonicalShow, validateShow } from '../src/studio/show/show';
import { groupChords } from '../src/widgets/chords';
import type { Note, WidgetMeta } from '../src/widgets/types';

const widgets = loadCatalogue().widgets;
type Register = 'low' | 'mid' | 'high';
interface Part { from: number; to: number; rate: number; vel: number; register: Register; poly?: number }
const PITCH: Record<Register, number> = { low: 36, mid: 60, high: 84 };
const ms = (t: number) => Math.round(t * 1000) / 1000;

/** A pack: per part, attacks every 1/rate s of `poly` notes (a chord within 2 ms) in the register; analysis sections
    every `every` s (novelty from a fixed pattern, or `novelty`). */
function makePack(o: { duration: number; parts: Part[]; every?: number; novelty?: (start: number) => number }): ComposeInput['pack'] {
  const notes: Note[] = [];
  for (const p of o.parts) {
    for (let i = 0, t = p.from; t < p.to - 1e-9; t = p.from + ++i / p.rate) {
      for (let k = 0; k < (p.poly ?? 2); k++) notes.push([ms(t + k * 0.002), ms(t + 0.4), PITCH[p.register] + 4 * k, p.vel]);
    }
  }
  notes.sort((a, b) => a[0] - b[0]);
  const every = o.every ?? 10, sections = [];
  for (let s = 0; s < o.duration - 1e-9; s += every) {
    sections.push({ start: s, end: Math.min(o.duration, s + every), novelty: s === 0 ? 0 : (o.novelty?.(s) ?? ((s * 7919) % 97) / 97) });
  }
  return { id: 'demo', title: 'Demo', duration: o.duration, notes, sections };
}
const input = (pack: ComposeInput['pack'], w: ReadonlyMap<string, WidgetMeta> = widgets): ComposeInput => ({ pack, widgets: w });
const quietLoud = () => makePack({
  duration: 120, novelty: (s) => (s === 60 ? 1 : 0.2),
  parts: [{ from: 0.5, to: 60, rate: 1, vel: 40, register: 'mid' }, { from: 60.3, to: 119, rate: 6, vel: 115, register: 'mid', poly: 5 }],
});

describe('sectionCharacters', () => {
  const notes = makePack({
    duration: 40, parts: [
      { from: 0, to: 10, rate: 1, vel: 40, register: 'mid' }, { from: 10, to: 20, rate: 1, vel: 110, register: 'mid' },
      { from: 20, to: 30, rate: 6, vel: 40, register: 'mid' }, { from: 30, to: 40, rate: 1, vel: 40, register: 'low' },
    ],
  }).notes;
  const spans = [{ start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 }, { start: 30, end: 40 }];
  const ch = sectionCharacters(notes, spans);

  it('ranks the louder part louder and the faster part faster', () => {
    expect(ch[1].loud).toBeGreaterThan(ch[0].loud);
    expect(ch[1].loud).toBe(1);
    expect(ch[2].fast).toBe(1);
    expect(ch[2].fast).toBeGreaterThan(ch[0].fast);
  });

  it('measures the bass share', () => {
    expect(ch[3].low).toBeCloseTo(1, 5);
    expect(ch[0].low).toBe(0);
  });

  it('quiet = (1 − loud)(1 − fast); all in 0..1', () => {
    for (const c of ch) {
      expect(c.quiet).toBeCloseTo((1 - c.loud) * (1 - c.fast), 10);
      for (const v of Object.values(c)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });

  it('one span ranks 0.5; a span without attacks is 0', () => {
    expect(sectionCharacters(notes, [{ start: 0, end: 40 }])[0]).toMatchObject({ loud: 0.5, fast: 0.5, dense: 0.5 });
    const c = sectionCharacters(notes, [{ start: 0, end: 40 }, { start: 40, end: 50 }]);
    expect(c[1]).toEqual({ loud: 0, dense: 0, low: 0, fast: 0, quiet: 1 });
    expect(c[0]).toMatchObject({ loud: 1, fast: 1, dense: 1 });
  });
});

describe('pickSections', () => {
  it('keeps spans ≥ 15 s and at most one per 30 s', () => {
    for (const pack of [quietLoud(), makePack({ duration: 600, every: 7.5, parts: [{ from: 0, to: 600, rate: 3, vel: 80, register: 'mid' }] })]) {
      const s = pickSections(input(pack));
      expect(s.length).toBeLessThanOrEqual(Math.max(1, Math.round(pack.duration / 30)));
      expect(s[0].start).toBe(0);
      expect(s[s.length - 1].end).toBeCloseTo(pack.duration, 3);
      s.forEach((x, i) => { expect(x.end - x.start).toBeGreaterThanOrEqual(15); if (i) expect(x.start).toBe(s[i - 1].end); });
    }
  });

  it('keeps the most novel boundary and moves it just before the strongest attack near it', () => {
    const s = pickSections(input(quietLoud()));
    const near60 = s.map((x) => x.start).filter((t) => Math.abs(t - 60) < 2);
    expect(near60).toEqual([60.25]);
  });

  it('leaves a boundary with no attack near it where it is', () => {
    const pack = makePack({ duration: 120, novelty: (s) => (s === 60 ? 1 : 0.1), parts: [{ from: 0, to: 50, rate: 2, vel: 80, register: 'mid' }, { from: 70, to: 120, rate: 2, vel: 80, register: 'mid' }] });
    expect(pickSections(input(pack)).map((x) => x.start)).toContain(60);
  });
});

describe('composeShow', () => {
  const ids = new Set(TASTE.map((t) => t.id));
  const quietBases = TASTE.filter((t) => t.role === 'base' && (t.fit.quiet ?? 0) >= 0.5).map((t) => t.id);

  // Every loved or kept widget should have a place in the taste. Since the ratings of 2026-11-08, 25 do not yet (GitHub
  // issue 31): until then the taste holds widgets of the collection only, once each, and composeShow skips the ones
  // the user no longer loves or keeps.
  it('gives widgets of the collection a place, once each', () => {
    for (const id of ids) expect(widgets.has(id), id).toBe(true);
    expect(TASTE.length).toBe(ids.size);
  });

  it('is deterministic', () => {
    expect(canonicalShow(composeShow(input(quietLoud())))).toBe(canonicalShow(composeShow(input(quietLoud()))));
  });

  it('makes valid shows from our loved and kept widgets', () => {
    const packs = [
      quietLoud(),
      makePack({ duration: 90, parts: [] }),
      makePack({ duration: 600, every: 7.5, parts: [
        { from: 0, to: 200, rate: 1.5, vel: 50, register: 'mid' }, { from: 200, to: 400, rate: 5, vel: 110, register: 'low', poly: 4 },
        { from: 400, to: 600, rate: 3, vel: 80, register: 'high' }] }),
    ];
    for (const pack of packs) {
      const show = composeShow(input(pack));
      expect(validateShow(show, { duration: pack.duration, widgets })).toEqual({ errors: [], warnings: [] });
      expect(show).toMatchObject({ version: 3, id: 'demo', song: 'demo', title: 'Demo', composer: { by: 'auto' } });
      expect(show.clips.length).toBeGreaterThan(0);
      for (const c of show.clips) { expect(ids.has(c.widget), c.widget).toBe(true); expect(c.knobs).toBeUndefined(); }
      // Something plays from the start to the end, and the tracks in use leave no empty row.
      expect(Math.min(...show.clips.map((c) => c.start))).toBe(0);
      expect(Math.max(...show.clips.map((c) => c.end))).toBeCloseTo(pack.duration, 3);
      const tracks = [...new Set(show.clips.map((c) => c.track))].sort((a, b) => a - b);
      expect(tracks).toEqual(tracks.map((_, i) => i));
    }
  });

  it('plays a widget on as one clip through the next span; what gives way overlaps what comes next, on another track', () => {
    const pack = quietLoud(), show = composeShow(input(pack));
    const spans = pickSections(input(pack));
    expect(spans.length).toBeGreaterThan(1);
    // No two clips of one widget and part butt up on one track: they would be one.
    for (const a of show.clips) for (const b of show.clips) {
      if (a !== b && a.widget === b.widget && a.listen === b.listen && a.track === b.track) expect(Math.abs(a.end - b.start)).toBeGreaterThan(1e-3);
    }
    // At each boundary the picture has something at full strength or crossing.
    for (const s of spans.slice(1)) expect(show.clips.some((c) => c.start < s.start && c.end > s.start)).toBe(true);
  });

  it('puts casket on top only where it is loud, and a quiet base where it is quiet', () => {
    const pack = quietLoud(), show = composeShow(input(pack));
    const spans = pickSections(input(pack)), ch = sectionCharacters(pack.notes, spans);
    const caskets = show.clips.filter((c) => c.widget === 'casket');
    expect(caskets.length).toBeGreaterThan(0);
    for (const c of caskets) {
      expect(c.track).toBeGreaterThanOrEqual(Math.max(...show.clips.filter((o) => o.widget !== 'casket' && o.start < c.end && c.start < o.end).map((o) => o.track)));
      const i = spans.findIndex((s) => c.start < s.end && s.start < c.end - 1);
      expect(ch[i].loud).toBeGreaterThanOrEqual(0.75);
    }
    for (const c of show.clips.filter((x) => x.track === 0 && x.end <= 60.8)) expect(quietBases).toContain(c.widget);
  });

  it('gives a silent recording one quiet clip, whatever the analysis says', () => {
    for (const every of [90, 10]) {
      const show = composeShow(input(makePack({ duration: 90, every, parts: [] })));
      expect(show.clips).toEqual([{ id: 'c1', start: 0, end: 90, track: 0, widget: 'horizon' }]);   // the quietest base still loved or kept
    }
  });

  it('never uses a widget that is not loved or kept, nor one missing from the collection', () => {
    const w = new Map(widgets);
    w.set('current', { ...w.get('current')!, verdict: { v: 'drop', on: 'v3' } });
    w.set('strings', { ...w.get('strings')!, verdict: { v: 'needs work', on: 'v2' } });
    w.set('fields', { ...w.get('fields')!, verdict: null });
    w.delete('casket');
    const used = new Set<string>();
    for (const pack of [quietLoud(), makePack({ duration: 90, parts: [] })]) {
      for (const c of composeShow(input(pack, w)).clips) used.add(c.widget);
    }
    for (const id of ['current', 'strings', 'fields', 'casket']) expect(used.has(id), id).toBe(false);
    expect(used.size).toBeGreaterThan(0);
  });

  it('composes a 600 s pack with 80 analysis sections in well under a second', () => {
    const pack = makePack({ duration: 600, every: 7.5, parts: [{ from: 0, to: 600, rate: 15, vel: 90, register: 'mid', poly: 1 }] });
    expect(pack.sections.length).toBe(80);
    expect(groupChords(pack.notes).length).toBe(9000);
    const t0 = performance.now();
    const show = composeShow(input(pack));
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(show.clips.length).toBeLessThanOrEqual(80);
    expect(validateShow(show, { duration: 600, widgets }).errors).toEqual([]);
  });
});
