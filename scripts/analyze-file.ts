/**
 * Runs the live analysis chain over an audio file and summarises its descriptors.
 *
 *   npx tsx scripts/analyze-file.ts <audio file> [--json out.json] [--rate 44100] [--quiet]
 *
 * Decodes with ffmpeg (mono). Prints mean / P10 / P50 / P90 of every descriptor
 * and a coarse timeline; --json writes a per-second timeline (descriptor values
 * averaged over each second) for calibration and evaluation scripts.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeOffline } from '../src/audio/offline';
import type { Descriptors } from '../src/character/types';

export function decode(file: string, rate = 44100): Float32Array {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString() ?? r.error}`);
  const buf = r.stdout as Buffer;
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const KEYS: (keyof Descriptors)[] = [
  'loudness', 'dynamics', 'register', 'registerSpread', 'brightness', 'noisiness', 'roughness', 'onsetRate',
  'irregularity', 'attack', 'sustain', 'tempo', 'pulseClarity', 'majorness', 'keyClarity', 'harmonicChange',
  'pitchMotion', 'silence',
];

const pct = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1)))] ?? 0;

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!file) {
    console.error('usage: npx tsx scripts/analyze-file.ts <audio file> [--json out.json] [--rate 44100] [--quiet]');
    process.exit(1);
  }
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const rate = Number(opt('--rate') ?? 44100);
  const quiet = args.includes('--quiet');
  const pcm = decode(file, rate);
  const t0 = performance.now();
  const res = analyzeOffline(pcm, rate);
  const ms = performance.now() - t0;
  const n = res.descriptors.length;
  // Skip the first 3 s in the summary: the long windows are still filling.
  const skip = Math.min(n - 1, Math.round(3 * res.fps));
  const audible = res.descriptors.slice(skip).filter((d) => d.silence < 0.5);
  const summary: Record<string, { mean: number; p10: number; p50: number; p90: number }> = {};
  for (const k of KEYS) {
    const vals = (audible.length ? audible : res.descriptors).map((d) => d[k]).sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    summary[k] = { mean, p10: pct(vals, 0.1), p50: pct(vals, 0.5), p90: pct(vals, 0.9) };
  }
  // Per-second timeline.
  const seconds = Math.ceil(res.duration);
  const timeline: Record<string, number>[] = [];
  const onsetsPerSecond: number[] = [];
  for (let s = 0; s < seconds; s++) {
    const a = Math.round(s * res.fps), b = Math.min(n, Math.round((s + 1) * res.fps));
    if (b <= a) break;
    const row: Record<string, number> = { t: s };
    for (const k of KEYS) {
      let sum = 0;
      for (let i = a; i < b; i++) sum += res.descriptors[i][k];
      row[k] = Math.round((sum / (b - a)) * 1000) / 1000;
    }
    let on = 0;
    for (let i = a; i < b; i++) on += res.onsets[i];
    onsetsPerSecond.push(on);
    timeline.push(row);
  }

  const name = basename(file);
  console.log(`${name}: ${res.duration.toFixed(1)} s @ ${rate} Hz, ${n} hops analysed in ${(ms / 1000).toFixed(1)} s (${((ms / n) * 1000).toFixed(0)} µs/hop)`);
  console.log('descriptor        mean   p10   p50   p90');
  for (const k of KEYS) {
    const s = summary[k];
    console.log(`${k.padEnd(16)} ${[s.mean, s.p10, s.p50, s.p90].map((v) => v.toFixed(2).padStart(5)).join(' ')}`);
  }
  if (!quiet) {
    const step = Math.max(1, Math.round(seconds / 12));
    const cols: (keyof Descriptors)[] = ['loudness', 'register', 'attack', 'sustain', 'onsetRate', 'irregularity', 'pulseClarity', 'majorness', 'roughness'];
    console.log(`\ntimeline   ${cols.map((c) => c.slice(0, 6).padStart(6)).join(' ')}`);
    for (let s = 0; s < timeline.length; s += step) {
      console.log(`${String(s).padStart(4)} s    ${cols.map((c) => timeline[s][c].toFixed(2).padStart(6)).join(' ')}`);
    }
  }
  const out = opt('--json');
  if (out) {
    writeFileSync(out, JSON.stringify({ file: name, sampleRate: rate, duration: res.duration, fps: res.fps, summary, onsetsPerSecond, timeline }, null, 1));
    console.log(`wrote ${out}`);
  }
}

// Run only when executed directly (other scripts import decode()).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
