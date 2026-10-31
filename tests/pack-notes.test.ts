import { describe, expect, it } from 'vitest';
import { approximateNotes, mergeNotes, onsetCoverage, parseNotesFile } from '../src/studio/pack/notes';
import type { Note } from '../src/widgets/types';

describe('parseNotesFile', () => {
  it("reads the lab's notes.js, keeping the order", () => {
    expect(parseNotesFile('window.NOTES=[[5.198,7.0057,57,103],[5.2005,6.9941,45,110]];')).toEqual([
      [5.198, 7.0057, 57, 103],
      [5.2005, 6.9941, 45, 110],
    ]);
  });
  it("reads transcribe.py's JSON and a bare array of note objects", () => {
    expect(parseNotesFile('{"version":1,"notes":[{"start":1,"end":2,"midi":60,"vel":80}]}')).toEqual([[1, 2, 60, 80]]);
    expect(parseNotesFile('[{"start":1,"end":2,"midi":60,"vel":80}]')).toEqual([[1, 2, 60, 80]]);
    expect(parseNotesFile('[[1,2,60,80]]')).toEqual([[1, 2, 60, 80]]);
  });
  it('throws on garbage, naming notes', () => {
    expect(() => parseNotesFile('hello')).toThrow(/notes/);
    expect(() => parseNotesFile('[[1,2,"x",80]]')).toThrow(/notes/);
    expect(() => parseNotesFile('{"a":1}')).toThrow(/notes/);
  });
});

describe('approximateNotes', () => {
  const melody = [{ start: 0.98, end: 1.6, midi: 72.2, strength: 0.5, confidence: 0.8 }];
  const harmony = [{ t: 0, root: 1, minor: true }];

  it('gives the top, bass and middle notes of a strong onset', () => {
    expect(approximateNotes({ onsets: [{ t: 1, s: 0.8 }], melody, harmony, duration: 10 })).toEqual([
      [1, 3, 37, 92],
      [1, 2, 64, 82],
      [1, 1.6, 72, 102],
    ]);
  });
  it('gives only the top note for a weak onset', () => {
    expect(approximateNotes({ onsets: [{ t: 1, s: 0.3 }], melody, harmony, duration: 10 })).toEqual([[1, 1.6, 72, 57]]);
  });
  it('keeps a melody note no onset explains', () => {
    const m = [{ start: 3, end: 3.5, midi: 66.6, strength: 0.4, confidence: 0.8 }];
    expect(approximateNotes({ onsets: [{ t: 2.6, s: 0.3 }], melody: m, harmony: [], duration: 10 })).toEqual([[3, 3.5, 67, 58]]);
  });
  it('without harmony there is no bass or middle', () => {
    expect(approximateNotes({ onsets: [{ t: 1, s: 0.9 }], melody: [], harmony: [], duration: 10 })).toEqual([]);
  });
  it('ends the bass at the next chord change and clamps to the duration', () => {
    const h = [{ t: 0, root: 0, minor: false }, { t: 1.5, root: 7, minor: false }];
    const out = approximateNotes({ onsets: [{ t: 1, s: 0.5 }, { t: 9.5, s: 0.5 }], melody: [], harmony: h, duration: 10 });
    expect(out).toEqual([
      [1, 1.5, 36, 68],
      [9.5, 10, 43, 68],
    ]);
  });
});

describe('onsetCoverage and mergeNotes', () => {
  it('is the share of strong onsets with a note start within 60 ms', () => {
    const onsets = [1, 2, 3, 4].map((t) => ({ t, s: 0.5 }));
    const notes: Note[] = [[1.02, 1.5, 60, 80], [2.5, 3, 62, 80]];
    expect(onsetCoverage(notes, onsets)).toBe(0.25);
    expect(onsetCoverage(notes, [{ t: 1, s: 0.1 }])).toBe(1);
    expect(onsetCoverage([], [])).toBe(1);
  });
  it('keeps every gpu note and adds only approximate notes away from all of them', () => {
    const gpu: Note[] = [[1, 2, 60, 80], [3, 4, 62, 70]];
    const approx: Note[] = [[1.05, 2, 40, 50], [2, 3, 41, 50], [2.95, 3.5, 42, 50], [5, 6, 43, 50]];
    expect(mergeNotes(gpu, approx)).toEqual([[1, 2, 60, 80], [2, 3, 41, 50], [3, 4, 62, 70], [5, 6, 43, 50]]);
  });
});
