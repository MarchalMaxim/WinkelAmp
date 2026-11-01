/**
 * The studio's dev API (plan §8): a Vite plugin, dev only, so the studio can list songs, read packs and audio, and
 * read and save shows and their descriptions on disk. The static build has none of this (the studio then saves by
 * download). Writes come only from this machine (the dev server listens on the LAN: server.host is true).
 *
 *   GET  /api/health                      { ok: true, api: 1 }
 *   GET  /api/songs                       { songs: LibraryEntry[] } (an invalid pack is listed with `error`)
 *   PUT  /api/songs/<id>?name=<file>      the audio (≤ 1 GB) → songs/<id>/audio.<ext>
 *   PUT  /api/songs/<id>/pack             validatePack, else 400 { errors }
 *   GET  /api/shows/<id>                  Show | 404
 *   PUT  /api/shows/<id>                  validateShow (the pack's duration, the Node catalogue), else 400 { errors };
 *                                         writes canonicalShow, 204
 *   GET|PUT /api/shows/<id>/description   text ≤ 20 KB, shows/<id>.description.md
 *   GET  /songs/<id>/pack.json|audio.*    from the songs dir (WINKELAMP_SONGS too), with byte ranges for seeking
 *   POST /api/render/<show id>?scale=2&from=&to=   an HD master job (plan §10): `npm run render-show` of the show sent
 *                                         as the body (what the studio shows, saved or not), else shows/<id>.json, else
 *                                         the one composed for the song; 202 { job }, 409 while one runs (one at a time)
 *   GET  /api/render/jobs                 { job: the latest | null }
 *   GET|DELETE /api/render/jobs/<job>     RenderJobView: state, progress, eta, message, files; DELETE cancels it
 *   The render routes answer only this machine, reads included: they start a long job and name files on disk.
 * The plugin watches shows/*.json and sends the HMR event `studio:show-changed` { id } (Claude edits shows on disk).
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { Connect, Plugin } from 'vite';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import { canonicalShow, validateShow, type Show } from '../src/studio/show/show';
import { loadCatalogue } from './node/catalogue';
import { isSlug, REPO, showsDir, songsDir } from './node/pack-io';

import type { LibraryEntry } from '../src/studio/ui/api';
import type { RenderJobView } from '../src/studio/ui/record';
export type { LibraryEntry, RenderJobView };

const MAX_AUDIO = 1024 ** 3, MAX_JSON = 64 * 1024 * 1024, MAX_TEXT = 20 * 1024;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const TYPES: Record<string, string> = {
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp4': 'video/mp4', '.webm': 'audio/webm', '.weba': 'audio/webm',
};

class HttpError extends Error { constructor(readonly status: number, message: string, readonly body?: unknown) { super(message); } }

function send(res: ServerResponse, status: number, body?: unknown, type = 'application/json'): void {
  if (body === undefined) { res.writeHead(status); res.end(); return; }
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(text);
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = []; let size = 0, over = false;
    req.on('data', (c: Buffer) => {
      if (over) return;
      size += c.length;
      if (size > limit) { over = true; fail(new HttpError(413, `too big: more than ${limit} bytes`)); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!over) ok(Buffer.concat(chunks)); });
    req.on('error', fail);
  });
}

function writeAtomic(path: string, data: string | Buffer): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

function parseJson(buf: Buffer): unknown {
  try { return JSON.parse(buf.toString('utf8')); } catch (e) { throw new HttpError(400, `not JSON: ${(e as Error).message}`); }
}

const slug = (id: string): string => { if (!isSlug(id)) throw new HttpError(400, `${JSON.stringify(id)} is not an id (lowercase letters, digits, single dashes)`); return id; };

/** Reads a pack; a broken one gives { error }. */
function readPack(songs: string, id: string): { pack?: SongPack; error?: string } {
  try {
    const x = JSON.parse(readFileSync(join(songs, id, 'pack.json'), 'utf8')) as SongPack;
    const errors = validatePack(x);
    return errors.length ? { pack: x, error: errors.join('; ') } : { pack: x };
  } catch (e) { return { error: `pack.json: ${(e as Error).message}` }; }
}

let catalogue: ReturnType<typeof loadCatalogue>['widgets'] | null = null;
const widgets = () => (catalogue ??= loadCatalogue().widgets);

function serveFile(req: IncomingMessage, res: ServerResponse, file: string): void {
  const size = statSync(file).size, type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  const head = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { ...head, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    pipe(createReadStream(file, { start, end }), res);
    return;
  }
  res.writeHead(200, { ...head, 'content-length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  pipe(createReadStream(file), res);
}
function pipe(s: NodeJS.ReadableStream, res: ServerResponse): void {
  s.on('data', (c) => res.write(c));
  s.on('end', () => res.end());
  s.on('error', () => res.end());
}

// ── HD render jobs (plan §10, T14) ──────────────────────────────────────────────────────────────────────────────────

/** What spawning render-show gives back: its two output streams, close/error, and a way to stop it. */
export interface RenderChild {
  stdout: NodeJS.EventEmitter | null;
  stderr: NodeJS.EventEmitter | null;
  on(e: 'close', fn: (code: number | null) => void): unknown;
  on(e: 'error', fn: (err: Error) => void): unknown;
  kill(): boolean;
  /** The IPC channel (the real child has one): a { cancel: true } message lets render-show clean up and exit. */
  send?(message: unknown): boolean;
  connected?: boolean;
  pid?: number;
}
/** Starts `node scripts/render-show.mjs <args>` with these extra environment variables (tests pass a fake). */
export type RenderSpawner = (args: string[], env: Record<string, string>) => RenderChild;

const RENDER_SHOW = join(REPO, 'scripts', 'render-show.mjs');
const spawnRenderShow: RenderSpawner = (args, env) =>
  spawn(process.execPath, [RENDER_SHOW, ...args], { cwd: REPO, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });

/** Stops a render child at once with everything it started (Chrome, ffmpeg): on Windows a plain kill ends only the
    node process, so the whole tree goes (taskkill /T /F), its temp folder left for the job to remove. */
function killTree(c: RenderChild): void {
  if (process.platform === 'win32' && c.pid) {
    const k = spawn('taskkill', ['/T', '/F', '/PID', String(c.pid)], { windowsHide: true, stdio: 'ignore' });
    k.on('error', () => c.kill());
  } else c.kill();
}
/** How long a cancelled render-show gets to clean up before its tree is killed. */
const CANCEL_GRACE_MS = 20_000;

/** Every running render child of this process, so a closing dev server stops them. */
const children = new Set<RenderChild>();

/** m:ss (the minutes may pass 59), as render-show's clock() writes it → seconds. */
const unclock = (t: string): number => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };

/**
 * What one line of render-show says, for the job (render-show keeps these shapes for it):
 *   `  2:08 of 2:16: 150/600 frames (25 %), … about 0:15 left` → the frames drawn, and the frames' time left;
 *   `ETA 12:34 in all (…): done about 21:40` → the whole render's seconds from its start;
 *   `share copy: …` → the share phase (every frame is drawn);
 *   `master → <path> (12 MB)`, `share → <path> (…)`, `sheet → <path>` → a file.
 */
export function renderLine(line: string): {
  frames?: { done: number; n: number }; left?: number; total?: number; phase?: 'share';
  file?: { kind: 'master' | 'share' | 'sheet'; path: string }; work?: string;
} {
  const l = line.trim();
  let m = /^\d+:\d\d of \d+:\d\d: (\d+)\/(\d+) frames .*about (\d+:\d\d) left$/.exec(l);
  if (m) return { frames: { done: Number(m[1]), n: Number(m[2]) }, left: unclock(m[3]) };
  m = /^ETA (\d+:\d\d) in all\b/.exec(l);
  if (m) return { total: unclock(m[1]) };
  if (l.startsWith('share copy:')) return { phase: 'share' };
  m = /^(master|share|sheet) → (.+?)(?: \([^()]*\))?$/.exec(l);
  if (m) return { file: { kind: m[1] as 'master' | 'share' | 'sheet', path: m[2] } };
  m = /^work folder → (.+)$/.exec(l);
  if (m) return { work: m[1] };
  return {};
}

interface RenderJob {
  view: Omit<RenderJobView, 'eta'>;
  child: RenderChild;
  started: number;
  /** When the render should end (ms): from the ETA line, else from the frames' time left. */
  endsAt: number | null;
  fromEta: boolean;
  /** The temp folder of the show sent as the body. */
  tmp: string | null;
  /** render-show's own temp folder (its `work folder →` line), removed here when it did not finish. */
  work: string | null;
}

const viewOf = (j: RenderJob, now = Date.now()): RenderJobView => ({
  ...j.view, files: j.view.files ? [...j.view.files] : undefined,
  eta: j.view.state === 'done' ? 0 : j.view.state !== 'running' || j.endsAt === null ? null : Math.max(0, Math.round((j.endsAt - now) / 1000)),
});

/** A query number: absent → undefined; present → finite and ≥ 0, else 400. */
function queryNumber(url: URL, k: string): number | undefined {
  const v = url.searchParams.get(k);
  if (v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `?${k}= must be a number of seconds ≥ 0, not ${JSON.stringify(v)}`);
  return n;
}
/** 126 → '126', 12.54 → '12.5' (a part's file name). */
const tag = (n: number): string => String(Math.round(n * 10) / 10);

/** The render jobs: one running at a time, every one kept for GET (a few a session). */
function renderJobs(dirs: { songs: string; shows: string }, spawnRender: RenderSpawner) {
  const jobs = new Map<string, RenderJob>();
  let latest: RenderJob | null = null, count = 0;

  const start = (id: string, url: URL, body: Buffer): RenderJobView => {
    if (latest?.view.state === 'running') throw new HttpError(409, `an HD render of ${latest.view.show} is running: one at a time`);
    const scale = queryNumber(url, 'scale') ?? 2;
    if (![1, 2, 3].includes(scale)) throw new HttpError(400, `?scale= is 1, 2 or 3, not ${scale}`);
    const from = queryNumber(url, 'from'), to = queryNumber(url, 'to');
    if (from !== undefined && to !== undefined && !(to > from)) throw new HttpError(400, `?to= (${to}) must come after ?from= (${from})`);
    // The show: the body (what the studio shows, saved or not) in a temp file, else the saved one, else the one
    // render-show composes for the song.
    let show: string, tmp: string | null = null;
    if (body.length) {
      const s = parseJson(body) as { id?: unknown } | null;
      if (!s || typeof s !== 'object' || s.id !== id) throw new HttpError(400, `the body is not the show ${id}`);
      tmp = mkdtempSync(join(tmpdir(), 'wa-render-job-'));
      show = join(tmp, `${id}.json`);
      writeFileSync(show, body);
    } else show = existsSync(join(dirs.shows, `${id}.json`)) ? join(dirs.shows, `${id}.json`) : id;
    const args = [show, '--scale', String(scale)];
    if (from !== undefined) args.push('--from', String(from));
    if (to !== undefined) args.push('--to', String(to));
    // A part of the song gets its own name, so it never replaces the whole song's master.
    if (from !== undefined || to !== undefined) args.push('--out', join(REPO, 'renders', `${id}-${tag(from ?? 0)}-${to === undefined ? 'end' : tag(to)}`));

    const child = spawnRender(args, { WINKELAMP_SONGS: dirs.songs, WINKELAMP_SHOWS: dirs.shows });
    const job: RenderJob = {
      view: { id: `${Date.now().toString(36)}-${++count}`, show: id, state: 'running', progress: 0, message: 'starting render-show' },
      child, started: Date.now(), endsAt: null, fromEta: false, tmp, work: null,
    };
    jobs.set(job.view.id, job); latest = job; children.add(child);
    const read = (raw: string) => {
      const line = raw.replace(/\r$/, '').trim();
      if (!line) return;
      job.view.message = line;
      const r = renderLine(line), now = Date.now();
      if (r.frames) job.view.progress = r.frames.n ? Math.min(1, r.frames.done / r.frames.n) : 0;
      if (r.left !== undefined && !job.fromEta) job.endsAt = now + r.left * 1000;
      if (r.total !== undefined) { job.endsAt = job.started + r.total * 1000; job.fromEta = true; }
      if (r.phase === 'share') job.view.progress = 1;
      if (r.file) (job.view.files ??= []).push(r.file.path);
      // only a folder render-show makes (mkdtemp in the system temp folder) is ever removed
      if (r.work && basename(r.work).startsWith('wa-render-show-') && resolve(dirname(r.work)) === resolve(tmpdir())) job.work = r.work;
    };
    for (const s of [child.stdout, child.stderr]) {
      if (!s) continue;
      // Whole lines only, decoded across chunks ("→" and "×" are several bytes).
      const dec = new StringDecoder('utf8');
      let rest = '';
      s.on('data', (c: Buffer | string) => {
        rest += typeof c === 'string' ? c : dec.write(c);
        const lines = rest.split('\n');
        rest = lines.pop() ?? '';
        lines.forEach(read);
      });
      s.on('end', () => { rest += dec.end(); if (rest) read(rest); rest = ''; });
    }
    const end = (state: 'done' | 'failed', message?: string) => {
      children.delete(child);
      if (job.tmp) { rmSync(job.tmp, { recursive: true, force: true }); job.tmp = null; }
      // A render that did not finish (cancelled, killed, failed) may have left its partial video behind.
      if (job.work && (job.view.state !== 'running' || state !== 'done')) {
        try { rmSync(job.work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* still locked: the OS's temp cleanup */ }
        job.work = null;
      }
      if (job.view.state !== 'running') return;   // cancelled, or an error came before the close
      job.view.state = state;
      if (state === 'done') job.view.progress = 1;
      if (message) job.view.message = message;
    };
    child.on('error', (e) => end('failed', e.message));
    child.on('close', (code) => end(code === 0 ? 'done' : 'failed',
      code !== 0 && job.view.message === 'starting render-show' ? `render-show stopped (exit ${code}) before saying anything` : undefined));
    return viewOf(job);
  };

  const cancel = (j: RenderJob): RenderJobView => {
    if (j.view.state !== 'running') return viewOf(j);
    j.view.state = 'cancelled'; j.view.message = 'cancelled';
    const c = j.child;
    let asked = false;
    if (typeof c.send === 'function' && c.connected !== false) { try { asked = c.send({ cancel: true }); } catch { asked = false; } }
    if (!asked) killTree(c);
    else {
      // render-show closes Chrome and ffmpeg and removes its temp folder; if it hangs, the whole tree goes
      const t = setTimeout(() => { if (children.has(c)) killTree(c); }, CANCEL_GRACE_MS);
      t.unref?.();
    }
    return viewOf(j);
  };

  return {
    /** The /api/render/… routes; false when none matches. */
    async handle(parts: string[], url: URL, method: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
      if (parts.length === 2 && parts[1] !== 'jobs' && method === 'POST') {
        const id = slug(parts[1]);
        const view = start(id, url, await readBody(req, MAX_JSON));
        send(res, 202, { job: view });
        return true;
      }
      if (parts[1] !== 'jobs') return false;
      if (parts.length === 2 && method === 'GET') { send(res, 200, { job: latest ? viewOf(latest) : null }); return true; }
      if (parts.length === 3 && (method === 'GET' || method === 'DELETE')) {
        const j = jobs.get(parts[2]);
        if (!j) throw new HttpError(404, `no render job ${parts[2]}`);
        send(res, 200, method === 'DELETE' ? cancel(j) : viewOf(j));
        return true;
      }
      return false;
    },
  };
}

export interface ApiOptions {
  /** How the HD render job starts render-show (tests pass a fake). */
  spawnRender?: RenderSpawner;
}

export function apiMiddleware(dirs: { songs: string; shows: string }, o: ApiOptions = {}): Connect.NextHandleFunction {
  const { songs, shows } = dirs;
  const render = renderJobs(dirs, o.spawnRender ?? spawnRenderShow);
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://local');
    const path = (req.url ?? '/').split('?')[0];
    const method = req.method ?? 'GET';
    const write = method === 'PUT' || method === 'POST' || method === 'DELETE';
    const isApi = path.startsWith('/api/'), isSongs = path.startsWith('/songs/');
    if (!isApi && !isSongs) return next();
    if (write && !LOOPBACK.has(req.socket?.remoteAddress ?? '')) throw new HttpError(403, 'writes only from this machine');

    if (isSongs) {
      const m = /^\/songs\/([^/]+)\/([^/]+)$/.exec(path);
      if (!m || method !== 'GET' && method !== 'HEAD') throw new HttpError(400, 'GET /songs/<id>/pack.json or /songs/<id>/audio.<ext>');
      const id = slug(decodeURIComponent(m[1])), name = decodeURIComponent(m[2]);
      if (name !== 'pack.json' && !/^audio\.[A-Za-z0-9]+$/.test(name)) throw new HttpError(404, `no ${name} here`);
      const file = join(songs, id, name);
      if (!existsSync(file)) throw new HttpError(404, `no songs/${id}/${name}`);
      return serveFile(req, res, file);
    }

    const parts = path.slice('/api/'.length).split('/').map((p) => decodeURIComponent(p));
    if (parts[0] === 'health' && parts.length === 1 && method === 'GET') return send(res, 200, { ok: true, api: 1 });

    if (parts[0] === 'render') {
      if (!LOOPBACK.has(req.socket?.remoteAddress ?? '')) throw new HttpError(403, 'HD renders only from this machine');
      if (await render.handle(parts, url, method, req, res)) return;
    }

    if (parts[0] === 'songs') {
      if (parts.length === 1 && method === 'GET') {
        const list: LibraryEntry[] = [];
        const ids = existsSync(songs) ? readdirSync(songs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
        for (const id of ids) {
          if (!isSlug(id) || !existsSync(join(songs, id, 'pack.json'))) continue;
          const { pack, error } = readPack(songs, id);
          const hasShow = existsSync(join(shows, `${id}.json`));
          const e: LibraryEntry = {
            id, title: typeof pack?.title === 'string' ? pack.title : id,
            duration: typeof pack?.duration === 'number' ? pack.duration : 0,
            notesFrom: pack?.notesFrom ?? 'approx', hasShow,
          };
          if (error) e.error = error;
          list.push(e);
        }
        return send(res, 200, { songs: list });
      }
      const id = slug(parts[1] ?? '');
      if (parts.length === 2 && method === 'PUT') {
        const name = url.searchParams.get('name') ?? '';
        const ext = extname(basename(name)).toLowerCase();
        if (!/^\.[a-z0-9]{1,5}$/.test(ext)) throw new HttpError(400, `?name=<file> with an audio extension, not ${JSON.stringify(name)}`);
        const body = await readBody(req, MAX_AUDIO);
        if (!body.length) throw new HttpError(400, 'empty body');
        writeAtomic(join(songs, id, `audio${ext}`), body);
        return send(res, 204);
      }
      if (parts.length === 3 && parts[2] === 'pack' && method === 'PUT') {
        const pack = parseJson(await readBody(req, MAX_JSON));
        const errors = validatePack(pack);
        if (!errors.length && (pack as SongPack).id !== id) errors.push(`id: ${(pack as SongPack).id} is not ${id}`);
        if (errors.length) return send(res, 400, { errors });
        writeAtomic(join(songs, id, 'pack.json'), JSON.stringify(pack));
        return send(res, 204);
      }
    }

    if (parts[0] === 'shows' && parts.length >= 2) {
      const id = slug(parts[1]);
      const file = join(shows, `${id}.json`), desc = join(shows, `${id}.description.md`);
      if (parts.length === 2 && method === 'GET') {
        if (!existsSync(file)) throw new HttpError(404, `no shows/${id}.json`);
        return send(res, 200, readFileSync(file, 'utf8'));
      }
      if (parts.length === 2 && method === 'PUT') {
        const show = parseJson(await readBody(req, MAX_JSON)) as Show;
        const sp = readPack(songs, typeof show?.song === 'string' && isSlug(show.song) ? show.song : id).pack, duration = sp?.duration;
        const { errors } = validateShow(show, { duration: typeof duration === 'number' ? duration : undefined, widgets: widgets(),
          tracks: sp ? Object.keys(sp.tracks ?? {}) : undefined });
        if (!errors.length && show.id !== id) errors.push({ path: 'id', message: `the show says id '${show.id}' but is saved as '${id}'` });
        if (errors.length) return send(res, 400, { errors });
        writeAtomic(file, canonicalShow(show));
        return send(res, 204);
      }
      if (parts.length === 3 && parts[2] === 'description') {
        if (method === 'GET') return send(res, 200, existsSync(desc) ? readFileSync(desc, 'utf8') : '', 'text/markdown');
        if (method === 'PUT') {
          const body = await readBody(req, MAX_TEXT);
          writeAtomic(desc, body);
          return send(res, 204);
        }
      }
    }
    throw new HttpError(404, `no ${method} ${path}`);
  };
  return (req, res, next) => {
    handle(req, res, next).catch((e: unknown) => {
      if (e instanceof HttpError) send(res, e.status, { error: e.message });
      else { console.error('[studio-api]', e); send(res, 500, { error: String(e) }); }
    });
  };
}

/** The dev-only plugin: the API, and an HMR event when a show changes on disk. */
export function studioApi(dirs: { songs?: string; shows?: string } = {}): Plugin {
  return {
    name: 'winkelamp-studio-api',
    apply: 'serve',
    configureServer(server) {
      const d = { songs: dirs.songs ?? songsDir(), shows: dirs.shows ?? showsDir() };
      server.middlewares.use(apiMiddleware(d));
      // A render job does not outlive its dev server.
      server.httpServer?.once('close', () => { for (const c of children) killTree(c); });
      mkdirSync(d.shows, { recursive: true });
      server.watcher.add(d.shows);
      const changed = (file: string) => {
        const f = resolve(file);
        if (resolve(f, '..') !== resolve(d.shows) || !f.endsWith('.json')) return;
        const id = basename(f, '.json');
        if (isSlug(id)) server.ws.send({ type: 'custom', event: 'studio:show-changed', data: { id } });
      };
      server.watcher.on('change', changed);
      server.watcher.on('add', changed);
    },
  };
}
