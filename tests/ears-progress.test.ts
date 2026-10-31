import { describe, expect, it } from 'vitest';
import { freeId, nameFromFile } from '../src/studio/ingest/names';
import { overallProgress } from '../src/studio/ingest/progress';

describe('nameFromFile', () => {
  it("follows the study tool's rule", () => {
    expect(nameFromFile('Prelude_in C#.mp3')).toEqual({ id: 'prelude-in-c', title: 'Prelude In C#' });
    expect(nameFromFile('C:\\music\\Beethoven 5 - I.flac')).toEqual({ id: 'beethoven-5-i', title: 'Beethoven 5 I' });
    expect(nameFromFile('/x/y/a.wav').id).toBe('a');
  });
  it('gives an empty id when the name has no letters or digits (callers pick a fallback)', () => {
    expect(nameFromFile('!!!.mp3').id).toBe('');
  });
});

describe('freeId', () => {
  it('keeps a free id, else counts on from -2', () => {
    const taken = new Set(['a', 'a-2', 'b']);
    expect(freeId('c', (id) => taken.has(id))).toBe('c');
    expect(freeId('a', (id) => taken.has(id))).toBe('a-3');
    expect(freeId('b', (id) => taken.has(id))).toBe('b-2');
  });
});

describe('overallProgress', () => {
  it('weights the stages, transcribe included only with the GPU', () => {
    expect(overallProgress('decode', 0, true)).toBe(0);
    expect(overallProgress('decode', 1, true)).toBeCloseTo(0.05);
    expect(overallProgress('transcribe', 0.5, true)).toBeCloseTo(0.3);
    expect(overallProgress('analyze', 0, true)).toBeCloseTo(0.55);
    expect(overallProgress('write', 1, true)).toBeCloseTo(1);
    // Without the GPU: decode .05, analyze .4, write .05 of 0.5.
    expect(overallProgress('decode', 1, false)).toBeCloseTo(0.1);
    expect(overallProgress('transcribe', 1, false)).toBeCloseTo(0.1);
    expect(overallProgress('analyze', 0.5, false)).toBeCloseTo(0.5);
    expect(overallProgress('done', 0, false)).toBe(1);
  });
  it('clamps a bad fraction', () => {
    expect(overallProgress('analyze', 7, true)).toBeCloseTo(0.95);
    expect(overallProgress('analyze', Number.NaN, true)).toBeCloseTo(0.55);
  });
});
