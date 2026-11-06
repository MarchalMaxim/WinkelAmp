// Pick sets for Liszt's Hungarian Rhapsody No. 2, orchestral version (songs/liszt-hungarian-2), deterministic.
// Run: node docs/compositions/classical/liszt-hungarian-2/gen-picks.mjs
//   -> writes picks.json next to this file ({ "<set id>": { hears, notes, ...metadata } }, sets sorted by first note)
//      and prints each set's attacks, attacks a second, span and first notes (the numbers in ANALYSIS.md).
//
// Note sources (the analysis behind them is ANALYSIS.md):
// - "roll": pack.tracks, the YourMT3+ instrument lanes with their own velocities. This is what the studio's note picker
//   shows for this pack (src/studio/ui/picker-logic.ts pickerNotes uses pack.tracks whenever a track has notes), so these
//   picks are found on its roll. Lane doubles (violin, viola and cello on the same pitch at the same time) are merged:
//   one note per pitch per 40 ms, the loudest kept.
// - "pack": pack.notes, the piano model with YourMT3+ in its gaps. It hears the deep bass tolls (Bb0, C#1), the pp low
//   strings of 307-356 s and the prestissimo of 584-605 s where the lanes are empty; the picker shows such notes as
//   picks it cannot find on its roll, and they still play.
// - "audio": onsets read from the recording where neither source has notes (the holes). Baked in below as AUDIO, with
//   the recipe. The pitch of an audio pick is the strongest chroma class at its strongest octave: approximate.
// "Loudest of its chord" ranks by the pack's velocity of the same pitch within 80 ms where one exists, since many lane
// velocities are loudness-derived and flat across a chord; ties go to the higher note.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/liszt-hungarian-2');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const L = pack.loudness, loud = (t) => L.values[Math.min(L.values.length - 1, Math.max(0, Math.round(t / L.hop)))];
const loudVel = (t) => Math.max(20, Math.min(115, Math.round(25 + 85 * loud(t))));

// ---- the sources ----
const FAM = { violin: 'str', viola: 'str', cello: 'str', strings: 'str', clarinet: 'wind', brass: 'brass', piano: 'keys', plucked: 'pluck', voice: 'voice' };
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, track: 'pack', f: 'pack', k })).sort((a, b) => a.t - b.t || a.m - b.m);
const byPitch = new Map();
for (const n of packNotes) { const l = byPitch.get(n.m); if (l) l.push(n); else byPitch.set(n.m, [n]); }
/** The pack's velocity for this pitch within 80 ms, else the note's own: how loud the note really was. */
const packVel = (n) => { let v = n.v, near = 0.08; for (const p of byPitch.get(n.m) ?? []) { const d = Math.abs(p.t - n.t); if (d < near) { near = d; v = p.v; } } return v; };
const roll = Object.entries(pack.tracks).flatMap(([id, tr]) => tr.notes.map(([t, e, m, v], k) => ({ t, e, m, v, track: id, f: FAM[id] ?? 'oth', k })))
  .sort((a, b) => a.t - b.t || a.m - b.m);
for (const n of roll) n.pv = packVel(n);
for (const n of packNotes) n.pv = n.v;

// Audio onsets in the holes, from songs/liszt-hungarian-2/audio.mp3 with librosa 0.10 (22050 Hz mono, hop 256):
// log-mel (128 bands) flux against a 3-band max filter (superflux-like), mean over bands; a local z-score over 4 s
// windows; scipy find_peaks height 2.0, distance 70 ms; kept here when z >= 2.5 and the frame's rms >= -40 dB. Pitch:
// the strongest chroma_stft class over the next 5 frames, at the octave where the CQT (A0, 88 bins) is strongest.
// [time s, midi, rms dB, z]. Velocity from the onset's rms: -40 dB -> 20, -15 dB -> 60 (the pp notes around them are 30-60).
const dbVel = (db) => Math.max(15, Math.min(70, Math.round(20 + 40 * (db + 40) / 25)));
const AUDIO = [
  [100.18, 71, -25.7, 5.23], [100.68, 71, -26.1, 2.69], [101.06, 71, -27.4, 2.55], [103.22, 71, -29.7, 4.41], [103.34, 70, -32.5, 3.34],
  [261.81, 83, -35.7, 10.22],
  [308.35, 68, -35.5, 4.58], [308.43, 68, -33.8, 3.93], [308.51, 72, -27.3, 2.58], [309.38, 40, -29.5, 2.61], [309.69, 66, -28.9, 3.31],
  [312.30, 69, -36.1, 3.17], [312.44, 71, -28.6, 4.27], [313.52, 44, -34.6, 2.93], [313.78, 69, -34.2, 6.76], [316.45, 73, -30.0, 2.8],
  [317.03, 54, -32.7, 5.8], [317.56, 54, -33.8, 4.59], [318.02, 54, -33.4, 2.79], [318.43, 54, -33.7, 2.97], [318.52, 54, -34.3, 2.69],
  [320.76, 43, -30.0, 2.86], [320.87, 45, -27.4, 2.74], [321.00, 45, -31.7, 4.97], [321.61, 49, -32.8, 2.82], [322.87, 37, -36.5, 3.36],
  [325.76, 49, -30.6, 2.61], [326.26, 66, -31.6, 2.52], [326.65, 49, -29.6, 3.86], [328.68, 54, -32.8, 3.22], [328.75, 54, -28.5, 4.18],
  [329.86, 56, -30.2, 2.78],
  [356.66, 56, -19.2, 3.11], [357.96, 44, -18.1, 2.9], [358.44, 68, -20.6, 2.71], [359.05, 48, -23.4, 3.48], [359.75, 65, -26.6, 2.53], [360.11, 61, -29.0, 3.06],
  [363.59, 80, -31.5, 6.53], [364.01, 49, -33.7, 2.99], [365.40, 80, -30.4, 2.74], [365.48, 90, -24.3, 3.57], [366.43, 73, -26.9, 2.91],
  [366.90, 83, -32.5, 2.98], [367.24, 93, -30.0, 3.48], [368.28, 80, -27.0, 2.64], [368.59, 83, -29.7, 2.87],
  [378.04, 85, -31.9, 3.19], [378.44, 77, -29.2, 2.7], [378.92, 80, -29.9, 3.18], [379.68, 90, -19.8, 3.42], [380.56, 85, -28.1, 6.99],
  [383.11, 90, -26.3, 4.07], [383.91, 93, -25.5, 4.59], [384.81, 68, -29.7, 2.7],
  [602.81, 86, -30.0, 4.38], [603.31, 86, -26.6, 3.11],
].map(([t, m, db, z], k) => ({ t, e: t + 0.25, m, v: dbVel(db), db, z, track: 'audio', f: 'audio', pv: dbVel(db), k }));
// an audio pick lasts until the next one, at most 0.6 s
for (let i = 0; i < AUDIO.length; i++) { const nx = AUDIO[i + 1]; AUDIO[i].e = r4(Math.min(AUDIO[i].t + 0.6, nx && nx.t > AUDIO[i].t ? nx.t : Infinity)); }

// ---- helpers ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; if (n.pv > cur.loud.pv || (n.pv === cur.loud.pv && n.m > cur.loud.m)) cur.loud = n; cur.vmax = Math.max(cur.vmax, n.pv); }
    else { cur = { t: n.t, ns: [n], top: n, low: n, loud: n, vmax: n.pv }; out.push(cur); }
  }
  return out;
}
const inWin = (src, a, b, filter = () => true) => src.filter((n) => n.t >= a && n.t < b && filter(n));
const wins = (src, spans, filter = () => true) => spans.flatMap(([a, b]) => inWin(src, a, b, filter));
const dur = (n) => n.e - n.t;
/** Skyline: the top of each onset cluster, unless a note more than a tone higher, begun within `hold` s, still sounds;
    notes shorter than minDur dropped; a repeat of the same pitch within 0.15 s merged. */
function skyline(src, a, b, filter, minDur = 0.15, hold = 0.8) {
  const ns = inWin(src, a - hold, b, (n) => filter(n) && dur(n) >= minDur);
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
/** The voiced-out line: of each cluster of held notes (>= minDur), the loudest (pack velocity; ties: the higher), unless a
    louder note begun within 0.6 s still sounds over it (it is accompaniment); a repeat of the same pitch class within
    0.15 s merged (octave doubling). */
function voiced(src, a, b, filter, minDur = 0.28) {
  const ns = inWin(src, a - 0.6, b, (n) => filter(n) && dur(n) >= minDur);
  const out = [];
  for (const c of clusters(ns)) {
    if (c.t < a) continue;
    const n = c.loud;
    if (ns.some((o) => o.t < c.t - 0.03 && o.t >= c.t - 0.6 && o.e > c.t + 0.1 && o.pv > n.pv + 6 && Math.abs(o.m - n.m) > 2)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.m % 12 === n.m % 12 && c.t - prev.t < 0.15) continue;
    out.push(n);
  }
  return out;
}
/** Lowest note of each cluster, notes below `below`, at least `gap` s apart (a bass line or tolls). */
function lows(src, a, b, below, minDur = 0, minVel = 0, gap = 0.12) {
  const out = [];
  for (const c of clusters(inWin(src, a, b, (n) => n.m < below && dur(n) >= minDur && n.pv >= minVel))) {
    const prev = out[out.length - 1];
    if (prev && c.t - prev.t < gap) continue;
    out.push(c.low);
  }
  return out;
}
/** Chords: clusters of >= k notes whose loudest is >= v; each thinned to its lowest and highest note (one attack). */
const blows = (src, a, b, k, v, filter = () => true) => clusters(inWin(src, a, b, filter)).filter((c) => c.ns.length >= k && c.vmax >= v).flatMap((c) => [...new Set([c.low, c.top])]);
/** Fast runs: >= minLen successive single attacks (their top notes) <= ioi s apart, each step 1-4 semitones, one direction
    (one reversal allowed: a turn at the top). */
function runs(src, a, b, minLen = 6, ioi = 0.13, filter = () => true) {
  const cs = clusters(inWin(src, a, b, filter)).map((c) => c.top);
  const out = []; let cur = [cs[0]];
  const flush = () => { if (cur.length >= minLen) out.push(...cur); };
  for (let i = 1; i < cs.length; i++) {
    const p = cur[cur.length - 1], n = cs[i], st = n.m - p.m;
    const dirs = cur.slice(1).map((x, j) => Math.sign(x.m - cur[j].m)), flips = dirs.filter((d, j) => j && d !== dirs[j - 1]).length;
    const ok = n.t - p.t <= ioi && Math.abs(st) >= 1 && Math.abs(st) <= 4 && (dirs.length === 0 || Math.sign(st) === dirs[dirs.length - 1] || flips === 0);
    if (ok) cur.push(n); else { flush(); cur = [n]; }
  }
  flush();
  return out;
}
/** Repeated notes: a pitch struck >= minN times in a row, each 0.08..maxIoi s after the last. */
function repeats(src, a, b, minN = 4, maxIoi = 0.45, filter = () => true) {
  const ns = inWin(src, a, b, filter), by = new Map(), out = [];
  for (const n of ns) { const l = by.get(n.m); if (l) l.push(n); else by.set(n.m, [n]); }
  for (const l of by.values()) {
    let cur = [l[0]];
    const flush = () => { if (cur.length >= minN) out.push(...cur); };
    for (let i = 1; i < l.length; i++) { const d = l[i].t - cur[cur.length - 1].t; if (d < 0.08) continue; if (d <= maxIoi) cur.push(l[i]); else { flush(); cur = [l[i]]; } }
    flush();
  }
  return out;
}
/** Merge sources: notes of `extra` only where `base` has nothing within `within` s. */
const fillGaps = (base, extra, within = 0.12) => [...base, ...extra.filter((x) => !base.some((n) => Math.abs(n.t - x.t) < within))];
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t + 0.01)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];

const sets = [];
const attacksOf = (notes) => { let k = 0, last = -1; for (const n of notes) { if (n[0] - last >= 0.04) { k++; last = n[0]; } } return k; };
function add(id, o, notes) {
  // one note per pitch per 40 ms (lane doubles), the loudest kept
  const keep = new Map();
  for (const n of notes) { const key = `${n.m}|${Math.round(n.t / 0.04)}`; const old = keep.get(key); if (!old || n.v > old.v) keep.set(key, n); }
  const ns = [...keep.values()].sort((x, y) => x.t - y.t || x.m - y.m).map(asTuple);
  sets.push({ id, ...o, attacks: attacksOf(ns), notes: ns });
}
const STR = (n) => n.f === 'str';
const ALL = () => true;

// ===================================== LASSAN (0 - 363.4 s) =====================================
// S1 0.0-40.4 Lento a capriccio I  ·  S8 173.9-212.4 Lento a capriccio II (the same phrases, ~170.5 s later)
const LENTO = [[3.3, 40.4], [173.9, 212.4]];
add('lento-proclamations', { section: 'S1 Lento I', from: 3.3, to: 40.4, source: 'pack', pair: 'lento', rule: 'voiced line of pack notes >= 0.28 s, midi >= 50, 3.3-40.4 s',
  hears: 'The proud held tones of the opening declamation, tutti, C# minor: C#4 (3.37), the C# chord (5.54-5.88), B minor (10.3), E4-D4-C#4 (13.0-13.7), the C# octaves (15.8), down to the Ab/A sighs of 22-36 s. Few, long, ff.' },
  voiced(packNotes, 3.3, 40.4, (n) => n.m >= 50));
add('lento-proclamations-return', { section: 'S8 Lento II', from: 173.9, to: 212.4, source: 'pack', pair: 'lento', rule: 'voiced line of pack notes >= 0.28 s, midi >= 50, 173.9-212.4 s',
  hears: 'The opening declamation again, tutti, the same phrases 170.5 s later (C#4 174.4, B minor 180.75, E4-D4-C#4 183.3-184.1, the C# octaves 186.2), then the Ab4 calls of 200-204 s.' },
  voiced(packNotes, 173.9, 212.4, (n) => n.m >= 50));
add('lento-knocks', { section: 'S1+S8 Lento', from: 3.3, to: 212.4, source: 'pack', pair: 'lento', rule: 'pack notes < 0.35 s in Lento I and II that sit in a group of >= 4 short notes each <= 0.2 s after the last',
  hears: 'The knocking ornament of the Lento, a cimbalom figure: the grace notes of the very first gesture (3.4-3.7 s), then B3-C#4-B3-B4 struck fast, four to eight times (8.3-8.9, 18.3-18.9, 21.1-21.8 s and again at 178.6-179.2, 181.4-182.3, 189.0-189.5, 191.1-192.6, 202.1-204.1 s). Its reprise is the sign that the Lento is back.' },
  (() => { const out = []; for (const [a, b] of LENTO) { const ns = inWin(packNotes, a, b, (n) => dur(n) < 0.35 && n.m >= 55); let g = [ns[0]]; const fl = () => { if (g.length >= 4) out.push(...g); }; for (let i = 1; i < ns.length; i++) { if (ns[i].t - g[g.length - 1].t <= 0.2) g.push(ns[i]); else { fl(); g = [ns[i]]; } } fl(); } return out; })());
add('lento-strokes', { section: 'S1+S8 Lento', from: 3.3, to: 212.4, source: 'pack', pair: 'lento', rule: 'lowest note of pack clusters in Lento I and II with a note below midi 46 and velocity >= 60, >= 0.6 s apart',
  hears: 'The bass strokes under the declamation: B1 (5.65), F#1/A1 (10.4), C#1 (15.85), F1 (26.3), E1 (30.9), Ab1 (37.65), F#1 (39.9), and in the reprise Ab1 (175.9), C#1 (176.1), F#1 (180.9), A1 (190.9), E1 (201.7), Ab1 (209.2). Single deep tolls, several seconds apart.' },
  LENTO.flatMap(([a, b]) => lows(packNotes, a, b, 46, 0, 60, 0.6)));

// S2 40.4-56.0 Andante mesto in the cellos  ·  S3 56.0-92.5 the theme in full strings  ·  S9 212.4-246.4 its return
add('lassan-theme-cellos', { section: 'S2 Lassan theme, low', from: 40.4, to: 56, source: 'pack', pair: 'lassan-theme', rule: 'skyline of pack notes >= 0.2 s, 40.4-56 s',
  hears: 'The brooding lassan theme alone in the low strings, p (A2-Ab2-B2-Ab2 ... down to C#2, then the C#3/Ab2 rocking of 52-56 s): the darkest, quietest statement.' },
  skyline(packNotes, 40.4, 56, ALL, 0.2));
add('lassan-theme-strings', { section: 'S3 Lassan theme, full', from: 56, to: 92.5, source: 'pack', pair: 'lassan-theme', rule: 'voiced line of pack notes >= 0.28 s, midi >= 52, 56-92.5 s',
  hears: 'The lassan theme taken up by the whole string body from the sudden f at 56.0 s: C#4 repeated, Eb4-E4, rising to Ab4/E5 (76-80 s) and A5 (83.5 s), the climb to the ff of 88-92 s.' },
  voiced(packNotes, 56, 92.5, (n) => n.m >= 52));
add('lassan-theme-return', { section: 'S9 Lassan theme returns', from: 212.4, to: 246.4, source: 'pack', pair: 'lassan-theme', rule: 'voiced line of pack notes >= 0.28 s, 212.4-246.4 s',
  hears: 'The lassan theme back in the low strings, now f (Ab2 pedal, then C#3-E3, B2-E3-Ab3), climbing from 236 s to C#5 and the ff.' },
  voiced(packNotes, 212.4, 246.4, ALL));
add('lassan-bass', { section: 'S2+S3+S9', from: 40.4, to: 251.5, source: 'pack', rule: 'lowest pack note below midi 50, >= 0.2 s, >= 0.35 s apart, in 40.4-92.5 and 212.4-251.5 s',
  hears: 'The bass under the lassan theme: the C#2/Ab1 roots, F#2-C#2 steps and the Ab2 pedal of 212-216 s. Slow, one note every second or two.' },
  [...lows(packNotes, 40.4, 92.5, 50, 0.2, 0, 0.35), ...lows(packNotes, 212.4, 251.5, 50, 0.2, 0, 0.35)]);
add('lassan-ff-peaks', { section: 'S3+S9 peaks', from: 56, to: 251.5, source: 'pack', rule: 'pack clusters in 56-92.5 and 236-251.5 s with >= 2 notes and loudest >= 99; lowest and highest note',
  hears: 'The accented chords at the tops of the two big lassan crescendi (76-92 s and 236-251 s): ff, heavy, a few seconds apart.' },
  [...blows(packNotes, 56, 92.5, 2, 99), ...blows(packNotes, 236, 251.5, 2, 99)]);
add('climax-strokes', { section: 'S10 Climax strokes', from: 246.4, to: 251.5, source: 'pack', rule: 'pack clusters 246.4-251.5 s; lowest and highest note',
  hears: 'The lassan climax: a Bb1 diminished chord (246.5), G/E (247), the Ab chord (248.0), Ab1 (249.3) and the A1/A2 blow (250.5, the loudest moment of the lassan), cut off at 251.5 s into silence.' },
  blows(packNotes, 246.4, 251.5, 1, 0));

// S4 92.5-103.9 clarinet cadenza I  ·  S11 251.5-264.5 clarinet cadenza II
add('clarinet-cadenza-1', { section: 'S4 Clarinet cadenza I', from: 92.5, to: 100, rule: 'roll clarinet notes 92.5-100 s',
  hears: 'After the ff breaks off (92.5 s), the clarinet alone: a soft flourish rising G4-Bb4-C#5-Eb5-G5-Bb5 to C#6/Eb6 (95-96 s) and winding down to B4 (99.6 s), the cimbalom imitated by a wind.' },
  inWin(roll, 92.5, 100, (n) => n.track === 'clarinet'));
add('cadenza-hush-knocks', { section: 'S4 hush', from: 99.9, to: 103.9, source: 'audio', rule: 'audio onsets 99.9-103.9 s (pitch: strongest chroma)',
  hears: 'Five soft re-touches of a held B4 (-26 to -32 dB) in the hush after the cadenza, where the transcription has nothing (100.2-103.3 s).' },
  inWin(AUDIO, 99.9, 103.9));
add('clarinet-cadenza-2', { section: 'S11 Clarinet cadenza II', from: 252.9, to: 262, rule: 'roll clarinet notes and pack notes >= G3, 252.9-262 s, lane doubles merged',
  hears: 'The second cadenza after the climax cut-off: the clarinet rises by step G3-A3-Bb3 ... D5-Eb5-F5 to Ab5 (253.0-255.5 s) and trills Ab5-A5 slowly to 261.5 s, very soft.' },
  [...inWin(roll, 252.9, 262, (n) => n.track === 'clarinet'), ...inWin(packNotes, 252.9, 262, (n) => n.m >= 55)]);

// S5 103.9-131.0 G# major interlude  ·  S6 131.0-160.0 the lilting dance  ·  S7 160.0-173.9 trill and clarinet sinking
add('gsharp-repeats', { section: 'S5 G# interlude', from: 103.9, to: 113, source: 'pack', rule: 'pack notes Ab4 (G#4, midi 68) 103.9-113 s',
  hears: 'A quiet G#4 tapped again and again (104.0-112.0 s, p), the pivot from the lassan into the lighter G# major interlude.' },
  inWin(packNotes, 103.9, 113, (n) => n.m === 68));
add('clarinet-garlands', { section: 'S5 G# interlude', from: 110, to: 131, rule: 'roll clarinet notes 110-131 s',
  hears: 'The clarinet\'s garlands over the strings, F#5-A5-B5 turns and falling Eb5-B4 figures (113-131 s), p.' },
  inWin(roll, 110, 131, (n) => n.track === 'clarinet'));
add('interlude-line', { section: 'S5 G# interlude', from: 103.9, to: 131, source: 'pack', rule: 'voiced line of pack notes >= 0.2 s, midi >= 56, 103.9-131 s',
  hears: 'The interlude\'s singing line in G# major (Ab4-C5-Eb4-C4 arpeggios, B4-Ab4, C#5-E5): gentle, mid-high.' },
  voiced(packNotes, 103.9, 131, (n) => n.m >= 56, 0.2));
add('dance-lilt', { section: 'S6 Lilting dance', from: 131, to: 160, source: 'pack', rule: 'voiced line of pack notes >= 0.2 s, midi >= 56, 131-160 s, outside the glitter (136.5-147.5 s notes >= C6 excluded)',
  hears: 'The lilting dance: strings and winds in a swaying G#-major tune that speeds up (pulse 0.53 s at 132 s, 0.41 s at 156 s), Eb5-C#5-Ab4 and C5-Bb4-Ab4 figures.' },
  voiced(packNotes, 131, 160, (n) => n.m >= 56 && !(n.t >= 136.5 && n.t < 147.5 && n.m >= 84), 0.2));
add('dance-pedal', { section: 'S6 Lilting dance', from: 131, to: 160, source: 'pack', rule: 'lowest pack note below midi 50, >= 0.3 s apart, 131-160 s',
  hears: 'The G#2 drone under the dance (the plucked/pizzicato Ab2 every half second at 135-137 s, then every second or so): a steady low pulse.' },
  lows(packNotes, 131, 160, 50, 0, 0, 0.3));
add('glitter-1', { section: 'S6 glitter', from: 136.5, to: 147.5, source: 'pack', rule: 'pack notes >= C6 (84) in 136.5-147.5 s',
  hears: 'The first glitter: high sparkles flicked up to E7/Eb7 (140.3-140.6 s) and A6/Ab6 (142-147 s), loud and brief, the cimbalom\'s top.' },
  inWin(packNotes, 136.5, 147.5, (n) => n.m >= 84));
add('high-alternation', { section: 'S7 High trill', from: 160, to: 166.5, source: 'pack', rule: 'pack notes >= C#5 (73) in 160-166.5 s',
  hears: 'C#6 and Eb6 alternating high and loud (160-165 s), a slow shake before the music sinks.' },
  inWin(packNotes, 160, 166.5, (n) => n.m >= 73));
add('clarinet-sinking', { section: 'S7 Clarinet sinking', from: 166, to: 173.9, rule: 'roll clarinet notes 166-173.9 s',
  hears: 'The clarinet sinking from C6 down to C#4 and circling C#4-F4-Eb4 three times, pp (166.0-172.5 s), the last breath before the Lento returns.' },
  inWin(roll, 166, 173.9, (n) => n.track === 'clarinet'));

// S12 264.5-307.0 the A-major song  ·  S13 307.0-355.5 the dissolve  ·  S14 355.5-363.4 dominant swell and grand pause
add('a-major-song', { section: 'S12 A-major song', from: 264.5, to: 307, source: 'pack', rule: 'voiced line of pack notes >= 0.28 s, midi >= 57, 264.5-307 s',
  hears: 'A tender song in A major/F# minor in the violins, p (A4-C#5-A4, up to C#6/Eb6 at 267-270 s, then Ab5-E5, C#5-A4 phrases): the lassan\'s one lyrical patch.' },
  voiced(packNotes, 264.5, 307, (n) => n.m >= 57));
add('a-major-bass', { section: 'S12 A-major song', from: 264.5, to: 307, source: 'pack', rule: 'lowest pack note below midi 52, >= 0.2 s, >= 0.5 s apart, 264.5-307 s',
  hears: 'The soft bass of the song: E2, F#2, A2, C#3, a note every few seconds.' },
  lows(packNotes, 264.5, 307, 52, 0.2, 0, 0.5));
add('harp-arpeggio', { section: 'S12 A-major song', from: 290, to: 304, rule: 'roll piano and plucked notes 290-304 s (YourMT3+ labels; the sound is a plucked/keyboard colour)',
  hears: 'The rolled chords that colour the song (A-C#-E at 290.3-292.8 s, C5-C#5-Eb5-E5 at 293.2-294.1, A major at 301.9, F# minor at 303.0): harp-like, soft.' },
  inWin(roll, 290, 304, (n) => n.track === 'piano' || n.track === 'plucked'));
add('dissolve-murmur', { section: 'S13 Dissolve', from: 307, to: 355.5, source: 'pack', rule: 'pack notes 307-355.5 s, of each cluster the lowest',
  hears: 'The lassan dissolving: pp low strings (-25 to -34 dB), B2-D3-F#3 and C#3-E3 chords, the C#3 repeated at 332-338 s, then the Ab1 shudder of 344-355 s. The lanes are empty here (only a few cello notes): use this set, not a track.' },
  clusters(inWin(packNotes, 307, 355.5)).map((c) => c.low));
add('dissolve-audio', { section: 'S13 Dissolve', from: 307, to: 330, source: 'audio', rule: 'audio onsets 307-330 s (pitch: strongest chroma)',
  hears: 'The faintest touches of the dissolve as the microphone hears them (308-330 s, -27 to -36 dB): low F#3/A2/C#3 and stray high A4/B4. For widgets that must keep breathing where the notes are 1-3 a second.' },
  inWin(AUDIO, 307, 330));
add('dominant-swell', { section: 'S14 Dominant swell', from: 355, to: 361.5, source: 'mixed', rule: 'pack notes 355-358 s and audio onsets 355.5-361.5 s where the pack has none within 0.12 s',
  hears: 'The swell on C# (the dominant of F#): F1/F3, C#2 strokes rising to -16 dB at 357.5 s, then fading out to the grand pause (361.5-363.4 s, -44 dB, true silence).' },
  fillGaps(inWin(packNotes, 355, 358), inWin(AUDIO, 355.5, 361.5)));

// ===================================== FRISKA (363.4 - 628 s) =====================================
// S15 363.4-385.0 dawn  ·  S16 385.0-410.4 strings take it  ·  S17 410.4-421.0 first tutti
add('friska-dawn', { section: 'S15 Friska dawn', from: 363.4, to: 385, source: 'mixed', rule: 'pack notes >= C5 (72) 363.4-385 s, with audio onsets filled in where the pack has none within 0.12 s',
  hears: 'The friska begins pp, high and light: the clarinet (and high winds) tapping the F# minor tune, Ab5-F#5-C#6-A5 staccato, F#6/A6 points (363.6-384.8 s). The first 5 s have no transcribed notes: these are the audio\'s onsets.' },
  fillGaps(inWin(packNotes, 363.4, 385, (n) => n.m >= 72), inWin(AUDIO, 363.4, 385)));
add('friska-strings-theme', { section: 'S16 Strings take the friska', from: 385, to: 410.4, source: 'mixed', rule: 'skyline of roll violin notes >= 0.05 s, 385-410.4 s; pack notes >= C4 fill 385-387 s and gaps of 0.12 s',
  hears: 'The violins take the friska tune (from 385.0 s): the staccato C#5 struck over and over, every ~0.2 s, with A4/F#4/Ab4 dips and Ab5-A5 leaps (391-395 s), growing from p to f as F# minor turns to F# major (399-405 s).' },
  fillGaps(skyline(roll, 385, 410.4, (n) => n.track === 'violin', 0.05), skyline(packNotes, 385, 410.4, (n) => n.m >= 60, 0.05)));
add('friska-vamp-bass', { section: 'S16-S19 Friska bass', from: 385, to: 480.6, source: 'pack', rule: 'lowest pack note below midi 55, >= 0.25 s apart, 385-410.4 and 421-480.6 s',
  hears: 'The friska\'s oom-pah bass, C#3/F#2/A3 alternating with the chords: the dance\'s legs, a note every half second.' },
  [...lows(packNotes, 385, 410.4, 55, 0, 0, 0.25), ...lows(packNotes, 421, 480.6, 55, 0, 0, 0.25)]);
add('cimbalom-tremolo', { section: 'S16+S22 Cimbalom tremolo', from: 407, to: 525, rule: 'roll plucked notes 407-410 and 522-525 s',
  hears: 'The cimbalom tremolo, a chord shaken fast (every ~0.15 s): C#-Ab-F#-Bb chords at 407.6-409.5 s, just before the first tutti, and an Eb3/Ab3 shimmer at 522.3-524 s in the dip.' },
  [...inWin(roll, 407, 410, (n) => n.track === 'plucked'), ...inWin(roll, 522, 525, (n) => n.track === 'plucked')]);
add('tutti-1-blows', { section: 'S17 First tutti', from: 410.4, to: 421, source: 'pack', rule: 'pack clusters 410.4-421 s with >= 3 notes and loudest >= 90; lowest and highest note',
  hears: 'The first friska tutti in F# major, ff: full chords hammered from C#1/Bb0 to F6 (410.5-420.5 s), about one a second.' },
  blows(packNotes, 410.4, 421, 3, 90));
add('deep-tolls', { section: 'Friska tutti', from: 410, to: 628, source: 'pack', rule: 'lowest pack note <= C#2 (37) with velocity >= 80, >= 0.3 s apart, 410-628 s',
  hears: 'The deepest blows of the friska, Bb0/C#1/Bb1 struck under the tutti chords (411-420, 484-500, 536-570 s, and the last chords 620-627 s). Ff, the floor shaking.' },
  lows(packNotes, 410, 628, 38, 0, 80, 0.3));

// S18 421.0-456.0 the friska tune in F# major  ·  S19 456.0-480.6 second build  ·  S20 480.6-500.4 stomping tutti
add('friska-tune', { section: 'S18 Friska tune', from: 421, to: 438, source: 'pack', rule: 'skyline of pack notes >= 0.1 s, midi >= 72, 421-438 s',
  hears: 'The friska tune proper in F# major, light (p-mf): the violins\' C6-C#6 neighbour-note shake (C#6-C6-C#6-C6-Eb6), F#6 and Bb5 answers (421-438 s).' },
  skyline(packNotes, 421, 438, (n) => n.m >= 72, 0.1));
add('friska-offbeats', { section: 'S18 Friska tune', from: 421, to: 456, source: 'pack', rule: 'pack clusters 421-456 s with >= 3 notes between midi 49 and 79; lowest and highest note',
  hears: 'The off-beat chords under the tune (the "pah" of oom-pah), mid register, light and regular.' },
  blows(packNotes, 421, 456, 3, 0, (n) => n.m >= 49 && n.m <= 79));
add('glitter-2', { section: 'S18 glitter', from: 438, to: 453, source: 'pack', rule: 'pack notes >= C6 (84) in 438-453 s',
  hears: 'The friska\'s glitter: the tune flicked up to Eb7/F#7 (438-453 s), bright high points over the dance.' },
  inWin(packNotes, 438, 453, (n) => n.m >= 84));
add('voice-line-friska', { section: 'S18 Friska tune', from: 446, to: 453, rule: 'roll voice notes 446-453 s (a YourMT3+ "voice" label: a woodwind line, label unsure)',
  hears: 'A falling wind line (Eb4-C#4-C#4-E4-Bb4-Ab4-F#4-E4-Eb4-C#4, 446.7-452.4 s) answering the glitter.' },
  inWin(roll, 446, 453, (n) => n.track === 'voice'));
add('build-2-line', { section: 'S19 Second build', from: 456, to: 480.6, source: 'pack', rule: 'skyline of pack notes >= 0.15 s, midi >= 60, 456-480.6 s',
  hears: 'The second build: the tune restarted p at 456 s (B4-Ab4-F4, C#5-Bb4), climbing to F6/Eb6 by 474-479 s.' },
  skyline(packNotes, 456, 480.6, (n) => n.m >= 60, 0.15));
add('dominant-pedal', { section: 'S19 Second build', from: 466, to: 480.6, source: 'pack', rule: 'pack notes Ab2 (G#2, midi 44) and Ab1 (32) 466-480.6 s',
  hears: 'The G# pedal that holds the second build in suspense (468-480 s): a low note insisting before the stomp.' },
  inWin(packNotes, 466, 480.6, (n) => n.m === 44 || n.m === 32));
add('stomp-blows', { section: 'S20 Stomping tutti', from: 480.6, to: 500.4, source: 'pack', rule: 'pack clusters 480.6-500.4 s with >= 3 notes and loudest >= 100; lowest and highest note',
  hears: 'The stomping tutti, ff (480.6-500.4 s, peak at 488 s): hammered chords on Bb1/C#2, two a second.' },
  blows(packNotes, 480.6, 500.4, 3, 100));
add('brass-descents', { section: 'S20+S24 Brass', from: 487, to: 553, rule: 'roll brass notes (YourMT3+ "brass", 36 notes)',
  hears: 'Two brass descents in octaves through the tutti: Bb-F-Ab-F#-F-E-Eb (487.8-489.4 s) and C#-B-A-Ab-F#-E (551.1-552.6 s).' },
  inWin(roll, 487, 553, (n) => n.track === 'brass'));

// S21 500.4-510.3 high whirl  ·  S22 510.3-526.5 the dip  ·  S23 526.5-539.4 fireworks and the plunge
add('high-whirl', { section: 'S21 High whirl', from: 500.4, to: 510.3, source: 'pack', rule: 'pack notes >= F#6 (90) in 500.4-510.3 s',
  hears: 'The violins whirling at the top, F#6-C#7-Eb7-Bb6-F#7 (500.4-510 s), loud and fast, after the stomp.' },
  inWin(packNotes, 500.4, 510.3, (n) => n.m >= 90));
add('dip-line', { section: 'S22 The dip', from: 510.3, to: 526.5, source: 'pack', rule: 'skyline of pack notes >= 0.12 s, midi >= 55, 510.3-526.5 s',
  hears: 'The sudden p after the whirl (510.3 s): the tune murmured mid-register (C#4-B3-Bb3, Ab3-F3-G3), gathering speed (pulse 0.34 to 0.31 s) towards the fireworks.' },
  skyline(packNotes, 510.3, 526.5, (n) => n.m >= 55, 0.12));
add('fireworks', { section: 'S23 Fireworks', from: 526.5, to: 534.5, source: 'pack', rule: 'pack notes >= C7 (96) in 526.5-534.5 s',
  hears: 'The burst at the top: the highest notes of the piece, single notes flung F7-Ab6-F#7-Eb7-C7-G7 (527.0-534 s), ff. A spray of sparks, not chord blows (for Fireworks use the chord-blow sets).' },
  inWin(packNotes, 526.5, 534.5, (n) => n.m >= 96));
add('plunge', { section: 'S23 The plunge', from: 533.5, to: 539.5, source: 'pack', rule: 'lowest pack note below midi 52, >= 0.15 s apart, 533.5-539.5 s',
  hears: 'The plunge from the top to the bass: Ab2-Bb1-G1-Eb2-A1, F2-C1 (533.5-539 s), the floor reached before the loudest stomp.' },
  lows(packNotes, 533.5, 539.5, 52, 0, 0, 0.15));

// S24 539.4-570.4 the loudest stomp  ·  S25 570.4-584.0 high tremolo  ·  S26 584.0-605.6 prestissimo  ·  S27-S28 the end
add('loudest-stomp-blows', { section: 'S24 Loudest stomp', from: 539.4, to: 570.4, source: 'pack', rule: 'pack clusters 539.4-570.4 s with >= 3 notes and loudest >= 100, >= 0.3 s after the last kept; lowest and highest note',
  hears: 'The loudest stretch of the piece (539.4-570.4 s, -1 to -8 dB): tutti chords stamped on C#2/Bb1, A major and E major swerves at 546-562 s, then the C# hammering of 564-570 s.' },
  (() => { const cs = clusters(inWin(packNotes, 539.4, 570.4)).filter((c) => c.ns.length >= 3 && c.vmax >= 100); const keep = []; for (const c of cs) if (!keep.length || c.t - keep[keep.length - 1].t >= 0.3) keep.push(c); return keep.flatMap((c) => [...new Set([c.low, c.top])]); })());
add('stomp-bursts', { section: 'S24 Loudest stomp', from: 555, to: 565, rule: 'roll clusters 557.0-558.0, 559.0-560.5 and 563.0-564.0 s (the dense bursts, 47-73 notes a second); of each the lowest and highest note',
  hears: 'Three bursts inside the stomp, every ~0.1 s: octave chords stepping down C#-E-B-A-Ab-G over a C# pedal (557.0-557.9 s), D octaves then an A chord pounded (559.1-560.4 s), and the A-major chord hammered (563.0-563.9 s).' },
  [...blows(roll, 557, 558, 1, 0), ...blows(roll, 559, 560.5, 1, 0), ...blows(roll, 563, 564, 1, 0)]);
add('high-tremolo', { section: 'S25 High tremolo', from: 570.4, to: 584, source: 'pack', rule: 'pack notes >= C#6 (85) in 570.4-584 s',
  hears: 'The violins\' high C#7-Eb7 (and F7) tremolo after the stomp breaks off (570.4 s), dying away from -13 to -28 dB by 583.6 s: the place of the cadenza, a shimmer thinning out.' },
  inWin(packNotes, 570.4, 584, (n) => n.m >= 85));
add('prestissimo-repeats', { section: 'S26 Prestissimo', from: 584, to: 605.6, source: 'pack', rule: 'pack notes >= F#4 (66) in 584-605.6 s',
  hears: 'The prestissimo begins pp: the A4-C#5 and B4-C#5 alternations repeated fast (584-602 s), mid-high, a whisper that keeps accelerating. The lanes are empty here: use this set.' },
  inWin(packNotes, 584, 605.6, (n) => n.m >= 66));
add('prestissimo-bass', { section: 'S26 Prestissimo', from: 584, to: 605.6, source: 'pack', rule: 'pack notes below F#3 (54) in 584-605.6 s',
  hears: 'The C#3 repeated under the prestissimo (with F#2): a dry pulse.' },
  inWin(packNotes, 584, 605.6, (n) => n.m < 54));
add('stretta-chords', { section: 'S27 Final stretta', from: 605.6, to: 619.6, source: 'pack', rule: 'pack clusters 605.6-619.6 s with >= 3 notes; lowest and highest note',
  hears: 'The final stretta: chords rising from pp (605.6 s) to ff (612-619 s), F#2/C#2 bass, B5/C#5/Bb5 repeated at the top.' },
  blows(packNotes, 605.6, 619.6, 3, 0));
add('final-chords', { section: 'S28 Last chords', from: 618.9, to: 628, source: 'pack', rule: 'pack clusters 618.9-628 s; lowest and highest note',
  hears: 'The last blows: the B chord at 619.0 s, a rest, the Bb0/A1 blow at 620.5 s (held to 622), C#3 strokes (622.5-623) and the F# major chords at 624.5-627.0 s. The sound ends at 628 s.' },
  blows(packNotes, 618.9, 628, 1, 0));

add('friska-violins', { section: 'S18-S24 Friska', from: 421, to: 570.4, rule: 'skyline of roll violin notes >= 0.08 s, 421-570.4 s',
  hears: 'The violins\' line through the friska proper, on the roll: the tune\'s neighbour-note shake, its staccato repeats, the whirls and the stomps\' top (421-570 s). The friska\'s continuous melodic thread.' },
  skyline(roll, 421, 570.4, (n) => n.track === 'violin', 0.08));

// ===================================== WHOLE-PIECE STRANDS =====================================
add('violin-line', { section: 'whole', from: 0, to: 631.3, rule: 'skyline of roll violin notes >= 0.15 s',
  hears: 'The violins\' top line wherever YourMT3+ hears them (2039 notes; thick in 56-92, 131-160, 216-250, 385-575 s; empty in 307-384 and 584-604 s).' },
  skyline(roll, 0, 631.3, (n) => n.track === 'violin', 0.15));
add('viola-inner', { section: 'whole', from: 0, to: 631.3, rule: 'voiced line of roll viola notes >= 0.2 s',
  hears: 'The violas\' inner line (YourMT3+ lane): the middle voice of the tutti, held notes.' },
  voiced(roll, 0, 631.3, (n) => n.track === 'viola', 0.2));
add('cello-line', { section: 'whole', from: 0, to: 631.3, rule: 'lowest roll cello note of each cluster, >= 0.2 s, >= 0.15 s apart',
  hears: 'The cellos\' line from the bottom (YourMT3+ lane, 1802 notes): the lassan theme\'s voice at 40-56 and 212-236 s, the friska\'s bass.' },
  lows(roll.filter((n) => n.track === 'cello'), 0, 631.3, 128, 0.2, 0, 0.15));
add('clarinet-all', { section: 'whole', from: 0, to: 631.3, rule: 'every roll clarinet note',
  hears: 'Every clarinet note (154): the two cadenzas (93-100, 253-262 s), the garlands of 110-131 s, the sinking of 166-173 s and the friska\'s dawn (368-377 s). The solo voice of the piece.' },
  inWin(roll, 0, 631.3, (n) => n.track === 'clarinet'));
add('melody-all', { section: 'whole', from: 0, to: 631.3, source: 'pack', rule: 'voiced line of pack notes >= 0.28 s, midi >= 55 (and >= 0.15 s in the friska from 385 s), minus the dissolve',
  hears: 'The voiced-out tune of the whole piece, one held note at a time: the declamations, the lassan theme, the songs, the friska tune. An always-on thread.' },
  [...voiced(packNotes, 0, 385, (n) => n.m >= 55 && !(n.t >= 307 && n.t < 363.4)), ...voiced(packNotes, 385, 631.3, (n) => n.m >= 55, 0.15)]);
add('bass-all', { section: 'whole', from: 0, to: 631.3, source: 'pack', rule: 'lowest pack note below midi 50, >= 0.2 s, >= 0.4 s apart',
  hears: 'The bass of the whole piece, one note at least 0.4 s after the last: the Lento\'s tolls, the lassan\'s roots, the dissolve\'s low strings, the friska\'s oom-pah and blows.' },
  lows(packNotes, 0, 631.3, 50, 0.2, 0, 0.4));
add('ff-blows', { section: 'whole', from: 0, to: 631.3, source: 'pack', rule: 'pack clusters with >= 3 notes, loudest >= 105 and a note below midi 50; lowest and highest note',
  hears: 'Every real ff blow of the piece: full chords of 3+ notes at velocity 105+ that reach into the bass (the friska tuttis at 411-420, 480-500, 536-570 s, the stretta and the last chords). The set for Fireworks.' },
  clusters(packNotes).filter((c) => c.ns.length >= 3 && c.vmax >= 105 && c.low.m < 50).flatMap((c) => [...new Set([c.low, c.top])]));
add('long-tones', { section: 'whole', from: 0, to: 631.3, source: 'pack', rule: 'pack notes held >= 1.5 s with velocity >= 55; of each cluster the loudest',
  hears: 'The long, slow notes (held 1.5 s or more): the Lento\'s held chords, the lassan\'s sustained tones, the dissolve. For handovers and slow morphs.' },
  clusters(inWin(packNotes, 0, 631.3, (n) => dur(n) >= 1.5 && n.v >= 55)).map((c) => c.loud));
add('runs', { section: 'whole', from: 0, to: 631.3, source: 'pack', rule: 'runs() on the cluster tops: >= 5 successive attacks <= 0.16 s apart, steps of 1-4 semitones in one direction (one turn allowed)',
  hears: 'The fast scales and flourishes: the clarinet cadenzas, the glitter, the descending octave runs and rushing scales of the friska.' },
  runs(packNotes, 0, 631.3, 5, 0.16));
add('repeats', { section: 'whole', from: 0, to: 631.3, source: 'pack', rule: 'repeats() on the top and the bottom note of each pack cluster: one pitch struck >= 5 times in a row, each 0.08-0.4 s after the last',
  hears: 'The repeated notes, top or bottom of the texture: the Lento\'s B3 knocks, the G#4 taps (104-112 s), the dance\'s G#2 drone, the dissolve\'s C#3 and Ab1, the friska\'s pounded C#s and the prestissimo\'s C#3.' },
  (() => { const cs = clusters(packNotes); const tops = cs.map((c) => c.top), bots = cs.filter((c) => c.ns.length > 1).map((c) => c.low);
    return [...repeats(tops, 0, 631.3, 5, 0.4), ...repeats(bots, 0, 631.3, 5, 0.4)]; })());

// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (!(n[1] > n[0]) || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127) throw new Error(`${s.id} bad note ${n}`);
  if (s.notes[0][0] < s.from - 1e-6 || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside ${s.from}-${s.to}`);
}
if (new Set(sets.map((s) => s.id)).size !== sets.length) throw new Error('duplicate set id');
sets.sort((a, b) => a.notes[0][0] - b.notes[0][0] || a.id.localeCompare(b.id));
const out = {};
for (const s of sets) {
  const first = s.notes[0][0], last = s.notes[s.notes.length - 1][0];
  out[s.id] = { hears: s.hears, section: s.section, source: s.source ?? 'roll', ...(s.pair ? { pair: s.pair } : {}), rule: s.rule,
    span: [first, last], count: s.notes.length, attacks: s.attacks, notes: s.notes };
}
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]').replace(/"span": \[\s+([-\d.]+),\s+([-\d.]+)\s+\]/g, '"span": [$1, $2]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');
for (const s of sets) {
  const a = s.notes[0][0], b = s.notes[s.notes.length - 1][0];
  console.log(`${s.id.padEnd(27)} ${String(s.attacks).padStart(4)} att ${(s.attacks / Math.max(1, b - a)).toFixed(1).padStart(4)}/s ${String(s.notes.length).padStart(4)} n ${a.toFixed(1).padStart(6)}-${b.toFixed(1).padEnd(6)} ${(s.source ?? 'roll').padEnd(5)} | ${s.notes.slice(0, 12).map((n) => nm(n[2]) + ':' + n[3]).join(' ')}`);
}
console.log(sets.length, 'sets');
