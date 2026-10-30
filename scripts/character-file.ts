/**
 * Runs the CharacterEngine over a recording and prints how its character reads
 * over time: archetype blend, words, key axes.
 *
 *   npx tsx scripts/character-file.ts <audio file | descriptor timeline .json> [--every 4] [--summary]
 *
 * Audio files are decoded with ffmpeg (mono, 44.1 kHz) and run through the very
 * chain the app runs live (AnalysisChain, 60 Hz hops), hop by hop, and the
 * engine is fed the chain's live Features — spectrum included, so event heights
 * are measured as live (offline snapshots drop the spectrum).
 * A .json timeline is any file holding an array of Descriptors objects
 * (top-level, or under `descriptors` / `frames` / `timeline`); the row rate
 * comes from per-row `t` stamps, else `fps` / `hop` / `times`, else one row per
 * second. Rows are held and the engine stepped at 30 fps, so its smoothing
 * behaves as live. JSON timelines carry no frame features, so a neutral Features
 * stands in (this only affects the gesture reservoir and events, not the character).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { CharacterEngine } from '../src/character/character';
import { neutralDescriptors, type Character, type Descriptors } from '../src/character/types';
import { emptyFeatures, type Features } from '../src/audio/features';

/** One engine step: descriptors, features, dt. */
type Frame = { d: Descriptors; f: Features; dt: number };

function decode(file: string): Float32Array {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], {
    maxBuffer: 1 << 30,
  });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

async function fromAudio(file: string): Promise<{ duration: number; frames: Iterable<Frame> }> {
  const { AnalysisChain } = await import('../src/audio/offline');
  const { ArrayPcm } = await import('../src/audio/pcm');
  const sr = 44100;
  const pcm = decode(file);
  const chain = new AnalysisChain();
  const src = new ArrayPcm(pcm, sr);
  const reader = {
    sampleRate: sr,
    get written() {
      return src.written;
    },
    latest: (out: Float32Array) => src.latest(out),
    copyEndingAt: (end: number, out: Float32Array) => {
      src.written = end;
      src.latest(out);
    },
  };
  const hops = Math.floor((pcm.length * chain.fps) / sr);
  function* frames(): Iterable<Frame> {
    for (let h = 0; h < hops; h++) {
      src.written = Math.round(((h + 1) * sr) / chain.fps);
      chain.runHop(reader, src.written);
      yield { d: chain.descriptors, f: chain.features, dt: 1 / chain.fps };
    }
  }
  return { duration: hops / chain.fps, frames: frames() };
}

function fromJson(file: string): { duration: number; frames: Iterable<Frame> } {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const rows: unknown = Array.isArray(j) ? j : (j.descriptors ?? j.frames ?? j.timeline ?? j.rows);
  if (!Array.isArray(rows)) throw new Error(`no descriptor array found in ${file} (keys: ${Object.keys(j)})`);
  // Rows may be Descriptors directly or wrap them ({ t, descriptors: {...} } / { d: {...} }).
  const descriptors = rows.map((r) => ({ ...neutralDescriptors(), ...(r.descriptors ?? r.d ?? r) }) as Descriptors);
  let fps = 1;
  // Row timestamps win: a file's `fps` may describe the analysis rate, not the row rate.
  if (rows.length > 1 && typeof rows[0].t === 'number' && rows[1].t > rows[0].t) fps = 1 / (rows[1].t - rows[0].t);
  else if (!Array.isArray(j)) {
    if (typeof j.fps === 'number') fps = j.fps;
    else if (typeof j.hop === 'number') fps = 1 / j.hop;
    else if (Array.isArray(j.times) && j.times.length > 1) fps = 1 / (j.times[1] - j.times[0]);
  }
  const duration = descriptors.length / fps;
  const f = emptyFeatures();
  function* frames(): Iterable<Frame> {
    for (let i = 0; i / 30 < duration; i++) {
      yield { d: descriptors[Math.min(descriptors.length - 1, Math.floor((i / 30) * fps))], f, dt: 1 / 30 };
    }
  }
  return { duration, frames: frames() };
}

const fmt = (v: number) => v.toFixed(2).padStart(5);

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: npx tsx scripts/character-file.ts <file> [--every seconds] [--summary]');
    process.exit(1);
  }
  const everyIdx = args.indexOf('--every');
  const every = everyIdx >= 0 ? Number(args[everyIdx + 1]) : 4;
  const summaryOnly = args.includes('--summary');
  const tl = extname(file).toLowerCase() === '.json' ? fromJson(file) : await fromAudio(file);

  const engine = new CharacterEngine();
  const totals: Record<string, number> = {};
  const leaders: Record<string, number> = {};
  const words: Record<string, number> = {};
  let frames = 0;
  let t = 0;
  let nextPrint = every;
  let events = 0;
  const onsetHeights: number[] = [];
  let switches = 0;
  let nameSwitches = 0;
  let prevLeader = '';
  let prevName = '';
  if (!summaryOnly) console.log(`${basename(file)}: ${tl.duration.toFixed(1)} s`);
  for (const { d, f, dt } of tl.frames) {
    t += dt;
    const ch: Character = engine.update(d, null, f, dt);
    const evs = engine.events(f, d);
    events += evs.length;
    for (const e of evs) if (e.onset) onsetHeights.push(e.height);
    // Skip the first 3 s (warm-up) in the summary.
    if (t >= 3) {
      frames++;
      for (const b of ch.blend) totals[b.id] = (totals[b.id] ?? 0) + b.weight;
      leaders[ch.blend[0].id] = (leaders[ch.blend[0].id] ?? 0) + 1;
      if (prevLeader && ch.blend[0].id !== prevLeader) switches++;
      prevLeader = ch.blend[0].id;
      // The archetype the words name (what a viewer reads), which has its own hysteresis.
      if (prevName && ch.words[0] !== prevName) nameSwitches++;
      prevName = ch.words[0];
      for (const w of ch.words) words[w] = (words[w] ?? 0) + 1;
    }
    if (!summaryOnly && t >= nextPrint) {
      nextPrint += every;
      const a = ch.axes;
      const blend = ch.blend.slice(0, 3).map((b) => `${b.id} ${b.weight.toFixed(2)}`).join(', ');
      console.log(
        `${t.toFixed(0).padStart(4)}s  ${blend.padEnd(40)} ${ch.words.join(' ').padEnd(30)}` +
          ` E${fmt(a.energy)} V${fmt(a.valence)} W${fmt(a.weight)} S${fmt(a.size)} A${fmt(a.agitation)}` +
          ` Sh${fmt(a.sharpness)} P${fmt(a.pace)} conf${fmt(ch.confidence)}` +
          `  | loud${fmt(d.loudness)} reg${fmt(d.register)} att${fmt(d.attack)} sus${fmt(d.sustain)} ons${fmt(d.onsetRate)}` +
          ` irr${fmt(d.irregularity)} maj${fmt(d.majorness)} pulse${fmt(d.pulseClarity)} noise${fmt(d.noisiness)}`,
      );
    }
  }
  const avg = Object.entries(totals)
    .map(([id, w]) => [id, w / Math.max(1, frames)] as const)
    .sort((a, b) => b[1] - a[1]);
  const lead = Object.entries(leaders).sort((a, b) => b[1] - a[1]);
  const topWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mins = Math.max(1 / 60, (tl.duration - 3) / 60);
  const hMean = onsetHeights.reduce((s, v) => s + v, 0) / Math.max(1, onsetHeights.length);
  const hSd = Math.sqrt(onsetHeights.reduce((s, v) => s + (v - hMean) ** 2, 0) / Math.max(1, onsetHeights.length));
  console.log(
    `${basename(file).padEnd(16)} mean blend: ${avg.slice(0, 3).map(([id, w]) => `${id} ${w.toFixed(2)}`).join(', ')}` +
      ` | leader: ${lead.slice(0, 3).map(([id, n]) => `${id} ${Math.round((100 * n) / Math.max(1, frames))}%`).join(', ')}` +
      ` | words: ${topWords.map(([w]) => w).join(', ')} | ${(events / tl.duration).toFixed(1)} events/s` +
      ` (${(onsetHeights.length / tl.duration).toFixed(1)} onsets, height ${hMean.toFixed(2)}±${hSd.toFixed(2)})` +
      ` | switches/min: blend ${(switches / mins).toFixed(1)}, name ${(nameSwitches / mins).toFixed(1)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
