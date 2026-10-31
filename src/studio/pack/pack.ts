/**
 * A song pack: everything the studio needs to play a recording, computed once by
 * `npm run ingest` (or the studio's in-browser fallback) into songs/<id>/pack.json.
 */
import { loudnessLength } from '../../audio/song-analysis';
import type { Note } from '../../widgets/types';

export const PACK_VERSION = 1;
export type NotesSource = 'gpu' | 'file' | 'approx' | 'merged';
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (s: unknown): s is string => typeof s === 'string' && SLUG.test(s);

export interface SongPack {
  version: 1;
  /** Slug = the folder songs/<id>/. */
  id: string;
  title: string;
  /** File name in songs/<id>/: 'audio' + the original's extension. */
  audio: string;
  /** Seconds of the decoded audio. */
  duration: number;
  /** Same sha1 = already ingested. */
  source: { name: string; bytes: number; sha1: string };
  /** The lab's NOTES, stable-sorted by start (ties keep source order): straight into window.NOTES. */
  notes: Note[];
  /** gpu | file (--notes <file>, kept exactly) | approx (analysis only) | merged (gpu + approx). */
  notesFrom: NotesSource;
  transcriber: { model: string; device: 'cuda' | 'cpu'; seconds: number } | null;
  /** onsetCoverage: of the transcribed (or file) notes before any merge. */
  quality: { onsetCoverage: number; notesPerMinute: number; warnings: string[] };
  /** Analysis novelty sections, contiguous over [0, duration]. */
  sections: { start: number; end: number; novelty: number }[];
  /** Kept where pulseClarity ≥ 0.3 (study's rule). */
  beats: number[];
  /** Descriptor loudness 0..1, length ceil(duration / 0.1). */
  loudness: { hop: 0.1; values: number[] };
  /** Chord changes (study's chords() minus chroma); not the lab's attack CHORDS. */
  harmony: { t: number; root: number; minor: boolean }[];
  made: { by: 'ingest' | 'studio'; at: string };
}

const SOURCES: readonly NotesSource[] = ['gpu', 'file', 'approx', 'merged'];
/** Section edges may differ from each other or from 0 / duration by rounding (ms). */
const EPS = 2e-3;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** [] = valid; each message names the field. */
export function validatePack(x: unknown): string[] {
  const e: string[] = [];
  if (!isObj(x)) return ['pack: not an object'];
  const p = x as Partial<SongPack>;
  if (p.version !== PACK_VERSION) e.push(`version: ${String(p.version)}, expected ${PACK_VERSION}`);
  if (!isSlug(p.id)) e.push(`id: ${JSON.stringify(p.id)} is not a slug (lowercase letters, digits, single dashes)`);
  if (typeof p.title !== 'string') e.push('title: not a string');
  if (typeof p.audio !== 'string' || !/^audio(\.[A-Za-z0-9]+)?$/.test(p.audio)) e.push(`audio: ${JSON.stringify(p.audio)} is not 'audio.<ext>'`);
  const duration = p.duration;
  const durOk = isNum(duration) && duration > 0;
  if (!durOk) e.push(`duration: ${String(duration)} is not a positive number`);
  if (!isObj(p.source)) e.push('source: not an object');
  else {
    if (typeof p.source.name !== 'string') e.push('source.name: not a string');
    if (!isNum(p.source.bytes) || p.source.bytes < 0) e.push('source.bytes: not a byte count');
    if (typeof p.source.sha1 !== 'string' || !/^[0-9a-f]{40}$/.test(p.source.sha1)) e.push('source.sha1: not 40 hex digits');
  }

  if (!Array.isArray(p.notes)) e.push('notes: not an array');
  else {
    // Five complaints are enough to fix a 9000-note list.
    const noteErrors: string[] = [];
    let prev = -Infinity;
    for (let i = 0; i < p.notes.length && noteErrors.length < 5; i++) {
      const n = p.notes[i] as unknown;
      if (!Array.isArray(n) || n.length !== 4 || !n.every(isNum)) noteErrors.push(`notes[${i}]: not [start, end, midi, vel]`);
      else if (n[1] < n[0]) noteErrors.push(`notes[${i}]: end ${n[1]} before start ${n[0]}`);
      else if (n[2] < 0 || n[2] > 127 || n[3] < 0 || n[3] > 127) noteErrors.push(`notes[${i}]: midi or vel outside 0..127`);
      else if (n[0] < prev) noteErrors.push(`notes[${i}]: starts at ${n[0]}, before the note above it (${prev}): notes must be sorted by start`);
      if (Array.isArray(n) && isNum(n[0])) prev = Math.max(prev, n[0]);
    }
    e.push(...noteErrors);
  }
  if (!SOURCES.includes(p.notesFrom as NotesSource)) e.push(`notesFrom: ${JSON.stringify(p.notesFrom)} is not one of ${SOURCES.join(', ')}`);
  if (p.transcriber !== null) {
    const t = p.transcriber;
    if (!isObj(t) || typeof t.model !== 'string' || (t.device !== 'cuda' && t.device !== 'cpu') || !isNum(t.seconds)) {
      e.push('transcriber: neither null nor { model, device: cuda | cpu, seconds }');
    }
  }
  const q = p.quality;
  if (!isObj(q)) e.push('quality: not an object');
  else {
    if (!isNum(q.onsetCoverage) || q.onsetCoverage < 0 || q.onsetCoverage > 1) e.push('quality.onsetCoverage: not in 0..1');
    if (!isNum(q.notesPerMinute) || q.notesPerMinute < 0) e.push('quality.notesPerMinute: not a rate');
    if (!Array.isArray(q.warnings) || !q.warnings.every((w) => typeof w === 'string')) e.push('quality.warnings: not a list of strings');
  }

  const s = p.sections;
  if (!Array.isArray(s) || !s.length) e.push('sections: none');
  else {
    s.forEach((x, i) => {
      if (!isObj(x) || !isNum(x.start) || !isNum(x.end) || !isNum(x.novelty)) e.push(`sections[${i}]: not { start, end, novelty }`);
      else if (x.end <= x.start) e.push(`sections[${i}]: ends at ${x.end}, not after its start ${x.start}`);
      else if (i > 0 && isNum(s[i - 1]?.end) && Math.abs(x.start - s[i - 1].end) > EPS) {
        e.push(`sections[${i}]: starts at ${x.start} but sections[${i - 1}] ends at ${s[i - 1].end}: sections must be contiguous`);
      }
    });
    if (!(Math.abs(s[0]?.start) <= EPS)) e.push('sections[0]: does not start at 0');
    if (durOk && !(Math.abs(s[s.length - 1]?.end - duration) <= EPS)) e.push(`sections[${s.length - 1}]: does not end at the duration ${duration}`);
  }
  if (!Array.isArray(p.beats) || !p.beats.every(isNum)) e.push('beats: not a list of times');
  else if (p.beats.some((b, i) => i > 0 && b < p.beats![i - 1])) e.push('beats: not sorted');
  const l = p.loudness;
  if (!isObj(l) || l.hop !== 0.1 || !Array.isArray(l.values)) e.push('loudness: not { hop: 0.1, values }');
  else {
    if (durOk && l.values.length !== loudnessLength(duration)) e.push(`loudness.values: ${l.values.length} values, expected ${loudnessLength(duration)} (one per 0.1 s)`);
    if (!l.values.every((v) => isNum(v) && v >= 0 && v <= 1)) e.push('loudness.values: not all in 0..1');
  }
  if (!Array.isArray(p.harmony)) e.push('harmony: not an array');
  else {
    p.harmony.forEach((h, i) => {
      if (!isObj(h) || !isNum(h.t) || !Number.isInteger(h.root) || h.root < 0 || h.root > 11 || typeof h.minor !== 'boolean') {
        e.push(`harmony[${i}]: not { t, root 0..11, minor }`);
      } else if (i > 0 && h.t < p.harmony![i - 1].t) e.push(`harmony[${i}]: not sorted by time`);
    });
  }
  if (!isObj(p.made) || (p.made.by !== 'ingest' && p.made.by !== 'studio') || typeof p.made.at !== 'string') e.push("made: not { by: 'ingest' | 'studio', at }");
  return e;
}
