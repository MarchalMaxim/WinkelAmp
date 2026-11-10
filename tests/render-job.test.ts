/// <reference types="node" />
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { apiMiddleware, renderLine, type RenderChild } from '../scripts/studio-api';
import type { RenderJobView } from '../src/studio/ui/record';

const tmp = mkdtempSync(join(tmpdir(), 'wa-render-job-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const songs = join(tmp, 'songs'), shows = join(tmp, 'shows');
mkdirSync(join(songs, 'demo'), { recursive: true }); mkdirSync(shows);
writeFileSync(join(shows, 'demo.json'), '{"version":3,"id":"demo","song":"demo","clips":[]}\n');

/** A render-show child the test drives: lines on stdout/stderr, then close. */
class FakeChild extends EventEmitter implements RenderChild {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(): boolean { this.killed = true; setTimeout(() => this.emit('close', null), 0); return true; }
  out(text: string | Buffer): void { this.stdout.emit('data', text); }
  err(text: string): void { this.stderr.emit('data', text); }
}
/** The real child's IPC channel: what the job sends it. */
class IpcChild extends FakeChild {
  sent: unknown[] = [];
  connected = true;
  send(m: unknown): boolean { this.sent.push(m); return true; }
}
let ipc = false;
const spawned: { args: string[]; env: Record<string, string>; child: FakeChild }[] = [];
const mw = apiMiddleware({ songs, shows }, {
  spawnRender: (args, env) => { const child = ipc ? new IpcChild() : new FakeChild(); spawned.push({ args, env, child }); return child; },
});

interface Res { status: number; body: Buffer }
function call(method: string, url: string, body?: string, remote = '127.0.0.1'): Promise<Res & { next: boolean }> {
  return new Promise((resolve) => {
    const req = Object.assign(new EventEmitter(), { method, url, headers: {} as Record<string, string>, socket: { remoteAddress: remote } });
    const chunks: Buffer[] = [];
    const res = {
      statusCode: 200, headers: {} as Record<string, string | number>,
      setHeader(k: string, v: string | number) { this.headers[k.toLowerCase()] = v; },
      writeHead(code: number) { this.statusCode = code; return this; },
      write(c: string | Buffer) { chunks.push(Buffer.from(c)); return true; },
      end(c?: string | Buffer) { if (c) chunks.push(Buffer.from(c)); resolve({ status: this.statusCode, body: Buffer.concat(chunks), next: false }); },
      on() { return this; }, once() { return this; }, emit() { return true; },
    };
    mw(req as never, res as never, () => resolve({ status: 0, body: Buffer.alloc(0), next: true }));
    setTimeout(() => { if (body !== undefined) req.emit('data', Buffer.from(body)); req.emit('end'); }, 0);
  });
}
const json = (r: Res) => JSON.parse(r.body.toString('utf8'));
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('render-show lines (the shapes render-show keeps for this job)', () => {
  it('reads progress, the ETA, the time left and the files', () => {
    expect(renderLine('  1:23 of 4:00: 300/1440 frames (21 %), 2.34 s per video second, about 3:21 left'))
      .toEqual({ frames: { done: 300, n: 1440 }, left: 201 });
    expect(renderLine('ETA 75:03 in all (frames 70:00, then sound and share copy 5:03; from the first 120 frames): done about 21:40'))
      .toEqual({ total: 4503 });
    expect(renderLine('master → C:\\x\\renders\\demo.mp4 (12.3 MB)')).toEqual({ file: { kind: 'master', path: 'C:\\x\\renders\\demo.mp4' } });
    expect(renderLine('share → /r/demo-share.mp4 (3.1 MB; send it in WhatsApp as a document)')).toEqual({ file: { kind: 'share', path: '/r/demo-share.mp4' } });
    expect(renderLine('sheet → /r/demo-sheet.png')).toEqual({ file: { kind: 'sheet', path: '/r/demo-sheet.png' } });
    expect(renderLine('share copy: 1920×1080, 30 fps, 1872 kbit/s + AAC 128k (15 MB a minute), two passes')).toEqual({ phase: 'share' });
    expect(renderLine('warning  clips[0]: something')).toEqual({});
    expect(renderLine('work folder → C:\\Temp\\wa-render-show-ab12')).toEqual({ work: 'C:\\Temp\\wa-render-show-ab12' });
  });
});

describe('the HD render job', () => {
  let job = '';

  it('a POST from elsewhere is refused, and so is a GET of the jobs', async () => {
    expect((await call('POST', '/api/render/demo?scale=2', undefined, '192.168.1.20')).status).toBe(403);
    expect((await call('GET', '/api/render/jobs', undefined, '192.168.1.20')).status).toBe(403);
    expect(spawned).toHaveLength(0);
  });

  it('refuses a bad scale or range before spawning anything', async () => {
    expect((await call('POST', '/api/render/demo?scale=5')).status).toBe(400);
    expect((await call('POST', '/api/render/demo?from=10&to=5')).status).toBe(400);
    expect((await call('POST', '/api/render/demo?from=abc')).status).toBe(400);
    expect((await call('POST', '/api/render/Not%20a%20slug')).status).toBe(400);
    expect((await call('POST', '/api/render/demo', '{"id":"other"}')).status).toBe(400);
    expect(spawned).toHaveLength(0);
  });

  it('no job yet', async () => {
    expect(json(await call('GET', '/api/render/jobs'))).toEqual({ job: null });
  });

  it('a POST → 202 and a running job; the child gets the saved show, the scale, the range and the dirs', async () => {
    const r = await call('POST', '/api/render/demo?scale=2&from=126&to=136');
    expect(r.status).toBe(202);
    const v = json(r).job as RenderJobView;
    job = v.id;
    expect(v).toMatchObject({ show: 'demo', state: 'running', progress: 0, eta: null });
    expect(spawned).toHaveLength(1);
    const { args, env } = spawned[0];
    expect(args[0]).toBe(join(shows, 'demo.json'));
    expect(args).toEqual(expect.arrayContaining(['--scale', '2', '--from', '126', '--to', '136']));
    expect(args[args.indexOf('--out') + 1]).toMatch(/[\\/]renders[\\/]demo-126-136$/);
    expect(env).toMatchObject({ WINKELAMP_SONGS: songs, WINKELAMP_SHOWS: shows });
  });

  it('GET shows progress parsed from render-show\'s lines, a line split across chunks included', async () => {
    const c = spawned[0].child;
    c.out('Prelude (7 clips): 2:06–2:16, 600 frames of 2560×1440 at 60 fps (60 Hz steps, scale 2) → x\n');
    const line = Buffer.from('  2:08 of 2:16: 150/600 frames (25 %), 2.00 s per video second, about 0:15 left\r\n');
    c.out(line.subarray(0, 37)); c.out(line.subarray(37));   // the line arrives in two chunks, with a CRLF
    await tick();
    const v = json(await call('GET', `/api/render/jobs/${job}`)) as RenderJobView;
    expect(v.state).toBe('running');
    expect(v.progress).toBeCloseTo(0.25, 6);
    expect(v.eta).toBeGreaterThan(13);
    expect(v.eta).toBeLessThanOrEqual(15);
    expect(v.message).toBe('2:08 of 2:16: 150/600 frames (25 %), 2.00 s per video second, about 0:15 left');
    expect(json(await call('GET', '/api/render/jobs')).job.id).toBe(job);
  });

  it('a multi-byte character split across chunks still reads', async () => {
    const c = spawned[0].child;
    const line = Buffer.from('share copy: 1920×1080, 30 fps, 1872 kbit/s + AAC 128k (15 MB a minute), two passes\n');
    const at = line.indexOf(Buffer.from('×')) + 1;   // between the two bytes of ×
    c.out(line.subarray(0, at)); c.out(line.subarray(at));
    await tick();
    const v = json(await call('GET', `/api/render/jobs/${job}`)) as RenderJobView;
    expect(v.message).toBe('share copy: 1920×1080, 30 fps, 1872 kbit/s + AAC 128k (15 MB a minute), two passes');
    expect(v.progress).toBe(1);
  });

  it('a second POST while one runs → 409', async () => {
    expect((await call('POST', '/api/render/demo?scale=2')).status).toBe(409);
    expect(spawned).toHaveLength(1);
  });

  it('a finished child → done, with its files', async () => {
    const c = spawned[0].child;
    c.out('done: 0:10 of video in 6:01 (frames 34.10 s per video second, sound 0.02, share 1.10)\n');
    c.out('master → /r/demo-126-136.mp4 (40.1 MB)\nshare → /r/demo-126-136-share.mp4 (2.5 MB; send it in WhatsApp as a document)\n');
    c.out('sheet → /r/demo-126-136-sheet.png\n');
    c.emit('close', 0);
    await tick();
    const v = json(await call('GET', `/api/render/jobs/${job}`)) as RenderJobView;
    expect(v).toMatchObject({ state: 'done', progress: 1, eta: 0, files: ['/r/demo-126-136.mp4', '/r/demo-126-136-share.mp4', '/r/demo-126-136-sheet.png'] });
  });

  it('the show on screen (a body) is rendered from a temp copy, whole song to the default name; a failed child → failed with its last line', async () => {
    const show = { version: 3, id: 'demo', song: 'demo', clips: [{ id: 'c1', start: 0, end: 30, track: 0, widget: 'squares' }] };
    const r = await call('POST', '/api/render/demo', JSON.stringify(show));
    expect(r.status).toBe(202);
    const id = (json(r).job as RenderJobView).id;
    expect(id).not.toBe(job);
    const { args, child } = spawned[1];
    expect(args[0]).not.toBe(join(shows, 'demo.json'));
    expect(JSON.parse(readFileSync(args[0], 'utf8'))).toEqual(show);
    expect(args).toEqual(expect.arrayContaining(['--scale', '2']));
    expect(args).not.toContain('--out');
    expect(args).not.toContain('--from');
    child.out('ETA 1:00 in all (frames 0:50, then sound and share copy 0:10; from the first 600 frames): done about 20:00\n');
    child.err('render-show: no recording /songs/demo/audio.wav\n');
    child.emit('close', 1);
    await tick();
    const v = json(await call('GET', `/api/render/jobs/${id}`)) as RenderJobView;
    expect(v).toMatchObject({ state: 'failed', eta: null, message: 'render-show: no recording /songs/demo/audio.wav' });
    expect(existsSync(args[0])).toBe(false);   // the temp copy is gone
  });

  it('a job can be cancelled: the child is killed', async () => {
    const r = await call('POST', '/api/render/demo?scale=3');
    const id = (json(r).job as RenderJobView).id;
    const c = spawned[2].child;
    const d = await call('DELETE', `/api/render/jobs/${id}`);
    expect(d.status).toBe(200);
    await tick();
    expect(c.killed).toBe(true);
    expect((json(await call('GET', `/api/render/jobs/${id}`)) as RenderJobView).state).toBe('cancelled');
    expect((await call('GET', '/api/render/jobs/nope')).status).toBe(404);
  });

  it('a child that cannot start → failed with why', async () => {
    const r = await call('POST', '/api/render/demo');
    const id = (json(r).job as RenderJobView).id;
    spawned[3].child.emit('error', new Error('spawn node ENOENT'));
    await tick();
    expect(json(await call('GET', `/api/render/jobs/${id}`))).toMatchObject({ state: 'failed', message: 'spawn node ENOENT' });
  });

  it('a cancel asks render-show over its IPC channel to clean up (no kill), and the job removes its work folder once it closes', async () => {
    ipc = true;
    try {
      const r = await call('POST', '/api/render/demo');
      const id = (json(r).job as RenderJobView).id, c = spawned[spawned.length - 1].child as IpcChild;
      const work = mkdtempSync(join(tmpdir(), 'wa-render-show-'));
      writeFileSync(join(work, 'video.mp4'), 'partial');
      const elsewhere = join(tmp, 'wa-render-show-not-temp'); mkdirSync(elsewhere);
      c.out(`work folder → ${elsewhere}\n`);   // not in the system temp folder: never taken
      c.out(`work folder → ${work}\n`);
      expect((await call('DELETE', `/api/render/jobs/${id}`)).status).toBe(200);
      expect(c.sent).toEqual([{ cancel: true }]);
      expect(c.killed).toBe(false);
      expect((json(await call('GET', `/api/render/jobs/${id}`)) as RenderJobView).state).toBe('cancelled');
      c.emit('close', 1);
      await tick();
      expect(existsSync(work)).toBe(false);
      expect(existsSync(elsewhere)).toBe(true);
      expect((json(await call('GET', `/api/render/jobs/${id}`)) as RenderJobView).state).toBe('cancelled');
    } finally { ipc = false; }
  });
});
