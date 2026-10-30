/**
 * Renders the dark & blunt reference recordings with the shared piano synth.
 *
 *   npx tsx scripts/reference/render.ts <outDir>
 *
 * Writes rach_prelude.wav (Op. 3 No. 2) and rach_concerto2.wav (Op. 18 opening),
 * lightly mastered (make-up gain + peak limiter) to the level of a commercial
 * piano recording. Generated audio is for evaluation only; keep it out of git.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { master, render } from './piano';
import { writeWav } from './wav';
import { rachConcerto2, rachPrelude } from './scores';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
for (const [name, score] of [['rach_prelude', rachPrelude()], ['rach_concerto2', rachConcerto2()]] as const) {
  const t0 = performance.now();
  // The bass strings of a concert grand: a touch more inharmonic, which is where the bell-like toll comes from.
  score.humanize(name.length);
  const r = render(score, 44100, 2.5, { inharmonicity: 1.3 });
  const m = master(r.L, r.R, r.sr, -21, -1);
  const info = writeWav(path.join(out, `${name}.wav`), r.L, r.R, r.sr, -1);
  console.log(
    `${name}: ${score.notes.length} notes, ${info.seconds.toFixed(1)} s, rms ${info.rmsDb.toFixed(1)} dBFS, peak -1 dBFS ` +
      `(make-up ${m.makeupDb.toFixed(1)} dB, limiter ≤ ${m.maxReductionDb.toFixed(1)} dB), ${((performance.now() - t0) / 1000).toFixed(1)} s to render`,
  );
}
