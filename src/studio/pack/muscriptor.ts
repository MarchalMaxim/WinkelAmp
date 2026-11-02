/**
 * MuScriptor's names, presets and loop check (pure, browser-safe). MuScriptor names its instruments in snake case
 * (scripts/ears/muscriptor.py writes them as they are); this file is the one place they become YourMT3 class names, so
 * instruments.ts, tracks.ts and build.ts read its rows like YourMT3's.
 */
import { TRACKS, trackOf } from './instruments';
import type { Ymt3Row } from './tracks';

/** Every instrument group of muscriptor 0.4.0 (MT3_FULL_PLUS_GROUP_NAMES), in its order → its YourMT3 class. */
export const MS_CLASS: Readonly<Record<string, string>> = {
  acoustic_piano: 'Acoustic Piano',
  electric_piano: 'Electric Piano',
  chromatic_percussion: 'Chromatic Percussion',
  organ: 'Organ',
  acoustic_guitar: 'Acoustic Guitar',
  clean_electric_guitar: 'Clean Electric Guitar',
  distorted_electric_guitar: 'Distorted Electric Guitar',
  acoustic_bass: 'Acoustic Bass',
  electric_bass: 'Electric Bass',
  violin: 'Violin',
  viola: 'Viola',
  cello: 'Cello',
  contrabass: 'Contrabass',
  orchestral_harp: 'Orchestral Harp',
  timpani: 'Timpani',
  string_ensemble: 'String Ensemble',
  synth_strings: 'Synth Strings',
  voice: 'Singing Voice',
  orchestra_hit: 'Orchestra Hit',
  trumpet: 'Trumpet',
  trombone: 'Trombone',
  tuba: 'Tuba',
  french_horn: 'French Horn',
  brass_section: 'Brass Section',
  soprano_and_alto_sax: 'Soprano/Alto Sax',
  tenor_sax: 'Tenor Sax',
  baritone_sax: 'Baritone Sax',
  oboe: 'Oboe',
  english_horn: 'English Horn',
  bassoon: 'Bassoon',
  clarinet: 'Clarinet',
  flutes: 'Pipe',
  synth_lead: 'Synth Lead',
  synth_pad: 'Synth Pad',
  drums: 'Drums',
};

/** What muscriptor.py writes as its model, and the only one a cache or an import may carry: only large is tested. */
export const MS_MODEL = 'muscriptor-large';
/** The package that made all five overnight files, which do not say: an import's when there is no install to ask. */
export const MS_IMPORT_PACKAGE = '0.4.0';

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const MS_STRINGS = ['violin', 'viola', 'cello', 'contrabass'];

/** The lists the overnight runs used. Without a list MuScriptor hears Vivaldi's strings as guitars (40 % wrong). */
export const MS_PRESETS: { strings: string[]; baroque: string[]; classical: string[] } = {
  strings: [...MS_STRINGS],
  baroque: [...MS_STRINGS, 'acoustic_piano'],
  classical: [...MS_STRINGS, 'flutes', 'oboe', 'clarinet', 'bassoon', 'french_horn', 'trumpet', 'timpani'],
};
export type MsPreset = keyof typeof MS_PRESETS;

/** In a list it swallowed Vivaldi's violins from 12 to 36 s. */
export const MS_REFUSED = 'string_ensemble';

/** A preset's name or a comma list of MuScriptor's exact names, kept in the order given; else why not. */
export function resolveInstruments(arg: string): { list: string[]; preset: MsPreset | null } | { why: string } {
  const text = arg.trim();
  const presets = Object.keys(MS_PRESETS).join(', ');
  if (has(MS_PRESETS, text)) return { list: [...MS_PRESETS[text as MsPreset]], preset: text as MsPreset };
  const list = [...new Set(text.split(',').map((x) => x.trim()).filter(Boolean))];
  if (!list.length) return { why: `no instruments given: name a preset (${presets}) or list MuScriptor's names, separated by commas` };
  if (list.includes(MS_REFUSED)) return { why: `${MS_REFUSED} is not allowed in a list: it swallowed Vivaldi's violins from 12 to 36 s` };
  const unknown = list.filter((x) => !has(MS_CLASS, x));
  if (unknown.length) return { why: `unknown instrument ${unknown.join(', ')}: use a preset (${presets}) or these names: ${Object.keys(MS_CLASS).join(', ')}` };
  return { list, preset: null };
}

const CLASS_NAMES = new Set(Object.values(MS_CLASS));

/**
 * Rows of a fresh run, an overnight file or the cache as Ymt3Rows: names mapped (a mapped one stays), a velocity that is
 * not a positive number becomes 100 (MuScriptor has none, and okRow and cleanRows would drop the note). Zero-length rows
 * stay, for the loop check. A row that is not one is dropped; one with an unknown name is too, and `unknown` names it.
 */
export function mapMsRows(rows: readonly unknown[]): { rows: Ymt3Row[]; unknown: string[] } {
  const out: Ymt3Row[] = [];
  const unknown = new Set<string>();
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 5) continue;
    const [start, end, midi, vel, name] = r as unknown[];
    if (!isNum(start) || !isNum(end) || !isNum(midi) || typeof name !== 'string') continue;
    const cls = has(MS_CLASS, name) ? MS_CLASS[name] : CLASS_NAMES.has(name) ? name : null;
    if (cls === null) unknown.add(name);
    else out.push([start, end, midi, isNum(vel) && vel > 0 ? vel : 100, cls]);
  }
  return { rows: out, unknown: [...unknown] };
}

/** The list's name in a cache file: FNV-1a, 8 hex. Order matters (the list is passed to the model in the order given). */
export function listKey(list: readonly string[]): string {
  const text = list.join(',');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Whether the list asks for a keyboard, which then comes from YourMT3+ (MuScriptor barely finds a harpsichord). */
export const hasKeyboard = (list: readonly string[]): boolean => list.includes('acoustic_piano') || list.includes('electric_piano');

/** The preset a dialog offers for an overnight file's lanes: any wind → classical, else baroque. */
export function guessPreset(lanes: readonly string[]): MsPreset {
  const isWind = (lane: string) => {
    const track = has(MS_CLASS, lane) ? trackOf(MS_CLASS[lane]) : null;
    return track !== null && TRACKS[track].family === 'winds';
  };
  return lanes.some(isWind) ? 'classical' : 'baroque';
}

/**
 * MuScriptor's rows (cleaned) and the keyboard lane the list asks for. No keyboard in the list: the rows as they are, and
 * null. With YourMT3+: its keyboard in place of MuScriptor's, which barely finds a harpsichord. Without: MuScriptor's own.
 * Stable by (start, midi) when YourMT3's rows join; the input is never written to.
 */
export function mergeKeyboard(ms: readonly Ymt3Row[], ymt3: readonly Ymt3Row[] | null, list: readonly string[]):
  { rows: Ymt3Row[]; keyboard: 'ymt3' | 'muscriptor' | null } {
  if (!hasKeyboard(list)) return { rows: [...ms], keyboard: null };
  if (!ymt3) return { rows: [...ms], keyboard: 'muscriptor' };
  const isKeys = (r: Ymt3Row) => trackOf(r[4]) === 'piano';
  const rows = [...ms.filter((r) => !isKeys(r)), ...ymt3.filter(isKeys)].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  return { rows, keyboard: 'ymt3' };
}

/** Zero-length notes: Rite on medium is 0.49, every large run 0.000. This is the test with a real margin. */
export const LOOP_ZERO_SHARE = 0.05;
/** Bursting chunks: Rite on medium is 0.167; large reaches 0.083 on a 12-chunk clip and 0.048 on a whole piece. */
export const LOOP_BURST_SHARE = 0.15;
/** One chunk is never a loop: on a clip of 6 chunks or fewer it alone would reach the share (the zero padding of a last chunk can do it). */
export const LOOP_BURST_MIN_CHUNKS = 2;
export const LOOP_BURST_STARTS = 30;
export const LOOP_BURST_REGULAR = 0.9;
export const LOOP_BURST_TOL_S = 0.02;
export const LOOP_CHUNK_S = 5;

/** Whether one (class, pitch)'s starts in a chunk (ascending) are many and at a regular rate. */
function isBurst(starts: number[]): boolean {
  if (starts.length < LOOP_BURST_STARTS) return false;
  const gaps = starts.slice(1).map((t, i) => t - starts[i]).sort((a, b) => a - b);
  const median = gaps[gaps.length >> 1];
  return gaps.filter((g) => Math.abs(g - median) <= LOOP_BURST_TOL_S).length / gaps.length >= LOOP_BURST_REGULAR;
}

/**
 * Whether the model's output looks stuck in a loop, as medium on Rite did with nothing in its log. A stuck chunk or two
 * in a large run passes: those are the cleanup's job (clean-tracks.ts), not a reason to throw 20 minutes away.
 */
export function loopCheck(rows: readonly (readonly unknown[])[]): { ok: boolean; zeroShare: number; burstShare: number; why?: string } {
  const chunks = new Map<number, Map<string, number[]>>();
  let notes = 0, zero = 0;
  for (const r of rows) {
    const [start, end, midi, , name] = r;
    if (!isNum(start) || !isNum(end)) continue;
    notes++;
    if (end <= start) zero++;
    const k = Math.floor(start / LOOP_CHUNK_S);
    let chunk = chunks.get(k);
    if (!chunk) chunks.set(k, (chunk = new Map()));
    const key = `${String(name)}|${String(midi)}`;
    const starts = chunk.get(key);
    if (starts) starts.push(start);
    else chunk.set(key, [start]);
  }
  let bursts = 0;
  for (const chunk of chunks.values()) {
    if ([...chunk.values()].some((s) => isBurst(s.sort((a, b) => a - b)))) bursts++;
  }
  const zeroShare = notes ? zero / notes : 0;
  const burstShare = chunks.size ? bursts / chunks.size : 0;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  if (zeroShare >= LOOP_ZERO_SHARE) return { ok: false, zeroShare, burstShare, why: `${pct(zeroShare)} of its notes have no length` };
  if (burstShare >= LOOP_BURST_SHARE && bursts >= LOOP_BURST_MIN_CHUNKS) return { ok: false, zeroShare, burstShare, why: `one note repeats at a fixed rate in ${pct(burstShare)} of its ${LOOP_CHUNK_S} s chunks` };
  return { ok: true, zeroShare, burstShare };
}
