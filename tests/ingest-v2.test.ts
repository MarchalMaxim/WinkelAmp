/// <reference types="node" />
// Ingest v2 end to end, the transcribers stubbed: WINKELAMP_PY, WINKELAMP_PY_BP and ymt3.json's python point at a
// small Node stub (stub.mjs), and a hook loaded into the ingest process runs any `*.mjs` "python" with node (dropping
// Python's -I), so the CLI's real code finds, runs, caches and falls back exactly as it does with the real tools.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// argv: <script.py> …; the output is the 2nd positional of transcribe.py / bp.py and the last argument of ymt3.py.
const STUB = `import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
const [script, ...rest] = process.argv.slice(2);
const tool = basename(script).replace(/\\.py$/, '');
appendFileSync(process.env.STUB_RUNS, tool + '\\n');
const data = process.env['STUB_' + tool.toUpperCase()];
if (!data) { process.stderr.write(tool + ': no stub data\\n'); process.exit(3); }
const out = tool === 'ymt3' ? rest[rest.length - 1] : rest[1];
process.stderr.write('progress 0.5\\n');
writeFileSync(out, readFileSync(data));
process.stderr.write('progress 1\\n');
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

/** piano: the piano model's python (the stub); pianoFile: what it writes; ymt3/bp: their stub data, null = not installed. */
interface Env { piano?: string; pianoFile?: string; ymt3?: string | null; bp?: string | null }
function run(args: string[], e: Env = {}) {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    WINKELAMP_SONGS: join(tmp, 'songs'), STUB_RUNS: runs,
    WINKELAMP_PY: e.piano === undefined ? stub : e.piano,
    WINKELAMP_PY_BP: e.bp === null ? missing : stub,
    WINKELAMP_YMT3: e.ymt3 === null ? join(tmp, 'no-ymt3') : ymt3Dir,
    STUB_TRANSCRIBE: e.pianoFile ?? files.pianoGood, STUB_YMT3: e.ymt3 ?? files.ymt3Ens, STUB_BP: e.bp ?? files.bp,
  };
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(hook).href, join(REPO, 'scripts', 'ingest.ts'), ...args], {
    cwd: REPO, encoding: 'utf8', env, timeout: 90_000,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const pack = (id: string) => JSON.parse(readFileSync(join(tmp, 'songs', id, 'pack.json'), 'utf8')) as SongPack;
const count = () => {
  const c = { transcribe: 0, ymt3: 0, bp: 0 };
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
    expect(count()).toEqual({ transcribe: before.transcribe + 1, ymt3: before.ymt3, bp: before.bp + 1 });
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
