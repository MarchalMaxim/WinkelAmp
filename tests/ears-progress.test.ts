import { describe, expect, it } from 'vitest';
import { isChecking, settleEars } from '../src/studio/ingest/ears-client';
import { CHECKING_TRANSCRIBER, type TranscriberStatus } from '../src/studio/ingest/ears-types';
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

describe('settleEars', () => {
  const checking: TranscriberStatus = { ok: false, python: null, device: null, reason: CHECKING_TRANSCRIBER };
  const ready: TranscriberStatus = { ok: true, python: 'py', device: 'cuda' };
  const answers = (...xs: (TranscriberStatus | null)[]) => { let i = 0; return async () => xs[Math.min(i++, xs.length - 1)]; };
  const noWait = async () => {};

  it('reads the server still checking its transcriber as pending, not as unavailable', () => {
    expect(isChecking(checking)).toBe(true);
    expect(isChecking({ ok: false, python: null, device: null, reason: 'no python' })).toBe(false);
    expect(isChecking(ready)).toBe(false);
    expect(isChecking(null)).toBe(false);
  });

  it('asks again while the server is checking, and resolves with the verdict', async () => {
    const seen: (TranscriberStatus | null)[] = [];
    const t = await settleEars(answers(checking, checking, ready), { sleep: noWait, onAnswer: (x) => seen.push(x) });
    expect(t).toEqual(ready);
    expect(seen).toEqual([checking, checking, ready]);
  });

  it('resolves at once with a settled answer or a server that is not there', async () => {
    let calls = 0;
    expect(await settleEars(async () => { calls++; return null; }, { sleep: noWait })).toBeNull();
    expect(calls).toBe(1);
    expect(await settleEars(answers(checking, null), { sleep: noWait })).toBeNull();
  });

  it('gives up after its limit, still checking', async () => {
    let now = 0;
    const t = await settleEars(answers(checking), { intervalMs: 500, limitMs: 2000, sleep: async (ms) => { now += ms; }, now: () => now });
    expect(isChecking(t)).toBe(true);
    expect(now).toBe(2000);
  });
});
