/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { validatePack, type SongPack } from '../src/studio/pack/pack';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const tmp = mkdtempSync(join(tmpdir(), 'wa-ingest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function ingest(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(REPO, 'scripts', 'ingest.ts'), ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, WINKELAMP_SONGS: join(tmp, 'songs'), ...env }, timeout: 60_000,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe.skipIf(!hasFfmpeg)('npm run ingest', () => {
  const wav = join(tmp, 'Sine Test.wav');
  if (hasFfmpeg) spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=220:d=3', wav]);

  it('makes a valid approximate pack and copies the audio', () => {
    const r = ingest([wav, '--notes', 'approx']);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    const dir = join(tmp, 'songs', 'sine-test');
    const pack = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8')) as SongPack;
    expect(validatePack(pack)).toEqual([]);
    expect(pack.notesFrom).toBe('approx');
    expect(pack.title).toBe('Sine Test');
    expect(pack.duration).toBeCloseTo(3, 1);
    expect(pack.audio).toBe('audio.wav');
    expect(existsSync(join(dir, 'audio.wav'))).toBe(true);
  }, 60_000);

  it('says up to date the second time', () => {
    const r = ingest([wav, '--notes', 'approx']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/up to date/);
  }, 60_000);

  it('reports progress as JSON lines when asked', () => {
    const r = ingest([wav, '--notes', 'approx', '--id', 'json-run', '--progress', 'json']);
    expect(r.code).toBe(0);
    const lines = r.out.trim().split('\n').map((l) => JSON.parse(l) as { stage: string; progress: number });
    expect(lines[0].stage).toBe('decode');
    expect(lines[lines.length - 1]).toMatchObject({ stage: 'done', progress: 1 });
  }, 60_000);

  it('fails loudly (exit 3) when the transcriber cannot run, naming --notes approx', () => {
    const r = ingest([wav, '--id', 'no-python'], { WINKELAMP_PY: join(tmp, 'missing.exe') });
    expect(r.code).toBe(3);
    expect(r.err).toMatch(/--notes approx/);
    expect(existsSync(join(tmp, 'songs', 'no-python', 'pack.json'))).toBe(false);
  }, 60_000);

  it('rejects a bad id and a missing file (exit 2)', () => {
    expect(ingest([wav, '--id', 'Bad Id']).code).toBe(2);
    expect(ingest([join(tmp, 'nope.wav')]).code).toBe(2);
  }, 60_000);
});
