// An ingest's overall progress (0..1) from a `--progress json` line: each stage's share of the time (STAGE_WEIGHTS),
// with no share for a transcribing stage that does not run. Lines that carry `overall` (ingest v2) need none of this.
import { STAGE_WEIGHTS, type IngestProgress } from './ears-types';

/** The stages in the order an ingest runs them. */
export const STAGE_ORDER = ['decode', 'transcribe', 'instruments', 'analyze', 'write'] as const;
export type Stage = (typeof STAGE_ORDER)[number];

/** The weights of one run: `ran` says whether the piano model (transcribe) and the instrument models ran. */
export function stageWeights(ran: { transcribe: boolean; instruments: boolean }): Record<Stage, number> {
  return { ...STAGE_WEIGHTS, transcribe: ran.transcribe ? STAGE_WEIGHTS.transcribe : 0, instruments: ran.instruments ? STAGE_WEIGHTS.instruments : 0 };
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
