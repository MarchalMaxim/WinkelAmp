/** buildPack: a song pack from an analysis and (maybe) transcribed notes. Pure, so the CLI, the ears server and the browser share it. */
import type { SongAnalysis } from '../../audio/song-analysis';
import type { Note } from '../../widgets/types';
import { trackOf } from './instruments';
import { approximateNotes, mergeNotes, onsetCoverage, stableByStart } from './notes';
import { PACK_VERSION, type NotesSource, type SongPack } from './pack';
import { buildTracks, cleanIndexes, estimateVelocities, hybridNotes, pianoShare, type Ymt3Row } from './tracks';

export interface BuildInput {
  id: string;
  title: string;
  audio: string;
  source: SongPack['source'];
  analysis: SongAnalysis;
  /**
   * The piano model's notes; null = none (approximate notes, or YourMT3's / basic-pitch's alone).
   * 'gpu' is any list that stands for the piano model's notes (ingest's `--piano-notes <file>` passes it so, with
   * transcriber null): an ensemble fills its gaps. 'file' (`--notes <file>`) is kept exactly unless notesMode asks.
   */
  notes: { from: 'gpu' | 'file'; list: Note[]; transcriber: SongPack['transcriber'] } | null;
  by: 'ingest' | 'studio';
  at: string;
  /** YourMT3's rows as ymt3.py wrote them, and each row's onsetLevels (aligned with `rows`). null/absent: it did not run. */
  ymt3?: { rows: Ymt3Row[]; levels: number[]; model: string; seconds: number } | null;
  /** Basic-pitch's notes and their onsetLevels (aligned): the gap fill when YourMT3 is missing. */
  bp?: { notes: Note[]; levels: number[]; model: string; seconds: number } | null;
  /**
   * MuScriptor's rows, cleaned and with their keyboard lane merged (mergeKeyboard), and each row's onsetLevels (aligned):
   * they stand in for YourMT3's everywhere, which then only counts as having run. `keyboard` says whose the piano lane is.
   */
  muscriptor?: { rows: Ymt3Row[]; levels: number[]; model: string; seconds: number; instruments: string[]; keyboard: 'ymt3' | 'muscriptor' | null } | null;
  /** Forced by --kind. */
  kind?: 'piano' | 'ensemble';
  /** auto: by kind; hybrid: gap-fill whatever the kind; ymt3: YourMT3's notes alone. */
  notesMode?: 'auto' | 'hybrid' | 'ymt3';
}

/** Below this share of the attacks heard, a transcription is filled in with approximate notes (a non-piano recording). */
export const MIN_COVERAGE = 0.35;
/** YourMT3's piano share at or above which a song is solo piano. */
export const PIANO_SHARE = 0.6;
/** Without YourMT3: the piano model's onset coverage at or above which a song is solo piano. */
export const PIANO_COVERAGE = 0.6;

export const WARN_NO_YMT3 = 'no instrument tracks: YourMT3 is not set up (npm run setup-ymt3)';
export const WARN_PIANO_ONLY = 'only the piano model heard this ensemble recording: about half the attacks may be missing';
export const WARN_NO_PIANO = 'piano transcriber unavailable: the notes come from another model, with velocities estimated from loudness';

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function buildPack(i: BuildInput): SongPack {
  const a = i.analysis;
  const warnings: string[] = [];
  const mode = i.notesMode ?? 'auto';
  const piano = i.notes ? stableByStart(i.notes.list) : null;
  const pianoCoverage = piano ? onsetCoverage(piano, a.onsets) : null;

  // The track-making transcriber (MuScriptor when it gave rows, else YourMT3): cleaned rows (levels follow them), their
  // velocities, the notes they make.
  const y = i.muscriptor ?? i.ymt3 ?? null;
  const keep = y ? cleanIndexes(y.rows) : [];
  const rows = y ? keep.map((k) => y.rows[k]) : [];
  const share = y ? pianoShare(rows) : null;
  const est = y ? estimateVelocities(rows, keep.map((k) => y.levels[k]), piano ?? []) : null;
  const ymt3Notes: Note[] = est ? rows.map((r, k): Note => [r[0], r[1], r[2], est.vel[k]]) : [];
  const hasY = ymt3Notes.length > 0;

  // YourMT3's labels decide; without them, the piano model's coverage; without either, undecided.
  const kind: SongPack['kind'] = i.kind
    ?? (hasY && share !== null ? (share >= PIANO_SHARE ? 'piano' : 'ensemble')
      : pianoCoverage !== null ? (pianoCoverage >= PIANO_COVERAGE ? 'piano' : 'ensemble') : undefined);

  const bpNotes = (): Note[] => {
    const b = i.bp!;
    const v = estimateVelocities(b.notes.map((n): Ymt3Row => [n[0], n[1], n[2], n[3], '']), b.levels, piano ?? []).vel;
    return b.notes.map((n, k): Note => [n[0], n[1], n[2], v[k]]);
  };
  const hasBp = !!i.bp && i.bp.notes.length > 0;

  let notes: Note[], from: NotesSource, coverage: number;
  if (mode === 'ymt3' && hasY) {
    notes = ymt3Notes;
    from = i.muscriptor ? 'ms-hybrid' : 'ymt3';
    coverage = pianoCoverage ?? onsetCoverage(notes, a.onsets);
  } else if (piano && i.notes) {
    coverage = pianoCoverage!;
    if (mode === 'ymt3') warnings.push('YourMT3 notes were asked for, but YourMT3 gave none: the piano model\'s notes instead');
    const fill = mode === 'hybrid' || mode === 'ymt3' || (mode === 'auto' && kind === 'ensemble' && i.notes.from !== 'file');
    if (fill && hasY) {
      notes = hybridNotes(piano, ymt3Notes);
      from = i.muscriptor ? 'ms-hybrid' : 'hybrid';
    } else if (fill && hasBp) {
      notes = hybridNotes(piano, bpNotes());
      from = 'bp-hybrid';
    } else {
      notes = piano;
      from = i.notes.from;
      if (fill && kind === 'ensemble') warnings.push(WARN_PIANO_ONLY);
      if (from === 'gpu' && coverage < MIN_COVERAGE) {
        notes = mergeNotes(notes, approximateNotes(a));
        from = 'merged';
        warnings.push(`the transcriber heard little of this recording (coverage ${Math.round(coverage * 100)}%): approximate notes fill the rest`);
      }
    }
  } else if (hasY || hasBp) {
    notes = hasY ? ymt3Notes : stableByStart(bpNotes());
    from = hasY ? (i.muscriptor ? 'ms-hybrid' : 'ymt3') : 'bp-hybrid';
    coverage = onsetCoverage(notes, a.onsets);
    warnings.push(WARN_NO_PIANO);
  } else {
    notes = approximateNotes(a);
    from = 'approx';
    coverage = onsetCoverage(notes, a.onsets);
    warnings.push('approximate notes: no transcriber');
  }
  if (kind === 'ensemble' && !y) warnings.push(WARN_NO_YMT3);
  else if (kind === 'ensemble' && !hasY) warnings.push('no instrument tracks: YourMT3 heard no notes in this recording');
  if (!notes.length) warnings.push('no notes found: is the recording silent?');

  const transcribers: NonNullable<SongPack['transcribers']> = [];
  if (i.notes?.transcriber) transcribers.push({ name: 'piano', model: i.notes.transcriber.model, seconds: i.notes.transcriber.seconds, notes: i.notes.list.length });
  if (i.ymt3) transcribers.push({ name: 'ymt3', model: i.ymt3.model, seconds: i.ymt3.seconds, notes: cleanIndexes(i.ymt3.rows).length });
  if (i.muscriptor) {
    const { model, seconds, instruments, keyboard } = i.muscriptor;
    // Its own notes: a keyboard lane merged in from YourMT3+ is not MuScriptor's.
    const own = keyboard === 'ymt3' ? rows.filter((r) => trackOf(r[4]) !== 'piano').length : rows.length;
    transcribers.push({ name: 'muscriptor', model, seconds, notes: own, instruments: [...instruments] });
  }
  if (i.bp) transcribers.push({ name: 'bp', model: i.bp.model, seconds: i.bp.seconds, notes: i.bp.notes.length });

  const tracks = kind === 'ensemble' && hasY && est ? buildTracks(rows, est.vel, est.borrowed) : null;
  if (tracks && i.muscriptor) {
    for (const [id, t] of Object.entries(tracks)) t.from = id === 'piano' && i.muscriptor.keyboard === 'ymt3' ? 'ymt3' : 'muscriptor';
  }

  return {
    version: PACK_VERSION,
    id: i.id,
    title: i.title,
    audio: i.audio,
    duration: a.duration,
    source: { ...i.source },
    notes,
    notesFrom: from,
    transcriber: i.notes?.transcriber ?? null,
    quality: {
      onsetCoverage: Math.round(coverage * 1000) / 1000,
      notesPerMinute: a.duration > 0 ? Math.round((notes.length / (a.duration / 60)) * 10) / 10 : 0,
      warnings,
    },
    sections: a.sections.map((s) => ({ ...s })),
    beats: [...a.beats],
    loudness: { hop: 0.1, values: [...a.loudness.values] },
    harmony: a.harmony.map(({ t, root, minor }) => ({ t, root, minor })),
    made: { by: i.by, at: i.at },
    ...(kind ? { kind } : {}),
    pianoShare: share === null ? null : r4(share),
    ...(tracks ? { tracks } : {}),
    transcribers,
    // Last, where the backfill (scripts/augment-pack.ts) appends it to older packs.
    ...(a.energy ? { energy: { hop: 0.1 as const, momentary: [...a.energy.momentary], shortTerm: [...a.energy.shortTerm] } } : {}),
  };
}
