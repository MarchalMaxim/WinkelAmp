import { describe, expect, it } from 'vitest';
import { isChecking, settleEars } from '../src/studio/ingest/ears-client';
import { CHECKING_TRANSCRIBER, type TranscriberStatus } from '../src/studio/ingest/ears-types';
import { freeId, nameFromFile } from '../src/studio/ingest/names';
import { etaWords, MS_YMT3_SHARE, overallOf, overallProgress, stageWeights } from '../src/studio/ingest/progress';

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
  it('weights the stages, each transcriber included only when it runs', () => {
    // All five: decode .03, transcribe .3, instruments .3, analyze .32, write .05 (of 1).
    expect(overallProgress('decode', 0, true, true)).toBe(0);
    expect(overallProgress('decode', 1, true, true)).toBeCloseTo(0.03);
    expect(overallProgress('transcribe', 0.5, true, true)).toBeCloseTo(0.18);
    expect(overallProgress('instruments', 0.5, true, true)).toBeCloseTo(0.48);
    expect(overallProgress('analyze', 0, true, true)).toBeCloseTo(0.63);
    expect(overallProgress('write', 1, true, true)).toBeCloseTo(1);
    // The piano model only: decode .03, transcribe .3, analyze .32, write .05 of 0.7.
    expect(overallProgress('transcribe', 1, true)).toBeCloseTo(0.33 / 0.7);
    expect(overallProgress('instruments', 1, true)).toBeCloseTo(0.33 / 0.7);
    // No transcriber: decode .03, analyze .32, write .05 of 0.4.
    expect(overallProgress('decode', 1, false)).toBeCloseTo(0.075);
    expect(overallProgress('transcribe', 1, false)).toBeCloseTo(0.075);
    expect(overallProgress('analyze', 0.5, false)).toBeCloseTo(0.475);
    expect(overallProgress('done', 0, false)).toBe(1);
  });
  it('never goes back from one stage to the next, whichever stages run', () => {
    for (const [gpu, inst] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      let last = 0;
      for (const s of ['decode', 'transcribe', 'instruments', 'analyze', 'write'] as const) {
        for (const f of [0, 0.5, 1]) {
          const v = overallProgress(s, f, gpu, inst);
          expect(v).toBeGreaterThanOrEqual(last);
          last = v;
        }
      }
      expect(last).toBeCloseTo(1);
    }
  });
  it('clamps a bad fraction', () => {
    expect(overallProgress('analyze', 7, true)).toBeCloseTo(0.65 / 0.7);
    expect(overallProgress('analyze', Number.NaN, true)).toBeCloseTo(0.33 / 0.7);
  });
});

describe('a long MuScriptor run', () => {
  it('weighs a long run towards the instruments', () => {
    const w = stageWeights({ transcribe: true, instruments: true, long: true });
    expect(w).toEqual({ decode: 0.01, transcribe: 0.05, instruments: 0.85, analyze: 0.07, write: 0.02 });
    // Half of MuScriptor's chunks are about half of the job, not a quarter as with the usual weights.
    const halfway = overallOf(w, 'instruments', MS_YMT3_SHARE + (1 - MS_YMT3_SHARE) / 2);
    expect(halfway).toBeGreaterThan(0.5);
    expect(halfway).toBeLessThan(0.6);
    // What does not run takes no share, and without `long` nothing changes.
    expect(stageWeights({ transcribe: false, instruments: true, long: true }).transcribe).toBe(0);
    expect(stageWeights({ transcribe: true, instruments: true })).toEqual({ decode: 0.03, transcribe: 0.3, instruments: 0.3, analyze: 0.32, write: 0.05 });
    expect(MS_YMT3_SHARE).toBe(0.15);
  });

  it('words the time left', () => {
    expect(etaWords(34, 122, 280)).toBe('about 12 min left');
    expect(etaWords(121, 122, 1200)).toBe('under a minute left');
    expect(etaWords(122, 122, 1200)).toBe('under a minute left');
    expect(etaWords(1, 122, 30)).toBe('about 61 min left');
    // Nothing to go on yet.
    expect(etaWords(0, 122, 30)).toBe('working out the time left');
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
