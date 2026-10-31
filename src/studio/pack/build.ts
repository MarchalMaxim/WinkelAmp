/** buildPack: a song pack from an analysis and (maybe) transcribed notes. Pure, so the CLI, the ears server and the browser share it. */
import type { SongAnalysis } from '../../audio/song-analysis';
import type { Note } from '../../widgets/types';
import { approximateNotes, mergeNotes, onsetCoverage, stableByStart } from './notes';
import { PACK_VERSION, type NotesSource, type SongPack } from './pack';

export interface BuildInput {
  id: string;
  title: string;
  audio: string;
  source: SongPack['source'];
  analysis: SongAnalysis;
  /** null = approximate notes from the analysis. */
  notes: { from: 'gpu' | 'file'; list: Note[]; transcriber: SongPack['transcriber'] } | null;
  by: 'ingest' | 'studio';
  at: string;
}

/** Below this share of the attacks heard, a transcription is filled in with approximate notes (a non-piano recording). */
export const MIN_COVERAGE = 0.35;

export function buildPack(i: BuildInput): SongPack {
  const a = i.analysis;
  const warnings: string[] = [];
  let notes: Note[], from: NotesSource, coverage: number;
  if (!i.notes) {
    notes = approximateNotes(a);
    from = 'approx';
    coverage = onsetCoverage(notes, a.onsets);
    warnings.push('approximate notes: no transcriber');
  } else {
    notes = stableByStart(i.notes.list);
    from = i.notes.from;
    coverage = onsetCoverage(notes, a.onsets);
    if (from === 'gpu' && coverage < MIN_COVERAGE) {
      notes = mergeNotes(notes, approximateNotes(a));
      from = 'merged';
      warnings.push(`the transcriber heard little of this recording (coverage ${Math.round(coverage * 100)}%): approximate notes fill the rest`);
    }
  }
  if (!notes.length) warnings.push('no notes found: is the recording silent?');
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
  };
}
