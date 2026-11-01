// Types shared by the ingest CLI, the ears server and the studio (types only, browser-safe).
import type { MsPreset } from '../pack/muscriptor';

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

/**
 * GET /health of the ears server (api 2: the three tools; api 1 had the transcriber only). `muscriptor` is optional and
 * api stays 2, because probeEars accepts only 1 or 2 and a bump would break a studio from another worktree.
 */
export interface EarsHealth { ok: true; api: 2; transcriber: TranscriberStatus; ymt3: ToolStatus; bp: ToolStatus; muscriptor?: ToolStatus }

/** GET /songs/<id>/transcriptions: what a redo of this song can be. */
export interface TranscribeChoices {
  /** The song's length, s. */
  duration: number;
  /** Which transcriber made the current tracks; null when the song has none. */
  tracksFrom: 'ymt3' | 'muscriptor' | null;
  /** The list MuScriptor was given for the current tracks. */
  instruments: string[] | null;
  ymt3: ToolStatus;
  muscriptor: ToolStatus;
  /** notes.ymt3.json holds this recording. */
  ymt3Saved: boolean;
  /** MuScriptor's caches an ingest would read: notes.muscriptor-<8 hex>.json of this recording. */
  saved: { key: string; instruments: string[]; notes: number; seconds: number }[];
  /** notes.muscriptor-large.json, which can be imported instead of running the model. */
  overnight: { lanes: string[]; notes: number; preset: MsPreset } | null;
  /** A job for this song is queued or running: a Start follows it instead of starting another. */
  running: boolean;
}

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
