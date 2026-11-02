/**
 * A song pack: everything the studio needs to play a recording, computed once by
 * `npm run ingest` (or the studio's in-browser fallback) into songs/<id>/pack.json.
 */
import { loudnessLength } from '../../audio/song-analysis';
import type { Family, Note, TrackId } from '../../widgets/types';
import { TRACKS, isTrackId } from './instruments';

/** What ingest writes now; validatePack still reads 1 (no kind, tracks or transcribers). */
export const PACK_VERSION = 2;
export type NotesSource = 'gpu' | 'file' | 'approx' | 'merged' | 'hybrid' | 'ymt3' | 'bp-hybrid' | 'ms-hybrid';
/** One instrument's notes, from YourMT3+ (spec Decisions 2) or MuScriptor. */
export interface Track {
  /** Plain English for the UI ("Violins", "French horns"). */
  label: string;
  family: Family;
  /** Every note the transcriber gave the track, with estimated velocities, sorted by start. */
  notes: Note[];
  /** Of the song's track-making notes (drums and empty rows dropped), 0..1. */
  share: number;
  /** How many velocities were borrowed from a piano-model note / estimated from loudness. */
  vel: { borrowed: number; level: number };
  /** Which transcriber made it; absent = YourMT3+ (old packs, and every pack made without the option). */
  from?: 'ymt3' | 'muscriptor';
}
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (s: unknown): s is string => typeof s === 'string' && SLUG.test(s);

export interface SongPack {
  version: 1 | 2;
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
  /**
   * gpu | file (--notes <file>, kept exactly) | approx (analysis only) | merged (gpu + approx) | hybrid (piano model +
   * YourMT3 in its gaps) | ymt3 (YourMT3 alone) | bp-hybrid (piano model + basic-pitch in its gaps) | ms-hybrid (piano
   * model + MuScriptor, with its keyboard lane, in its gaps).
   */
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
  // v2 (all optional, so a v1 pack is a v2 pack without them).
  /** Solo piano keeps the piano model's notes; an ensemble gets the hybrid and tracks. Absent: not decided (no notes model). */
  kind?: 'piano' | 'ensemble';
  /** The track-making transcriber's piano share (spec Decisions 1); null without one. */
  pianoShare?: number | null;
  /** Only an ensemble with YourMT3 or MuScriptor has tracks; only tracks with enough notes are written. */
  tracks?: Partial<Record<TrackId, Track>>;
  /** Every model that ran for this pack; `instruments` is the list MuScriptor was given. */
  transcribers?: { name: 'piano' | 'ymt3' | 'bp' | 'muscriptor'; model: string; seconds: number; notes: number; instruments?: string[] }[];
}

const SOURCES: readonly NotesSource[] = ['gpu', 'file', 'approx', 'merged', 'hybrid', 'ymt3', 'bp-hybrid', 'ms-hybrid'];
const KINDS = ['piano', 'ensemble'] as const;
const TRANSCRIBERS = ['piano', 'ymt3', 'bp', 'muscriptor'] as const;
const TRACK_FROM = ['ymt3', 'muscriptor'] as const;
/** Section edges may differ from each other or from 0 / duration by rounding (ms). */
const EPS = 2e-3;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** [] = valid; each message names the field. */
export function validatePack(x: unknown): string[] {
  const e: string[] = [];
  if (!isObj(x)) return ['pack: not an object'];
  const p = x as Partial<SongPack>;
  if (p.version !== 1 && p.version !== 2) e.push(`version: ${String(p.version)}, expected 1 or ${PACK_VERSION}`);
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

  e.push(...noteListErrors(p.notes, 'notes', false));
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
  if (p.version === 1) {
    for (const k of ['kind', 'pianoShare', 'tracks', 'transcribers'] as const) if (k in p) e.push(`${k}: a version 1 pack has none (version 2 has)`);
  } else if (p.version === 2) e.push(...v2Errors(p));
  return e;
}

/** A note list: [start, end, midi, vel] sorted by start; `strict`: end > start (tracks), else end ≥ start (all notes). */
function noteListErrors(list: unknown, field: string, strict: boolean): string[] {
  if (!Array.isArray(list)) return [`${field}: not an array`];
  // Five complaints are enough to fix a 9000-note list.
  const errs: string[] = [];
  let prev = -Infinity;
  for (let i = 0; i < list.length && errs.length < 5; i++) {
    const n = list[i] as unknown;
    if (!Array.isArray(n) || n.length !== 4 || !n.every(isNum)) errs.push(`${field}[${i}]: not [start, end, midi, vel]`);
    else if (n[1] < n[0] || (strict && n[1] === n[0])) errs.push(`${field}[${i}]: end ${n[1]} ${strict ? 'not after' : 'before'} start ${n[0]}`);
    else if (n[2] < 0 || n[2] > 127 || n[3] < 0 || n[3] > 127) errs.push(`${field}[${i}]: midi or vel outside 0..127`);
    else if (n[0] < prev) errs.push(`${field}[${i}]: starts at ${n[0]}, before the note above it (${prev}): notes must be sorted by start`);
    if (Array.isArray(n) && isNum(n[0])) prev = Math.max(prev, n[0]);
  }
  return errs;
}

function v2Errors(p: Partial<SongPack>): string[] {
  const e: string[] = [];
  if (p.kind !== undefined && !KINDS.includes(p.kind)) e.push(`kind: ${JSON.stringify(p.kind)} is not one of ${KINDS.join(', ')}`);
  if (p.pianoShare !== undefined && p.pianoShare !== null && !(isNum(p.pianoShare) && p.pianoShare >= 0 && p.pianoShare <= 1)) {
    e.push('pianoShare: neither null nor in 0..1');
  }
  if (p.tracks !== undefined) {
    if (!isObj(p.tracks)) e.push('tracks: not an object');
    else {
      for (const [id, t] of Object.entries(p.tracks as Record<string, unknown>)) {
        const f = `tracks.${id}`;
        if (!isTrackId(id)) { e.push(`${f}: not a track id (one of ${Object.keys(TRACKS).join(', ')})`); continue; }
        if (!isObj(t)) { e.push(`${f}: not an object`); continue; }
        if (typeof t.label !== 'string' || !t.label) e.push(`${f}.label: not a name`);
        if (t.family !== TRACKS[id].family) e.push(`${f}.family: ${JSON.stringify(t.family)}, but ${id} is ${TRACKS[id].family}`);
        e.push(...noteListErrors(t.notes, `${f}.notes`, true));
        if (!isNum(t.share) || t.share < 0 || t.share > 1) e.push(`${f}.share: not in 0..1`);
        const v = t.vel;
        if (!isObj(v) || !Number.isInteger(v.borrowed) || !Number.isInteger(v.level) || (v.borrowed as number) < 0 || (v.level as number) < 0) {
          e.push(`${f}.vel: not { borrowed, level } counts`);
        }
        if (t.from !== undefined && !TRACK_FROM.includes(t.from as never)) e.push(`${f}.from: ${JSON.stringify(t.from)} is not one of ${TRACK_FROM.join(', ')}`);
      }
    }
  }
  if (p.transcribers !== undefined) {
    if (!Array.isArray(p.transcribers)) e.push('transcribers: not a list');
    else {
      p.transcribers.forEach((t: unknown, i) => {
        if (!isObj(t) || !TRANSCRIBERS.includes(t.name as never) || typeof t.model !== 'string' || !isNum(t.seconds) || t.seconds < 0
          || !Number.isInteger(t.notes) || (t.notes as number) < 0) {
          e.push(`transcribers[${i}]: not { name: ${TRANSCRIBERS.join(' | ')}, model, seconds, notes }`);
        } else if (t.instruments !== undefined && !(Array.isArray(t.instruments) && t.instruments.every((x) => typeof x === 'string'))) {
          e.push(`transcribers[${i}].instruments: not a list of strings`);
        }
      });
    }
  }
  return e;
}
