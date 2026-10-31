/**
 * The ears server (plan §9): a small local server, so the studio can turn a dropped recording into a song pack with
 * the transcribers (the GPU piano model, YourMT3+'s instruments, basic-pitch's gap fill). It runs
 * `npm run ingest -- --notes auto` on each upload, one at a time, and reports the progress.
 *
 *   npm run ears [-- --port 5175]
 *
 *   GET  /health                                  { ok: true, api: 2, transcriber: TranscriberStatus, ymt3: ToolStatus,
 *                                                 bp: ToolStatus } (each tool says why it cannot run)
 *   POST /ingest?name=<file>[&id=<slug>][&title=<t>]   body = the audio → 202 { job, id }, or 200 { job: null, id,
 *                                                 existing: true } when a pack of the same recording (sha1) is there
 *   POST /ingest?id=<slug>&redo=1                 no body: ingest songs/<id>/audio.* again (e.g. GPU notes for an
 *                                                 approximate pack, or instrument tracks) → 202 { job, id }
 *   GET  /jobs/<job>                              Job
 *
 * Binds 127.0.0.1 only. Browsers may call it from http://localhost:* and http://127.0.0.1:* (the studio's dev server);
 * other origins get 403. Whatever transcriber is missing, ingest's auto mode falls back a row (YourMT3+ → basic-pitch →
 * the piano model alone → approximate notes) and the pack's warnings say so; the job carries them. A job whose ingest
 * still fails in a transcriber (exit 3) runs again with approximate notes, and says why.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { finished } from 'node:stream/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKING_TRANSCRIBER, type EarsHealth, type IngestProgress, type Job, type ToolStatus, type TranscriberStatus } from '../../src/studio/ingest/ears-types';
import { freeId, nameFromFile } from '../../src/studio/ingest/names';
import { overallProgress } from '../../src/studio/ingest/progress';
import { isSlug, REPO, songsDir } from '../node/pack-io';
import { probeBp, probeTranscriber, tail } from '../node/python';
import { probeYmt3 } from '../node/ymt3';

export interface EarsOptions {
  /** 5175; 0 = any free port (tests). */
  port?: number;
  /** The songs folder (default songsDir(): WINKELAMP_SONGS or <repo>/songs); the ingest child gets it too. */
  songs?: string;
  /** Largest upload, bytes (1 GB). */
  maxBytes?: number;
  /** Whether the transcriber can run (default: transcribe.py --probe, once at start). */
  probe?: () => Promise<TranscriberStatus>;
  /** Whether YourMT3+ can run (default: ymt3.py --probe through ymt3.json, once at start). */
  probeYmt3?: () => Promise<ToolStatus>;
  /** Whether basic-pitch can run (default: bp.py --probe, once at start). */
  probeBp?: () => Promise<ToolStatus>;
  /** Runs the ingest CLI with these arguments (default: node --import tsx scripts/ingest.ts …). */
  runIngest?: (args: string[]) => ChildProcess;
  /** Where the server says what it does (default: nothing; npm run ears logs to the console). */
  log?: (line: string) => void;
}

export const EARS_PORT = 5175;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const CHECKING: TranscriberStatus = { ok: false, python: null, device: null, reason: CHECKING_TRANSCRIBER };
const CHECKING_TOOL: ToolStatus = { ok: false, python: null, reason: CHECKING_TRANSCRIBER };

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

interface Work {
  pub: Job;
  input: string;
  title: string;
  redo: boolean;
  sha1: string | null;
  /** A temp folder holding the upload, removed when the job ends. */
  tmp: string | null;
}

/** A pack's recording: its sha1 and whether its audio is still there. */
function packSha1(songs: string, id: string): string | null {
  try {
    const p = JSON.parse(readFileSync(join(songs, id, 'pack.json'), 'utf8')) as { audio?: unknown; source?: { sha1?: unknown } };
    if (typeof p.audio !== 'string' || !existsSync(join(songs, id, p.audio))) return null;
    return typeof p.source?.sha1 === 'string' ? p.source.sha1 : null;
  } catch { return null; }
}

/** A file name safe to keep in a temp folder: the dropped file's own name (ingest takes the title and source name from it). */
function safeName(name: string): { file: string; ext: string } | null {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/[<>:"|?*\x00-\x1f]/g, '').trim();
  const m = /(\.[A-Za-z0-9]{1,5})$/.exec(base);
  if (!m) return null;
  const stem = base.slice(0, -m[1].length).replace(/^\.+/, '');
  return { file: (stem || 'audio') + m[1].toLowerCase(), ext: m[1].toLowerCase() };
}

export function startEars(o: EarsOptions = {}): Promise<{ port: number; close(): Promise<void> }> {
  const songs = resolve(o.songs ?? songsDir());
  const maxBytes = o.maxBytes ?? 1024 ** 3;
  const log = o.log ?? (() => {});
  const runIngest = o.runIngest ?? ((args: string[]) => spawn(process.execPath, ['--import', 'tsx', join(REPO, 'scripts', 'ingest.ts'), ...args], {
    cwd: REPO, env: { ...process.env, WINKELAMP_SONGS: songs }, windowsHide: true,
  }));
  // Probed once (importing torch takes seconds): /health answers at once meanwhile, and each job waits for it.
  let transcriber: TranscriberStatus | null = null;
  const probing = (o.probe ?? probeTranscriber)().catch((e: unknown): TranscriberStatus =>
    ({ ok: false, python: null, device: null, reason: `the probe failed: ${(e as Error).message}` }));
  void probing.then((s) => (transcriber = s));
  // The other two only feed /health (ingest finds them and falls back on its own): probed alongside, never waited for.
  const tool = (probe: () => Promise<ToolStatus>, name: string) => {
    let s: ToolStatus | null = null;
    void probe().catch((e: unknown): ToolStatus => ({ ok: false, python: null, reason: `the ${name} probe failed: ${(e as Error).message}` }))
      .then((r) => (s = r));
    return () => s ?? CHECKING_TOOL;
  };
  const ymt3 = tool(o.probeYmt3 ?? probeYmt3, 'YourMT3+');
  const bp = tool(o.probeBp ?? probeBp, 'basic-pitch');

  const jobs = new Map<string, Work>();
  const queue: Work[] = [];
  let running: Work | null = null;
  let child: ChildProcess | null = null;
  let closed = false;

  const active = () => [...jobs.values()].filter((w) => w.pub.state === 'queued' || w.pub.state === 'running');
  const taken = (id: string) => existsSync(join(songs, id)) || active().some((w) => w.pub.id === id);

  const advance = (w: Work, p: Partial<Job>) => {
    if (p.progress !== undefined) p.progress = Math.max(w.pub.progress, Math.min(1, p.progress));
    Object.assign(w.pub, p);
  };

  /** One run of the ingest CLI; progress maps into [from, 1]. Resolves with the exit code and the stderr tail. */
  const attempt = (w: Work, notes: 'auto' | 'approx', from: number): Promise<{ code: number | null; err: string }> => new Promise((done) => {
    const args = [w.input, '--id', w.pub.id, '--title', w.title, '--notes', notes, '--progress', 'json'];
    if (w.redo) args.push('--force');
    let p: ChildProcess;
    try { p = runIngest(args); } catch (e) { done({ code: null, err: (e as Error).message }); return; }
    child = p;
    let out = '', err = '';
    p.stdout?.on('data', (d: Buffer) => {
      const lines = (out + d.toString()).split(/\r?\n/);
      out = lines.pop() ?? '';
      for (const line of lines) {
        let m: IngestProgress;
        try { m = JSON.parse(line) as IngestProgress; } catch { continue; }
        if (m.stage === 'done') {
          for (const x of m.warnings ?? []) if (!w.pub.warnings.includes(x)) w.pub.warnings.push(x);
          continue;
        }
        // Ingest v2 says its overall progress (it knows which transcribers run); an older line is weighted here.
        const f = typeof m.overall === 'number' ? m.overall : overallProgress(m.stage, m.progress, notes === 'auto');
        advance(w, { stage: m.stage, message: m.message, progress: from + (1 - from) * f * 0.999 });
      }
    });
    p.stderr?.on('data', (d: Buffer) => { err = (err + d.toString()).slice(-8000); });
    p.on('error', (e) => { err += `\n${e.message}`; });
    p.on('close', (code) => { child = null; done({ code, err: tail(err) }); });
  });

  const run = async (w: Work): Promise<void> => {
    running = w;
    try {
      advance(w, { state: 'running', message: 'waiting for the transcriber check' });
      // Waited for so a first job never races torch's import in the probe; ingest decides what runs on its own.
      const t = await probing;
      // Said as it is, with no claim about the notes: YourMT3+ or basic-pitch may still give them (the pack's own
      // warnings, merged in from ingest's done line, say what came of it).
      if (!t.ok) w.pub.warnings.push(`transcriber unavailable: ${t.reason ?? 'unknown'}`);
      log(`job ${w.pub.job}: ${w.pub.id} (notes auto; piano model ${t.ok ? 'ready' : `unavailable: ${t.reason ?? 'unknown'}`})`);
      let r = await attempt(w, 'auto', 0);
      if (r.code === 3 && !closed) {
        // The transcriber failed on this recording (out of memory, a broken file…): approximate notes, and say so.
        const lines = r.err.split('\n');
        const why = lines.find((l) => l.trim() && !/^ingest:|pass --notes/.test(l)) ?? lines[0];
        w.pub.warnings.push(`the transcriber failed (${why.trim().slice(0, 300)}); approximate notes from the analysis`);
        r = await attempt(w, 'approx', w.pub.progress);
      }
      if (r.code === 0) {
        advance(w, { state: 'done', progress: 1, message: 'done' });
        log(`job ${w.pub.job}: ${w.pub.id} done${w.pub.warnings.length ? ` (${w.pub.warnings.join('; ')})` : ''}`);
      } else {
        advance(w, { state: 'failed', message: 'failed', error: r.err || `ingest exited ${r.code}` });
        log(`job ${w.pub.job}: ${w.pub.id} failed: ${w.pub.error}`);
      }
    } catch (e) {
      advance(w, { state: 'failed', message: 'failed', error: (e as Error).message });
    } finally {
      if (w.tmp) rmSync(w.tmp, { recursive: true, force: true });
      running = null;
    }
  };

  const pump = () => {
    if (running || closed) return;
    const next = queue.shift();
    if (next) void run(next).finally(pump);
  };

  const enqueue = (w: Work) => {
    jobs.set(w.pub.job, w);
    queue.push(w);
    pump();
  };

  const newJob = (id: string, message: string): Job =>
    ({ job: randomBytes(6).toString('hex'), id, state: 'queued', stage: 'upload', progress: 0, message, warnings: [] });

  /** The body to a temp file under its own name, hashed on the way; 413 past maxBytes, 400 when empty, 500 when the
      file cannot be written (disk full, temp folder gone): that request fails, the server carries on. */
  const receive = async (req: IncomingMessage, file: string): Promise<{ sha1: string; bytes: number }> => {
    const declared = Number(req.headers['content-length']);
    if (declared > maxBytes) {
      req.resume();   // drain it, so the client reads the 413 rather than a reset connection
      throw new HttpError(413, `too big: more than ${maxBytes} bytes`);
    }
    const hash = createHash('sha1'), out = createWriteStream(file);
    let bytes = 0, over = false, failed: Error | null = null;
    out.on('error', (e) => { failed ??= e; });
    try {
      for await (const chunk of req as AsyncIterable<Buffer>) {
        if (over || failed) continue;   // drain the rest, so the client reads the answer
        bytes += chunk.length;
        if (bytes > maxBytes) { over = true; continue; }
        hash.update(chunk);
        if (!out.write(chunk)) await new Promise((r) => { out.once('drain', r); out.once('error', r); });
      }
    } finally {
      out.end();
      await finished(out).catch(() => {});
    }
    if (failed) throw new HttpError(500, `could not keep the upload: ${(failed as Error).message}`);
    if (over) throw new HttpError(413, `too big: more than ${maxBytes} bytes`);
    if (!bytes) throw new HttpError(400, 'empty body: send the recording');
    return { sha1: hash.digest('hex'), bytes };
  };

  const ingest = async (req: IncomingMessage, url: URL): Promise<[number, unknown]> => {
    const want = url.searchParams.get('id');
    if (want !== null && !isSlug(want)) throw new HttpError(400, `${JSON.stringify(want)} is not an id (lowercase letters, digits, single dashes)`);

    if (url.searchParams.get('redo') === '1') {
      if (!want) throw new HttpError(400, 'redo needs ?id=<song>');
      req.resume();
      const dir = join(songs, want);
      let title = want, audio: string | undefined;
      try {
        const p = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8')) as { title?: unknown; audio?: unknown };
        if (typeof p.title === 'string') title = p.title;
        if (typeof p.audio === 'string' && existsSync(join(dir, p.audio))) audio = p.audio;
      } catch { /* no pack: look for the audio alone */ }
      audio ??= existsSync(dir) ? readdirSync(dir).find((f) => /^audio\.[A-Za-z0-9]+$/.test(f)) : undefined;
      if (!audio) throw new HttpError(404, `no recording in songs/${want}`);
      const busy = active().find((w) => w.pub.id === want);
      if (busy) return [202, { job: busy.pub.job, id: want }];
      const w: Work = { pub: newJob(want, 'queued'), input: join(dir, audio), title, redo: true, sha1: null, tmp: null };
      enqueue(w);
      return [202, { job: w.pub.job, id: want }];
    }

    const name = url.searchParams.get('name') ?? '';
    const safe = safeName(name);
    if (!safe) throw new HttpError(400, `?name=<file> with an audio extension, not ${JSON.stringify(name)}`);
    mkdirSync(songs, { recursive: true });
    const tmp = mkdtempSync(join(tmpdir(), 'wa-ears-'));
    const file = join(tmp, safe.file);
    let got: { sha1: string; bytes: number };
    try { got = await receive(req, file); } catch (e) { rmSync(tmp, { recursive: true, force: true }); throw e; }

    const named = nameFromFile(safe.file);
    const base = want ?? (isSlug(named.id) ? named.id : 'song');
    // The same recording: already packed (its own id first), or on its way.
    const ids = existsSync(songs) ? readdirSync(songs, { withFileTypes: true }).filter((d) => d.isDirectory() && isSlug(d.name)).map((d) => d.name) : [];
    const same = [base, ...ids.filter((i) => i !== base)].find((i) => packSha1(songs, i) === got.sha1);
    const pending = active().find((w) => w.sha1 === got.sha1);
    if (same && !pending) { rmSync(tmp, { recursive: true, force: true }); return [200, { job: null, id: same, existing: true }]; }
    if (pending) { rmSync(tmp, { recursive: true, force: true }); return [202, { job: pending.pub.job, id: pending.pub.id }]; }

    const id = want ?? freeId(base, taken);
    const title = url.searchParams.get('title')?.trim() || named.title || id;
    const w: Work = { pub: newJob(id, queue.length || running ? 'waiting for the recording before it' : 'queued'), input: file, title, redo: false, sha1: got.sha1, tmp };
    enqueue(w);
    log(`upload ${safe.file} (${(got.bytes / 1e6).toFixed(1)} MB) → ${id}`);
    return [202, { job: w.pub.job, id }];
  };

  const server = createServer((req, res: ServerResponse) => {
    const origin = req.headers.origin;
    const okOrigin = !origin || LOCAL_ORIGIN.test(origin);
    const head: Record<string, string> = { 'cache-control': 'no-store' };
    if (origin && okOrigin) Object.assign(head, { 'access-control-allow-origin': origin, vary: 'Origin' });
    const send = (status: number, body?: unknown) => {
      if (body === undefined) { res.writeHead(status, head); res.end(); return; }
      res.writeHead(status, { ...head, 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';
    const go = async (): Promise<void> => {
      if (!okOrigin && (method === 'POST' || method === 'OPTIONS')) { req.resume(); throw new HttpError(403, `origin ${origin} may not use the ears server`); }
      if (method === 'OPTIONS') {
        Object.assign(head, { 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type',
          'access-control-max-age': '600', 'access-control-allow-private-network': 'true' });
        return send(204);
      }
      if (method === 'GET' && url.pathname === '/health') {
        const health: EarsHealth = { ok: true, api: 2, transcriber: transcriber ?? CHECKING, ymt3: ymt3(), bp: bp() };
        return send(200, health);
      }
      const jm = /^\/jobs\/([^/]+)$/.exec(url.pathname);
      if (method === 'GET' && jm) {
        const w = jobs.get(decodeURIComponent(jm[1]));
        if (!w) throw new HttpError(404, `no job ${jm[1]}`);
        return send(200, w.pub);
      }
      if (method === 'POST' && url.pathname === '/ingest') {
        const [status, body] = await ingest(req, url);
        return send(status, body);
      }
      req.resume();
      throw new HttpError(404, `no ${method} ${url.pathname}`);
    };
    go().catch((e: unknown) => {
      if (res.headersSent) return;
      if (e instanceof HttpError) send(e.status, { error: e.message });
      else { log(`error: ${(e as Error).stack ?? String(e)}`); send(500, { error: String(e) }); }
    });
  });

  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(o.port ?? EARS_PORT, '127.0.0.1', () => {
      const addr = server.address();
      ok({
        port: typeof addr === 'object' && addr ? addr.port : (o.port ?? EARS_PORT),
        close: () => new Promise<void>((done) => {
          closed = true;
          child?.kill();
          server.closeAllConnections?.();
          server.close(() => done());
        }),
      });
    });
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--port');
  const port = i >= 0 ? Number(argv[i + 1]) : EARS_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('usage: npm run ears [-- --port 5175]'); process.exit(2); }
  const t0 = Date.now();
  let status: TranscriberStatus | null = null, ymt3: ToolStatus | null = null, bp: ToolStatus | null = null;
  const probe = () => probeTranscriber().then((s) => (status = s));
  const probeY = () => probeYmt3().then((s) => (ymt3 = s));
  const probeB = () => probeBp().then((s) => (bp = s));
  const log = (s: string) => console.log(`ears: ${s}`);
  const ears = await startEars({ port, probe, probeYmt3: probeY, probeBp: probeB, log }).catch((e: NodeJS.ErrnoException) => {
    console.error(e.code === 'EADDRINUSE' ? `ears: port ${port} is taken (is the ears server already running?)` : `ears: ${e.message}`);
    process.exit(1);
  });
  log(`listening on http://127.0.0.1:${ears.port}; songs go to ${resolve(songsDir())}`);
  log('checking the transcribers (importing torch takes a few seconds)…');
  const wait = setInterval(() => {
    if (!status || !ymt3 || !bp) return;
    clearInterval(wait);
    const s = status as TranscriberStatus, y = ymt3 as ToolStatus, b = bp as ToolStatus;
    log(s.ok ? `piano model ready on ${s.device} (${s.python}, checked in ${((Date.now() - t0) / 1000).toFixed(1)} s)`
      : `piano model unavailable: ${s.reason}`);
    log(y.ok ? 'YourMT3+ ready: ensemble recordings get instrument tracks' : `YourMT3+ unavailable: ${y.reason}`);
    log(b.ok ? 'basic-pitch ready (the gap fill without YourMT3+)' : `basic-pitch unavailable: ${b.reason}`);
    if (!s.ok && !y.ok && !b.ok) log('no transcriber can run: dropped recordings get approximate notes.');
    log('drop a recording in the studio (npm run dev). Ctrl+C stops.');
  }, 100);
  const stop = () => { void ears.close().then(() => process.exit(0)); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === self.toLowerCase()) void main();
