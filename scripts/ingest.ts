/**
 * A recording → a song pack the studio plays: songs/<id>/{audio.<ext>, pack.json, notes.gpu.json}.
 *
 *   npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes gpu|approx|<notes file>] [--force] [--progress json]
 *
 * Notes come from the GPU piano transcriber (scripts/ears/transcribe.py through WINKELAMP_PY, the venv or
 * `python`; cached in notes.gpu.json by the audio's sha1), a notes file kept exactly (a lab notes.js or a
 * transcribe.py JSON), or approximated from the analysis. Sections, beats, loudness and chord changes come
 * from the study analysis. Exit codes: 2 usage, 3 the transcriber failed, 4 the audio cannot be decoded.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { analyzeSong } from '../src/audio/song-analysis';
import { STAGE_WEIGHTS, type IngestProgress } from '../src/studio/ingest/ears-types';
import { buildPack, type BuildInput } from '../src/studio/pack/build';
import { parseNotesFile } from '../src/studio/pack/notes';
import { PACK_VERSION, validatePack, type SongPack } from '../src/studio/pack/pack';
import type { Note } from '../src/widgets/types';
import { decodeMono } from './node/decode';
import { isSlug, nameOf, sha1File, songsDir, writeJsonAtomic } from './node/pack-io';
import { findPython, transcribe } from './node/python';

const SR = 44100;
const USAGE = 'usage: npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes gpu|approx|<notes file>] [--force] [--progress json]';
const APPROX_HINT = 'pass --notes approx to use approximate notes from the analysis';

class Exit extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

interface GpuCache { version: 1; sha1: string; size: number; mtimeMs: number; model: string; device: 'cuda' | 'cpu'; seconds: number; notes: { start: number; end: number; midi: number; vel: number }[] }

function args(argv: string[]) {
  const flags = new Map<string, string | true>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') flags.set('force', true);
    else if (['--id', '--title', '--notes', '--progress'].includes(a)) {
      if (i + 1 >= argv.length) throw new Exit(2, `${a} needs a value\n${USAGE}`);
      flags.set(a.slice(2), argv[++i]);
    } else if (a.startsWith('--')) throw new Exit(2, `unknown option ${a}\n${USAGE}`);
    else rest.push(a);
  }
  if (rest.length !== 1) throw new Exit(2, USAGE);
  const file = resolve(rest[0]);
  if (!existsSync(file) || !statSync(file).isFile()) throw new Exit(2, `no such file: ${rest[0]}`);
  const named = nameOf(file);
  const id = (flags.get('id') as string | undefined) ?? named.id;
  if (!isSlug(id)) throw new Exit(2, `"${id}" is not a usable id (lowercase letters, digits and single dashes): pass --id <slug>`);
  const notes = (flags.get('notes') as string | undefined) ?? 'gpu';
  if (notes !== 'gpu' && notes !== 'approx' && !existsSync(notes)) throw new Exit(2, `--notes ${notes}: not gpu, approx or an existing notes file`);
  const progress = flags.get('progress');
  if (progress !== undefined && progress !== 'json') throw new Exit(2, `--progress ${String(progress)}: only json is supported`);
  return { file, id, title: (flags.get('title') as string | undefined) ?? named.title, notes, force: flags.has('force'), json: progress === 'json' };
}

async function main(): Promise<void> {
  const o = args(process.argv.slice(2));
  const t0 = performance.now();
  // With --progress json, stdout carries only progress lines; the human log goes to stderr.
  const log = (s: string) => (o.json ? process.stderr : process.stdout).write(s + '\n');
  const report = (p: IngestProgress) => {
    if (o.json) process.stdout.write(JSON.stringify(p) + '\n');
  };

  const dir = join(songsDir(), o.id);
  const packFile = join(dir, 'pack.json');
  const sha1 = await sha1File(o.file);
  const st = statSync(o.file);
  const kind = o.notes === 'gpu' ? 'gpu' : o.notes === 'approx' ? 'approx' : 'file';
  if (existsSync(packFile) && !o.force) {
    try {
      const old = JSON.parse(readFileSync(packFile, 'utf8')) as SongPack;
      if (old.version === PACK_VERSION && old.source?.sha1 === sha1 && validatePack(old).length === 0) {
        log(`${o.id}: up to date (${old.notesFrom} notes; --force rebuilds it, e.g. with other notes): ${packFile}`);
        report({ stage: 'done', progress: 1, message: 'up to date', id: o.id, warnings: old.quality.warnings });
        return;
      }
      if (old.source?.sha1 !== sha1) log(`${o.id}: replacing the pack of a different recording (${old.source?.name})`);
    } catch {
      log(`${o.id}: the old pack.json is unreadable; rebuilding it`);
    }
  }

  log(`ingest ${o.id}: ${o.file}`);
  mkdirSync(dir, { recursive: true });
  const audioName = 'audio' + extname(o.file).toLowerCase();
  const audio = join(dir, audioName);
  if (resolve(audio) !== o.file) {
    for (const f of readdirSync(dir)) if (/^audio\./.test(f) && f !== audioName) rmSync(join(dir, f));
    copyFileSync(o.file, audio);
  }

  const weights = { ...STAGE_WEIGHTS, transcribe: kind === 'gpu' ? STAGE_WEIGHTS.transcribe : 0 };
  const total = weights.decode + weights.transcribe + weights.analyze + weights.write;
  let lastPct = -1;
  const stage = (s: Exclude<IngestProgress['stage'], 'done'>, f: number, message: string) => {
    report({ stage: s, progress: Math.round(f * 1000) / 1000, message, id: o.id });
    if (!o.json) {
      const order = ['decode', 'transcribe', 'analyze', 'write'] as const;
      let before = 0;
      for (const k of order) {
        if (k === s) break;
        before += weights[k];
      }
      const pct = Math.floor(((before + weights[s] * f) / total) * 20) * 5;
      if (pct !== lastPct && process.stdout.isTTY) process.stdout.write(`\r  ${String(pct).padStart(3)}%  ${message.padEnd(40)}`);
      lastPct = pct;
    }
  };
  const lap = (what: string) => {
    if (!o.json && process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(50) + '\r');
    log(`  ${what.padEnd(40)} ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  };

  // Decode first: a file ffmpeg can't read fails before anything slow starts.
  stage('decode', 0, 'decoding');
  let pcm: Float32Array;
  try {
    pcm = decodeMono(audio, SR);
  } catch (e) {
    throw new Exit(4, `cannot decode ${o.file}: ${(e as Error).message}`);
  }
  if (pcm.length < SR / 10) throw new Exit(4, `cannot decode ${o.file}: no audio in it`);
  stage('decode', 1, 'decoded');
  lap(`decode (${(pcm.length / SR).toFixed(1)} s audio)`);

  let notes: BuildInput['notes'] = null;
  if (kind === 'file') {
    let list: Note[];
    try {
      list = parseNotesFile(readFileSync(o.notes, 'utf8'));
    } catch (e) {
      throw new Exit(2, `--notes ${o.notes}: ${(e as Error).message}`);
    }
    notes = { from: 'file', list, transcriber: null };
    log(`  notes from ${o.notes}: ${list.length}`);
  } else if (kind === 'gpu') {
    const cacheFile = join(dir, 'notes.gpu.json');
    let cache: GpuCache | null = null;
    try {
      const c = JSON.parse(readFileSync(cacheFile, 'utf8')) as GpuCache;
      if (c.version === 1 && c.sha1 === sha1 && Array.isArray(c.notes)) cache = c;
    } catch {
      /* no cache */
    }
    if (cache) {
      stage('transcribe', 1, 'transcription cached');
      lap(`transcribe: cached (${cache.notes.length} notes)`);
    } else {
      if (!findPython()) throw new Exit(3, `the GPU transcriber needs Python and none was found (set WINKELAMP_PY to the venv's python.exe; see scripts/ears/requirements.txt)\n${APPROX_HINT}`);
      stage('transcribe', 0, 'loading the transcriber');
      const tmp = `${cacheFile}.${process.pid}.raw.json`;
      try {
        await transcribe(audio, tmp, (f) => stage('transcribe', f, 'transcribing'));
        const raw = JSON.parse(readFileSync(tmp, 'utf8')) as Omit<GpuCache, 'sha1' | 'size' | 'mtimeMs'>;
        cache = { version: 1, sha1, size: st.size, mtimeMs: st.mtimeMs, model: raw.model, device: raw.device, seconds: raw.seconds, notes: raw.notes };
        writeJsonAtomic(cacheFile, cache);
      } catch (e) {
        throw new Exit(3, `the GPU transcriber failed: ${(e as Error).message}\n${APPROX_HINT}`);
      } finally {
        rmSync(tmp, { force: true });
      }
      lap(`transcribe on ${cache.device} (${cache.notes.length} notes)`);
    }
    notes = { from: 'gpu', list: parseNotesFile(JSON.stringify(cache)), transcriber: { model: cache.model, device: cache.device, seconds: cache.seconds } };
  }

  stage('analyze', 0, 'analysing');
  const analysis = analyzeSong(pcm, SR, (f) => stage('analyze', f, 'analysing'));
  lap(`analysis (${analysis.sections.length} sections, ${analysis.onsets.length} onsets)`);

  stage('write', 0, 'writing');
  const pack = buildPack({
    id: o.id, title: o.title, audio: audioName, source: { name: o.file.split(/[\\/]/).pop()!, bytes: st.size, sha1 },
    analysis, notes, by: 'ingest', at: new Date().toISOString(),
  });
  const errors = validatePack(pack);
  if (errors.length) throw new Exit(1, `internal error: the pack does not validate:\n  ${errors.join('\n  ')}`);
  writeJsonAtomic(packFile, pack);
  stage('write', 1, 'written');
  lap('write');

  for (const w of pack.quality.warnings) log(`  warning: ${w}`);
  log(`done: ${pack.notes.length} notes (${pack.notesFrom}, coverage ${Math.round(pack.quality.onsetCoverage * 100)}%), ` +
    `${pack.sections.length} sections, ${pack.beats.length} beats, ${pack.harmony.length} chord changes, ${pack.duration.toFixed(1)} s`);
  log(`  ${packFile}`);
  report({ stage: 'done', progress: 1, message: 'done', id: o.id, warnings: pack.quality.warnings });
}

main().catch((e: unknown) => {
  const code = e instanceof Exit ? e.code : 1;
  process.stderr.write(`ingest: ${e instanceof Error ? (e instanceof Exit ? e.message : e.stack ?? e.message) : String(e)}\n`);
  process.exit(code);
});
