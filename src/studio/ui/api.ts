/**
 * Where the studio's songs and shows live (plan §7): the dev API (npm run dev, scripts/studio-api.ts) reads and writes
 * them on disk; without it (the static build) the studio has only the songs added in this browser (kept in IndexedDB),
 * and Save downloads the show and keeps a draft in this browser.
 */
import type { NotesSource, SongPack } from '../pack/pack';
import { canonicalMelody, emptyMelody, LEAVING_MAX, type Melody } from '../show/melody';
import { canonicalShow, type Show } from '../show/show';

/** A row of a song's notes.ymt3.json: label is the transcriber's guess at the instrument. */
export type LabelNote = [start: number, end: number, midi: number, vel: number, label: string];

export interface LibraryEntry { id: string; title: string; duration: number; notesFrom: NotesSource; hasShow: boolean; error?: string }

export interface ShowStore {
  /** false without the dev API (static build): Save downloads <id>.json, drafts in localStorage 'wa-studio.draft.<id>'. */
  readonly writable: boolean;
  songs(): Promise<LibraryEntry[]>;
  pack(id: string): Promise<SongPack>;
  /** /songs/<id>/<audio> */
  audioUrl(p: SongPack): string;
  show(id: string): Promise<Show | null>;
  saveShow(s: Show): Promise<void>;
  description(id: string): Promise<string>;
  saveDescription(id: string, text: string): Promise<void>;
  /** The song's marked melody; an empty one when it has none. Static: localStorage 'wa-studio.melody.<id>'. */
  melody(song: string): Promise<Melody>;
  /** leaving: the page is going, so the write must outlast it. */
  saveMelody(m: Melody, leaving?: boolean): Promise<void>;
  /** The transcriber's instrument labels, for a song without tracks. Static: none. */
  labels(song: string): Promise<LabelNote[]>;
  /** The in-browser fallback's result (static: this browser's IndexedDB, else memory for this page). */
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
    writable: true,
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

const draftKey = (id: string) => `wa-studio.draft.${id}`;
const descKey = (id: string) => `wa-studio.description.${id}`;
const melodyKey = (id: string) => `wa-studio.melody.${id}`;
function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private window */ } }

/** Hands the browser a file to save. */
export function download(name: string, text: string | Blob, type = 'application/json'): void {
  const blob = typeof text === 'string' ? new Blob([text], { type }) : text;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** IndexedDB 'wa-studio', store 'songs' ({ pack, audio } by pack id); null where the browser refuses it. */
function songDb(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open('wa-studio', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('songs'); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch { ok(null); }
  });
}
function idb<T>(db: IDBDatabase, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((ok, fail) => {
    const r = op(db.transaction('songs', mode).objectStore('songs'));
    r.onsuccess = () => ok(r.result as T);
    r.onerror = () => fail(r.error ?? new Error('IndexedDB failed'));
  });
}

/**
 * Without the dev API: songs added in the studio (the in-browser fallback) live in this browser's IndexedDB, so opening
 * one (a fresh page, see §2) finds it; where IndexedDB is refused they live in memory for this page only.
 */
export function staticStore(): ShowStore {
  const songs = new Map<string, { pack: SongPack; url: string }>();
  const db = songDb();
  const remember = (pack: SongPack, audio: Blob) => {
    const old = songs.get(pack.id);
    if (old) URL.revokeObjectURL(old.url);
    songs.set(pack.id, { pack, url: URL.createObjectURL(audio) });
    return pack;
  };
  const stored = async (): Promise<SongPack[]> => {
    const d = await db;
    if (!d) return [];
    try { return (await idb<{ pack: SongPack }[]>(d, 'readonly', (s) => s.getAll())).map((x) => x.pack); } catch { return []; }
  };
  return {
    writable: false,
    async songs() {
      const all = new Map<string, SongPack>();
      for (const p of await stored()) all.set(p.id, p);
      for (const { pack } of songs.values()) all.set(pack.id, pack);
      return [...all.values()].sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => ({ id: p.id, title: p.title, duration: p.duration, notesFrom: p.notesFrom, hasShow: lsGet(draftKey(p.id)) != null }));
    },
    async pack(id) {
      const s = songs.get(id);
      if (s) return s.pack;
      const d = await db;
      const x = d ? await idb<{ pack: SongPack; audio: Blob } | undefined>(d, 'readonly', (st) => st.get(id)).catch(() => undefined) : undefined;
      if (!x) throw new ApiError(404, `no song ${id} in this browser`);
      return remember(x.pack, x.audio);
    },
    audioUrl: (p) => songs.get(p.id)?.url ?? '',
    async show(id) { const d = lsGet(draftKey(id)); return d ? (JSON.parse(d) as Show) : null; },
    async saveShow(s) { const text = canonicalShow(s); lsSet(draftKey(s.id), text); download(`${s.id}.json`, text); },
    async description(id) { return lsGet(descKey(id)) ?? ''; },
    async saveDescription(id, text) { lsSet(descKey(id), text); },
    async melody(song) { const m = lsGet(melodyKey(song)); return m ? (JSON.parse(m) as Melody) : emptyMelody(song); },
    async saveMelody(m) {
      try { localStorage.setItem(melodyKey(m.song), canonicalMelody(m)); } catch (e) { throw new Error(`the browser would not keep it (${(e as Error).message})`); }
    },
    async labels() { return []; },
    async addSong(p, audio) {
      remember(p, audio);
      const d = await db;
      if (d) await idb(d, 'readwrite', (s) => s.put({ pack: p, audio }, p.id)).catch(() => { /* full or refused: this page only */ });
    },
  };
}

/** GET /api/health answers → the dev store, else the static store. */
export async function connectStore(): Promise<ShowStore> {
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`${base()}/api/health`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok && ((await r.json()) as { api?: number }).api === 1) return devStore();
  } catch { /* no dev server */ }
  return staticStore();
}
