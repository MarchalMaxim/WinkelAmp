/// <reference types="node" />
// MuScriptor from Node, the python stubbed: a `*.mjs` "python" runs with node (without Python's -I), so the real code
// finds, spawns, parses and retries as it does with the real tool.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findMuscriptor, msConfigPath, probeMsWith, probeMuscriptor, runMuscriptor, type MsConfig } from '../scripts/node/muscriptor';

vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>();
  return {
    ...real,
    spawn: (cmd: string, args: string[], opts: object) => (/\.mjs$/i.test(cmd)
      ? real.spawn(process.execPath, [cmd, ...args.filter((a) => a !== '-I')], opts)
      : real.spawn(cmd, args, opts)),
  };
});

// argv: <muscriptor.py> <audio> <out> … or <muscriptor.py> --probe …. STUB_OOM: the first run answers out of memory.
// STUB_FAIL: every run fails with this reason. STUB_PROBE: what a probe prints.
const STUB = `import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const [script, ...rest] = process.argv.slice(2);
const first = !existsSync(process.env.STUB_RUNS);
appendFileSync(process.env.STUB_RUNS, JSON.stringify({ script, rest, offline: process.env.HF_HUB_OFFLINE ?? null }) + '\\n');
if (rest[0] === '--probe') { process.stdout.write('some library print\\n' + process.env.STUB_PROBE + '\\n'); process.exit(0); }
process.stderr.write('[muscriptor] audio: 610.0s\\n');
process.stderr.write('progress 0.000 0/122\\nprogress 0.500 61/122\\n');
if (first && process.env.STUB_OOM) { process.stderr.write('muscriptor.py: OutOfMemoryError: CUDA out of memory. Tried to allocate 2 GiB\\n'); process.exit(1); }
if (process.env.STUB_FAIL) { process.stderr.write('line before\\nmuscriptor.py: ' + process.env.STUB_FAIL + '\\n'); process.exit(4); }
process.stderr.write('progress 1.000 122/122\\n');
writeFileSync(rest[1], '{}');
`;

const SAVED = ['WINKELAMP_MUSCRIPTOR', 'STUB_RUNS', 'STUB_OOM', 'STUB_FAIL', 'STUB_PROBE', 'HF_HUB_OFFLINE'].map((k) => [k, process.env[k]] as const);
let tmp = '', stub = '', runs = '', n = 0;

/** A folder holding a muscriptor.json whose python is the stub. */
function install(patch: Partial<MsConfig> = {}): { dir: string; config: MsConfig } {
  const dir = join(tmp, `install${n++}`);
  mkdirSync(dir, { recursive: true });
  const config: MsConfig = { python: stub, model: 'large', version: '0.4.0', installed: '2026-11-01T12:00:00.000Z', ...patch };
  writeFileSync(join(dir, 'muscriptor.json'), JSON.stringify(config));
  return { dir, config };
}
const ran = (): { script: string; rest: string[]; offline: string | null }[] => {
  try {
    return readFileSync(runs, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'wa-ms-'));
  stub = join(tmp, 'stub.mjs');
  writeFileSync(stub, STUB);
});
beforeEach(() => {
  runs = join(tmp, `runs${n++}.jsonl`);
  process.env.STUB_RUNS = runs;
  for (const k of ['STUB_OOM', 'STUB_FAIL', 'STUB_PROBE']) delete process.env[k];
});
afterEach(() => {
  for (const [k, v] of SAVED) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('msConfigPath', () => {
  it('is <LOCALAPPDATA>/WinkelAmp/muscriptor/muscriptor.json without WINKELAMP_MUSCRIPTOR', () => {
    delete process.env.WINKELAMP_MUSCRIPTOR;
    expect(msConfigPath().replace(/\\/g, '/')).toMatch(/\/WinkelAmp\/muscriptor\/muscriptor\.json$/);
  });
});

describe('findMuscriptor', () => {
  it('says it is not set up, naming the hint', () => {
    process.env.WINKELAMP_MUSCRIPTOR = join(tmp, 'nowhere');
    const r = findMuscriptor();
    expect(r).toEqual({ missing: expect.stringContaining('npm run setup-muscriptor') });
    if ('missing' in r) expect(r.missing).toContain(join(tmp, 'nowhere', 'muscriptor.json'));
  });

  it('finds a good config through WINKELAMP_MUSCRIPTOR, as a folder and as a file', () => {
    const { dir, config } = install();
    process.env.WINKELAMP_MUSCRIPTOR = dir;
    expect(findMuscriptor()).toEqual({ config });
    process.env.WINKELAMP_MUSCRIPTOR = join(dir, 'muscriptor.json');
    expect(findMuscriptor()).toEqual({ config });
  });

  it('names what a bad config lacks: invalid JSON, a missing key, a python that is not there', () => {
    const dir = join(tmp, 'broken');
    mkdirSync(dir, { recursive: true });
    process.env.WINKELAMP_MUSCRIPTOR = dir;
    writeFileSync(join(dir, 'muscriptor.json'), '{ not json');
    expect(findMuscriptor()).toEqual({ missing: expect.stringContaining('not valid JSON') });
    writeFileSync(join(dir, 'muscriptor.json'), JSON.stringify({ python: stub, version: '0.4.0' }));
    expect(findMuscriptor()).toEqual({ missing: expect.stringMatching(/lacks model, installed/) });
    const gone = join(tmp, 'nopy', 'python.exe');
    process.env.WINKELAMP_MUSCRIPTOR = install({ python: gone }).dir;
    expect(findMuscriptor()).toEqual({ missing: expect.stringContaining(gone) });
    process.env.WINKELAMP_MUSCRIPTOR = install({ model: 'medium' as 'large' }).dir;
    expect(findMuscriptor()).toEqual({ missing: expect.stringContaining('medium') });
  });
});

describe('probing', () => {
  const answer = (x: unknown) => { process.env.STUB_PROBE = JSON.stringify(x); };

  it('reads the last line, offline', async () => {
    answer({ ok: true, device: 'cuda', version: '0.4.0', weights: 'cached' });
    expect(await probeMsWith({ python: stub })).toEqual({ ok: true, python: stub, device: 'cuda', version: '0.4.0', weights: 'cached' });
    expect(ran()[0].rest).toEqual(['--probe']);
    expect(ran()[0].offline).toBe('1');
  });

  it('asks for the weights with --fetch, which alone may go online', async () => {
    process.env.HF_HUB_OFFLINE = '1';
    answer({ ok: true, device: 'cuda', version: '0.4.0', weights: 'cached' });
    await probeMsWith({ python: stub }, { fetch: true });
    expect(ran()[0].rest).toEqual(['--probe', '--fetch']);
    expect(ran()[0].offline).toBeNull();
  });

  it('passes on the reason of a bad probe', async () => {
    answer({ ok: false, reason: 'missing Python package (muscriptor)' });
    expect(await probeMsWith({ python: stub })).toEqual({ ok: false, python: stub, reason: 'missing Python package (muscriptor)' });
  });

  it('says so when the python cannot run', async () => {
    const gone = join(tmp, 'nopy', 'python.exe');
    const r = await probeMsWith({ python: gone });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(gone);
  });

  it('is ok only with the weights there, else names the hint', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = install().dir;
    answer({ ok: true, device: 'cuda', version: '0.4.0', weights: 'cached' });
    expect(await probeMuscriptor()).toEqual({ ok: true, python: stub });
    answer({ ok: true, device: 'cuda', version: '0.4.0', weights: 'absent' });
    expect(await probeMuscriptor()).toEqual({ ok: false, python: stub, reason: expect.stringContaining('npm run setup-muscriptor') });
  });

  it('answers not ok without an install', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = join(tmp, 'nowhere');
    expect(await probeMuscriptor()).toEqual({ ok: false, python: null, reason: expect.stringContaining('npm run setup-muscriptor') });
  });
});

describe('runMuscriptor', () => {
  const out = () => join(tmp, `out${n++}.json`);

  it('rejects with the same reason without an install', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = join(tmp, 'nowhere');
    await expect(runMuscriptor('a.wav', out(), { instruments: ['violin'] })).rejects.toThrow(/npm run setup-muscriptor/);
  });

  it('passes the audio, the output second and the list, offline', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = install().dir;
    const o = out();
    await runMuscriptor('a.wav', o, { instruments: ['violin', 'viola'] });
    const [r] = ran();
    expect(basename(r.script)).toBe('muscriptor.py');
    expect(r.rest).toEqual(['a.wav', o, '--model', 'large', '--instruments', 'violin,viola']);
    expect(r.offline).toBe('1');
  });

  it('reports chunks from the progress lines', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = install().dir;
    const seen: [number, number, number][] = [];
    await runMuscriptor('a.wav', out(), { instruments: ['violin'] }, (f, done, total) => seen.push([f, done, total]));
    expect(seen).toEqual([[0, 0, 122], [0.5, 61, 122], [1, 122, 122]]);
  });

  it('retries once in bfloat16 on out of memory', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = install().dir;
    process.env.STUB_OOM = '1';
    const seen: number[] = [];
    await runMuscriptor('a.wav', out(), { instruments: ['violin'] }, (f) => seen.push(f));
    const r = ran();
    expect(r).toHaveLength(2);
    expect(r[0].rest).not.toContain('--dtype');
    expect(r[1].rest.slice(-2)).toEqual(['--dtype', 'bfloat16']);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(1);
  });

  it('does not retry a run that was already in bfloat16', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = install().dir;
    process.env.STUB_OOM = '1';
    await expect(runMuscriptor('a.wav', out(), { instruments: ['violin'], dtype: 'bfloat16' })).rejects.toThrow(/out of memory/);
    expect(ran()).toHaveLength(1);
  });

  it('does not retry another failure', async () => {
    process.env.WINKELAMP_MUSCRIPTOR = install().dir;
    process.env.STUB_FAIL = 'cannot decode a.wav';
    const e = await runMuscriptor('a.wav', out(), { instruments: ['violin'] }).catch((x: Error) => x);
    expect(ran()).toHaveLength(1);
    expect((e as Error).message.split('\n')[0]).toBe('muscriptor.py: cannot decode a.wav');
    expect((e as Error).message).toContain('line before');
    expect((e as Error).message).toContain('exited 4');
  });
});
