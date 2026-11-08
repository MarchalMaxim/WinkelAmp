// Adds the zero-lag energy lane (src/audio/energy.ts) to a song pack made before it: scripts/augment-pack.ts runs it
// over songs/. Only the key `energy` is added; every other byte of pack.json stays as it was, and that is checked.
import { constants, copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { energyLane } from '../../src/audio/energy';
import { loudnessLength } from '../../src/audio/song-analysis';
import { validatePack } from '../../src/studio/pack/pack';

/** The rate ingest decodes at (scripts/ingest.ts SR): the pack's duration is pcm.length / this. */
export const AUGMENT_RATE = 44100;
/** How far the decoded length may stray from pack.duration before the lane is not trusted to line up (seconds). */
export const MAX_DRIFT = 0.25;
export const BACKUP = 'pack.before-energy.json';

export interface AugmentResult { status: 'done' | 'skipped' | 'failed'; why: string }

/** The indents JSON.stringify could have written this text with (packs are written compact: writeJsonAtomic). */
function formatOf(text: string, value: unknown): { indent: undefined | number | string; newline: boolean } | null {
  const newline = text.endsWith('\n');
  const body = newline ? text.slice(0, -1) : text;
  for (const indent of [undefined, 2, '\t', 4]) if (JSON.stringify(value, null, indent) === body) return { indent, newline };
  return null;
}

/**
 * One song folder. `decode(file, rate)` gives mono float PCM (scripts/node/decode.ts decodeMono; tests pass their own).
 * Backs pack.json up as pack.before-energy.json first (an existing backup is kept: it is the oldest original), writes
 * the new pack atomically, re-reads it and compares everything but `energy` with what was there; on any difference
 * the old text goes back.
 */
export function augmentSong(dir: string, decode: (file: string, rate: number) => Float32Array, o: { force?: boolean } = {}): AugmentResult {
  const file = join(dir, 'pack.json');
  if (!existsSync(file)) return { status: 'skipped', why: 'no pack.json' };
  const before = readFileSync(file, 'utf8');
  let pack: Record<string, unknown>;
  try { pack = JSON.parse(before) as Record<string, unknown>; } catch (e) { return { status: 'failed', why: `pack.json is not JSON: ${(e as Error).message}` }; }
  if ('energy' in pack && !o.force) return { status: 'skipped', why: 'has energy already (--force-energy to redo it)' };
  const problems = validatePack(pack);
  if (problems.length) return { status: 'failed', why: `not a valid pack: ${problems.slice(0, 3).join('; ')}` };
  const format = formatOf(before, pack);
  if (!format) return { status: 'failed', why: 'pack.json is not written the way JSON.stringify writes it: left alone' };
  const audio = typeof pack.audio === 'string' ? join(dir, pack.audio) : '';
  if (!audio || !existsSync(audio)) return { status: 'failed', why: `no audio file ${String(pack.audio)}` };

  let pcm: Float32Array;
  try { pcm = decode(audio, AUGMENT_RATE); } catch (e) { return { status: 'failed', why: `cannot decode ${pack.audio}: ${(e as Error).message}` }; }
  const duration = pack.duration as number, drift = pcm.length / AUGMENT_RATE - duration;
  if (!(Math.abs(drift) <= MAX_DRIFT)) return { status: 'failed', why: `decoded ${(pcm.length / AUGMENT_RATE).toFixed(3)} s, the pack says ${duration} s` };
  const energy = energyLane(pcm, AUGMENT_RATE, loudnessLength(duration));

  const rest = { ...pack };
  delete rest.energy;
  const next = { ...rest, energy };
  if (validatePack(next).length) return { status: 'failed', why: `the new pack does not validate: ${validatePack(next).slice(0, 3).join('; ')}` };
  const text = JSON.stringify(next, null, format.indent) + (format.newline ? '\n' : '');

  const backup = join(dir, BACKUP);
  try { copyFileSync(file, backup, constants.COPYFILE_EXCL); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return { status: 'failed', why: `cannot back up pack.json: ${(e as Error).message}` };
  }
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, file);
  } finally { rmSync(tmp, { force: true }); }

  // The proof: re-read, drop energy, and it must be what was there, key order and all.
  const restore = (why: string): AugmentResult => { writeFileSync(file, before); return { status: 'failed', why: `${why}: pack.json restored` }; };
  let again: Record<string, unknown>;
  try { again = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>; } catch { return restore('the written pack does not parse'); }
  const kept = { ...again };
  delete kept.energy;
  if (!isDeepStrictEqual(kept, rest) || JSON.stringify(kept) !== JSON.stringify(rest)) return restore('the written pack differs from the old one outside energy');
  if (!isDeepStrictEqual(again.energy, JSON.parse(JSON.stringify(energy)))) return restore('the written energy lane is not the computed one');
  const n = energy.momentary.length;
  return { status: 'done', why: `${n} values, decoded length ${drift >= 0 ? '+' : ''}${(drift * 1000).toFixed(1)} ms from the pack's` };
}
