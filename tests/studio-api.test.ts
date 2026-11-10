/// <reference types="node" />
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { apiMiddleware, whileUnchanged } from '../scripts/studio-api';
import { canonicalMelody, emptyMelody, type Melody } from '../src/studio/show/melody';
import { canonicalShow, type Show } from '../src/studio/show/show';

const tmp = mkdtempSync(join(tmpdir(), 'wa-studio-api-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const songs = join(tmp, 'songs'), shows = join(tmp, 'shows');
mkdirSync(join(songs, 'demo'), { recursive: true }); mkdirSync(join(songs, 'broken')); mkdirSync(join(songs, 'empty')); mkdirSync(shows);

const PACK = {
  version: 1, id: 'demo', title: 'Demo song', audio: 'audio.wav', duration: 30,
  source: { name: 'demo.wav', bytes: 10, sha1: 'a'.repeat(40) },
  notes: [[1, 2, 60, 80], [2, 3, 64, 90]], notesFrom: 'file', transcriber: null,
  quality: { onsetCoverage: 1, notesPerMinute: 4, warnings: [] },
  sections: [{ start: 0, end: 30, novelty: 0 }], beats: [], loudness: { hop: 0.1, values: new Array(300).fill(0.1) },
  harmony: [], made: { by: 'ingest', at: '2026-10-31T00:00:00.000Z' },
};
writeFileSync(join(songs, 'demo', 'pack.json'), JSON.stringify(PACK));
writeFileSync(join(songs, 'demo', 'audio.wav'), Buffer.from('0123456789'));
writeFileSync(join(songs, 'broken', 'pack.json'), JSON.stringify({ ...PACK, id: 'broken', version: 7 }));

const mw = apiMiddleware({ songs, shows });

interface Res { status: number; headers: Record<string, string | number>; body: Buffer }
function call(method: string, url: string, body?: string | Buffer, o: { remote?: string; headers?: Record<string, string> } = {}): Promise<Res & { next: boolean }> {
  return new Promise((resolve) => {
    const req = Object.assign(new EventEmitter(), {
      method, url, headers: { ...(o.headers ?? {}) } as Record<string, string>, socket: { remoteAddress: o.remote ?? '127.0.0.1' },
    });
    const chunks: Buffer[] = [];
    const res = {
      statusCode: 200, headers: {} as Record<string, string | number>,
      setHeader(k: string, v: string | number) { this.headers[k.toLowerCase()] = v; },
      writeHead(code: number, h?: Record<string, string | number>) { this.statusCode = code; for (const [k, v] of Object.entries(h ?? {})) this.headers[k.toLowerCase()] = v; return this; },
      write(c: string | Buffer) { chunks.push(Buffer.from(c)); return true; },
      end(c?: string | Buffer) { if (c) chunks.push(Buffer.from(c)); resolve({ status: this.statusCode, headers: this.headers, body: Buffer.concat(chunks), next: false }); },
      on() { return this; }, once() { return this; }, emit() { return true; },
    };
    mw(req as never, res as never, () => resolve({ status: 0, headers: {}, body: Buffer.alloc(0), next: true }));
    setTimeout(() => { if (body !== undefined) req.emit('data', Buffer.from(body)); req.emit('end'); }, 0);
  });
}
const json = (r: Res) => JSON.parse(r.body.toString('utf8'));

const GOOD: Show = { version: 3, id: 'demo', song: 'demo', clips: [
  { id: 'c1', start: 0, end: 12, track: 0, widget: 'squares' },
  { id: 'c2', start: 12, end: 30, track: 0, fade: 3, widget: 'kandinsky' }, { id: 'c3', start: 12, end: 30, track: 1, widget: 'casket', knobs: { cut: 0.4 } },
] };

describe('studio dev API', () => {
  it('answers health', async () => {
    expect(json(await call('GET', '/api/health'))).toEqual({ ok: true, api: 1 });
  });

  it('lists the widget files in load order', async () => {
    const ids = json(await call('GET', '/api/widgets')) as string[];
    expect(ids).toContain('casket');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists songs: a valid pack, a broken one with its error; a folder without pack.json is ignored', async () => {
    const r = await call('GET', '/api/songs');
    expect(r.status).toBe(200);
    const list = json(r).songs as { id: string; error?: string; title: string; duration: number; notesFrom: string; hasShow: boolean }[];
    expect(list.map((s) => s.id)).toEqual(['broken', 'demo']);
    expect(list[1]).toEqual({ id: 'demo', title: 'Demo song', duration: 30, notesFrom: 'file', hasShow: false });
    expect(list[0].error).toMatch(/version/);
  });

  it('serves a pack and its audio, with byte ranges (a seek in an mp3 needs them)', async () => {
    const p = await call('GET', '/songs/demo/pack.json');
    expect(json(p).id).toBe('demo');
    const a = await call('GET', '/songs/demo/audio.wav', undefined, { headers: { range: 'bytes=2-5' } });
    expect(a.status).toBe(206);
    expect(a.body.toString()).toBe('2345');
    expect(a.headers['content-range']).toBe('bytes 2-5/10');
    expect((await call('GET', '/songs/demo/../demo/pack.json')).status).toBe(400);
    expect((await call('GET', '/songs/demo/notes.gpu.json')).status).toBe(404);
  });

  it('a show: 404, then PUT writes exactly canonicalShow, then GET reads it back', async () => {
    expect((await call('GET', '/api/shows/demo')).status).toBe(404);
    const r = await call('PUT', '/api/shows/demo', JSON.stringify(GOOD));
    expect(r.status).toBe(204);
    expect(readFileSync(join(shows, 'demo.json'), 'utf8')).toBe(canonicalShow(GOOD));
    expect(json(await call('GET', '/api/shows/demo'))).toEqual(JSON.parse(canonicalShow(GOOD)));
    expect(json(await call('GET', '/api/songs')).songs[1].hasShow).toBe(true);
  });

  it('refuses an overlapping show with its errors, an unknown widget, and a show under another id', async () => {
    const bad = { ...GOOD, clips: [{ ...GOOD.clips[0], end: 15 }, GOOD.clips[1]] };
    const r = await call('PUT', '/api/shows/demo', JSON.stringify(bad));
    expect(r.status).toBe(400);
    expect(json(r).errors[0].message).toContain('overlap');
    const w = await call('PUT', '/api/shows/demo', JSON.stringify({ ...GOOD, clips: [{ ...GOOD.clips[0], widget: 'nope' }, GOOD.clips[1]] }));
    expect(w.status).toBe(400);
    expect((await call('PUT', '/api/shows/demo', JSON.stringify({ ...GOOD, id: 'other' }))).status).toBe(400);
    expect((await call('PUT', '/api/shows/demo', '{oops')).status).toBe(400);
  });

  it('ids must be slugs', async () => {
    expect((await call('GET', '/api/shows/..')).status).toBe(400);
    expect((await call('PUT', '/api/shows/..', JSON.stringify(GOOD))).status).toBe(400);
    expect((await call('GET', '/api/shows/Bad_Id')).status).toBe(400);
  });

  it('writes only from this machine', async () => {
    const r = await call('PUT', '/api/shows/demo', JSON.stringify(GOOD), { remote: '192.168.1.5' });
    expect(r.status).toBe(403);
    expect((await call('PUT', '/api/shows/demo', JSON.stringify(GOOD), { remote: '::ffff:127.0.0.1' })).status).toBe(204);
  });

  it('the description round-trips; over 20 KB is refused', async () => {
    expect((await call('GET', '/api/shows/demo/description')).body.toString()).toBe('');
    expect((await call('PUT', '/api/shows/demo/description', 'Dark and slow, then the casket.')).status).toBe(204);
    expect(readFileSync(join(shows, 'demo.description.md'), 'utf8')).toBe('Dark and slow, then the casket.');
    expect((await call('GET', '/api/shows/demo/description')).body.toString()).toBe('Dark and slow, then the casket.');
    expect((await call('PUT', '/api/shows/demo/description', 'x'.repeat(21 * 1024))).status).toBe(413);
  });

  it('adds a song: audio, then a valid pack; an invalid pack is refused', async () => {
    expect((await call('PUT', '/api/songs/new-song?name=take%201.mp3', Buffer.from('abc'))).status).toBe(204);
    expect(readFileSync(join(songs, 'new-song', 'audio.mp3'), 'utf8')).toBe('abc');
    const r = await call('PUT', '/api/songs/new-song/pack', JSON.stringify({ ...PACK, id: 'new-song', audio: 'audio.mp3' }));
    expect(r.status).toBe(204);
    expect(existsSync(join(songs, 'new-song', 'pack.json'))).toBe(true);
    const bad = await call('PUT', '/api/songs/new-song/pack', JSON.stringify({ ...PACK, version: 2 }));
    expect(bad.status).toBe(400);
    expect(json(bad).errors.length).toBeGreaterThan(0);
  });

  it('labels: the rows of notes.ymt3.json; none without the file; the file itself stays unserved', async () => {
    expect(json(await call('GET', '/api/songs/demo/labels'))).toEqual({ notes: [] });
    const rows = [[1, 2, 60, 80, 'Violin'], [1, 2, 48, 70, 'Cello']];
    writeFileSync(join(songs, 'demo', 'notes.ymt3.json'), JSON.stringify({ version: 1, notes: rows }));
    expect(json(await call('GET', '/api/songs/demo/labels'))).toEqual({ notes: rows });
    expect((await call('GET', '/songs/demo/notes.ymt3.json')).status).toBe(404);
    expect((await call('GET', '/api/songs/Bad_Id/labels')).status).toBe(400);
  });

  it('a melody: empty with a 200, PUT writes canonicalMelody beside the shows, GET reads the same bytes', async () => {
    const r = await call('GET', '/api/melodies/demo');
    expect(r.status).toBe(200);
    expect(json(r)).toEqual(emptyMelody('demo'));
    const m = { version: 1, song: 'demo', notes: [[12, 13, 64, 90, 'violin'], [1.23456, 2, 60, 80]] };
    expect((await call('PUT', '/api/melodies/demo', JSON.stringify(m))).status).toBe(204);
    const file = join(tmp, 'melodies', 'demo.json');
    expect(readFileSync(file, 'utf8')).toBe(canonicalMelody(m as Melody));
    expect((await call('GET', '/api/melodies/demo')).body.toString()).toBe(readFileSync(file, 'utf8'));
  });

  it('refuses a melody that is not valid, or under another song; writes only from this machine', async () => {
    const m = { version: 1, song: 'demo', notes: [[1, 2, 60, 80]] };
    const before = existsSync(join(tmp, 'melodies', 'other.json'));
    const bad = await call('PUT', '/api/melodies/demo', JSON.stringify({ ...m, notes: [[2, 1, 60, 80]] }));
    expect(bad.status).toBe(400);
    expect(json(bad).errors[0].path).toBe('notes[0]');
    const other = await call('PUT', '/api/melodies/other', JSON.stringify(m));
    expect(other.status).toBe(400);
    expect(json(other).errors[0].path).toBe('song');
    expect(existsSync(join(tmp, 'melodies', 'other.json'))).toBe(before);
    expect((await call('PUT', '/api/melodies/demo', '{oops')).status).toBe(400);
    expect((await call('PUT', '/api/melodies/..', JSON.stringify(m))).status).toBe(400);
    expect((await call('PUT', '/api/melodies/demo', JSON.stringify(m), { remote: '192.168.1.5' })).status).toBe(403);
  });

  it('a melodies folder of its own when one is given', async () => {
    const own = join(tmp, 'own-melodies'), mw2 = apiMiddleware({ songs, shows, melodies: own });
    const m = { version: 1, song: 'demo', notes: [] };
    await new Promise<void>((done) => {
      const req = Object.assign(new EventEmitter(), { method: 'PUT', url: '/api/melodies/demo', headers: {}, socket: { remoteAddress: '127.0.0.1' } });
      const res = { writeHead() { return this; }, end() { done(); }, write() { return true; }, on() { return this; }, once() { return this; }, emit() { return true; } };
      mw2(req as never, res as never, () => {});
      setTimeout(() => { req.emit('data', Buffer.from(JSON.stringify(m))); req.emit('end'); }, 0);
    });
    expect(existsSync(join(own, 'demo.json'))).toBe(true);
  });

  it('passes everything else on', async () => {
    expect((await call('GET', '/src/studio/ui/main.ts')).next).toBe(true);
    expect((await call('GET', '/api/nothing')).status).toBe(404);
  });
});

describe('the widget list while the server runs', () => {
  it('loads once while nothing changes, and again when a widget is added or edited', () => {
    let stamp = 'a', loads = 0;
    const get = whileUnchanged(() => stamp, () => ++loads);
    expect([get(), get()]).toEqual([1, 1]);
    stamp = 'a|gliss';
    expect([get(), get()]).toEqual([2, 2]);
  });
});
