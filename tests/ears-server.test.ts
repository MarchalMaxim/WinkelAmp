/// <reference types="node" />
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startEars } from '../scripts/ears/server';
import type { Job, TranscribeChoices, TranscriberStatus } from '../src/studio/ingest/ears-types';
import { listKey, MS_MODEL, MS_PRESETS } from '../src/studio/pack/muscriptor';

// No test may reach this machine's real MuScriptor (a probe imports torch): a server without a fake finds no config.
process.env.WINKELAMP_MUSCRIPTOR = join(tmpdir(), 'wa-ears-no-muscriptor', 'muscriptor.json');

// A stand-in for `node --import tsx scripts/ingest.ts …`: prints --progress json lines slowly (so the polls see each
// state), then writes a pack whose source.sha1 is the input's and says FAKE_WARN in its done line; FAKE_MODE=boom
// fails on stderr instead, and FAKE_MODE=auto3 fails like a transcriber does (exit 3) unless asked for --notes approx.
const FAKE = String.raw`
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const args = process.argv.slice(1), input = args[0], flag = (k) => args[args.indexOf(k) + 1];
const id = flag('--id'), out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (process.env.FAKE_MODE === 'boom') { await sleep(60); process.stderr.write('ingest: boom\n'); process.exit(1); }
  if (process.env.FAKE_MODE === 'auto3' && flag('--notes') !== 'approx') {
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
  out({ stage: 'done', progress: 1, message: 'done', id, warnings: process.env.FAKE_WARN ? [process.env.FAKE_WARN] : [] });
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
    port: 0, songs, maxBytes: 1024, probe: async () => status, probeYmt3: async () => ({ ok: true, python: 'py' }), probeBp: async () => ({ ok: true, python: 'py' }),
    probeMuscriptor: async () => ({ ok: true, python: 'ms-py' }),
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
    expect(await r.json()).toMatchObject({ ok: true, api: 2, transcriber: { ok: true }, ymt3: { ok: true }, bp: { ok: true } });
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
    expect(has(calls[0].args, ['--id', 'a'], ['--notes', 'auto'], ['--progress', 'json'], ['--title', 'A'])).toBe(true);
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

  it('leaves the fallbacks to ingest (--notes auto) when the piano model is unavailable, and carries its warnings', async () => {
    status = { ok: false, python: null, device: null, reason: 'no python' };
    const warn = 'approximate notes: no transcriber';
    const ears2 = await startEars({ port: 0, songs, probe: async () => status, probeYmt3: async () => ({ ok: false, python: null, reason: 'no ymt3' }),
      probeBp: async () => ({ ok: false, python: null, reason: 'no bp' }), runIngest: (args) => {
        calls.push({ args, start: Date.now(), end: 0 });
        return spawn(process.execPath, ['-e', FAKE, ...args], { env: { ...process.env, SONGS: songs, FAKE_MODE: 'ok', FAKE_WARN: warn } });
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
      expect(last!.warnings).toEqual(['transcriber unavailable: no python', warn]);
      expect(has(calls[calls.length - 1].args, ['--notes', 'auto'])).toBe(true);
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
    expect(has(args, ['--id', 'a'], ['--notes', 'auto'])).toBe(true);
    expect((await post('id=nope&redo=1', null)).status).toBe(404);
  });

  describe('choosing the transcriber', () => {
    /** A finished song with this sha1, as the fake writes one, and its audio. */
    const song = (id: string, pack: Record<string, unknown> = {}) => {
      const dir = join(songs, id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'audio.wav'), 'x');
      writeFileSync(join(dir, 'pack.json'), JSON.stringify({ id, title: id, audio: 'audio.wav', duration: 720, source: { name: 'a.wav', sha1: 'abc' }, ...pack }));
      return dir;
    };
    const redo = async (q: string) => {
      const before = calls.length;
      const r = await post(q, null);
      expect(r.status).toBe(202);
      const { job: j } = (await r.json()) as { job: string };
      const end = (await follow(j)).pop()!;
      return { end, runs: calls.slice(before).map((c) => c.args) };
    };
    const NIGHT = { model: MS_MODEL, instruments: { violin: 1 }, zeroLength: 0,
      notes: [[1, 2, 60, null, 'cello'], [1, 2, 72, null, 'violin'], [2, 3, 60, null, 'acoustic_piano']] };

    it('reports MuScriptor in /health and stays api 2', async () => {
      const h = (await (await fetch(`${base}/health`)).json()) as { api: number; muscriptor: { ok: boolean; python: string } };
      expect(h.api).toBe(2);
      expect(h.muscriptor).toEqual({ ok: true, python: 'ms-py' });
    });

    it('passes the engine and list to ingest', async () => {
      song('ms-a');
      const { end, runs } = await redo('id=ms-a&redo=1&engine=muscriptor&instruments=baroque');
      expect(end.state).toBe('done');
      expect(has(runs[0], ['--instruments-model', 'muscriptor'], ['--instruments', 'baroque'], ['--id', 'ms-a'], ['--notes', 'auto'])).toBe(true);
      expect(runs[0]).toContain('--force');
      expect(runs[0]).not.toContain('--muscriptor-notes');
    });

    it('passes an own list as it understood it', async () => {
      song('ms-own');
      const { runs } = await redo(`id=ms-own&redo=1&engine=muscriptor&instruments=${encodeURIComponent('violin, viola')}`);
      expect(has(runs[0], ['--instruments', 'violin,viola'])).toBe(true);
    });

    it('runs engine=ymt3 like a redo with no engine', async () => {
      song('ms-y');
      const { runs } = await redo('id=ms-y&redo=1&engine=ymt3');
      expect(runs[0]).not.toContain('--instruments-model');
      expect(runs[0]).not.toContain('--instruments');
      expect(runs[0]).toContain('--force');
    });

    it('refuses MuScriptor without a usable list', async () => {
      song('ms-b');
      const before = calls.length;
      const none = await post('id=ms-b&redo=1&engine=muscriptor', null);
      expect(none.status).toBe(400);
      expect(((await none.json()) as { error: string }).error).toMatch(/no instruments given/);
      const bad = await post('id=ms-b&redo=1&engine=muscriptor&instruments=string_ensemble', null);
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { error: string }).error).toMatch(/string_ensemble/);
      expect((await post('id=ms-b&redo=1&engine=gpu', null)).status).toBe(400);
      expect((await post('id=ms-b&redo=1&engine=ymt3&overnight=1', null)).status).toBe(400);
      expect(calls.length).toBe(before);
    });

    it('imports the overnight file with overnight=1', async () => {
      const dir = song('ms-night');
      const q = 'id=ms-night&redo=1&engine=muscriptor&instruments=baroque&overnight=1';
      expect((await post(q, null)).status).toBe(404);
      writeFileSync(join(dir, 'notes.muscriptor-large.json'), JSON.stringify(NIGHT));
      const { runs } = await redo(q);
      expect(has(runs[0], ['--muscriptor-notes', join(dir, 'notes.muscriptor-large.json')], ['--instruments', 'baroque'])).toBe(true);
    });

    it('refuses the overnight file with a list that lacks one of its lanes', async () => {
      const dir = song('ms-lane');
      writeFileSync(join(dir, 'notes.muscriptor-large.json'), JSON.stringify(NIGHT));
      const before = calls.length;
      const r = await post('id=ms-lane&redo=1&engine=muscriptor&instruments=strings&overnight=1', null);
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toMatch(/acoustic_piano/);
      expect(calls.length).toBe(before);
    });

    it('does not carry the MuScriptor flags into the approximate retry', async () => {
      song('ms-c');
      mode = 'auto3';
      try {
        const { end, runs } = await redo('id=ms-c&redo=1&engine=muscriptor&instruments=strings');
        expect(end.state).toBe('done');
        expect(runs.map((a) => a[a.indexOf('--notes') + 1])).toEqual(['auto', 'approx']);
        expect(runs[0]).toContain('--instruments-model');
        for (const flag of ['--instruments-model', '--instruments', '--muscriptor-notes']) expect(runs[1]).not.toContain(flag);
      } finally { mode = 'ok'; }
    });

    it('follows a busy song with its job, whatever is asked', async () => {
      song('ms-d');
      const one = (await (await post('id=ms-d&redo=1&engine=muscriptor&instruments=strings', null)).json()) as { job: string };
      const two = (await (await post('id=ms-d&redo=1&engine=ymt3', null)).json()) as { job: string };
      expect(two.job).toBe(one.job);
      const busy = (await (await fetch(`${base}/songs/ms-d/transcriptions`)).json()) as TranscribeChoices;
      expect(busy.running).toBe(true);
      await follow(one.job);
      expect(((await (await fetch(`${base}/songs/ms-d/transcriptions`)).json()) as TranscribeChoices).running).toBe(false);
    });

    it('lists the choices of a song', async () => {
      const dir = song('ms-e', { tracks: { violin: {} }, transcribers: [{ name: 'muscriptor', model: MS_MODEL, seconds: 1, notes: 2, instruments: MS_PRESETS.baroque }] });
      const cache = { version: 1, sha1: 'abc', model: MS_MODEL, package: '0.4.0', dtype: 'float32', seconds: 600, notes: [[1, 2, 60, 100, 'Violin']] };
      const write = (list: string[], o: object = {}, key = listKey(list)) =>
        writeFileSync(join(dir, `notes.muscriptor-${key}.json`), JSON.stringify({ ...cache, instruments: list, ...o }));
      write(MS_PRESETS.baroque);
      write(MS_PRESETS.strings, { sha1: 'another recording' });                 // of another recording
      write(MS_PRESETS.classical, {}, '00000000');                              // its name is not its list
      writeFileSync(join(dir, 'notes.muscriptor-large.json'), JSON.stringify(NIGHT));
      writeFileSync(join(dir, 'notes.ymt3.json'), JSON.stringify({ version: 1, sha1: 'abc', notes: [] }));
      const r = await fetch(`${base}/songs/ms-e/transcriptions`, { headers: { origin: 'http://localhost:5173' } });
      expect(r.status).toBe(200);
      expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect(await r.json()).toEqual({
        duration: 720, tracksFrom: 'muscriptor', instruments: MS_PRESETS.baroque, ymt3: { ok: true, python: 'py' }, muscriptor: { ok: true, python: 'ms-py' },
        ymt3Saved: true, saved: [{ key: listKey(MS_PRESETS.baroque), instruments: MS_PRESETS.baroque, notes: 1, seconds: 600 }],
        overnight: { lanes: ['violin', 'cello', 'acoustic_piano'], notes: 3, preset: 'baroque' }, running: false,
      } satisfies TranscribeChoices);
    });

    it('says what a song without any of it has', async () => {
      const dir = song('ms-f', { tracks: {} });
      writeFileSync(join(dir, 'notes.ymt3.json'), JSON.stringify({ version: 1, sha1: 'another recording', notes: [] }));
      expect(await (await fetch(`${base}/songs/ms-f/transcriptions`)).json()).toMatchObject({ tracksFrom: null, instruments: null, ymt3Saved: false, saved: [], overnight: null });
      song('ms-g', { tracks: { violin: {} } });
      expect(await (await fetch(`${base}/songs/ms-g/transcriptions`)).json()).toMatchObject({ tracksFrom: 'ymt3', instruments: null });
    });

    it('answers 404 for an unknown song and 400 for a bad id', async () => {
      expect((await fetch(`${base}/songs/nope/transcriptions`)).status).toBe(404);
      expect((await fetch(`${base}/songs/Bad%20Id/transcriptions`)).status).toBe(400);
      expect((await fetch(`${base}/songs/%E0%A4%A/transcriptions`)).status).toBe(400);
    });
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

  it('runs a job whose ingest fails in a transcriber (exit 3) again with approximate notes, and says why', async () => {
    mode = 'auto3';
    try {
      const before = calls.length;
      const { job: j } = (await (await post('name=oom.wav', 'too much for the GPU')).json()) as { job: string };
      const seen = await follow(j);
      const end = seen[seen.length - 1];
      expect(end.state).toBe('done');
      for (let i = 1; i < seen.length; i++) expect(seen[i].progress).toBeGreaterThanOrEqual(seen[i - 1].progress);
      const tried = calls.slice(before);
      expect(tried.map((c) => c.args[c.args.indexOf('--notes') + 1])).toEqual(['auto', 'approx']);
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
