// Pick sets for Satie: Gymnopédie No. 1 (Monochrome Jazzy Mix) (songs/gymnopedie-jazz), deterministic.
// Run from anywhere:   node docs/compositions/classical/gymnopedie-jazz/gen-picks.mjs
//   -> writes picks.json next to this file ({ "<set id>": { hears, rule, section, source, from, to, attacks, notes } },
//      sets in order of their first note) and prints each set's attacks, notes, span, largest gap and first notes, then
//      the per-30 s attack table used in ANALYSIS.md.
// First run audio-picks.py (same folder) once: it writes audio-picks.json, the audio facts the notes lack (drum
// loudness, the groove's bass line, the mix level).
//
// Sources:
//  - "pack": pack.notes (the GPU piano model, bytedance), with the pack's own times and velocities. Every pitched set.
//    The picker's roll for this song is the YourMT3 rows (16 labels, half of them drums), so the picker shows these
//    as notes it cannot find on its roll; widgets hear them as written.
//  - "ymt3+audio": YourMT3's "Drums" rows (the only drums anywhere: the piano model hears none). MIDI = the General MIDI
//    drum key (36 kick, 38 snare, 43/45/48 toms, 51 ride, 49/52/55 crash/china), NOT a pitch: a widget that draws by
//    pitch puts a kick at C2 and the ride at Eb3. YourMT3 gives every row velocity 100; here the velocity is the hit's
//    level in its own band of the percussive audio (audio-picks.json), mapped per set p10 -> 45, p90 -> 105.
//    Each hit lasts 0.12 s (YourMT3 writes 0.01).
//  - "audio": the groove's bass (audio-picks.json: low-band onsets with pyin pitch, folded to the octave of their
//    neighbours), velocity from its level (-40 dB -> 45, -20 dB -> 105).
// The bar grid: 104 bpm, beat 0.577 s, bar (3/4) 1.731 s, downbeat k at 1.731 k - 0.007 s, constant through the song
// (fitted on the audio onsets). Satie's pattern holds throughout: bass on beat 1, chord on beat 2.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/gymnopedie-jazz');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const labels = JSON.parse(readFileSync(join(SONG, 'notes.ymt3.json'), 'utf8')).notes;
const audio = JSON.parse(readFileSync(join(HERE, 'audio-picks.json'), 'utf8'));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- the grid ----
const BAR = 1.731, BEAT = BAR / 3, T0 = -0.007;
const barStart = (k) => T0 + k * BAR;
const barOf = (t) => Math.floor((t - T0) / BAR);
/** Position in the bar in beats, 0 = downbeat, 1 = beat 2, 2 = beat 3. */
const posOf = (t) => ((t - T0) / BAR - barOf(t)) * 3;
const nearBeat = (t, tol = 0.12) => { const p = posOf(t) * BEAT; const d = Math.min(p % BEAT, BEAT - (p % BEAT)); return d <= tol; };
const onBeat2 = (t, tol = 0.12) => Math.abs(posOf(t) - 1) * BEAT <= tol;

// ---- notes ----
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, k, src: 'pack' })).sort((a, b) => a.t - b.t || a.m - b.m);

// ---- helpers (as in the concerto's generator) ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; if (n.v > cur.loud.v) cur.loud = n; cur.vmax = Math.max(cur.vmax, n.v); }
    else { cur = { t: n.t, ns: [n], top: n, low: n, loud: n, vmax: n.v }; out.push(cur); }
  }
  return out;
}
const inWin = (src, a, b, filter = () => true) => src.filter((n) => n.t >= a && n.t < b && filter(n));
const inWins = (src, wins, filter = () => true) => wins.flatMap(([a, b]) => inWin(src, a, b, filter));
/** Skyline: the top of each onset cluster, unless a note more than a tone higher, begun within `hold` s, still sounds;
    notes shorter than minDur dropped; a repeat of the same pitch within 0.15 s merged. */
function skyline(src, a, b, filter, minDur = 0.15, hold = 0.8) {
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
/** Voiced-out line (STYLE.md: "the held, voiced-out notes, at least 0.28 s, the loudest of their chord"): of each attack,
    the candidates (filter, held >= minDur, velocity >= minV) within 6 of the attack's loudest note; of those the
    highest (the melody is doubled in octaves: the upper one, so the line keeps one register). */
function voiced(src, wins, filter, minV, minDur = 0.28) {
  const out = [];
  for (const c of clusters(inWins(src, wins))) {
    const cand = c.ns.filter((n) => filter(n) && n.e - n.t >= minDur && n.v >= minV && n.v >= c.vmax - 6);
    if (cand.length) out.push(cand.reduce((x, n) => (n.m > x.m ? n : x)));
  }
  return out;
}
/** Each chord thinned to its lowest, highest and loudest note: one attack per chord, fewer notes. */
const outer = (cs) => cs.flatMap((c) => [...new Set([c.low, c.top, c.loud])]);
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t)), n.m, clamp(Math.round(n.v), 1, 127)];

const sets = [];
function add(id, o, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set(); notes = notes.filter((n) => { const key = `${r4(n.t)}|${n.m}`; if (seen.has(key)) return false; seen.add(key); return true; });
  if (!notes.length) throw new Error(`${id} has no notes`);
  sets.push({ id, ...o, source: o.source ?? 'pack', attacks: clusters(notes).length, notes: notes.map(asTuple) });
}

// ================= the form (song seconds; bars from the grid) =================
// A0 0.0-13.8 vamp alone | A1 13.8-27.7 tick loop | A2 27.7-69.2 ride | B 69.2-135.0 the theme, full band
// (melody 76.7) | ring 135.0-138.5 | C 138.5-159.2 interlude | D 159.2-204.2 the theme again | ring 204.2-207.1 |
// fill 207.1-207.7 | E 207.7-285.6 the groove: comping, solo (235.4), climb (252.7), lead descent (275.2) |
// close 285.6-288.0 | echo tail 288.0-291.5 | silence 291.5-297.4
const A_VAMP = [[0, 69.2]], C_VAMP = [[138.4, 159.2]];
const THEME_A = [69.2, 135.0], THEME_B = [159.2, 204.2];

// ---- the vamp: chords, their echoes, the tick loop, the soft bass ----
const vampClusters = (wins) => clusters(inWins(packNotes, wins, (n) => n.m >= 45 && n.m <= 80))
  .filter((c) => c.ns.length >= 2 && onBeat2(c.t, 0.14) && c.vmax >= 40);
add('vamp-chords', { section: 'A0-A2, C', from: 0.5, to: 159.2, hears: 'The Rhodes/piano vamp: one soft chord on beat 2 of every bar, B-D-F# then A-C#-F# (Gmaj7 and Dmaj7 without their bass), from the first sound to the theme, and again in the interlude. Slow, even, quiet (v 40-75).', rule: 'pack clusters on beat 2 (+-0.14 s) in 0-69.2 and 138.4-159.2 s with >= 2 notes in midi 45-80 and loudest >= 40; lowest, highest and loudest of each' },
  outer(vampClusters([...A_VAMP, ...C_VAMP])).map((n) => n));
// the echoes: after every vamp chord the same keys sound again 3-4 times, 0.16 s apart, fading (a delay on the keys)
{
  const chordT = vampClusters([...A_VAMP, ...C_VAMP]).map((c) => c);
  const echoes = [];
  for (const c of chordT) {
    const keys = new Set(c.ns.map((n) => n.m));
    for (const x of clusters(inWin(packNotes, c.t + 0.1, c.t + 0.95, (n) => keys.has(n.m) && n.v < c.vmax))) echoes.push(x.loud);
  }
  add('chord-echoes', { section: 'A0-A2', from: 0.6, to: 69.2, hears: 'The delay on the intro vamp (not in the interlude): 2-4 quieter repeats of each chord\'s keys, about 0.16 s apart, fading (v 20-55). A soft flutter after every chord, never a new event of its own.', rule: 'after each vamp-chords chord, pack notes in 0.1-0.95 s on the chord\'s own keys and softer than it; the loudest of each 40 ms cluster' }, echoes);
}
// the tick loop: from 13.8 s a bright percussive figure (93 % of its short notes sit on a 1.5-5 kHz percussive onset;
// the piano model writes it as clusters of A5-Eb7, Eb/C/Ab partials the harmony does not have) in a triplet pickup on
// beat 3 into every downbeat
const tickWin = (t) => { const p = posOf(t); return p >= 1.9 || p <= 0.12; };
const TICK_WINS = [[13.8, 69.2], [138.4, 204.2]];
// the tune (computed here so the tick loop can leave its attacks out: in D both share the register and the downbeats)
const melodyNote = (n) => n.m >= 71 && n.m <= 95 && n.m % 12 !== 3 && n.m % 12 !== 8 && nearBeat(n.t, 0.1);
// held >= 0.28 s, or a loud (v >= 85) pickup of 0.15 s or more (in D the beat-3 pickups D6/C6/B5 are short and loud)
const sung = (n) => n.e - n.t >= 0.28 || n.v >= 85;
const themeA = voiced(packNotes, [[76.6, 133.2]], melodyNote, 60, 0.15).filter(sung);
const themeB = voiced(packNotes, [[159.7, 202.45]], melodyNote, 66, 0.15).filter(sung);
const tuneT = [...themeA, ...themeB].map((n) => n.t);
const tickNotes = clusters(inWins(packNotes, TICK_WINS, (n) => n.m >= 80 && tickWin(n.t)))
  .filter((c) => !tuneT.some((t) => Math.abs(t - c.t) < 0.04)).map((c) => c.loud);
add('tick-loop', { section: 'A1-A2, C, D', from: 13.8, to: 204.2, hears: 'A bright tick-and-chime figure, not a melody: three quick strokes in triplets on beat 3 and a landing on the downbeat, every bar, the same each time (written by the piano model as A5-Eb7 clusters; mostly transient: its Eb, C and Ab are partials). Enters 13.9 s, stays to 69 s, back 138.5-204 s (in D under the tune, whose attacks it leaves out).', rule: 'pack clusters in 13.8-69.2 and 138.4-204.2 s with a note >= Ab5 on beat 3 or later or within 0.07 s of the downbeat, except attacks of theme-a/theme-b; the loudest note of each' },
  tickNotes);
// A2's brightest strand: the A5/A6 (and C#7, F#7, Eb7) octave strokes on beat 2, over the vamp chord, 28.3-61.2 s
add('high-strokes', { section: 'A2', from: 27.7, to: 69.2, hears: 'The bright octave strokes on beat 2 in A2: A5+A6 at 28.28 s (with the cymbals\' entrance), then A6, Eb7, C#7 and F#7 (43.85 s, v91) over the vamp chord, v 75-96, most bars to 49 s, a last one at 61.2 s. The loudest thing before the band.', rule: 'pack notes >= A5 with v >= 75 on beat 2 (+-0.12 s) in 27.7-69.2 s, every note of the attack' },
  inWin(packNotes, 27.7, 69.2, (n) => n.m >= 81 && n.v >= 75 && onBeat2(n.t, 0.12)));
add('soft-bass', { section: 'A1-A2, C', from: 15, to: 159.2, hears: 'A faint low pulse on the downbeats, D2 and G2 in turn (Satie\'s bass, very soft, v 30-67; short as written, under 0.2 s except in the interlude): from 15.6 s, and the interlude\'s G2/D2 at about 0.6 s each.', rule: 'pack notes below midi 50 in 15-69.2 and 138.4-159.2 s within 0.15 s of a downbeat' },
  inWins(packNotes, [[15, 69.2], ...C_VAMP], (n) => n.m < 50 && Math.abs(posOf(n.t) > 1.5 ? posOf(n.t) - 3 : posOf(n.t)) * BEAT <= 0.15));

// ---- the theme (B and D): bass, chords, melody ----
add('bass', { section: 'B, D', from: 69.2, to: 205, hears: 'The band\'s bass on beat 1 of every bar ("oom"): D2 and G2 in turn under the first phrase, then a pedal on D2 and the walk B1-E2-C3-A2 of the second phrase; held 0.5-1.7 s, v 55-99. Ends on the D2 of each final chord.', rule: 'pack notes below midi 50 in 69.2-135.0 and 159.2-205 s, held >= 0.3 s' },
  inWins(packNotes, [THEME_A, [159.2, 205]], (n) => n.m < 50 && n.e - n.t >= 0.3));
const pahCl = clusters(inWins(packNotes, [THEME_A, THEME_B], (n) => n.m >= 47 && n.m <= 80)).filter((c) => c.ns.length >= 3 && onBeat2(c.t, 0.12));
add('pah-chords', { section: 'B, D', from: 69.2, to: 204.2, hears: 'The band\'s chord on beat 2 of every bar ("pah"): Satie\'s B-D-F# / A-C#-F# blocks, held about 1.1 s, louder than in the vamp (v 60-99). One attack per bar.', rule: 'pack clusters on beat 2 (+-0.12 s) in 69.2-135.0 and 159.2-204.2 s with >= 3 notes in midi 47-80; lowest, highest and loudest of each' },
  outer(pahCl));
add('theme-a', { section: 'B', from: 76.6, to: 133.2, hears: 'Satie\'s melody, first time, in octaves over the band: F#5 A6 | G6 F#6 C#6 | B5 C#6 D6 | A5 ... (77.3 s), the phrase again from 90.0 s, the second phrase from 103.9 s climbing F6-G6-A6 (114.2 s) and falling to the cadence. Long notes (0.5-1.7 s), v 60-107 (the falling ends of phrases are soft): the singing line.', rule: 'voiced-out pack notes in 76.6-133.2 s: B4-B6, not Eb/Ab (tick partials), on a beat (+-0.1 s), held >= 0.28 s (or >= 0.15 s at v >= 85: short loud pickups), v >= 60 and within 6 of their attack\'s loudest; the upper of an octave pair' },
  themeA);
add('theme-b', { section: 'D', from: 159.7, to: 202.45, hears: 'The melody again, an octave higher at first (F#6 A6 G6 F#6 at 159.8 s), one statement of the first phrase, then the second phrase (173.1 s) with its F6-G6-A6 climb at 183.5 s, down to the cadence.', rule: 'as theme-a, in 159.7-202.45 s, v >= 66 (the tick loop shares the register here: its off-beat strokes are left out by the beat rule, its Eb/Ab by the pitch rule)' },
  themeB);
// the phrases, four bars each, one Ivory row each
const PHR_A = [44, 48, 52, 56, 60, 64, 68, 72], PHR_B = [92, 96, 100, 104, 108, 112];
const phraseWhy = {
  'theme-a-p1': 'F#5 A6 | G6 F#6 C#6 | B5 C#6 D6 | A5 (F#5): the famous opening',
  'theme-a-p2': 'the answer in long notes: F#5, D5, C#5, A5, F#5',
  'theme-a-p3': 'the opening again, softer as it falls: F#6 A6 G6 F#6 C#6 B5 C#6 A5 F#5',
  'theme-a-p4': 'its answer, closing on E5-G5-A5',
  'theme-a-p5': 'second phrase: A5 C6 E6 | D6 B5 D6 | C6 B5',
  'theme-a-p6': 'D6, then the climb F6 G6 A6 (114.2 s) and C6 D6',
  'theme-a-p7': 'E6 D6 B5 D6 ... G6 G5: turning home',
  'theme-a-p8': 'F#6 F#5 B5 | A5 B5 C#6 | D6 E6 C#6 | A5 ... F#5: the last line before the cadence',
  'theme-b-p1': 'F#6 A6 G6 F#6 C#6 | D5 C#6: the opening an octave up',
  'theme-b-p2': 'its answer, A6 C#6 ... F#6 A6 (held 3.3 s at 169.6 s) ... D6',
  'theme-b-p3': 'second phrase: A6 B6 ... A5 B6 A6 D6 | B5 D6 C6',
  'theme-b-p4': 'D6 A6 A6 A6, the climb F6 G6 A6 (183.5 s), C6',
  'theme-b-p5': 'E6 D6 B5 D6 | A6 G6 B6',
  'theme-b-p6': 'F#6 A6 B5 A5 ... D6 C#6 D6 ... B6: into the cadence',
};
for (const [pref, starts, line, end] of [['theme-a', PHR_A, themeA, 133.2], ['theme-b', PHR_B, themeB, 202.45]]) {
  starts.forEach((k, i) => {
    const a = barStart(k) - 0.1, b = i + 1 < starts.length ? barStart(starts[i + 1]) - 0.1 : end;
    const id = `${pref}-p${i + 1}`;
    add(id, { section: pref === 'theme-a' ? 'B' : 'D', from: r4(a), to: r4(b), hears: `Phrase ${i + 1} of ${pref} (bars ${k}-${(starts[i + 1] ?? barOf(end)) - 1}, four bars, about 6.9 s): ${phraseWhy[id]}.`, rule: `${pref} notes in ${r4(a)}-${r4(b)} s` },
      line.filter((n) => n.t >= a && n.t < b));
  });
}
add('a6-summits', { section: 'B, D', from: 76, to: 203, hears: 'The melody\'s summits: its A6 (and the F#6/G6 around it) struck hardest, v >= 95: 77.3, 90.6, 114.9 s, then 160.4 and 184.6 s. The moments the tune peaks.', rule: 'theme-a and theme-b notes >= F#6 with velocity >= 95' },
  [...themeA, ...themeB].filter((n) => n.m >= 90 && n.v >= 95));
add('cadence-blows', { section: 'B, D', from: 133, to: 205, hears: 'The two ff endings of the theme, each a pair of held blocks: C major over A (133.3 s, v 97) then D major, the whole keyboard (135.0 s, v 92, rings 3.5 s); again 202.5 s (v 101) and 204.2 s (v 97, rings 3 s). The only real blows in the piece.', rule: 'every pack note of the clusters at 133.27, 134.99, 202.50 and 204.22 s' },
  clusters(inWin(packNotes, 133, 205)).filter((c) => [133.27, 134.99, 202.5, 204.22].some((t) => Math.abs(c.t - t) < 0.05)).flatMap((c) => c.ns));
add('cadence-approach', { section: 'B, D', from: 131.4, to: 202.5, hears: 'The steps into each cadence: E2 under F#5 (131.6), B2-D5 (132.1), E minor (132.7), and the same at 200.8, 201.4 and 201.9 s. Three rising strokes before the blow.', rule: 'pack clusters in 131.4-133.2 and 200.7-202.45 s with loudest >= 65; lowest, highest and loudest of each' },
  outer(clusters(inWins(packNotes, [[131.4, 133.2], [200.7, 202.45]])).filter((c) => c.vmax >= 65)));

// ---- the groove (E) ----
const E = [207.7, 285.6];
const compCl = clusters(inWin(packNotes, 207.7, 275.2, (n) => n.m >= 45 && n.m <= 80)).filter((c) => c.ns.length >= 3 && onBeat2(c.t, 0.16));
add('groove-comp', { section: 'E', from: 207.7, to: 275.2, hears: 'The piano\'s comping in the groove: the vamp chord on beat 2 of each bar (B-D-F# / A-C#-F#, later Em, Am, F), now short and punchy over the breakbeat (v 60-90).', rule: 'pack clusters on beat 2 (+-0.16 s) in 207.7-275.2 s with >= 3 notes in midi 45-80; lowest, highest and loudest of each' },
  outer(compCl));
const compSet = new Set(compCl.flatMap((c) => c.ns));
const soloLine = skyline(packNotes, 213.4, 275.2, (n) => n.m >= 69 && !compSet.has(n), 0.05, 0.4);
add('solo-line', { section: 'E', from: 213.4, to: 275.2, hears: 'The piano improvising over the groove, its top line: short phrases from 213.5 s, sixteenth-note runs in the A5 octave from 235.4 s, climbing to F6-A6 with blue notes (Eb, F, Ab) from 252.7 s. Fast, light, many notes (0.05-0.5 s).', rule: 'skyline of pack notes >= A4 not in groove-comp chords, minDur 0.05, hold 0.4, in 213.4-275.2 s' },
  soloLine);
// runs: chains of >= 5 solo notes each < 0.2 s after the last
{
  const runs = []; let chain = [];
  const flush = () => { if (chain.length >= 5) runs.push(...chain); chain = []; };
  for (const n of soloLine) { if (chain.length && n.t - chain[chain.length - 1].t > 0.2) flush(); chain.push(n); }
  flush();
  add('solo-runs', { section: 'E', from: 213.4, to: 275.2, hears: 'Only the runs of the solo: chains of five or more notes in sixteenths (0.14 s apart), mostly 236-274 s. The busiest strand of the piece.', rule: 'solo-line notes in chains of >= 5, each < 0.2 s after the previous' }, runs);
}
add('solo-accents', { section: 'E', from: 213.4, to: 275.2, hears: 'The solo\'s hardest notes (v >= 92): the accents a listener taps, about one a bar.', rule: 'solo-line notes with velocity >= 92' },
  soloLine.filter((n) => n.v >= 92));
add('lead-descent', { section: 'E', from: 275.1, to: 285.5, hears: 'The groove\'s closing song: a slow lead line falling from G6 (275.2 s) through F6-G6-F6, B5-C6, F6-E6-D6 (279.8-281 s), C6, Eb6-D6 to A5 (284.4 s) over F major and A minor. Long notes (0.5-1.7 s), loud (v 79-100). YourMT3 hears part of it as a lead voice.', rule: 'voiced-out pack notes >= B4 in 275.1-285.5 s, held >= 0.28 s, v >= 75' },
  voiced(packNotes, [[275.1, 285.5]], (n) => n.m >= 71, 75));
add('closing-hits', { section: 'close', from: 285.5, to: 287.6, hears: 'The last three strokes of the band: C major (285.6 s, v 92), C-E-G (286.2 s, v 90) and the A4-D5 hit (287.3 s, v 108, the loudest note of the song) before the echoes.', rule: 'pack clusters in 285.5-287.6 s with loudest >= 85; every note' },
  clusters(inWin(packNotes, 285.5, 287.6)).filter((c) => c.vmax >= 85).flatMap((c) => c.ns));
add('echo-tail', { section: 'outro', from: 287.5, to: 291.5, hears: 'The tail: D4 repeated in sixteenths (a delay) fading out with A3 and D3, -13 to -26 dB, the mix gone by 292 s.', rule: 'pack notes in 287.5-291.5 s' },
  inWin(packNotes, 287.5, 291.5));

// ---- drums (YourMT3 + audio loudness) ----
const KIT = {
  kick: { keys: [35, 36], hears: 'The kick drum. A few under the theme (69.8-133 s, about one a bar), then the breakbeat\'s kick from 207.7 s, about 2 a second, to 285.6 s.' },
  snare: { keys: [37, 38, 39, 40], hears: 'The snare/backbeat: brushed strokes under the theme (from the pickup at 67.8 s), the groove\'s snare from 207.1 s.' },
  ride: { keys: [51, 53, 59], hears: 'The ride cymbal: on the beats from 28.3 s, through the theme, the interlude\'s last bars and the second theme (159.8 s on every beat), and the groove\'s eighths. The steadiest pulse of the piece.' },
  hats: { keys: [42, 44, 46, 54, 69, 70], hears: 'Hi-hat, tambourine and shaker strokes (YourMT3\'s guesses), scattered: a handful at 28-69 s, a cluster at 120-135 s, a few at the end.' },
  crash: { keys: [49, 52, 55, 57], hears: 'Crash/china cymbals: on the melody\'s entrances (76.7, 77.9, 78.5, 80.2, 81.3, 88.3 s ...) and the fill at 207.7 s. Few (18), YourMT3\'s guess of the kind.' },
  toms: { keys: [41, 43, 45, 47, 48, 50], hears: 'Toms: the fill at 207.4-207.5 s, the rolling tom run 211.2-212.9 s, then tom figures through the groove (223-282 s), and a few under the theme\'s cadence (131.5-135 s).' },
};
const drumRows = audio.drums; // [t, key, bandDb], sorted
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const kitSets = {};
for (const [id, k] of Object.entries(KIT)) {
  const rows = drumRows.filter((d) => k.keys.includes(d[1]));
  const lo = pct(rows.map((d) => d[2]), 0.1), hi = pct(rows.map((d) => d[2]), 0.9);
  const notes = rows.map(([t, key, db]) => ({ t, e: t + 0.12, m: key, v: clamp(Math.round(45 + (60 * (db - lo)) / Math.max(1, hi - lo)), 25, 120) }));
  kitSets[id] = notes;
  add(id, { section: 'drums', from: Math.floor(notes[0].t * 10) / 10, to: Math.ceil(notes[notes.length - 1].t * 10 + 1) / 10, source: 'ymt3+audio', hears: `${k.hears} MIDI = GM drum key (${k.keys.join('/')}), not a pitch.`, rule: `YourMT3 Drums rows with key ${k.keys.join('/')}; end t+0.12; velocity from the hit's band level (p10 -> 45, p90 -> 105)` }, notes);
}
add('snare-pickup', { section: 'A2', from: 67.7, to: 69.2, source: 'ymt3+audio', hears: 'The snare pickup into the theme: four strokes 67.79-68.62 s, the drums announcing the band.', rule: 'snare notes in 67.7-69.2 s' },
  kitSets.snare.filter((n) => n.t >= 67.7 && n.t < 69.2));
add('drum-fill', { section: 'fill', from: 207, to: 213, source: 'ymt3+audio', hears: 'The drum fill that launches the groove after the second ring-out (snare-snare-tom-tom-kick 207.09-207.69 s), and the tom run 211.15-212.88 s (eight strokes on one tom).', rule: 'snare, toms, kick and crash notes in 207-207.8 s and toms in 211-213 s' },
  [...[...kitSets.snare, ...kitSets.toms, ...kitSets.kick, ...kitSets.crash].filter((n) => n.t >= 207 && n.t < 207.8), ...kitSets.toms.filter((n) => n.t >= 211 && n.t < 213)]);
add('backbeat', { section: 'E', from: 207.7, to: 285.6, source: 'ymt3+audio', hears: 'The groove\'s kick and snare together (no cymbals): the breakbeat\'s skeleton, 207.7-285.6 s.', rule: 'kick and snare notes in 207.7-285.6 s' },
  [...kitSets.kick, ...kitSets.snare].filter((n) => n.t >= E[0] && n.t < E[1]));

// ---- the groove bass (audio) ----
{
  const raw = audio.bass.map(([t, e, m, db]) => ({ t, e, m, db }));
  // fold pyin octave slips to the octave nearest the neighbours' median
  const folded = raw.map((n, i) => {
    const nb = raw.slice(Math.max(0, i - 3), i + 4).filter((_, j) => j !== Math.min(3, i)).map((x) => x.m).sort((a, b) => a - b);
    const med = nb[nb.length >> 1];
    let m = n.m; while (m - med > 7) m -= 12; while (med - m > 7) m += 12;
    return { ...n, m, v: clamp(Math.round(45 + (60 * (n.db + 40)) / 20), 30, 115) };
  }).filter((n) => n.t >= E[0] - 0.05 && n.t < E[1]);
  add('groove-bass', { section: 'E', from: 207.6, to: 285.6, source: 'audio', hears: 'The groove\'s bass line, which the transcription misses entirely (no pack note below midi 50 after 205 s): a walking line around G2-E2-D2-F#2 over the vamp, then a pedal near E2 under the closing song. From the audio: pitch approximate (pyin, octave-folded), about 1.4 notes a second.', rule: 'audio-picks.json bass rows in 207.65-285.6 s (lowpass 180 Hz onsets with pyin pitch, kicks without a held pitch left out); octave slips folded to the neighbours\' median; velocity -40 dB -> 45, -20 dB -> 105' },
    folded);
}

// ---- union strands, for a single always-on clip ----
add('melody-all', { section: 'B, D, E', from: 76.6, to: 285.5, hears: 'Every sung line in one set: theme-a, theme-b and the lead-descent (the solo left out). For one melody clip that runs through the piece.', rule: 'theme-a + theme-b + lead-descent' },
  [...themeA, ...themeB, ...voiced(packNotes, [[275.1, 285.5]], (n) => n.m >= 71, 75)]);
add('low-all', { section: 'whole', from: 15, to: 285.6, source: 'pack+audio', hears: 'Every bass note in one set: the soft downbeat pulse of the vamp, the band\'s oom, and the groove\'s bass from the audio. For one low-register thread through the whole piece.', rule: 'soft-bass + bass + groove-bass' },
  [...sets.find((s) => s.id === 'soft-bass').notes, ...sets.find((s) => s.id === 'bass').notes, ...sets.find((s) => s.id === 'groove-bass').notes].map(([t, e, m, v]) => ({ t, e, m, v })));

// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (n[1] < n[0] || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127) throw new Error(`${s.id} bad note ${n}`);
  if (s.notes[0][0] < s.from - 1e-6 || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside ${s.from}-${s.to}: ${s.notes[0][0]}..${s.notes[s.notes.length - 1][0]}`);
}
if (new Set(sets.map((s) => s.id)).size !== sets.length) throw new Error('duplicate id');
const ordered = [...sets].sort((a, b) => a.notes[0][0] - b.notes[0][0]);
const out = {};
for (const s of ordered) out[s.id] = { hears: s.hears, rule: s.rule, section: s.section, source: s.source, from: s.from, to: s.to, attacks: s.attacks, notes: s.notes };
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');

const gapOf = (s) => { let g = 0, at = 0; for (let i = 1; i < s.notes.length; i++) { const d = s.notes[i][0] - s.notes[i - 1][0]; if (d > g) { g = d; at = s.notes[i - 1][0]; } } return [g, at]; };
for (const s of ordered) {
  const [g, at] = gapOf(s);
  console.log(`${s.id.padEnd(16)} ${String(s.attacks).padStart(4)} att ${String(s.notes.length).padStart(4)} n  ${s.notes[0][0].toFixed(2).padStart(6)}-${s.notes[s.notes.length - 1][0].toFixed(2).padStart(6)}  gap ${g.toFixed(1).padStart(5)} @${at.toFixed(1).padStart(5)} ${s.source.padEnd(10)}| ${s.notes.slice(0, 12).map((n) => nm(n[2]) + ':' + n[3]).join(' ')}`);
}
console.log(sets.length, 'sets');
// per-30 s attacks of the strands
const strands = ['vamp-chords', 'chord-echoes', 'tick-loop', 'soft-bass', 'bass', 'pah-chords', 'theme-a', 'theme-b', 'cadence-blows', 'groove-comp', 'solo-line', 'solo-runs', 'lead-descent', 'groove-bass', 'kick', 'snare', 'ride', 'toms', 'echo-tail'];
console.log('\nper 30 s attacks\n' + 'from '.padEnd(6) + strands.map((s) => s.slice(0, 7).padStart(8)).join(''));
for (let a = 0; a < 300; a += 30) {
  console.log(String(a).padEnd(6) + strands.map((id) => { const s = sets.find((x) => x.id === id); return String(clusters(s.notes.filter((n) => n[0] >= a && n[0] < a + 30).map(([t, e, m, v]) => ({ t, e, m, v }))).length).padStart(8); }).join(''));
}
