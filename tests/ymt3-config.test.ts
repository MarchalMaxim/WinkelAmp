/// <reference types="node" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { findYmt3, probeYmt3, runYmt3, ymt3ConfigPath, type Ymt3Config } from '../scripts/node/ymt3';

let tmp = '';
const saved = process.env.WINKELAMP_YMT3;

/** A folder holding a ymt3.json whose python, source folder and checkpoint all exist (empty stand-ins). */
function install(name: string, patch: Partial<Ymt3Config> = {}): { dir: string; config: Ymt3Config } {
  const dir = join(tmp, name);
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'ck'), { recursive: true });
  writeFileSync(join(dir, 'python.exe'), '');
  writeFileSync(join(dir, 'ck', 'moe.ckpt'), '');
  const config: Ymt3Config = {
    python: join(dir, 'python.exe'),
    src: join(dir, 'src'),
    ckpt: join(dir, 'ck', 'moe.ckpt'),
    revision: '5e66c1ea173a8186e0d20432b841d3180cc015b5',
    sha256: 'ae38e415c79efd5592dcb9b658cdb99ddb11d4c4e1eaa364cab04a052473fc25',
    installed: '2026-10-31T12:00:00.000Z',
    ...patch,
  };
  writeFileSync(join(dir, 'ymt3.json'), JSON.stringify(config));
  return { dir, config };
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'wa-ymt3-'));
});
afterEach(() => {
  if (saved === undefined) delete process.env.WINKELAMP_YMT3;
  else process.env.WINKELAMP_YMT3 = saved;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('ymt3ConfigPath', () => {
  it('is <LOCALAPPDATA>/WinkelAmp/ymt3/ymt3.json without WINKELAMP_YMT3', () => {
    delete process.env.WINKELAMP_YMT3;
    expect(ymt3ConfigPath().replace(/\\/g, '/')).toMatch(/\/WinkelAmp\/ymt3\/ymt3\.json$/);
  });
  it('takes a folder or a .json file', () => {
    process.env.WINKELAMP_YMT3 = join(tmp, 'x');
    expect(ymt3ConfigPath()).toBe(join(tmp, 'x', 'ymt3.json'));
    process.env.WINKELAMP_YMT3 = join(tmp, 'x', 'other.json');
    expect(ymt3ConfigPath()).toBe(join(tmp, 'x', 'other.json'));
  });
});

describe('findYmt3', () => {
  it('reads a valid ymt3.json from the folder WINKELAMP_YMT3 names', () => {
    const { dir, config } = install('ok');
    process.env.WINKELAMP_YMT3 = dir;
    expect(findYmt3()).toEqual({ config });
  });

  it('reads it when WINKELAMP_YMT3 points at the file itself', () => {
    const { dir, config } = install('file');
    process.env.WINKELAMP_YMT3 = join(dir, 'ymt3.json');
    expect(findYmt3()).toEqual({ config });
  });

  it('says it is missing, naming npm run setup-ymt3, for a path that does not exist', () => {
    process.env.WINKELAMP_YMT3 = join(tmp, 'nowhere');
    const r = findYmt3();
    expect('missing' in r).toBe(true);
    if ('missing' in r) {
      expect(r.missing).toContain('npm run setup-ymt3');
      expect(r.missing).toContain(join(tmp, 'nowhere', 'ymt3.json'));
    }
  });

  it('says it is missing, naming the path, when the checkpoint is gone', () => {
    const gone = join(tmp, 'gone', 'moe.ckpt');
    const { dir } = install('nockpt', { ckpt: gone });
    process.env.WINKELAMP_YMT3 = dir;
    const r = findYmt3();
    expect(r).toEqual({ missing: expect.stringContaining(gone) });
    if ('missing' in r) expect(r.missing).toContain('checkpoint');
  });

  it('names the python or the source folder when they are gone', () => {
    const py = join(tmp, 'nopy', 'python.exe');
    process.env.WINKELAMP_YMT3 = install('nopy-cfg', { python: py }).dir;
    expect(findYmt3()).toEqual({ missing: expect.stringContaining(py) });
    const src = join(tmp, 'nosrc', 'src');
    process.env.WINKELAMP_YMT3 = install('nosrc-cfg', { src }).dir;
    expect(findYmt3()).toEqual({ missing: expect.stringContaining(src) });
  });

  it('rejects broken JSON and a config without its keys', () => {
    const dir = join(tmp, 'broken');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ymt3.json'), '{ not json');
    process.env.WINKELAMP_YMT3 = dir;
    expect(findYmt3()).toEqual({ missing: expect.stringContaining('not valid JSON') });
    writeFileSync(join(dir, 'ymt3.json'), JSON.stringify({ python: 'x' }));
    expect(findYmt3()).toEqual({ missing: expect.stringMatching(/lacks src, ckpt, revision, sha256, installed/) });
  });
});

describe('without an install', () => {
  it('probeYmt3 answers not ok, with python null and the reason', async () => {
    process.env.WINKELAMP_YMT3 = join(tmp, 'nowhere');
    const s = await probeYmt3();
    expect(s).toEqual({ ok: false, python: null, reason: expect.stringContaining('npm run setup-ymt3') });
  });
  it('runYmt3 rejects with the same reason', async () => {
    process.env.WINKELAMP_YMT3 = join(tmp, 'nowhere');
    await expect(runYmt3('a.wav', 'b.json')).rejects.toThrow(/npm run setup-ymt3/);
  });
});
