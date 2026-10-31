// Types shared by the ingest CLI, the ears server and the studio (types only, browser-safe).

/**
 * One `--progress json` line of `npm run ingest`: progress is 0..1 within the stage; overall is 0..1 over the whole
 * ingest, weighted by STAGE_WEIGHTS over the stages this run has, and never decreases.
 */
export interface IngestProgress {
  stage: 'decode' | 'transcribe' | 'instruments' | 'analyze' | 'write' | 'done';
  progress: number;
  message: string;
  overall?: number;
  warnings?: string[];
  id?: string;
}

/** Whether the GPU transcriber can run here (`transcribe.py --probe`). */
export interface TranscriberStatus { ok: boolean; python: string | null; device: 'cuda' | 'cpu' | null; reason?: string }
/** Whether another Python tool can run here (YourMT3+ through ymt3.json, basic-pitch through its venv). */
export interface ToolStatus { ok: boolean; python: string | null; reason?: string }
/** The reason /health gives while the ears server is still probing its transcriber (a pending answer, not a verdict). */
export const CHECKING_TRANSCRIBER = 'checking the transcriber';

/** GET /health of the ears server (api 2: the three tools; api 1 had the transcriber only). */
export interface EarsHealth { ok: true; api: 2; transcriber: TranscriberStatus; ymt3: ToolStatus; bp: ToolStatus }

export interface Job {
  job: string;
  id: string;
  state: 'queued' | 'running' | 'done' | 'failed';
  stage: 'upload' | 'decode' | 'transcribe' | 'instruments' | 'analyze' | 'write';
  /** 0..1 overall, never decreases. */
  progress: number;
  message: string;
  warnings: string[];
  error?: string;
}

/**
 * Share of an ingest's time each stage takes, in the order they run: the piano model (transcribe), YourMT3+ or
 * basic-pitch (instruments). A stage that does not run has no share.
 */
export const STAGE_WEIGHTS = { decode: 0.03, transcribe: 0.3, instruments: 0.3, analyze: 0.32, write: 0.05 } as const;
