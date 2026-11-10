/**
 * Repairs what MuScriptor large gets wrong in ways the overnight checks measured: notes in the padding past the end,
 * chords stuck for a whole 5 s chunk, notes in digital silence, notes outside their instrument's range, doubled notes
 * and drones chopped into butting pieces.
 * Label swaps no pass can see stay as they are. Pure: no randomness, and the input is never written to.
 */
import { TRACKS, TRACK_IDS } from './instruments';
import { SILENT_DB, type Ymt3Row } from './tracks';

/** Default hop of a level lane (s). */
export const LEVEL_HOP_S = 0.1;
/** A row starting this close (s) to the end, or later, is the model hearing the last chunk's zero padding. */
export const PAST_END_MARGIN_S = 0.05;
/** MuScriptor's chunk (s): its stuck stretches start and stop on these edges. */
export const CHUNK_S = 5;
export const STUCK_MIN_PITCHES = 3;
export const STUCK_MIN_TICKS = 20;
export const STUCK_TICK_SHARE = 0.85;
export const STUCK_IOI_SHARE = 0.85;
export const STUCK_IOI_TOL_S = 0.02;
export const STUCK_MIN_SPAN_S = 4.5;
/** A stuck chord in a chunk quieter than this (mean of its frames' dB) is dropped; louder, it becomes one held chord. */
export const STUCK_QUIET_DB = -48;
/** Starts within one of these (s) count as one tick of a chord. */
export const STUCK_TICK_S = 0.01;
export const SILENCE_DB = -60;
export const SILENCE_WINDOW_S = 0.4;
/** The string lanes, low to high: the order "nearest lane" is measured in. */
export const STRING_LANES = ['Contrabass', 'Cello', 'Viola', 'Violin'] as const;
/** MIDI range of each string lane. Generous on purpose: only notes the instrument can hardly play move. */
export const STRING_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  Violin: [55, 127], Viola: [48, 81], Cello: [36, 76], Contrabass: [24, 62],
};
export const WIND_CLASSES = ['Pipe', 'Oboe', 'English Horn', 'Clarinet', 'Bassoon', 'Soprano/Alto Sax', 'Tenor Sax', 'Baritone Sax'] as const;
export const DUP_START_S = 0.02;
export const DUP_END_S = 0.1;
/** A lane's core: these quantiles of its pitches over the whole song. */
export const CORE_LO = 0.05;
export const CORE_HI = 0.95;
export const WIND_RUN_MIN = 4;
/** String attacks per second below which a wind run counts as exposed, not as part of a tutti. */
export const WIND_EXPOSED_RATE = 8;
export const MERGE_GAP_S = 0.02;
/** Most gaps are exact: MuScriptor ends a note the moment the same pitch retriggers, so a hair of overlap still butts. */
export const MERGE_OVERLAP_S = 0.001;
export const MERGE_HELD_S = 1;
export const MERGE_QUIET_S = 0.5;
export const MERGE_ONSET_S = 0.08;

/** Floating error at the edges (7.32 − 7.3 vs 0.02): a hair, never a musical distance. */
const HAIR = 1e-9;

/** dBFS per frame; past the end reads SILENT_DB. */
export interface LevelLane { hop: number; db: ArrayLike<number> }

/** RMS dBFS of consecutive frames of `hop` s; silence is SILENT_DB (tracks.ts). */
export function frameDb(pcm: Float32Array, rate: number, hop = LEVEL_HOP_S): LevelLane {
  const size = Math.max(1, Math.round(rate * hop)), frames = Math.ceil(pcm.length / size);
  const db = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    const a = k * size, b = Math.min(pcm.length, a + size);
    let sum = 0;
    for (let i = a; i < b; i++) sum += pcm[i] * pcm[i];
    const rms = Math.sqrt(sum / (b - a));
    db[k] = rms > 0 ? Math.max(SILENT_DB, 20 * Math.log10(rms)) : SILENT_DB;
  }
  return { hop, db };
}

/** The one way to read a lane: anything outside it is silence. */
const frameAt = (l: LevelLane, k: number): number => (k >= 0 && k < l.db.length ? l.db[k] : SILENT_DB);
const frameOf = (l: LevelLane, t: number): number => Math.floor(t / l.hop + HAIR);

export interface CleanInput {
  /** YourMT3 class names ("Violin", "Pipe"): names are mapped before this. */
  rows: readonly Ymt3Row[];
  duration: number;
  levels: LevelLane;
  /** Analysis onset times, ascending. */
  onsets: readonly number[];
}

export interface CleanReport {
  pastEnd: number; clamped: number;
  /** stuckCollapsed = retriggers removed. */
  stuckChunks: number; stuckDropped: number; stuckCollapsed: number;
  silent: number;
  /** "Viola>Violin": 261 */
  moved: Record<string, number>;
  laneDupes: number; stringDupes: number; windDupes: number; merged: number;
}

export const emptyReport = (): CleanReport => ({
  pastEnd: 0, clamped: 0, stuckChunks: 0, stuckDropped: 0, stuckCollapsed: 0, silent: 0, moved: {},
  laneDupes: 0, stringDupes: 0, windDupes: 0, merged: 0,
});

/** Stable by (start, midi): equal keys keep their order. */
const byStart = (rows: readonly Ymt3Row[]): Ymt3Row[] => [...rows].sort((a, b) => a[0] - b[0] || a[2] - b[2]);

function lowerBound(xs: readonly number[], x: number): number {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Each lane's pitches over the song: median and core, by order statistic (no interpolation: pitches are integers). */
function laneStats(rows: readonly Ymt3Row[], lanes: ReadonlySet<string>): Map<string, { med: number; lo: number; hi: number }> {
  const pitches = new Map<string, number[]>();
  for (const r of rows) {
    if (!lanes.has(r[4])) continue;
    let l = pitches.get(r[4]);
    if (!l) pitches.set(r[4], (l = []));
    l.push(r[2]);
  }
  const out = new Map<string, { med: number; lo: number; hi: number }>();
  for (const [cls, l] of pitches) {
    l.sort((a, b) => a - b);
    out.set(cls, { med: l[l.length >> 1], lo: l[Math.floor((l.length - 1) * CORE_LO)], hi: l[Math.floor((l.length - 1) * CORE_HI)] });
  }
  return out;
}

/** Each class's place in TRACKS: on a tie, the later one loses. */
const LANE_RANK = new Map<string, number>(TRACK_IDS.flatMap((id) => TRACKS[id].classes).map((c, i) => [c, i]));
const rankOf = (cls: string): number => LANE_RANK.get(cls) ?? Infinity;

/** Pass 1. Drop a row in the padding past the end; clamp an end to the duration. */
export function dropPastEnd(rows: readonly Ymt3Row[], duration: number, report: CleanReport): Ymt3Row[] {
  const out: Ymt3Row[] = [];
  for (const r of rows) {
    if (r[0] >= duration - PAST_END_MARGIN_S - HAIR) { report.pastEnd++; continue; }
    if (r[1] > duration) {
      report.clamped++;
      out.push([r[0], duration, r[2], r[3], r[4]]);
    } else out.push(r);
  }
  return out;
}

interface Tick { t: number; rows: number[] }

/** The chunk's stuck chord, if it has one: its ticks in time order and their median gap. */
function stuckChord(rows: readonly Ymt3Row[], chunk: readonly number[]): { ticks: Tick[]; gap: number } | null {
  const ticks = new Map<number, Tick>();
  for (const i of chunk) {
    const key = Math.round(rows[i][0] / STUCK_TICK_S);
    const tick = ticks.get(key);
    if (tick) { tick.rows.push(i); tick.t = Math.min(tick.t, rows[i][0]); }
    else ticks.set(key, { t: rows[i][0], rows: [i] });
  }
  if (ticks.size < STUCK_MIN_TICKS) return null;
  const sets = new Map<string, { size: number; ticks: Tick[] }>();
  for (const tick of ticks.values()) {
    const pitches = [...new Set(tick.rows.map((i) => rows[i][2]))].sort((a, b) => a - b);
    const sig = pitches.join(',');
    const set = sets.get(sig);
    if (set) set.ticks.push(tick);
    else sets.set(sig, { size: pitches.length, ticks: [tick] });
  }
  let best: Tick[] | null = null;
  for (const s of sets.values()) if (s.size >= STUCK_MIN_PITCHES && (!best || s.ticks.length > best.length)) best = s.ticks;
  if (!best || best.length < STUCK_MIN_TICKS || best.length / ticks.size < STUCK_TICK_SHARE) return null;
  const inTime = [...best].sort((a, b) => a.t - b.t);
  const gaps = inTime.slice(1).map((tick, i) => tick.t - inTime[i].t);
  const gap = [...gaps].sort((a, b) => a - b)[gaps.length >> 1];
  const regular = gaps.filter((g) => Math.abs(g - gap) <= STUCK_IOI_TOL_S + HAIR).length;
  if (regular / gaps.length < STUCK_IOI_SHARE) return null;
  if (inTime[inTime.length - 1].t - inTime[0].t < STUCK_MIN_SPAN_S - HAIR) return null;
  return { ticks: inTime, gap };
}

/**
 * Pass 2. A chunk whose ticks are nearly all one chord of 3 or more pitches, at one exact rate, over the whole chunk, is
 * greedy decoding stuck. In a quiet chunk its notes go. In a sounding chunk the pitches are probably right and a 9 Hz
 * strobe is not, so each (class, pitch) becomes one held note.
 */
export function collapseStuck(rows: readonly Ymt3Row[], duration: number, levels: LevelLane, report: CleanReport): Ymt3Row[] {
  const chunks = new Map<number, number[]>();
  rows.forEach((r, i) => {
    const k = Math.floor(r[0] / CHUNK_S);
    const c = chunks.get(k);
    if (c) c.push(i);
    else chunks.set(k, [i]);
  });
  const gone = new Set<number>();
  const held: Ymt3Row[] = [];
  const framesPerChunk = Math.round(CHUNK_S / levels.hop);
  for (const [k, chunk] of chunks) {
    const stuck = stuckChord(rows, chunk);
    if (!stuck) continue;
    report.stuckChunks++;
    const first = Math.round((k * CHUNK_S) / levels.hop);
    let sum = 0;
    for (let f = 0; f < framesPerChunk; f++) sum += frameAt(levels, first + f);
    const quiet = sum / framesPerChunk < STUCK_QUIET_DB;
    const a = stuck.ticks[0].t;
    const b = Math.min(duration, Math.round((stuck.ticks[stuck.ticks.length - 1].t + stuck.gap) * 1000) / 1000);
    const seen = new Set<string>();
    for (const tick of stuck.ticks) {
      for (const i of tick.rows) {
        gone.add(i);
        const r = rows[i], key = `${r[4]}|${r[2]}`;
        if (quiet) report.stuckDropped++;
        else if (seen.has(key)) report.stuckCollapsed++;
        else {
          seen.add(key);
          held.push([a, b, r[2], r[3], r[4]]);
        }
      }
    }
  }
  if (!gone.size) return [...rows];
  return byStart([...rows.filter((_, i) => !gone.has(i)), ...held]);
}

/** Pass 3. Drop a row whose loudest frame over its first SILENCE_WINDOW_S is below the floor. */
export function dropSilent(rows: readonly Ymt3Row[], levels: LevelLane, report: CleanReport): Ymt3Row[] {
  return rows.filter((r) => {
    const k1 = frameOf(levels, Math.min(r[1], r[0] + SILENCE_WINDOW_S));
    for (let k = frameOf(levels, r[0]); k <= k1; k++) if (frameAt(levels, k) >= SILENCE_DB) return true;
    report.silent++;
    return false;
  });
}

/** Pass 4. A note outside its string lane moves to the nearest lane that fits it and already has rows; none: it stays. */
export function fixRanges(rows: readonly Ymt3Row[], report: CleanReport): Ymt3Row[] {
  const present = new Set(rows.map((r) => r[4]));
  const order: readonly string[] = STRING_LANES;
  const fits = (cls: string, midi: number): boolean => midi >= STRING_RANGES[cls][0] && midi <= STRING_RANGES[cls][1];
  return rows.map((r) => {
    const from = order.indexOf(r[4]);
    if (from < 0 || fits(r[4], r[2])) return r;
    for (let d = 1; d < order.length; d++) {
      for (const to of [order[from - d], order[from + d]]) {
        if (to === undefined || !present.has(to) || !fits(to, r[2])) continue;
        const key = `${r[4]}>${to}`;
        report.moved[key] = (report.moved[key] ?? 0) + 1;
        return [r[0], r[1], r[2], r[3], to] as Ymt3Row;
      }
    }
    return r;
  });
}

/** Pass 5. One class, one pitch, starts within DUP_START_S: one row with the later end. A moved note must not sound twice. */
export function collapseLaneDupes(rows: readonly Ymt3Row[], report: CleanReport): Ymt3Row[] {
  const out: Ymt3Row[] = [];
  const last = new Map<string, number>();
  for (const r of byStart(rows)) {
    const key = `${r[4]}|${r[2]}`, at = last.get(key);
    if (at !== undefined && r[0] - out[at][0] <= DUP_START_S + HAIR) {
      if (r[1] > out[at][1]) out[at] = [out[at][0], r[1], out[at][2], out[at][3], out[at][4]];
      report.laneDupes++;
      continue;
    }
    last.set(key, out.length);
    out.push(r);
  }
  return out;
}

/**
 * Pass 6. Real unisons are common in the strings, so this is narrow: of two string rows on one pitch at one moment, the
 * one on the lane whose median is farther goes, and only if the pitch is outside its lane's core and inside the other's.
 */
export function dedupeStrings(rows: readonly Ymt3Row[], report: CleanReport): Ymt3Row[] {
  const strings = new Set<string>(STRING_LANES);
  const stats = laneStats(rows, strings);
  const byPitch = new Map<number, number[]>();
  rows.forEach((r, i) => {
    if (!strings.has(r[4])) return;
    const l = byPitch.get(r[2]);
    if (l) l.push(i);
    else byPitch.set(r[2], [i]);
  });
  const gone = new Set<number>();
  for (const [midi, ids] of byPitch) {
    ids.sort((a, b) => rows[a][0] - rows[b][0]);
    for (let x = 0; x < ids.length; x++) {
      if (gone.has(ids[x])) continue;
      const A = rows[ids[x]];
      for (let y = x + 1; y < ids.length; y++) {
        const B = rows[ids[y]];
        if (B[0] - A[0] > DUP_START_S + HAIR) break;
        if (gone.has(ids[y]) || A[4] === B[4] || Math.abs(A[1] - B[1]) > DUP_END_S + HAIR) continue;
        const sa = stats.get(A[4])!, sb = stats.get(B[4])!;
        const da = Math.abs(sa.med - midi), db = Math.abs(sb.med - midi);
        const aLoses = da > db || (da === db && rankOf(A[4]) > rankOf(B[4]));
        const lose = aLoses ? sa : sb, win = aLoses ? sb : sa;
        if ((midi >= lose.lo && midi <= lose.hi) || midi < win.lo || midi > win.hi) continue;
        gone.add(ids[aLoses ? x : y]);
        report.stringDupes++;
        if (aLoses) break;
      }
    }
  }
  return gone.size ? rows.filter((_, i) => !gone.has(i)) : [...rows];
}

/**
 * Pass 7. Dropping winds note by note cost Beethoven's oboe a quarter of its notes, so only a run goes: at least
 * WIND_RUN_MIN consecutive notes of one wind lane, each a copy of a note of another, where the strings are not playing
 * a tutti. It goes from the lane whose median is farther from the run's (a tie: the later lane in TRACKS).
 */
export function dedupeWinds(rows: readonly Ymt3Row[], report: CleanReport): Ymt3Row[] {
  const winds = new Set<string>(WIND_CLASSES);
  const lanes = new Map<string, number[]>();
  const pitchIndex = new Map<string, Map<number, number[]>>();
  rows.forEach((r, i) => {
    if (!winds.has(r[4])) return;
    let l = lanes.get(r[4]);
    if (!l) lanes.set(r[4], (l = []));
    l.push(i);
    let byPitch = pitchIndex.get(r[4]);
    if (!byPitch) pitchIndex.set(r[4], (byPitch = new Map()));
    let p = byPitch.get(r[2]);
    if (!p) byPitch.set(r[2], (p = []));
    p.push(i);
  });
  if (lanes.size < 2) return [...rows];
  const inTime = (a: number, b: number): number => rows[a][0] - rows[b][0];
  for (const l of lanes.values()) l.sort(inTime);
  for (const m of pitchIndex.values()) for (const p of m.values()) p.sort(inTime);
  const stats = laneStats(rows, winds);
  const stringLanes = new Set<string>(STRING_LANES);
  const stringStarts = rows.filter((r) => stringLanes.has(r[4])).map((r) => r[0]).sort((a, b) => a - b);
  const stringRate = (a: number, b: number): number =>
    (lowerBound(stringStarts, b) - lowerBound(stringStarts, a)) / Math.max(b - a, 1e-3);

  const gone = new Set<number>();
  const names = WIND_CLASSES.filter((c) => lanes.has(c));
  const isCopy = (r: Ymt3Row, other: string): boolean => {
    const p = pitchIndex.get(other)!.get(r[2]);
    if (!p) return false;
    let lo = 0, hi = p.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[p[mid]][0] < r[0] - DUP_START_S - HAIR) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < p.length && rows[p[k]][0] <= r[0] + DUP_START_S + HAIR; k++) {
      if (!gone.has(p[k]) && Math.abs(rows[p[k]][1] - r[1]) <= DUP_END_S + HAIR) return true;
    }
    return false;
  };
  for (const a of names) {
    for (const b of names) {
      if (a === b) continue;
      let run: number[] = [];
      const flush = (): void => {
        if (run.length >= WIND_RUN_MIN && stringRate(rows[run[0]][0], rows[run[run.length - 1]][1]) < WIND_EXPOSED_RATE) {
          const pitches = run.map((i) => rows[i][2]).sort((x, y) => x - y);
          const mid = pitches[pitches.length >> 1];
          const da = Math.abs(stats.get(a)!.med - mid), db = Math.abs(stats.get(b)!.med - mid);
          if (da > db || (da === db && rankOf(a) > rankOf(b))) {
            for (const i of run) gone.add(i);
            report.windDupes += run.length;
          }
        }
        run = [];
      };
      for (const i of lanes.get(a)!) {
        if (gone.has(i)) continue;
        if (isCopy(rows[i], b)) run.push(i);
        else flush();
      }
      flush();
    }
  }
  return gone.size ? rows.filter((_, i) => !gone.has(i)) : [...rows];
}

/**
 * Pass 8. MuScriptor ends a note the moment the same pitch retriggers, so most butting notes are real repeats. Merge
 * only when both are held long, or fairly long with no onset at the join. Each join is judged on the notes as they came
 * in, so merges do not cascade.
 */
export function mergeButting(rows: readonly Ymt3Row[], onsets: readonly number[], report: CleanReport): Ymt3Row[] {
  const onsetNear = (t: number): boolean => {
    const i = lowerBound(onsets, t - MERGE_ONSET_S - HAIR);
    return i < onsets.length && onsets[i] <= t + MERGE_ONSET_S + HAIR;
  };
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const key = `${r[4]}|${r[2]}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  const gone = new Set<number>();
  const ends = new Map<number, number>();
  for (const g of groups.values()) {
    g.sort((a, b) => rows[a][0] - rows[b][0]);
    let head = g[0];
    for (let k = 1; k < g.length; k++) {
      const prev = rows[g[k - 1]], next = rows[g[k]];
      const gap = next[0] - prev[1];
      const shorter = Math.min(prev[1] - prev[0], next[1] - next[0]);
      const butts = gap >= -MERGE_OVERLAP_S - HAIR && gap <= MERGE_GAP_S + HAIR;
      if (butts && (shorter >= MERGE_HELD_S - HAIR || (shorter >= MERGE_QUIET_S - HAIR && !onsetNear(next[0])))) {
        gone.add(g[k]);
        ends.set(head, Math.max(ends.get(head) ?? rows[head][1], next[1]));
        report.merged++;
      } else head = g[k];
    }
  }
  if (!gone.size) return [...rows];
  const out: Ymt3Row[] = [];
  rows.forEach((r, i) => {
    if (gone.has(i)) return;
    const end = ends.get(i);
    out.push(end === undefined ? r : [r[0], end, r[2], r[3], r[4]]);
  });
  return out;
}

/** All eight passes in order. The output is sorted by (start, midi), and its rows are the caller's own. */
export function cleanTracks(i: CleanInput): { rows: Ymt3Row[]; report: CleanReport } {
  const report = emptyReport();
  let rows = byStart(i.rows);
  rows = dropPastEnd(rows, i.duration, report);
  rows = collapseStuck(rows, i.duration, i.levels, report);
  rows = dropSilent(rows, i.levels, report);
  rows = fixRanges(rows, report);
  rows = collapseLaneDupes(rows, report);
  rows = dedupeStrings(rows, report);
  rows = dedupeWinds(rows, report);
  rows = mergeButting(rows, i.onsets, report);
  return { rows: byStart(rows).map((r): Ymt3Row => [r[0], r[1], r[2], r[3], r[4]]), report };
}

/** One line for pack.quality.warnings, starting "cleaned MuScriptor's notes: "; null when nothing changed. */
export function cleanWarning(r: CleanReport): string | null {
  const moved = Object.values(r.moved).reduce((a, b) => a + b, 0);
  const parts: string[] = [];
  if (r.pastEnd) parts.push(`${r.pastEnd} past the end`);
  if (r.clamped) parts.push(`${r.clamped} cut off at the end`);
  if (r.stuckChunks) parts.push(`${r.stuckChunks} stuck chunk${r.stuckChunks === 1 ? '' : 's'} (${r.stuckDropped} dropped, ${r.stuckCollapsed} retriggers removed)`);
  if (r.silent) parts.push(`${r.silent} in silence`);
  if (moved) parts.push(`${moved} moved to a lane that can play them`);
  if (r.laneDupes) parts.push(`${r.laneDupes} repeated on one lane`);
  if (r.stringDupes) parts.push(`${r.stringDupes} string doubles`);
  if (r.windDupes) parts.push(`${r.windDupes} wind copies`);
  if (r.merged) parts.push(`${r.merged} butting notes merged`);
  return parts.length ? `cleaned MuScriptor's notes: ${parts.join(', ')}` : null;
}
