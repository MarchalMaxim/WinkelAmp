/// <reference types="node" />
/**
 * Study pack: everything a composer needs to "hear" a recording it cannot listen
 * to, plus the song data the app plays a scripted show from.
 *
 *   npm run study -- <audio file> [--id <slug>]
 *
 * Writes study/<slug>/{summary.md, analysis.json, spectrogram.png, melody.png, mood.png}
 * and corpus/<slug>.data.json (SongData). One pass of the live analysis chain
 * (analyzeOffline, with the live MelodyTracker and the CharacterEngine stepped on
 * every hop), then offline-only post-processing that may look ahead: the Viterbi
 * melody, novelty sections, drops, a beat grid, chords, phrases and motifs.
 * Times are song seconds of this exact file (when the sound is heard).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint } from '../src/audio/fingerprint';
import { extractMelody } from '../src/audio/melody';
import { analyzeOffline } from '../src/audio/offline';
import { findDrops, segment } from '../src/audio/structure';
import { CharacterEngine } from '../src/character/character';
import { ARCHETYPE_IDS, type ArchetypeId, type Descriptors } from '../src/character/types';
import type { Drop, MelodyNote, Section, SongData, StructureRow } from '../src/stage/types';
import { chordChanges, ONSET_LAG, PULSE_MIN, trackBeats } from '../src/audio/song-analysis';
import { decode } from './analyze-file';
import { heatmap, linePlot, noteName, pianoRoll, type Mark, type Rgb } from './lib/plot';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 44100;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Melody phrases: a rest longer than this ends one. */
const PHRASE_GAP = 1;
/** Motifs: at least this many notes, repeated with the same intervals. */
const MOTIF_NOTES = 5;
/** Spectrogram: C1 … C9, rows per octave. */
const SPEC_LO = 32.703;
const SPEC_OCTAVES = 8;
const SPEC_ROWS = 25 * SPEC_OCTAVES;
const PLOT_W = 1400;
/** Mood and descriptor timelines are kept at this resolution (seconds). */
const LANE_HOP = 0.25;

const ARCH_COLOR: Record<ArchetypeId, Rgb> = {
  fire: [255, 90, 30], abyss: [70, 70, 220], sugar: [255, 150, 220], mist: [150, 215, 235],
  gold: [255, 205, 60], storm: [165, 90, 255], machine: [0, 225, 195], lament: [120, 135, 150],
};
const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const clockS = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};

function args() {
  const a = process.argv.slice(2);
  const opt = (name: string) => {
    const i = a.indexOf(name);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const file = a.find((x, i) => !x.startsWith('--') && !a[i - 1]?.startsWith('--'));
  if (!file) {
    console.error('usage: npm run study -- <audio file> [--id <slug>]');
    process.exit(2);
  }
  const stem = basename(file, extname(file));
  const id = opt('--id') ?? stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!SLUG.test(id)) {
    console.error(`"${id}" is not a usable id (lowercase letters, digits and single dashes): pass --id <slug>`);
    process.exit(2);
  }
  const title = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return { file, id, title };
}

// ---------------------------------------------------------------------------
// Offline post-processing
// ---------------------------------------------------------------------------

interface TempoSpread {
  /** Median BPM, and the 10th / 90th percentile of the per-second tempo. */
  bpm: number;
  lo: number;
  hi: number;
  /** (hi − lo) / bpm. */
  spread: number;
}

/**
 * How much the music's own tempo moves over hops [h0, h1): the descriptor's
 * running estimate, not the beat grid (which holds one period by construction, so
 * its spacing always looks steady). Per-second medians over sounding seconds with
 * some pulse, folded into the octave around their median (a halved or doubled
 * estimate is the same pulse). Null with fewer than 5 such seconds.
 */
function tempoSpread(D: Descriptors[], h0: number, h1: number, fps = 60): TempoSpread | null {
  const perSecond: number[] = [];
  for (let a = h0; a + fps <= h1; a += fps) {
    const xs: number[] = [];
    for (let h = a; h < a + fps; h++) if (D[h].tempo > 0 && D[h].silence < 0.5 && D[h].pulseClarity >= 0.15) xs.push(D[h].tempo * 200);
    if (xs.length > fps / 2) perSecond.push(median(xs));
  }
  if (perSecond.length < 5) return null;
  const m = median(perSecond);
  const folded = perSecond.map((b) => {
    while (b < m / Math.SQRT2) b *= 2;
    while (b >= m * Math.SQRT2) b /= 2;
    return b;
  }).sort((a, b) => a - b);
  const q = (p: number) => folded[Math.floor(p * (folded.length - 1))];
  return { bpm: r1(m), lo: r1(q(0.1)), hi: r1(q(0.9)), spread: r2((q(0.9) - q(0.1)) / m) };
}

const steadiness = (t: TempoSpread | null) =>
  !t ? 'no measurable tempo' : t.spread < 0.1 ? 'steady' : t.spread < 0.3 ? 'flexible' : 'free or changing';

type Shape = 'static' | 'rising' | 'falling' | 'arch' | 'valley';

/** The contour of a run of notes, in words (≥ 2 semitones counts as movement). */
function shape(ms: number[]): Shape {
  const lo = Math.min(...ms), hi = Math.max(...ms);
  if (hi - lo < 2) return 'static';
  const third = Math.max(1, Math.floor(ms.length / 3));
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const first = avg(ms.slice(0, third)), last = avg(ms.slice(-third));
  const mid = ms.length >= 3 ? ms.slice(third, ms.length - third) : [];
  if (mid.length && Math.max(...mid) >= Math.max(first, last) + 2) return 'arch';
  if (mid.length && Math.min(...mid) <= Math.min(first, last) - 2) return 'valley';
  return last - first >= 2 ? 'rising' : last - first <= -2 ? 'falling' : 'static';
}

interface Phrase {
  start: number;
  end: number;
  notes: number;
  low: string;
  high: string;
  shape: Shape;
  /** Index of its first note in the note list. */
  first: number;
}

function phrases(notes: MelodyNote[]): Phrase[] {
  const out: Phrase[] = [];
  for (let i = 0; i < notes.length; ) {
    let j = i + 1;
    while (j < notes.length && notes[j].start - notes[j - 1].end <= PHRASE_GAP) j++;
    const ms = notes.slice(i, j).map((n) => Math.round(n.midi));
    out.push({
      start: r3(notes[i].start), end: r3(notes[j - 1].end), notes: j - i,
      low: noteName(Math.min(...ms)), high: noteName(Math.max(...ms)), shape: shape(ms), first: i,
    });
    i = j;
  }
  return out;
}

interface Motif {
  label: string;
  /** Semitone steps between its notes. */
  intervals: number[];
  notes: number;
  occurrences: { t: number; note: string; index: number }[];
}

/**
 * Repeated motifs: interval sequences of ≥ MOTIF_NOTES notes (transposition
 * doesn't matter) that come back, inside phrases, not overlapping themselves.
 * Each is grown as long as every occurrence agrees, and a motif that is only a
 * piece of a longer one is dropped. The best eight by notes × occurrences.
 */
function motifs(notes: MelodyNote[], ps: Phrase[]): Motif[] {
  const m = notes.map((n) => Math.round(n.midi));
  const phraseOf = new Int32Array(notes.length);
  ps.forEach((p, k) => phraseOf.fill(k, p.first, p.first + p.notes));
  const k0 = MOTIF_NOTES - 1;
  const key = (i: number, len: number) => {
    const iv: number[] = [];
    for (let j = 0; j < len; j++) iv.push(m[i + j + 1] - m[i + j]);
    return iv;
  };
  const inPhrase = (i: number, len: number) => i + len < notes.length && phraseOf[i] === phraseOf[i + len];
  const groups = new Map<string, number[]>();
  for (let i = 0; i + k0 < notes.length; i++) {
    if (!inPhrase(i, k0)) continue;
    const iv = key(i, k0);
    if (iv.every((x) => x === 0)) continue; // a repeated note is not a motif
    const s = iv.join(',');
    const g = groups.get(s);
    if (g) g.push(i);
    else groups.set(s, [i]);
  }
  const found: { starts: number[]; len: number }[] = [];
  for (const starts0 of groups.values()) {
    // Non-overlapping occurrences, earliest first.
    const starts: number[] = [];
    for (const s of starts0) if (!starts.length || s >= starts[starts.length - 1] + k0) starts.push(s);
    if (starts.length < 2) continue;
    let len = k0;
    while (
      starts.every((s) => inPhrase(s, len + 1)) &&
      starts.every((s) => m[s + len + 1] - m[s + len] === m[starts[0] + len + 1] - m[starts[0] + len]) &&
      starts.every((s, i) => i === 0 || s >= starts[i - 1] + len + 1)
    ) len++;
    found.push({ starts, len });
  }
  // Drop a motif whose occurrences all sit inside a longer motif's, at one offset.
  const kept = found.filter((b) => !found.some((a) => a !== b && a.len > b.len && a.starts.length >= b.starts.length &&
    Array.from({ length: a.len - b.len + 1 }, (_, k) => k).some((k) => b.starts.every((s) => a.starts.includes(s - k)))));
  kept.sort((a, b) => b.len * b.starts.length - a.len * a.starts.length || a.starts[0] - b.starts[0]);
  return kept.slice(0, 8).map((x, i) => ({
    label: String.fromCharCode(65 + i),
    intervals: key(x.starts[0], x.len),
    notes: x.len + 1,
    occurrences: x.starts.map((s) => ({ t: r3(notes[s].start), note: noteName(m[s]), index: s })),
  }));
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const loudWord = (l: number) => (l < 0.25 ? 'very soft' : l < 0.42 ? 'soft' : l < 0.58 ? 'medium' : l < 0.75 ? 'loud' : 'very loud');
const registerNote = (r: number) => noteName(24 + 84 * r);
const registerWord = (r: number) => (r < 0.36 ? 'low' : r < 0.52 ? 'middle' : 'high');
function textureWords(d: Descriptors): string {
  const art = d.attack > 0.6 ? 'staccato' : d.sustain > 0.6 ? 'legato' : 'mixed touch';
  const rate = d.onsetRate * 10;
  return `${art}, ${rate < 1.5 ? 'sparse' : rate < 4 ? 'moving' : 'busy'} ${rate.toFixed(1)}/s`;
}
const pulseWord = (p: number) => (p < 0.15 ? 'none' : p < 0.3 ? 'weak' : p < 0.55 ? 'moderate' : 'clear');
const keyName = (k: number) => `${KEYS[k % 12]} ${k >= 12 ? 'minor' : 'major'}`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { file, id, title } = args();
  const t0 = performance.now();
  const lap = (() => {
    let last = t0;
    return (what: string) => {
      const now = performance.now();
      console.log(`  ${what.padEnd(26)} ${((now - last) / 1000).toFixed(1)} s`);
      last = now;
    };
  })();
  console.log(`study ${id}: ${file}`);
  const pcm = decode(file, SR);
  const duration = pcm.length / SR;
  lap(`decode (${duration.toFixed(1)} s audio)`);
  const fp = fingerprint(pcm, SR);
  lap('fingerprint');

  // One pass of the live chain; the hook keeps what the result doesn't.
  const fps = 60;
  const hops = Math.floor((pcm.length * fps) / SR);
  const chroma = new Float32Array(hops * 12);
  const odf = new Float32Array(hops);
  const keyIdx = new Uint8Array(hops);
  const leaderIdx = new Uint8Array(hops);
  const laneN = Math.ceil(duration / LANE_HOP);
  const blend = ARCHETYPE_IDS.map(() => new Float32Array(laneN));
  const laneCount = new Float32Array(laneN);
  const seconds: { t: number; leader: ArchetypeId; blend: [string, number][]; words: string[]; axes: Record<string, number> }[] = [];
  const cols = Math.min(hops, PLOT_W - 74);
  const spec: Float32Array[] = [];
  const engine = new CharacterEngine();
  const binOf = (hz: number) => (hz * 4096) / SR;
  let nextCol = 0;
  const res = analyzeOffline(pcm, SR, {
    melody: true,
    onHop(h, chain, mel) {
      chroma.set(chain.features.chroma, h * 12);
      const dbg = chain.descriptorExtractor.debug;
      odf[h] = dbg.odf;
      keyIdx[h] = dbg.key + (dbg.minor ? 12 : 0);
      const ch = engine.update(chain.descriptors, null, chain.features, 1 / fps, 1 / fps, mel);
      leaderIdx[h] = ARCHETYPE_IDS.indexOf(ch.blend[0].id);
      const li = Math.min(laneN - 1, Math.floor(h / fps / LANE_HOP));
      for (const b of ch.blend) blend[ARCHETYPE_IDS.indexOf(b.id)][li] += b.weight;
      laneCount[li]++;
      if (h % fps === fps - 1) {
        const ax: Record<string, number> = {};
        for (const [k, v] of Object.entries(ch.axes)) ax[k] = r2(v);
        seconds.push({ t: seconds.length, leader: ch.blend[0].id, blend: ch.blend.slice(0, 3).map((b) => [b.id, r2(b.weight)]), words: [...ch.words], axes: ax });
      }
      if (h >= Math.round((nextCol * hops) / cols) && spec.length < cols) {
        nextCol++;
        const m = chain.spectrum.magnitudes;
        const col = new Float32Array(SPEC_ROWS);
        for (let r = 0; r < SPEC_ROWS; r++) {
          const a = binOf(SPEC_LO * 2 ** (r / 25)), b = binOf(SPEC_LO * 2 ** ((r + 1) / 25));
          let v = 0;
          for (let k = Math.floor(a); k <= Math.max(Math.floor(a), Math.ceil(b) - 1) && k < m.length; k++) v = Math.max(v, m[k]);
          col[r] = 20 * Math.log10(v + 1e-9);
        }
        spec.push(col);
      }
    },
  });
  for (let i = 0; i < laneN; i++) for (const b of blend) b[i] /= Math.max(1, laneCount[i]);
  lap(`analysis (${hops} hops)`);

  const D = res.descriptors;
  const at = (t: number) => D[Math.max(0, Math.min(hops - 1, Math.round(t * fps) - 1))];
  const quiet = Uint8Array.from(D, (d) => (d.silence > 0.5 ? 1 : 0));

  // Melody: the Viterbi line over the whole piece. contour[k] is heard at (k + 1)/fps;
  // SongData's midi[i] at i·hop, hence the shift by one.
  const latency = res.melody!.latency;
  const mel = extractMelody(res.melody!.salience, fps, { latency });
  res.melody = undefined; // ~100 MB of salience for a 12-minute piece
  const notes: MelodyNote[] = mel.notes.map((n) => ({ start: r3(n.start), end: r3(n.end), midi: r2(n.midi), strength: r2(n.strength), confidence: r2(n.confidence) }));
  const contour: (number | null)[] = [null];
  for (let k = 0; k + 1 < hops; k++) contour.push(Number.isFinite(mel.contour[k]) ? r2(mel.contour[k]) : null);
  lap(`melody (${notes.length} notes)`);

  // Onsets and the beat grid, both from the descriptor onset detector.
  const onsetHops: number[] = [];
  for (let h = 1; h < hops; h++) if (res.onsets[h]) onsetHops.push(h - 1); // it fires a hop late
  const peakOdf = onsetHops.map((h) => odf[h]).sort((a, b) => a - b);
  const odfRef = peakOdf[Math.floor(0.95 * (peakOdf.length - 1))] || 1;
  const onsets = onsetHops
    .map((h) => ({ t: r3(res.times[h] - ONSET_LAG), s: r2(clamp01(Math.sqrt(odf[h] / odfRef))) }))
    .filter((o) => o.t >= 0);
  const grid = trackBeats(odf, fps);
  const allBeats = grid.beats.map((h) => res.times[h] - ONSET_LAG).filter((t) => t >= 0);
  const beats = allBeats.filter((t) => at(t).pulseClarity >= PULSE_MIN && at(t).silence < 0.5).map(r3);
  const ibi = median(allBeats.slice(1).map((t, i) => t - allBeats[i]));
  const tempo = tempoSpread(D, 0, hops);
  lap(`onsets & beats (${onsets.length}, ${beats.length})`);

  // Structure.
  const rows: StructureRow[] = D.map((d, h) => ({
    chroma: chroma.subarray(h * 12, h * 12 + 12), loudness: d.loudness, register: d.register,
    brightness: d.brightness, onsetRate: d.onsetRate, sustain: d.sustain,
  }));
  const sections: Section[] = segment(rows, 1 / fps).map((s) => ({ start: r3(s.start), end: r3(s.end), novelty: r2(s.novelty) }));
  const drops: Drop[] = findDrops(Float32Array.from(res.features, (f) => f.bass), 1 / fps).map((d) => ({ time: r3(d.time), strength: r2(d.strength) }));
  const chordList = chordChanges(chroma, quiet, fps, latency);
  lap(`structure (${sections.length} sections, ${drops.length} drops)`);

  // Loudness climaxes: the five loudest peaks of the 2 s-smoothed loudness, apart from each other.
  const loud = new Float32Array(hops);
  {
    const w = fps, pre = new Float64Array(hops + 1);
    for (let h = 0; h < hops; h++) pre[h + 1] = pre[h] + D[h].loudness;
    for (let h = 0; h < hops; h++) {
      const a = Math.max(0, h - w), b = Math.min(hops, h + w + 1);
      loud[h] = (pre[b] - pre[a]) / (b - a);
    }
  }
  const gap = Math.max(10, duration / 20) * fps;
  const peaks: { t: number; loudness: number }[] = [];
  const order = Array.from({ length: hops }, (_, h) => h).sort((a, b) => loud[b] - loud[a]);
  for (const h of order) {
    if (peaks.length >= 5) break;
    if (loud[h] <= 0.05 || peaks.some((p) => Math.abs(p.t * fps - h) < gap)) continue;
    if ((h > 0 && loud[h - 1] > loud[h]) || (h + 1 < hops && loud[h + 1] > loud[h])) continue;
    peaks.push({ t: r1(res.times[h]), loudness: r2(loud[h]) });
  }

  // Per-section character: mean descriptors, leading archetype, words, key.
  const meanD = (a: number, b: number): Descriptors => {
    const h0 = Math.max(0, Math.round(a * fps)), h1 = Math.max(h0 + 1, Math.min(hops, Math.round(b * fps)));
    const out = { ...D[h0] };
    const ks = Object.keys(out) as (keyof Descriptors)[];
    for (const k of ks) out[k] = 0;
    let n = 0;
    for (let h = h0; h < h1; h++) {
      if (quiet[h] && h1 - h0 > 1) continue;
      for (const k of ks) out[k] += D[h][k];
      n++;
    }
    for (const k of ks) out[k] /= Math.max(1, n);
    return out;
  };
  const moodOver = (a: number, b: number) => {
    const w = ARCHETYPE_IDS.map((_, i) => {
      let s = 0, n = 0;
      for (let j = Math.floor(a / LANE_HOP); j < Math.min(laneN, Math.ceil(b / LANE_HOP)); j++) [s, n] = [s + blend[i][j], n + 1];
      return s / Math.max(1, n);
    });
    const lead = ARCHETYPE_IDS[w.indexOf(Math.max(...w))];
    const counts = new Map<string, number>();
    for (const s of seconds.slice(Math.floor(a), Math.max(Math.floor(a) + 1, Math.ceil(b)))) for (const x of s.words) counts.set(x, (counts.get(x) ?? 0) + 1);
    const words = [...counts.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([x]) => x);
    return { leader: lead, share: Math.max(...w), words };
  };
  const keyOver = (a: number, b: number) => {
    const votes = new Float64Array(24);
    for (let h = Math.round(a * fps); h < Math.min(hops, Math.round(b * fps)); h++) if (!quiet[h]) votes[keyIdx[h]] += D[h].keyClarity;
    const best = votes.indexOf(Math.max(...votes));
    return votes[best] > 0 ? keyName(best) : '–';
  };
  const sectionInfo = sections.map((s, i) => {
    const d = meanD(s.start, s.end);
    const m = moodOver(s.start, s.end);
    return {
      n: i + 1, start: s.start, end: s.end, novelty: s.novelty, leader: m.leader, leaderShare: r2(m.share), words: m.words,
      loudness: r2(d.loudness), register: r2(d.register), registerNote: registerNote(d.register), attack: r2(d.attack),
      sustain: r2(d.sustain), onsetsPerSec: r1(d.onsetRate * 10), pulse: r2(d.pulseClarity), majorness: r2(d.majorness),
      key: keyOver(s.start, s.end), texture: textureWords(d),
      tempo: tempoSpread(D, Math.round(s.start * fps), Math.min(hops, Math.round(s.end * fps)))?.bpm ?? null,
    };
  });
  const keyArc: string[] = [];
  for (const s of sectionInfo) if (s.key !== '–' && s.key !== keyArc[keyArc.length - 1]) keyArc.push(s.key);

  const ps = phrases(notes);
  const motifList = motifs(notes, ps);
  const voiced = contour.filter((v) => v != null).length / Math.max(1, contour.length);
  const ms = notes.map((n) => Math.round(n.midi)).sort((a, b) => a - b);
  const pct = (q: number) => ms[Math.floor(q * (ms.length - 1))];
  lap(`phrases & motifs (${ps.length}, ${motifList.length})`);

  // Mood for SongData: the leader and words, each time either changes (checked every second).
  const mood: SongData['mood'] = [];
  for (const s of seconds) {
    const last = mood[mood.length - 1];
    if (!last || last.leader !== s.leader || last.words.join() !== s.words.join()) mood.push({ t: s.t, leader: s.leader, words: s.words });
  }

  // ---- Files ----
  const outDir = join(REPO, 'study', id);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(REPO, 'corpus'), { recursive: true });
  const data: SongData = {
    version: 1, id, duration: r3(duration), fingerprint: fp,
    melody: { notes, contour: { hop: 1 / fps, midi: contour } },
    beats, onsets, sections, drops, chords: chordList, mood,
  };
  const dataFile = join(REPO, 'corpus', `${id}.data.json`);
  const dataJson = JSON.stringify(data);
  writeFileSync(dataFile, dataJson);

  const marks: Mark[] = [
    ...sections.slice(1).map((s, i) => ({ t: s.start, color: [235, 235, 235] as Rgb, label: `S${i + 2}` })),
    ...drops.map((d) => ({ t: d.time, color: [255, 70, 70] as Rgb, label: 'DROP' })),
  ];
  const peakMarks: Mark[] = [...peaks].sort((a, b) => b.loudness - a.loudness).map((p, i) => ({ t: p.t, color: [255, 205, 60] as Rgb, label: `P${i + 1}` }));
  const rowSeconds = duration > 150 ? 120 : undefined;

  // Spectrogram: dB against the piece's loudest cell, 80 dB of range.
  let top = -Infinity;
  for (const c of spec) for (const v of c) top = Math.max(top, v);
  const columns = spec.map((c) => Float32Array.from(c, (v) => clamp01((v - (top - 80)) / 80)));
  heatmap(join(outDir, 'spectrogram.png'), {
    title: `${title} - spectrogram (log frequency, 80 dB range)`, duration, width: PLOT_W, marks, columns, height: 300,
    yTicks: Array.from({ length: SPEC_OCTAVES + 1 }, (_, o) => ({ at: o / SPEC_OCTAVES, label: `C${o + 1}` })),
  });
  pianoRoll(join(outDir, 'melody.png'), {
    title: `${title} - melody (bars: notes, blue: contour, letters: motifs)`, duration, width: PLOT_W, rowSeconds, marks,
    notes, contour: { hop: 1 / fps, midi: contour },
    tags: motifList.flatMap((m, i) => m.occurrences.map((o) => ({ t: o.t, midi: notes[o.index].midi, label: m.label, color: MOTIF_COLORS[i % MOTIF_COLORS.length] }))),
  });
  const lane = (key: keyof Descriptors) => {
    const out = new Float32Array(laneN);
    for (let i = 0; i < laneN; i++) out[i] = meanD(i * LANE_HOP, (i + 1) * LANE_HOP)[key];
    return out;
  };
  const voicedLane = new Float32Array(laneN);
  for (let i = 0; i < laneN; i++) {
    let v = 0, n = 0;
    for (let k = Math.round((i * LANE_HOP) / (1 / fps)); k < Math.min(contour.length, Math.round(((i + 1) * LANE_HOP) * fps)); k++) [v, n] = [v + (contour[k] != null ? 1 : 0), n + 1];
    voicedLane[i] = n ? v / n : 0;
  }
  linePlot(join(outDir, 'mood.png'), {
    title: `${title} - mood and energy`, duration, width: PLOT_W, hop: LANE_HOP, marks: [...marks, ...peakMarks],
    lanes: [
      { label: 'MOOD', height: 110, stack: ARCHETYPE_IDS.map((a, i) => ({ values: blend[i], color: ARCH_COLOR[a], label: a })) },
      { label: 'LOUDNESS', height: 70, series: [{ values: lane('loudness'), color: [240, 240, 240], fill: true }, { values: voicedLane, color: [110, 200, 255], label: 'tune voiced' }] },
      { label: 'PITCH', height: 70, series: [{ values: lane('register'), color: [255, 190, 90], label: 'register' }, { values: lane('brightness'), color: [180, 120, 255], label: 'brightness' }] },
      { label: 'MOTION', height: 70, series: [{ values: lane('onsetRate'), color: [120, 230, 120], label: 'onsets (1 = 10/s)' }, { values: lane('pulseClarity'), color: [255, 110, 110], label: 'pulse' }, { values: lane('attack'), color: [240, 240, 240], label: 'attack' }] },
      { label: 'MODE', height: 60, range: [-1, 1], series: [{ values: lane('majorness'), color: [255, 205, 60], label: 'major + / minor -' }] },
    ],
  });
  lap('plots');

  const analysis = {
    file: basename(file), id, title, duration: r3(duration), fps, sampleRate: SR,
    tempo: { gridBpm: r1(60 / ibi), music: tempo, steadiness: steadiness(tempo), pulseMedian: r2(median(D.map((d) => d.pulseClarity))), beatsKept: beats.length, beatsFound: allBeats.length },
    keyArc, sections: sectionInfo, drops, peaks,
    melody: {
      voiced: r2(voiced), range: ms.length ? [noteName(ms[0]), noteName(ms[ms.length - 1])] : [],
      notes, phrases: ps.map(({ first: _first, ...p }) => p), motifs: motifList.map(({ occurrences, ...m }) => ({ ...m, occurrences: occurrences.map(({ index: _i, ...o }) => o) })),
    },
    beats, onsets, chords: chordList,
    seconds: seconds.map((s) => {
      const d = meanD(s.t, s.t + 1);
      const row: Record<string, unknown> = { t: s.t };
      for (const [k, v] of Object.entries(d)) row[k] = r3(v);
      return { ...row, leader: s.leader, blend: s.blend, words: s.words, axes: s.axes };
    }),
  };
  writeFileSync(join(outDir, 'analysis.json'), JSON.stringify(analysis));

  const md = summary({
    title, file: basename(file), id, duration, bpm: 60 / ibi, tempo, pulse: median(D.map((d) => d.pulseClarity)),
    keyArc, sectionInfo, drops, peaks, voiced, range: ms.length ? [ms[0], ms[ms.length - 1], pct(0.05), pct(0.95)] : null,
    phrases: ps, motifs: motifList, beats: beats.length, allBeats: allBeats.length, onsets: onsets.length, notes: notes.length,
    chords: chordList.length, seconds, D: (t: number) => meanD(t, t + 10), sectionAt: (t: number) => sections.findIndex((s) => t >= s.start && t < s.end) + 1,
  });
  writeFileSync(join(outDir, 'summary.md'), md);
  lap('write');

  const total = (performance.now() - t0) / 1000;
  const rss = process.resourceUsage().maxRSS / 1024;
  console.log(`done in ${total.toFixed(1)} s, peak memory ${rss.toFixed(0)} MB`);
  console.log(`  ${join(outDir, 'summary.md')}  (and analysis.json, spectrogram.png, melody.png, mood.png)`);
  console.log(`  ${dataFile}  (${(dataJson.length / 1024).toFixed(0)} KB)`);
}

const MOTIF_COLORS: Rgb[] = [[120, 255, 160], [255, 120, 200], [120, 200, 255], [255, 230, 120], [200, 160, 255], [255, 160, 110], [160, 255, 255], [230, 230, 230]];

interface SummaryInput {
  title: string;
  file: string;
  id: string;
  duration: number;
  bpm: number;
  tempo: TempoSpread | null;
  pulse: number;
  keyArc: string[];
  sectionInfo: {
    n: number; start: number; end: number; novelty: number; leader: string; leaderShare: number; words: string[];
    loudness: number; registerNote: string; register: number; texture: string; key: string; pulse: number; tempo: number | null;
  }[];
  drops: Drop[];
  peaks: { t: number; loudness: number }[];
  voiced: number;
  range: [number, number, number, number] | null;
  phrases: Phrase[];
  motifs: Motif[];
  beats: number;
  allBeats: number;
  onsets: number;
  notes: number;
  chords: number;
  seconds: { t: number; leader: string; words: string[] }[];
  D: (t: number) => Descriptors;
  sectionAt: (t: number) => number;
}

/** summary.md: what a composer reads first. Scannable: a header, tables, one line per 10 s. */
function summary(s: SummaryInput): string {
  const L: string[] = [];
  const steady = steadiness(s.tempo);
  const range = s.tempo ? `${steady}: the music's own tempo runs ${Math.round(s.tempo.lo)}–${Math.round(s.tempo.hi)} BPM (10–90 %)` : steady;
  L.push(`# ${s.title}`, '');
  L.push(`Study pack for \`${s.file}\` · id \`${s.id}\` · script: \`corpus/${s.id}.json\`, song data: \`corpus/${s.id}.data.json\``, '');
  L.push(`- **Duration:** ${clock(s.duration)} (${s.duration.toFixed(1)} s)`);
  // Fewer than two beats (a silent or very short file): there is no grid to state.
  const grid = Number.isFinite(s.bpm) ? `beat grid ~${Math.round(s.bpm)} BPM` : 'no beat grid';
  L.push(`- **Tempo:** ${grid}; ${range}; pulse ${pulseWord(s.pulse)} (clarity ${s.pulse.toFixed(2)})`);
  L.push(`- **Key / mode arc:** ${s.keyArc.join(' → ') || 'no clear key'}`);
  L.push(`- **Counts:** ${s.sectionInfo.length} sections, ${s.drops.length} drops, ${s.notes} melody notes (tune voiced ${Math.round(s.voiced * 100)} % of the time), ${s.onsets} onsets, ${s.beats} beats kept of ${s.allBeats}, ${s.chords} chord changes`);
  L.push('');
  L.push('Images: `spectrogram.png` (log frequency, C1 at the bottom to C9), `melody.png` (notes as bars, the');
  L.push('contour in blue, motif letters above their occurrences), `mood.png` (the archetype blend stacked, then');
  L.push('loudness, pitch, motion, mode). Dashed marks: white `S2…` section starts, red `DROP`, gold `P1…` loudness');
  L.push('peaks (P1 loudest). Mood colours: ' + ARCHETYPE_IDS.map((a) => `${a} ${hex(ARCH_COLOR[a])}`).join(', ') + '.');
  L.push('');

  L.push('## Sections', '');
  L.push('| # | start–end | character (share) · words | loudness | register | texture | pulse · BPM | key | novelty |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const x of s.sectionInfo) {
    L.push(`| S${x.n} | ${clock(x.start)}–${clock(x.end)} | **${x.leader}** (${Math.round(x.leaderShare * 100)} %) · ${x.words.join(', ')} | ${loudWord(x.loudness)} ${x.loudness.toFixed(2)} | ${registerWord(x.register)} (${x.registerNote}) | ${x.texture} | ${pulseWord(x.pulse)}${x.tempo ? ` · ${Math.round(x.tempo)}` : ''} | ${x.key} | ${x.n === 1 ? '–' : x.novelty.toFixed(2)} |`);
  }
  L.push('');

  L.push('## Big moments', '');
  L.push('Loudness peaks (2 s smoothed; P1 is the loudest — save the biggest accent for it):', '');
  [...s.peaks].sort((a, b) => b.loudness - a.loudness).forEach((p, i) => L.push(`- **P${i + 1}** at ${clock(p.t)} — loudness ${p.loudness.toFixed(2)}, in S${s.sectionAt(p.t)}`));
  L.push('');
  if (s.drops.length) {
    // A busy bass line gives many weak drops: the strongest dozen, in time order.
    const shown = [...s.drops].sort((a, b) => b.strength - a.strength).slice(0, 12).sort((a, b) => a.time - b.time);
    const more = shown.length < s.drops.length ? `, the strongest ${shown.length} of ${s.drops.length}` : '';
    L.push(`Bass drops (the low end coming back hard)${more}:`, '');
    for (const d of shown) L.push(`- ${clock(d.time)} — strength ${d.strength.toFixed(2)}`);
  } else L.push('No bass drops (normal for classical music: scene changes go on section changes).');
  L.push('');

  L.push('## Melody', '');
  if (s.range) {
    L.push(`Range ${noteName(s.range[0])}–${noteName(s.range[1])} (90 % of notes within ${noteName(s.range[2])}–${noteName(s.range[3])}); the tune is voiced ${Math.round(s.voiced * 100)} % of the time. ${s.voiced < 0.25 ? 'Little clear tune: keep the melody thread out or faint.' : s.voiced > 0.5 ? 'A clear tune most of the time: keep the melody thread on.' : ''}`);
  } else L.push('No melody found.');
  L.push('');
  const shown = s.phrases.slice(0, 60);
  if (shown.length) {
    L.push(`Phrases (a rest over ${PHRASE_GAP} s ends one)${s.phrases.length > shown.length ? `, the first ${shown.length} of ${s.phrases.length} (all in analysis.json)` : ''}:`, '');
    L.push('| start–end | notes | range | shape |', '|---|---|---|---|');
    for (const p of shown) L.push(`| ${clock(p.start)}–${clock(p.end)} | ${p.notes} | ${p.low}–${p.high} | ${p.shape} |`);
    L.push('');
  }
  if (s.motifs.length) {
    L.push(`Repeated motifs (≥ ${MOTIF_NOTES} notes with the same intervals, any transposition; letters as in melody.png):`, '');
    for (const m of s.motifs) {
      L.push(`- **${m.label}** — ${m.notes} notes, steps ${m.intervals.map((x) => (x > 0 ? `+${x}` : String(x))).join(' ')}; heard ${m.occurrences.length}×: ${m.occurrences.map((o) => `${clock(o.t)} (${o.note})`).join(', ')}`);
    }
  } else L.push('No repeated motifs of 5+ notes found.');
  L.push('');

  L.push('## Beat grid', '');
  L.push(`${Number.isFinite(s.bpm) ? `${s.allBeats} beats tracked at ~${Math.round(s.bpm)} BPM (one every ${(60 / s.bpm).toFixed(2)} s; the tracker holds one period, so the grid itself is always even — the tempo line above says how steady the music is).` : `${s.allBeats} beat${s.allBeats === 1 ? '' : 's'} tracked: too few for a grid.`} ${s.beats} kept where the pulse clarity is at least ${PULSE_MIN}; cue times snap to these beats and to onsets within 120 ms. ${s.pulse < PULSE_MIN ? 'The pulse is weak: a pulse element would throb on a guess — prefer elements that follow the melody and the onsets.' : ''}`);
  L.push('');

  L.push('## Timeline (every 10 s)', '');
  L.push('```');
  L.push('time  sec  mood     words                         loudness               reg  onsets');
  for (let t = 0; t < s.duration; t += 10) {
    const d = s.D(t);
    const secs = s.seconds.slice(t, t + 10);
    const lead = mode(secs.map((x) => x.leader));
    const words = mode(secs.map((x) => x.words.join(' ')));
    const bar = '█'.repeat(Math.round(clamp01(d.loudness) * 16)).padEnd(16, '·');
    L.push(`${clockS(t).padStart(5)}  S${String(s.sectionAt(t)).padEnd(2)} ${lead.padEnd(8)} ${words.slice(0, 29).padEnd(29)} ${bar} ${d.loudness.toFixed(2)}  ${registerNote(d.register).padEnd(4)} ${(d.onsetRate * 10).toFixed(1)}/s`);
  }
  L.push('```', '');
  return L.join('\n');
}

const hex = (c: Rgb) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
function mode(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

main();
