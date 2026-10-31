/**
 * The in-browser fallback's Worker: the offline analysis of a decoded recording and the pack built from it, with
 * approximate notes (no transcriber here). Messages out: { type: 'progress', progress } | { type: 'done', pack } |
 * { type: 'error', message }.
 */
import { analyzeSong } from '../../audio/song-analysis';
import { buildPack, type BuildInput } from '../pack/build';
import type { SongPack } from '../pack/pack';

export interface WorkerIn { pcm: Float32Array; sampleRate: number; meta: Pick<BuildInput, 'id' | 'title' | 'audio' | 'source' | 'at'> }
export type WorkerOut = { type: 'progress'; progress: number } | { type: 'done'; pack: SongPack } | { type: 'error'; message: string };

// The DOM lib types `self` as a Window; a Worker's postMessage takes no target origin.
const scope = self as unknown as { postMessage(m: WorkerOut): void; onmessage: ((e: MessageEvent<WorkerIn>) => void) | null };

scope.onmessage = (e) => {
  const { pcm, sampleRate, meta } = e.data;
  try {
    let last = 0;
    const analysis = analyzeSong(pcm, sampleRate, (f) => {
      const now = performance.now();
      if (now - last < 100) return;
      last = now;
      scope.postMessage({ type: 'progress', progress: f });
    });
    scope.postMessage({ type: 'progress', progress: 1 });
    scope.postMessage({ type: 'done', pack: buildPack({ ...meta, analysis, notes: null, by: 'studio' }) });
  } catch (err) {
    scope.postMessage({ type: 'error', message: (err as Error).message || String(err) });
  }
};
