import { describe, expect, it } from 'vitest';
import { trackOf } from '../src/studio/pack/instruments';
import { guessPreset, hasKeyboard, listKey, loopCheck, mapMsRows, MS_CLASS, MS_PRESETS, resolveInstruments } from '../src/studio/pack/muscriptor';
import { cleanRows, type Ymt3Row } from '../src/studio/pack/tracks';

const row = (start: number, midi = 60, name = 'violin', len = 0.2): (string | number)[] => [start, start + len, midi, 100, name];
/** `chunks` 5 s chunks with a few plain notes each. */
const plainChunks = (chunks: number) => Array.from({ length: chunks }, (_, c) => [row(c * 5 + 1, 60), row(c * 5 + 3, 64)]).flat();
/** One pitch's starts at a fixed rate through one 5 s chunk: what a stuck decoder writes. */
const burst = (chunk: number, gap = 0.12) => Array.from({ length: Math.floor(5 / gap) }, (_, i) => row(chunk * 5 + i * gap, 72, 'viola', 0.1));

describe('MS_CLASS', () => {
  it('maps all 35 names of muscriptor 0.4.0 (34 groups and the drums)', () => {
    expect(Object.keys(MS_CLASS).length).toBe(35);
    expect(new Set(Object.values(MS_CLASS)).size).toBe(35);
    expect(trackOf(MS_CLASS.flutes)).toBe('flute');
    expect(trackOf(MS_CLASS.voice)).toBe('voice');
    expect(trackOf(MS_CLASS.string_ensemble)).toBe('strings');
    expect(trackOf(MS_CLASS.soprano_and_alto_sax)).toBe('saxophone');
    expect(trackOf(MS_CLASS.tuba)).toBe('trombone');
    expect(trackOf(MS_CLASS.contrabass)).toBe('contrabass');
    expect(trackOf(MS_CLASS.acoustic_piano)).toBe('piano');
    expect(MS_CLASS.french_horn).toBe('French Horn');
    expect(trackOf(MS_CLASS.organ)).toBeNull();
    expect(trackOf(MS_CLASS.synth_lead)).toBeNull();
    expect(trackOf(MS_CLASS.drums)).toBeNull();
  });
});

describe('resolveInstruments', () => {
  it('resolves the presets to the tested lists', () => {
    const strings = ['violin', 'viola', 'cello', 'contrabass'];
    expect(resolveInstruments('strings')).toEqual({ list: strings, preset: 'strings' });
    expect(resolveInstruments('baroque')).toEqual({ list: [...strings, 'acoustic_piano'], preset: 'baroque' });
    expect(resolveInstruments('classical')).toEqual({
      list: [...strings, 'flutes', 'oboe', 'clarinet', 'bassoon', 'french_horn', 'trumpet', 'timpani'],
      preset: 'classical',
    });
  });

  it('hands out a copy of a preset', () => {
    const r = resolveInstruments('strings');
    if ('list' in r) r.list.push('oboe');
    expect(MS_PRESETS.strings).toHaveLength(4);
  });

  it('takes an own list, in the order given', () => {
    expect(resolveInstruments('violin, viola')).toEqual({ list: ['violin', 'viola'], preset: null });
    expect(resolveInstruments('viola,violin')).toEqual({ list: ['viola', 'violin'], preset: null });
    expect(resolveInstruments(' oboe,,oboe, ')).toEqual({ list: ['oboe'], preset: null });
  });

  it('refuses string_ensemble, an unknown name and an empty list, saying why', () => {
    expect(resolveInstruments('violin,string_ensemble')).toEqual({ why: expect.stringContaining('string_ensemble') });
    expect(resolveInstruments('violin,kazoo')).toEqual({ why: expect.stringContaining('kazoo') });
    expect(resolveInstruments('constructor')).toEqual({ why: expect.stringContaining('constructor') });
    expect(resolveInstruments('')).toEqual({ why: expect.stringContaining('no instruments') });
    expect(resolveInstruments(' , ')).toEqual({ why: expect.stringContaining('no instruments') });
  });
});

describe('mapMsRows', () => {
  it('maps overnight rows and cache rows alike', () => {
    const want: Ymt3Row[] = [[1, 2, 60, 100, 'French Horn']];
    expect(mapMsRows([[1, 2, 60, 100, 'french_horn']])).toEqual({ rows: want, unknown: [] });
    expect(mapMsRows([[1, 2, 60, 100, 'French Horn']])).toEqual({ rows: want, unknown: [] });
  });

  it('turns a null velocity into 100', () => {
    const { rows } = mapMsRows([[1, 2, 60, null, 'violin'], [3, 4, 62, 0, 'violin']]);
    expect(rows.map((r) => r[3])).toEqual([100, 100]);
    expect(cleanRows(rows)).toHaveLength(2);
  });

  it('reports an unknown name', () => {
    const { rows, unknown } = mapMsRows([[1, 2, 60, 100, 'program_34'], [3, 4, 60, 100, 'program_34'], [5, 6, 60, 100, 'constructor'], [7, 8, 60, 100, 'violin']]);
    expect(unknown).toEqual(['program_34', 'constructor']);
    expect(rows).toEqual([[7, 8, 60, 100, 'Violin']]);
  });

  it('keeps zero-length rows for the loop check and drops what is not a row', () => {
    const { rows } = mapMsRows([[1, 1, 60, 100, 'violin'], 'x', [1, 2], [null, 2, 60, 100, 'violin']]);
    expect(rows).toEqual([[1, 1, 60, 100, 'Violin']]);
  });
});

describe('listKey', () => {
  it('keys a list by its order', () => {
    const a = listKey(['a', 'b']);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(listKey(['a', 'b'])).toBe(a);
    expect(listKey(['b', 'a'])).not.toBe(a);
  });

  it('is always 8 hex, leading zeros included', () => {
    for (let i = 0; i < 2000; i++) expect(listKey([`name${i}`])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('hasKeyboard and guessPreset', () => {
  it('sees a keyboard in a list', () => {
    expect(hasKeyboard(MS_PRESETS.baroque)).toBe(true);
    expect(hasKeyboard(['electric_piano'])).toBe(true);
    expect(hasKeyboard(MS_PRESETS.strings)).toBe(false);
    expect(hasKeyboard(MS_PRESETS.classical)).toBe(false);
  });

  it("guesses the dialog's preset", () => {
    expect(guessPreset(['violin', 'oboe'])).toBe('classical');
    expect(guessPreset(['violin', 'cello'])).toBe('baroque');
    expect(guessPreset([])).toBe('baroque');
  });
});

describe('loopCheck', () => {
  it('fails half zero-length notes', () => {
    const rows = Array.from({ length: 100 }, (_, i) => row(i * 0.5, 60, 'violin', i % 2 ? 0 : 0.2));
    const r = loopCheck(rows);
    expect(r.ok).toBe(false);
    expect(r.zeroShare).toBe(0.5);
    expect(r.why).toContain('50 %');
  });

  it('fails a burst in 3 of 18 chunks', () => {
    const r = loopCheck([...plainChunks(18), ...burst(2), ...burst(7), ...burst(11)]);
    expect(r.ok).toBe(false);
    expect(r.burstShare).toBeCloseTo(3 / 18);
    expect(r.why).toContain('17 %');
  });

  it('passes one stuck chunk in 18', () => {
    const r = loopCheck([...plainChunks(18), ...burst(5)]);
    expect(r.ok).toBe(true);
    expect(r.burstShare).toBeCloseTo(1 / 18);
    expect(r.why).toBeUndefined();
  });

  it('does not call an irregular rate or a few repeats a burst', () => {
    let t = 0;
    const irregular = Array.from({ length: 40 }, (_, i) => row((t += i % 2 ? 0.05 : 0.2), 72, 'viola', 0.04));
    expect(loopCheck([...irregular, ...plainChunks(1)]).burstShare).toBe(0);
    expect(loopCheck(Array.from({ length: 29 }, (_, i) => row(i * 0.15))).burstShare).toBe(0);
  });

  it('counts a repeat per instrument and pitch', () => {
    const spread = Array.from({ length: 40 }, (_, i) => row(i * 0.12, 60 + (i % 4)));
    expect(loopCheck(spread).burstShare).toBe(0);
  });

  it('passes nothing at all, reading no shares', () => {
    expect(loopCheck([])).toEqual({ ok: true, zeroShare: 0, burstShare: 0 });
  });
});
