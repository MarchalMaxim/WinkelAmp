// An ingest's overall progress (0..1) from a `--progress json` line: each stage's share of the time (STAGE_WEIGHTS),
// with no share for a transcribing stage that does not run. Lines that carry `overall` (ingest v2) need none of this.
import { STAGE_WEIGHTS, type IngestProgress } from './ears-types';

/** The stages in the order an ingest runs them. */
export const STAGE_ORDER = ['decode', 'transcribe', 'instruments', 'analyze', 'write'] as const;
export type Stage = (typeof STAGE_ORDER)[number];

/** A real MuScriptor run takes minutes where the rest takes seconds: nearly all of its time is the instruments stage. */
export const LONG_STAGE_WEIGHTS = { decode: 0.01, transcribe: 0.05, instruments: 0.85, analyze: 0.07, write: 0.02 } as const;
/** On such a run, YourMT3+'s part of the instruments stage: the first 15 %, MuScriptor the rest. */
export const MS_YMT3_SHARE = 0.15;

/**
 * The weights of one run: `ran` says whether the piano model (transcribe) and the instrument models ran, and `long`
 * whether MuScriptor really runs (not a cache or an import).
 */
export function stageWeights(ran: { transcribe: boolean; instruments: boolean; long?: boolean }): Record<Stage, number> {
  const w = ran.long ? LONG_STAGE_WEIGHTS : STAGE_WEIGHTS;
  return { ...w, transcribe: ran.transcribe ? w.transcribe : 0, instruments: ran.instruments ? w.instruments : 0 };
}

/** `about 12 min left`, from what `done` of `total` chunks took so far. */
export function etaWords(done: number, total: number, elapsedS: number): string {
  if (!(done > 0)) return 'working out the time left';
  const left = (elapsedS * Math.max(0, total - done)) / done;
  return left < 60 ? 'under a minute left' : `about ${Math.round(left / 60)} min left`;
}

export function overallProgress(stage: IngestProgress['stage'], f: number, gpu: boolean, instruments = false): number {
  if (stage === 'done') return 1;
  const w = stageWeights({ transcribe: gpu, instruments });
  return overallOf(w, stage, f);
}

/** The overall fraction at `f` (0..1, clamped) of `stage`, under weights `w`. */
export function overallOf(w: Record<Stage, number>, stage: Stage, f: number): number {
  const total = STAGE_ORDER.reduce((s, k) => s + w[k], 0);
  const frac = Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0;
  let before = 0;
  for (const k of STAGE_ORDER) {
    if (k === stage) break;
    before += w[k];
  }
  return total > 0 ? Math.min(1, (before + w[stage] * frac) / total) : 0;
}
