import { describe, expect, it } from 'vitest';
import { estimateWords, lanesOutside, listOf, msEstimate, redoQuery, savedFor, SAVED_WORDS } from '../src/studio/ingest/transcribe-options';
import { listKey, MS_PRESETS } from '../src/studio/pack/muscriptor';

const OK = { ok: true, python: 'py' }, NOT_OK = { ok: false, python: null, reason: 'no' };

describe('the time a redo takes', () => {
  it('states the time for a 12-minute piece', () => {
    expect(estimateWords('ymt3', 720, false)).toBe('about 2 to 3 min');
    expect(estimateWords('muscriptor', 720, false)).toBe('8 to 22 min on the GPU');
  });

  it('says when it is saved', () => {
    expect(estimateWords('ymt3', 720, true)).toBe('under a minute (saved)');
    expect(estimateWords('muscriptor', 720, true)).toBe('under a minute (saved)');
  });

  it('never says "0 to 1 min" of a short piece', () => {
    expect(estimateWords('ymt3', 30, false)).toBe('under a minute');
    expect(estimateWords('muscriptor', 10, false)).toBe('under a minute on the GPU');
    expect(estimateWords('muscriptor', 30, false)).toBe('about 1 min on the GPU');
    expect(estimateWords('ymt3', 240, false)).toBe('about 1 min');
  });

  it('adds YourMT3+ to a MuScriptor run when it has to run first', () => {
    const ch = { duration: 720, ymt3: OK, ymt3Saved: true };
    expect(msEstimate(ch, false)).toBe('8 to 22 min on the GPU');
    expect(msEstimate(ch, true)).toBe(SAVED_WORDS);
    expect(msEstimate({ ...ch, ymt3Saved: false }, false)).toBe('8 to 22 min on the GPU, plus about 2 to 3 min for YourMT3+');
    expect(msEstimate({ ...ch, ymt3Saved: false }, true)).toBe("about 2 to 3 min for YourMT3+; MuScriptor's notes are saved");
    expect(msEstimate({ ...ch, ymt3Saved: false, ymt3: NOT_OK }, true)).toBe(SAVED_WORDS);
  });
});

describe('the query of a redo', () => {
  it('builds the query', () => {
    const q = new URLSearchParams(redoQuery('a', { engine: 'muscriptor', instruments: 'violin, viola' }));
    expect(redoQuery('a', { engine: 'muscriptor', instruments: 'violin, viola' })).toContain('instruments=violin%2C%20viola');
    expect(q.get('redo')).toBe('1');
    expect(q.get('engine')).toBe('muscriptor');
    expect(q.get('instruments')).toBe('violin, viola');
    expect(q.has('overnight')).toBe(false);
    expect(redoQuery('a', { engine: 'ymt3' })).toBe('id=a&redo=1&engine=ymt3');
  });

  it('asks for the overnight file only when chosen', () => {
    expect(redoQuery('a', { engine: 'muscriptor', instruments: 'baroque', overnight: true })).toBe('id=a&redo=1&engine=muscriptor&instruments=baroque&overnight=1');
  });
});

describe('what the dialog checks', () => {
  it('finds a saved result by its list', () => {
    const ch = { saved: [{ key: listKey(MS_PRESETS.strings), instruments: MS_PRESETS.strings, notes: 1, seconds: 1 }] };
    expect(savedFor(ch, MS_PRESETS.strings)).toBe(true);
    expect(savedFor(ch, MS_PRESETS.baroque)).toBe(false);
  });

  it('names the overnight lanes a list lacks, as class names', () => {
    expect(lanesOutside(['violin', 'acoustic_piano'], MS_PRESETS.baroque)).toEqual([]);
    expect(lanesOutside(['violin', 'acoustic_piano'], MS_PRESETS.strings)).toEqual(['acoustic_piano']);
    expect(lanesOutside(['French Horn'], ['french_horn'])).toEqual([]);
  });

  it('reads a preset or a list, and nothing else', () => {
    expect(listOf('strings')).toEqual(MS_PRESETS.strings);
    expect(listOf('violin, viola')).toEqual(['violin', 'viola']);
    expect(listOf('string_ensemble')).toBeNull();
    expect(listOf('')).toBeNull();
  });
});
