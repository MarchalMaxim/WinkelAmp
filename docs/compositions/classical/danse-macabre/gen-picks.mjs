// Pick sets for Saint-Saëns' Danse macabre (songs/danse-macabre), deterministic.
// Run from the worktree root:  node docs/compositions/classical/danse-macabre/gen-picks.mjs [--verbose]
//   -> writes picks.json next to this file: { "<set id>": { hears, notes: [[start, end, midi, velocity], ...], ... } },
//      notes sorted by start; prints each set's attacks (40 ms rule), notes, span and first pitches (the numbers in ANALYSIS.md).
//
// NOTE SOURCES
// - "roll": the studio note picker's roll for this pack. An ensemble pack with tracks takes the TRACKS branch of
//   src/studio/ui/picker-logic.ts pickerNotes: pack.tracks.<id>.notes, as they are (velocity borrowed from the piano model
//   or, for ~90 % of them, from the loudness curve, so all notes of one chord share one velocity). YourMT3 doubles lanes
//   (violin and viola carry the same D4, cello and strings the same G2): every set is deduped on (start to 10 ms, pitch).
// - "pack": pack.notes (the bytedance piano model): real attack strength, used for the harp strokes, ff blows and dawn chords.
// - "ymt3": rows of notes.ymt3.json whose YourMT3 label never reached a track (Chromatic Percussion = the xylophone, Drums,
//   Pipe = flute, Orchestral Harp). Velocity = the nearest same-pitched pack note within 80 ms, else loudness.
// - "audio": notes found in the recording where the transcription has none (the cock-crow, a pyin correction in the
//   violin's farewell). Velocity from the loudness curve: v = clamp(round(25 + 85 * loudness(t)), 20, 115).
// The audio tables at the end (AUDIO_ONSETS, AUDIO_DB) were made once with the venv's librosa 0.10 on songs/danse-macabre/
// audio.mp3 (sr 22050, mono, hop 512): onset_detect(onset_envelope=onset_strength(y)) times, and the max of
// amplitude_to_db(rms, ref=max) per 0.5 s. They are only used to print the per-section match rates and loudness.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = join(ROOT, 'songs/danse-macabre');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const ymt3 = JSON.parse(readFileSync(join(SONG, 'notes.ymt3.json'), 'utf8')).notes;
const VERBOSE = process.argv.includes('--verbose');
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const L = pack.loudness, loud = (t) => L.values[Math.min(L.values.length - 1, Math.max(0, Math.round(t / L.hop)))];
const loudVel = (t) => Math.max(20, Math.min(115, Math.round(25 + 85 * loud(t))));
const DUR = pack.duration;

// ---- the roll (tracks) ----
const FAMILY = { piano: 'keys', plucked: 'plucked', violin: 'strings', viola: 'strings', cello: 'strings', strings: 'strings', voice: 'voice', brass: 'brass', oboe: 'winds', clarinet: 'winds', bassoon: 'winds' };
const roll = [];
for (const [tr, o] of Object.entries(pack.tracks)) for (const [t, e, m, v] of o.notes) roll.push({ t, e, m, v, tr, f: FAMILY[tr] ?? 'other', src: 'roll' });
roll.sort((a, b) => a.t - b.t || a.m - b.m);
const packNotes = pack.notes.map(([t, e, m, v]) => ({ t, e, m, v, tr: 'pack', src: 'pack' })).sort((a, b) => a.t - b.t || a.m - b.m);
const byPitch = new Map();
for (const n of pack.notes) { const l = byPitch.get(n[2]); if (l) l.push(n); else byPitch.set(n[2], [n]); }
const ymt3Rows = (label) => ymt3.filter((r) => r[4] === label).map(([t, e, m]) => {
  let v = 0, near = 0.08;
  for (const n of byPitch.get(m) ?? []) { const d = Math.abs(n[0] - t); if (d < near) { near = d; v = n[3]; } }
  return { t, e: Math.max(e, t + 0.05), m, v: v || loudVel(t), tr: label, src: 'ymt3' };
}).sort((a, b) => a.t - b.t || a.m - b.m);
const audio = (t, e, m) => ({ t, e, m, v: loudVel(t), tr: 'audio', src: 'audio' });

// ---- helpers (the concerto's, adapted) ----
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
const TR = (...ids) => (n) => ids.includes(n.tr);
/** Skyline: the top of each onset cluster, unless a note more than a tone higher, begun within `hold` s, still sounds;
    notes shorter than minDur dropped; a repeat of the same pitch within 0.15 s merged (doubled lanes). */
function skyline(src, a, b, f, minDur = 0.15, hold = 0.8) {
  const ns = inWin(src, a - hold, b, (n) => f(n) && n.e - n.t >= minDur);
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
/** Bass on its beats: the lowest note (<= maxM) of each cluster, unless a note as low or lower began in the `gap` s before. */
function bassline(src, a, b, maxM = 50, gap = 0.3, f = () => true) {
  const ns = inWin(src, a - gap, b, (n) => n.m <= maxM && f(n));
  return clusters(ns).filter((c) => c.t >= a).map((c) => c.low).filter((n) => !ns.some((x) => x.t < n.t - 0.02 && x.t >= n.t - gap && x.m <= n.m));
}
/** Each chord thinned to its lowest and highest note: still one attack per chord. */
const outer = (cs) => cs.flatMap((c) => [...new Set([c.low, c.top])]);
/** Keep one cluster per `gap` s: the strongest (vmax, then size) of each run. */
function thin(cs, gap) {
  const out = [];
  for (const c of cs) {
    const last = out[out.length - 1];
    if (last && c.t - last.t < gap) { if (c.vmax > last.vmax || (c.vmax === last.vmax && c.ns.length > last.ns.length)) out[out.length - 1] = c; }
    else out.push(c);
  }
  return out;
}
const asTuple = (n) => [r4(n.t), r4(Math.min(DUR, Math.max(n.e, n.t + 0.01))), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];

const sets = [];
function add(id, o, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set();
  notes = notes.filter((n) => { const k = `${Math.round(n.t * 100)}|${n.m}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const srcs = [...new Set(notes.map((n) => n.src))];
  sets.push({ id, ...o, source: srcs.join('+'), attacks: clusters(notes).length, raw: notes, notes: notes.map(asTuple) });
}

// ===================================================================================================================
// THE SETS, in the order of the piece. `hears` is what a listener hears as that strand; `rule` how it was cut.
// ===================================================================================================================

// --- I. Midnight (0-26.0) ---
add('clock-strokes', { section: 'Midnight', hears: 'The harp strikes twelve: twelve soft D4 strokes, one a bar (0.77 s apart), 0.19-8.81 s.', rule: 'pack.notes D4 in 0-9.5 s, velocity >= 20 (drops a v18 ghost at 7.09 s; the roll splits stroke 2 into 0.85 + 0.96)' },
  inWin(packNotes, 0, 9.5, (n) => n.m === 62 && n.v >= 20));
add('hush-chord', { section: 'Midnight', hears: 'The pp D major chord in the strings after the twelfth stroke (9.62 s), then near-silence to 15 s.', rule: 'roll cluster at 9.62 s' },
  inWin(roll, 9.5, 9.7));
add('grave-pizz', { section: 'Death appears', hears: 'Seven low pizzicato notes, one a bar, D-A then up a diminished chord C-F#-A-C-Eb (13.61-18.09 s): the graves open. The first two are not in the roll.', rule: 'audio D2 13.61 s and A2 14.33 s (onset_detect on the percussive part; CQT peak D2 then A2) + roll notes <= midi 52 in 15-18.5 s (both octaves of each)' },
  [audio(13.61, 14.3, 38), audio(14.33, 15.0, 45), ...inWin(roll, 15, 18.5, (n) => n.m <= 52)]);
add('tuning-tritone', { section: 'Death tunes', hears: "Death's fiddle: the solo violin's A-Eb tritone double stops (the E string tuned down to Eb), 18.88-25.69 s, quickening.", rule: 'roll violin/viola/cello clusters 18.8-25.9 s that hold both A4 and Eb5; their A4 and Eb5' },
  clusters(inWin(roll, 18.8, 25.9, TR('violin', 'viola', 'cello'))).filter((c) => c.ns.some((n) => n.m === 69) && c.ns.some((n) => n.m === 75)).flatMap((c) => c.ns.filter((n) => n.m === 69 || n.m === 75)));
add('tuning-fifths', { section: 'Death tunes', hears: 'The answering open D-A fifths of the solo violin between the tritones (19.88-25.37 s).', rule: 'roll violin/viola/cello clusters 19.8-25.9 s with D4 and A4 and no Eb5; their D4 and A4' },
  clusters(inWin(roll, 19.8, 25.9, TR('violin', 'viola', 'cello'))).filter((c) => c.ns.some((n) => n.m === 62) && c.ns.some((n) => n.m === 69) && !c.ns.some((n) => n.m === 75)).flatMap((c) => c.ns.filter((n) => n.m === 62 || n.m === 69)));
add('dance-begins', { section: 'Death tunes', hears: 'The two chords that start the dance: D (26.03 s) and the G minor downbeat (26.37 s), the first strong attacks of the piece.', rule: 'pack clusters 25.95-26.45 s' },
  inWin(packNotes, 25.95, 26.45));

// --- II. Exposition: theme A (flute), theme B (solo violin), theme A in D, theme A and B tutti ---
add('pizz-waltz-bass', { section: 'Theme A (flute) to theme A in D', hears: 'The pizzicato waltz bass on the downbeats under the first themes (26.4-71.7 s): oom of oom-pah-pah.', rule: 'bassline of roll notes <= midi 50, 26.3-71.7 s, nothing as low in the 0.3 s before' },
  bassline(roll, 26.3, 71.7, 50, 0.3));
add('theme-a-flute', { section: 'Theme A (flute)', hears: 'The flute\'s waltz tune, theme A, G minor (26.4-41.3 s) - the roll barely has it: the YourMT3 flute rows (Pipe) and the roll\'s high strings notes that double it.', rule: 'ymt3 Pipe rows 26.4-41.3 s + roll skyline >= midi 70, minDur 0.1, 26.4-41.3 s' },
  [...inWin(ymt3Rows('Pipe'), 26.4, 41.3), ...skyline(roll, 26.4, 41.3, (n) => n.m >= 70, 0.1)]);
add('harp-chords-31', { section: 'Theme A (flute)', hears: 'The harp\'s soft F minor chords under the flute (30.9-32.5 s).', rule: 'ymt3 Orchestral Harp rows 30-33 s' },
  inWin(ymt3Rows('Orchestral Harp'), 30, 33));
add('theme-b-solo-violin', { section: 'Theme B (solo violin)', hears: 'The solo violin\'s theme B, a sighing chromatic descent G-F-E-Eb-D, four phrases (41.6-55.5 s).', rule: 'skyline of roll violin + voice notes midi 60-72, minDur 0.15, 41.3-55.6 s' },
  skyline(roll, 41.3, 55.6, (n) => (n.tr === 'violin' || n.tr === 'voice') && n.m >= 60 && n.m <= 72, 0.15));
for (const [id, a, b, ph] of [['theme-b-solo-p1', 41.3, 45.2, 'G-F-E-Eb'], ['theme-b-solo-p2', 45.2, 49.2, 'D-E-G-F#-E-D-E-F#'], ['theme-b-solo-p3', 49.2, 52.9, 'G-F-Eb-D'], ['theme-b-solo-p4', 52.9, 55.6, 'G-Bb-A-F#-D-F#-A-E-D']])
  add(id, { section: 'Theme B (solo violin)', hears: `Theme B, phrase ${id.slice(-1)} (${ph}): one short Ivory row.`, rule: `the theme-b-solo-violin notes in ${a}-${b} s` }, skyline(roll, a, b, (n) => (n.tr === 'violin' || n.tr === 'voice') && n.m >= 60 && n.m <= 72, 0.15));
add('theme-a-in-d', { section: 'Theme A in D', hears: 'Theme A again a fifth up, in D minor, over oboe/clarinet colour (55.1-68.5 s): the high strings\' line.', rule: 'skyline of roll string + oboe/clarinet notes >= midi 66, minDur 0.12, 55.1-68.5 s' },
  skyline(roll, 55.1, 68.5, (n) => ['violin', 'viola', 'cello', 'strings', 'oboe', 'clarinet'].includes(n.tr) && n.m >= 66, 0.12));
add('winds-56', { section: 'Theme A in D', hears: 'Oboe and clarinet answers inside theme A in D (55.8-67 s).', rule: 'roll oboe + clarinet notes 55-68.5 s' },
  inWin(roll, 55, 68.5, TR('oboe', 'clarinet')));
add('build-to-tutti', { section: 'Build', hears: 'The swell into the first tutti: the violins climbing on Eb5/D5 (68.5-71.7 s).', rule: 'skyline of roll violin notes >= midi 62, minDur 0.1, 68.5-71.7 s' },
  skyline(roll, 68.5, 71.7, (n) => n.tr === 'violin' && n.m >= 62, 0.1));
add('theme-a-tutti', { section: 'Theme A tutti (G minor)', hears: 'Theme A forte in the whole orchestra, the violins high (Bb5-Ab5-C6), 71.7-86.4 s.', rule: 'skyline of roll violin + strings notes >= midi 70, minDur 0.1, 71.7-86.4 s' },
  skyline(roll, 71.7, 86.4, (n) => (n.tr === 'violin' || n.tr === 'strings') && n.m >= 70, 0.1));
add('hammered-chords-80', { section: 'Theme A tutti (G minor)', hears: 'Repeated chords hammered in sixteenths, G minor then Ab major (79.9-83.9 s): bones rattling.', rule: 'roll piano-track clusters 79.8-84 s; lowest and highest note' },
  outer(clusters(inWin(roll, 79.8, 84, TR('piano')))));
add('theme-b-tutti', { section: 'Theme B tutti (legato ff)', hears: 'Theme B sung by the full strings, forte and legato, G-F-E-Eb-D (86.4-100.6 s): few audible attacks.', rule: 'skyline of roll notes midi 62-71, minDur 0.25, 86.4-100.6 s' },
  skyline(roll, 86.4, 100.6, (n) => n.m >= 62 && n.m <= 71 && n.tr !== 'piano', 0.25));
for (const [k, a, b, ph] of [[1, 86.4, 90.2, 'G-F-E-(G)-D-Eb-D'], [2, 90.2, 94.1, 'D-E-G-F#-E-D-E-F#-A-D'], [3, 94.1, 100.6, 'F held, then G-Bb-A-F#-D-F#-E']])
  add(`theme-b-tutti-p${k}`, { section: 'Theme B tutti (legato ff)', hears: `Theme B tutti, phrase ${k} (${ph}): one short Ivory row.`, rule: `the theme-b-tutti notes in ${a}-${b} s` }, skyline(roll, a, b, (n) => n.m >= 62 && n.m <= 71 && n.tr !== 'piano', 0.25));
add('theme-a-xylophone-d', { section: 'Theme A in D with xylophone', hears: 'Theme A in D minor with the xylophone (100.7-115 s): the violins\' high line.', rule: 'skyline of roll violin notes >= midi 74, minDur 0.1, 100.7-115 s' },
  skyline(roll, 100.7, 115, (n) => n.tr === 'violin' && n.m >= 74, 0.1));
add('xylophone-bones', { section: 'Xylophone', hears: 'The xylophone: dry rattling bones (104.7-106.2 s, 111.8-114.6 s, 233.5-239.1 s). Not in any track: YourMT3 labelled it Chromatic Percussion.', rule: 'ymt3 Chromatic Percussion rows (all 50)' },
  ymt3Rows('Chromatic Percussion'));
add('repeated-d-chords', { section: 'Theme A in D with xylophone', hears: 'Repeated D major chords pulsing under the xylophone (102.7-111.2 s).', rule: 'roll piano-track clusters 102.5-111.4 s; lowest and highest note' },
  outer(clusters(inWin(roll, 102.5, 111.4, TR('piano')))));
add('exposition-close', { section: 'Close of the exposition', hears: 'The D-A tremolo and the octave D blow that close the first part (115.5-119.5 s).', rule: 'pack clusters 115.4-119.6 s with a note >= 100 or >= 4 notes; lowest and highest' },
  outer(clusters(inWin(packNotes, 115.4, 119.6)).filter((c) => c.vmax >= 100 || c.ns.length >= 4)));
add('bass-tutti-1', { section: 'Theme A tutti to the close', hears: 'The bass under the first tutti (71.7-120.4 s), one note a beat.', rule: 'bassline of roll notes <= midi 50, 71.7-120.4 s, gap 0.3 s' },
  bassline(roll, 71.7, 120.4, 50, 0.3));

// --- III. Fugato and the pedals (120.4-175.4) ---
add('fugato-subject-low', { section: 'Fugato', hears: 'The fugato\'s subject entering low in the cellos and basses (120.5 s on), then its countersubjects (120.4-149.5 s).', rule: 'skyline of roll cello + strings notes <= midi 57, minDur 0.12, 120.4-149.5 s' },
  skyline(roll, 120.4, 149.5, (n) => (n.tr === 'cello' || n.tr === 'strings') && n.m <= 57, 0.12));
add('fugato-high', { section: 'Fugato', hears: 'The upper fugato voices (violins), entering one after the other and climbing to the brass (120.4-149.5 s).', rule: 'skyline of roll violin + viola notes >= midi 55, minDur 0.12, 120.4-149.5 s' },
  skyline(roll, 120.4, 149.5, (n) => (n.tr === 'violin' || n.tr === 'viola') && n.m >= 55, 0.12));
add('brass-calls', { section: 'Brass', hears: 'Every brass entry: the fugato peak (145.5-149 s), the A pedal climax (170-176 s), the ff of 228-231 s, 340-344 s and the last hammer (374.9-376.8 s).', rule: 'roll brass track (all 85 notes)' },
  inWin(roll, 0, DUR, TR('brass')));
add('pedal-e-toll', { section: 'E pedal', hears: 'The low E2 struck again and again under the theme fragments (149.6-162.3 s): a toll.', rule: 'roll cello notes E2 (40) and E3 (52) 149.5-162.4 s, bassline gap 0.2' },
  bassline(roll, 149.5, 162.4, 52, 0.2, (n) => n.m === 40 || n.m === 52));
add('pedal-a-toll', { section: 'A pedal', hears: 'The low A2 pedal that replaces it, crescendo to 175.4 s (162.4-175.4 s).', rule: 'roll notes A1/A2/Ab1/Ab2 (33, 45, 32, 44) 162.4-175.4 s, bassline gap 0.2' },
  bassline(roll, 162.4, 175.4, 45, 0.2, (n) => [33, 45, 32, 44].includes(n.m)));
add('pedal-line-high', { section: 'E and A pedals', hears: 'The violins\' line over the pedals (theme fragments in E and A), 149.5-175.4 s.', rule: 'skyline of roll violin notes >= midi 64, minDur 0.15, 149.5-175.4 s' },
  skyline(roll, 149.5, 175.4, (n) => n.tr === 'violin' && n.m >= 64, 0.15));
add('winds-156', { section: 'E pedal', hears: 'The oboe, clarinet and bassoon voices inside the E pedal passage (155.8-158 s).', rule: 'roll oboe + clarinet + bassoon notes 150-162 s' },
  inWin(roll, 150, 162, TR('oboe', 'clarinet', 'bassoon')));

// --- IV. The chorale (175.4-213) ---
add('chorale-top', { section: 'Chorale', hears: 'The slow legato chorale in B major (175.4-213 s), the passage the research calls the mocking Dies irae chorale: its long top notes fall chromatically B-Bb-A-G like theme B, while its chroma is closest to theme A in B (match 0.45-0.55; theme B only 0.36). The audio has almost no onsets here.', rule: 'skyline of roll notes >= midi 60 lasting >= 0.6 s, not plucked, 175.4-213 s' },
  skyline(roll, 175.4, 213, (n) => n.m >= 60 && n.tr !== 'plucked', 0.6, 1.5));
for (const [k, a, b] of [[1, 175.4, 184.0], [2, 184.0, 192.3], [3, 192.3, 200.7], [4, 200.7, 213.0]])
  add(`chorale-p${k}`, { section: 'Chorale', hears: `Chorale phrase ${k} (the four phrases repeat every ~8.4 s: chroma self-match 0.73, 0.59, 0.47): one short Ivory row or one handover.`, rule: `the chorale-top rule in ${a}-${b} s` }, skyline(roll, a, b, (n) => n.m >= 60 && n.tr !== 'plucked', 0.6, 1.5));
add('chorale-bass', { section: 'Chorale', hears: 'The chorale\'s slow bass notes (175.4-213 s).', rule: 'bassline of roll notes <= midi 52 lasting >= 0.5 s, gap 1.0 s, 175.4-213 s' },
  bassline(roll, 175.4, 213, 52, 1.0, (n) => n.e - n.t >= 0.5));
add('harp-arpeggios', { section: 'Chorale', hears: 'The harp\'s rippling arpeggios around the chorale (176-209 s).', rule: 'roll plucked track 175-210 s + ymt3 Orchestral Harp rows 178-209 s' },
  [...inWin(roll, 175, 210, TR('plucked')), ...inWin(ymt3Rows('Orchestral Harp'), 178, 209)]);
add('chorale-pulse', { section: 'Chorale', hears: 'The repeated B/F# figures that keep a faint pulse under the chorale (199.3-208.9 s).', rule: 'roll piano-track notes 199-209 s' },
  inWin(roll, 199, 209, TR('piano')));

// --- V. Second tutti (213-245) ---
add('build-213', { section: 'Build', hears: 'The crescendo out of the chorale: tremolo Eb6 above, A/Ab octaves hammered low (213-222 s).', rule: 'roll piano-track clusters 213-222 s; lowest and highest note' },
  outer(clusters(inWin(roll, 213, 222, TR('piano')))));
add('tutti-c-line', { section: 'Tutti (222-244.5)', hears: 'The ff tutti that opens at 222 s: the violins\' line (222-244.5 s).', rule: 'skyline of roll violin + strings notes >= midi 67, minDur 0.15, 222-244.5 s' },
  skyline(roll, 222, 244.5, (n) => (n.tr === 'violin' || n.tr === 'strings') && n.m >= 67, 0.15));
add('bass-tutti-2', { section: 'Tutti (222-244.5)', hears: 'The bass of the second tutti (213-244.5 s).', rule: 'bassline of roll notes <= midi 50, 213-244.5 s, gap 0.3 s' },
  bassline(roll, 213, 244.5, 50, 0.3));

// --- VI. The woodwind interlude (244.5-272.5) ---
add('stop-244', { section: 'Tutti (222-244.5)', hears: 'The tutti breaks off: the chords of 244.1 and 246.0 s.', rule: 'pack clusters 244-246.5 s with >= 3 notes and a note >= 95' },
  clusters(inWin(packNotes, 244, 246.5)).filter((c) => c.ns.length >= 3 && c.vmax >= 95).flatMap((c) => c.ns));
add('winds-interlude', { section: 'Woodwind interlude', hears: 'The bassoons, clarinets and oboe alone in the quiet (245-272.5 s): theme fragments passed from voice to voice.', rule: 'roll oboe + clarinet + bassoon notes 245-272.5 s' },
  inWin(roll, 245, 272.5, TR('oboe', 'clarinet', 'bassoon')));
add('interlude-strings', { section: 'Woodwind interlude', hears: 'The soft string notes under the woodwinds (248-272 s).', rule: 'skyline of roll violin/viola/cello notes, minDur 0.3, 248-272 s' },
  skyline(roll, 248, 272, (n) => ['violin', 'viola', 'cello'].includes(n.tr), 0.3));
add('cascade-262', { section: 'Woodwind interlude', hears: 'A quick cascade tumbling down from G5 (261.7-264.6 s).', rule: 'top note of each roll cluster 261.6-264.7 s, notes >= midi 55' },
  clusters(inWin(roll, 261.6, 264.7, (n) => n.m >= 55)).map((c) => c.top));

// --- VII. Development and the last build (272.5-322.8) ---
add('bass-development', { section: 'D pedal and build', hears: 'The D pedal and the bass of the long build (272.5-322.8 s).', rule: 'bassline of roll notes <= midi 50, 272.5-322.8 s, gap 0.3 s' },
  bassline(roll, 272.5, 322.8, 50, 0.3));
add('development-line', { section: 'D pedal and build', hears: 'The violins over the D pedal: theme A fragments in D (272.5-297 s).', rule: 'skyline of roll violin notes >= midi 62, minDur 0.2, 272.5-297 s' },
  skyline(roll, 272.5, 297, (n) => n.tr === 'violin' && n.m >= 62, 0.2));
add('build-line', { section: 'Build to the recapitulation', hears: 'Theme A in D, forte, rising to ff (297-320.4 s): the violins\' top line.', rule: 'skyline of roll violin notes >= midi 66, minDur 0.15, 297-320.4 s' },
  skyline(roll, 297, 320.4, (n) => n.tr === 'violin' && n.m >= 66, 0.15));
add('repeated-d-303', { section: 'Build to the recapitulation', hears: 'Repeated D major chords in sixteenths (303.2-305.0 s).', rule: 'roll piano-track clusters 303-305.1 s; lowest and highest' },
  outer(clusters(inWin(roll, 303, 305.1, TR('piano')))));
add('chromatic-ascent', { section: 'Build to the recapitulation', hears: 'The rising chromatic scale that launches the recapitulation (320.6-322.8 s).', rule: 'top note of roll clusters 320.4-322.9 s; only notes higher than the one before' },
  (() => { const out = []; for (const c of clusters(inWin(roll, 320.4, 322.9))) if (!out.length || c.top.m > out[out.length - 1].m) out.push(c.top); return out; })());

// --- VIII. Recapitulation and climax (322.8-376.8) ---
add('recap-theme-b-line', { section: 'Recapitulation: theme B ff', hears: 'The ff recapitulation, where theme B\'s harmony returns (chroma match 0.65 and 0.61 with the solo statement at 324.0 and 331.0 s): the strings\' held notes, middle-high. The roll does not hold the tune cleanly (322.8-338 s).', rule: 'skyline of roll notes midi 64-79 minDur 0.25, not piano, 322.8-338 s' },
  skyline(roll, 322.8, 338, (n) => n.m >= 64 && n.m <= 79 && n.tr !== 'piano', 0.25));
add('recap-high', { section: 'Recapitulation', hears: 'The violins\' highest notes in the recapitulation (322.8-361 s).', rule: 'skyline of roll violin notes >= midi 79, minDur 0.12, 322.8-361 s' },
  skyline(roll, 322.8, 361, (n) => n.tr === 'violin' && n.m >= 79, 0.12));
add('recap-line', { section: 'Recapitulation', hears: 'The violin line through the second half of the recapitulation, themes A and B intertwined over the drums (338-360.8 s).', rule: 'skyline of roll violin notes >= midi 62, minDur 0.15, 338-360.8 s' },
  skyline(roll, 338, 360.8, (n) => n.tr === 'violin' && n.m >= 62, 0.15));
add('frenzy-line', { section: 'Climax', hears: 'The top line of the frenzy before the hammering (360.8-370.7 s).', rule: 'skyline of roll violin + strings notes >= midi 62, minDur 0.1, 360.8-370.7 s' },
  skyline(roll, 360.8, 370.7, (n) => (n.tr === 'violin' || n.tr === 'strings') && n.m >= 62, 0.1));
add('bass-finale', { section: 'Recapitulation and climax', hears: 'The bass of the recapitulation and the frenzy (322.8-376.8 s).', rule: 'bassline of roll notes <= midi 50, 322.8-376.8 s, gap 0.3 s' },
  bassline(roll, 322.8, 376.8, 50, 0.3));
add('drum-strikes', { section: 'Recapitulation and climax', hears: 'The bass drum and timpani strokes and rolls (330.6, 331.4, 336-337.2, 342.2-343.7, 364.7-366.6 s); also 151.7 and 158.4 s.', rule: 'ymt3 Drums rows (all 48)' },
  ymt3Rows('Drums'));
add('octave-hammer-g', { section: 'Climax', hears: 'The F#-G octave hammering (370.73-371.43 s) and the G pedal blows over the A-Bb trill (372.73-374.16 s).', rule: 'roll clusters 370.7-374.2 s with >= 4 notes, a string note on F# or G; lowest and highest' },
  outer(clusters(inWin(roll, 370.7, 374.2, (n) => n.tr !== 'piano')).filter((c) => c.ns.length >= 4)));
add('bass-trill', { section: 'Climax', hears: 'The low A-Bb trill (with an Ab-G turn) in the basses under the final G pedal (372.73-374.71 s).', rule: 'roll piano-track notes 372.7-374.8 s (A1/Bb1 octaves)' },
  inWin(roll, 372.7, 374.8, TR('piano')));
add('final-hammer', { section: 'Climax', hears: 'The nine last blows of the dance: brass D4+G4, quickening and growing to 0 dB (374.89-376.80 s).', rule: 'roll brass notes 374.8-377 s' },
  inWin(roll, 374.8, 377, TR('brass')));

// --- Always-on threads across the whole piece (a score of crossfading weights needs sets that never stop) ---
add('thread-high', { section: 'whole piece', hears: 'The voiced-out high line of the whole piece: held notes (>= 0.28 s) of violins, strings and winds above G4, top of their chord.', rule: 'skyline of roll violin/strings/oboe/clarinet/voice notes >= midi 67, minDur 0.28, 0-430 s' },
  skyline(roll, 0, DUR, (n) => ['violin', 'strings', 'oboe', 'clarinet', 'voice'].includes(n.tr) && n.m >= 67, 0.28));
add('thread-mid', { section: 'whole piece', hears: 'The middle voice of the whole piece (G3-C5): violas, second violins, the themes when they sit low (theme B).', rule: 'skyline of roll violin/viola notes midi 55-72, minDur 0.28, 0-430 s' },
  skyline(roll, 0, DUR, (n) => (n.tr === 'violin' || n.tr === 'viola') && n.m >= 55 && n.m <= 72, 0.28));
add('thread-low', { section: 'whole piece', hears: 'The bass of the whole piece, at most one note per 0.5 s: pizzicato downbeats, pedals, tolls.', rule: 'bassline of roll notes <= midi 50, gap 0.5 s, 0-430 s' },
  bassline(roll, 0, DUR, 50, 0.5));
add('long-notes', { section: 'whole piece', hears: 'Every long held note (>= 1.0 s), the top one of its chord: the slow notes where a handover is allowed.', rule: 'skyline of roll notes lasting >= 1.0 s, 0-430 s (hold 1.5 s)' },
  skyline(roll, 0, DUR, () => true, 1.0, 1.5));

// --- ff blows across the piece (Fireworks) ---
{
  const cs = clusters(packNotes).filter((c) => c.ns.length >= 3 && c.vmax >= 103 && loud(c.t + 0.1) >= 0.86 && c.low.m <= 55);
  add('ff-blows', { section: 'whole piece', hears: 'The real fortissimo blows of the tutti: wide chords with the bass in them at the loudest moments (313.38, 336.26, 361.90, 364.44, 367.34, 371.21, 373.98 s), at most one per 2 s; the nine last blows are final-hammer.', rule: 'pack clusters with >= 3 notes, a note >= 103, loudness >= 0.86 and a note <= midi 55; the strongest of each 2 s; lowest and highest note' },
    outer(thin(cs, 2.0)));
}
add('ff-blows-early', { section: 'whole piece', hears: 'The strongest blows of the first half: the dance\'s first downbeat (26.37), the octave D that ends the exposition (118.21), the tutti\'s C# stamp (237.78) and the break (244.08). Not ff by loudness (-5 to -12 dB): strikes, not Fireworks.', rule: 'pack clusters before 260 s with >= 2 notes and a note >= 103; one per 2 s; lowest and highest note' },
  outer(thin(clusters(inWin(packNotes, 0, 260)).filter((c) => c.vmax >= 103 && c.ns.length >= 2), 2.0)));

// --- IX. Dawn (376.8-430) ---
add('cock-crow', { section: 'Dawn: the cock crows', hears: 'A thin high woodwind call in the near-silence after the last blow: Eb5, Bb5, Eb5 and a held G5 (378.95-383.3 s) - the oboe\'s cock-crow. The roll has nothing here.', rule: 'audio: librosa onsets 378.95, 379.41, 379.88, 380.25 s; pitch from the CQT peak above C5; the G5 held to 383.3 s (pyin G5 380.68-382.83)' },
  [audio(378.95, 379.35, 75), audio(379.41, 379.82, 82), audio(379.88, 380.2, 75), audio(380.25, 383.3, 79)]);
add('dawn-chords', { section: 'Dawn', hears: 'The pale chords of dawn: the sf chord on C#/G/Bb/Eb (383.66), the soft G major chords (389.65, 390.58), G-Bb-Eb (391.59) and G minor (394.02). Long, slow: handover allowed.', rule: 'pack notes in 383.6-383.8, 389.6-389.9 (a rolled harp chord: 4 attacks), 390.5-390.7, 391.5-391.7, 393.9-394.1 s' },
  [[383.6, 383.8], [389.6, 389.9], [390.5, 390.7], [391.5, 391.7], [393.9, 394.1]].flatMap(([a, b]) => inWin(packNotes, a, b)));
add('dawn-tremolo', { section: 'Dawn', hears: 'The measured tremolo F-Bb-Eb over C# (385.02-386.52 s), shivering, dying away.', rule: 'roll plucked track 385-386.6 s, top note of each cluster' },
  clusters(inWin(roll, 385, 386.6, TR('plucked'))).map((c) => c.top));
{
  // The roll's violin farewell, checked against pyin (confidence > 0.2): 410.65 Ab3 agrees (pyin Ab3 0.59); the roll's 411.58 A3
  // (0.06 s) is pyin's Bb3 (411.68-412.35, 0.66), so it is replaced; pyin's Eb4 from 413.42 (0.83, onset 413.32) is added.
  const v = inWin(roll, 395.8, 417.9, (n) => n.tr === 'violin' && n.m >= 55 && !(Math.abs(n.t - 411.58) < 0.01));
  const lead = skyline(v, 395.8, 417.9, () => true, 0.1, 0.3);
  add('farewell-violin', { section: "Dawn: the violin's farewell", hears: 'The solo violin\'s last wistful phrase, pianissimo: Bb-A-G, Bb-G-F-Eb, Eb-Ab-Bb-C-Eb (395.87-418 s); the dead slip away.', rule: 'skyline of roll violin notes >= midi 55, 395.8-417.9 s (minDur 0.1); 411.58 A3 -> audio Bb3 411.68; + audio Eb4 413.32' },
    [...lead, audio(411.68, 412.35, 58), audio(413.32, 415.2, 63)]);
}
add('last-trill', { section: 'Dawn: the skeletons flee', hears: 'The violin\'s D-Eb trill (418.0-420.0 s), shivering.', rule: 'roll violin notes D4/Eb4 418-420 s' },
  inWin(roll, 418, 420, (n) => n.tr === 'violin' && (n.m === 62 || n.m === 63)));
add('scurry', { section: 'Dawn: the skeletons flee', hears: 'The last scurry: pizzicato G minor figures and the violin\'s D-Eb flutter up to D6 (420.0-423.9 s).', rule: 'top note of roll clusters 420-424 s' },
  clusters(inWin(roll, 420, 424)).map((c) => c.top));
add('final-pizz', { section: 'Dawn: the end', hears: 'The bass falls Bb-G-D in pizzicato, then the last two chords, D major and G minor (424.07-426.24 s).', rule: 'roll clusters 424-426.5 s; lowest and highest note' },
  outer(clusters(inWin(roll, 424, 426.5))));

// ---- checks ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (!(n[0] >= 0 && n[1] >= n[0] && n[1] <= DUR + 1e-6 && n[2] >= 0 && n[2] <= 127 && Number.isInteger(n[3]) && n[3] >= 1 && n[3] <= 127)) throw new Error(`${s.id} bad note ${n}`);
}
if (new Set(sets.map((s) => s.id)).size !== sets.length) throw new Error('duplicate ids');
const expect = { 'clock-strokes': 12, 'grave-pizz': 7, 'final-hammer': 9, 'final-pizz': 5, 'cock-crow': 4 };
for (const [id, n] of Object.entries(expect)) { const s = sets.find((x) => x.id === id); if (s.attacks !== n) throw new Error(`${id}: ${s.attacks} attacks, expected ${n}`); }

// ---- output ----
const out = {};
for (const s of sets) {
  const a = s.notes[0][0], b = Math.max(...s.notes.map((n) => n[1]));
  out[s.id] = { hears: s.hears, section: s.section, source: s.source, rule: s.rule, attacks: s.attacks, span: `${a.toFixed(2)}-${b.toFixed(2)}`, notes: s.notes };
}
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks.json'), text + '\n');
for (const s of sets) {
  const span = out[s.id].span;
  console.log(`${s.id.padEnd(22)} ${String(s.attacks).padStart(4)} att ${String(s.notes.length).padStart(4)} notes ${span.padEnd(15)} ${s.source.padEnd(10)} | ${s.raw.slice(0, VERBOSE ? 400 : 16).map((n) => nm(n.m) + (VERBOSE ? '@' + n.t.toFixed(2) : '')).join(' ')}`);
}
console.log(sets.length, 'sets');

// ---- per-section numbers for ANALYSIS.md: roll attacks, match rate against the audio onsets, loudness ----
const FORM = [[0, 9.6], [9.6, 13.6], [13.6, 18.85], [18.85, 26.0], [26.0, 41.3], [41.3, 55.1], [55.1, 68.5], [68.5, 71.7], [71.7, 86.4], [86.4, 100.6], [100.6, 115.4], [115.4, 120.4], [120.4, 149.5], [149.5, 162.4], [162.4, 175.4], [175.4, 213.0], [213.0, 222.0], [222.0, 244.5], [244.5, 248.0], [248.0, 272.5], [272.5, 297.0], [297.0, 320.4], [320.4, 322.8], [322.8, 338.0], [338.0, 360.8], [360.8, 376.9], [376.9, 383.6], [383.6, 395.3], [395.3, 418.0], [418.0, 424.0], [424.0, 429.8]];
function printForm() {
  const rc = clusters(roll);
  for (const [a, b] of FORM) {
    const cs = rc.filter((c) => c.t >= a && c.t < b), on = AUDIO_ONSETS.filter((t) => t >= a && t < b);
    const matched = cs.filter((c) => on.some((t) => Math.abs(t - c.t) < 0.06)).length;
    const dbs = AUDIO_DB.slice(Math.floor(a * 2), Math.ceil(b * 2)), dbm = dbs.reduce((s, x) => s + x, 0) / dbs.length;
    const low = cs.filter((c) => c.low.m < 50).length;
    console.log(`${a.toFixed(1).padStart(6)}-${b.toFixed(1).padEnd(6)} roll ${(cs.length / (b - a)).toFixed(1).padStart(4)}/s  audio ${(on.length / (b - a)).toFixed(1).padStart(4)}/s  match ${cs.length ? Math.round(100 * matched / cs.length) : 0}%  low ${cs.length ? Math.round(100 * low / cs.length) : 0}%  dB ${dbm.toFixed(0)} (max ${Math.max(...dbs)})`);
  }
}

// ---- audio tables (see the header) ----
const AUDIO_ONSETS = [0.23,1,1.77,2.55,3.37,4.16,4.95,5.71,6.48,7.25,8.85,14.35,15.86,16.58,16.7,18.14,18.76,18.9,19.92,20.88,21.48,21.85,22.38,22.78,23.34,23.66,24.24,24.57,24.85,25.15,25.43,25.73,26.05,26.4,27.38,27.96,28.26,28.72,29,29.14,29.49,30.07,30.4,30.95,31.3,31.56,31.9,32.42,33.3,33.92,34.06,34.23,34.51,35.11,35.23,35.39,35.71,35.85,35.99,36.27,36.32,36.57,36.73,36.85,36.99,37.45,37.59,37.73,37.87,38.01,38.34,38.48,38.85,38.89,39.22,39.47,39.75,40.05,40.19,40.33,40.61,41.17,41.56,42.24,42.56,42.86,43.03,43.19,44.1,44.42,44.72,45.02,45.42,45.98,46.32,46.49,46.97,47.55,48.16,48.46,48.74,49.13,49.97,50.57,52.76,53.06,53.99,54.31,54.89,55.24,55.52,55.87,56.01,56.12,56.26,56.4,56.7,56.84,56.98,57.1,57.24,57.54,57.68,57.82,57.96,58.1,58.4,58.51,58.65,58.79,58.93,59.26,59.4,59.51,59.77,60.02,60.16,60.3,60.44,60.56,60.81,61.09,61.23,61.35,61.6,61.86,62.11,62.6,63.02,63.32,63.46,63.58,63.72,63.83,64.13,64.25,64.39,64.53,64.67,64.95,65.09,65.22,65.36,65.48,66.32,66.53,66.57,66.83,66.97,67.08,67.34,67.62,67.85,68.13,68.27,68.41,68.64,68.94,69.19,69.45,69.73,69.99,70.22,70.5,70.77,71.03,71.33,71.68,72.01,72.56,72.96,73.28,73.79,74.4,74.51,74.63,75.23,75.49,76.09,76.19,76.32,77.16,77.6,77.74,77.86,78,78.81,79.44,79.58,79.71,80.02,80.16,80.27,80.55,81.39,81.71,81.85,81.97,82.22,82.57,82.69,82.83,83.06,83.38,83.89,84.47,84.75,85.19,85.31,85.59,93.88,94.88,95.83,96.48,98.38,99.64,100.26,100.59,100.91,102.15,102.28,102.42,102.68,102.75,103,103.26,103.4,103.84,104.1,104.68,104.77,104.89,105.02,105.16,105.3,105.58,105.65,105.77,105.91,106.05,106.19,106.49,106.63,106.79,106.93,107.04,107.37,107.51,107.65,107.95,108.3,108.86,109.16,109.41,109.53,109.74,110.43,110.9,111.29,111.5,111.8,112.01,112.11,112.29,112.41,112.73,112.87,113.01,113.15,113.29,113.62,113.76,113.89,114.06,114.17,114.47,114.61,114.75,114.89,115.03,115.15,115.45,115.71,115.98,116.26,116.52,116.77,117.08,117.35,117.66,117.7,117.93,118.24,118.56,120.07,120.37,120.93,121.23,121.39,121.51,121.77,122.07,122.35,122.6,122.93,123.21,123.34,123.48,123.6,123.74,124.02,124.16,124.3,124.44,124.58,124.83,125.11,125.43,125.57,125.71,125.83,126.25,126.43,126.71,127.11,127.41,127.52,127.66,127.94,128.13,128.27,128.41,128.8,129.64,129.89,130.45,130.71,130.89,131.03,131.29,131.87,132.12,132.7,132.98,133.26,133.42,133.54,133.79,134.1,134.37,134.65,134.93,135.09,135.21,135.47,135.74,135.91,136.02,136.3,136.86,137.14,137.44,137.72,137.86,138,138.28,138.41,138.55,138.83,138.88,139.44,139.69,139.85,140.25,140.41,140.53,140.81,141.08,141.34,141.62,142.18,142.71,143.01,143.59,143.87,144.17,144.41,144.71,145.01,145.24,145.54,145.85,146.1,146.4,146.66,146.94,147.22,147.47,147.75,148.03,148.54,148.86,149.75,150.02,150.33,150.6,150.91,151.16,151.44,151.72,152,152.3,152.83,153.14,153.39,153.67,153.97,154.23,154.51,154.78,155.09,155.34,155.64,155.92,156.18,156.48,156.78,157.04,157.34,157.87,158.17,158.45,158.71,159.03,159.57,159.87,160.17,160.4,160.73,160.96,161.26,161.54,161.84,162.07,162.38,162.93,163.24,163.54,163.79,164.1,164.4,164.63,164.93,165.21,165.47,165.77,166.05,166.3,167.65,167.9,168.18,168.72,169.02,169.3,169.53,169.83,170.32,170.64,171.15,171.43,171.94,172.25,172.76,173.06,173.34,173.55,173.85,174.08,174.36,174.64,174.87,175.13,175.43,182.16,195.07,215.2,216.11,216.67,216.9,217.18,217.43,217.83,217.97,218.24,218.5,218.78,219.06,219.31,219.57,219.85,220.13,220.29,220.66,220.96,221.17,221.45,221.73,222.03,224.7,227.09,227.46,228.3,228.81,230.6,230.97,231.48,231.83,232.39,232.69,232.99,233.24,233.55,233.8,234.1,234.45,234.59,234.73,234.85,234.96,235.27,235.43,235.54,235.66,235.78,235.92,236.17,236.29,236.57,236.68,236.98,237.26,237.4,237.54,237.82,238.1,238.38,238.66,238.93,239.19,239.58,240.47,241.05,241.37,242.3,243.23,244.14,245.09,245.97,248.78,249.38,249.71,250.27,250.59,251.19,251.52,252.4,253.01,253.33,254.24,259,259.9,260.85,261.78,261.94,262.11,262.66,262.97,263.5,265.31,266.15,267.01,267.91,268.47,268.79,268.84,268.98,269.44,269.68,270,270.28,270.54,271.37,272.23,272.72,273.04,273.58,273.88,274.11,274.67,274.95,275.23,275.53,275.83,276.13,276.43,276.57,276.69,276.97,277.27,277.34,277.66,278.13,278.34,278.43,278.64,278.92,279.2,279.5,279.8,279.92,280.06,280.33,280.61,280.94,281.17,281.47,281.64,281.75,282.05,282.33,282.68,282.96,283.21,283.49,283.75,284.03,284.31,284.56,284.89,286.33,286.86,287.14,287.42,287.7,287.86,287.97,288.86,289.58,289.69,289.81,289.92,290.25,290.51,290.78,291.06,291.32,291.67,295.15,295.61,310.89,311.75,312.59,314.65,314.77,314.89,315.02,315.4,315.68,315.98,316.12,316.26,316.4,316.51,316.65,316.77,316.93,317.05,317.3,317.58,318.42,319.16,319.58,319.95,323.99,326.26,328.42,328.75,329.03,329.28,329.54,329.79,330.12,330.35,330.63,331.23,332.88,335.11,335.39,335.62,335.92,336.18,336.76,336.9,337.29,338.13,338.43,338.59,338.71,338.94,339.27,339.41,339.8,340.61,340.92,341.45,342.24,342.56,342.82,343.63,343.75,345.47,348.25,348.65,348.9,349.41,349.55,349.69,350.16,351.78,352.57,353.36,353.64,354.17,354.69,354.82,354.94,355.45,355.59,355.71,357.12,357.26,357.75,358.01,358.28,358.54,358.66,358.8,359.28,359.56,360.35,360.61,361.09,361.14,361.42,361.7,361.93,362.19,362.42,362.65,362.91,363.14,363.39,363.83,364.14,364.76,365.3,365.53,365.78,366.02,366.25,366.48,366.71,366.97,367.43,367.69,368.13,368.36,369.13,369.38,369.82,370.59,371.29,372.03,372.75,373.49,374.24,374.49,374.93,375.19,375.65,375.91,376.35,378.95,379.41,379.88,380.25,382.29,390.63,395.34,397.11,401.45,403.63,404.24,405.54,409.72,410.06,412.41,418.38,418.54,419,420.12,420.28,420.4,420.51,420.65,420.93,423,423.16,423.25,423.51,423.74,425.46,426.27];
const AUDIO_DB = [-25,-28,-29,-26,-32,-26,-27,-30,-27,-24,-25,-23,-24,-24,-27,-28,-26,-24,-26,-35,-41,-40,-38,-41,-42,-46,-49,-30,-26,-29,-27,-27,-29,-26,-28,-30,-28,-18,-18,-22,-19,-17,-18,-15,-15,-17,-20,-18,-23,-24,-17,-15,-12,-13,-24,-25,-24,-22,-22,-25,-26,-29,-23,-26,-25,-27,-25,-26,-23,-21,-20,-23,-20,-23,-20,-21,-19,-21,-22,-19,-24,-19,-20,-22,-23,-21,-21,-20,-19,-21,-19,-18,-21,-21,-19,-19,-20,-17,-19,-23,-20,-20,-20,-18,-20,-17,-20,-23,-23,-22,-24,-19,-21,-21,-20,-20,-20,-21,-20,-21,-20,-19,-19,-17,-13,-18,-20,-20,-22,-20,-18,-18,-17,-19,-17,-19,-15,-14,-11,-12,-13,-16,-12,-9,-7,-13,-13,-11,-12,-11,-13,-12,-11,-15,-10,-14,-13,-11,-12,-12,-16,-14,-12,-14,-13,-16,-12,-12,-15,-12,-15,-10,-14,-11,-10,-8,-10,-9,-10,-9,-9,-9,-7,-8,-9,-9,-7,-9,-9,-7,-8,-8,-9,-10,-8,-10,-12,-10,-8,-9,-7,-9,-9,-16,-18,-19,-19,-18,-17,-14,-14,-15,-12,-13,-12,-13,-13,-16,-18,-18,-18,-17,-18,-16,-16,-16,-17,-15,-14,-13,-11,-14,-14,-13,-13,-11,-5,-4,-12,-17,-23,-23,-23,-26,-21,-23,-22,-21,-23,-20,-18,-17,-20,-19,-20,-20,-21,-18,-21,-17,-18,-18,-16,-17,-16,-17,-18,-18,-20,-15,-15,-15,-14,-14,-11,-16,-12,-14,-13,-10,-13,-13,-12,-11,-11,-11,-9,-9,-10,-8,-10,-9,-8,-9,-8,-8,-8,-8,-11,-14,-16,-15,-17,-16,-16,-16,-15,-16,-16,-13,-17,-16,-15,-14,-15,-16,-15,-16,-16,-15,-15,-16,-15,-16,-14,-16,-19,-18,-17,-17,-17,-17,-16,-13,-16,-14,-14,-14,-14,-13,-12,-13,-11,-12,-12,-10,-9,-9,-7,-7,-6,-7,-17,-21,-19,-23,-23,-21,-22,-23,-22,-22,-18,-21,-20,-20,-20,-21,-18,-18,-13,-14,-13,-15,-14,-14,-16,-14,-16,-17,-17,-17,-20,-19,-18,-18,-17,-16,-16,-20,-19,-19,-19,-17,-17,-20,-19,-19,-16,-19,-17,-19,-19,-17,-17,-17,-17,-15,-15,-16,-14,-17,-15,-16,-16,-19,-19,-18,-20,-18,-15,-14,-15,-15,-15,-13,-14,-12,-12,-12,-15,-15,-18,-19,-15,-16,-14,-12,-12,-13,-12,-12,-12,-10,-6,-15,-13,-10,-9,-10,-9,-13,-16,-12,-13,-10,-9,-10,-9,-11,-11,-11,-10,-9,-9,-7,-8,-8,-8,-8,-8,-9,-11,-8,-8,-8,-7,-8,-8,-8,-8,-7,-7,-6,-8,-7,-8,-9,-8,-8,-10,-13,-11,-11,-13,-15,-17,-17,-19,-21,-21,-20,-25,-24,-27,-26,-26,-26,-26,-25,-26,-26,-23,-22,-26,-27,-31,-25,-25,-24,-26,-24,-25,-27,-27,-28,-29,-27,-27,-27,-29,-29,-25,-25,-21,-19,-18,-17,-18,-18,-19,-19,-21,-21,-15,-16,-18,-14,-18,-15,-15,-16,-19,-23,-21,-21,-21,-18,-20,-18,-20,-16,-16,-19,-18,-22,-24,-25,-24,-22,-21,-19,-21,-20,-20,-21,-18,-17,-17,-18,-19,-18,-19,-19,-20,-19,-18,-19,-21,-24,-17,-18,-19,-17,-12,-13,-11,-14,-18,-15,-13,-11,-11,-12,-11,-11,-10,-9,-11,-10,-9,-10,-9,-8,-8,-9,-9,-9,-8,-8,-7,-7,-9,-7,-7,-7,-7,-6,-5,-6,-8,-9,-9,-8,-10,-10,-12,-11,-12,-13,-12,-12,-14,-15,-13,-11,-8,-3,-2,-6,-5,-6,-6,-6,-6,-6,-5,-5,-5,-5,-3,-2,-2,-3,-6,-5,-7,-7,-7,-8,-7,-4,-4,-4,-3,-5,-7,-8,-8,-6,-8,-5,-3,-3,-2,-3,-2,-3,-4,-8,-8,-11,-10,-10,-9,-10,-11,-11,-9,-10,-2,-2,-8,-11,-12,-10,-9,-9,-10,-9,-10,-10,-8,-9,-9,-8,-10,-8,-8,-6,-5,-7,-1,-2,-3,-3,-5,-4,-4,-3,-3,-3,-3,-4,-4,-3,-2,-2,-5,-3,-4,-5,-4,-4,-4,-4,-4,-2,-2,-2,-1,0,0,0,-3,-11,-16,-18,-18,-19,-16,-18,-20,-21,-22,-24,-27,-11,-10,-10,-12,-15,-13,-18,-18,-21,-22,-21,-25,-29,-29,-28,-30,-32,-33,-39,-42,-44,-31,-30,-26,-26,-30,-29,-29,-30,-29,-30,-33,-36,-35,-40,-31,-30,-31,-30,-29,-29,-31,-27,-25,-25,-26,-30,-36,-37,-37,-37,-38,-28,-27,-30,-31,-29,-25,-25,-27,-26,-25,-25,-26,-26,-30,-36,-41,-36,-24,-33,-35,-39,-30,-27,-26,-33,-36,-40,-36,-28,-29,-31,-27,-27,-25,-29,-41,-53,-59,-66,-77,-80];

if (process.argv.includes('--form')) printForm();
