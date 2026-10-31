/**
 * The studio's side of the ears server (scripts/ears/server.ts, `npm run ears`): is it there, and send it a recording
 * and follow the job. 127.0.0.1, not localhost: on Windows localhost can resolve to ::1 first, and ears binds IPv4.
 * `?ears=off` makes the studio act as if it were down, `?ears=<port>` looks for it on another port (checks).
 */
import type { Job, TranscriberStatus } from './ears-types';

export const EARS_PORT = 5175;
/** The upload's share of the progress the studio shows (the server's job is the rest). */
const UPLOAD_SHARE = 0.03;
const POLL_MS = 400;

/** Where the ears server is, or null when the page says to leave it alone. */
export function earsUrl(search = typeof location === 'undefined' ? '' : location.search): string | null {
  const q = new URLSearchParams(search).get('ears');
  if (q === 'off') return null;
  return `http://127.0.0.1:${q && /^\d{1,5}$/.test(q) ? q : EARS_PORT}`;
}

/** The transcriber's status when the ears server answers within `timeoutMs`, else null (not running). */
export async function probeEars(timeoutMs = 800): Promise<TranscriberStatus | null> {
  const base = earsUrl();
  if (!base) return null;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/health`, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) return null;
    const j = (await r.json()) as { api?: number; transcriber?: TranscriberStatus };
    return j.api === 1 && j.transcriber ? j.transcriber : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

const job = (p: Partial<Job>): Job => ({ job: '', id: '', state: 'queued', stage: 'upload', progress: 0, message: '', warnings: [], ...p });

/** POSTs with upload progress (fetch has none). */
function upload(url: string, body: Blob | null, onProgress: (f: number) => void): Promise<{ status: number; body: unknown }> {
  return new Promise((ok, fail) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.upload.onprogress = (e) => { if (e.lengthComputable && e.total) onProgress(e.loaded / e.total); };
    x.onload = () => {
      let parsed: unknown = null;
      try { parsed = JSON.parse(x.responseText); } catch { /* not JSON */ }
      ok({ status: x.status, body: parsed });
    };
    x.onerror = () => fail(new Error('the ears server did not answer (is npm run ears still running?)'));
    x.send(body);
  });
}

/** Follows a job until it ends: resolves with its song id when done, rejects with its error when it fails. */
async function follow(base: string, id: string, jobId: string, onJob: (j: Job) => void): Promise<string> {
  let misses = 0, last = UPLOAD_SHARE;
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    let j: Job;
    try {
      const r = await fetch(`${base}/jobs/${jobId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`job ${jobId}: ${r.status}`);
      j = (await r.json()) as Job;
      misses = 0;
    } catch (e) {
      if (++misses >= 5) throw new Error(`the ears server stopped answering (${(e as Error).message})`);
      continue;
    }
    last = Math.max(last, UPLOAD_SHARE + (1 - UPLOAD_SHARE) * j.progress);
    onJob({ ...j, progress: j.state === 'done' ? 1 : last });
    if (j.state === 'done') return j.id || id;
    if (j.state === 'failed') throw new Error(j.error || j.message || 'the ingest failed');
  }
}

async function start(query: string, body: Blob | null, onJob: (j: Job) => void): Promise<string> {
  const base = earsUrl();
  if (!base) throw new Error('the ears server is turned off on this page (?ears=off)');
  onJob(job({ message: body ? 'sending the recording' : 'asking for a new transcription' }));
  const r = await upload(`${base}/ingest?${query}`, body, (f) => onJob(job({ message: `sending the recording (${Math.round(f * 100)} %)`, progress: UPLOAD_SHARE * f })));
  const b = (r.body ?? {}) as { job?: string | null; id?: string; existing?: boolean; error?: string };
  if (r.status === 200 && b.existing && b.id) {
    onJob(job({ id: b.id, state: 'done', stage: 'write', progress: 1, message: 'already in the library' }));
    return b.id;
  }
  if (r.status !== 202 || !b.job || !b.id) throw new Error(b.error ?? `the ears server answered ${r.status}`);
  onJob(job({ job: b.job, id: b.id, progress: UPLOAD_SHARE, message: 'queued' }));
  return follow(base, b.id, b.job, onJob);
}

/** Sends a recording to the ears server and follows its job; resolves with the song's id. */
export function ingestViaEars(file: File, onJob: (j: Job) => void): Promise<string> {
  return start(`name=${encodeURIComponent(file.name)}`, file, onJob);
}

/** Ingests a song's own recording again (e.g. transcribed notes for an approximate pack); resolves with its id. */
export function reingestViaEars(id: string, onJob: (j: Job) => void): Promise<string> {
  return start(`id=${encodeURIComponent(id)}&redo=1`, null, onJob);
}
