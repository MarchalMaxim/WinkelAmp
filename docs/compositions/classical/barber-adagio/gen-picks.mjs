// Pick sets for Barber's Adagio for Strings (songs/barber-adagio), deterministic.
// Run: node docs/compositions/classical/barber-adagio/gen-picks.mjs
//   -> writes picks.json next to this file: { "<set id>": { hears, source, rule, span, notes: [[start, end, midi, velocity], ...] } }
//      and prints each set's attacks, notes, span and first pitches (the numbers in ANALYSIS.md).
//
// Note source. This pack has instrument tracks (violin 554, viola 402, cello 211 notes, YourMT3+), so the note picker's
// roll is pack.tracks (src/studio/ui/picker-logic.ts pickerNotes, tracks branch) with the tracks' own velocities. Sets
// with source "roll" use only those notes, so the picker finds every pick on its roll. Two notes come from pack.notes
// that are not on the roll (the piano model, bytedance): the opening Bb4 (0.93 s) and the coda's Bb4 (426.0 s). Notes
// with source "audio" are measured from the recording itself (the constants AUDIO below) where nothing was
// transcribed: the tracks hear nothing at all in the climax 329-356 s. "mixed" sets combine roll notes with these.
//
// Fake attacks. The transcribers chop a held, vibrato-ed string note into runs of 0.1-0.2 s repeats (the violins'
// "tremolo" at 227-229, 280-287, 316-327 s, the C5 stutter at 72.5-78.3 s, the piano model's Eb7 x5 at 329 s ...).
// Barber wrote no tremolo, fast repeated-note figures, runs or trills here: every such run is one bowed note. legato() merges a note into
// the previous one of the same track and pitch when it starts less than 0.15 s after that one ends; the merged note
// keeps the first fragment's start and velocity (that is the attack one hears; the picker finds it on the roll).
// The merged fragments are 0.1-0.2 s apart, faster than anything Barber wrote in this piece (its quickest notes are
// ~0.75 s), and the strings give no clean onsets at the joins. After merging, the same pitch struck within 30 ms on two
// tracks (a doubling) is one.
//
// The audio constants were measured with librosa (C:/Users/maxim/.venvs/wa, scratch scripts, not kept): rms dB per
// 0.1-0.25 s, chroma_cqt and the strongest CQT bin below MIDI 55 per 0.2 s, onset_strength peaks. Velocity for them
// follows the fit of track velocity on audio level, v = 133.8 + 3.76 * dB (r 0.88), clamped to 18..120.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/barber-adagio');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const vOfDb = (db) => Math.max(18, Math.min(120, Math.round(133.8 + 3.76 * db)));

// ---- the roll (pack.tracks) and the piano model's notes that are not on it ----
const TRACK_ORDER = ['violin', 'viola', 'cello'];
const roll = TRACK_ORDER.flatMap((tr) => (pack.tracks[tr]?.notes ?? []).map(([t, e, m, v], k) => ({ t, e, m, v, tr, k })))
  .sort((a, b) => a.t - b.t || TRACK_ORDER.indexOf(a.tr) - TRACK_ORDER.indexOf(b.tr) || b.m - a.m);
const onRoll = new Set(roll.map((n) => `${n.t.toFixed(3)}|${n.m}`));
const packOnly = pack.notes.filter(([t, , m]) => !onRoll.has(`${t.toFixed(3)}|${m}`))
  .map(([t, e, m, v], k) => ({ t, e, m, v, tr: 'pk', k })).sort((a, b) => a.t - b.t || b.m - a.m);

/** Merge vibrato fragments: same track and pitch, starting < gap s after the previous one ends. */
function legato(ns, gap = 0.15) {
  const out = [], last = new Map();
  for (const n of ns) {
    const key = `${n.tr}|${n.m}`, p = last.get(key);
    if (p && n.t >= p.t && n.t - p.e < gap) { p.e = Math.max(p.e, n.e); p.frags++; continue; }
    const c = { ...n, frags: 1 }; out.push(c); last.set(key, c);
  }
  return out;
}
/** One note per pitch within 30 ms across tracks (doublings): the first track in TRACK_ORDER keeps it. */
function undouble(ns) {
  const out = [];
  for (const n of ns) {
    const d = out.find((o) => o.m === n.m && Math.abs(o.t - n.t) < 0.03);
    if (d) { d.e = Math.max(d.e, n.e); continue; }
    out.push({ ...n });
  }
  return out;
}
const clean = undouble(legato(roll));
const cleanPk = legato(packOnly);

// ---- audio-derived notes for the holes (see the header) ----
// [start, end, midi, dB at the attack, why]
const AUDIO = {
  lowEntry: [[3.95, 8.64, 46, -38, 'lower strings enter under the held Bb: bass Bb2 appears at 3.9-4.0 s, rms -41 -> -29 dB by 6 s']],
  // The fff climax 328.8-345.5 s: the tracks hear nothing after the violins' Eb6 at 328.79 (the climax's first chord,
  // in ascent-to-top); the piano model hears a jitter of 6th-7th-octave notes (partly overtones: its F#7/Eb7/F7 are the
  // violins' Gb6/Eb6/F6 an octave up). What the ear hears is a new chord every 1-6 s with the violins on top. A stroke
  // is kept only where an onset_strength peak (>= 1.96) or a piano-model attack coincides with a change in the chroma
  // (0.5 s bins): 330.23 (Bb F B E -> F# Bb C# G), 332.81 (-> Eb Bb C), 333.83 (-> Bb B C# F; the piano model's Bb6
  // v113), 336.9 (-> B Bb G F#, which then holds to 342.5), 342.67 (Eb enters, the swell to -2.9 dB at 344). The onset
  // peaks at 329.35, 335.25, 338.99, 340.13, 341.59 and 348.7-350.5 s fall inside one harmony: bow changes, not strokes.
  // Pitch: the highest piano-model note <= Bb6 sounding there, else the top CQT bin.
  climaxStrokes: [[330.23, 332.81, 90, -5.9, 'Gb6'], [332.81, 333.83, 94, -5.1, 'Bb6'],
    [333.83, 336.9, 94, -5.4, 'Bb6 (the piano model hears Bb6 x4 at 333.8-334.9 s: one bowed note)'],
    [336.9, 342.67, 94, -6.2, 'Bb6 over the turn to Cb/G colours (no transcribed note 335.2-342.6)'],
    [342.67, 345.5, 94, -8.0, 'Bb6 (piano model), held through the swell to the breath at 345.5']],
  climaxChord: [[346.21, 353.0, 80, -1, 'the fff arrival after the breath at 345.5-346.0 (-13 dB): onset peak 2.71 at 346.21, the loudest moment of the piece (-1.2 dB at 346.5), cut off at 353.0'],
    [346.21, 353.0, 92, -1, 'the same chord, upper octave (the piano model hears Ab5 and Ab6 from 346.1 s)']],
  hymnA: [[363.0, 364.85, 37, -28, 'hymn chord over C#2 (chroma C# E A; bass C#2 from 362.8-363.0 s)'], [363.0, 364.85, 64, -28, 'its E'], [363.0, 364.85, 69, -28, 'its A (top bin A4 at 364.5)']],
  hymnD: [[364.85, 369.05, 38, -25, 'hymn chord over D2 (chroma D A F#; bass D2 from 364.8 s)'], [364.85, 369.05, 57, -25, 'its A'], [364.85, 369.05, 66, -25, 'its F#'], [364.85, 369.05, 74, -25, 'its D5 (top bin D5 365.7-368.9 s)']],
  penultBass: [[448.52, 455.4, 48, -21, 'the bass under the penultimate F chord: C3, the strongest low bin 447-455 s (F/C, a 6/4)']],
  lastChord: [[455.4, 465.4, 41, -31, 'the last chord: the bass moves C3 -> F2 at 455.4 s after the dip to -36 dB at 454.4; F major, fading out at 465.4 s (digital silence from 465.5)'],
    [455.4, 465.4, 60, -31, 'its C'], [455.4, 465.4, 69, -31, 'its A (top bin A4 455.9-458.7 s)']],
};
const audio = (key) => AUDIO[key].map(([t, e, m, db]) => ({ t, e, m, v: vOfDb(db), tr: 'audio' }));

// ---- helpers (the concerto's, on clean notes) ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; cur.vmax = Math.max(cur.vmax, n.v); }
    else { cur = { t: n.t, ns: [n], top: n, low: n, vmax: n.v }; out.push(cur); }
  }
  return out;
}
const inWin = (src, a, b, f = () => true) => src.filter((n) => n.t >= a && n.t < b && f(n));
/** Skyline: the top of each cluster, unless a note more than a tone higher, begun within `hold` s, still sounds
    (a voice moving under a held note that just began), or a note more than a fifth higher, begun earlier, sounds on for
    0.3 s or more (accompaniment far below a held melody note); notes shorter than minDur dropped; a repeat of the same
    pitch within 0.15 s merged. */
function skyline(src, a, b, f = () => true, minDur = 0.28, hold = 0.8, far = true) {
  const ns = inWin(src, a - hold, b, (n) => f(n) && n.e - n.t >= minDur);
  const out = [];
  for (const c of clusters(ns)) {
    if (c.t < a) continue;
    if (ns.some((n) => n.t < c.t - 0.02 && n.t >= c.t - hold && n.e > c.t + 0.05 && n.m > c.top.m + 2)) continue;
    if (far && ns.some((n) => n.t < c.t - 0.02 && n.e > c.t + 0.3 && n.m > c.top.m + 7)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.m === c.top.m && c.t - prev.t < 0.15) continue;
    out.push(c.top);
  }
  return out;
}
/** Ends never run into the cut-off silence (353.0 s) or past the end of the music (465.4 s). */
const CUTS = [353.0, 465.4];
const endOf = (n) => CUTS.reduce((e, c) => (n.t < c && e > c ? c : e), n.e);
const asTuple = (n) => [r4(n.t), r4(Math.max(endOf(n), n.t + 0.05)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];
const ALL = () => true;
/** The melody lives at G3 and above (a cluster topped by a lone bass note is not the line); the low strophe at C3 and up. */
const MEL = (n) => n.m >= 55, LOWMEL = (n) => n.m >= 48;

const sets = [];
function add(id, o, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set();
  notes = notes.filter((n) => { const key = `${r4(n.t)}|${n.m}`; if (seen.has(key)) return false; seen.add(key); return true; });
  sets.push({ id, ...o, attacks: clusters(notes).length, notes: notes.map(asTuple) });
}
const byId = (id) => sets.find((s) => s.id === id);
const back = (tuples) => tuples.map(([t, e, m, v]) => ({ t, e, m, v }));

// The opening Bb4: the piano model hears it at 0.93-2.05 s, the audio holds it (top bin Bb, rms -42 to -29 dB) until
// the violins move to A4 at 8.64 s. One held note, as the ear hears it.
const openingBb = { ...cleanPk.find((n) => n.m === 70 && Math.abs(n.t - 0.93) < 0.01), e: 8.64 };
// The coda's Bb4 at 426.0 s (the last statement of the head): piano model fragments 426.0-427.6, merged; held to 429.06.
const codaBb = { ...cleanPk.find((n) => n.m === 70 && Math.abs(n.t - 426.0) < 0.01), e: 429.06 };

// ================= phrase lines (the melody, one set per phrase: Ivory rows, handover, the lead) =================
add('theme-opening', { section: 'A1', from: 0.9, to: 21.1, source: 'mixed', rule: 'the Bb4 0.93-8.64 s (piano model + audio), then the skyline of clean roll notes 8.6-21.1 s, >= 0.28 s',
  hears: 'The theme alone, pp: a long Bb4, then the violins step A4-Bb4-C5-Bb4-Db5 ... up to Eb5 at 20.1 s; 11 slow notes, each ~0.8 s.' },
  [openingBb, ...skyline(clean, 8.6, 21.1, MEL)]);
add('theme-answer', { section: 'A1 answer', from: 30.0, to: 49.4, rule: 'skyline of clean roll notes 30.0-49.4 s at G3 and up, >= 0.28 s',
  hears: 'The answer over a Gb bass: Bb4 held, C5-Db5-Bb4, then the line falls Ab4-Gb4-F4-Eb4 and climbs back in the middle voice C4-Db4-Eb4-F4-Gb4-Ab4-Bb4.' },
  skyline(clean, 30.0, 49.4, MEL));
add('theme-restated', { section: 'A2', from: 53.4, to: 70.1, rule: 'skyline of clean roll notes 53.4-70.1 s at G3 and up, >= 0.28 s',
  hears: 'The theme again from its long Bb4 (53.5 s): A4-Bb4-C5 ... Db5-Eb5, a little louder; it ends on the Ab chord at 70.1 s.' },
  skyline(clean, 53.4, 70.1, MEL));
add('first-ascent', { section: 'A2 ascent', from: 70.0, to: 86.1, rule: 'skyline of clean roll notes 70.0-86.1 s at G3 and up, >= 0.28 s',
  hears: 'Four long high notes as the music opens up: C5 (70.1), Gb5 held 7 s (71.0), Cb6 (82.9), Bb5 (85.2). Slow, rising, crescendo -24 to -20 dB.' },
  skyline(clean, 70.0, 86.1, MEL));
add('first-swell', { section: 'Swell 1', from: 86.1, to: 103.4, rule: 'skyline of clean roll notes 86.1-103.4 s at G3 and up, >= 0.28 s',
  hears: 'The first forte: the theme in the middle register, Eb4-F4-D4-Eb4 ... Ab4 (vel 98-103 at 93-98 s) up to Db5 at 98.7 s, then sinking to C5-Bb4.' },
  skyline(clean, 86.1, 103.4, MEL));
add('second-strophe', { section: 'B1', from: 103.4, to: 134.5, rule: 'skyline of clean roll notes 103.4-134.5 s at G3 and up, >= 0.28 s',
  hears: 'The second strophe from a long Bb4 (103.5 s): falling phrases Ab4-Bb4-Cb5-Bb4-Ab4-Gb4, then the line sinks into the middle register (F4 ... Db4) over a bass that walks down.' },
  skyline(clean, 103.4, 134.5, MEL));
add('second-build', { section: 'B2 build', from: 134.5, to: 162.7, rule: 'skyline of clean roll notes 134.5-162.7 s at G3 and up, >= 0.28 s',
  hears: 'The second build: from A3/F3 the line climbs Db4-Eb4-F4 ... F5 (144.6, vel 94), Db5 (146.2, vel 98) to a held Eb5 (149.5 s, -9 dB), then D-natural (154.6, 156.3): a turn of colour, and it ebbs.' },
  skyline(clean, 134.5, 162.7, MEL));
add('violins-descent', { section: 'C', from: 162.7, to: 199.5, rule: 'skyline of clean roll notes 162.7-199.5 s at G3 and up, >= 0.28 s',
  hears: 'The violins step down Gb5-F5-Eb5-Db5-Cb5 (162.9-166 s), then wind around Bb4/Cb5/Ab4 (168-188 s) over the lower strings\' surge at 180 s; a quiet Bb-major glimpse at 192.6 s.' },
  skyline(clean, 162.7, 199.5, MEL));
add('low-strophe', { section: 'D (low strophe)', from: 199.5, to: 257.4, rule: 'skyline of clean roll notes 199.5-257.4 s at C3 and up, >= 0.28 s, keeping voices that move under the held Gb chord (no far-below rule)',
  hears: 'The darkest stretch: the line in the low middle register (Bb3-Ab4), long notes far apart (F4 held 199.6, Eb4 209.8, Gb4 220.4 held 7 s), the cellos\' rising cell C3-Eb3-F3-Gb3 at 232-235 s, the violas rocking F3-Bb3 at 252 s.' },
  skyline(clean, 199.5, 257.4, LOWMEL, 0.28, 0.8, false));
add('third-build', { section: 'E1 build', from: 257.4, to: 275.1, rule: 'skyline of clean roll notes 257.4-275.1 s at G3 and up, >= 0.28 s (the transcription is empty 267-275)',
  hears: 'The third build starts low and loud: Eb4-Db4-Eb4-C4 (vel 88-96) then Eb4-Gb4; from 267 s the strings swell (peak -13.6 dB at 268) with no transcribed note.' },
  skyline(clean, 257.4, 275.1, MEL));
add('waves', { section: 'E2 waves', from: 275.1, to: 303.3, rule: 'skyline of clean roll notes 275.1-303.3 s at G3 and up, >= 0.28 s',
  hears: 'Rising waves in the violins: Eb5-F5-D5 ... Eb5 (vel 104 at 278.8), then Gb5-Eb5-F5-Gb5-F5-Gb5-Eb5-Ab5-F5 (280-286 s, -15 dB), a Db chord, and the plateau (Bb4 held from 291.9 s).' },
  skyline(clean, 275.1, 303.3, MEL));
add('stretto-cells', { section: 'E3 stretto', from: 303.3, to: 315.0, rule: 'clean roll notes 303.9-315.0 s lasting 0.28-1.2 s (the moving cells under the held F5 and Ab5)',
  hears: 'The voices enter one after another with the same cell, hammered: violas Db4-Eb4-F4-Db4-Eb4 (304-307 s, vel 70-102), cellos F4-Eb4-F4 (307.5-309), violas Gb4-F4, cellos Gb4-Ab4 (vel 114 at 314.2). 16 strokes ~0.75 s apart.' },
  inWin(clean, 303.9, 315.0, (n) => n.e - n.t >= 0.28 && n.e - n.t <= 1.2));
add('ascent-to-top', { section: 'E4 ascent', from: 315.0, to: 329.3, rule: 'skyline of clean roll notes 315.0-329.3 s at Db5 and up (the top voice; the C5/F4 under the F6s are inner voices), >= 0.28 s',
  hears: 'The violins strain upward, ff: C6 (315.1), F6, Db6, Eb6, F6, Gb6 (328.2 s), vel 100-116, the last stretch the tracks hear.' },
  skyline(clean, 315.0, 329.3, (n) => n.m >= 73));
add('climax-line', { section: 'Climax', from: 330.0, to: 346.2, source: 'audio', rule: 'AUDIO.climaxStrokes: the climax\'s chord changes 330.23-342.67 s (an onset peak or piano-model attack on a change in the chroma), pitch from the piano model (<= Bb6) or the top CQT bin',
  hears: 'The fff climax after its first chord (Eb6 at 328.79, the last note of ascent-to-top); the tracks hear nothing here. Five new chords with the violins on top: Gb6 (330.2), then Bb6 re-struck as the harmony turns beneath (332.8, 333.8, 336.9, 342.7), the last held through a swell to the breath at 345.5 s.' },
  audio('climaxStrokes'));
add('climax-chord', { section: 'Climax', from: 346.2, to: 353.0, source: 'audio', rule: 'AUDIO.climaxChord: Ab5 + Ab6 from 346.21 s (the onset after the breath) to the cut-off at 353.0 s',
  hears: 'The one fff blow of the piece: after a split-second breath the whole orchestra lands on the high chord (346.2 s, -1.2 dB, the loudest moment) and holds it until it is cut off dead at 353.0 s.' },
  audio('climaxChord'));
add('hymn-chords', { section: 'Hymn', from: 356.4, to: 376.5, source: 'mixed', rule: 'every clean roll note 356.4-376.5 s (5 chords) plus the two chords the tracks miss (AUDIO.hymnA 363.0, AUDIO.hymnD 364.85)',
  hears: 'After the silence, soft chords like a hymn, pp, each held 2-6 s: 356.5 (Cb), 358.4 (Fb), 363.0 (A over C#), 364.9 (D), 369.1 (B minor), 371.0 (C), 374.0 (F). The bass sinks E2-C#2-D2-B2-C2-F2.' },
  [...inWin(clean, 356.4, 376.5), ...audio('hymnA'), ...audio('hymnD')]);
add('reprise-theme', { section: 'A3 reprise', from: 380.6, to: 403.4, rule: 'skyline of clean roll notes 380.6-403.4 s at G3 and up, >= 0.28 s',
  hears: 'The theme comes back from its long Bb4 (382.3 s), doubled an octave lower: A4-Bb4-C5-Bb4-C5-Db5 ... Eb5, landing on a C5 held 7.7 s (396.1 s).' },
  skyline(clean, 380.6, 403.4, MEL));
add('reprise-answer', { section: 'A3 answer', from: 403.4, to: 426.0, rule: 'skyline of clean roll notes 403.4-426.0 s at G3 and up, >= 0.28 s',
  hears: 'The answering phrase, in octaves: Bb4 held, then Db5-C5-Bb4-C5-Db5-Eb5-F5-Gb5 (412.9 s, its top) and all the way down F5-Eb5-Db5-C5-Bb4-Ab4-Gb4-Bb4-Ab4-F4-Gb4 to F4 (422.6 s).' },
  skyline(clean, 403.4, 426.0, MEL));
add('coda-cell', { section: 'Coda', from: 426.0, to: 448.5, source: 'mixed', rule: 'the piano model\'s Bb4 at 426.0 (merged, held to 429.06), then the skyline of clean roll notes 429.0-448.5 s, >= 0.28 s',
  hears: 'The head of the theme one last time, spent: Bb4 (426.0), Bb4-A4-Bb4-C5, A4 held 5.7 s; then very low and soft (vel 17-65) Bb3-A3-Bb3-C4 (438.4-447 s).' },
  [codaBb, ...skyline(clean, 429.0, 448.5, MEL)]);
add('last-chords', { section: 'Ending', from: 448.5, to: 465.5, source: 'mixed', rule: 'clean roll notes 448.5-452 s (the F/A of the penultimate chord, its fragments merged) with its bass C3 (AUDIO.penultBass), then the last chord (AUDIO.lastChord)',
  hears: 'The two last chords: F major over C (448.5 s), then F major over F (455.4 s), unresolved (the piece is in Bb minor), fading to nothing by 465.4 s.' },
  [...inWin(clean, 448.5, 452.0), ...audio('penultBass'), ...audio('lastChord')]);

// ================= threads through the whole piece =================
const PHRASES = ['theme-opening', 'theme-answer', 'theme-restated', 'first-ascent', 'first-swell', 'second-strophe', 'second-build',
  'violins-descent', 'low-strophe', 'third-build', 'waves', 'ascent-to-top', 'climax-line', 'reprise-theme', 'reprise-answer', 'coda-cell'];
add('melody', { section: 'all', from: 0.9, to: 448.5, source: 'mixed', rule: `union of the phrase sets ${PHRASES.join(', ')} (stretto-cells, climax-chord, hymn-chords and last-chords are separate)`,
  hears: 'The line one follows from the first Bb to the coda: the theme, its answers, the waves and the climax top. The always-on lead thread.' },
  PHRASES.flatMap((id) => back(byId(id).notes)));

// Below MIDI 50 the bass; between 183 and 330 s the low strings play in the tenor and nothing is transcribed below
// F2 there, so the lowest voice is taken up to F#3 (MIDI 54), held >= 1 s.
const LOW = (n) => (n.m < 50 && n.e - n.t >= 0.5) || (n.t >= 183 && n.t < 330 && n.m <= 54 && n.e - n.t >= 1.0);
add('bass-line', { section: 'all', from: 3.9, to: 465.5, source: 'mixed', rule: 'the lowest clean roll note of each cluster below MIDI 50 lasting >= 0.5 s (183-330 s: up to F#3, lasting >= 1 s); plus the audio basses (3.95 Bb2, hymn C#2/D2, 448.52 C3, 455.4 F2)',
  hears: 'The slow bass: one long note every few seconds, walking down by steps (F#2-F2-Eb2-Db2 ...; Ab1 at 86.2 s, B1 at 108.8 s), in the tenor (F3-Bb3) through the low strophe and the build, silent from 292 s to the hymn (the transcription hears no low voice in the climb and the climax), sinking again in the hymn. A pulse of tolls, never busy.' },
  [...clusters(inWin(clean, 0, 481, LOW)).map((c) => c.low), ...audio('lowEntry'), ...audio('hymnA').filter((n) => n.m < 50), ...audio('hymnD').filter((n) => n.m < 50), ...audio('penultBass'), ...audio('lastChord').filter((n) => n.m < 50)]);
add('deep-tolls', { section: 'all', from: 80, to: 125, rule: 'clean roll notes at or below MIDI 37 (C#2), lasting >= 0.5 s',
  hears: 'The deepest notes, the bass\'s rare tolls under the first swell and the second strophe: Ab1 (86.2, 87.5), C#2 (98.5), B1 (108.8, 109.6), C#2 (120.5).' },
  inWin(clean, 80, 125, (n) => n.m <= 37 && n.e - n.t >= 0.5));

const trackLine = (tr) => skyline(clean.filter((n) => n.tr === tr), 0, 481, ALL, 0.28, 0.8);
add('violin-line', { section: 'all', from: 8.6, to: 452, rule: 'skyline of the violin track (clean), >= 0.28 s',
  hears: 'The violin track\'s top line (YourMT3+ label): most of the theme, the waves and the ascent. Silent in the climax (the tracks hear nothing 329-356 s).' },
  trackLine('violin'));
add('viola-line', { section: 'all', from: 20, to: 452, rule: 'skyline of the viola track (clean), >= 0.28 s',
  hears: 'The viola track\'s top line (YourMT3+ label): an inner voice, sparse; it carries the stretto cell at 304-307 and 312 s and rocks F3-Bb3 at 252 s.' },
  trackLine('viola'));
add('cello-line', { section: 'all', from: 20, to: 452, rule: 'skyline of the cello track (clean), >= 0.28 s',
  hears: 'The cello track\'s top line (YourMT3+ label): mostly the bass, but it sings the rising cell C3-Eb3-F3-Gb3 (232-235 s) and the stretto F4-Eb4-F4 ... Ab4 (307-314 s, vel 90-114).' },
  trackLine('cello'));

const HEADS = [[0.93, 70], [30.02, 70], [53.48, 70], [103.53, 70], [382.28, 70], [426.0, 70], [438.4, 58]];
add('theme-heads', { section: 'all', from: 0.9, to: 444, source: 'mixed', rule: `the long note that opens each statement of the theme: ${HEADS.map(([t, m]) => `${nm(m)} ${t}`).join(', ')} (clean roll / piano model)`,
  hears: 'Seven long notes, each the first note of a statement of the theme (the held Bb before it moves): the recurring event of the piece, 4-8 s each, the last one an octave low (Bb3 at 438.4 s).' },
  HEADS.map(([t, m]) => [openingBb, codaBb, ...clean].find((n) => n.m === m && Math.abs(n.t - t) < 0.02)));

const CADENCE = (c) => c.ns.length >= 3 && c.ns.filter((n) => n.e - n.t >= 2.5).length >= 3;
add('cadence-chords', { section: 'all', from: 20, to: 465.5, source: 'mixed', rule: 'clean roll clusters with >= 3 notes of which >= 3 last >= 2.5 s, whole chord, outside the hymn (356-377 s); plus the last chord (AUDIO.lastChord)',
  hears: 'The held chords where a phrase comes to rest (Ab at 21.1, F at 49.5, Ab at 70.1 ... the F chords of the end): one soft block each, 3-8 s long.' },
  [...clusters(clean).filter((c) => CADENCE(c) && !(c.t > 356 && c.t < 377)).flatMap((c) => c.ns), ...audio('lastChord')]);

add('long-tones', { section: 'all', from: 0.9, to: 465.5, source: 'mixed', rule: 'melody notes lasting >= 3.0 s, plus the climax chord\'s top and the last chord\'s top',
  hears: 'Only the long held notes of the line (3-8 s): the theme\'s Bbs, Gb5 at 71, the plateau Bb4, C5 at 396 ... For handover-type widgets that need long, slow notes.' },
  [...back(byId('melody').notes).filter((n) => n.e - n.t >= 3.0), ...audio('climaxChord').filter((n) => n.m === 92), ...audio('lastChord').filter((n) => n.m === 69)]);

/** Clusters whose two highest notes are an octave apart: the melody doubled at the octave. */
const octaves = clusters(clean.filter((n) => n.e - n.t >= 0.28)).filter((c) => {
  const ms = [...new Set(c.ns.map((n) => n.m))].sort((a, b) => b - a);
  return ms.length >= 2 && ms[0] - ms[1] === 12;
}).flatMap((c) => { const ms = [...new Set(c.ns.map((n) => n.m))].sort((a, b) => b - a); return c.ns.filter((n) => n.m === ms[0] || n.m === ms[1]).filter((n, i, a) => a.findIndex((x) => x.m === n.m) === i); });
add('octave-doublings', { section: 'all', from: 300, to: 430, rule: 'clean roll clusters (notes >= 0.28 s) whose two highest pitches are an octave apart: both notes, 300-430 s',
  hears: 'The theme doubled at the octave: the climb (315-329 s, C6/C5 ... Eb6/Eb5) and above all the reprise (384-421 s), where every melody note has its twin an octave down.' },
  octaves.filter((n) => n.t >= 300 && n.t < 430));

const blowsRaw = inWin(clean, 314, 329.3, (n) => n.v >= 109).sort((a, b) => a.t - b.t || b.m - a.m);
const blows = []; for (const n of blowsRaw) { const p = blows[blows.length - 1]; if (p && n.t - p.t < 0.6) { if (n.m > p.m && n.t - p.t < 0.04) blows[blows.length - 1] = n; continue; } blows.push(n); }
add('ff-blows', { section: 'Ascent + climax', from: 314, to: 353.0, source: 'mixed', rule: 'clean roll notes 314-329.3 s with velocity >= 109, one per 0.6 s (the highest of an attack); the climax chord changes (AUDIO.climaxStrokes); the climax chord (346.21)',
  hears: 'The strongest strokes of the ascent (vel 109-116, at most one per 0.6 s, up to the first chord of the climax at 328.79), the five chord changes of the climax (330.2-342.7) and the fff arrival at 346.2 s. The only place in the piece for fireworks.' },
  [...blows, ...audio('climaxStrokes'), ...audio('climaxChord').filter((n) => n.m === 92)]);

const forte = clusters(inWin(clean, 85, 314, (n) => n.v >= 95 && n.e - n.t >= 0.28)).map((c) => c.top);
add('forte-accents', { section: 'Swells', from: 85, to: 314, rule: 'clean roll notes 85-314 s with velocity >= 95 and >= 0.28 s, the top of each attack',
  hears: 'The loudest attacks of the swells before the climax: Eb4/F4/Ab4 at 93-98 s, F5/Db5/F4 at 144-147 s, Db4 at 258 s, Eb5/C5 at 278.8-279.1 s, the waves at 281-285 s, the stretto at 304-313 s. Points of pressure, a few per swell.' },
  forte);

add('audio-fills', { section: 'holes', from: 3.9, to: 465.5, source: 'audio', rule: 'all AUDIO notes',
  hears: 'Only what the transcription misses and the audio shows: the lower strings\' entrance (3.95), the climax\'s chord turn (336.9), the fff arrival (346.21), two hymn chords (363.0, 364.85), the bass C3 (448.5) and the last chord (455.4).' },
  Object.keys(AUDIO).flatMap(audio));

// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (!(n[1] > n[0]) || n[2] < 0 || n[2] > 127 || n[3] < 1 || n[3] > 127) throw new Error(`${s.id} bad note ${n}`);
  if (s.notes[0][0] < s.from - 0.05 || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside from/to (${s.notes[0][0]}-${s.notes[s.notes.length - 1][0]} vs ${s.from}-${s.to})`);
  // no attack in the cut-off silence (353.0-356.4) or after the end of the music (465.5)
  for (const n of s.notes) if ((n[0] >= 352.9 && n[0] < 356.4) || n[0] >= 465.5) throw new Error(`${s.id}: attack at ${n[0]} in a silence`);
}
const out = {};
for (const s of sets) out[s.id] = { hears: s.hears, source: s.source ?? 'roll', rule: s.rule, section: s.section, span: [s.from, s.to], attacks: s.attacks, notes: s.notes };
// one note per line, as canonicalShow writes them
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]').replace(/"span": \[\s+([-\d.]+),\s+([-\d.]+)\s+\]/g, '"span": [$1, $2]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');
for (const s of sets) {
  const first = s.notes[0][0], last = s.notes[s.notes.length - 1][0];
  console.log(`${s.id.padEnd(17)} ${String(s.attacks).padStart(3)} att ${String(s.notes.length).padStart(3)} n ${first.toFixed(1).padStart(6)}-${last.toFixed(1).padStart(6)} ${(s.source ?? 'roll').padEnd(5)} | ${s.notes.slice(0, 16).map((n) => nm(n[2])).join(' ')}`);
}
console.log(sets.length, 'sets;', `roll ${roll.length} -> clean ${clean.length}; piano-model-only ${packOnly.length} -> ${cleanPk.length}`);
