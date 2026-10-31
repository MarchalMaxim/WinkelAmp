import { describe, expect, it } from 'vitest';
import { firstAtOrAfter, groupChords, soundingAt } from '../src/widgets/chords';
import type { Note } from '../src/widgets/types';

describe('groupChords (the lab: within 40 ms of the chord FIRST note)', () => {
  const notes: Note[] = [[1, 2, 60, 80], [1.03, 2, 64, 90], [1.039, 1.5, 67, 70], [1.045, 2, 72, 60], [1.07, 2, 48, 50]];
  const ch = groupChords(notes);

  it('splits at 40 ms from the first note, not the last', () => {
    expect(ch.length).toBe(2);
    expect(ch[0]).toMatchObject({ t: 1, vel: 90, lo: 60, hi: 67 });
    expect(ch[0].notes.length).toBe(3);
    expect(ch[0].notes[1].d).toBeCloseTo(0.97, 9);
    expect(ch[1]).toMatchObject({ t: 1.045, lo: 48, hi: 72 });
    expect(ch[1].notes.length).toBe(2);
  });

  it('notes exactly 40 ms apart are two chords', () => {
    expect(groupChords([[0, 1, 60, 80], [0.04, 1, 62, 80]]).length).toBe(2);
  });

  it('keeps note order inside a chord', () => {
    expect(ch[0].notes.map((n) => n.m)).toEqual([60, 64, 67]);
  });
});

describe('soundingAt / firstAtOrAfter', () => {
  it('looks back only 8 s, as the lab does', () => {
    expect(soundingAt([[0, 20, 40, 90]], 10)).toEqual([]);
    expect(soundingAt([[3, 20, 40, 90]], 10)).toEqual([{ m: 40, v: 90, start: 3, end: 20 }]);
  });

  it('includes a note starting at t and excludes one ending at t', () => {
    expect(soundingAt([[1, 2, 60, 80], [2, 3, 62, 70]], 2)).toEqual([{ m: 62, v: 70, start: 2, end: 3 }]);
  });

  it('firstAtOrAfter is the lower bound on start', () => {
    const n: Note[] = [[0, 1, 60, 1], [1, 2, 60, 1], [1, 2, 62, 1], [2, 3, 60, 1]];
    expect(firstAtOrAfter(n, -1)).toBe(0);
    expect(firstAtOrAfter(n, 1)).toBe(1);
    expect(firstAtOrAfter(n, 1.5)).toBe(3);
    expect(firstAtOrAfter(n, 9)).toBe(4);
  });
});
