/** Where the studio's songs and shows live: the dev API (npm run dev, scripts/studio-api.ts) reads and writes them on disk. */
import type { NotesSource, SongPack } from '../pack/pack';
import { canonicalMelody, LEAVING_MAX, type Melody } from '../show/melody';
import { canonicalShow, type Show } from '../show/show';

/** A row of a song's notes.ymt3.json: label is the transcriber's guess at the instrument. */
export type LabelNote = [start: number, end: number, midi: number, vel: number, label: string];

export interface LibraryEntry { id: string; title: string; duration: number; notesFrom: NotesSource; hasShow: boolean; error?: string }

export interface ShowStore {
  songs(): Promise<LibraryEntry[]>;
  pack(id: string): Promise<SongPack>;
  /** /songs/<id>/<audio> */
  audioUrl(p: SongPack): string;
  show(id: string): Promise<Show | null>;
  saveShow(s: Show): Promise<void>;
  description(id: string): Promise<string>;
  saveDescription(id: string, text: string): Promise<void>;
  /** The song's marked melody; an empty one when it has none. */
  melody(song: string): Promise<Melody>;
  /** leaving: the page is going, so the write must outlast it. */
  saveMelody(m: Melody, leaving?: boolean): Promise<void>;
  /** The transcriber's instrument labels, for a song without tracks. */
  labels(song: string): Promise<LabelNote[]>;
  /** The in-browser fallback's result. */
  addSong(p: SongPack, audio: Blob): Promise<void>;
}

/** An answer from the dev API that was not 2xx: its message, and the show's errors when it refused one. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly errors: { path?: string; message: string }[] = []) { super(message); }
}

const base = (): string => new URL('.', location.href).pathname.replace(/\/$/, '');

async function check(r: Response, what: string): Promise<Response> {
  if (r.ok) return r;
  let msg = `${what}: ${r.status} ${r.statusText}`, errors: ApiError['errors'] = [];
  try {
    const j = await r.json() as { error?: string; errors?: (string | { path?: string; message: string })[] };
    if (j.error) msg = `${what}: ${j.error}`;
    if (Array.isArray(j.errors)) {
      errors = j.errors.map((e) => (typeof e === 'string' ? { message: e } : e));
      msg = `${what}: ${errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join('; ')}`;
    }
  } catch { /* not JSON */ }
  throw new ApiError(r.status, msg, errors);
}

function devStore(): ShowStore {
  const b = base();
  return {
    async songs() { return ((await (await check(await fetch(`${b}/api/songs`), 'songs')).json()) as { songs: LibraryEntry[] }).songs; },
    async pack(id) { return (await (await check(await fetch(`${b}/songs/${id}/pack.json`, { cache: 'no-store' }), `song ${id}`)).json()) as SongPack; },
    audioUrl: (p) => `${b}/songs/${p.id}/${p.audio}`,
    async show(id) {
      const r = await fetch(`${b}/api/shows/${id}`, { cache: 'no-store' });
      if (r.status === 404) return null;
      return (await (await check(r, `show ${id}`)).json()) as Show;
    },
    async saveShow(s) {
      await check(await fetch(`${b}/api/shows/${s.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: canonicalShow(s) }), 'save');
    },
    async description(id) { return (await check(await fetch(`${b}/api/shows/${id}/description`, { cache: 'no-store' }), 'description')).text(); },
    async saveDescription(id, text) {
      await check(await fetch(`${b}/api/shows/${id}/description`, { method: 'PUT', headers: { 'content-type': 'text/markdown' }, body: text }), 'save description');
    },
    async melody(song) { return (await (await check(await fetch(`${b}/api/melodies/${song}`, { cache: 'no-store' }), `melody ${song}`)).json()) as Melody; },
    async saveMelody(m, leaving = false) {
      const body = canonicalMelody(m);
      await check(await fetch(`${b}/api/melodies/${m.song}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body, keepalive: leaving && body.length <= LEAVING_MAX }), 'save melody');
    },
    async labels(song) { return ((await (await check(await fetch(`${b}/api/songs/${song}/labels`, { cache: 'no-store' }), `labels ${song}`)).json()) as { notes: LabelNote[] }).notes; },
    async addSong(p, audio) {
      await check(await fetch(`${b}/api/songs/${p.id}?name=${encodeURIComponent(p.audio)}`, { method: 'PUT', body: audio }), 'add song');
      await check(await fetch(`${b}/api/songs/${p.id}/pack`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }), 'add song');
    },
  };
}

/** The dev store when GET /api/health answers; otherwise an error to show the person. */
export async function connectStore(): Promise<ShowStore> {
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`${base()}/api/health`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok && ((await r.json()) as { api?: number }).api === 1) return devStore();
  } catch { /* no dev server */ }
  throw new Error('Run npm run dev: the studio needs its dev server');
}
