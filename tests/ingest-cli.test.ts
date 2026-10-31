/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    cwd: REPO, encoding: 'utf8', env: {
      ...process.env, WINKELAMP_SONGS: join(tmp, 'songs'),
      // Never the machine's own YourMT3 or basic-pitch: these runs are about the CLI, not the transcribers (tests/ingest-v2).
      WINKELAMP_YMT3: join(tmp, 'no-ymt3'), WINKELAMP_PY_BP: join(tmp, 'no-bp.exe'), ...env,
    }, timeout: 60_000,
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

  it('fails loudly (exit 3) when the transcriber asked for (--notes gpu) cannot run, naming --notes approx', () => {
    const r = ingest([wav, '--id', 'no-python', '--notes', 'gpu'], { WINKELAMP_PY: join(tmp, 'missing.exe') });
    expect(r.code).toBe(3);
    expect(r.err).toMatch(/--notes approx/);
    expect(existsSync(join(tmp, 'songs', 'no-python'))).toBe(false);
  }, 60_000);

  describe('a failed ingest leaves the old pack as it was', () => {
    const dir = join(tmp, 'songs', 'keep');
    const snapshot = () => Object.fromEntries(readdirSync(dir).sort().map((f) => [f, readFileSync(join(dir, f)).toString('base64')]));
    const garbage = (name: string) => {
      const f = join(tmp, name);
      writeFileSync(f, 'this is not audio at all, just text pretending to be a recording. '.repeat(50));
      return f;
    };

    it('exit 4 on garbage under the same id, whatever its extension; pack.json and the audio are untouched', () => {
      expect(ingest([wav, '--notes', 'approx', '--id', 'keep']).code).toBe(0);
      const before = snapshot();
      expect(Object.keys(before)).toEqual(['audio.wav', 'pack.json']);
      for (const name of ['garbage.mp3', 'garbage.wav']) {
        const r = ingest([garbage(name), '--notes', 'approx', '--id', 'keep']);
        expect(r.code).toBe(4);
        expect(snapshot()).toEqual(before);
      }
      const pack = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8')) as SongPack;
      expect(validatePack(pack)).toEqual([]);
    }, 120_000);

    it('a failed fresh ingest leaves no folder behind', () => {
      expect(ingest([garbage('fresh.mp3'), '--notes', 'approx', '--id', 'fresh-fail']).code).toBe(4);
      expect(existsSync(join(tmp, 'songs', 'fresh-fail'))).toBe(false);
    }, 60_000);

    it("is not up to date when the pack's audio is missing: it rebuilds it", () => {
      rmSync(join(dir, 'audio.wav'));
      const r = ingest([wav, '--notes', 'approx', '--id', 'keep']);
      expect(r.code).toBe(0);
      expect(r.out).not.toMatch(/up to date/);
      expect(existsSync(join(dir, 'audio.wav'))).toBe(true);
    }, 60_000);

    it("re-running on the pack's own audio keeps the original source name", () => {
      const r = ingest([join(dir, 'audio.wav'), '--notes', 'approx', '--id', 'keep', '--force']);
      expect(r.code).toBe(0);
      const pack = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8')) as SongPack;
      expect(pack.source.name).toBe('Sine Test.wav');
      expect(readdirSync(dir).sort()).toEqual(['audio.wav', 'pack.json']);
    }, 60_000);
  });

  it('rejects a bad id and a missing file (exit 2)', () => {
    expect(ingest([wav, '--id', 'Bad Id']).code).toBe(2);
    expect(ingest([join(tmp, 'nope.wav')]).code).toBe(2);
  }, 60_000);
});
