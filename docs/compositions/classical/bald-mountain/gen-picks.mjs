// Pick sets for Mussorgsky / Rimsky-Korsakov, Night on Bald Mountain (songs/bald-mountain), deterministic.
// Run: node docs/compositions/classical/bald-mountain/gen-picks.mjs
//   -> writes picks.json next to this file: { "<set id>": { "hears": "...", "notes": [[start, end, midi, velocity], ...] } },
//      each set sorted by start, and prints per set: notes, attacks, span, first pitches, and the per-30 s attack table that
//      ANALYSIS.md calls the weight table.
// Only `notes` goes into a show: a show's pick set may hold no other key (`hears` is for the composer).
//
// Note sources.
// - The ROLL is pack.tracks (YourMT3+ tracks with their own velocities): this pack has tracks, so the studio's note picker
//   (src/studio/ui/picker-logic.ts pickerNotes, first branch) shows exactly these notes, and picks match them on its roll.
//   About 90 % of the track velocities are derived from the loudness curve, so they are flat inside a passage: "loudest of
//   its chord" breaks ties by the top pitch.
// - PACK = pack.notes (the piano transcriber, with YourMT3+ in its gaps): better for the deep bass and the tutti blows.
//   Sets that take it say so in `hears`; their notes may show in the picker as "not on the roll".
// - AUDIO = onsets measured with librosa (C:/Users/maxim/.venvs/wa/Scripts/python.exe -I): onset_strength + onset_detect on
//   the mono 22050 Hz mix (hop 512 for the whole piece; hop 256, delta 0.03, wait 8 for the bell), rms in dB relative to the
//   loudest frame, chroma_cqt over the 4 frames after the onset. The numbers are pasted below as constants, so this file
//   needs nothing but the pack. An audio-derived note's velocity is v = clamp(118 + 2.5 * dB, 20, 120) (−4 dB → 108,
//   −28 dB → 48), its pitch the onset's chroma class, placed in the register named per set.
//
// YourMT3+ cuts held and tremolo strings into 0.1 s slices (the D-A-D-F# chord at 440.4-442.4, the cello D2 under the
// dawn). Every set except the raw ones below first MERGES such runs: same track, same pitch, slices <= 0.16 s, gaps <= 0.06 s
// become one held note (the loudest slice's velocity). Without it a held-note filter drops exactly the sustained notes and a
// set would strobe a widget at 10 Hz on one bowed note: a fake attack in all but name.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const pack = JSON.parse(readFileSync(join(ROOT, 'songs/bald-mountain/pack.json'), 'utf8'));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const DUR = pack.duration;
const audioVel = (db) => Math.max(20, Math.min(120, Math.round(118 + 2.5 * db)));

// ---- the notes ----
const roll = Object.entries(pack.tracks)
  .flatMap(([tr, { notes }]) => notes.map(([t, e, m, v], k) => ({ t, e, m, v, tr, k })))
  .sort((a, b) => a.t - b.t || a.m - b.m || a.k - b.k);
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, tr: 'pack', k })).sort((a, b) => a.t - b.t || a.m - b.m || a.k - b.k);

/** Tremolo / held-note slices joined: same track and pitch, slices <= 0.16 s, gap <= 0.06 s. */
function merge(ns, gap = 0.06, slice = 0.16) {
  const by = new Map();
  for (const n of ns) { const key = `${n.tr}|${n.m}`; if (!by.has(key)) by.set(key, []); by.get(key).push(n); }
  const out = [];
  for (const list of by.values()) {
    list.sort((a, b) => a.t - b.t);
    let cur = null;
    for (const n of list) {
      if (cur && n.t - cur.e <= gap && n.t >= cur.t && (cur.slices > 1 ? true : cur.e - cur.t <= slice) && n.e - n.t <= slice + 0.4) {
        cur.e = Math.max(cur.e, n.e); cur.slices++; cur.v = Math.max(cur.v, n.v);
      } else { cur = { ...n, slices: 1 }; out.push(cur); }
    }
  }
  return out.sort((a, b) => a.t - b.t || a.m - b.m);
}
const ROLL = merge(roll), PACK = merge(packNotes);

/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; if (n.v > cur.loud.v || (n.v === cur.loud.v && n.m > cur.loud.m)) cur.loud = n; }
    else { cur = { t: n.t, ns: [n], top: n, low: n, loud: n }; out.push(cur); }
  }
  return out;
}
const inWin = (src, a, b, f = () => true) => src.filter((n) => n.t >= a && n.t < b && f(n));
const windows = (src, wins, f = () => true) => wins.flatMap(([a, b]) => inWin(src, a, b, f));
/** The voiced-out line: per cluster the loudest note (ties: the top), held >= minDur; skipped while a louder-or-equal,
    higher note begun within `hold` s still sounds (an accompaniment under a held melody note); a repeat of one pitch
    within 0.15 s dropped (doubled instruments). */
function lead(ns, minDur = 0.28, hold = 0.8, pick = 'loud') {
  const src = ns.filter((n) => n.e - n.t >= minDur);
  const out = [];
  for (const c of clusters(src)) {
    const n = c[pick];
    if (src.some((o) => o.t < c.t - 0.02 && o.t >= c.t - hold && o.e > c.t + 0.05 && o.m > n.m + 2 && o.v >= n.v - 4)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.m === n.m && c.t - prev.t < 0.15) continue;
    out.push(n);
  }
  return out;
}
/** One note per attack, at least `gap` s apart (the first of a crowd wins). */
function thin(ns, gap) { const out = []; for (const c of clusters(ns)) { if (out.length && c.t - out[out.length - 1].t < gap) continue; out.push(c.loud); } return out; }
/** Whirl gestures inside one track: a burst of >= 6 short attacks (top note < 0.16 s long, < 0.16 s apart) whose top line
    moves (>= 2 pitches; a bowed tremolo on one chord is not a whirl): one note per burst, its first, lasting to the end of
    the burst (and of the held note it lands on, if one starts within 0.26 s), at the burst's loudest velocity. */
function runs(ns, tracks) {
  const out = [];
  for (const tr of tracks) {
    const line = clusters(ns.filter((n) => n.tr === tr)).map((c) => c.top);
    let run = [];
    const flush = (next) => {
      if (run.length >= 6 && new Set(run.map((n) => n.m)).size >= 2) {
        const lastN = run[run.length - 1];
        const land = next && next.t - lastN.t < 0.26 && next.e - next.t >= 0.3 ? next.e : lastN.e;
        out.push({ ...run[0], e: land, v: Math.max(...run.map((n) => n.v)), len: run.length });
      }
      run = [];
    };
    for (const n of line) {
      const p = run[run.length - 1];
      const short = n.e - n.t < 0.16;
      if (short && (!p || n.t - p.t < 0.16)) run.push(n); else { flush(n); if (short) run = [n]; }
    }
    flush(null);
  }
  // runs in two string tracks at once (doublings) are one gesture: keep the first, 0.35 s apart
  out.sort((a, b) => a.t - b.t);
  const kept = [];
  for (const r of out) { const p = kept[kept.length - 1]; if (p && r.t - p.t < 0.5) { if (r.e > p.e) p.e = r.e; continue; } kept.push(r); }
  return kept;
}
const synth = (t, e, m, v) => ({ t, e, m, v, tr: 'audio' });
const near = (src, t, before = 0.06, after = 0.09) => src.filter((n) => n.t >= t - before && n.t <= t + after);

// ---- audio constants (librosa, see the header) ----
/** Strong onsets, whole piece: [t, onset strength, dB, chroma class], strength >= 3.5 and dB >= -10. */
const STRONG = [[16.37, 3.52, -6.8, 5], [29.838, 4, -8.1, 11], [40.263, 3.92, -8.6, 8], [61.161, 3.51, -6.8, 5], [73.12, 5.49, -7.1, 10], [73.166, 5.68, -5.4, 3], [75.256, 4.35, -7, 9], [79.064, 3.69, -8.1, 9], [85.983, 6.96, -4, 9], [120.001, 3.69, -6.3, 2], [122.323, 3.87, -8.3, 9], [124.018, 5.68, -6.9, 8], [140.783, 3.72, -3.9, 10], [156.526, 3.66, -5.2, 10], [198.066, 4.04, -9.9, 2], [205.404, 4.28, -7.6, 6], [282.587, 4.5, -9.6, 8], [283.725, 4.28, -6.6, 5], [298.841, 3.72, -5.6, 5], [299.955, 3.54, -5.5, 5], [301.093, 4, -5, 0], [301.372, 4.5, -7.1, 6], [301.65, 4.64, -5.2, 0], [302.788, 3.53, -5.6, 5], [303.345, 4.31, -6.1, 5], [303.903, 3.63, -8.7, 5], [304.181, 4.43, -7.1, 1], [305.017, 3.87, -4.4, 0], [305.551, 3.51, -6.7, 5], [334.367, 4.67, -6.9, 10], [354.94, 4.63, -5.7, 9], [355.753, 3.57, -8, 8], [356.008, 3.54, -4.9, 4], [357.541, 3.71, -4.8, 4], [358.586, 4.65, -5.9, 9], [362.765, 5.21, -6.8, 9], [363.276, 3.58, -7.9, 10], [372.309, 4.02, -5, 9], [380.436, 3.75, -8.4, 9], [389.027, 5.56, -5.7, 2], [390.188, 3.99, -6.7, 2]];
/** Every onset 298.5-307.6 s (the hammer strokes): [t, strength, dB, chroma class]. */
const HAMMER = [[298.794, 2.93, -6.1, 5], [298.841, 3.72, -5.6, 5], [299.375, 2.16, -4.9, 5], [299.421, 2.5, -5.6, 5], [299.677, 2.89, -5.2, 1], [299.955, 3.54, -5.5, 5], [300.257, 3.48, -5.8, 5], [300.513, 2.83, -5.7, 9], [300.791, 2.83, -6.2, 1], [301.093, 4, -5, 0], [301.372, 4.5, -7.1, 6], [301.65, 4.64, -5.2, 0], [301.929, 3.17, -6.4, 6], [302.184, 2.64, -4, 5], [302.231, 3.21, -4.7, 5], [302.51, 1.9, -6.9, 5], [302.788, 3.53, -5.6, 5], [303.044, 2.51, -6.1, 1], [303.345, 4.31, -6.1, 5], [303.601, 2.72, -8.1, 5], [303.903, 3.63, -8.7, 5], [304.135, 2.54, -7.5, 1], [304.181, 4.43, -7.1, 1], [304.437, 3.28, -4.3, 0], [304.739, 2.99, -8.4, 0], [305.017, 3.87, -4.4, 0], [305.273, 2.31, -8.4, 0], [305.319, 2.05, -8.3, 1], [305.505, 3.01, -6.8, 5], [305.551, 3.51, -6.7, 5], [305.83, 3.94, -12.3, 5], [305.969, 2.22, -13.5, 5], [306.109, 2.3, -9.5, 5], [306.155, 2.44, -9.7, 5], [306.712, 6.53, -13.6, 5], [306.991, 4.04, -13.1, 0], [307.293, 3.77, -10.1, 0]];
/** The church bell on D (hop 256): [t, dB just after the stroke]. Chroma D first at every stroke, the level jumps from about
    −46 to −38 dB, about 1.55-1.9 s apart; 441.91 is faint (under the dying D chord), 445.64 is heard with Bb. The strings
    track has held D chords starting with 447.31, 448.84, 450.42, 451.93, 453.68 and 457.19. */
const BELL = [[441.91, -41.5], [444.30, -37.5], [445.64, -42.5], [447.33, -38.8], [448.88, -38.1], [450.41, -38.9], [451.97, -38.7], [453.71, -39.8], [455.48, -38.3], [457.21, -36.9], [459.08, -38.8]];
/** pyin (G4-E6, hop 256) in the closing wind solo: the held G5 the transcription misses in 546-551 s. */
const SOLO_AUDIO = [[548.29, 550.02, 79, -32]];

// ================= the sets =================
const sets = [];
function add(id, hears, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set();
  notes = notes.filter((n) => { const key = `${r4(n.t)}|${n.m}`; if (seen.has(key)) return false; seen.add(key); return true; });
  sets.push({ id, hears, notes: notes.map((n) => [r4(n.t), r4(Math.max(n.e, n.t + 0.05)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))]) });
}
const STR = ['violin', 'viola', 'cello', 'strings'];

// ---------- always-on threads (the whole piece) ----------
add('melody', 'The voiced-out line of the whole orchestra: per attack the loudest held note (>= 0.28 s, ties by the top pitch), all tracks, tremolo merged; under a held higher note the accompaniment is skipped. In the storm it is the brass and wind tunes above the whirling strings (the whirl is too short to pass); at dawn the violins\' chromatic rise and the wind solo.',
  lead(ROLL, 0.28));
add('violins-line', 'The violins\' held line (track violin, merged, >= 0.28 s, the top of each attack): the shrieking top of the tutti, the high cries over the D pedals, the dawn\'s rising chromatic octaves.',
  lead(inWin(ROLL, 0, DUR, (n) => n.tr === 'violin'), 0.28, 0.8, 'top'));
add('violas-line', 'The violas\' held line (track viola, merged, >= 0.28 s, the top of each attack): the middle of the orchestra, mostly the brass and horn tunes the transcriber put in the viola lane (there is no brass track), and the dawn\'s lower octave of the chromatic rise.',
  lead(inWin(ROLL, 0, DUR, (n) => n.tr === 'viola'), 0.28, 0.8, 'top'));
add('cellos-line', 'The cellos\' held line (track cello, merged, >= 0.28 s, the LOWEST of each attack): the low strings and low brass, the pedals (C at 23-28 s, D under the shrieks, the D2 drone of the dawn).',
  lead(inWin(ROLL, 0, DUR, (n) => n.tr === 'cello'), 0.28, 0.8, 'low'));
add('deep-bass', 'The deepest bass (PACK notes below G2 = MIDI 43, merged, the lowest of each attack, >= 0.12 s, at least 0.2 s apart): basses, tuba, contrabassoon and timpani, the C1/C2 tolls at 24-28 s, the Bb1 hammering at 156-161 s, the D1/D2 pedals of the final build.',
  thin(inWin(PACK, 0, DUR, (n) => n.m < 43 && n.e - n.t >= 0.12), 0.2).map((n) => n));
add('whirl', 'The whirl: fast stepwise string runs (>= 5 notes, < 0.2 s apart, steps <= 3 semitones, in the violin, viola or cello track), ONE note per run (its first, lasting the whole run): the subterranean swirling of the opening and every whirlwind after it. Not a mass of loose notes: a gesture each.',
  runs(inWin(roll, 0, 462), ['violin', 'viola', 'cello']));
add('high-cries', 'Everything at C6 (MIDI 84) and above, roll and pack merged, the top of each attack, >= 0.1 s, 0.12 s apart: piccolo and violin shrieks, the A6 cry at 40.95 s, Bb6/C#7 at 142.5 s, the octave cries E6/F6 over the D pedals.',
  thin([...inWin(ROLL, 0, DUR, (n) => n.m >= 84 && n.e - n.t >= 0.1), ...inWin(PACK, 0, DUR, (n) => n.m >= 84 && n.e - n.t >= 0.1)].sort((a, b) => a.t - b.t), 0.12));
add('winds-line', 'The track the transcriber calls clarinet, merged: the woodwind lines it hears (12 s, the wind fragments over the D pedal 100-115 s, 133-137 s, the low wind line in the hush at 164-168 s = probably bassoons, the D-pedal recall 395-399 s, and the closing solo 542-566 s). Thin: 157 notes in 580 s.',
  inWin(ROLL, 0, DUR, (n) => n.tr === 'clarinet'));
add('voice-calls', 'The track the transcriber calls voices: held calls (median 0.31 s, around F#4) with a horn-like timbre, in the brass climaxes (182-187, 246-253, 344-350, 411-415 s), the hush at 207-211 s and the dawn\'s horn answers (465-521 s). 154 notes, one attack each.',
  inWin(ROLL, 0, DUR, (n) => n.tr === 'voice'));
add('plucked-hits', 'The track the transcriber calls guitar and harp: short marcato strokes (median 0.12 s) that come in bursts exactly at the tutti blows (28.8, 61.5, 69.6, 120.8, 135, 184-189, 258, 262, 301, 313-318, 332-336, 372-378, 389-394, 424-430 s): the orchestra\'s hammered accents, not a real harp. One note per attack, 0.1 s apart.',
  thin(inWin(ROLL, 0, DUR, (n) => n.tr === 'plucked'), 0.1));

// ---------- the opening, the blasts, the pause ----------
add('opening-shimmer', 'The first sound and its return after the general pause: the violins\' pp trill on A5/Ab5/Bb5 at 2.06-3.3 s (out of silence) and on Bb5/B5 at 45.0-46.9 s (in the pause). Velocities about 20: a breath, not an attack.',
  [...inWin(ROLL, 2, 3.3, (n) => n.tr === 'violin' && n.m >= 79), ...inWin(ROLL, 44.9, 46.9, (n) => n.tr === 'violin' && n.m >= 79)]);
add('brass-blast', 'The two brass blasts that follow the whirl, the second a semitone up: 16.1-28.9 s (F, D, F, the Ab/B chord held 21.8-25 s, the C pedal) and 60.3-72.4 s (F#, F, D, C#). The voiced-out held line (all tracks, >= 0.3 s) of those windows. Pair with whirl-entries.',
  lead(windows(ROLL, [[16.1, 28.85], [60.2, 72.4]]), 0.3));
add('whirl-opening', 'The opening whirl and its return a semitone higher, gesture by gesture (the whirl rule, violin and viola tracks only): the violins\' swirl around A5/Ab5/Bb5, each burst landing on a held note, about every 2 s, 2.1-16.1 s (from out of silence) and 45.3-60.3 s (out of the general pause). The subterranean din; pair with brass-blast, which answers each.',
  runs(windows(roll, [[2.0, 16.1], [44.9, 60.3]]), ['violin', 'viola']));
add('db-blows', 'The repeated Db-major chord strokes (F3-C#3-Ab2-C#2) that close each blast: 28.93-29.9 s (v100 dying away) and 69.4-70.5 s. Lowest and highest note of each stroke (pack).',
  clusters(windows(packNotes, [[28.9, 30.0], [69.3, 70.6]])).filter((c) => c.ns.length >= 2).flatMap((c) => [...new Set([c.low, c.top])]));
add('d-pedal-repeats', 'The repeated low D (D2/D3) struck again and again, raw attacks at least 0.14 s apart: after the first blast (30.6-37.6 s), under the shrieks (91.5-115 s) and their recall (393.2-404.5 s). The music\'s pulse in its quiet stretches.',
  thin(windows(roll, [[30.6, 37.6], [91.5, 115], [393.2, 404.5]], (n) => n.m === 38 || n.m === 50), 0.14));
add('a-blow', 'The A cry and A-major tutti chord that end the first part: A6 at 40.95 s, the chord A2-E4-E5-A5 ff at 41.10 s held to 42.4 s, then the general pause. Merged (one attack, one held chord).',
  inWin(PACK, 40.9, 41.7, (n) => n.e - n.t >= 0.3));
add('dim-pulses', 'The pulsing diminished chords (Ab2-Ab3-D5-F#5-C6, then A-Eb-G) at 74.3-80.8 s: the spirits gathering, -10 to -15 dB, a chord every 0.3-0.5 s. Lowest and highest note of each pulse, 0.25 s apart.',
  thin(inWin(packNotes, 74.3, 80.9), 0.25).flatMap((n) => { const c = clusters(near(packNotes, n.t, 0.01, 0.04))[0]; return c ? [...new Set([c.low, c.top])] : [n]; }));
add('dominant-hammer', 'The hammering on A and D that ends the second part (83.6-91.9 s): D2-D4-A4-A5 chords, the A strike at 86.0 s (strongest onset of the first half), D chords, the A7 chord 90.6-91.6 s. Lowest and highest note per attack, 0.2 s apart.',
  thin(inWin(packNotes, 83.6, 91.9, (n) => n.v >= 55), 0.2).flatMap((n) => { const c = clusters(near(packNotes, n.t, 0.01, 0.04))[0]; return c ? [...new Set([c.low, c.top])] : [n]; }));
add('octave-cries', 'The shrieking octave cries (E5/E6, F5/F6, D6, A5) of the high winds and violins over the quiet D pedal, 99.9-112.1 s, and their recall 399.3-404.5 s (E5, F#6, E6/E5, D6). Pack notes at E5 and above.',
  windows(PACK, [[99.9, 112.2], [399.3, 404.6]], (n) => n.m >= 76));

// ---------- the middle: outbursts, the hush, the sabbath ----------
add('bass-strikes', 'The loud low strokes: PACK notes below G2 (MIDI 43) at velocity >= 85, merged, one per attack, 0.18 s apart: timpani, basses and tuba hitting (Bb1 ff 156.5-160.8 s, Bb0 at 143 s, the C1/D1 strokes of the sabbath and the final build).',
  thin(inWin(PACK, 0, DUR, (n) => n.m < 43 && n.v >= 85), 0.18));
add('high-figure', 'The bassless high passage 146.0-156.3 s (nothing below F3; F major, the A4-E5 oscillation, chords F3-F4-A4-E6, the ff A3-A4-G4 chord at 151.95 s): the witches\' figure in the air. Top of each attack, 0.12 s apart.',
  thin(inWin(ROLL, 146.0, 156.3, (n) => n.m >= 64), 0.12));
add('low-wind-hush', 'The quiet low passage 161.4-172.0 s (-18 to -23 dB, the darkest sound of the piece): the winding wind line the transcriber calls clarinet (C4-A3-Bb3-G3, then up to D5, 163.9-167.8 s; low reeds, probably bassoons) and the held voice-labelled calls G4-A4-D4 at 170.3-171.1 s. The strings\' rising scale at 168.0-169.4 s is in whirl.',
  inWin(ROLL, 161.4, 172.0, (n) => n.tr === 'clarinet' || n.tr === 'voice'));
add('eb-climax', 'The Eb-major climax chords 180.3-189.5 s (Bb3-Bb4 v105 at 183.6 s, the Eb chords 185.1-185.3 s, A3-A4-D4 at 188.25 s): lowest and highest note of each chord of >= 3 notes at velocity >= 90 (pack).',
  clusters(inWin(packNotes, 180.3, 189.6)).filter((c) => c.ns.length >= 2 && Math.max(...c.ns.map((n) => n.v)) >= 90).flatMap((c) => [...new Set([c.low, c.top])]));
add('hush-208', 'The hush 207.0-213.5 s (-25 to -30 dB): the soft held line the transcriber calls voices (C#4-D4-E4-F#4) and the few notes under it (roll, merged). The only notes there; the picture should not go black.',
  inWin(ROLL, 207.0, 213.5));
/** Chord strokes: pack clusters in [a, b) of >= minN notes whose loudest is >= minV, at least `gap` s apart; lowest and
    highest note of each. */
const chordStrokes = (a, b, minN, minV, gap) => {
  const out = []; let last = -9;
  for (const c of clusters(inWin(packNotes, a, b))) {
    if (c.ns.length < minN || c.loud.v < minV || c.t - last < gap) continue;
    last = c.t; out.push(...new Set([c.low, c.top]));
  }
  return out;
};
add('sabbath-chords', 'The sabbath\'s chord strokes 235.5-298.7 s (C# minor, then F minor from 276 s): pack chords of >= 2 notes at velocity >= 84, lowest and highest note, 0.25 s apart; with the Db/F blows 280.5-285.4 s (F5-Ab4 v111 at 282.55 s is the loudest note of the piece).',
  chordStrokes(235.5, 298.7, 2, 84, 0.25));
add('hammer-strokes', 'The hammer strokes 298.8-307.3 s: the most violent stretch, about 30 strokes 0.25-0.3 s apart on F and C (F-minor chords), the strongest audio onsets of the piece. From the AUDIO onsets (strength >= 2.3, merged within 0.08 s); each stroke takes the pack notes it has (lowest and highest), else F/C in two octaves from its chroma. Velocity from the audio level.',
  (() => {
    const out = []; let last = -1;
    for (const [t, s, db, pc] of HAMMER) {
      if (s < 2.3 || t - last < 0.08) continue; last = t;
      const c = clusters(near(packNotes, t, 0.07, 0.07))[0];
      const v = audioVel(db);
      if (c) out.push(...[...new Set([c.low, c.top])].map((n) => ({ ...n, v: Math.max(n.v, v) })));
      else out.push(synth(t, t + 0.22, 36 + pc, v), synth(t, t + 0.22, 60 + pc, v));
    }
    return out;
  })());
add('a-major-climax', 'The A-major climax 350.0-363.8 s: the ff chords A2-E4-A4-C#5 (v106 at 353.54 s) and their strikes (strong onsets 354.9-358.6 s, 362.8 s). Chords of >= 3 notes at velocity >= 90 and the strong onsets\' pack notes; lowest and highest.',
  [...clusters(inWin(packNotes, 350, 363.9)).filter((c) => c.ns.length >= 3 && Math.max(...c.ns.map((n) => n.v)) >= 90).flatMap((c) => [...new Set([c.low, c.top])]),
    ...STRONG.filter(([t]) => t >= 350 && t < 363.9).flatMap(([t, , db, pc]) => { const c = clusters(near(packNotes, t, 0.07, 0.07))[0]; return c ? [...new Set([c.low, c.top])] : [synth(t, t + 0.3, 45 + ((pc - 9 + 12) % 12), audioVel(db)), synth(t, t + 0.3, 69 + ((pc - 9 + 12) % 12), audioVel(db))]; })]);
add('final-build', 'The final build on D 404.0-440.4 s: pack chord strokes of >= 2 notes at velocity >= 82, lowest and highest, 0.25 s apart (the D1/D2 pedal strokes from 414 s, C#/Ab at 424 s, the D tutti octaves at 430.96 s), ending with the Bb3-Bb4-D5 hammering 434.4-437.9 s and the last tutti chord (Bb-Ab-D, Bb7) at 438.04 s held to 440.3 s.',
  chordStrokes(404, 438.0, 2, 82, 0.25).concat(inWin(PACK, 438.0, 438.1)));

// ---------- the ff blows (whole piece) ----------
add('ff-blows', 'The real ff tutti blows of the whole piece (not the hammer strokes, which have their own set): the strongest audio onsets (strength >= 3.5, level >= -10 dB) and the loud pack chords (>= 2 notes, velocity >= 98), joined within 0.3 s; each blow takes its pack notes (lowest, highest, loudest), else two notes from its chroma. Fireworks material: about one every 10 s in the storm, none in the quiet stretches or the dawn.',
  (() => {
    const cand = [
      ...STRONG.filter(([t]) => t < 298.5 || t > 307.6).map(([t, , db, pc]) => ({ t, db, pc })),
      ...clusters(packNotes).filter((c) => c.ns.length >= 2 && Math.max(...c.ns.map((n) => n.v)) >= 98 && (c.t < 298.5 || c.t > 307.6)).map((c) => ({ t: c.t, db: null, pc: c.loud.m % 12 })),
    ].sort((a, b) => a.t - b.t);
    const out = []; let last = -9;
    for (const b of cand) {
      if (b.t - last < 0.3) continue; last = b.t;
      const c = clusters(near(packNotes, b.t, 0.06, 0.08)).sort((x, y) => y.loud.v - x.loud.v)[0];
      const v = b.db === null ? 0 : audioVel(b.db);
      if (c) out.push(...[...new Set([c.low, c.top, c.loud])].map((n) => ({ ...n, v: Math.max(n.v, v) })));
      else out.push(synth(b.t, b.t + 0.3, 36 + b.pc, v), synth(b.t, b.t + 0.3, 60 + b.pc, v));
    }
    return out;
  })());
{
  // the peaks: the ff blows whose loudest note is >= 104, or whose audio onset strength is >= 5, plus the A blow that ends
  // part I (41.10 s) and the last tutti chord (438.04 s)
  const blows = sets.find((s) => s.id === 'ff-blows').notes;
  const strong5 = STRONG.filter(([, s]) => s >= 5).map(([t]) => t);
  const atts = [];
  for (const n of blows) { const a = atts[atts.length - 1]; if (a && n[0] - a.t < 0.04) { a.ns.push(n); a.v = Math.max(a.v, n[3]); } else atts.push({ t: n[0], ns: [n], v: n[3] }); }
  const keep = atts.filter((a) => a.v >= 104 || strong5.some((t) => Math.abs(t - a.t) < 0.15) || Math.abs(a.t - 41.1) < 0.1);
  add('ff-peaks', 'The 20 biggest ff blows: those whose loudest note is >= 104 or whose audio onset strength is >= 5, plus the A blow that ends part I and the last tutti chord: 20.58, 41.10, 73.12, 85.96, 124.09, 140.78, 151.95, 156.54, 183.59, 258.40, 282.55, 327.06, 353.54, 354.89, 357.49, 362.72, 372.34, 374.11, 389.06, 438.04 s (Bb7, held to 440.3). The one set for Fireworks.',
    [...keep.flatMap((a) => a.ns.map(([t, e, m, v]) => ({ t, e, m, v }))), ...inWin(PACK, 438.0, 438.1)]);
}

// ---------- the bell and the dawn ----------
add('last-chord', 'The end of the night: the last tutti chord (Bb-Ab-D, Bb7) at 438.04 s held to 440.3 s, then the soft D-major chord D3-A3-D4-F#4 that dies away 440.36-442.35 s under the first bell stroke (roll, merged: two attacks).',
  [...inWin(ROLL, 438.0, 438.1), ...inWin(ROLL, 440.3, 440.4)]);
add('church-bell', 'The village church bell on D, 441.9-459.1 s, from the AUDIO (onsets with chroma D, the level jumping about 8 dB at each stroke, about 1.6 s apart; 441.91 faint): 11 strokes, each D2 + D4 ringing to the next stroke. The notes there are almost nothing (1 attack per 2 s): without this set the bell is a hole.',
  BELL.flatMap(([t, db], i) => { const e = i + 1 < BELL.length ? BELL[i + 1][0] - 0.05 : t + 2.5; return [synth(t, e, 38, audioVel(db) + 15), synth(t, e, 62, audioVel(db) + 15)]; }));
add('dawn-pedal', 'The dawn\'s D drone: the cello D2 (and D3) repeated and held under the whole dawn, 462.9-577 s, tremolo merged so each bow stroke or held note is one attack (it is still a pulse of about 2-3 strokes a second where the cellos repeat).',
  inWin(ROLL, 462.9, 577, (n) => n.tr === 'cello' && (n.m === 38 || n.m === 50)));
add('dawn-rise', 'The dawn\'s rising chromatic octaves, every entry: violins (and violas an octave under) climb by semitones from D/Eb to A, Bb or D6, eight times: 463.1, 471.6, 479.2, 485.3 (to D6 at 488.8), 499.9, 509.4, 517.2, 524.8 (to D6 at 529.5 s). The violins\' top note of each step.',
  lead(windows(ROLL, [[463.0, 468.0], [471.5, 475.3], [479.1, 481.3], [485.2, 489.5], [499.8, 505.8], [509.3, 513.5], [517.1, 521.0], [524.7, 530.4]], (n) => n.tr === 'violin'), 0.12, 0.3, 'top'));
add('horn-dawn', 'The dawn\'s answering calls the transcriber labels voices (F#4-G4-A4, horn-like) at 465-466, 473-475, 481.7, 497.9, 502-503.4, 512-513, 520.9 s, with the wind (clarinet-labelled) chords at 483.4 and 522.4-526 s. Sparse, soft, held.',
  [...inWin(ROLL, 462.9, 540, (n) => n.tr === 'voice' || n.tr === 'clarinet')]);
add('harp', 'The harp\'s D-major arpeggios, labelled PIANO by the transcriber: 489.7-497.1 s, 529.5-539.2 s and the last one 571.5-575.4 s (A2/D2 rocking, then D3 up to D5). Every note: a rising ripple, about 6 notes a second.',
  inWin(roll, 489.5, 577, (n) => n.tr === 'piano'));
add('wind-solo', 'The closing woodwind solo 540.1-566.1 s, labelled clarinet (G5-D5-Bb5-A5-F5-D5-D6, then Eb5-F5-G5-F5 twice, falling to D5-Bb4-F4): with the repeated G4 before it (540.1-543.4 s, violin track) and the held G5 at 548.3-550.0 s that only the AUDIO has (pyin). Soft, slow, held: the one voice left.',
  [...inWin(ROLL, 540.0, 566.2, (n) => n.tr === 'clarinet' || (n.tr === 'violin' && n.m === 67 && n.t < 543.5)),
    ...SOLO_AUDIO.map(([t, e, m, db]) => synth(t, e, m, audioVel(db)))]);
add('dawn-chords', 'The held string chords of the last minute: D4-F4-Bb4 at 561.4 s (4 s), the C4-Eb4 repeats 565.5-567 s, D4-G4 567.9 s, Bb3-D4 / A3-D4 570.3-571.3 s, and the final D-major chord 573.2-577 s (roll, merged, >= 0.3 s): the dawn\'s last breaths under the solo.',
  inWin(ROLL, 541.0, 577, (n) => STR.includes(n.tr) && n.e - n.t >= 0.3));

// ---- checks ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (!(n[1] >= n[0]) || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127 || n[1] > DUR) throw new Error(`${s.id} bad note ${n}`);
}
if (new Set(sets.map((s) => s.id)).size !== sets.length) throw new Error('duplicate id');

// ---- output: one note per line ----
const out = Object.fromEntries(sets.map((s) => [s.id, { hears: s.hears, notes: s.notes }]));
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');

// ---- report ----
const attacksOf = (notes) => { let k = 0, last = -1; for (const n of notes) { if (n[0] - last >= 0.04) { k++; last = n[0]; } } return k; };
console.log('id                  notes  att  span            first pitches');
for (const s of sets) {
  const n = s.notes;
  console.log(`${s.id.padEnd(19)} ${String(n.length).padStart(5)} ${String(attacksOf(n)).padStart(4)}  ${(n[0][0].toFixed(1) + '-' + n[n.length - 1][1].toFixed(1)).padEnd(14)}  ${n.slice(0, 10).map((x) => nm(x[2])).join(' ')}`);
}
console.log(sets.length, 'sets');
// per-30 s attack table (the weight table)
const bins = Math.ceil(DUR / 30);
const pad = (x, w) => String(x).padStart(w);
console.log('\nattacks per 30 s\n' + 'set'.padEnd(19) + Array.from({ length: bins }, (_, i) => pad(i * 30, 4)).join(''));
for (const s of sets) {
  const row = Array(bins).fill(0); let last = -1;
  for (const n of s.notes) { if (n[0] - last >= 0.04) { row[Math.floor(n[0] / 30)]++; last = n[0]; } }
  console.log(s.id.padEnd(19) + row.map((x) => pad(x || '.', 4)).join(''));
}
