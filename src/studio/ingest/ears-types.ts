// Types shared by the ingest CLI, the ears server and the studio (types only, browser-safe).

/** One `--progress json` line of `npm run ingest`: progress is 0..1 within the stage. */
export interface IngestProgress {
  stage: 'decode' | 'transcribe' | 'analyze' | 'write' | 'done';
  progress: number;
  message: string;
  warnings?: string[];
  id?: string;
}

/** Whether the GPU transcriber can run here (`transcribe.py --probe`). */
export interface TranscriberStatus { ok: boolean; python: string | null; device: 'cuda' | 'cpu' | null; reason?: string }

export interface Job {
  job: string;
  id: string;
  state: 'queued' | 'running' | 'done' | 'failed';
  stage: 'upload' | 'decode' | 'transcribe' | 'analyze' | 'write';
  /** 0..1 overall, never decreases. */
  progress: number;
  message: string;
  warnings: string[];
  error?: string;
}

/** Share of an ingest's time each stage takes (transcribe is 0 without the GPU transcriber). */
export const STAGE_WEIGHTS = { decode: 0.05, transcribe: 0.5, analyze: 0.4, write: 0.05 } as const;
