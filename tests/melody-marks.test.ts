import { describe, expect, it } from 'vitest';
import { canonicalMelody, emptyMelody, matchMarks, validateMelody, type Mark, type Melody } from '../src/studio/show/melody';

const MELODY: Melody = { version: 1, song: 'demo', notes: [[12, 13, 64, 90, 'violin'], [1.23456, 2.00004, 60, 80]] };

describe('a melody file', () => {
  it('starts empty', () => {
    expect(emptyMelody('demo')).toEqual({ version: 1, song: 'demo', notes: [] });
    expect(validateMelody(emptyMelody('demo'))).toEqual([]);
  });

  it('canonicalMelody: a note a line, 4 decimals, sorted by start, a final newline, stable', () => {
    const out = canonicalMelody(MELODY);
    expect(out).toBe('{\n  "version": 1,\n  "song": "demo",\n  "notes": [\n    [1.2346, 2, 60, 80],\n    [12, 13, 64, 90, "violin"]\n  ]\n}\n');
    expect(canonicalMelody(JSON.parse(out) as Melody)).toBe(out);
    expect(MELODY.notes[0][0]).toBe(12);   // the input is not touched
  });

  it('canonicalMelody of none is one short block', () => {
    expect(canonicalMelody(emptyMelody('demo'))).toBe('{\n  "version": 1,\n  "song": "demo",\n  "notes": []\n}\n');
  });

  it('validateMelody says what is wrong, with the path', () => {
    const paths = (x: unknown) => validateMelody(x).map((i) => i.path);
    expect(validateMelody(MELODY)).toEqual([]);
    expect(paths(3)).toEqual(['']);
    expect(paths({ ...MELODY, version: 2 })).toEqual(['version']);
    expect(paths({ ...MELODY, song: 'Bad Id' })).toEqual(['song']);
    expect(paths({ ...MELODY, notes: 3 })).toEqual(['notes']);
    for (const bad of ['x', [1, 2, 60], [1, 2, 60, '80'], [2, 1, 60, 80], [1, 2, 128, 80], [1, 2, 60, -1], [1, 2, 60, 80, 7], [1, 2, 60, 80, 'x', 'y']]) {
      expect(paths({ ...MELODY, notes: [bad] })).toEqual(['notes[0]']);
    }
  });
});

describe('matchMarks', () => {
  const m = (t: number, midi = 60, track?: string): Mark => (track === undefined ? [t, t + 1, midi, 80] : [t, t + 1, midi, 80, track]);

  it('finds a note within 50 ms at the pitch, not beyond and not at another pitch', () => {
    expect(matchMarks([m(10)], [m(10.049)]).matched.get(0)).toBe(0);
    expect(matchMarks([m(10)], [m(10.051)]).unmatched).toEqual([0]);
    expect(matchMarks([m(10)], [m(9.951)]).matched.get(0)).toBe(0);
    expect(matchMarks([m(10)], [m(10, 61)]).unmatched).toEqual([0]);
  });

  it('takes the nearest', () => {
    expect(matchMarks([m(10)], [m(10.03), m(9.99), m(10.02)]).matched.get(0)).toBe(1);
  });

  it('prefers the same track over a nearer one on another', () => {
    const notes = [m(10, 60, 'cello'), m(10.04, 60, 'violin')];
    expect(matchMarks([m(10, 60, 'violin')], notes).matched.get(0)).toBe(1);
    expect(matchMarks([m(10, 60, 'cello')], notes).matched.get(0)).toBe(0);
    expect(matchMarks([m(10, 60, 'flute')], notes).matched.get(0)).toBe(0);   // no note on its track: the nearest
  });

  it('takes a note once', () => {
    const r = matchMarks([m(10), m(10.01)], [m(10)]);
    expect([...r.matched]).toEqual([[0, 0]]);
    expect(r.unmatched).toEqual([1]);
  });

  it('lists the unmatched in order, and changes neither list', () => {
    const marks = Object.freeze([m(1), m(5), m(9), m(7, 61)]) as readonly Mark[], notes = Object.freeze([m(5)]) as readonly Mark[];
    const r = matchMarks(marks, notes);
    expect(r.unmatched).toEqual([0, 2, 3]);
    expect([...r.matched]).toEqual([[1, 0]]);
  });

  it('takes another window', () => {
    expect(matchMarks([m(10)], [m(10.1)], 0.2).matched.get(0)).toBe(0);
  });
});
