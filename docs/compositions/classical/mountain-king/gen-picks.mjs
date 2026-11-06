// Pick sets for Grieg, In the Hall of the Mountain King (songs/mountain-king, Karajan/BPO, 161.96 s), deterministic.
// Run: node docs/compositions/classical/mountain-king/gen-picks.mjs
//   -> writes picks.json next to this file: { "<set id>": { hears, rule, source, span, attacks, notes } }, notes
//      [start, end, midi, velocity] sorted by start, one note a line; prints each set's numbers (used in ANALYSIS.md).
//
// Note sources, in this order of preference:
//  - "roll": pack.tracks, the YourMT3+ instrument lanes. This is what the studio's note picker shows for this pack
//    (src/studio/ui/picker-logic.ts pickerNotes: tracks first), so these picks land on the roll. Velocities as the pack
//    has them (cycle 1 is 26-40: quiet, not rescaled). Identical (start, pitch) rows of two lanes (cello + strings,
//    the doubled rows at 131.08-131.46) are kept once, the louder.
//  - "pack": pack.notes that no lane has (the piano model's notes in YourMT3's gaps; the deep pizzicato B1/C#2 of the
//    first statement, the coda chords). The picker shows them as notes it cannot find on its roll.
//  - "audio": strokes the transcription does not have, measured from audio.mp3 with librosa (recipe below). Their time
//    is the onset, their pitch is nominal (said per set), velocity v = clamp(round(120 + 2 * peak dB), 20, 127).
//
// Audio recipe (C:/Users/maxim/.venvs/wa/Scripts/python.exe -I, librosa, sr 22050, hop 256, n_fft 2048):
//   onset_strength on the dB spectrogram, whole band, 20-200 Hz ("low") and 4-11 kHz ("hi"); rms in dB re the max;
//   onset_detect(delta 0.05, wait 3) -> ONSETS below; peak_pick on "low" (pre/post_max 10, avg 20, delta 4) -> blows;
//   peak_pick on "hi" (pre/post_max 8, pre_avg 30, post_avg 10, delta 1.2) with the 4-11 kHz energy jumping >= 8 dB
//   (>= 20 dB after 136 s) -> cymbal strokes. The numbers are copied in as literals so this file needs only node.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/mountain-king');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r3 = (x) => Math.round(x * 1e3) / 1e3 || 0;
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const audioVel = (db) => Math.max(20, Math.min(127, Math.round(120 + 2 * db)));

// ---------------- the notes ----------------
const FAM = { piano: 'keys', violin: 'str', viola: 'str', cello: 'str', contrabass: 'str', strings: 'str', voice: 'voice',
  horn: 'brass', trumpet: 'brass', brass: 'brass', oboe: 'wind', clarinet: 'wind', bassoon: 'wind' };
const rollMap = new Map();
for (const [tr, { notes }] of Object.entries(pack.tracks)) for (const [t, e, m, v] of notes) {
  const key = `${t}|${m}`, old = rollMap.get(key);
  if (!old || v > old.v) rollMap.set(key, { t, e, m, v, tr, f: FAM[tr] ?? 'oth', src: 'roll' });
}
const roll = [...rollMap.values()].sort((a, b) => a.t - b.t || a.m - b.m);
const onRoll = (n) => roll.some((x) => x.m === n[2] && Math.abs(x.t - n[0]) < 0.03);
const packOnly = pack.notes.filter((n) => !onRoll(n)).map(([t, e, m, v]) => ({ t, e, m, v, tr: 'pack', f: 'pack', src: 'pack' }));
const both = [...roll, ...packOnly].sort((a, b) => a.t - b.t || a.m - b.m);

// ---------------- the audio (literals, see the recipe above) ----------------
const ONSETS = [3.796,4.342,4.899,6.571,7.129,7.697,8.255,9.892,10.426,11.517,12.597,13.154,13.677,15.766,16.312,16.823,17.101,17.612,17.868,18.135,18.901,19.656,19.923,21.014,21.56,22.071,23.115,23.673,26.273,26.796,27.33,27.852,28.375,28.932,29.466,30.012,30.523,31.544,32.589,32.868,33.646,33.924,34.18,34.447,34.702,34.958,35.225,35.724,36.258,36.757,37.849,38.917,39.985,41.053,41.587,42.121,42.69,43.201,43.735,44.234,45.302,45.836,46.382,47.462,48.495,49.563,50.643,51.676,52.721,53.777,55.391,55.914,56.436,57.969,58.514,59.536,60.558,61.057,61.568,62.079,63.1,63.344,63.576,63.832,64.075,64.354,64.586,65.074,65.341,65.573,66.061,66.328,66.572,67.071,67.338,67.558,67.825,68.069,68.313,68.557,68.812,69.056,69.323,69.567,69.822,70.089,70.577,71.1,71.599,72.11,72.62,73.096,73.63,74.118,74.629,75.128,75.616,75.883,76.103,76.37,76.614,77.09,77.613,78.089,78.623,79.11,79.366,79.61,80.109,80.364,80.62,81.096,81.351,81.607,82.106,82.361,82.593,83.104,83.371,83.58,83.847,84.091,84.59,85.066,85.333,85.589,86.1,86.564,87.075,87.586,87.853,88.05,88.329,88.561,89.037,89.525,90.001,90.279,90.5,90.976,91.231,91.463,91.696,91.916,92.172,92.369,92.613,92.845,93.298,93.565,93.762,94.703,94.946,95.167,95.306,95.388,95.631,96.107,96.537,97.001,97.466,97.686,97.919,97.965,98.151,98.383,98.604,98.801,99.254,99.695,100.171,100.554,101.018,101.46,101.889,102.121,102.249,103.062,103.108,103.387,103.526,103.573,103.863,104.304,104.501,104.641,104.919,105.105,105.291,105.453,105.929,106.069,106.22,106.452,106.684,106.87,106.998,107.45,107.752,108.542,108.96,109.285,109.703,109.888,110.028,110.446,110.782,111.189,111.525,111.932,112.292,112.686,113.023,113.418,113.464,113.766,113.975,114.521,114.962,115.136,115.264,115.67,115.833,116.019,116.39,116.762,116.947,117.133,117.33,117.505,117.69,117.888,118.05,118.213,118.608,118.793,118.933,119.362,119.525,119.664,120.07,120.245,120.372,120.941,121.069,121.115,121.475,121.777,121.916,122.195,122.474,122.52,122.88,123.054,123.193,123.565,123.728,123.878,123.925,124.262,124.424,124.575,124.935,125.167,125.295,125.945,126.282,126.328,126.572,126.978,127.164,127.211,127.28,127.443,127.582,127.628,127.814,127.907,128.232,128.337,128.464,128.534,129.091,129.44,129.73,129.776,130.043,130.334,130.38,130.705,130.856,130.961,131.158,131.297,131.425,131.576,131.878,132.18,132.598,132.772,133.364,133.573,133.979,134.177,134.281,134.409,134.548,134.873,135.117,135.663,136.15,136.464,136.719,137.242,137.52,137.799,137.927,138.054,138.147,138.31,138.426,138.565,138.704,138.844,138.983,139.099,139.192,139.366,139.633,139.877,140.585,140.829,141.142,141.619,141.92,142.245,142.431,142.582,142.768,142.919,142.988,143.279,143.453,143.697,143.952,144.068,144.672,144.776,144.916,145.659,145.926,146.402,146.46,146.622,146.68,146.947,147.122,147.423,147.783,147.923,148.979,149.281,149.339,149.653,149.734,149.954];
/** The frenzy's cymbal strokes [time, peak dB], 101.9-135.7 s: 4-11 kHz energy jumps 8-17 dB about every 0.75 s. */
const CYMBAL_PULSE = [[101.9,-8.3],[102.27,-10.8],[103.06,-11.5],[103.86,-10.0],[104.66,-9.9],[105.48,-10.3],[106.23,-8.0],[107.01,-10.3],[107.78,-11.1],[108.56,-7.4],[109.31,-6.2],[110.04,-4.8],[110.82,-8.4],[111.54,-9.5],[112.3,-5.5],[113.05,-9.8],[113.78,-12.0],[114.56,-9.4],[115.3,-11.0],[116.04,-9.8],[116.78,-10.7],[117.52,-9.4],[118.25,-7.9],[118.94,-7.9],[120.41,-10.7],[121.13,-12.3],[121.79,-10.1],[122.49,-10.1],[123.22,-8.4],[123.89,-8.1],[124.61,-8.6],[125.97,-10.6],[126.57,-10.1],[127.81,-10.3],[128.48,-10.8],[129.11,-10.7],[131.0,-7.8],[131.62,-9.6],[132.2,-6.9],[132.81,-6.4],[133.39,-6.8],[133.99,-7.2],[134.57,-8.4],[135.13,-9.9],[135.69,-7.4]];
/** The coda's hammer blows [time, peak dB, jump dB]: 20-200 Hz onset peaks after a near-silence (-28 dB at 136.3). */
const BLOWS = [[136.46,-2.4,25.4],[139.62,-2.2,16.3],[140.59,0.0,26.5],[143.71,-1.5,16.0],[144.67,-2.4,23.6],[145.66,-3.8,23.3]];
/** The cymbal crash 0.25 s after each blow [time, peak dB, 4-11 kHz jump dB] (145.66 has none; 149.97 ends the piece). */
const CRASHES = [[136.72,-7.2,32.5],[139.89,-8.1,28.6],[140.84,-7.3,30.4],[143.98,-8.2,27.8],[144.94,-8.1,29.0],[149.97,-5.9,22.9]];
/** After the general pause (147.75-148.6, -28 to -32 dB): the last crescendo's strokes [time, peak dB]; 149.69 is the
    loudest moment of the recording's ending (-0.5 dB). Then decay: -24 dB at 150.5, -53 dB at 151.5, silence to 161.96. */
const FINAL_STROKES = [[148.98,-11.5],[149.31,-6.3],[149.69,-0.5]];

// ---------------- the theme grid ----------------
// The tune is two 2-bar units in B minor (A: B C# D E F# D F# | F C# F E C E; A2: B C# D E F# D F# B | A F# D F# A)
// and two in F# major (B = B2: F# G# A# B C# A# C# | D A# D C# A# C#), in eighths. A statement is A A2 A A2 | B B2 B B2 |
// A A2 A A2 (12 units, 24 bars); three statements, the last cut short at 130.6 s by the B-minor chord.
// Template: [eighth slot, pitch class, length in eighths].
const T = {
  A: [[0, 11, 1], [1, 1, 1], [2, 2, 1], [3, 4, 1], [4, 6, 1], [5, 2, 1], [6, 6, 2], [8, 5, 1], [9, 1, 1], [10, 5, 2], [12, 4, 1], [13, 0, 1], [14, 4, 2]],
  A2: [[0, 11, 1], [1, 1, 1], [2, 2, 1], [3, 4, 1], [4, 6, 1], [5, 2, 1], [6, 6, 1], [7, 11, 1], [8, 9, 1], [9, 6, 1], [10, 2, 1], [11, 6, 1], [12, 9, 4]],
  B: [[0, 6, 1], [1, 8, 1], [2, 10, 1], [3, 11, 1], [4, 1, 1], [5, 10, 1], [6, 1, 2], [8, 2, 1], [9, 10, 1], [10, 2, 2], [12, 1, 1], [13, 10, 1], [14, 1, 2]],
};
T.B2 = T.B;
// Unit starts by ear and eye (low-band onset peaks, the head search), each refitted below, and the register the tune is
// heard in there [lo, hi] (midi): the octave of the instrument that carries it. The last entry ends the grid.
const LOWPIZZ = [33, 52], BSN = [44, 62], MID = [50, 66], VLN = [64, 92], WINDS = [57, 90], TUTTI = [68, 100];
const PLAN = [
  [3.7, 'A', LOWPIZZ], [8.1, 'A2', LOWPIZZ], [12.5, 'A', BSN], [16.7, 'A2', BSN], [20.9, 'B', MID], [25.1, 'B2', MID], [29.35, 'B', MID], [33.55, 'B2', MID],
  [37.7, 'A', LOWPIZZ], [41.9, 'A2', LOWPIZZ], [46.2, 'A', BSN], [50.5, 'A2', BSN],
  [54.9, 'A', VLN], [58.9, 'A2', VLN], [62.95, 'A', WINDS], [66.95, 'A2', WINDS], [70.95, 'B', VLN], [75.0, 'B2', VLN], [79.0, 'B', VLN], [82.95, 'B2', VLN],
  [86.95, 'A', VLN], [90.9, 'A2', VLN], [94.6, 'A', VLN], [98.25, 'A2', VLN],
  [101.85, 'A', TUTTI], [104.95, 'A2', TUTTI], [108.1, 'A', TUTTI], [111.1, 'A2', TUTTI], [114.1, 'B', TUTTI], [117.0, 'B2', TUTTI], [119.9, 'B', TUTTI], [122.8, 'B2', TUTTI],
  [125.6, 'A', TUTTI], [128.3, 'A2', TUTTI], [130.6, 'end'],
];
const tolOf = (d) => Math.max(0.05, d * 0.3);
const pc = (m) => ((m % 12) + 12) % 12;
/** The note heard at a slot: the right pitch class within the tolerance; inside the unit's register (else within an
    octave of it); the roll before the pack; then the pitch nearest the expected one (the previous note plus the tune's
    interval), then the longer, then the louder. */
function matchSlot(te, p, d, reg = [0, 127], expect = null) {
  const tol = tolOf(d);
  const cand = both.filter((x) => Math.abs(x.t - te) < tol && pc(x.m) === p && x.m >= reg[0] - 12 && x.m <= reg[1] + 12);
  if (!cand.length) return null;
  const inReg = cand.filter((x) => x.m >= reg[0] && x.m <= reg[1]);
  // outside the register only next to the tune's expected pitch (or its octave slip): never the accompaniment far off
  let pool = inReg.length ? inReg : expect === null ? [] : cand.filter((x) => Math.abs(x.m - expect) <= 13);
  if (!pool.length) return null;
  if (pool.some((c) => c.src === 'roll')) pool = pool.filter((c) => c.src === 'roll');
  const ref = expect ?? (reg[0] + reg[1]) / 2;
  const key = (c) => [Math.abs(c.m - ref), -(c.e - c.t), -c.v];
  return pool.reduce((a, c) => { const ka = key(a), kc = key(c); for (let i = 0; i < 3; i++) { if (kc[i] < ka[i] - 1e-9) return c; if (kc[i] > ka[i] + 1e-9) return a; } return a; });
}
const step = (from, to) => { const x = (((to - from) % 12) + 12) % 12; return x > 6 ? x - 12 : x; };
/** One unit's notes, slot by slot, each slot expecting the previous note plus the tune's interval. */
function unitNotes(t0, d, tpl, reg) {
  const out = []; let prev = null, prevPc = null;
  for (const [k, p, len] of tpl) {
    const expect = prev ? prev.m + step(prevPc, p) : null;
    const n = matchSlot(t0 + k * d, p, d, reg, expect);
    if (n) { out.push({ n, k, len }); prev = n; prevPc = p; } else if (prev) { prev = { m: prev.m + step(prevPc, p) }; prevPc = p; }
  }
  return out;
}
function fitScore(t0, d, tpl, reg) { let s = 0; for (const [k, p] of tpl) if (matchSlot(t0 + k * d, p, d, [reg[0] - 12, reg[1] + 12])) s++; return s; }
const UNITS = [];
for (let i = 0; i < PLAN.length - 1; i++) {
  const [t, k, reg] = PLAN[i], d0 = (PLAN[i + 1][0] - t) / 16;
  let best = { sc: -1 };
  for (let t0 = t - 0.3; t0 <= t + 0.3001; t0 += 0.01) for (let d = d0 * 0.9; d <= d0 * 1.1; d += 0.002) {
    const sc = fitScore(t0, d, T[k], reg);
    if (sc > best.sc || (sc === best.sc && Math.abs(t0 - t) < Math.abs(best.t0 - t))) best = { sc, t0, d };
  }
  const cycle = t < 54.8 ? 1 : t < 101.8 ? 2 : 3;
  UNITS.push({ i: i + 1, k, cycle, reg, t0: r3(best.t0), d: r3(best.d), score: best.sc, of: T[k].length });
}
// The melody, slot by slot: the matched note of each template slot.
const melody = [];
for (const u of UNITS) {
  const got = unitNotes(u.t0, u.d, T[u.k], u.reg);
  u.got = got.length;
  for (const { n, k, len } of got) melody.push({ ...n, unit: u, slot: k, len, key: u.k[0] });
}
const MEL = new Set(melody.map((n) => `${n.t}|${n.m}`));
const isMel = (n) => MEL.has(`${n.t}|${n.m}`);

// ---------------- helpers ----------------
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) { if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; cur.vmax = Math.max(cur.vmax, n.v); } else { cur = { t: n.t, ns: [n], top: n, low: n, vmax: n.v }; out.push(cur); } }
  return out;
}
const inWin = (src, a, b, f = () => true) => src.filter((n) => n.t >= a && n.t < b && f(n));
/** Same pitch struck again within `gap` s: runs of >= `min` attacks. */
function repeatsOf(ns, gap = 0.22, min = 3) {
  const out = [], byM = new Map();
  for (const n of ns) { const l = byM.get(n.m); if (l) l.push(n); else byM.set(n.m, [n]); }
  for (const l of byM.values()) { let run = [l[0]]; for (let i = 1; i <= l.length; i++) { if (i < l.length && l[i].t - l[i - 1].t <= gap) run.push(l[i]); else { if (run.length >= min) out.push(...run); run = [l[i]]; } } }
  return out;
}
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t + 0.01)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];
const audioNote = (t, dur, m, db) => ({ t, e: t + dur, m, v: audioVel(db), src: 'audio' });

const sets = [];
function add(id, hears, rule, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set(); notes = notes.filter((n) => { const k = `${r4(n.t)}|${n.m}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const srcs = [...new Set(notes.map((n) => n.src))].sort();
  sets.push({ id, hears, rule, source: srcs.join('+'), attacks: clusters(notes).length, notes });
}
const U = (from, to) => (n) => n.unit.t0 >= from && n.unit.t0 < to;

// ================= the sets =================
// --- the theme, as one strand and by its parts ---
add('theme', 'The tune itself, every note of all 34 phrase units (3.7-130.6 s): tiptoeing pp in the low strings and bassoons, then up through the winds and violins, faster and louder, to the tutti. One note per eighth slot of the tune: the doubled octaves are one note.',
  'the unit grid (see ANALYSIS) refitted per unit; per template slot the note of the right pitch class within max(0.05, 0.3 d) of the slot, roll before pack, then loudest, then highest; unmatched slots left out',
  melody);
add('theme-minor', 'The B-minor half of the tune (the A units: B C# D E F# D F# | F C# F E C E and the B ... A F# D F# A answer): 0-20.9, 37.7-71.0, 87.0-114.1, 125.6-130.6 s.',
  'theme notes of the A and A2 units', melody.filter((n) => n.key === 'A'));
add('theme-major', 'The F#-major half of the tune (F# G# A# B C# A# C# | D A# D C# A# C#): 20.9-37.7, 71.0-87.0, 114.1-125.6 s. Brighter, higher.',
  'theme notes of the B and B2 units', melody.filter((n) => n.key === 'B'));
add('theme-climbs', 'The climbing first bar of every unit (B C# D E F# D F#, or F# G# A# B C# A# C#): the creep up the stairs, 7-8 notes, then a gap.',
  'theme notes in slots 0-7 of each unit', melody.filter((n) => n.slot < 8));
add('theme-answers', 'The second bar of every unit, the answer (F C# F E C E, the A F# D F# A sigh, D A# D C# A# C#): the trolls turning round.',
  'theme notes in slots 8-15 of each unit', melody.filter((n) => n.slot >= 8));
add('phrase-entries', 'Every entry of the motif: the first note of each 2-bar unit, a stroke every 4.2 s at the start, every 2.9 s in the frenzy (34 units; the clock the accelerando really keeps).',
  'theme note in slot 0 of each unit; where the transcription has none, the audio onset within 0.08 s of the fitted unit start (pitch: the lowest B or F# in the register of the unit, nominal; velocity 96 = -12 dB)',
  UNITS.map((u) => {
    const n = melody.find((x) => x.unit === u && x.slot === 0);
    if (n) return n;
    const o = ONSETS.find((t) => Math.abs(t - u.t0) < 0.08);
    if (!o) return null;
    let m = u.reg[0]; while (pc(m) !== (u.k[0] === 'A' ? 11 : 6)) m++;
    return audioNote(o, u.d * 2, m, -12);
  }).filter(Boolean));
add('theme-landings', 'Where each run lands and holds: the quarter and half notes of the tune (F#, F, E, the long A; C#, D, C#). The stresses of the march, about two a bar.',
  'theme notes of slots whose template length is >= 2 eighths', melody.filter((n) => n.len >= 2));
add('long-a-sighs', 'The longest notes of the tune: the held A (a half note) that closes every A2 unit, 1 s long in the first statement, shorter later. The only long slow notes before the coda.',
  'per A2 unit before 101.85 s: the longest A (any lane, roll before pack) starting within 0.12 s of slot 12, in the unit register +- 12, length >= 0.4 s',
  UNITS.filter((u) => u.k === 'A2' && u.cycle < 3).map((u) => {
    const te = u.t0 + 12 * u.d;
    const c = both.filter((x) => Math.abs(x.t - te) < 0.12 && pc(x.m) === 9 && x.m >= u.reg[0] - 12 && x.m <= u.reg[1] + 12 && x.e - x.t >= 0.4);
    return c.length ? c.reduce((a, x) => ((x.src === 'roll') > (a.src === 'roll') || ((x.src === 'roll') === (a.src === 'roll') && x.e - x.t > a.e - a.t) ? x : a)) : null;
  }).filter(Boolean));

// --- the tune by its carriers (who you hear playing it) ---
add('theme-pizz-basses', 'The first statement, pp: cellos and double basses pizzicato tiptoeing the tune in the dark (B1-B2), under the horn pedal; and their return at 37.7 s. The literal footsteps.',
  'theme notes of units 1-2 (3.7-12.5 s) and 9-10 (37.7-46.2 s)', melody.filter((n) => U(3, 12.4)(n) || U(37.6, 46.1)(n)));
add('theme-bassoons', 'The bassoons take the tune (B2-B3), sneaking, staccato: 12.5-20.9 s, again with clarinet and horn in the F# half at 29.4-37.7 s, and at 46.2-54.9 s.',
  'theme notes of units 3-4, 7-8 and 11-12', melody.filter((n) => U(12.4, 20.8)(n) || U(29.3, 37.6)(n) || U(46.1, 54.8)(n)));
add('theme-low-strings-f-sharp', 'Violas and cellos, still pp, carry the first F#-major half (F#2-C#4), 20.9-29.4 s.',
  'theme notes of units 5-6', melody.filter(U(20.8, 29.3)));
add('theme-violins-enter', 'The second statement opens two octaves up, light and dry: the violins and the strings section (B4-F#5) over soft repeated B-minor chords, 54.9-63.0 s.',
  'theme notes of units 13-14', melody.filter(U(54.8, 62.9)));
add('theme-winds', 'Oboe, clarinet and bassoon in octaves take the B-minor half (B3-B5), 63.0-71.0 s: reedy, a little louder.',
  'theme notes of units 15-16', melody.filter(U(62.9, 70.9)));
add('theme-strings-rising', 'The F#-major half and the B-minor return in the strings, everyone joining, crescendo and accelerando (71.0-101.85 s; 87-101.85 s is the big push).',
  'theme notes of units 17-24', melody.filter(U(70.9, 101.8)));
add('theme-tutti', 'The frenzy: full orchestra, ff, the tune in the violins on top (B5-F#6) over cymbals, 101.85-130.6 s. The transcription catches it in part: see the unit scores.',
  'theme notes of units 25-34', melody.filter(U(101.8, 130.6)));

// --- what goes on under and around the tune ---
add('pizz-footsteps', 'The pizzicato accompaniment under the tune in statements 1-2: short low plucks (below D3) that are not the tune, the trolls\' footfalls on the beat.',
  'roll notes of the cello, contrabass and strings lanes and pack notes, 3.7-101.85 s, midi < 50, length <= 0.6 s, not a theme note; the lowest of each 40 ms cluster, a pitch repeated within 0.15 s dropped',
  (() => { const out = []; for (const c of clusters(inWin(both, 3.7, 101.85, (n) => n.m < 50 && n.e - n.t <= 0.6 && !isMel(n) && ['cello', 'contrabass', 'strings', 'pack'].includes(n.tr)))) { const p = out[out.length - 1]; if (p && p.m === c.low.m && c.t - p.t < 0.15) continue; out.push(c.low); } return out; })());
add('stamping-bass', 'The bass of the frenzy, ff (cellos, basses, timpani in the low band): the lowest note of each loud attack below C3, 101.85-136.0 s.',
  'roll+pack clusters 101.85-136 s; the lowest note if it is < 48 and velocity >= 60',
  clusters(inWin(both, 101.85, 136, (n) => n.m < 48 && n.v >= 60)).map((c) => c.low));
add('frenzy-tremolo', 'The strings\' tremolo and repeated notes of the frenzy: one pitch hammered 3+ times (the held F#5 at 119.2-120.1, the A tremolo at 129.35-130.9, the B-minor chord at 131.1). Glitter, not tune.',
  'roll notes 101.85-136 s, midi >= 60, the same pitch again within 0.22 s, runs of 3 or more; the top of each 40 ms cluster',
  clusters(repeatsOf(inWin(roll, 101.85, 136, (n) => n.m >= 60)).sort((a, b) => a.t - b.t)).map((c) => c.top));
add('cymbal-pulse', 'The cymbal strokes of the frenzy, about every 0.75 s (two to a bar), 101.9-135.7 s: the transcription has none of them. A steady metallic pulse from the downbeat of statement 3.',
  'audio: 4-11 kHz onset peaks with a >= 8 dB jump, 101.4-135.8 s; pitch B6 (95) nominal, length 0.2 s, velocity from dB',
  CYMBAL_PULSE.map(([t, db]) => audioNote(t, 0.2, 95, db)));

// --- the family lanes (the roll's own labels: honest only as YourMT3+ heard them) ---
add('bassoon-lane', 'Everything the bassoon lane has (B1-D4): the tune in statement 1, the low winds\' pedal and answers in statement 2.',
  'roll, track bassoon; the top of each 40 ms cluster (octave doubles are one attack)', clusters(roll.filter((n) => n.tr === 'bassoon')).map((c) => c.top));
add('reeds-lane', 'Oboe and clarinet lanes: thin, nasal, mostly statement 1-2 (10-100 s), the clarinet\'s held chords at 10.4 s, the oboe octaves at 60-70 s; and a mislabelled tutti blast at 144 s left out.',
  'roll, tracks oboe and clarinet, before 140 s; the top of each 40 ms cluster', clusters(roll.filter((n) => (n.tr === 'oboe' || n.tr === 'clarinet') && n.t < 140)).map((c) => c.top));
add('violins-high', 'The violins above C5 (and the strings section there): the tune\'s top line from 56 s, glittering at the top of the frenzy (to C#7).',
  'roll, tracks violin and strings, midi >= 72; the top of each 40 ms cluster', clusters(roll.filter((n) => (n.tr === 'violin' || n.tr === 'strings') && n.m >= 72)).map((c) => c.top));
add('low-strings-lane', 'Cellos and basses (and the strings section below D3): pizzicato under statements 1-2, then the sawing bass of the frenzy.',
  'roll, tracks cello, contrabass and strings, midi < 50; the lowest of each 40 ms cluster',
  clusters(roll.filter((n) => (n.tr === 'cello' || n.tr === 'contrabass' || n.tr === 'strings') && n.m < 50)).map((c) => c.low));
add('brass-lane', 'Brass, horn and trumpet lanes: a few horn notes in statement 1 (30-33 s), then brass blasts in the frenzy (100-131 s). Sparse: 95 notes in all.',
  'roll, tracks brass, horn and trumpet, before 140 s (the trumpet lane at 144 s is the tutti blows, mislabelled); the top of each 40 ms cluster',
  clusters(roll.filter((n) => (n.tr === 'brass' || n.tr === 'horn' || n.tr === 'trumpet') && n.t < 140)).map((c) => c.top));

// --- the break and the coda ---
add('break-chord', 'The tune snaps off: a B-minor chord hammered ff in tremolo, 131.08-133.1 s (cellos B2, violins B4 D5 D6). The first time the music stands still.',
  'roll notes 131.0-131.1 s (the first attack) and those starting 131.4-131.5 s that last >= 1 s (the chord held to 133.1 s); the tremolo strokes between are in frenzy-tremolo',
  [...inWin(roll, 131.0, 131.1), ...inWin(roll, 131.4, 131.5, (n) => n.e - n.t >= 1)]);
add('break-turn', 'After the chord, a turning figure in octaves, C# D E D C# B (133.18-134.1 s), then B hammered to the crash at 135.3 s.',
  'roll clusters 133.1-134.7 s; the top of each, a pitch repeated within 0.2 s dropped',
  (() => { const out = []; for (const c of clusters(inWin(roll, 133.1, 134.7))) { const p = out[out.length - 1]; if (p && p.m === c.top.m && c.t - p.t < 0.2) continue; out.push(c.top); } return out; })());
add('ff-blows', 'The hammer blows of the coda: six fff tutti strokes, each out of a near-silence (136.46, 139.62, 140.59, 143.71, 144.67, 145.66 s), then the final chord (149.69 s). The only real ff blows of the piece: the Fireworks set.',
  'audio: 20-200 Hz onset peaks after 130 s with a peak >= -6 dB and a jump >= 15 dB, plus the loudest stroke of the final crescendo; pitch B1 (35) nominal (the transcription reads the bass drum as E1/A#1); length 0.4 s; velocity from dB',
  [...BLOWS, [149.69, -0.5]].map(([t, db]) => audioNote(t, 0.4, 35, db)));
add('coda-crashes', 'The cymbal crash a quarter second after each blow (136.72, 139.89, 140.84, 143.98, 144.94 s) and the last crash at 149.97 s: the splash after the hammer.',
  'audio: 4-11 kHz onset peaks after 136 s with a >= 20 dB jump, the final crescendo\'s own strokes left out; pitch B6 (95) nominal, length 0.5 s, velocity from dB',
  CRASHES.map(([t, db]) => audioNote(t, 0.5, 95, db)));
add('coda-chords', 'The blows as the transcription has them: the low tutti chords at 136.43, 139.58, 140.55, 143.67, 144.64, 145.62 s, whole (E1-F2, the timpani and basses).',
  'pack clusters 136-146 s within 0.1 s of a BLOWS time, whole', both.filter((n) => n.t >= 136 && n.t < 146 && BLOWS.some(([t]) => Math.abs(n.t - t) < 0.1)));
add('stretta-runs', 'Between the blows the tune runs on at double speed, f then hushed (137.2-139.4 s and 141.5-143.5 s): B C# D E F# ... scurrying.',
  'roll+pack clusters 136.9-139.5 s and 140.95-143.6 s, velocity >= 40; the top of each',
  clusters([...inWin(both, 136.9, 139.5), ...inWin(both, 140.95, 143.6)].filter((n) => n.v >= 40)).map((c) => c.top));
add('held-breath', 'After the last blow: a hushed diminished chord (F G# D) repeated five times, 145.9-146.9 s, rising to D/B at 147.1-147.4 s, then the general pause (147.75-148.6 s, -30 dB).',
  'roll+pack notes 145.85-147.5 s, whole', inWin(both, 145.85, 147.5));
add('final-strokes', 'Out of the general pause, the last crescendo: three strokes louder and louder (148.98, 149.31, 149.69 s), the final chord, then the crash at 149.97 s and nothing (silent by 151.5 s).',
  'audio onsets of the final crescendo; pitch B1 (35) nominal for the strokes, B6 (95) for the crash; velocity from dB',
  [...FINAL_STROKES.map(([t, db]) => audioNote(t, 0.3, 35, db)), audioNote(149.97, 0.6, 95, -5.9)]);
add('opening-pedal', 'Before the tune: the horns\' soft held note out of silence (one F#4 in the pack, 1.02-3.77 s, v16). A deliberate, spare entrance.',
  'pack note 1.0-1.1 s', inWin(packOnly, 1.0, 1.1));

// ---------------- checks and output ----------------
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const out = {};
sets.sort((a, b) => a.notes[0].t - b.notes[0].t || a.id.localeCompare(b.id));
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  if (out[s.id]) throw new Error(`${s.id} twice`);
  const notes = s.notes.map(asTuple);
  for (let i = 1; i < notes.length; i++) if (notes[i][0] < notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of notes) if (!(n[1] > n[0]) || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127 || n[0] < 0 || n[1] > pack.duration) throw new Error(`${s.id} bad note ${n}`);
  out[s.id] = { hears: s.hears, rule: s.rule, source: s.source, span: [notes[0][0], r3(Math.max(...notes.map((n) => n[1])))], attacks: s.attacks, notes };
}
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]')
  .replace(/"span": \[\s+([-\d.]+),\s+([-\d.]+)\s+\]/g, '"span": [$1, $2]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');

if (process.argv.includes('--units')) for (const u of UNITS) console.log(`unit ${String(u.i).padStart(2)} c${u.cycle} ${u.k.padEnd(2)} ${u.t0.toFixed(2)} eighth ${u.d.toFixed(3)} bar ${(u.d * 8).toFixed(2)} ${u.score}/${u.of} got ${u.got} reg ${u.reg} first ${melody.filter((n) => n.unit === u).slice(0, 8).map((n) => nm(n.m)).join(' ')}`);
for (const s of sets) {
  const ns = s.notes, lab = {};
  for (const n of ns) lab[n.tr ?? n.src] = (lab[n.tr ?? n.src] || 0) + 1;
  console.log(`${s.id.padEnd(26)} ${String(s.attacks).padStart(4)} att ${String(ns.length).padStart(4)} notes ${ns[0].t.toFixed(2)}-${Math.max(...ns.map((n) => n.e)).toFixed(2)} ${s.source.padEnd(15)} ${ns.slice(0, 12).map((n) => nm(n.m)).join(' ')} | ${Object.entries(lab).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' ')}`);
}
console.log(sets.length, 'sets');
