/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
// @ts-expect-error plain .mjs without types
import { SONGS, KINDS, buildCopies, serialise } from '../scripts/snap-shows.mjs';
import { validateShow, type Show } from '../src/studio/show/show';

const widgets = loadCatalogue().widgets;
const keysOf = (id: string): string[] => widgets.get(id)?.params.map((p) => p.key) ?? [];
const read = (f: string): string => readFileSync(new URL(`../shows/${f}`, import.meta.url), 'utf8');
const original = (song: string): Show => JSON.parse(read(`${song}.json`)) as Show;

describe('snap show copies', () => {
  for (const song of SONGS as string[]) {
    const orig = original(song);
    const copies = buildCopies(orig, keysOf) as Record<string, { show: Show; log: string[] }>;
    for (const kind of KINDS as string[]) {
      const { show } = copies[kind];

      it(`${song}-${kind} validates with no errors and no new warnings, and is named by its file`, () => {
        expect(show.id).toBe(`${song}-${kind}`);
        expect(show.song).toBe(orig.song);
        const v = validateShow(show, { widgets });
        expect(v.errors).toEqual([]);
        expect(v.warnings).toEqual(validateShow(orig, { widgets }).warnings);   // only what the original already says (picks p9 notes past their clip)
      });

      it(`${song}-${kind} keeps every clip's time, track, listen and fade`, () => {
        expect(show.clips.map((c) => [c.id, c.start, c.end, c.track, c.listen, c.fade])).toEqual(orig.clips.map((c) => [c.id, c.start, c.end, c.track, c.listen, c.fade]));
        expect(show.picks).toEqual(orig.picks);
      });

      it(`${song}-${kind} is what is on disk (rerun scripts/snap-shows.mjs if not)`, () => {
        expect(read(`${song}-${kind}.json`)).toBe(serialise(show));
      });
    }

    it(`${song}: the generator leaves the original untouched`, () => {
      const before = JSON.stringify(orig);
      buildCopies(orig, keysOf);
      expect(JSON.stringify(orig)).toBe(before);
    });
  }

  it('a knob stored with a drive keeps the drive and takes the new base', () => {
    const { show } = buildCopies(original('rach-concerto-2'), keysOf).knobs;
    expect(show.clips.find((c: { id: string; knobs?: Record<string, unknown> }) => c.id === 'c14')!.knobs!.linger).toEqual({ base: 0.2, drive: '+density' });
  });

  it('the new widgets land on the picks the design names', () => {
    const l = buildCopies(original('liebesleid'), keysOf).new.show.clips;
    const w = (id: string) => l.find((c: { id: string }) => c.id === id)!;
    expect(w('c10').widget).toBe('hammer');
    expect(w('c10').knobs).toEqual({ roll: 1 });
    expect(w('c19').widget).toBe('handover');
    expect(w('c23').widget).toBe('blade');
    const r = buildCopies(original('rach-concerto-2'), keysOf).new.show.clips;
    expect(r.find((c: { id: string; knobs?: Record<string, unknown> }) => c.id === 'c21')!.knobs).toEqual({ touch: 0 });
  });
});
