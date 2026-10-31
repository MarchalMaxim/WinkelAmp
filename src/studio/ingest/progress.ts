// An ingest's overall progress (0..1) from a `--progress json` line: each stage's share of the time (STAGE_WEIGHTS),
// with no share for transcribing when no transcriber runs.
import { STAGE_WEIGHTS, type IngestProgress } from './ears-types';

const ORDER = ['decode', 'transcribe', 'analyze', 'write'] as const;

export function overallProgress(stage: IngestProgress['stage'], f: number, gpu: boolean): number {
  if (stage === 'done') return 1;
  const w = { ...STAGE_WEIGHTS, transcribe: gpu ? STAGE_WEIGHTS.transcribe : 0 };
  const total = ORDER.reduce((s, k) => s + w[k], 0);
  const frac = Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0;
  let before = 0;
  for (const k of ORDER) {
    if (k === stage) break;
    before += w[k];
  }
  return Math.min(1, (before + w[stage] * frac) / total);
}
