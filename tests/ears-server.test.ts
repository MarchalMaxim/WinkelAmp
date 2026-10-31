/// <reference types="node" />
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startEars } from '../scripts/ears/server';
import type { Job, TranscriberStatus } from '../src/studio/ingest/ears-types';

// A stand-in for `node --import tsx scripts/ingest.ts …`: prints --progress json lines slowly (so the polls see each
// state), then writes a pack whose source.sha1 is the input's; FAKE_MODE=boom fails on stderr instead, and
// FAKE_MODE=gpu3 fails like the transcriber does (exit 3) when asked for --notes gpu.
const FAKE = String.raw`
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const args = process.argv.slice(1), input = args[0], flag = (k) => args[args.indexOf(k) + 1];
const id = flag('--id'), out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (process.env.FAKE_MODE === 'boom') { await sleep(60); process.stderr.write('ingest: boom\n'); process.exit(1); }
  if (process.env.FAKE_MODE === 'gpu3' && flag('--notes') === 'gpu') {
    out({ stage: 'decode', progress: 1, message: 'decode', id }); await sleep(60);
    process.stderr.write('CUDA out of memory\ningest: the transcriber failed\npass --notes approx to use approximate notes from the analysis\n');
    process.exit(3);
  }
  for (const [stage, progress] of [['decode', 0], ['decode', 1], ['transcribe', 0.5], ['analyze', 0.2], ['analyze', 0.9], ['write', 1]]) {
    out({ stage, progress, message: stage, id }); await sleep(70);
  }
  const dir = path.join(process.env.SONGS, id); fs.mkdirSync(dir, { recursive: true });
  const bytes = fs.readFileSync(input), ext = path.extname(input).toLowerCase();
  fs.writeFileSync(path.join(dir, 'audio' + ext), bytes);
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ id, audio: 'audio' + ext, title: flag('--title'),
    source: { name: path.basename(input), bytes: bytes.length, sha1: crypto.createHash('sha1').update(bytes).digest('hex') } }));
  out({ stage: 'done', progress: 1, message: 'done', id, warnings: [] });
})();`;

const tmp = mkdtempSync(join(tmpdir(), 'wa-ears-'));
const songs = join(tmp, 'songs');
const calls: { args: string[]; start: number; end: number }[] = [];
let mode = 'ok';
let status: TranscriberStatus = { ok: true, python: 'py', device: 'cuda' };
let ears: Awaited<ReturnType<typeof startEars>>;
let base = '';

beforeAll(async () => {
  ears = await startEars({
    port: 0, songs, maxBytes: 1024, probe: async () => status,
    runIngest: (args) => {
      const call = { args, start: Date.now(), end: 0 };
      calls.push(call);
      const p = spawn(process.execPath, ['-e', FAKE, ...args], { env: { ...process.env, SONGS: songs, FAKE_MODE: mode } });
      p.on('close', () => (call.end = Date.now()));
      return p;
    },
  });
  base = `http://127.0.0.1:${ears.port}`;
});
afterAll(async () => {
  await ears?.close();
  rmSync(tmp, { recursive: true, force: true });
});

const post = (q: string, body: string | Uint8Array<ArrayBuffer> | null, headers: Record<string, string> = {}) =>
  fetch(`${base}/ingest?${q}`, { method: 'POST', body, headers: { origin: 'http://localhost:5173', ...headers } });
const job = async (id: string): Promise<Job> => (await (await fetch(`${base}/jobs/${id}`)).json()) as Job;

/** Polls a job until it ends, keeping every state it was seen in. */
async function follow(id: string): Promise<Job[]> {
  const seen: Job[] = [];
  for (let i = 0; i < 400; i++) {
    const j = await job(id);
    seen.push(j);
    if (j.state === 'done' || j.state === 'failed') return seen;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`job ${id} did not end`);
}
/** `--k v` pairs present in an argument list. */
const has = (args: string[], ...pairs: [string, string][]) => pairs.every(([k, v]) => args[args.indexOf(k) + 1] === v && args.includes(k));

describe('the ears server', () => {
  it('answers /health with the transcriber', async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, api: 1, transcriber: { ok: true } });
  });

  it('ingests an upload: 202, queued → running → done, progress never decreasing', async () => {
    const r = await post('name=a.wav', 'first recording');
    expect(r.status).toBe(202);
    const { job: j, id } = (await r.json()) as { job: string; id: string };
    expect(id).toBe('a');
    const seen = await follow(j);
    const states = [...new Set(seen.map((s) => s.state))];
    expect(states[states.length - 1]).toBe('done');
    expect(states).toContain('running');
    for (let i = 1; i < seen.length; i++) expect(seen[i].progress).toBeGreaterThanOrEqual(seen[i - 1].progress);
    expect(seen[seen.length - 1].progress).toBe(1);
    expect(has(calls[0].args, ['--id', 'a'], ['--notes', 'gpu'], ['--progress', 'json'], ['--title', 'A'])).toBe(true);
    // The input keeps its name: the pack's source.name is the dropped file's.
    expect(calls[0].args[0]).toMatch(/[\\/]a\.wav$/);
  });

  it('says the same recording is already there', async () => {
    const r = await post('name=whatever.wav', 'first recording');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ job: null, id: 'a', existing: true });
  });

  it('gives a different recording under a taken name the next free id', async () => {
    const r = await post('name=a.wav', 'second recording');
    expect(r.status).toBe(202);
    const { job: j, id } = (await r.json()) as { job: string; id: string };
    expect(id).toBe('a-2');
    expect((await follow(j)).pop()!.state).toBe('done');
  });

  it('runs one job at a time, in order', async () => {
    const one = (await (await post('name=one.wav', 'one')).json()) as { job: string };
    const two = (await (await post('name=two.wav', 'two')).json()) as { job: string };
    expect((await job(two.job)).state).toBe('queued');
    await follow(one.job);
    await follow(two.job);
    const [c1, c2] = calls.slice(-2);
    expect(c2.start).toBeGreaterThanOrEqual(c1.end);
  });

  it('uses approximate notes when the transcriber is unavailable, and says why', async () => {
    status = { ok: false, python: null, device: null, reason: 'no python' };
    const ears2 = await startEars({ port: 0, songs, probe: async () => status, runIngest: (args) => {
      calls.push({ args, start: Date.now(), end: 0 });
      return spawn(process.execPath, ['-e', FAKE, ...args], { env: { ...process.env, SONGS: songs, FAKE_MODE: 'ok' } });
    } });
    try {
      expect(await (await fetch(`http://127.0.0.1:${ears2.port}/health`)).json()).toMatchObject({ transcriber: { ok: false, reason: 'no python' } });
      const r = await fetch(`http://127.0.0.1:${ears2.port}/ingest?name=approx.wav`, { method: 'POST', body: 'approx' });
      const { job: j } = (await r.json()) as { job: string };
      let last: Job | null = null;
      for (let i = 0; i < 400 && last?.state !== 'done'; i++) {
        last = (await (await fetch(`http://127.0.0.1:${ears2.port}/jobs/${j}`)).json()) as Job;
        await new Promise((res) => setTimeout(res, 15));
      }
      expect(last!.state).toBe('done');
      expect(last!.warnings.join(' ')).toMatch(/no python/);
      expect(has(calls[calls.length - 1].args, ['--notes', 'approx'])).toBe(true);
    } finally {
      await ears2.close();
      status = { ok: true, python: 'py', device: 'cuda' };
    }
  });

  it('re-ingests a song in place with redo=1', async () => {
    const r = await post('id=a&redo=1', null);
    expect(r.status).toBe(202);
    const { job: j, id } = (await r.json()) as { job: string; id: string };
    expect(id).toBe('a');
    expect((await follow(j)).pop()!.state).toBe('done');
    const args = calls[calls.length - 1].args;
    expect(args[0]).toMatch(/[\\/]a[\\/]audio\.wav$/);
    expect(args).toContain('--force');
    expect(has(args, ['--id', 'a'], ['--notes', 'gpu'])).toBe(true);
    expect((await post('id=nope&redo=1', null)).status).toBe(404);
  });

  it('reports a failed ingest with its error', async () => {
    mode = 'boom';
    try {
      const { job: j } = (await (await post('name=bad.wav', 'bad')).json()) as { job: string };
      const end = (await follow(j)).pop()!;
      expect(end.state).toBe('failed');
      expect(end.error).toMatch(/boom/);
    } finally { mode = 'ok'; }
  });

  it('runs a job whose transcription fails (exit 3) again with approximate notes, and says why', async () => {
    mode = 'gpu3';
    try {
      const before = calls.length;
      const { job: j } = (await (await post('name=oom.wav', 'too much for the GPU')).json()) as { job: string };
      const seen = await follow(j);
      const end = seen[seen.length - 1];
      expect(end.state).toBe('done');
      for (let i = 1; i < seen.length; i++) expect(seen[i].progress).toBeGreaterThanOrEqual(seen[i - 1].progress);
      const tried = calls.slice(before);
      expect(tried.map((c) => c.args[c.args.indexOf('--notes') + 1])).toEqual(['gpu', 'approx']);
      expect(end.warnings.join(' ')).toMatch(/the transcriber failed \(CUDA out of memory\)/);
    } finally { mode = 'ok'; }
  });

  it('echoes local origins only', async () => {
    const ok = await fetch(`${base}/health`, { headers: { origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const pre = await fetch(`${base}/ingest?name=x.wav`, { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:5173', 'access-control-request-method': 'POST' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    const evil = await post('name=x.wav', 'x', { origin: 'http://evil.example' });
    expect(evil.status).toBe(403);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('refuses what it cannot take', async () => {
    expect((await post('name=big.wav', new Uint8Array(2048).fill(1))).status).toBe(413);
    expect((await post('name=x.wav&id=..', 'x')).status).toBe(400);
    expect((await post('', 'x')).status).toBe(400);
    expect((await post('name=empty.wav', '')).status).toBe(400);
    expect((await fetch(`${base}/jobs/nope`)).status).toBe(404);
  });
});
