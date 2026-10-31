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
 * The plugin watches shows/*.json and sends the HMR event `studio:show-changed` { id } (Claude edits shows on disk).
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, extname, join, resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { validatePack, type SongPack } from '../src/studio/pack/pack';
import { canonicalShow, validateShow, type Show } from '../src/studio/show/show';
import { loadCatalogue } from './node/catalogue';
import { isSlug, showsDir, songsDir } from './node/pack-io';

import type { LibraryEntry } from '../src/studio/ui/api';
export type { LibraryEntry };

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

export function apiMiddleware(dirs: { songs: string; shows: string }): Connect.NextHandleFunction {
  const { songs, shows } = dirs;
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
        const duration = readPack(songs, typeof show?.song === 'string' && isSlug(show.song) ? show.song : id).pack?.duration;
        const { errors } = validateShow(show, { duration: typeof duration === 'number' ? duration : undefined, widgets: widgets() });
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
