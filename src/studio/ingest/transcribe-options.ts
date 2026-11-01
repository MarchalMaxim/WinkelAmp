/**
 * What a redo of a song's transcription can be, and how long it takes (pure, browser-safe): the words of the studio's
 * dialog (ui/redo-dialog.ts) and the query it sends the ears server. Rates are × the music's length, measured on a shared
 * GPU, so upper bounds: YourMT3+ about 0.19×; MuScriptor large from 0.69× (Spring) to 1.82× (Beethoven, 11 instruments).
 */
import { listKey, MS_CLASS, resolveInstruments } from '../pack/muscriptor';
import type { TranscribeChoices } from './ears-types';

export const YMT3_RATE = [0.15, 0.25] as const, MS_RATE = [0.7, 1.8] as const;
export const SAVED_WORDS = 'under a minute (saved)';

export type RedoChoice = { engine: 'ymt3' } | { engine: 'muscriptor'; instruments: string; overnight?: boolean };

/** "about 2 to 3 min", "8 to 22 min on the GPU", "under a minute (saved)". */
export function estimateWords(engine: 'ymt3' | 'muscriptor', duration: number, saved: boolean): string {
  if (saved) return SAVED_WORDS;
  const [lo, hi] = engine === 'ymt3' ? YMT3_RATE : MS_RATE;
  const a = Math.round((duration * lo) / 60), b = Math.round((duration * hi) / 60);
  const gpu = engine === 'muscriptor' ? ' on the GPU' : '';
  if (b < 1) return `under a minute${gpu}`;
  if (a < 1 || a === b) return `about ${b} min${gpu}`;
  return `${engine === 'ymt3' ? 'about ' : ''}${a} to ${b} min${gpu}`;
}

/** The query of `POST /ingest` for this choice: `redo=1`, the engine, and for MuScriptor its list. */
export function redoQuery(id: string, c: RedoChoice): string {
  const q = [`id=${encodeURIComponent(id)}`, 'redo=1', `engine=${c.engine}`];
  if (c.engine === 'muscriptor') {
    q.push(`instruments=${encodeURIComponent(c.instruments)}`);
    if (c.overnight) q.push('overnight=1');
  }
  return q.join('&');
}

/** Whether a saved result of this list is there (a cache in the song's folder). */
export function savedFor(ch: Pick<TranscribeChoices, 'saved'>, list: readonly string[]): boolean {
  const key = listKey(list);
  return ch.saved.some((s) => s.key === key);
}

/**
 * The time of a MuScriptor redo, all of it. YourMT3+ runs first for the keyboard lane and the fallback, unless its notes
 * are saved or it cannot run. `saved` is MuScriptor's own result being there (a cache, or the overnight file to import).
 */
export function msEstimate(ch: Pick<TranscribeChoices, 'duration' | 'ymt3' | 'ymt3Saved'>, saved: boolean): string {
  const ymt3Runs = !ch.ymt3Saved && ch.ymt3.ok;
  const ymt3 = estimateWords('ymt3', ch.duration, false);
  if (saved) return ymt3Runs ? `${ymt3} for YourMT3+; MuScriptor's notes are saved` : SAVED_WORDS;
  const ms = estimateWords('muscriptor', ch.duration, false);
  return ymt3Runs ? `${ms}, plus ${ymt3} for YourMT3+` : ms;
}

/**
 * The overnight file's lanes that the list lacks, compared as class names (ingest refuses such an import, exit 2: a file
 * with a lane outside its list would misstate the pack and the cache).
 */
export function lanesOutside(lanes: readonly string[], list: readonly string[]): string[] {
  const cls = (x: string) => MS_CLASS[x] ?? x;
  const have = new Set(list.map(cls));
  return lanes.filter((x) => !have.has(cls(x)));
}

/** The list a preset's name or a typed list means, or null when it means none. */
export function listOf(arg: string): string[] | null {
  const r = resolveInstruments(arg);
  return 'why' in r ? null : r.list;
}
