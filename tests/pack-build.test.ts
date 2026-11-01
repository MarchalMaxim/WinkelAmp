import { describe, expect, it } from 'vitest';
import type { SongAnalysis } from '../src/audio/song-analysis';
import { buildPack, type BuildInput } from '../src/studio/pack/build';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import type { Note } from '../src/widgets/types';

/** A synthetic analysis: onsets every `every` s (s 0.6) from 1 s, one melody note per onset, one chord, contiguous sections. */
function analysis(duration: number, o: { every?: number; sections?: number } = {}): SongAnalysis {
  const every = o.every ?? 1, n = o.sections ?? 1;
  const onsets: SongAnalysis['onsets'] = [];
  for (let t = 1; t < duration - 0.5; t += every) onsets.push({ t: Math.round(t * 1000) / 1000, s: 0.6 });
  return {
    duration,
    sections: Array.from({ length: n }, (_, i) => ({ start: (i * duration) / n, end: ((i + 1) * duration) / n, novelty: i ? 0.5 : 0 })),
    beats: onsets.map((x) => x.t),
    loudness: { hop: 0.1, values: Array.from({ length: Math.ceil(duration * 10 - 1e-6) }, (_, i) => (i % 10) / 10) },
    harmony: [{ t: 0, root: 1, minor: true }],
    onsets,
    melody: onsets.map((x) => ({ start: x.t, end: x.t + 0.4, midi: 72, strength: 0.5, confidence: 0.8 })),
  };
}

const input = (a: SongAnalysis, notes: BuildInput['notes']): BuildInput => ({
  id: 'demo', title: 'Demo', audio: 'audio.wav', source: { name: 'demo.wav', bytes: 1000, sha1: 'a'.repeat(40) },
  analysis: a, notes, by: 'ingest', at: '2026-10-31T00:00:00.000Z',
});
const gpu = (list: Note[]) => ({ from: 'gpu' as const, list, transcriber: { model: 'bytedance-piano-transcription', device: 'cuda' as const, seconds: 3 } });

describe('buildPack', () => {
  const a = analysis(20);
  const onAll: Note[] = a.onsets.map((o) => [o.t + 0.01, o.t + 1, 60, 80]);

  it('keeps gpu notes that cover the onsets', () => {
    const p = buildPack(input(a, gpu(onAll)));
    expect(p.notesFrom).toBe('gpu');
    expect(p.notes).toEqual(onAll);
    expect(p.transcriber?.device).toBe('cuda');
    expect(p.quality.onsetCoverage).toBe(1);
    expect(validatePack(p)).toEqual([]);
  });

  it('fills in approximate notes when the transcriber heard little', () => {
    const few = onAll.filter((_, i) => i % 5 === 0); // coverage 0.2
    const p = buildPack(input(a, gpu(few)));
    expect(p.notesFrom).toBe('merged');
    expect(p.quality.warnings.join()).toMatch(/heard little/);
    for (const n of few) expect(p.notes).toContainEqual(n);
    expect(p.notes.length).toBeGreaterThan(few.length);
    expect(validatePack(p)).toEqual([]);
  });

  it('keeps a notes file exactly, whatever its coverage', () => {
    const list: Note[] = [[50, 51, 60, 80], [50, 50.5, 40, 70], [60, 61, 62, 70]];
    const p = buildPack(input(analysis(100), { from: 'file', list, transcriber: null }));
    expect(p.notesFrom).toBe('file');
    expect(p.notes).toEqual(list);
    expect(validatePack(p)).toEqual([]);
  });

  it('stable-sorts a file by start, keeping ties in file order', () => {
    const list: Note[] = [[2, 3, 60, 80], [1, 2, 64, 80], [1, 2, 50, 80]];
    expect(buildPack(input(a, { from: 'file', list, transcriber: null })).notes).toEqual([[1, 2, 64, 80], [1, 2, 50, 80], [2, 3, 60, 80]]);
  });

  it('approximates without a transcriber, and says so', () => {
    const p = buildPack(input(a, null));
    expect(p.notesFrom).toBe('approx');
    expect(p.transcriber).toBeNull();
    expect(p.quality.warnings.join()).toMatch(/approximate/);
    expect(p.notes.length).toBeGreaterThan(0);
    expect(validatePack(p)).toEqual([]);
  });

  it('warns when there are no notes at all', () => {
    const silent: SongAnalysis = { ...analysis(10), onsets: [], melody: [], beats: [], harmony: [] };
    const p = buildPack(input(silent, null));
    expect(p.notes).toEqual([]);
    expect(p.quality.warnings.join()).toMatch(/no notes found/);
    expect(p.quality.notesPerMinute).toBe(0);
    expect(validatePack(p)).toEqual([]);
  });

  it('builds a 10-minute pack with 9000 notes in well under a second', () => {
    const big = analysis(600, { every: 0.2, sections: 80 });
    const notes: Note[] = Array.from({ length: 9000 }, (_, i) => [i / 15, i / 15 + 0.5, 40 + (i % 40), 80]);
    const t0 = performance.now();
    const p = buildPack(input(big, gpu(notes)));
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(p.loudness.values.length).toBe(6000);
    expect(p.sections.length).toBe(80);
    expect(validatePack(p)).toEqual([]);
  });
});

describe('validatePack', () => {
  const ok = (): SongPack => buildPack(input(analysis(20), null));
  const bad = (f: (p: SongPack) => void, field: RegExp) => {
    const p = ok();
    f(p);
    const errs = validatePack(p);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join('\n')).toMatch(field);
  };

  it('rejects what a pack must never hold, naming the field', () => {
    bad((p) => ((p as unknown as { version: number }).version = 3), /version/);
    bad((p) => p.notes.reverse(), /notes/);
    bad((p) => (p.notes[0] = [5, 4, 60, 80]), /notes\[0\]/);
    bad((p) => (p.sections = [{ start: 0, end: 5, novelty: 0 }, { start: 6, end: 20, novelty: 0.5 }]), /sections/);
    bad((p) => (p.id = 'Bad Id'), /id/);
    bad((p) => p.loudness.values.pop(), /loudness/);
    bad((p) => (p.source.sha1 = 'nope'), /sha1/);
  });

  it('rejects a non-object', () => {
    expect(validatePack(null).length).toBeGreaterThan(0);
    expect(validatePack([]).length).toBeGreaterThan(0);
  });
});
