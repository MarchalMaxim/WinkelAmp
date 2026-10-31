/**
 * A recording → a song pack the studio plays: songs/<id>/{audio.<ext>, pack.json, notes.gpu.json, notes.ymt3.json,
 * notes.bp.json}.
 *
 *   npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes auto|gpu|hybrid|ymt3|bp|approx|<notes file>]
 *     [--piano-notes <notes file>] [--kind auto|piano|ensemble] [--redo piano|ymt3|bp] [--force] [--progress json]
 *
 * Three transcribers, each cached in the song's folder by the audio's sha1 (and its model, revision or settings):
 * - the GPU piano model (scripts/ears/transcribe.py through WINKELAMP_PY, the venv or `python`): notes.gpu.json;
 * - YourMT3+ (scripts/ears/ymt3.py through ymt3.json, `npm run setup-ymt3`): instrument notes, notes.ymt3.json;
 * - basic-pitch (scripts/ears/bp.py through WINKELAMP_PY_BP or the wa-bp venv): the gap fill without YourMT3, notes.bp.json.
 *
 * --notes auto (the default) runs the piano model and YourMT3+, decides piano or ensemble (YourMT3's piano share, else
 * the piano model's coverage), and for an ensemble fills the piano model's gaps with YourMT3's notes and writes the
 * instrument tracks. Whatever is missing falls back a row (YourMT3 → basic-pitch → the piano model alone → approximate
 * notes), with a warning in the pack; auto never fails for a missing transcriber. gpu, hybrid, ymt3 and bp ask for
 * those transcribers and fail (exit 3) without them; approx uses the analysis only; a notes file is kept exactly
 * (a lab notes.js or a transcribe.py JSON). --piano-notes uses a notes file as the piano model's notes without
 * running it. --kind piano skips YourMT3 and basic-pitch. --redo re-runs a transcriber instead of reading its cache
 * (and rebuilds the pack). Sections, beats, loudness and chord changes come from the study analysis.
 * Exit codes: 2 usage, 3 a transcriber that was asked for failed, 4 the audio cannot be decoded.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { analyzeSong } from '../src/audio/song-analysis';
import type { IngestProgress } from '../src/studio/ingest/ears-types';
import { overallOf, stageWeights, type Stage } from '../src/studio/ingest/progress';
import { buildPack, WARN_NO_YMT3, type BuildInput } from '../src/studio/pack/build';
import { parseNotesFile } from '../src/studio/pack/notes';
import { PACK_VERSION, validatePack, type SongPack } from '../src/studio/pack/pack';
import { cleanRows, onsetLevels, type Ymt3Row } from '../src/studio/pack/tracks';
import type { Note } from '../src/widgets/types';
import { decodeMono } from './node/decode';
import { isSlug, nameOf, sha1File, songsDir, writeJsonAtomic } from './node/pack-io';
import { BP_HINT, BP_SETTINGS, findPython, findPythonBp, runBp, transcribe } from './node/python';
import { findYmt3, runYmt3, SETUP_HINT } from './node/ymt3';

const SR = 44100;
const MODES = ['auto', 'gpu', 'hybrid', 'ymt3', 'bp', 'approx'] as const;
type Mode = (typeof MODES)[number] | 'file';
const TOOLS = ['piano', 'ymt3', 'bp'] as const;
type Tool = (typeof TOOLS)[number];
/** What ymt3.py writes as its model (its cache keys on it, the revision and the sha1). */
const YMT3_MODEL = 'yourmt3-moe';
const USAGE = 'usage: npm run ingest -- <audio> [--id <slug>] [--title "<t>"] [--notes auto|gpu|hybrid|ymt3|bp|approx|<notes file>] ' +
  '[--piano-notes <notes file>] [--kind auto|piano|ensemble] [--redo piano|ymt3|bp] [--force] [--progress json]';
const FALLBACK_HINT = 'pass --notes auto to fall back on what can run, or --notes approx for approximate notes from the analysis';

class Exit extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

/** Undoes what a failed run left behind (the folder a fresh ingest made); cleared once pack.json is written. */
let onFail: (() => void) | null = null;

interface GpuCache { version: 1; sha1: string; size: number; mtimeMs: number; model: string; device: 'cuda' | 'cpu'; seconds: number; notes: { start: number; end: number; midi: number; vel: number }[] }
interface Ymt3Cache { version: 1; sha1: string; model: string; revision: string; seconds: number; notes: Ymt3Row[] }
interface BpCache { version: 1; sha1: string; model: string; settings: typeof BP_SETTINGS; seconds: number; notes: Note[] }

function args(argv: string[]) {
  const flags = new Map<string, string | true>();
  const redo = new Set<Tool>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') flags.set('force', true);
    else if (['--id', '--title', '--notes', '--progress', '--piano-notes', '--kind', '--redo'].includes(a)) {
      if (i + 1 >= argv.length) throw new Exit(2, `${a} needs a value\n${USAGE}`);
      const v = argv[++i];
      if (a === '--redo') {
        for (const t of v.split(',')) {
          if (!(TOOLS as readonly string[]).includes(t)) throw new Exit(2, `--redo ${t}: not piano, ymt3 or bp`);
          redo.add(t as Tool);
        }
      } else flags.set(a.slice(2), v);
    } else if (a.startsWith('--')) throw new Exit(2, `unknown option ${a}\n${USAGE}`);
    else rest.push(a);
  }
  if (rest.length !== 1) throw new Exit(2, USAGE);
  const file = resolve(rest[0]);
  if (!existsSync(file) || !statSync(file).isFile()) throw new Exit(2, `no such file: ${rest[0]}`);
  const named = nameOf(file);
  const id = (flags.get('id') as string | undefined) ?? named.id;
  if (!isSlug(id)) throw new Exit(2, `"${id}" is not a usable id (lowercase letters, digits and single dashes): pass --id <slug>`);
  const notesArg = (flags.get('notes') as string | undefined) ?? 'auto';
  const mode: Mode = (MODES as readonly string[]).includes(notesArg) ? (notesArg as Mode) : 'file';
  if (mode === 'file' && !existsSync(notesArg)) throw new Exit(2, `--notes ${notesArg}: not ${MODES.join(', ')} or an existing notes file`);
  const pianoNotes = flags.get('piano-notes') as string | undefined;
  if (pianoNotes !== undefined) {
    if (!existsSync(pianoNotes)) throw new Exit(2, `--piano-notes ${pianoNotes}: no such file`);
    if (mode === 'file' || mode === 'approx') throw new Exit(2, `--piano-notes goes with --notes auto, gpu, hybrid, ymt3 or bp, not ${notesArg}`);
  }
  const kindArg = (flags.get('kind') as string | undefined) ?? 'auto';
  if (kindArg !== 'auto' && kindArg !== 'piano' && kindArg !== 'ensemble') throw new Exit(2, `--kind ${kindArg}: not auto, piano or ensemble`);
  const kind: 'piano' | 'ensemble' | undefined = kindArg === 'auto' ? undefined : kindArg;
  if (kind === 'piano' && (mode === 'hybrid' || mode === 'ymt3')) throw new Exit(2, `--kind piano skips YourMT3, which --notes ${mode} needs`);
  const progress = flags.get('progress');
  if (progress !== undefined && progress !== 'json') throw new Exit(2, `--progress ${String(progress)}: only json is supported`);
  return {
    file, id, title: (flags.get('title') as string | undefined) ?? named.title, mode, notesFile: mode === 'file' ? notesArg : null,
    pianoNotes: pianoNotes ?? null, kind, redo, force: flags.has('force') || redo.size > 0, json: progress === 'json',
  };
}

const firstLine = (s: string) => s.split('\n').map((l) => l.trim()).find((l) => l && !/^ingest:/.test(l))?.slice(0, 300) ?? s.slice(0, 300);
const readJson = <T>(path: string): T | null => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
};
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const okRow = (r: unknown): r is Ymt3Row => Array.isArray(r) && r.length >= 5 && isNum(r[0]) && isNum(r[1]) && isNum(r[2]) && isNum(r[3]) && typeof r[4] === 'string';
const okNote = (n: unknown): n is Note => Array.isArray(n) && n.length >= 4 && isNum(n[0]) && isNum(n[1]) && isNum(n[2]) && isNum(n[3]);

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
  const audioName = 'audio' + extname(o.file).toLowerCase();
  const audio = join(dir, audioName);
  // Re-running on the pack's own audio (e.g. the ears server's redo): nothing to copy, and the original name stays.
  const inPlace = resolve(audio) === o.file;
  let old: SongPack | null = null;
  if (existsSync(packFile)) {
    old = readJson<SongPack>(packFile);
    if (!old) log(`${o.id}: the old pack.json is unreadable; rebuilding it`);
  }
  if (old && !o.force) {
    if (old.version === PACK_VERSION && old.source?.sha1 === sha1 && validatePack(old).length === 0 &&
      existsSync(join(dir, old.audio))) {
      log(`${o.id}: up to date (${old.notesFrom} notes; --force rebuilds it, e.g. with other notes): ${packFile}`);
      report({ stage: 'done', progress: 1, overall: 1, message: 'up to date', id: o.id, warnings: old.quality.warnings });
      return;
    }
    if (old.source?.sha1 !== sha1) log(`${o.id}: replacing the pack of a different recording (${old.source?.name})`);
  }
  const sourceName = inPlace && old?.source?.name ? old.source.name : basename(o.file);

  // What runs. auto: everything that can, falling back; the named modes need their transcribers.
  const usePiano = !o.pianoNotes && ['auto', 'gpu', 'hybrid', 'ymt3', 'bp'].includes(o.mode);
  const useYmt3 = ['auto', 'hybrid', 'ymt3'].includes(o.mode) && o.kind !== 'piano';
  const bpFallback = o.mode === 'auto' && o.kind !== 'piano';
  const need = { piano: o.mode === 'gpu' || o.mode === 'hybrid', ymt3: o.mode === 'hybrid' || o.mode === 'ymt3', bp: o.mode === 'bp' };

  log(`ingest ${o.id}: ${o.file}`);
  // The old pack and its audio stay as they are until the new pack is ready: decode and transcribe read the input where
  // it is, and the audio is swapped in just before pack.json is written (only the transcribers' caches, keyed by sha1,
  // may be replaced earlier, so a re-ingest that fails after a long transcription keeps them). A fresh ingest that
  // fails takes its folder with it, caches included: the library never sees a folder without a pack.
  if (!existsSync(dir)) onFail = () => rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const weights = stageWeights({ transcribe: usePiano, instruments: useYmt3 || bpFallback || o.mode === 'bp' });
  let overall = 0, lastPct = -1;
  const stage = (s: Stage, f: number, message: string) => {
    overall = Math.max(overall, overallOf(weights, s, f));
    report({ stage: s, progress: Math.round(Math.min(1, Math.max(0, f)) * 1000) / 1000, overall: Math.round(overall * 1000) / 1000, message, id: o.id });
    if (!o.json) {
      const pct = Math.floor(overall * 20) * 5;
      if (pct !== lastPct && process.stdout.isTTY) process.stdout.write(`\r  ${String(pct).padStart(3)}%  ${message.padEnd(40)}`);
      lastPct = pct;
    }
  };
  let lapAt = t0;
  const lap = (what: string) => {
    if (!o.json && process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(50) + '\r');
    const now = performance.now();
    log(`  ${what.padEnd(48)} ${((now - lapAt) / 1000).toFixed(1).padStart(6)} s  (at ${((now - t0) / 1000).toFixed(1)} s)`);
    lapAt = now;
  };

  // Decode first: a file ffmpeg can't read fails before anything slow starts. 44.1 kHz mono serves the analysis
  // and the loudness every estimated velocity comes from.
  stage('decode', 0, 'decoding');
  let pcm: Float32Array;
  try {
    pcm = decodeMono(o.file, SR);
  } catch (e) {
    throw new Exit(4, `cannot decode ${o.file}: ${(e as Error).message}`);
  }
  if (pcm.length < SR / 10) throw new Exit(4, `cannot decode ${o.file}: no audio in it`);
  stage('decode', 1, 'decoded');
  lap(`decode (${(pcm.length / SR).toFixed(1)} s audio)`);

  const extra: string[] = [];

  // 1. The piano model (or the notes standing in for it).
  let notes: BuildInput['notes'] = null;
  const parseFile = (path: string, flag: string): Note[] => {
    try {
      return parseNotesFile(readFileSync(path, 'utf8'));
    } catch (e) {
      throw new Exit(2, `${flag} ${path}: ${(e as Error).message}`);
    }
  };
  if (o.notesFile) {
    const list = parseFile(o.notesFile, '--notes');
    notes = { from: 'file', list, transcriber: null };
    log(`  notes from ${o.notesFile}: ${list.length}`);
  } else if (o.pianoNotes) {
    const list = parseFile(o.pianoNotes, '--piano-notes');
    notes = { from: 'gpu', list, transcriber: null };
    log(`  piano-model notes from ${o.pianoNotes}: ${list.length}`);
  } else if (usePiano) {
    const cacheFile = join(dir, 'notes.gpu.json');
    let cache: GpuCache | null = null;
    if (!o.redo.has('piano')) {
      const c = readJson<GpuCache>(cacheFile);
      if (c && c.version === 1 && c.sha1 === sha1 && Array.isArray(c.notes)) cache = c;
    }
    if (cache) {
      stage('transcribe', 1, 'piano notes cached');
      lap(`piano model: cached (${cache.notes.length} notes)`);
    } else {
      let why: string | null = null;
      if (!findPython()) why = 'the piano model needs Python and none was found (set WINKELAMP_PY to the venv\'s python.exe; see scripts/ears/requirements.txt)';
      else {
        stage('transcribe', 0, 'loading the piano model');
        const tmp = `${cacheFile}.${process.pid}.raw.json`;
        try {
          await transcribe(o.file, tmp, (f) => stage('transcribe', f, 'transcribing the piano'));
          const raw = JSON.parse(readFileSync(tmp, 'utf8')) as Omit<GpuCache, 'sha1' | 'size' | 'mtimeMs'>;
          if (!Array.isArray(raw.notes)) throw new Error('its output has no notes');
          cache = { version: 1, sha1, size: st.size, mtimeMs: st.mtimeMs, model: raw.model, device: raw.device, seconds: raw.seconds, notes: raw.notes };
          writeJsonAtomic(cacheFile, cache);
        } catch (e) {
          why = `the piano model failed: ${(e as Error).message}`;
        } finally {
          rmSync(tmp, { force: true });
        }
      }
      if (why) {
        if (need.piano) throw new Exit(3, `${why}\n${FALLBACK_HINT}`);
        extra.push(`the piano model could not run (${firstLine(why)})`);
        stage('transcribe', 1, 'no piano model');
        lap('piano model: unavailable');
      } else lap(`piano model on ${cache!.device} (${cache!.notes.length} notes)`);
    }
    if (cache) notes = { from: 'gpu', list: parseNotesFile(JSON.stringify(cache)), transcriber: { model: cache.model, device: cache.device, seconds: cache.seconds } };
  }

  // 2. The instruments: YourMT3+, else basic-pitch's gap fill.
  let ymt3: BuildInput['ymt3'] = null;
  let ymt3Missing = false;
  if (useYmt3) {
    const cacheFile = join(dir, 'notes.ymt3.json');
    const found = findYmt3();
    let cache: Ymt3Cache | null = null;
    if (!o.redo.has('ymt3')) {
      const c = readJson<Ymt3Cache>(cacheFile);
      // A cache made by another revision is stale; without an install, the cache of this recording still serves.
      if (c && c.version === 1 && c.sha1 === sha1 && c.model === YMT3_MODEL && Array.isArray(c.notes) && c.notes.every(okRow) &&
        ('missing' in found || c.revision === found.config.revision)) cache = c;
    }
    if (cache) {
      stage('instruments', 0.5, 'instrument notes cached');
      lap(`YourMT3+: cached (${cache.notes.length} notes)`);
    } else {
      let why: string | null = null;
      if ('missing' in found) {
        why = found.missing;
        ymt3Missing = true;
      } else {
        stage('instruments', 0, 'loading YourMT3+');
        const tmp = `${cacheFile}.${process.pid}.raw.json`;
        try {
          await runYmt3(o.file, tmp, (f) => stage('instruments', f * 0.9, 'hearing the instruments'));
          const raw = JSON.parse(readFileSync(tmp, 'utf8')) as Partial<Ymt3Cache>;
          if (!Array.isArray(raw.notes) || !raw.notes.every(okRow)) throw new Error('its output has no notes array of [start, end, midi, vel, class]');
          cache = { version: 1, sha1, model: String(raw.model ?? YMT3_MODEL), revision: String(raw.revision ?? found.config.revision), seconds: Number(raw.seconds) || 0, notes: raw.notes };
          writeJsonAtomic(cacheFile, cache);
        } catch (e) {
          why = `YourMT3+ failed: ${(e as Error).message}`;
        } finally {
          rmSync(tmp, { force: true });
        }
      }
      if (why) {
        if (need.ymt3) throw new Exit(3, `${why}\n${FALLBACK_HINT}`);
        if (!ymt3Missing) extra.push(firstLine(why));
        lap(`YourMT3+: unavailable (${ymt3Missing ? `not set up: ${SETUP_HINT}` : 'it failed'})`);
      } else lap(`YourMT3+ (${cache!.notes.length} notes, ${cache!.seconds.toFixed(1)} s)`);
    }
    if (cache) ymt3 = { rows: cache.notes, levels: onsetLevels(pcm, SR, cache.notes.map((r) => r[0])), model: cache.model, seconds: cache.seconds };
  }

  let bp: BuildInput['bp'] = null;
  let bpWhy: string | null = null;
  if (o.mode === 'bp' || (bpFallback && (!ymt3 || cleanRows(ymt3.rows).length === 0))) {
    const cacheFile = join(dir, 'notes.bp.json');
    let cache: BpCache | null = null;
    if (!o.redo.has('bp')) {
      const c = readJson<BpCache>(cacheFile);
      const same = !!c?.settings && (Object.keys(BP_SETTINGS) as (keyof typeof BP_SETTINGS)[]).every((k) => c.settings[k] === BP_SETTINGS[k]);
      if (c && c.version === 1 && c.sha1 === sha1 && same && Array.isArray(c.notes) && c.notes.every(okNote)) cache = c;
    }
    if (cache) {
      stage('instruments', 0.95, 'gap-fill notes cached');
      lap(`basic-pitch: cached (${cache.notes.length} notes)`);
    } else {
      if (!findPythonBp()) bpWhy = `basic-pitch is not set up: ${BP_HINT}`;
      else {
        stage('instruments', 0.5, 'basic-pitch');
        const tmp = `${cacheFile}.${process.pid}.raw.json`;
        try {
          await runBp(o.file, tmp, (f) => stage('instruments', 0.5 + f * 0.45, 'filling the gaps (basic-pitch)'));
          const raw = JSON.parse(readFileSync(tmp, 'utf8')) as Partial<BpCache>;
          if (!Array.isArray(raw.notes) || !raw.notes.every(okNote)) throw new Error('its output has no notes array of [start, end, midi, vel]');
          cache = { version: 1, sha1, model: String(raw.model ?? 'basic-pitch'), settings: { ...BP_SETTINGS }, seconds: Number(raw.seconds) || 0, notes: raw.notes };
          writeJsonAtomic(cacheFile, cache);
        } catch (e) {
          bpWhy = `basic-pitch failed: ${(e as Error).message}`;
        } finally {
          rmSync(tmp, { force: true });
        }
      }
      if (bpWhy) {
        if (need.bp) throw new Exit(3, `${bpWhy}\n${FALLBACK_HINT}`);
        lap('basic-pitch: unavailable');
      } else lap(`basic-pitch (${cache!.notes.length} notes, ${cache!.seconds.toFixed(1)} s)`);
    }
    if (cache) {
      const list = cache.notes.map((n): Note => [n[0], n[1], n[2], n[3]]);
      bp = { notes: list, levels: onsetLevels(pcm, SR, list.map((n) => n[0])), model: cache.model, seconds: cache.seconds };
    }
  }
  if (weights.instruments > 0) stage('instruments', 1, 'instruments heard');

  stage('analyze', 0, 'analysing');
  const analysis = analyzeSong(pcm, SR, (f) => stage('analyze', f, 'analysing'));
  lap(`analysis (${analysis.sections.length} sections, ${analysis.onsets.length} onsets)`);

  stage('write', 0, 'writing');
  const pack = buildPack({
    id: o.id, title: o.title, audio: audioName, source: { name: sourceName, bytes: st.size, sha1 },
    analysis, notes, by: 'ingest', at: new Date().toISOString(), ymt3, bp, kind: o.kind,
    notesMode: o.mode === 'hybrid' || o.mode === 'bp' ? 'hybrid' : o.mode === 'ymt3' ? 'ymt3' : 'auto',
  });
  // Say why, where buildPack can only say what: a YourMT3+ that was not asked for is not "not set up", and a
  // basic-pitch that failed on an ensemble is why only the piano model's notes are there.
  const w = pack.quality.warnings;
  if (!useYmt3 && w.includes(WARN_NO_YMT3)) {
    w[w.indexOf(WARN_NO_YMT3)] = o.kind === 'piano' ? 'no instrument tracks: --kind piano skips YourMT3'
      : `no instrument tracks: --notes ${o.notesFile ? '<file>' : o.mode} does not run YourMT3`;
  }
  if (bpWhy && pack.kind === 'ensemble' && pack.notesFrom !== 'bp-hybrid' && !/not set up/.test(bpWhy)) extra.push(firstLine(bpWhy));
  for (const x of extra) if (!w.includes(x)) w.push(x);

  const errors = validatePack(pack);
  if (errors.length) throw new Exit(1, `internal error: the pack does not validate:\n  ${errors.join('\n  ')}`);
  if (!inPlace) {
    // Copy beside it, then rename: a failed copy never leaves half a recording under the pack's audio name.
    const tmpAudio = `${audio}.${process.pid}.tmp`;
    try {
      copyFileSync(o.file, tmpAudio);
      renameSync(tmpAudio, audio);
    } finally {
      rmSync(tmpAudio, { force: true });
    }
  }
  writeJsonAtomic(packFile, pack);
  onFail = null;
  for (const f of readdirSync(dir)) if (/^audio\./.test(f) && f !== audioName) rmSync(join(dir, f), { force: true });
  stage('write', 1, 'written');
  lap('write');

  for (const x of pack.quality.warnings) log(`  warning: ${x}`);
  const tracks = Object.entries(pack.tracks ?? {}).map(([id, t]) => `${id} ${t!.notes.length}`);
  log(`done: ${pack.notes.length} notes (${pack.notesFrom}, coverage ${Math.round(pack.quality.onsetCoverage * 100)}%), ` +
    `kind ${pack.kind ?? 'undecided'}, piano share ${pack.pianoShare ?? 'n/a'}, ` +
    `${pack.sections.length} sections, ${pack.beats.length} beats, ${pack.harmony.length} chord changes, ${pack.duration.toFixed(1)} s`);
  if (tracks.length) log(`  tracks: ${tracks.join(', ')}`);
  log(`  ${packFile}`);
  report({ stage: 'done', progress: 1, overall: 1, message: 'done', id: o.id, warnings: pack.quality.warnings });
}

main().catch((e: unknown) => {
  try {
    onFail?.();
  } catch {
    /* the error below matters more */
  }
  const code = e instanceof Exit ? e.code : 1;
  process.stderr.write(`ingest: ${e instanceof Error ? (e instanceof Exit ? e.message : e.stack ?? e.message) : String(e)}\n`);
  process.exit(code);
});
