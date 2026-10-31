import { describe, expect, it } from 'vitest';
import type { SongAnalysis } from '../src/audio/song-analysis';
import { buildPack, WARN_NO_PIANO, WARN_NO_YMT3, WARN_PIANO_ONLY, type BuildInput } from '../src/studio/pack/build';
import { PACK_VERSION, validatePack, type SongPack } from '../src/studio/pack/pack';
import type { Ymt3Row } from '../src/studio/pack/tracks';
import type { Note } from '../src/widgets/types';

/** Onsets every `every` s from 1 s; contiguous sections. */
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

const base = (a: SongAnalysis, extra: Partial<BuildInput>): BuildInput => ({
  id: 'demo', title: 'Demo', audio: 'audio.wav', source: { name: 'demo.wav', bytes: 1000, sha1: 'a'.repeat(40) },
  analysis: a, notes: null, by: 'ingest', at: '2026-10-31T00:00:00.000Z', ...extra,
});
const gpu = (list: Note[]): BuildInput['notes'] =>
  ({ from: 'gpu', list, transcriber: { model: 'bytedance-piano-transcription', device: 'cuda', seconds: 3 } });
const ymt3 = (rows: Ymt3Row[]): NonNullable<BuildInput['ymt3']> =>
  ({ rows, levels: rows.map((_, i) => -40 + (i % 30)), model: 'yourmt3-moe', seconds: 9 });

const a = analysis(40);
/** Piano notes on every onset: coverage 1. */
const pianoAll: Note[] = a.onsets.map((o, i) => [o.t + 0.01, o.t + 0.8, 60 + (i % 12), 50 + (i % 40)]);
/** Piano notes on every other onset: coverage 0.5. */
const pianoHalf = pianoAll.filter((_, i) => i % 2 === 0);
/** YourMT3 rows on every onset and in the gaps between them, one class each. */
function rowsOf(cls: (i: number) => string, n = 80): Ymt3Row[] {
  return Array.from({ length: n }, (_, i): Ymt3Row => [1 + i * 0.47, 1 + i * 0.47 + 0.3, 48 + (i % 24), 100, cls(i)]);
}

/** A v1 pack, as last night's ingest wrote it. */
function v1(): SongPack {
  const p = buildPack(base(a, { notes: gpu(pianoAll) })) as Partial<SongPack>;
  delete p.kind; delete p.pianoShare; delete p.tracks; delete p.transcribers;
  return { ...(p as SongPack), version: 1 };
}

describe('validatePack v2', () => {
  it('writes version 2', () => expect(PACK_VERSION).toBe(2));

  it('accepts a v1 pack unchanged', () => {
    const p = v1();
    const before = JSON.stringify(p);
    expect(validatePack(p)).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('accepts a v2 pack with a violin track', () => {
    const p = buildPack(base(a, { notes: gpu(pianoHalf), ymt3: ymt3(rowsOf(() => 'Violin')) }));
    expect(p.tracks?.violin).toBeTruthy();
    expect(validatePack(p)).toEqual([]);
  });

  const withTracks = (): SongPack => buildPack(base(a, { notes: gpu(pianoHalf), ymt3: ymt3(rowsOf(() => 'Violin')) }));
  // any: the point is to break the type.
  const bad = (f: (p: any) => void, field: RegExp) => {
    const p = withTracks();
    f(p);
    const errs = validatePack(p);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join('\n')).toMatch(field);
  };

  it('rejects what a v2 pack must never hold, naming the field', () => {
    bad((p) => (p.tracks.banjo = { ...p.tracks.violin }), /tracks\.banjo: not a track id/);
    bad((p) => (p.tracks.violin.family = 'brass'), /tracks\.violin\.family/);
    bad((p) => p.tracks.violin.notes.reverse(), /tracks\.violin\.notes\[1\].*sorted/);
    bad((p) => (p.tracks.violin.notes[0][1] = p.tracks.violin.notes[0][0]), /tracks\.violin\.notes\[0\]: end/);
    bad((p) => (p.tracks.violin.share = 1.5), /tracks\.violin\.share/);
    bad((p) => (p.tracks.violin.vel = { borrowed: 1.5, level: 2 }), /tracks\.violin\.vel/);
    bad((p) => (p.kind = 'orchestra'), /kind/);
    bad((p) => (p.pianoShare = 2), /pianoShare/);
    bad((p) => (p.transcribers = [{ name: 'demucs', model: 'x', seconds: 1, notes: 1 }]), /transcribers\[0\]/);
    bad((p) => (p.version = 3), /version/);
    bad((p) => (p.notesFrom = 'magic'), /notesFrom/);
  });

  it('rejects v2 fields in a v1 pack', () => {
    const p = { ...v1(), kind: 'piano' };
    expect(validatePack(p).join()).toMatch(/kind: a version 1 pack/);
  });
});

describe('buildPack v2', () => {
  it('keeps a solo piano song\'s piano notes exactly when YourMT3 hears piano', () => {
    const rows = rowsOf((i) => (i % 10 === 0 ? 'Violin' : 'Acoustic Piano'));   // share 0.9
    const p = buildPack(base(a, { notes: gpu(pianoAll), ymt3: ymt3(rows) }));
    expect(p.kind).toBe('piano');
    expect(p.pianoShare).toBe(0.9);
    expect(p.notes).toEqual(pianoAll);
    expect(p.notesFrom).toBe('gpu');
    expect(p.tracks).toBeUndefined();
    expect(p.version).toBe(2);
    expect(p.quality.warnings).toEqual([]);
    expect(validatePack(p)).toEqual([]);
  });

  it('gap-fills an ensemble song and writes its tracks', () => {
    const rows = rowsOf((i) => ['Violin', 'Cello', 'French Horn', 'Synth Pad'][i % 4]);
    const p = buildPack(base(a, { notes: gpu(pianoHalf), ymt3: ymt3(rows) }));
    expect(p.kind).toBe('ensemble');
    expect(p.pianoShare).toBe(0);
    expect(p.notesFrom).toBe('hybrid');
    expect(p.version).toBe(2);
    expect(Object.keys(p.tracks!)).toEqual(['violin', 'cello', 'horn']);
    expect(p.tracks!.horn!.label).toBe('French horns');
    expect(p.tracks!.violin!.share).toBe(0.25);
    for (const n of pianoHalf) expect(p.notes).toContainEqual(n);
    expect(p.notes.length).toBeGreaterThan(pianoHalf.length);
    expect(p.notes.length).toBeLessThan(pianoHalf.length + rows.length);
    expect(p.transcribers!.map((t) => t.name)).toEqual(['piano', 'ymt3']);
    expect(p.transcribers![1]).toEqual({ name: 'ymt3', model: 'yourmt3-moe', seconds: 9, notes: 80 });
    expect(p.quality.onsetCoverage).toBeCloseTo(pianoHalf.length / a.onsets.length, 3);   // of the piano model's notes, before the fill
    expect(p.quality.warnings).toEqual([]);
    expect(validatePack(p)).toEqual([]);
  });

  it('decides by the piano model\'s coverage without YourMT3, and says there are no tracks', () => {
    const p = buildPack(base(a, { notes: gpu(pianoHalf), ymt3: null }));
    expect(p.kind).toBe('ensemble');
    expect(p.pianoShare).toBeNull();
    expect(p.tracks).toBeUndefined();
    expect(p.notesFrom).toBe('gpu');
    expect(p.quality.warnings).toContain(WARN_NO_YMT3);
    expect(p.quality.warnings.join()).toMatch(/no instrument tracks/);
    expect(p.quality.warnings).toContain(WARN_PIANO_ONLY);
    expect(p.quality.warnings.join()).toMatch(/about half the attacks may be missing/);
    expect(validatePack(p)).toEqual([]);
    const solo = buildPack(base(a, { notes: gpu(pianoAll) }));
    expect(solo.kind).toBe('piano');
    expect(solo.quality.warnings).toEqual([]);
  });

  it('fills the gaps with basic-pitch when YourMT3 is missing', () => {
    const extra: Note[] = rowsOf(() => '').map((r) => [r[0], r[1], r[2], 30]);
    const p = buildPack(base(a, { notes: gpu(pianoHalf), bp: { notes: extra, levels: extra.map((_, i) => -i), model: 'basic-pitch', seconds: 7 } }));
    expect(p.notesFrom).toBe('bp-hybrid');
    expect(p.tracks).toBeUndefined();
    expect(p.quality.warnings).toContain(WARN_NO_YMT3);
    expect(p.quality.warnings).not.toContain(WARN_PIANO_ONLY);
    expect(p.notes.length).toBeGreaterThan(pianoHalf.length);
    expect(p.transcribers!.map((t) => t.name)).toEqual(['piano', 'bp']);
    expect(validatePack(p)).toEqual([]);
  });

  it('uses YourMT3 alone with notesMode ymt3', () => {
    const rows = rowsOf(() => 'Violin');
    const p = buildPack(base(a, { notes: gpu(pianoHalf), ymt3: ymt3(rows), notesMode: 'ymt3' }));
    expect(p.notesFrom).toBe('ymt3');
    expect(p.notes.length).toBe(rows.length);
    expect(p.notes.map((n) => n.slice(0, 3))).toEqual(rows.map((r) => r.slice(0, 3)));
    expect(validatePack(p)).toEqual([]);
  });

  it('obeys a forced kind', () => {
    const rows = rowsOf(() => 'Violin');
    const piano = buildPack(base(a, { notes: gpu(pianoHalf), ymt3: ymt3(rows), kind: 'piano' }));
    expect(piano.kind).toBe('piano');
    expect(piano.notes).toEqual(pianoHalf);
    expect(piano.tracks).toBeUndefined();
    const ens = buildPack(base(a, { notes: gpu(pianoAll), kind: 'ensemble', ymt3: ymt3(rowsOf(() => 'Acoustic Piano')) }));
    expect(ens.kind).toBe('ensemble');
    expect(ens.notesFrom).toBe('hybrid');
    expect(Object.keys(ens.tracks!)).toEqual(['piano']);
    expect(validatePack(ens)).toEqual([]);
  });

  it('keeps a notes file exactly in auto, and gap-fills it when asked', () => {
    const rows = rowsOf(() => 'Viola');
    const file = { from: 'file' as const, list: pianoHalf, transcriber: null };
    const kept = buildPack(base(a, { notes: file, ymt3: ymt3(rows) }));
    expect(kept.notesFrom).toBe('file');
    expect(kept.notes).toEqual(pianoHalf);
    expect(Object.keys(kept.tracks!)).toEqual(['viola']);
    const filled = buildPack(base(a, { notes: file, ymt3: ymt3(rows), notesMode: 'hybrid' }));
    expect(filled.notesFrom).toBe('hybrid');
    expect(validatePack(kept)).toEqual([]);
    expect(validatePack(filled)).toEqual([]);
  });

  it('takes YourMT3\'s notes when the piano model is missing, with a warning', () => {
    const rows = rowsOf(() => 'Oboe');
    const p = buildPack(base(a, { notes: null, ymt3: ymt3(rows) }));
    expect(p.notesFrom).toBe('ymt3');
    expect(p.kind).toBe('ensemble');
    expect(p.quality.warnings).toContain(WARN_NO_PIANO);
    expect(p.quality.warnings.join()).toMatch(/piano transcriber unavailable/);
    expect(validatePack(p)).toEqual([]);
    const solo = buildPack(base(a, { notes: null, ymt3: ymt3(rowsOf(() => 'Acoustic Piano')) }));
    expect(solo.kind).toBe('piano');
    expect(solo.notesFrom).toBe('ymt3');
    expect(solo.quality.warnings.join()).toMatch(/piano transcriber unavailable/);
  });

  it('approximates with nothing installed, as before, kind undecided', () => {
    const p = buildPack(base(a, {}));
    expect(p.notesFrom).toBe('approx');
    expect(p.kind).toBeUndefined();
    expect(p.pianoShare).toBeNull();
    expect(p.transcribers).toEqual([]);
    expect(validatePack(p)).toEqual([]);
  });

  it('cleans the rows before anything else: drums and empty rows count nowhere', () => {
    const rows: Ymt3Row[] = [...rowsOf(() => 'Violin'), [5, 6, 40, 100, 'Drums'], [7, 7, 60, 100, 'Violin'], [8, 9, 60, 0, 'Violin']];
    const y = ymt3(rows);
    const p = buildPack(base(a, { notes: gpu(pianoHalf), ymt3: y }));
    expect(p.transcribers![1].notes).toBe(80);
    expect(p.tracks!.violin!.notes.length).toBe(80);
    expect(p.tracks!.violin!.share).toBe(1);
  });

  it('builds a 10-minute pack with 9000 notes and 9000 YourMT3 rows in under 1.5 s', () => {
    const big = analysis(600, { every: 0.2, sections: 80 });
    const notes: Note[] = Array.from({ length: 9000 }, (_, i) => [i / 15, i / 15 + 0.5, 40 + (i % 40), 40 + (i % 60)]);
    const classes = ['Violin', 'Viola', 'Cello', 'Contrabass', 'Oboe', 'French Horn', 'Synth Pad'];
    const rows: Ymt3Row[] = Array.from({ length: 9000 }, (_, i) => [i / 15 + 0.03, i / 15 + 0.4, 36 + (i % 48), 100, classes[i % 7]]);
    const t0 = performance.now();
    const p = buildPack(base(big, { notes: gpu(notes), ymt3: { rows, levels: rows.map((_, i) => -((i * 7) % 60)), model: 'm', seconds: 1 }, kind: 'ensemble' }));
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(p.notesFrom).toBe('hybrid');
    expect(Object.keys(p.tracks!).length).toBe(6);
    expect(validatePack(p)).toEqual([]);
  });
});
