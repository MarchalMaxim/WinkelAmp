// Pick sets for Stravinsky's Firebird, Berceuse and Finale (songs/firebird-berceuse-finale), deterministic.
// Run: node docs/compositions/classical/firebird-berceuse-finale/gen-picks.mjs
//   -> writes picks.json next to this file: { "<set id>": { "hears": "...", "notes": [[start, end, midi, velocity], ...] } }
//      and prints each set's notes, attacks, span and first pitches (the numbers in ANALYSIS.md).
//
// Note sources.
// - "roll": the note picker's roll for this pack, which is pack.tracks (YourMT3+'s nine labelled tracks, velocities as
//   the pack has them: src/studio/ui/picker-logic.ts pickerNotes, tracks branch). YourMT3+ often writes one note on
//   several tracks at once (violin + viola + cello on the same start and pitch); a set keeps one of them.
// - "audio": where the transcription is thin (coverage 34 %), notes come from the recording itself, measured once with
//   librosa and frozen below in AUDIO (the Python is at the end of this file). Velocity from the loudness of the moment:
//   v = clamp(round(122 + 3 * dB), 20, 122), dB relative to the loudest moment of the recording (0 dB -> 122, -10 -> 92,
//   -20 -> 62, -30 -> 32). Audio notes are not on the picker's roll (it shows them as picks it cannot find): they play
//   all the same.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/firebird-berceuse-finale');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const vel = (db) => Math.max(20, Math.min(122, Math.round(122 + 3 * db)));

const AUDIO = {
  // rocking: [start, end, midi, velocity] in the Ab3-C4 band (audio-picks.py part 1)
  rock: [[6.629,7.523,58,60],[7.349,8.58,56,27],[8.615,9.706,58,42],[9.451,10.751,59,20],[10.809,11.355,58,38],[11.877,12.875,56,32],[12.922,14.025,58,28],[13.874,15.105,59,29],[15.244,16.196,58,29],[16.184,16.927,56,39],[17.206,18.506,58,36],[18.506,19.423,59,37],[19.505,20.526,58,40],[20.55,21.641,56,57],[21.873,22.872,58,43],[22.802,24.52,59,39],[24.451,25.252,58,48],[25.17,27.121,56,48],[27.191,27.655,58,35],[27.643,28.723,59,41],[29.083,29.838,58,34],[29.872,31.033,56,59],[31.196,32.206,58,34],[32.09,33.657,59,36],[33.924,34.83,58,58],[34.911,36.026,59,52],[36.049,36.769,60,42],[37.082,38.371,59,40],[38.104,40.159,58,29],[40.24,40.635,59,42],[40.623,41.889,60,41],[41.738,43.108,59,37],[43.154,44.234,58,47],[44.176,46.579,58,53],[46.521,47.624,59,49],[47.659,48.808,58,46],[48.681,49.459,56,48],[49.18,51.188,58,50],[51.235,52.349,59,36],[52.384,53.522,58,47],[53.58,54.671,56,52],[54.52,55.821,58,50],[55.879,56.993,59,40],[57.028,58.201,58,40],[58.247,59.397,56,54],[59.431,60.697,58,41],[60.743,62.055,59,39],[61.858,63.263,58,52],[63.24,64.342,59,54],[64.284,65.178,60,48],[65.086,66.699,59,48],[66.699,67.976,58,61],[67.942,69.068,59,52],[68.963,70.101,60,45],[70.113,71.355,59,39],[71.401,72.62,58,54],[72.957,74.141,59,53],[73.932,75.07,56,58],[75.221,76.011,58,58],[76.382,77.555,56,54],[77.706,78.658,57,41],[78.449,79.598,58,30],[109.877,119.269,58,64],[119.025,120.419,56,48],[120.512,121.661,58,50],[121.684,122.683,59,50],[122.717,123.809,58,48],[123.844,124.912,56,61],[124.807,126.2,58,54],[126.247,127.594,59,54],[127.303,128.43,58,40],[128.232,129.149,56,49],[128.917,129.95,58,56],[130.148,130.694,58,64],[130.763,132.029,59,52],[131.773,133.12,58,51],[133.178,133.875,56,61],[134.084,135.663,58,54],[135.396,136.847,59,50],[136.916,138.043,58,44],[138.112,139.006,56,59],[139.053,140.574,58,52],[140.434,141.444,59,48],[141.468,142.617,58,63],[142.652,143.708,56,59],[143.79,144.997,58,61],[144.869,146.274,59,50],[146.321,147.447,58,42],[147.435,148.538,56,64],[149.084,149.885,58,58],[149.838,151.034,59,48],[151.51,152.276,58,49],[152.323,153.484,56,67],[153.542,153.995,58,49],[154.204,154.726,58,45],[154.784,156.154,59,44],[156.189,157.431,58,41],[157.269,158.523,59,50],[158.523,159.742,60,47],[159.777,161.123,59,48],[161.158,162.319,58,51],[162.273,163.492,59,50],[163.318,164.734,60,44],[164.664,165.872,59,42],[165.895,167.253,58,40],[167.172,168.356,59,53],[168.426,169.192,60,55],[169.506,170.458,59,49],[170.806,171.862,60,46],[171.944,173.662,59,45],[173.883,182.01,58,29],[182.021,184.123,59,40],[183.972,185.562,58,29],[185.771,191.379,58,27],[191.402,193.608,59,42]],
  // strokes: [onset s, peak dB re the loudest moment, three strongest pitch classes] (part 2), only 109-119, 172-230 and 316-414 s
  onsets: [[110.388,-20,[10,9,5]],[111.34,-19.9,[8,6,9]],[112.408,-20.4,[2,3,1]],[113.453,-21.4,[8,9,10]],[114.544,-21.9,[2,8,7]],[115.612,-22.2,[6,8,2]],[116.773,-24.9,[2,8,9]],[118.306,-21.9,[10,3,9]],[174.359,-25.5,[3,10,2]],[182.021,-27.3,[11,10,0]],[184.227,-23.9,[10,11,9]],[185.458,-30.9,[10,3,4]],[188.941,-33.8,[3,2,4]],[191.379,-26.7,[11,10,0]],[193.654,-28,[10,3,11]],[213.786,-38.6,[1,0,2]],[216.851,-38.5,[0,1,11]],[225.21,-39.8,[0,2,5]],[226.789,-30.8,[6,7,5]],[227.532,-29.9,[6,7,5]],[228.066,-26.6,[6,7,5]],[316.233,-5.7,[6,7,5]],[317.486,-5.7,[6,7,8]],[322.084,-26.4,[11,10,0]],[324.127,-2.6,[11,0,10]],[324.545,-5.7,[6,0,11]],[324.917,-6.4,[0,6,11]],[325.242,-8.1,[6,11,0]],[325.59,-7.3,[6,0,7]],[325.915,-7.7,[0,1,6]],[326.264,-8.9,[6,11,8]],[326.612,-6.7,[4,6,5]],[326.96,-9.7,[6,0,11]],[327.285,-7,[0,6,1]],[327.634,-8.3,[4,0,6]],[327.982,-9.2,[6,11,0]],[328.33,-9.6,[6,0,11]],[328.655,-9.3,[1,0,6]],[329.004,-3.5,[11,0,10]],[329.375,-5.4,[6,11,0]],[329.747,-6,[11,0,6]],[330.072,-9.1,[6,0,11]],[330.42,-6.9,[6,7,5]],[330.768,-7.9,[6,0,1]],[331.117,-9,[6,0,11]],[331.442,-8.3,[0,11,4]],[331.79,-9.3,[0,11,6]],[332.138,-7.7,[1,0,6]],[332.487,-7.7,[0,6,11]],[332.812,-9.4,[6,0,11]],[333.16,-8.5,[9,4,10]],[333.508,-6.1,[9,10,8]],[333.903,-6.1,[2,3,7]],[334.251,-4,[7,8,6]],[334.6,-6,[7,2,6]],[334.925,-8.1,[4,7,3]],[335.273,-7.1,[7,8,0]],[335.598,-9.2,[7,8,2]],[335.946,-8.3,[7,8,0]],[336.271,-4.8,[7,8,3]],[336.62,-4.6,[7,8,6]],[336.968,-7.5,[7,2,6]],[337.293,-8.1,[4,7,8]],[337.641,-7.3,[7,8,2]],[337.99,-8.8,[7,8,2]],[338.315,-8.6,[0,7,8]],[338.663,-5.1,[7,8,3]],[339.011,-6.6,[7,8,6]],[339.383,-8.2,[2,7,5]],[339.708,-8,[7,4,8]],[339.754,-8,[7,4,2]],[340.056,-8.7,[7,8,0]],[340.428,-9.8,[7,2,8]],[340.776,-8.6,[7,9,8]],[341.101,-7.5,[5,6,7]],[341.496,-8.4,[7,4,8]],[341.821,-9.4,[7,8,2]],[342.169,-8.9,[7,5,6]],[342.518,-9.6,[7,8,4]],[342.843,-8.3,[7,0,8]],[343.586,-4.2,[7,2,3]],[344.956,-8.9,[7,6,4]],[345.35,-9.5,[7,0,8]],[345.652,-8.9,[7,8,2]],[346.047,-5.9,[4,5,3]],[346.372,-5.8,[4,0,7]],[346.419,-5.8,[4,0,7]],[346.79,-6.4,[5,4,3]],[347.115,-7,[4,5,3]],[347.44,-8,[7,8,4]],[347.487,-8,[7,8,9]],[347.812,-9.1,[8,7,2]],[348.183,-9.1,[0,4,8]],[348.555,-0.3,[5,6,4]],[349.321,-3.8,[6,5,10]],[350.087,-4.4,[6,3,4]],[350.807,-4.9,[6,7,5]],[351.504,-3.9,[6,5,7]],[351.55,-3.9,[6,5,7]],[352.223,-5.9,[6,4,1]],[352.92,-6.7,[6,7,4]],[353.617,-3.6,[11,0,10]],[354.29,-5.9,[11,0,6]],[354.987,-5.7,[11,0,10]],[355.033,-5.3,[11,0,10]],[355.381,-7.5,[11,0,10]],[355.683,-4.3,[11,8,0]],[356.38,-4.6,[6,7,5]],[357.076,-7.3,[6,7,5]],[357.82,-4.2,[6,5,7]],[358.609,0,[11,0,6]],[359.282,-3.4,[11,10,6]],[359.329,-3.3,[11,6,10]],[360.049,-4.9,[11,0,8]],[360.768,-5.2,[6,7,5]],[361.465,-4.6,[6,5,7]],[362.115,-5.6,[6,5,4]],[362.185,-5.6,[6,5,1]],[362.858,-5,[6,5,7]],[363.601,-3.1,[11,0,10]],[364.298,-5.8,[11,0,10]],[365.018,-5.6,[11,0,1]],[366.481,-4.9,[6,7,5]],[367.177,-5.7,[6,7,5]],[367.874,-6.1,[6,5,4]],[368.64,-4.7,[11,0,10]],[368.71,-4.7,[11,0,10]],[369.36,-3.1,[11,10,0]],[370.776,-5.1,[6,4,8]],[372.262,-4,[11,0,10]],[373.005,-3.8,[11,0,4]],[373.818,-3.6,[6,5,4]],[374.654,-2.6,[11,0,10]],[375.467,-3.8,[6,5,4]],[376.303,-3.5,[11,0,8]],[377.185,-5.3,[6,7,5]],[378.091,-3.8,[11,0,10]],[379.112,-4.3,[6,5,7]],[380.761,-0.9,[11,4,0]],[388.748,-6.7,[0,7,1]],[390.908,-7.7,[1,8,0]],[394.414,-4.6,[0,5,11]],[396.341,-6,[1,8,0]],[396.434,-6,[1,8,0]],[398.547,-7.9,[0,7,11]],[402.402,-20.4,[11,6,10]],[402.773,-17.7,[11,0,10]],[403.006,-16.9,[11,0,6]],[403.423,-14.9,[11,0,6]],[405.606,-9.3,[11,0,6]],[412.619,-0.7,[11,6,4]],[412.711,-1.9,[11,0,6]]],
  // the horn solo segmented from the CQT, band G3-Bb4: [start, end, midi, peak dB] (seg.py)
  horn: [[226.696,229.111,66,-32],[229.111,230.226,64,-27.9],[230.226,230.922,63,-25.3],[230.922,231.503,66,-26.3],[231.503,232.629,61,-26.2],[232.629,233.651,59,-29.4],[233.709,235.578,64,-30.8],[235.578,236.159,63,-26],[236.182,236.936,61,-27.8],[236.936,237.366,64,-27],[237.366,238.167,63,-26.2],[238.19,238.585,59,-31.3],[238.585,241.058,61,-29],[241.337,244.1,66,-39],[244.123,245.191,64,-29],[245.191,245.806,63,-27.1],[245.806,246.457,66,-25.7],[246.735,247.571,61,-33.1],[247.571,248.57,59,-29.8],[248.593,250.195,64,-30.6],[250.195,250.799,63,-27.4],[250.81,251.553,61,-28.5],[251.553,251.948,64,-28],[251.948,252.529,63,-26.7]],
};

// ---- the roll ----
const ORDER = ['piano', 'violin', 'viola', 'cello', 'strings', 'voice', 'horn', 'clarinet', 'bassoon'];
const FAM = { piano: 'keys', violin: 'str', viola: 'str', cello: 'str', strings: 'str', voice: 'wind', horn: 'wind', clarinet: 'wind', bassoon: 'wind' };
const roll = Object.entries(pack.tracks).flatMap(([tr, t]) => t.notes.map(([s, e, m, v]) => ({ t: s, e, m, v, tr, f: FAM[tr] })))
  .sort((a, b) => a.t - b.t || a.m - b.m || ORDER.indexOf(a.tr) - ORDER.indexOf(b.tr));
const STR = (n) => n.f === 'str', WIND = (n) => n.f === 'wind', KEYS = (n) => n.f === 'keys', ALL = () => true;
const track = (...ids) => (n) => ids.includes(n.tr);

// ---- helpers (as in docs/compositions/rach-concerto-2/gen-picks.mjs) ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; if (n.v > cur.loud.v || (n.v === cur.loud.v && n.m > cur.loud.m)) cur.loud = n; }
    else { cur = { t: n.t, ns: [n], top: n, low: n, loud: n }; out.push(cur); }
  }
  return out;
}
const inWin = (src, a, b, filter = ALL) => src.filter((n) => n.t >= a && n.t < b && filter(n));
/** Skyline: the top of each cluster, unless a note more than a tone higher, begun within `hold` s, still sounds
    (accompaniment under a held melody note); notes shorter than minDur dropped; a repeat of one pitch within 0.15 s merged. */
function skyline(src, a, b, filter, minDur = 0.28, hold = 0.8) {
  const ns = inWin(src, a - hold, b, (n) => filter(n) && n.e - n.t >= minDur);
  const out = [];
  for (const c of clusters(ns)) {
    if (c.t < a) continue;
    if (ns.some((n) => n.t < c.t - 0.02 && n.t >= c.t - hold && n.e > c.t + 0.05 && n.m > c.top.m + 2)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.m === c.top.m && c.t - prev.t < 0.15) continue;
    out.push(c.top);
  }
  return out;
}
/** Voiced-out line: of each cluster of held notes (>= minDur), the loudest (ties: the highest); a note under a louder one
    (by 6+) that began < 0.6 s before and still sounds is accompaniment and left out; one pitch again within 0.3 s merged. */
function voiced(src, a, b, filter, minDur = 0.28) {
  const out = [];
  for (const c of clusters(inWin(src, a, b, (n) => filter(n) && n.e - n.t >= minDur))) {
    const n = c.loud, prev = out[out.length - 1];
    if (prev && prev.e > n.t + 0.1 && n.t - prev.t < 0.6 && prev.v >= n.v + 6) continue;
    if (prev && prev.m === n.m && n.t - prev.t < 0.3) continue;
    out.push(n);
  }
  return out;
}
/** A bass line: the lowest note (<= maxM) of each cluster; a run of one pitch whose onsets follow within `gap` s, or
    that starts while the last still sounds (tremolo, YourMT3+'s split notes), becomes one note from the run's first start
    to its last end, at the run's loudest velocity. A restrike after the last one ended (a toll) stays its own note. */
function lowline(src, a, b, filter, maxM = 49, gap = 0.25) {
  const out = [];
  for (const c of clusters(inWin(src, a, b, (n) => filter(n) && n.m <= maxM))) {
    const n = c.low, prev = out[out.length - 1];
    if (prev && prev.m === n.m && (n.t - prev.last < gap || n.t < prev.e - 0.05)) { prev.e = Math.max(prev.e, n.e); prev.v = Math.max(prev.v, n.v); prev.last = n.t; continue; }
    out.push({ ...n, last: n.t });
  }
  return out;
}
/** Repeats: notes of one pitch struck again within `gap` s, in runs of at least `min`: YourMT3+ writes the string tremolo so. */
function repeats(src, a, b, filter, gap = 0.22, min = 4) {
  const byPitch = new Map();
  for (const n of inWin(src, a, b, filter)) { const l = byPitch.get(n.m); if (l) l.push(n); else byPitch.set(n.m, [n]); }
  const out = [];
  for (const ns of byPitch.values()) {
    let run = [ns[0]];
    const flush = () => { if (run.length >= min) out.push(...run); };
    for (let i = 1; i < ns.length; i++) {
      if (ns[i].t - ns[i - 1].t < 0.02) continue;                 // the same note on another track
      if (ns[i].t - run[run.length - 1].t < gap) run.push(ns[i]); else { flush(); run = [ns[i]]; }
    }
    flush();
  }
  return out;
}
/** Fast stepwise runs: tops of clusters <= `ioi` s apart moving by <= 4 semitones, at least `min` in a row. */
function runs(src, a, b, filter, ioi = 0.22, min = 6) {
  const tops = clusters(inWin(src, a, b, filter)).map((c) => c.top);
  const out = []; let run = [tops[0]];
  const flush = () => { const steps = new Set(run.map((n) => n.m)); if (run.length >= min && steps.size >= 4) out.push(...run); };
  for (let i = 1; i < tops.length; i++) {
    const p = tops[i - 1], n = tops[i];
    if (n.t - p.t < ioi && Math.abs(n.m - p.m) <= 4) run.push(n); else { flush(); run = [n]; }
  }
  flush();
  return out;
}

// ---- audio strokes ----
const AUD = AUDIO.onsets.map(([t, db, pcs]) => ({ t, db, pcs }));
/** Onsets in [a, b), one per 0.1 s (a second detection within 0.1 s is the same stroke). */
function strokes(a, b) {
  const out = [];
  for (const o of AUD) if (o.t >= a && o.t < b && !(out.length && o.t - out[out.length - 1].t < 0.1)) out.push(o);
  return out;
}
/** Notes for a list of strokes. Each sounds until the next stroke (at most maxLen s, and not past `until`). Where the roll
    has a cluster within 60 ms, its lowest and highest notes (their pitches and starts) at the stroke's audio velocity;
    otherwise the stroke's strongest pitch class as an octave, in octaves `lo` and `lo + 2` (a measured pitch, no
    invented harmony). */
function strokeNotes(list, { until = Infinity, maxLen = 2.5, lo = 3, rollFilter = ALL, single = false } = {}) {
  const out = [];
  list.forEach((s, i) => {
    const e = Math.min(i + 1 < list.length ? list[i + 1].t : until, s.t + maxLen, until);
    const v = vel(s.db);
    const near = clusters(inWin(roll, s.t - 0.06, s.t + 0.06, rollFilter));
    if (near.length) {
      const c = near[0];
      for (const n of single ? [c.top] : [...new Set([c.low, c.top])]) out.push({ t: n.t, e: Math.max(e, n.t + 0.1), m: n.m, v });
    } else {
      const pc = s.pcs[0];
      out.push({ t: s.t, e, m: 12 * (lo + 1) + pc, v });
      if (!single) out.push({ t: s.t, e, m: 12 * (lo + 3) + pc, v });
    }
  });
  return out;
}
/** The stroke nearest each given time (within 0.2 s). */
const nearestStrokes = (times) => times.map((x) => AUD.reduce((b, o) => (Math.abs(o.t - x) < Math.abs(b.t - x) ? o : b))).filter((o, i) => Math.abs(o.t - times[i]) < 0.2);

// ================= the sets =================
const sets = [];
function add(id, hears, notes, o = {}) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set();
  notes = notes.filter((n) => { const key = `${r4(n.t)}|${n.m}`; if (seen.has(key)) return false; seen.add(key); return true; });
  if (!notes.length) throw new Error(`${id} has no notes`);
  sets.push({ id, hears, source: o.source ?? 'roll', attacks: clusters(notes).length, notes: notes.map((n) => [r4(n.t), r4(Math.max(n.e, n.t + 0.05)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))]) });
}

// ---------- BERCEUSE (6.4-225.2 s): Eb minor, Andante ----------
// The rocking: the harp and violas' four-note cell Bb-Ab-Bb-Cb (later Bb-Cb-C-Cb), one note per ~1.1 s, under the whole
// lullaby. YourMT3+ hears it only for the first 8 s; the audio has it to 172 s and then, slower, to 191 s.
{
  const rock = AUDIO.rock.filter(([t, e]) => e - t <= 3).map(([t, e, m, v]) => ({ t, e, m, v }));
  const kept = []; for (const n of rock) if (!kept.length || n.t - kept[kept.length - 1].t >= 0.5) kept.push(n);
  add('harp-rocking', 'The lullaby\'s rocking: the harp and violas\' four-note cell (Bb-Ab-Bb-Cb, later Bb-Cb-C-Cb), one soft note every ~1.1 s from 6.6 to 172 s, slowing to 2-8 s apart at the very end (174-191 s). Measured in the audio (strongest pitch of Ab3-C4); none in the strings\' swell 80-110 s.', kept, { source: 'audio' });
}
add('berceuse-harp-track', 'The piano track in the Berceuse, which is the harp (and celesta): the first Eb-Bb chord and cell (6.6-14.3 s), single high touches (31, 60-66 s), the bell-like F#5/F#6 harmonics of the bridge (110-115 s), the low Eb chords at the fade (164-175 s) and the last B3/B4 (191.4 s).',
  inWin(roll, 0, 225, KEYS));
add('eb-pedal', 'The Berceuse\'s floor: the low Eb2/Bb2 of cellos and harp (below MIDI 50), held 1-5 s each, from 6.6 to 175 s, plus the tremolo Eb2 at 180 s (merged into one note). Few and soft (v 27-63): a toll every few seconds where the transcriber heard it.',
  [...lowline(roll, 0, 90, ALL), ...lowline(roll, 110, 194, ALL)]);
add('lullaby-bassoon', 'The bassoon lullaby (Eb minor): the wind-labelled notes (bassoon, clarinet, horn, voice tracks: the transcriber splits the one bassoon among them) of its two phrases, 18.85-31.3 s (Eb4-Bb3-D4-Bb3-Eb4 ...) and 46.5-56 s. Soft (v 24-53), 0.3-1.6 s notes; the stretch 31-46 s between them is untranscribed.',
  [...skyline(roll, 18.4, 32, WIND, 0.2), ...skyline(roll, 46.4, 56.4, WIND, 0.2)]);
add('wind-answers', 'The woodwinds\' soft chordal answers (two or more wind-labelled notes at once): 21.7-29.8 s, 49.9-59.0 s, single ones at 106.9 and 129.5 s, then the reprise\'s wind choir 139.7-153.5 s (Eb4/E4/F4 with E5-F5-Bb5 above). The answering voice to the bassoon.',
  clusters(inWin(roll, 0, 175, WIND)).filter((c) => new Set(c.ns.map((n) => n.m)).size >= 2).flatMap((c) => [...new Set([c.low, c.top])]));
add('voice-track', 'Everything on YourMT3+\'s "voice" track (19 notes; there is no singer: in the Berceuse these are the oboe-like answers B4-Bb4 at 39.5, 67.8-68.9, 76.9, 162.2-162.7 s, in the Finale a few inner notes at 280-282 and 336-342 s). Honest label: listen "voice" gives the same notes.',
  inWin(roll, 0, 456, track('voice')));
add('strings-lament', 'Before the swell: the violins take the line, Ab4-C5-B4-Eb5 ... F#4 (3 s) ... E4 (3.2 s), 60.5-79.9 s: slow, soft (v 27-50), sighing down.',
  skyline(roll, 60.4, 79.8, track('violin'), 0.28));
add('swell-violins', 'The Berceuse\'s one swell (79.9-110 s, the loudest of the first movement, -16 dB at 88 s): the violins\' long notes Ab5 (5.7 s), G5-F#5-Ab5-G5, D5 (5.6 s), then over the D pedal E5, Ab5, G5-F#5-Ab5-G5-F#5-F5. Held, aching, v 58-82.',
  skyline(roll, 79.8, 110, (n) => n.tr === 'violin' && n.m >= 62, 0.28));
add('swell-entry', 'The swell\'s entry chord, A major (A4-C#5-E5-A5 in violins/violas/cellos), struck six times 80.67-81.47 s (v29 to v82) as the crescendo starts, the last under the violins\' long Ab5: the strings\' repeated chord, one attack each.',
  clusters(inWin(roll, 80.6, 81.6)).filter((c) => c.ns.length >= 3).flatMap((c) => [c.low, c.top]));
add('d-pedal-tolls', 'The bass under the second half of the swell: G2 (90.7 s, 5.6 s long), C#3-D2 (99.3-100 s), then D2 restruck every ~2.2 s (100.2, 102.5, 104.6, 106.9, 108.0 s), Bb2 at 109.3 s. Slow tolls, v 55-74.',
  lowline(roll, 88, 110, STR));
add('harp-bridge', 'The bridge back to the lullaby, 110-118 s: the harp alone, one bell-like note every ~1.07 s (110.4, 111.3, 112.4, 113.5, 114.5, 115.6, 116.8 s) in harmonics F#5/F#6, D4/D6; YourMT3+ has four of the seven, the rest are the audio\'s onsets.',
  strokeNotes(strokes(110, 118), { until: 118.2, maxLen: 1.2, lo: 4, rollFilter: KEYS }), { source: 'roll + audio' });
add('reprise-descant', 'The lullaby returns (118.2 s) with a high, muted violin descant over it, one note per harp beat: D6-C#6-A5-Eb6-D6-Bb5-C#6-F6-Eb6-D6-C#6-A5-Eb6-D6-C#6-A5, 118.2-137 s. Soft (v 32-65), glassy, 1.1 s notes.',
  skyline(roll, 119, 137, (n) => n.tr === 'violin' && n.m >= 76, 0.28));
add('reprise-bassoon', 'The bassoon\'s lullaby again under the descant, 123.8-135 s: D4-Bb3-C#4-C4-B3-Eb4-Bb3-D4-B3-Bb3 (bassoon track), soft and low.',
  skyline(roll, 123.5, 136, track('bassoon', 'clarinet', 'horn'), 0.25));
add('lullaby-dissolve', 'The lullaby dissolving, 154-172 s: the violins\' last long notes (Ab4, Bb4, Bb5 2.5 s, Ab5, Ab5-F#5, Ab5, B4-Bb4, Bb5, Eb4) one every 1-2 s, v 30-57, over the slowing rocking.',
  skyline(roll, 154, 172, track('violin'), 0.4));
{
  const harp = inWin(roll, 172, 194, KEYS);
  const extra = strokes(172, 194).filter((s) => !harp.some((n) => Math.abs(n.t - s.t) < 0.2)).map((s) => ({ t: s.t, e: s.t + 1.5, m: 48 + s.pcs[0], v: vel(s.db) }));
  add('last-rocking', 'The last, slowest rocking notes as the Berceuse falls asleep, 172-194 s: the harp\'s Eb2-Bb2, Bb3 and B3/B4 and the audio\'s onsets between them (174.4, 182.0, 184.2, 185.5, 188.9, 191.4, 193.7 s), 1.2-7.7 s apart: farther and farther.',
    [...harp, ...extra], { source: 'roll + audio' });
}
{
  // The frozen tremolo, 194-225.2 s, -38 to -41 dB: a held string chord that changes slowly from Eb minor to B major.
  // YourMT3+ writes it as a few soft chords (and one stuck chord at 208 s, repeated 13 times): keep the first of each new
  // pitch content.
  const cs = clusters(inWin(roll, 194, 225.2)); const out = []; let last = '';
  for (const c of cs) { const key = [...new Set(c.ns.map((n) => n.m))].sort().join(','); if (key !== last) out.push(c.low, c.top); last = key; }
  add('frozen-tremolo', 'The spell of sleep, 194-225.2 s (-38 to -41 dB, the quietest music in the recording): the muted strings\' held tremolo moving slowly from Eb minor to B major. Only its chord changes, one every 1.5-5.4 s, v 7-24: 195.05, 200.09, 204.87, 207.39, 208.91, 212.18, 217.58 s (then nothing to 225.2 s).',
    out);
}

// ---------- FINALE (225.2-413.3 s): B major, the hymn ----------
{
  // The horn solo segmented from the audio (clean: the strings under it are at -40 dB). Starts snapped to the horn track
  // where it has the same pitch within 0.3 s, so the picker finds those.
  const horn = AUDIO.horn.map(([t, e, m, db]) => {
    const r = inWin(roll, t - 0.3, t + 0.3, (n) => n.m === m && n.tr === 'horn')[0];
    return { t: r ? r.t : t, e, m, v: vel(db) };
  });
  add('horn-hymn', 'The Finale\'s hymn in the solo horn, 226.7-252.5 s, pianissimo over the frozen strings: F#4 (2.4 s)-E4-D#4-F#4-C#4-B3 | E4-D#4-C#4-E4-D#4-B3-C#4 (2.5 s) | F#4-E4-D#4-F#4-C#4-B3 | E4-D#4-C#4-E4-D#4. 24 notes measured in the audio (YourMT3+ has 26 short horn notes and misses the long ones).',
    horn, { source: 'audio (+ horn track starts)' });
}
add('hymn-strings', 'The hymn\'s second statement, 252.4-267 s, in the strings (top line, F#4 and up): the opening chord\'s A4 (252.5 s), C#5, then the tune an octave above the horn, E5-D#5-F#5-C#5-B4, E5-D#5-C#5-E5-D#5-B4. Still soft (v 26-44), a little higher and fuller than the horn.',
  skyline(roll, 252.4, 267, (n) => n.f !== 'keys' && n.m >= 66, 0.28));
add('hymn-third', 'The third statement, 267-282.8 s, louder (-23 to -20 dB): E6 over a harp sweep at 268.3 s, then E5-D#5-F#5-C#5-B4, E5-C#4-B3, C#5-E5-D#5-B4-C#5 (1.9 s). v 36-69.',
  skyline(roll, 267, 282.8, (n) => n.f !== 'keys' && n.m >= 66, 0.28));
add('hymn-crescendo', 'The fourth statement, 282.8-303.5 s, the long crescendo (-18 to -12 dB) over the bass stepping down B2-Ab2-F#2: A5, C#5, G#5 (horn), E5-D#5-C#6, E5, Ab4, C#6-D#6 (v96 at 293.9 s)-C#6-Ab6, F#5-E5-F#5-C#6. v 48-96.',
  skyline(roll, 282.8, 303.5, (n) => n.f !== 'keys' && n.m >= 57, 0.28));
add('hymn-tutti', 'The hymn fortissimo, full orchestra, 303.5-319.1 s (-7 to -4 dB, the first great arrival at 304.5 s): C#6, E6-D#6-F#6-C#6-B5-E6-F#5-E6-E5-E5-C#6-C#6, the top of the strings, 1-2 s notes, v 84-99.',
  skyline(roll, 303.5, 319.1, (n) => n.f !== 'keys' && n.m >= 60, 0.28));
add('hymn-entries', 'Every entry of the hymn, one note each: the horn (226.75 s), the horn\'s second half (241.3 s), strings (252.48), third statement (267.0), crescendo statement (282.8), tutti (303.5), the 7/4 chords (324.13), the Maestoso (348.56 s). The theme\'s recurring arrival as a slow toll.',
  [
    ...AUDIO.horn.filter(([t]) => Math.abs(t - 226.7) < 0.1 || Math.abs(t - 241.34) < 0.1).map(([t, e, m, db]) => ({ t, e, m, v: vel(db) })),
    ...[252.48, 267.01, 282.81, 303.51].map((x) => clusters(inWin(roll, x - 0.05, x + 0.05, (n) => n.f !== 'keys' || x === 282.81))[0].top),
    ...strokeNotes(nearestStrokes([324.13, 348.56]), { maxLen: 2.4, single: true, lo: 4 }),
  ], { source: 'roll + audio' });
add('falling-bass', 'The bass under the crescendo statements, 252-304 s: B2 (cellos, restruck and trembling 252-287 s), Ab2 (287.6 s), F#2 (291.6-303.5 s, the dominant pedal that the tutti resolves). Tremolo runs merged into held notes: a slow stepping floor, v 26-84.',
  lowline(roll, 252, 304, ALL));
add('keys-finale', 'The piano track in the Finale (harp, celesta and the keyboard colour of the tutti): the B-chord arpeggio at 258.5 s, the harp sweep 268.3-269.5 s (B4-Eb5-G5-Eb6-Eb7), the rippling chords 276-284 s, the tutti chords and the Eb7 shimmer 294-303 s, the Maestoso\'s low F# and B chords (356.4, 370-373 s).',
  inWin(roll, 225, 414, KEYS));
add('hush-swell', 'The sudden hush after the tutti (319.1 s, -5 to -34 dB in 1 s) and the strings\' rising crescendo out of it, 319.6-324 s: cellos trembling B2-Bb2-A2-C#3, violins climbing F5-A5-G5-Bb5 v23 -> v63, into the 7/4 chords.',
  inWin(roll, 319.1, 324.1, STR));

// ---- the 7/4 chords and the Maestoso ----
const SEVEN = strokes(324, 348.4), MAESTOSO = strokes(348.4, 381.5);
add('seven-four-strokes', 'The hymn recast in 7/4 (324.13-348.4 s): every note a stamping chord, one every 0.345 s, 10 bars of 7 (66 strokes detected of the 70), -10 to -3 dB; B major 324.1-333.9 s, then white-key (C/G) harmony 334.3-348.2 s. The first 3 s have no transcribed notes: these are the audio\'s onsets (with the roll\'s chord where it has one).',
  strokeNotes(SEVEN, { until: 348.4, maxLen: 0.4, lo: 2 }), { source: 'audio + roll' });
add('seven-four-downbeats', 'The first stroke of each 7/4 bar, every 2.415 s: 324.13, 326.61, 329.00, 331.44, 333.90, 336.27, 338.66, 341.10, 343.59, 346.05 s. The bar\'s weight, a heavy pulse inside the stamping.',
  strokeNotes(nearestStrokes([324.13, 326.55, 329.0, 331.38, 333.8, 336.27, 338.66, 341.06, 343.59, 346.05]), { maxLen: 2.4, lo: 2 }), { source: 'audio + roll' });
add('maestoso-strokes', 'The Maestoso (348.56-381 s), the hymn in broad chords at half speed: one stroke every 0.70 s (7 to a bar), slowing to 0.8-1.0 s from 373.8 s (ritardando) into the arrival at 380.76 s. The loudest music of the piece (-5 to 0 dB); the top pitch alternates F# and B a bar or two at a time.',
  strokeNotes(MAESTOSO, { until: 381.5, maxLen: 1.6, lo: 2 }), { source: 'audio + roll' });
add('maestoso-downbeats', 'The Maestoso\'s bar starts, every ~4.95 s: 348.56 (the F1 blow), 353.62, 358.61, 363.60, 368.64, 373.82 s, and the arrival 380.76 s. Seven huge, slow tolls.',
  strokeNotes(nearestStrokes([348.56, 353.62, 358.61, 363.6, 368.64, 373.82, 380.76]), { maxLen: 6, lo: 2, until: 385.6 }), { source: 'audio + roll' });
add('maestoso-top', 'The top of the Maestoso\'s chords from the roll (violins and the string section), one note per stroke where YourMT3+ heard it: the hymn\'s melody inside the stamping, 348.5-381 s, v 86-111.',
  skyline(roll, 348.4, 381.5, (n) => STR(n) && n.m >= 60, 0.2, 0.3));
add('maestoso-bass', 'The bass of the 7/4 chords and the Maestoso, 324-381 s: G2 restruck under the white-key bars (336-346 s), C2 (347 s), the F1 blow (348.49 s, v110, the lowest note of the piece), then B2/F#2/E2 under the broad chords.',
  lowline(roll, 324, 381.5, ALL, 49, 0.2));
{
  // The coda: after the arrival, the brass' slow chords, as the chroma shows them (pitch classes of the audio, 0.5 s steps):
  // B (380.76, held soft to 385.6), B again (385.65), C (387.55, restruck 388.75), Db (390.91), F (394.41), Db (396.34),
  // C (398.55, cut at 401.1). Voiced here as root in octave 2 and the triad in octave 4.
  const TRIAD = { B: [47, 63, 66, 71], C: [48, 64, 67, 72], Db: [49, 65, 68, 73], F: [41, 65, 69, 72] };
  const seq = [[380.76, 'B', 385.6], [385.65, 'B', 387.5], [387.55, 'C', 388.7], [388.75, 'C', 390.85], [390.91, 'Db', 394.35], [394.41, 'F', 396.3], [396.34, 'Db', 398.5], [398.55, 'C', 401.1]];
  const db = (t) => (AUD.find((o) => Math.abs(o.t - t) < 0.15)?.db ?? -8);
  add('coda-chords', 'The coda\'s slow brass chords after the arrival: B (380.76 s, ff, then held soft), B (385.65), C (387.55, restruck 388.75), Db (390.91), F (394.41), Db (396.34), C (398.55, cut at 401.1 s). 1.2-5 s apart, each held to the next: the long slow notes for a handover. Pitches from the audio\'s chroma (YourMT3+ has 6 notes in these 20 s).',
    seq.flatMap(([t, ch, e]) => TRIAD[ch].map((m) => ({ t, e, m, v: vel(db(t)) }))), { source: 'audio' });
}
add('final-chord', 'The last chord: B major entering pianissimo at 402.40 s after a second of silence and swelling for ten seconds (-20 to -2 dB), then the final stroke at 412.62 s (-0.7 dB), cut at 413.3 s. Two long notes in four voices: the slowest, longest event of the piece.',
  [402.4, 412.62].flatMap((t, i) => [47, 63, 66, 71].map((m) => ({ t, e: i ? 413.3 : 412.6, m, v: vel(i ? -0.7 : -20.4) }))), { source: 'audio (+ the roll\'s B at 402.41)' });
add('ff-blows', 'The real fortissimo blows, five in the whole piece: the 7/4 entry out of the hush (324.13 s), the Maestoso\'s first chord on the F1 (348.56), its loudest stroke (358.61, 0 dB), the arrival (380.76) and the final stroke (412.62 s). Nothing else in the recording hits like these.',
  [...strokeNotes(nearestStrokes([324.13, 348.56, 358.61, 380.76]), { maxLen: 1.5, lo: 2 }), ...[47, 71].map((m) => ({ t: 412.62, e: 413.3, m, v: vel(-0.7) }))], { source: 'audio + roll' });

// ---------- whole-piece strands ----------
add('melody-voiced', 'The voiced-out line of the whole piece: of each cluster of held notes (>= 0.28 s, all tracks), the loudest; accompaniment under a louder held note left out. The melody as the ear follows it, 6.6-402 s, wherever YourMT3+ heard it (thin 172-252 s and in the 7/4 bars).',
  voiced(roll, 0, 456, ALL));
add('bass-line', 'The bass of the whole piece: the lowest note below MIDI 50 of each cluster, tremolo and restruck runs merged into held notes. Soft Eb2/Bb2 in the Berceuse, D2 in its swell, B2-Ab2-F#2 under the Finale\'s crescendo, G2/C2/F1/B2 under the 7/4 and Maestoso.',
  lowline(roll, 0, 456, ALL));
add('violins-line', 'The violin track\'s top line, held notes (>= 0.28 s), the whole piece: the strings\' singing voice (Berceuse lament, swell and descant; the hymn from 252 s).',
  skyline(roll, 0, 456, track('violin'), 0.28));
add('violas-inner', 'The viola track\'s top line, held notes (>= 0.28 s): the inner voice, an octave or so under the violins (the rocking\'s Bb3/Ab3 early on, the swell\'s inner F#4/G4/Ab4, the hymn\'s harmony).',
  skyline(roll, 0, 456, track('viola'), 0.28));
add('cellos-low', 'The cello track\'s lowest line, repeats merged (gaps < 0.3 s): Eb2/Bb2 pedal, the D2 tolls, B2 tremolo, F#2 pedal, the 7/4 bass and the F1.',
  lowline(roll, 0, 456, track('cello'), 127, 0.3));
add('winds-line', 'The wind tracks (bassoon, clarinet, horn, voice) top line, notes >= 0.2 s: the bassoon lullaby and its answers (18-60, 123-153 s), single wind touches in the swell (90-113 s), the horn notes YourMT3+ heard in the solo (228-251 s) and the clarinet-track B3/A3 at 256-274 s.',
  skyline(roll, 0, 456, WIND, 0.2));
add('string-tremolo', 'The string tremolo as YourMT3+ writes it: one pitch struck again and again (< 0.22 s apart, at least four in a row). The swell\'s repeated A chord (80.7-81.5 s), pale shimmer at 180 and 208 s (v 6-26), then the Finale\'s trembling build: C#5 at 254-255, B2 at 276-283, C#5/E5 at 288-289, F#2/Ab2 and the Eb7 shimmer at 297-303, the Maestoso\'s B5/Ab5 tremolo at 352-372 s.',
  repeats(roll, 0, 456, ALL));
add('fast-runs', 'Fast stepwise runs (cluster tops < 0.22 s apart, steps of <= 4 semitones, six or more): only the violins\' climb out of the hush qualifies, 319.7-323.6 s (Bb5-A5-F5-F#5-G5 ... A5, v22 to v63); the harp\'s sweep at 268.3 s has too few notes in the roll. YourMT3+ hears no other runs.',
  runs(roll, 0, 456, ALL));

// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (!(n[1] > n[0]) || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127 || n[1] > pack.duration) throw new Error(`${s.id} bad note ${n}`);
}
if (new Set(sets.map((s) => s.id)).size !== sets.length) throw new Error('duplicate set id');
const out = {};
for (const s of sets) out[s.id] = { hears: s.hears, notes: s.notes };
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');
for (const s of sets) {
  const a = s.notes[0][0], b = Math.max(...s.notes.map((n) => n[1]));
  console.log(`${s.id.padEnd(22)} ${String(s.notes.length).padStart(4)} notes ${String(s.attacks).padStart(4)} att ${a.toFixed(1).padStart(6)}-${b.toFixed(1).padEnd(6)} v${Math.min(...s.notes.map((n) => n[3]))}-${Math.max(...s.notes.map((n) => n[3]))} ${s.source.padEnd(12)} | ${s.notes.slice(0, 12).map((n) => nm(n[2])).join(' ')}`);
}
console.log(sets.length, 'sets');

/* ---- the audio measurements (C:/Users/maxim/.venvs/wa/Scripts/python.exe -I audio-picks.py songs/firebird-berceuse-finale/audio.mp3) ----
# Audio-derived notes for firebird-berceuse-finale (run with the wa venv's python -I). Prints JSON.
import sys, json, numpy as np, librosa, scipy.signal as ss
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
hop = 256
t_of = lambda f: f * hop / sr
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
db = 20 * np.log10(rms / rms.max() + 1e-9)
C = np.abs(librosa.cqt(y, sr=sr, hop_length=hop, fmin=librosa.midi_to_hz(36), n_bins=60, bins_per_octave=12))
chroma = C.reshape(5, 12, -1).sum(0)  # bin 0 is C2 (midi 36): fold the octaves into pitch classes
vel = lambda d: int(max(20, min(122, round(122 + 3 * d))))
out = {}
# 1. the rocking in the Ab3-C4 band: changes of the strongest pitch, median-smoothed
lo, hi = 56, 60
band = C[lo - 36:hi - 36 + 1]
arg = ss.medfilt(band.argmax(0).astype(float), 21).astype(int)
bdb = librosa.amplitude_to_db(band.max(0), ref=C.max())
benv = librosa.onset.onset_strength(S=librosa.amplitude_to_db(band, ref=C.max()), sr=sr, hop_length=hop)
rock = []
for a, b in [(6.4, 79.6), (110.0, 194.0)]:
    f0, f1 = int(a * sr / hop), int(b * sr / hop)
    k = f0
    while k < f1:
        j = k
        while j < f1 and arg[j] == arg[k]: j += 1
        if t_of(j - k) >= 0.45 and bdb[k:j].max() > -50:
            # snap the start to the strongest rise of the band within 0.3 s before to 0.1 s after the change
            w0, w1 = max(0, k - int(0.3 * sr / hop)), k + int(0.1 * sr / hop)
            s0 = w0 + int(benv[w0:w1].argmax())
            rock.append([round(t_of(s0), 3), round(t_of(j), 3), lo + int(arg[k]), vel(float(db[s0:s0 + 12].max()))])
        k = j
out['rock'] = rock
# 2. strokes at given onset times: peak dB in the next 0.15 s and the three strongest pitch classes over 0.3 s
def stroke(t):
    f = int(t * sr / hop)
    c = chroma[:, f:f + int(0.3 * sr / hop)].mean(1)
    top = [int(i) for i in np.argsort(c)[::-1][:3]]
    return [round(t, 3), round(float(db[f:f + int(0.15 * sr / hop)].max()), 1), top]
on = librosa.onset.onset_detect(y=y, sr=sr, hop_length=512, units='time')
out['onsets'] = [stroke(float(t)) for t in on]
json.dump(out, sys.stdout, separators=(',', ':'))

# ---- seg.py (the horn solo: python -I seg.py audio.mp3 226.4 252.6 55 70 0.2) ----
# Segment a solo line: argmax of the CQT in a band, median-smoothed; notes >= minDur; prints JSON [start,end,midi,dBpeak]
import sys, json, numpy as np, librosa, scipy.signal as ss
path, a, b, lo, hi, mind = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
y, sr = librosa.load(path, sr=22050, mono=True)
hop = 256
C = np.abs(librosa.cqt(y, sr=sr, hop_length=hop, fmin=librosa.midi_to_hz(lo), n_bins=hi - lo + 1, bins_per_octave=12))
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
db = 20 * np.log10(rms / rms.max() + 1e-9)
f0, f1 = int(a * sr / hop), int(b * sr / hop)
arg = ss.medfilt(C.argmax(0).astype(float), 15).astype(int)
out = []; k = f0
while k < f1:
    j = k
    while j < f1 and arg[j] == arg[k]: j += 1
    if (j - k) * hop / sr >= mind:
        out.append([round(k * hop / sr, 3), round(j * hop / sr, 3), lo + int(arg[k]), round(float(db[k:k + 12].max()), 1)])
    k = j
print(json.dumps(out))
*/
