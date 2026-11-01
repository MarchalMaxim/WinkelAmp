import { describe, expect, it } from 'vitest';
import {
  canonicalShow, instanceKey, isListen, picksId, picksListen, repairPickNotes, repairShow, usesV2, validateShow,
  type Issue, type Show, type ShowContext,
} from '../src/studio/show/show';
import type { Note } from '../src/widgets/types';

const base = (): Show => ({
  version: 1, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, layers: [{ widget: 'strings' }] },
    { start: 10, end: 20, fade: 2, layers: [{ widget: 'squares' }] },
  ],
});
const NOTES: Note[] = [[1, 2, 60, 80], [12, 13, 64, 90]];
/** base() with a set p1, heard by a pointillism layer in both sections. */
const picked = (notes: unknown = NOTES): Show => {
  const s = base(); s.version = 2;
  for (const x of s.sections) x.layers.push({ widget: 'pointillism', listen: 'picks:p1' });
  (s as { picks?: unknown }).picks = { p1: { notes } };
  return s;
};
const at = (list: Issue[], path: string) => list.filter((i) => i.path === path);
const C: ShowContext = { duration: 20, tracks: [] };
const errs = (x: unknown) => validateShow(x, C).errors;
const warns = (x: unknown) => validateShow(x, C).warnings;

describe('picks: the listen', () => {
  it('isListen takes picks:<slug>, and nothing else of that form', () => {
    expect(isListen('picks:p1')).toBe(true);
    for (const x of ['picks:', 'picks:P 1', 'picks:p_1', 'picks:P1', 'picks']) expect(isListen(x)).toBe(false);
  });

  it('picksId reads the id back; picksListen writes it; anything else is null', () => {
    expect(picksId('picks:p1')).toBe('p1');
    expect(picksListen('p1')).toBe('picks:p1');
    for (const x of ['melody', 'picks:', 'picks:P 1', undefined, 3, null]) expect(picksId(x)).toBeNull();
  });

  it('is its own instance', () => {
    expect(instanceKey({ widget: 'pointillism', listen: 'picks:p1' })).toBe('pointillism@picks:p1');
  });
});

describe('picks: the file', () => {
  it('shows without picks keep their bytes', () => {
    const s = base();
    expect(canonicalShow({ ...s, picks: {} })).toBe(canonicalShow(s));
    expect(usesV2({ ...s, picks: {} })).toBe(false);
    expect(JSON.parse(canonicalShow({ ...s, picks: {} })).version).toBe(1);
  });

  it('a set makes it version 2 even with no layer on it', () => {
    const s = { ...base(), picks: { p1: { notes: NOTES } } };
    expect(usesV2(s)).toBe(true);
    expect(JSON.parse(canonicalShow(s)).version).toBe(2);
  });

  it('picks come after sections, a note a line, numbers to 4 decimals, and it reads back the same', () => {
    const out = canonicalShow(picked([[1.23456, 2.00004, 60, 80], [12, 13, 64, 90]]));
    expect(out.indexOf('"picks"')).toBeGreaterThan(out.indexOf('"sections"'));
    expect(out).toMatch(/\n {8}\[1\.2346, 2, 60, 80\],\n/);
    expect(out).toMatch(/\n {8}\[12, 13, 64, 90\]\n/);
    expect(canonicalShow(JSON.parse(out) as Show)).toBe(out);
    expect(JSON.parse(out).picks).toEqual({ p1: { notes: [[1.2346, 2, 60, 80], [12, 13, 64, 90]] } });
  });

  it('pivots and picks in one show each go back on their own line', () => {
    const s = picked();
    s.sections[0].layers[0].intensity = [{ t: 0, v: 0.5 }];
    const out = canonicalShow(s);
    expect(out).toMatch(/\{ "t": 0, "v": 0\.5 \}/);
    expect(out).toMatch(/\[1, 2, 60, 80\]/);
    expect(out).not.toMatch(/u0000/);
    expect(canonicalShow(JSON.parse(out) as Show)).toBe(out);
  });
});

describe('picks: validation', () => {
  it('a valid set and layer: no errors and no warnings', () => {
    expect(validateShow(picked(), C)).toEqual({ errors: [], warnings: [] });
  });

  it('picks: not an object', () => {
    expect(at(errs({ ...base(), picks: [1] }), 'picks')[0].message).toMatch(/not an object/);
  });

  it('picks.<id>: the id is not a slug, or the set not an object', () => {
    expect(at(errs({ ...base(), picks: { 'P 1': { notes: NOTES } } }), 'picks.P 1')[0].message).toMatch(/slug/);
    expect(at(errs({ ...base(), picks: { p1: 3 } }), 'picks.p1')[0].message).toMatch(/not a set/);
  });

  it('picks.<id>.notes: not a list, empty, not sorted', () => {
    expect(at(errs(picked(3)), 'picks.p1.notes')[0].message).toMatch(/not a list/);
    expect(at(errs(picked([])), 'picks.p1.notes')[0].message).toMatch(/no notes/);
    expect(at(errs(picked([NOTES[1], NOTES[0]])), 'picks.p1.notes')[0].message).toMatch(/sorted/);
  });

  it('picks.<id>.notes[i]: not a note, ends before it starts, midi or velocity outside 0..127', () => {
    const bad = (n: unknown) => at(errs(picked([n])), 'picks.p1.notes[0]')[0]?.message;
    expect(bad('x')).toMatch(/not \[start, end, midi, velocity\]/);
    expect(bad([1, 2, 60])).toMatch(/not \[start, end, midi, velocity\]/);
    expect(bad([1, 2, 60, '80'])).toMatch(/not \[start, end, midi, velocity\]/);
    expect(bad([2, 1, 60, 80])).toMatch(/before/);
    expect(bad([1, 2, 128, 80])).toMatch(/midi/);
    expect(bad([1, 2, -1, 80])).toMatch(/midi/);
    expect(bad([1, 2, 60, 128])).toMatch(/velocity/);
  });

  it('a layer on a set that is not there: an error at its listen', () => {
    const s = base(); s.sections[0].layers[0].listen = 'picks:x';
    expect(at(errs(s), 'sections[0].layers[0].listen')[0].message).toMatch(/no set/);
    expect(at(errs(s), 'sections[0].layers[0].listen')[0].message).toMatch(/picks:x/);
  });

  it('the message of something that is not a part names picks:<id>', () => {
    const s = base(); s.sections[0].layers[0].listen = 'drums';
    expect(at(errs(s), 'sections[0].layers[0].listen')[0].message).toMatch(/picks:<id>/);
  });

  it('warns on a set no layer uses', () => {
    const w = at(warns({ ...base(), picks: { p1: { notes: NOTES } } }), 'picks.p1');
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/no layer/);
  });

  it('warns on picks outside every section using the set: never heard', () => {
    const s = picked(); s.sections[1].layers.pop();
    const w = at(warns(s), 'picks.p1.notes[1]');
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/never heard/);
    expect(at(warns(s), 'picks.p1.notes[0]')).toEqual([]);
  });

  it('a pick on a boundary belongs to the section it starts', () => {
    const s = picked([[10, 11, 60, 80]]); s.sections[1].layers.pop();
    expect(at(warns(s), 'picks.p1.notes[0]')).toHaveLength(1);
  });

  it('an unknown property of a set is a typo warning', () => {
    const s = picked(); (s as unknown as { picks: { p1: Record<string, unknown> } }).picks.p1.note = 1;
    expect(at(warns(s), 'picks.p1.note')).toHaveLength(1);
  });
});

describe('picks: repair', () => {
  const clean = (s: Show) => {
    const r = repairShow(s, C);
    expect(validateShow(r.show, C).errors).toEqual([]);
    return r;
  };

  it('a dangling listen: the layer goes, it never becomes the plain widget', () => {
    const s = base(); s.sections[0].layers.push({ widget: 'pointillism', listen: 'picks:x' });
    const r = clean(s);
    expect(r.show.sections[0].layers.map((l) => l.widget)).toEqual(['strings']);
    expect(r.fixed.find((f) => f.path === 'sections[0].layers[1]')?.message).toMatch(/dropped/);
  });

  it('a malformed picks listen goes the same way', () => {
    for (const listen of ['picks:', 'picks:P 1']) {
      const s = base(); s.sections[0].layers.push({ widget: 'pointillism', listen });
      expect(clean(s).show.sections[0].layers.map((l) => l.widget)).toEqual(['strings']);
    }
  });

  it('unsorted notes are sorted, and says so', () => {
    const r = clean(picked([NOTES[1], NOTES[0]]));
    expect(r.show.picks!.p1.notes).toEqual(NOTES);
    expect(r.fixed.find((f) => f.path === 'picks.p1.notes')?.message).toMatch(/sorted/);
  });

  it('malformed notes are dropped, and says so', () => {
    const r = clean(picked(['x', NOTES[0], [2, 1, 60, 80], [1, 2, 200, 80], NOTES[1]]));
    expect(r.show.picks!.p1.notes).toEqual(NOTES);
    expect(r.fixed.filter((f) => /dropped/.test(f.message)).map((f) => f.path)).toEqual(['picks.p1.notes[0]', 'picks.p1.notes[2]', 'picks.p1.notes[3]']);
  });

  it('a set left empty goes with its layers', () => {
    const r = clean(picked(['x']));
    expect(r.show.picks).toBeUndefined();
    expect(r.show.sections.map((x) => x.layers.map((l) => l.widget))).toEqual([['strings'], ['squares']]);
  });

  it('a set under a bad id goes with its layers', () => {
    const s = picked(); (s as { picks?: unknown }).picks = { 'P 1': { notes: NOTES } };
    expect(clean(s).show.picks).toBeUndefined();
  });

  it('picks that are not an object go', () => {
    const s = picked(); (s as { picks?: unknown }).picks = 3;
    const r = clean(s);
    expect(r.show.picks).toBeUndefined();
    expect(r.show.sections[0].layers.map((l) => l.widget)).toEqual(['strings']);
  });

  it('an unused set stays, for its warning', () => {
    const r = clean({ ...base(), picks: { p1: { notes: NOTES } } });
    expect(r.show.picks).toEqual({ p1: { notes: NOTES } });
    expect(r.fixed).toEqual([]);
  });

  it('a good show is left alone', () => {
    const r = clean(picked());
    expect(r.fixed).toEqual([]);
    expect(canonicalShow(r.show)).toBe(canonicalShow(picked()));
  });

  it('repairPickNotes: to 4 decimals, stable by start, the input untouched', () => {
    const a: Note = [1.00004, 2, 60, 80], b: Note = [1.00001, 2, 61, 80], c: Note = [0.5, 1, 62, 80];
    const input = [a, b, c];
    expect(repairPickNotes(input)).toEqual([[0.5, 1, 62, 80], [1, 2, 60, 80], [1, 2, 61, 80]]);
    expect(input).toEqual([a, b, c]);
    expect(repairPickNotes(3)).toEqual([]);
  });
});
