/**
 * A song's melody, marked by hand in the note picker, pure. melodies/<song>.json holds
 * canonicalMelody: the notes themselves, not indexes, so a new transcription doesn't silently move the marks onto other
 * notes; matchMarks finds them again and says which it can't. One per song, reused by every widget.
 */
import { isSlug } from '../pack/pack';
import type { Issue } from './show';

/** track: a TrackId for a song with tracks, a YourMT3 label for one without; two instruments often double a note. */
export type Mark = [start: number, end: number, midi: number, vel: number, track?: string];
export interface Melody { version: 1; song: string; notes: Mark[] }

/** The most a save can carry as the page goes (a keepalive request is cut off at 64 KiB). */
export const LEAVING_MAX = 60_000;

export const emptyMelody = (song: string): Melody => ({ version: 1, song, notes: [] });

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4 || 0;

function badMark(n: unknown): string | null {
  if (!Array.isArray(n) || (n.length !== 4 && n.length !== 5) || !n.slice(0, 4).every(isNum) || (n.length === 5 && typeof n[4] !== 'string')) {
    return 'not [start, end, midi, velocity, track?]';
  }
  const [s, e, m, v] = n as Mark;
  if (e < s) return `ends at ${e} s, before it starts at ${s} s`;
  if (m < 0 || m > 127) return `midi ${m} is outside 0..127`;
  if (v < 0 || v > 127) return `velocity ${v} is outside 0..127`;
  return null;
}

/** What is wrong with a melody file, each with its path. */
export function validateMelody(x: unknown): Issue[] {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return [{ path: '', message: 'a melody is a JSON object { version, song, notes }' }];
  const m = x as Record<string, unknown>, out: Issue[] = [];
  if (m.version !== 1) out.push({ path: 'version', message: `version ${JSON.stringify(m.version)}: this studio reads version 1` });
  if (!isSlug(m.song)) out.push({ path: 'song', message: `${JSON.stringify(m.song)} is not a song id (a slug)` });
  if (!Array.isArray(m.notes)) out.push({ path: 'notes', message: 'not a list of notes' });
  else m.notes.forEach((n: unknown, i) => { const why = badMark(n); if (why) out.push({ path: `notes[${i}]`, message: why }); });
  return out;
}

/** One note a line, 4 decimals, sorted by start, a final newline. */
export function canonicalMelody(m: Melody): string {
  const lines = m.notes.map((n, i) => [n, i] as const).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map(([n]) =>
    `    [${[r4(n[0]), r4(n[1]), r4(n[2]), r4(n[3]), ...(n[4] === undefined ? [] : [n[4]])].map((x) => JSON.stringify(x)).join(', ')}]`);
  const notes = lines.length ? `[\n${lines.join(',\n')}\n  ]` : '[]';
  return `{\n  "version": 1,\n  "song": ${JSON.stringify(m.song)},\n  "notes": ${notes}\n}\n`;
}

/** For each mark the nearest unused note at its pitch within `within` s, the same track first; the rest are unmatched,
    in order. Neither list is changed. */
export function matchMarks(marks: readonly Mark[], notes: readonly Mark[], within = 0.05): { matched: Map<number, number>; unmatched: number[] } {
  const byPitch = new Map<number, number[]>();
  notes.forEach((n, i) => { const l = byPitch.get(n[2]); if (l) l.push(i); else byPitch.set(n[2], [i]); });
  const used = new Set<number>(), matched = new Map<number, number>(), unmatched: number[] = [];
  marks.forEach((k, i) => {
    let best = -1, bestSame = false, bestD = Infinity;
    for (const j of byPitch.get(k[2]) ?? []) {
      const d = Math.abs(notes[j][0] - k[0]), same = k[4] !== undefined && notes[j][4] === k[4];
      if (used.has(j) || d > within || (bestSame && !same)) continue;
      if ((same && !bestSame) || d < bestD) { best = j; bestSame = same; bestD = d; }
    }
    if (best < 0) unmatched.push(i);
    else { used.add(best); matched.set(i, best); }
  });
  return { matched, unmatched };
}
