/**
 * The in-browser fallback (no ears server): the browser decodes the recording, a Worker runs the same offline analysis
 * as `npm run ingest` and builds the pack with approximate notes (the analysis's onsets and melody line, not a
 * transcription), and the studio's store keeps it. Approximate: the pack says so (notesFrom 'approx' and a warning).
 */
import type { ShowStore } from '../ui/api';
import { isSlug, type SongPack } from '../pack/pack';
import type { WorkerIn, WorkerOut } from './analyze.worker';
import { nameFromFile } from './names';

/** Mono PCM at `rate` (OfflineAudioContext resamples; channels averaged). Main thread: Workers have no AudioContext. */
export async function decodeToMono(file: Blob, rate = 44100): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, rate);
  let buf: AudioBuffer;
  try { buf = await ctx.decodeAudioData(await file.arrayBuffer()); } catch (e) {
    throw new Error(`this browser cannot decode the file (${(e as Error).message || 'unknown format'})`);
  }
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const out = new Float32Array(buf.length), k = 1 / buf.numberOfChannels;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] * k;
  }
  return out;
}

async function sha1(file: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('this page cannot hash files (open the studio on localhost or https)');
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', await file.arrayBuffer()));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

const EXT_BY_TYPE: Record<string, string> = { 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg',
  'audio/flac': '.flac', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/webm': '.webm', 'video/mp4': '.mp4', 'video/webm': '.webm' };

/** 'audio' + the file's extension (its type's when the name has none). */
function audioName(file: File): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(file.name);
  return 'audio' + (m ? `.${m[1].toLowerCase()}` : EXT_BY_TYPE[file.type] ?? '.bin');
}

/** The pack's id: the file's name, or the next free one; a library song of the same recording is returned as it is. */
async function placeFor(file: File, digest: string, store: ShowStore): Promise<{ id: string; existing: SongPack | null }> {
  const named = nameFromFile(file.name), base = isSlug(named.id) ? named.id : 'song';
  const ids = new Set((await store.songs()).map((s) => s.id));
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!ids.has(id)) return { id, existing: null };
    try {
      const p = await store.pack(id);
      if (p.source?.sha1 === digest) return { id, existing: p };
    } catch { /* unreadable: taken all the same */ }
  }
}

function analyzeInWorker(msg: WorkerIn, onProgress: (f: number) => void): Promise<SongPack> {
  return new Promise((ok, fail) => {
    const w = new Worker(new URL('./analyze.worker.ts', import.meta.url), { type: 'module' });
    const end = () => w.terminate();
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.progress);
      else if (m.type === 'done') { end(); ok(m.pack); }
      else { end(); fail(new Error(m.message)); }
    };
    w.onerror = (e) => { end(); fail(new Error(`the analysis stopped: ${e.message || 'the worker failed to start'}`)); };
    w.postMessage(msg, [msg.pcm.buffer]);
  });
}

/**
 * A dropped recording → a song pack with approximate notes, analysed in a Worker (the page stays responsive) and kept
 * by `store` (on disk through the dev API). Progress 0..1.
 */
export async function ingestInBrowser(file: File, store: ShowStore, onProgress: (f: number) => void): Promise<SongPack> {
  onProgress(0);
  const digest = await sha1(file);
  const { id, existing } = await placeFor(file, digest, store);
  if (existing) { onProgress(1); return existing; }
  onProgress(0.02);
  const pcm = await decodeToMono(file, 44100);
  if (pcm.length < 4410) throw new Error('there is no audio in this file');
  onProgress(0.08);
  const named = nameFromFile(file.name);
  const pack = await analyzeInWorker({
    pcm, sampleRate: 44100,
    meta: { id, title: named.title || id, audio: audioName(file), source: { name: file.name, bytes: file.size, sha1: digest }, at: new Date().toISOString() },
  }, (f) => onProgress(0.08 + 0.87 * f));
  onProgress(0.96);
  await store.addSong(pack, file);
  onProgress(1);
  return pack;
}
