/// <reference types="node" />
// Ingest v2 end to end, the transcribers stubbed: WINKELAMP_PY, WINKELAMP_PY_BP and ymt3.json's python point at a
// small Node stub (stub.mjs), and a hook loaded into the ingest process runs any `*.mjs` "python" with node (dropping
// Python's -I), so the CLI's real code finds, runs, caches and falls back exactly as it does with the real tools.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { IngestProgress } from '../src/studio/ingest/ears-types';
import { WARN_NO_YMT3, WARN_PIANO_ONLY } from '../src/studio/pack/build';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import type { Note } from '../src/widgets/types';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const tmp = mkdtempSync(join(tmpdir(), 'wa-ingest2-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const HOOK = `import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const real = cp.spawn;
cp.spawn = (cmd, args, opts) => /\\.mjs$/i.test(String(cmd))
  ? real(process.execPath, [cmd, ...(args ?? []).filter((a) => a !== '-I')], opts)
  : real(cmd, args, opts);
syncBuiltinESMExports();
`;

// argv: <script.py> …; the output is the 2nd positional of transcribe.py / bp.py / muscriptor.py and the last argument of ymt3.py.
const STUB = `import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
const [script, ...rest] = process.argv.slice(2);
const tool = basename(script).replace(/\\.py$/, '');
appendFileSync(process.env.STUB_RUNS, tool + '\\n');
const data = process.env['STUB_' + tool.toUpperCase()];
if (!data) { process.stderr.write(tool + ': no stub data\\n'); process.exit(3); }
const out = tool === 'ymt3' ? rest[rest.length - 1] : rest[1];
const chunks = tool === 'muscriptor';
process.stderr.write(chunks ? 'progress 0.5 61/122\\n' : 'progress 0.5\\n');
writeFileSync(out, readFileSync(data));
process.stderr.write(chunks ? 'progress 1 122/122\\n' : 'progress 1\\n');
`;

const hook = join(tmp, 'hook.mjs'), stub = join(tmp, 'stub.mjs'), runs = join(tmp, 'runs.txt');
writeFileSync(hook, HOOK);
writeFileSync(stub, STUB);
writeFileSync(runs, '');

/** A YourMT3 install whose python is the stub. */
const ymt3Dir = join(tmp, 'ymt3');
mkdirSync(join(ymt3Dir, 'src'), { recursive: true });
writeFileSync(join(ymt3Dir, 'moe.ckpt'), '');
writeFileSync(join(ymt3Dir, 'ymt3.json'), JSON.stringify({
  python: stub, src: join(ymt3Dir, 'src'), ckpt: join(ymt3Dir, 'moe.ckpt'), revision: 'stub-rev', sha256: 'x', installed: 'now',
}));

/** A MuScriptor install whose python is the stub. */
const msDir = join(tmp, 'muscriptor');
mkdirSync(msDir, { recursive: true });
writeFileSync(join(msDir, 'muscriptor.json'), JSON.stringify({ python: stub, model: 'large', version: 'stub-ver', installed: 'now' }));

// The recording: a 440 Hz tone struck every 0.5 s for 8 s (16 clear onsets).
const wav = join(tmp, 'Struck Tone.wav');
if (hasFfmpeg) spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='sin(2*PI*440*t)*exp(-10*mod(t\\,0.5))':s=44100:d=8", wav]);

const data = (name: string, value: unknown) => {
  const f = join(tmp, name);
  writeFileSync(f, JSON.stringify(value));
  return f;
};
// The piano model: notes on a 50 ms grid (every onset is heard), or a few notes between the onsets (none is).
const pianoGood: Note[] = Array.from({ length: 160 }, (_, i) => [i * 0.05, i * 0.05 + 0.04, 60 + (i % 12), 40 + (i % 50)]);
const pianoPoor: Note[] = Array.from({ length: 4 }, (_, i) => [0.25 + i * 2, 0.3 + i * 2, 72, 64]);
const piano = (notes: Note[]) => ({ model: 'stub-piano', device: 'cuda', seconds: 1, notes: notes.map(([start, end, midi, vel]) => ({ start, end, midi, vel })) });
const files = {
  pianoGood: data('piano-good.json', piano(pianoGood)),
  pianoPoor: data('piano-poor.json', piano(pianoPoor)),
  // YourMT3: 90 % piano, or violins and cellos between the piano's grid points (so the hybrid adds them).
  ymt3Piano: data('ymt3-piano.json', { version: 1, model: 'yourmt3-moe', revision: 'stub-rev', seconds: 2,
    notes: Array.from({ length: 40 }, (_, i) => [i * 0.2, i * 0.2 + 0.15, 60, 100, i % 10 === 9 ? 'Violin' : 'Acoustic Piano']) }),
  ymt3Ens: data('ymt3-ens.json', { version: 1, model: 'yourmt3-moe', revision: 'stub-rev', seconds: 2,
    notes: [
      ...Array.from({ length: 20 }, (_, i) => [8.2 + i * 0.4, 8.5 + i * 0.4, 76, 100, 'Violin']),
      ...Array.from({ length: 14 }, (_, i) => [0.5 * i, 0.5 * i + 0.4, 48, 100, 'Cello']),
      [1, 2, 36, 100, 'Drums'],
    ] }),
  bp: data('bp.json', { version: 1, model: 'basic-pitch-stub', settings: { onset: 0.6, frame: 0.4, minMs: 58, melodia: true }, seconds: 1,
    notes: Array.from({ length: 16 }, (_, i) => [i * 0.5 + 0.01, i * 0.5 + 0.3, 69, 80]) }),
};
const missing = join(tmp, 'nowhere', 'python.exe');
// MuScriptor's rows, its own names and always velocity 100: violins and cellos, and a piano YourMT3's can be told from.
type RawRow = [number, number, number, number | null, string];
const msViolins: RawRow[] = Array.from({ length: 20 }, (_, i) => [i * 0.38 + 0.02, i * 0.38 + 0.3, 76, 100, 'violin']);
const msCellos: RawRow[] = Array.from({ length: 14 }, (_, i) => [i * 0.5 + 0.1, i * 0.5 + 0.4, 48, 100, 'cello']);
const msPiano: RawRow[] = Array.from({ length: 14 }, (_, i) => [i * 0.5 + 0.2, i * 0.5 + 0.35, 84, 100, 'acoustic_piano']);
const msRun = (notes: unknown[]) => ({ version: 1, model: 'muscriptor-large', package: '0.4.0', instruments: null, dtype: 'float32', device: 'cuda', seconds: 700, notes });
const msFiles = {
  good: data('ms-good.json', msRun([...msViolins, ...msCellos, ...msPiano])),
  // Half of its notes have no length: the loop medium fell into on Rite.
  stuck: data('ms-stuck.json', msRun([...msViolins, ...msViolins.map(([a, , m, v, c]) => [a + 0.1, a + 0.1, m, v, c])])),
  pastEnd: data('ms-past.json', msRun([...msViolins, ...msCellos, [9.5, 10, 76, 100, 'violin']])),
};

/** piano: the piano model's python (the stub); pianoFile: what it writes; ymt3/bp: their stub data, null = not installed. */
interface Env {
  piano?: string; pianoFile?: string; ymt3?: string | null; bp?: string | null;
  /** MuScriptor's stub data; absent = installed but failing; null = not installed. */
  ms?: string | null;
}
function run(args: string[], e: Env = {}) {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    WINKELAMP_SONGS: join(tmp, 'songs'), STUB_RUNS: runs,
    WINKELAMP_PY: e.piano === undefined ? stub : e.piano,
    WINKELAMP_PY_BP: e.bp === null ? missing : stub,
    WINKELAMP_YMT3: e.ymt3 === null ? join(tmp, 'no-ymt3') : ymt3Dir,
    // Always set: a test must never reach the real install, whose model takes 15 GB of the GPU.
    WINKELAMP_MUSCRIPTOR: e.ms === null ? join(tmp, 'no-muscriptor') : msDir,
    STUB_TRANSCRIBE: e.pianoFile ?? files.pianoGood, STUB_YMT3: e.ymt3 ?? files.ymt3Ens, STUB_BP: e.bp ?? files.bp,
  };
  delete env.STUB_MUSCRIPTOR;
  if (e.ms) env.STUB_MUSCRIPTOR = e.ms;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(hook).href, join(REPO, 'scripts', 'ingest.ts'), ...args], {
    cwd: REPO, encoding: 'utf8', env, timeout: 90_000,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const pack = (id: string) => JSON.parse(readFileSync(join(tmp, 'songs', id, 'pack.json'), 'utf8')) as SongPack;
const count = () => {
  const c = { transcribe: 0, ymt3: 0, bp: 0, muscriptor: 0 };
  for (const l of readFileSync(runs, 'utf8').split('\n')) if (l in c) c[l as keyof typeof c]++;
  return c;
};

describe.skipIf(!hasFfmpeg)('npm run ingest, v2', () => {
  it("a recording YourMT3 hears as piano (share 0.9) is a piano song with the piano model's notes", () => {
    const before = count();
    const r = run([wav, '--id', 'solo'], { ymt3: files.ymt3Piano });
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    const p = pack('solo');
    expect(validatePack(p)).toEqual([]);
    expect(p.version).toBe(2);
    expect(p.kind).toBe('piano');
    expect(p.pianoShare).toBeCloseTo(0.9, 4);
    expect(p.notesFrom).toBe('gpu');
    expect(p.notes).toEqual(pianoGood);
    expect(p.tracks).toBeUndefined();
    expect(p.transcribers?.map((t) => t.name)).toEqual(['piano', 'ymt3']);
    // YourMT3 was there: basic-pitch never ran.
    expect(count()).toEqual({ ...before, transcribe: before.transcribe + 1, ymt3: before.ymt3 + 1 });
    for (const f of ['notes.gpu.json', 'notes.ymt3.json']) expect(existsSync(join(tmp, 'songs', 'solo', f))).toBe(true);
  }, 90_000);

  it('a recording with no piano in it (share 0) is an ensemble: hybrid notes and instrument tracks', () => {
    const r = run([wav, '--id', 'band']);
    expect(r.code).toBe(0);
    const p = pack('band');
    expect(validatePack(p)).toEqual([]);
    expect(p.kind).toBe('ensemble');
    expect(p.pianoShare).toBe(0);
    expect(p.notesFrom).toBe('hybrid');
    expect(Object.keys(p.tracks ?? {})).toEqual(['violin', 'cello']);
    expect(p.tracks!.violin!.notes).toHaveLength(20);
    // Every piano-model note is kept; the violins past 8 s fill the gap (the cellos sit on the piano's grid).
    const key = (n: Note) => `${n[0]}:${n[2]}`;
    const all = new Set(p.notes.map(key));
    for (const n of pianoGood) expect(all.has(key(n))).toBe(true);
    expect(p.notes.length).toBe(pianoGood.length + 20);
    expect(p.notes.every((n) => n[3] >= 1 && n[3] <= 127)).toBe(true);
    expect(p.quality.warnings).toEqual([]);
  }, 90_000);

  it('says up to date the second time, running no transcriber', () => {
    const before = count();
    const r = run([wav, '--id', 'band']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/up to date/);
    expect(count()).toEqual(before);
  }, 90_000);

  it('--redo ymt3 runs YourMT3 again and reads the other caches', () => {
    const before = count();
    const r = run([wav, '--id', 'band', '--redo', 'ymt3']);
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/up to date/);
    expect(count()).toEqual({ ...before, ymt3: before.ymt3 + 1 });
    expect(pack('band').notesFrom).toBe('hybrid');
  }, 90_000);

  it('without ymt3.json an ensemble is gap-filled by basic-pitch, with the setup warning', () => {
    const before = count();
    const r = run([wav, '--id', 'no-ymt3'], { ymt3: null, pianoFile: files.pianoPoor });
    expect(r.code).toBe(0);
    const p = pack('no-ymt3');
    expect(validatePack(p)).toEqual([]);
    expect(p.kind).toBe('ensemble');
    expect(p.pianoShare).toBeNull();
    expect(p.notesFrom).toBe('bp-hybrid');
    expect(p.tracks).toBeUndefined();
    expect(p.quality.warnings).toContain(WARN_NO_YMT3);
    expect(p.quality.warnings.join('\n')).toMatch(/npm run setup-ymt3/);
    expect(count()).toEqual({ ...before, transcribe: before.transcribe + 1, bp: before.bp + 1 });
    expect(r.out).toMatch(/warning: no instrument tracks/);
  }, 90_000);

  it('without ymt3.json and without basic-pitch an ensemble keeps the piano model, warning about half the attacks', () => {
    const r = run([wav, '--id', 'piano-only'], { ymt3: null, bp: null, pianoFile: files.pianoPoor });
    expect(r.code).toBe(0);
    const p = pack('piano-only');
    expect(validatePack(p)).toEqual([]);
    expect(p.kind).toBe('ensemble');
    // The piano model heard little: today's approximate merge fills the rest.
    expect(['gpu', 'merged']).toContain(p.notesFrom);
    expect(p.quality.warnings).toContain(WARN_PIANO_ONLY);
    expect(p.quality.warnings.join('\n')).toMatch(/about half/);
    expect(p.quality.warnings).toContain(WARN_NO_YMT3);
  }, 90_000);

  it('with nothing installed at all it still writes a valid pack of approximate notes, saying why', () => {
    const r = run([wav, '--id', 'nothing'], { piano: missing, ymt3: null, bp: null });
    expect(r.code).toBe(0);
    const p = pack('nothing');
    expect(validatePack(p)).toEqual([]);
    expect(p.notesFrom).toBe('approx');
    expect(p.quality.warnings.join('\n')).toMatch(/approximate notes/);
    expect(p.quality.warnings.join('\n')).toMatch(/the piano model could not run/);
  }, 90_000);

  it('without the piano model, YourMT3 gives the notes, with a warning', () => {
    const r = run([wav, '--id', 'no-piano'], { piano: missing });
    expect(r.code).toBe(0);
    const p = pack('no-piano');
    expect(validatePack(p)).toEqual([]);
    expect(p.notesFrom).toBe('ymt3');
    expect(p.quality.warnings.join('\n')).toMatch(/piano transcriber unavailable/);
  }, 90_000);

  it('--piano-notes uses a notes file as the piano model and never runs it', () => {
    const before = count();
    const file = join(tmp, 'notes-b.js');
    writeFileSync(file, `window.NOTES=${JSON.stringify(pianoGood)};`);
    const r = run([wav, '--id', 'given', '--piano-notes', file]);
    expect(r.code).toBe(0);
    const p = pack('given');
    expect(p.notesFrom).toBe('hybrid');
    expect(p.transcriber).toBeNull();
    expect(count().transcribe).toBe(before.transcribe);
    expect(count().ymt3).toBe(before.ymt3 + 1);
  }, 90_000);

  it('--kind piano skips YourMT3 and basic-pitch', () => {
    const before = count();
    const r = run([wav, '--id', 'forced', '--kind', 'piano'], { pianoFile: files.pianoPoor });
    expect(r.code).toBe(0);
    const p = pack('forced');
    expect(p.kind).toBe('piano');
    expect(count()).toEqual({ ...before, transcribe: before.transcribe + 1 });
  }, 90_000);

  it('--notes ymt3 fails (exit 3) without YourMT3, naming the fallbacks; auto never does', () => {
    const r = run([wav, '--id', 'want-ymt3', '--notes', 'ymt3'], { ymt3: null });
    expect(r.code).toBe(3);
    expect(r.err).toMatch(/npm run setup-ymt3/);
    expect(r.err).toMatch(/--notes auto/);
    expect(existsSync(join(tmp, 'songs', 'want-ymt3'))).toBe(false);
  }, 90_000);

  it('reports progress lines whose overall never decreases, through every stage', () => {
    const r = run([wav, '--id', 'json', '--progress', 'json'], { ymt3: null, pianoFile: files.pianoPoor });
    expect(r.code).toBe(0);
    const lines = r.out.trim().split('\n').map((l) => JSON.parse(l) as IngestProgress);
    for (let i = 1; i < lines.length; i++) expect(lines[i].overall!).toBeGreaterThanOrEqual(lines[i - 1].overall!);
    expect([...new Set(lines.map((l) => l.stage))]).toEqual(['decode', 'transcribe', 'instruments', 'analyze', 'write', 'done']);
    expect(lines[lines.length - 1]).toMatchObject({ stage: 'done', progress: 1, overall: 1 });
    expect(lines[lines.length - 1].warnings).toContain(WARN_NO_YMT3);
  }, 90_000);

  it('rejects bad flags (exit 2)', () => {
    expect(run([wav, '--kind', 'organ']).code).toBe(2);
    expect(run([wav, '--redo', 'demucs']).code).toBe(2);
    expect(run([wav, '--notes', 'approx', '--piano-notes', wav]).code).toBe(2);
    expect(run([wav, '--notes', 'ymt3', '--kind', 'piano']).code).toBe(2);
  }, 90_000);
});

describe.skipIf(!hasFfmpeg)('npm run ingest, MuScriptor as an option', () => {
  const songDir = (id: string) => join(tmp, 'songs', id);
  const msArgs = (id: string, list = 'baroque') => [wav, '--id', id, '--instruments-model', 'muscriptor', '--instruments', list];
  const warnings = (id: string) => pack(id).quality.warnings;
  const msCaches = (id: string) => readdirSync(songDir(id)).filter((f) => /^notes\.muscriptor-[0-9a-f]{8}\.json$/.test(f));
  const nightFile = (name: string, notes: unknown[]) => data(name, { model: 'muscriptor-large', notes, instruments: { violin: 12 }, zeroLength: 0 });

  it('takes the tracks from MuScriptor and the keyboard from YourMT3+', () => {
    const r = run(msArgs('ms-baroque'), { ms: msFiles.good, ymt3: files.ymt3Piano });
    expect(r.code).toBe(0);
    const p = pack('ms-baroque');
    expect(validatePack(p)).toEqual([]);
    expect(p.kind).toBe('ensemble');
    expect(p.notesFrom).toBe('ms-hybrid');
    expect(p.tracks!.violin!.from).toBe('muscriptor');
    expect(p.tracks!.cello!.from).toBe('muscriptor');
    expect(p.tracks!.piano!.from).toBe('ymt3');
    const ms = p.transcribers!.find((t) => t.name === 'muscriptor')!;
    expect(ms.instruments).toEqual(['violin', 'viola', 'cello', 'contrabass', 'acoustic_piano']);
    expect(ms.model).toBe('muscriptor-large');
    expect(ms.seconds).toBe(700);
    expect(ms.notes).toBe(msViolins.length + msCellos.length);
    expect(p.transcribers!.find((t) => t.name === 'ymt3')!.notes).toBe(40);
    // Velocities are estimated as for YourMT3+, not left at MuScriptor's 100.
    expect(p.tracks!.violin!.notes.some((n) => n[3] !== 100)).toBe(true);
  }, 90_000);

  it('goes with --notes hybrid, and with --kind ensemble', () => {
    expect(run([...msArgs('ms-hybrid', 'strings'), '--notes', 'hybrid', '--kind', 'ensemble'], { ms: msFiles.good }).code).toBe(0);
    expect(pack('ms-hybrid').notesFrom).toBe('ms-hybrid');
  }, 90_000);

  it('gives no keyboard lane without one in the list', () => {
    const r = run(msArgs('ms-strings', 'strings'), { ms: data('ms-nopiano.json', msRun([...msViolins, ...msCellos])), ymt3: files.ymt3Piano });
    expect(r.code).toBe(0);
    const p = pack('ms-strings');
    expect(p.tracks!.piano).toBeUndefined();
    expect(p.tracks!.violin!.from).toBe('muscriptor');
    expect(p.quality.warnings.join('\n')).not.toMatch(/keyboard/);
  }, 90_000);

  it("drops MuScriptor's own piano rows for YourMT3+'s", () => {
    const p = pack('ms-baroque');
    expect(p.tracks!.piano!.notes.length).toBe(36);
    expect(new Set(p.tracks!.piano!.notes.map((n) => n[2]))).toEqual(new Set([60]));
  });

  it("keeps MuScriptor's piano when YourMT3+ is missing, and says so", () => {
    const before = count();
    const r = run(msArgs('ms-no-ymt3'), { ms: msFiles.good, ymt3: null });
    expect(r.code).toBe(0);
    const p = pack('ms-no-ymt3');
    expect(validatePack(p)).toEqual([]);
    expect(p.tracks!.piano!.from).toBe('muscriptor');
    expect(new Set(p.tracks!.piano!.notes.map((n) => n[2]))).toEqual(new Set([84]));
    expect(warnings('ms-no-ymt3')).toContain("no keyboard lane from YourMT3+: the piano track is MuScriptor's, which barely finds a harpsichord");
    expect(warnings('ms-no-ymt3').join('\n')).not.toMatch(/not set up/);
    // Its rows are in hand: basic-pitch does not run as a fallback.
    expect(count().bp).toBe(before.bp);
    expect(p.notesFrom).toBe('ms-hybrid');
  }, 90_000);

  it('refuses without a list, with --kind piano, with --notes gpu, with string_ensemble, and --instruments alone', () => {
    const before = count();
    const nope = (args: string[], message: RegExp) => {
      const r = run(args, { ms: msFiles.good });
      expect(r.code).toBe(2);
      expect(r.err).toMatch(message);
    };
    nope([wav, '--id', 'ms-bad', '--instruments-model', 'muscriptor'], /--instruments.*guitars/);
    nope([...msArgs('ms-bad'), '--kind', 'piano'], /--kind piano/);
    nope([...msArgs('ms-bad'), '--notes', 'gpu'], /--notes gpu/);
    nope(msArgs('ms-bad', 'violin,string_ensemble'), /string_ensemble/);
    nope([wav, '--id', 'ms-bad', '--instruments', 'baroque'], /--instruments goes with/);
    nope(msArgs('ms-bad', 'kazoo'), /kazoo/);
    nope([wav, '--id', 'ms-bad', '--instruments-model', 'demucs'], /demucs/);
    nope([wav, '--id', 'ms-bad', '--redo', 'muscriptor'], /--redo muscriptor/);
    nope([...msArgs('ms-bad'), '--muscriptor-notes', join(tmp, 'nowhere.json')], /--muscriptor-notes/);
    nope([wav, '--id', 'ms-bad', '--instruments-model', 'ymt3', '--muscriptor-notes', msFiles.good, '--instruments', 'strings'], /--muscriptor-notes/);
    nope([wav, '--id', 'ms-bad', '--muscriptor-notes', msFiles.good, '--instruments', 'strings', '--redo', 'muscriptor'], /--redo muscriptor/);
    expect(existsSync(songDir('ms-bad'))).toBe(false);
    expect(count()).toEqual(before);
  }, 180_000);

  it('caches by audio, model and list', () => {
    const e = { ms: msFiles.good };
    const start = count().muscriptor;
    expect(run(msArgs('ms-cache'), e).code).toBe(0);
    expect(count().muscriptor).toBe(start + 1);
    expect(run([...msArgs('ms-cache'), '--force'], e).code).toBe(0);
    expect(count().muscriptor).toBe(start + 1);
    // Another list runs again, and the first result stays.
    expect(run(msArgs('ms-cache', 'strings'), e).code).toBe(0);
    expect(count().muscriptor).toBe(start + 2);
    expect(msCaches('ms-cache')).toHaveLength(2);
    const saved = JSON.parse(readFileSync(join(songDir('ms-cache'), msCaches('ms-cache')[0]), 'utf8')) as Record<string, unknown>;
    expect(Object.keys(saved)).toEqual(['version', 'sha1', 'model', 'package', 'instruments', 'dtype', 'seconds', 'notes']);
    // Mapped and uncleaned: the names are the class names, and nothing was merged or estimated.
    expect((saved.notes as unknown[][]).map((n) => n[4])).toContain('Violin');
    expect((saved.notes as unknown[][]).every((n) => n[3] === 100)).toBe(true);
    // --redo runs it again.
    expect(run([...msArgs('ms-cache'), '--redo', 'muscriptor'], e).code).toBe(0);
    expect(count().muscriptor).toBe(start + 3);
    // Another recording under the same id runs it again.
    const other = join(tmp, 'Other Tone.wav');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='sin(2*PI*220*t)*exp(-10*mod(t\\,0.5))':s=44100:d=8", other]);
    expect(run([other, '--id', 'ms-cache', '--instruments-model', 'muscriptor', '--instruments', 'baroque'], e).code).toBe(0);
    expect(count().muscriptor).toBe(start + 4);
  }, 180_000);

  it('runs again when the install has another package, and reads the cache without an install', () => {
    const e = { ms: msFiles.good };
    expect(run(msArgs('ms-stale'), e).code).toBe(0);
    const start = count().muscriptor;
    const file = join(songDir('ms-stale'), msCaches('ms-stale')[0]);
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), package: '0.0.1' }));
    expect(run([...msArgs('ms-stale'), '--force'], { ms: null }).code).toBe(0);
    expect(count().muscriptor).toBe(start);
    expect(pack('ms-stale').notesFrom).toBe('ms-hybrid');
    expect(run([...msArgs('ms-stale'), '--force'], e).code).toBe(0);
    expect(count().muscriptor).toBe(start + 1);
  }, 120_000);

  it('imports an overnight file and never runs the model', () => {
    const before = count().muscriptor;
    const night = nightFile('night.json', [...msViolins, ...msCellos, ...msPiano]);
    const r = run([wav, '--id', 'ms-import', '--muscriptor-notes', night, '--instruments', 'baroque'], { ms: msFiles.good });
    expect(r.code).toBe(0);
    expect(count().muscriptor).toBe(before);
    const p = pack('ms-import');
    expect(validatePack(p)).toEqual([]);
    expect(p.notesFrom).toBe('ms-hybrid');
    const [name] = msCaches('ms-import');
    const saved = JSON.parse(readFileSync(join(songDir('ms-import'), name), 'utf8')) as { sha1: string; package: string; instruments: string[]; model: string };
    expect(saved.sha1).toBe(p.source.sha1);
    expect(saved.package).toBe('stub-ver');
    expect(saved.model).toBe('muscriptor-large');
    expect(saved.instruments).toEqual(['violin', 'viola', 'cello', 'contrabass', 'acoustic_piano']);
    // The next plain run reads it: no stub data, so a run would fail and fall back.
    const again = run([...msArgs('ms-import'), '--force']);
    expect(again.code).toBe(0);
    expect(count().muscriptor).toBe(before);
    expect(pack('ms-import').notesFrom).toBe('ms-hybrid');
  }, 90_000);

  it('binds an import to the version that made it when there is no install', () => {
    const night = nightFile('night2.json', [...msViolins, ...msCellos]);
    expect(run([wav, '--id', 'ms-import-2', '--muscriptor-notes', night, '--instruments', 'strings'], { ms: null }).code).toBe(0);
    const saved = JSON.parse(readFileSync(join(songDir('ms-import-2'), msCaches('ms-import-2')[0]), 'utf8')) as { package: string };
    expect(saved.package).toBe('0.4.0');
    expect(pack('ms-import-2').notesFrom).toBe('ms-hybrid');
  }, 90_000);

  it('an imported row with velocity null counts', () => {
    const night = nightFile('night-null.json', [...msViolins, ...msCellos].map(([a, b, m, , c]): RawRow => [a, b, m, null, c]));
    expect(run([wav, '--id', 'ms-null', '--muscriptor-notes', night, '--instruments', 'strings']).code).toBe(0);
    expect(pack('ms-null').tracks!.violin!.notes).toHaveLength(msViolins.length);
  }, 90_000);

  it('refuses an import with an unknown name', () => {
    const night = nightFile('night-kazoo.json', [[1, 2, 60, 100, 'kazoo']]);
    const r = run([wav, '--id', 'ms-kazoo', '--muscriptor-notes', night, '--instruments', 'strings']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/kazoo/);
    expect(existsSync(songDir('ms-kazoo'))).toBe(false);
  }, 90_000);

  it('refuses an import with a lane outside the list, and writes nothing', () => {
    // An overnight file has MuScriptor's names: its piano is the hunt theme, which `strings` must keep out of the tracks.
    const night = nightFile('night-baroque.json', [...msViolins, ...msPiano]);
    const r = run([wav, '--id', 'ms-outside', '--muscriptor-notes', night, '--instruments', 'strings']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(new RegExp(`acoustic_piano \\(${msPiano.length} rows\\)`));
    expect(r.err).toMatch(/outside --instruments violin,viola,cello,contrabass/);
    expect(existsSync(songDir('ms-outside'))).toBe(false);
    // A cache has class names, and is held to the same list.
    const cache = nightFile('night-cache.json', [[1, 2, 76, 100, 'Violin'], [1, 2, 84, 100, 'Acoustic Piano']]);
    const c = run([wav, '--id', 'ms-outside', '--muscriptor-notes', cache, '--instruments', 'strings']);
    expect(c.code).toBe(2);
    expect(c.err).toMatch(/acoustic_piano \(1 rows\)/);
    expect(existsSync(songDir('ms-outside'))).toBe(false);
    // A list wider than the file is fine: Spring's list has a piano its run did not find.
    expect(run([wav, '--id', 'ms-wider', '--muscriptor-notes', nightFile('night-wider.json', [...msViolins, ...msCellos]), '--instruments', 'baroque']).code).toBe(0);
  }, 180_000);

  it('says when an up to date pack did not import the file', () => {
    const args = (f: string) => [wav, '--id', 'ms-twice', '--muscriptor-notes', f, '--instruments', 'strings'];
    expect(run(args(nightFile('night-a.json', [...msViolins, ...msCellos]))).code).toBe(0);
    const other = nightFile('night-b.json', msViolins);
    const again = run(args(other));
    expect(again.code).toBe(0);
    expect(again.out).toMatch(/up to date/);
    expect(again.out).toMatch(/night-b\.json was not imported: --force imports it/);
    expect(pack('ms-twice').tracks!.cello).toBeDefined();
    expect(run([...args(other), '--force']).code).toBe(0);
    expect(pack('ms-twice').tracks!.cello).toBeUndefined();
  }, 180_000);

  it("keeps the title on a run on the pack's own audio", () => {
    expect(run([wav, '--id', 'titled', '--title', 'Kept Name']).code).toBe(0);
    const own = join(songDir('titled'), 'audio.wav');
    const night = nightFile('night-title.json', [...msViolins, ...msCellos]);
    expect(run([own, '--id', 'titled', '--muscriptor-notes', night, '--instruments', 'strings']).code).toBe(0);
    expect(pack('titled').title).toBe('Kept Name');
    expect(pack('titled').source.name).toBe('Struck Tone.wav');
    expect(run([own, '--id', 'titled', '--force']).code).toBe(0);
    expect(pack('titled').title).toBe('Kept Name');
    // --title still says otherwise, and a file from elsewhere still names the song.
    expect(run([own, '--id', 'titled', '--force', '--title', 'New Name']).code).toBe(0);
    expect(pack('titled').title).toBe('New Name');
    expect(run([wav, '--id', 'titled', '--force']).code).toBe(0);
    expect(pack('titled').title).toBe('Struck Tone');
    // A first ingest of a file called audio has only its name to go on.
    const fresh = join(tmp, 'fresh', 'audio.wav');
    mkdirSync(join(tmp, 'fresh'), { recursive: true });
    copyFileSync(wav, fresh);
    expect(run([fresh, '--id', 'titled-fresh']).code).toBe(0);
    expect(pack('titled-fresh').title).toBe('Audio');
  }, 300_000);

  it("refuses an import that is not a file of notes, or another model's", () => {
    const bad = (name: string, text: string, message: RegExp) => {
      const f = join(tmp, name);
      writeFileSync(f, text);
      const r = run([wav, '--id', 'ms-junk', '--muscriptor-notes', f, '--instruments', 'strings']);
      expect(r.code).toBe(2);
      expect(r.err).toMatch(message);
    };
    bad('junk.json', 'not json', /not JSON/);
    bad('no-notes.json', '{"model":"muscriptor-large"}', /no notes/);
    bad('empty.json', '{"model":"muscriptor-large","notes":[]}', /no notes/);
    bad('half.json', '{"model":"muscriptor-large","notes":[[1,2,60,100,"violin"],[1,2]]}', /1 of its 2 rows/);
    bad('medium.json', '{"model":"muscriptor-medium","notes":[[1,2,60,100,"violin"]]}', /muscriptor-medium/);
    expect(existsSync(songDir('ms-junk'))).toBe(false);
  }, 180_000);

  it('falls back when it is not set up, when it fails, and when it looks stuck', () => {
    const check = (id: string, e: Env, message: RegExp) => {
      const r = run(msArgs(id, 'strings'), e);
      expect(r.code).toBe(0);
      const p = pack(id);
      expect(validatePack(p)).toEqual([]);
      expect(p.kind).toBe('ensemble');
      expect(p.notesFrom).toBe('hybrid');
      expect(Object.values(p.tracks!).every((t) => !('from' in t!))).toBe(true);
      expect(p.transcribers!.map((t) => t.name)).toEqual(['piano', 'ymt3']);
      const w = p.quality.warnings.find((x) => x.startsWith('MuScriptor'));
      expect(w).toMatch(message);
    };
    check('ms-unset', { ms: null }, /^MuScriptor is not set up \(npm run setup-muscriptor\): the tracks come from YourMT3\+$/);
    check('ms-fails', {}, /^MuScriptor failed \(muscriptor: no stub data\): the tracks come from YourMT3\+$/);
    check('ms-stuck', { ms: msFiles.stuck }, /^MuScriptor's output looks stuck \(\d+ % of its notes have no length\): the tracks come from YourMT3\+$/);
  }, 180_000);

  it('caches a run that looks stuck, but never a crash', () => {
    const before = count().muscriptor;
    expect(msCaches('ms-stuck')).toHaveLength(1);
    expect(msCaches('ms-fails')).toHaveLength(0);
    expect(run([...msArgs('ms-stuck', 'strings'), '--force'], { ms: msFiles.good }).code).toBe(0);
    expect(count().muscriptor).toBe(before);
    expect(pack('ms-stuck').notesFrom).toBe('hybrid');
    expect(run([...msArgs('ms-stuck', 'strings'), '--redo', 'muscriptor'], { ms: msFiles.good }).code).toBe(0);
    expect(count().muscriptor).toBe(before + 1);
    expect(pack('ms-stuck').notesFrom).toBe('ms-hybrid');
  }, 120_000);

  it('says there are no tracks when YourMT3+ is missing too, and fills the gaps with basic-pitch', () => {
    const before = count().bp;
    const r = run(msArgs('ms-nothing', 'strings'), { ms: null, ymt3: null, pianoFile: files.pianoPoor });
    expect(r.code).toBe(0);
    const p = pack('ms-nothing');
    expect(p.kind).toBe('ensemble');
    expect(p.notesFrom).toBe('bp-hybrid');
    expect(p.quality.warnings).toContain('MuScriptor is not set up (npm run setup-muscriptor): no instrument tracks');
    expect(p.quality.warnings).toContain(WARN_NO_YMT3);
    expect(count().bp).toBe(before + 1);
  }, 90_000);

  it('says what the cleanup did', () => {
    expect(run(msArgs('ms-clean', 'strings'), { ms: msFiles.pastEnd }).code).toBe(0);
    const w = warnings('ms-clean').find((x) => x.startsWith("cleaned MuScriptor's notes:"));
    expect(w).toMatch(/1 past the end/);
    expect(pack('ms-clean').tracks!.violin!.notes).toHaveLength(msViolins.length);
  }, 90_000);

  it('is up to date only for the same list', () => {
    const e = { ms: msFiles.good };
    expect(run(msArgs('ms-fresh', 'strings'), e).code).toBe(0);
    const at = pack('ms-fresh').made.at;
    const same = run(msArgs('ms-fresh', 'strings'), e);
    expect(same.code).toBe(0);
    expect(same.out).toMatch(/up to date/);
    expect(pack('ms-fresh').made.at).toBe(at);
    const other = run(msArgs('ms-fresh', 'baroque'), e);
    expect(other.code).toBe(0);
    expect(other.out).not.toMatch(/up to date/);
    expect(pack('ms-fresh').transcribers!.find((t) => t.name === 'muscriptor')!.instruments).toContain('acoustic_piano');
    // Without the option, a pack of this recording stays up to date as it is.
    expect(run([wav, '--id', 'ms-fresh']).out).toMatch(/up to date/);
    expect(pack('ms-fresh').notesFrom).toBe('ms-hybrid');
    // A pack made without the option is not what the option asks for.
    expect(run([wav, '--id', 'ms-then']).code).toBe(0);
    expect(run(msArgs('ms-then', 'strings'), e).out).not.toMatch(/up to date/);
    expect(pack('ms-then').notesFrom).toBe('ms-hybrid');
  }, 180_000);

  it('leaves a pack without the option alone', () => {
    expect(run([wav, '--id', 'ms-none'], { ms: msFiles.good }).code).toBe(0);
    const p = pack('ms-none');
    expect(p.notesFrom).toBe('hybrid');
    expect(p.transcribers!.map((t) => t.name)).toEqual(['piano', 'ymt3']);
    expect(Object.values(p.tracks!).every((t) => !('from' in t!))).toBe(true);
    expect(msCaches('ms-none')).toEqual([]);
  }, 90_000);

  it('progress never decreases on a long run, and the message counts chunks', () => {
    const r = run([...msArgs('ms-json', 'strings'), '--progress', 'json'], { ms: msFiles.good, ymt3: files.ymt3Ens });
    expect(r.code).toBe(0);
    const lines = r.out.trim().split('\n').map((l) => JSON.parse(l) as IngestProgress);
    for (let i = 1; i < lines.length; i++) expect(lines[i].overall!).toBeGreaterThanOrEqual(lines[i - 1].overall!);
    expect(lines[lines.length - 1]).toMatchObject({ stage: 'done', overall: 1 });
    const chunk = lines.find((l) => /^MuScriptor: 61 of 122 chunks, /.test(l.message ?? ''));
    expect(chunk?.message).toMatch(/left$/);
    // The weights of a long run: half-way through its chunks is about half-way through the whole job.
    expect(chunk!.overall!).toBeGreaterThan(0.45);
    expect(chunk!.overall!).toBeLessThan(0.65);
    // YourMT3+ stays in its first 15 % of the stage.
    const y = lines.filter((l) => l.stage === 'instruments' && /YourMT3|hearing the instruments/.test(l.message ?? ''));
    expect(y.length).toBeGreaterThan(0);
    for (const l of y) expect(l.progress).toBeLessThanOrEqual(0.15);
  }, 90_000);

  it('describe-song names MuScriptor and the list', () => {
    const describeSong = (id: string) => spawnSync(process.execPath, ['--import', 'tsx', join(REPO, 'scripts', 'describe-song.ts'), id], {
      cwd: REPO, encoding: 'utf8', env: { ...process.env, WINKELAMP_SONGS: join(tmp, 'songs') }, timeout: 60_000,
    });
    const ms = describeSong('ms-baroque');
    expect(ms.status).toBe(0);
    expect(ms.stdout).toContain('instrument tracks: MuScriptor large (violin, viola, cello, contrabass, acoustic_piano), keyboard: YourMT3+');
    expect(ms.stdout).toMatch(/piano transcriber, with MuScriptor notes in its gaps/);
    expect(ms.stdout).toContain("MuScriptor large's instrument tracks");
    expect(ms.stdout).not.toContain("YourMT3+'s");
    const plain = describeSong('ms-none');
    expect(plain.stdout).toContain("YourMT3+'s instrument tracks");
    expect(plain.stdout).not.toMatch(/MuScriptor/);
    expect(describeSong('ms-no-ymt3').stdout).toContain('keyboard: MuScriptor');
    expect(describeSong('ms-strings').stdout).toContain('no keyboard lane');
  }, 90_000);
});
