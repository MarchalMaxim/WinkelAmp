/**
 * Melody tracking against ground truth we know exactly: the four character
 * studies (their scores, at the seed each player renders) and the Rachmaninoff
 * reference (its transcribed, humanized note list).
 *
 *   npx tsx scripts/eval/melody-eval.ts [--studies dir] [--ref dir] [--only ember,rach_prelude] [--trace 10,20]
 *
 * Reads <studies>/<id>.wav (rendered by scripts/render-studies.mjs --seconds 0,
 * which this runs if they are missing) and <ref>/rach_prelude.wav + .notes.json
 * (scripts/reference/render.ts, likewise). Prints, live and offline: raw pitch
 * and raw chroma accuracy (±50 cents, over truth-voiced frames), voicing recall /
 * false alarm, and note onset F1 (±50 ms). Pitch and chroma come twice: gated by
 * the tracker's own voicing (an unvoiced frame is a miss), and — offline, as in
 * MIREX — on extractMelody's `path` (its pitch guess on every frame), so pitch
 * and voicing are scored independently. --trace from,to (seconds)
 * also prints truth, offline, live and the strongest salience peaks every 50 ms
 * in that span. Audio stays out of git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { melodyLine, onsetF1, referenceContour, scoreContour, type ContourScore, type RefEvent, type RefNote } from './melody-metrics';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** ScorePlayer.start() schedules the first event at currentTime + 0.1. */
const START_OFFSET = 0.1;

interface Piece {
  name: string;
  wav: string;
  truth: RefNote[];
}

async function studyPieces(dir: string, only: string[]): Promise<Piece[]> {
  const { STUDIES } = await import('../../src/audio/studies');
  const ids = STUDIES.map((s) => s.id).filter((id) => !only.length || only.includes(id));
  if (ids.some((id) => !existsSync(path.join(dir, `${id}.wav`)))) {
    console.log(`rendering studies into ${dir} …`);
    execFileSync('node', [path.join(REPO, 'scripts/render-studies.mjs'), dir, '--seconds', '0', '--only', ids.join(',')], { stdio: 'inherit' });
  }
  return ids.map((id) => {
    const study = STUDIES.find((s) => s.id === id)!;
    const seed = study.seed; // what the player renders its first pass with
    // The render may run past the first pass: the player then plays compose(seed + 101).
    const a = study.compose(seed);
    const b = study.compose(seed + 101);
    const events: RefEvent[] = [
      ...a.events.map((e) => ({ ...e, t: e.t + START_OFFSET })),
      ...b.events.map((e) => ({ ...e, t: e.t + START_OFFSET + a.length })),
    ];
    return { name: id, wav: path.join(dir, `${id}.wav`), truth: melodyLine(events, study.melodyVoices, study.melodyCluster) };
  });
}

function referencePieces(dir: string, only: string[]): Piece[] {
  const names = ['rach_prelude'].filter((n) => !only.length || only.includes(n));
  if (names.some((n) => !existsSync(path.join(dir, `${n}.wav`)) || !existsSync(path.join(dir, `${n}.notes.json`)))) {
    console.log(`rendering the reference into ${dir} …`);
    execFileSync('npx', ['tsx', path.join(REPO, 'scripts/reference/render.ts'), dir], { stdio: 'inherit', shell: true });
  }
  return names.map((n) => {
    const notes = JSON.parse(readFileSync(path.join(dir, `${n}.notes.json`), 'utf8')) as { t: number; midi: number; hold: number; group?: number }[];
    const events = notes.map((x) => ({ t: x.t, m: x.midi, d: x.hold, group: x.group }));
    return { name: n, wav: path.join(dir, `${n}.wav`), truth: melodyLine(events) };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string, def: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
  };
  const base = path.join(tmpdir(), 'winkelamp-eval');
  const only = opt('--only', '').split(',').filter(Boolean);
  const { decode } = await import('../analyze-file');
  const { analyzeOffline } = await import('../../src/audio/offline');
  const { extractMelody, binMidi } = await import('../../src/audio/melody');
  const trace = opt('--trace', '').split(',').filter(Boolean).map(Number);
  const pieces = [
    ...(await studyPieces(path.resolve(opt('--studies', path.join(base, 'studies'))), only)),
    ...referencePieces(path.resolve(opt('--ref', path.join(base, 'ref'))), only),
  ];
  const sr = 44100;
  const f = (x: number) => x.toFixed(2).padStart(5);
  console.log(`${'piece'.padEnd(13)} ${'mode'.padEnd(7)} pitch chroma | pitch* chroma* | recall  f.a. | onsetF1 (P/R)     notes truth`);
  console.log(`${''.padEnd(22)}(voicing-gated)   (MIREX, ungated)`);
  let sumChroma = 0, sumChromaRaw = 0;
  for (const p of pieces) {
    const pcm = decode(p.wav, sr);
    const t0 = performance.now();
    const r = analyzeOffline(pcm, sr, { melody: true });
    const m = r.melody!;
    const off = extractMelody(m.salience, r.fps);
    const ms = performance.now() - t0;
    const truthOn = p.truth.map((n) => n.start);
    const offScore = scoreContour(referenceContour(p.truth, r.times), off.contour);
    const offRaw = scoreContour(referenceContour(p.truth, r.times), off.path);
    const offOn = onsetF1(truthOn, off.notes.map((n) => n.start));
    const live = new Float32Array(m.frames.map((x) => (x.voiced ? x.pitch : NaN)));
    const liveScore = scoreContour(referenceContour(p.truth, r.times.map((t) => t - m.latency)), live);
    const liveStarts = m.frames.filter((x) => x.noteOn && x.note).map((x) => x.note!.start);
    const liveOn = onsetF1(truthOn, liveStarts);
    const row = (mode: string, s: ContourScore, raw: ContourScore | null, o: ReturnType<typeof onsetF1>, n: number) =>
      console.log(
        `${p.name.padEnd(13)} ${mode.padEnd(7)} ${f(s.rawPitch)}  ${f(s.rawChroma)} | ` +
          (raw ? `${f(raw.rawPitch)}   ${f(raw.rawChroma)}` : '    -       - ') +
          ` | ${f(s.voicingRecall)} ${f(s.voicingFalseAlarm)} |  ${f(o.f1)} (${o.precision.toFixed(2)}/${o.recall.toFixed(2)}) ${String(n).padStart(5)} ${String(p.truth.length).padStart(5)}`,
      );
    row('live', liveScore, null, liveOn, liveStarts.length);
    row('offline', offScore, offRaw, offOn, off.notes.length);
    console.log(`${''.padEnd(13)} ${(r.duration).toFixed(1)} s, truth voiced ${(100 * offScore.voicedShare).toFixed(0)} %, analysis ${(ms / 1000).toFixed(1)} s`);
    sumChroma += offScore.rawChroma;
    sumChromaRaw += offRaw.rawChroma;
    if (trace.length === 2) {
      const truthC = referenceContour(p.truth, r.times);
      // Where the offline errors go: estimate − truth, in semitones, over truth-voiced frames.
      const hist = new Map<number, number>();
      for (let k = 0; k < truthC.length; k++) {
        if (!Number.isFinite(truthC[k])) continue;
        const d = Number.isFinite(off.contour[k]) ? Math.round(off.contour[k] - truthC[k]) : NaN;
        hist.set(d, (hist.get(d) ?? 0) + 1);
      }
      const tot = [...hist.values()].reduce((a, b) => a + b, 0);
      console.log('  offline error (semitones: share) ' + [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([d, n]) => `${d}: ${((100 * n) / tot).toFixed(0)}%`).join(', '));
      const nm = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '  -  ').padStart(5);
      for (let k = 0; k < r.times.length; k += 3) {
        const t = r.times[k];
        if (t < trace[0] || t > trace[1]) continue;
        const s = m.salience[k];
        const peaks: [number, number][] = [];
        for (let b = 1; b < s.length - 1; b++) if (s[b] > s[b - 1] && s[b] >= s[b + 1]) peaks.push([binMidi(b), s[b]]);
        peaks.sort((a, b) => b[1] - a[1]);
        const fr = m.frames[k];
        console.log(
          `  ${t.toFixed(2).padStart(6)} truth ${nm(truthC[k])} off ${nm(off.contour[k])} live ${nm(fr.voiced ? fr.pitch : NaN)}  | ` +
            peaks.slice(0, 5).map(([b, v]) => `${b.toFixed(1)}:${v.toFixed(3)}`).join(' '),
        );
      }
    }
  }
  const n = Math.max(1, pieces.length);
  const avg = sumChromaRaw / n;
  console.log(
    `offline raw chroma accuracy, mean of ${pieces.length}: ${avg.toFixed(3)} MIREX (target ≥ 0.70: ${avg >= 0.7 ? 'met' : 'NOT met'}), ` +
      `${(sumChroma / n).toFixed(3)} voicing-gated`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
