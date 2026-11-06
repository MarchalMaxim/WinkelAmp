// Candidate pick sets for Rachmaninoff PC2/I (songs/rach-concerto-2), deterministic.
// Run: node gen-picks.mjs [worktree]   -> writes <worktree>/docs/compositions/rach-concerto-2/picks.json
//                                         and prints the per-section numbers used in ANALYSIS.md.
// Note source: the note picker's roll (src/studio/ui/picker-logic.ts pickerNotes, labels branch): the YourMT3 rows of
// songs/rach-concerto-2/notes.ymt3.json, each with the velocity of the nearest same-pitched pack note within 80 ms.
// Where no pack note is near (the picker's "guessed" 70), velocity here comes from the loudness curve instead:
// v = clamp(round(25 + 85 * loudness(t)), 20, 115), so a soft horn and a ff string line differ. Matching in the picker
// is by pitch and time only (50 ms), so these notes are found on the roll. Sets marked source "pack" take pack.notes
// (the piano model) because YourMT3 misses them (deep bass); the picker shows those as notes it cannot find on its roll.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const W = process.argv[2] || 'C:/Users/maxim/Desktop/projects/github/WinkelAmp/.claude/worktrees/elastic-allen-763e4b';
const pack = JSON.parse(readFileSync(join(W, 'songs/rach-concerto-2/pack.json'), 'utf8'));
const labels = JSON.parse(readFileSync(join(W, 'songs/rach-concerto-2/notes.ymt3.json'), 'utf8')).notes;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const L = pack.loudness, loud = (t) => L.values[Math.min(L.values.length - 1, Math.max(0, Math.round(t / L.hop)))];
const fam = (l) => /Violin|Viola|Cello|String|Contrabass/.test(l) ? 'str' : /Piano/.test(l) ? 'pno' : /Clarinet|Oboe|Horn|Bassoon|Pipe|Flute/.test(l) ? 'wind' : 'oth';

// ---- the roll ----
const byPitch = new Map();
for (const n of pack.notes) { const l = byPitch.get(n[2]); if (l) l.push(n); else byPitch.set(n[2], [n]); }
const roll = labels.map(([t, e, m, , label], k) => {
  let v = 70, near = 0.08, guessed = true;
  for (const n of byPitch.get(m) ?? []) { const d = Math.abs(n[0] - t); if (d < near) { near = d; v = n[3]; guessed = false; } }
  if (guessed) v = Math.max(20, Math.min(115, Math.round(25 + 85 * loud(t))));
  return { t, e, m, v, label, f: fam(label), k };
}).sort((a, b) => a.t - b.t || a.k - b.k);
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, label: 'pack', f: 'pno', k }));

// ---- helpers ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) { if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; cur.vmax = Math.max(cur.vmax, n.v); } else { cur = { t: n.t, ns: [n], top: n, low: n, vmax: n.v }; out.push(cur); } }
  return out;
}
const inWin = (src, a, b, filter = () => true) => src.filter((n) => n.t >= a && n.t < b && filter(n));
/** Skyline melody: the top of each onset cluster, unless a note more than a tone higher, begun within 0.8 s, still sounds
    (accompaniment under a held melody note); notes shorter than minDur dropped (ornaments); a repeat of the same pitch
    within 0.15 s merged (doubled instruments). */
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
const attacks = (notes) => clusters(notes).length;
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];

const sets = [];
function add(id, o, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const ids = new Set(); notes = notes.filter((n) => { const key = `${n.t}|${n.m}|${n.label}`; if (ids.has(key)) return false; ids.add(key); return true; });
  sets.push({ id, ...o, attacks: attacks(notes), source: o.source ?? 'roll', notes: notes.map(asTuple) });
}
const whole = (cs) => cs.flatMap((c) => c.ns);
/** Each chord thinned to its lowest and highest note (and its loudest, if asked): still one attack per chord, fewer notes. */
const outer = (cs, loudest = false) => cs.flatMap((c) => {
  const keep = new Set([c.low, c.top]);
  if (loudest) keep.add(c.ns.reduce((a, n) => (n.v > a.v ? n : a)));
  return [...keep];
});

// ================= the sets =================
// --- Introduction: the bells ---
add('bells', { name: 'Opening chords (bells)', section: 'Intro', from: 4.5, to: 41, source: 'pack', pair: 'bells', rule: 'pack clusters 4.5-41 s with >= 3 notes; of each, the lowest, highest and loudest note', why: 'The eight chords of the opening (5.2-36.3 s, one every ~4.1 s over the low F, pp to ff), then the Ab, F, G bass octaves (37.2, 38.2, 39.4 s) and the C minor arrival (40.3, 40.5 s): 13 strokes, loudest note rising from v39 to v112.' },
  outer(clusters(inWin(packNotes, 4.5, 41)).filter((c) => c.ns.length >= 3), true));
add('c1-bells', { name: 'Low C bells under theme 1', section: 'A', from: 40, to: 60, source: 'pack', pair: 'deep', rule: 'pack notes midi <= 26 (C1-D1) in 40-60 s', why: 'The piano\'s lowest C, struck every ~1.5 s under the first theme: the opening bells continued as a pulse.' },
  inWin(packNotes, 40, 60, (n) => n.m <= 26));

// --- Theme 1 (exposition A, A') ---
const STR = (n) => n.f === 'str';
add('t1-head-a', { name: 'Theme 1 head, A (strings)', section: 'A', from: 45.9, to: 55.2, pair: 't1-head', rule: 'skyline of string-family roll notes 45.9-55.2 s, minDur 0.15', why: 'The first theme\'s opening phrase in violas/cellos, C minor: D-C-Bb-Ab-Bb-G-(Bb)-C-D-Eb-D-Eb-D-C-Bb-Ab-G-F, 18 notes (the Eb3-D3 pickup at 45.25-45.7 left out so it starts like the recap). Same shape as t1-head-a3, which has 17 (no passing Bb).' },
  skyline(roll, 45.9, 55.2, STR));
add('t1-answer-a', { name: 'Theme 1 answer, A (strings)', section: 'A', from: 55.5, to: 66, pair: 't1-answer', rule: 'skyline of string-family roll notes 55.5-66 s, minDur 0.15', why: 'The answering phrase, climbing to Ab4 at 61.7 s and falling back to C: same shape as t1-answer-a3.' },
  skyline(roll, 55.5, 66, STR));

add('t1-rise-a2', { name: 'Theme 1 continuation rising, A\' (strings)', section: 'A\'', from: 76.2, to: 92, pair: 't1-rise', rule: 'skyline of string-family roll notes 76.2-92 s, minDur 0.15', why: 'The second statement climbs by steps B3-C4-D4-Eb4-F4 ... to D5 at 91.2 s, the first big swell (C#1 bass ff at 79.9 s).' },
  skyline(roll, 76.2, 92, STR));
add('t1-fall-a2', { name: 'Theme 1 continuation falling, A\' (strings)', section: 'A\'', from: 92, to: 112, pair: 't1-fall', rule: 'skyline of string-family roll notes 92-112 s, minDur 0.25', why: 'The long descent from C5 to C4 that winds the first theme down (92-111 s).' },
  skyline(roll, 92, 112, STR, 0.25));


// --- Transition ---
add('trans-accents', { name: 'Transition piano accents', section: 'T', from: 113, to: 135, rule: 'top note of roll piano clusters 113-135 s whose loudest note is >= 88', why: 'The piano\'s più mosso transition: only its accented notes, so the attacks follow its stresses, not every run note.' },
  clusters(inWin(roll, 113, 135, (n) => n.f === 'pno')).filter((c) => c.vmax >= 88).map((c) => c.top));
add('tutti-chords', { name: 'Transition tutti chords', section: 'T', from: 134.5, to: 142, rule: 'roll clusters 134.5-142 s with >= 3 notes and loudest >= 88; of each, the lowest and highest note', why: 'The orchestra\'s ff close of the first-theme group (137.1, 140.5 s), then silence: a door slamming before the second theme.' },
  outer(clusters(inWin(roll, 134.5, 142)).filter((c) => c.ns.length >= 3 && c.vmax >= 88)));
add('bridge-winds', { name: 'Bridge to theme 2 (clarinet/viola)', section: 'Bridge', from: 141.5, to: 151.4, rule: 'top note of each non-piano roll cluster 141.5-151.4 s, minDur 0.3', why: 'The quiet woodwind/viola bridge in the near-silence before the second theme; few, slow attacks.' },
  skyline(roll, 141.5, 151.4, (n) => n.f !== 'pno', 0.3));

// --- Theme 2 (exposition B, B2) and its return (B', horn) ---
const ALL = () => true;
add('t2-head-b', { name: 'Theme 2 head, B (piano solo, Eb major)', section: 'B', from: 151.4, to: 159.5, pair: 't2-head', rule: 'skyline of all roll notes 151.4-159.5 s at midi >= 60, minDur 0.2', why: 'The second theme in the piano alone: Bb-Eb-F-G-Ab-G-F-Eb-D-Eb-C-D-B, 13 notes. The same 12 intervals as the horn\'s t2-head-b3 (13 notes); t2-head-b2 (13) differs only in its upbeat, a fifth instead of a fourth.' },
  skyline(roll, 151.4, 159.5, (n) => n.m >= 60, 0.2));
add('t2-tail-b', { name: 'Theme 2 tail, B (piano)', section: 'B', from: 159.5, to: 179.2, pair: 't2-tail', rule: 'skyline of all roll notes 159.5-179.2 s at midi >= 60, minDur 0.3', why: 'The second phrase of theme 2 (A4-B4-Bb4, Ab4-Bb4-C5-D5 ...), rising into the second statement.' },
  skyline(roll, 159.5, 179.2, (n) => n.m >= 60, 0.3));
add('t2-head-b2', { name: 'Theme 2 head, B2 (piano, second statement)', section: 'B2', from: 179.2, to: 187, pair: 't2-head', rule: 'skyline of all roll notes 179.2-187 s at midi >= 60, minDur 0.2', why: 'The theme again, same pitches (Ab4/Eb5 start), now fuller: the first recurrence of t2-head-b.' },
  skyline(roll, 179.2, 187, (n) => n.m >= 60, 0.2));

add('t2-climax-line', { name: 'Theme 2 climax, piano top line', section: 'B-climax', from: 222, to: 244, rule: 'skyline of roll piano notes 222-244 s at midi >= 60, minDur 0.3, then only those of velocity >= 84', why: 'The passionate climax of the second-theme group: its loud melody notes (G6 v114 at 231.2 s is the exposition\'s loudest note).' },
  skyline(roll, 222, 244, (n) => n.f === 'pno' && n.m >= 60, 0.3).filter((n) => n.v >= 84));
add('t2-climax-chords', { name: 'Theme 2 climax chords', section: 'B-climax', from: 244, to: 253.5, rule: 'roll clusters 244-253.5 s with >= 3 notes and loudest >= 90, whole chord', why: 'The ff chords that end the climax before the codetta (vel 90-105).' },
  whole(clusters(inWin(roll, 244, 253.5)).filter((c) => c.ns.length >= 3 && c.vmax >= 90)));
add('codetta-clarinet', { name: 'Codetta clarinet', section: 'Codetta', from: 253.5, to: 276, rule: 'skyline of wind-family roll notes 253.5-276 s, minDur 0.2', why: 'The clarinet\'s answers over the quiet piano after the climax; sparse, soft, a voice apart.' },
  skyline(roll, 253.5, 276, (n) => n.f === 'wind', 0.2));
add('filigree-high', { name: 'High piano filigree (exposition close)', section: 'Codetta', from: 276, to: 298, rule: 'skyline of roll piano notes 276-298 s at midi >= 86, minDur 0.12', why: 'The piano\'s highest register of the movement (up to G7, midi 103, at 286 s), pianissimo: points of light.' },
  skyline(roll, 276, 298, (n) => n.f === 'pno' && n.m >= 86, 0.12));

// --- Development ---

add('t1-dev-frag', { name: 'Theme 1 fragment in the development (strings)', section: 'D2', from: 321.5, to: 342, pair: 't1-cell', rule: 'skyline of string-family roll notes 321.5-342 s at midi >= 48, minDur 0.25', why: 'The orchestra alone, quiet, turning the first theme\'s falling cell (C-Bb-Ab-Bb-G) over and over in the low strings: theme 1 remembered in the dark.' },
  skyline(roll, 321.5, 342, (n) => STR(n) && n.m >= 48, 0.25));
add('agitato-accents', { name: 'Agitato accents (development build)', section: 'D3', from: 342, to: 388, rule: 'top note of roll piano clusters 342-388 s whose loudest note is >= 100', why: 'The mounting agitato: only its hardest strokes, sparse enough to snap.' },
  clusters(inWin(roll, 342, 388, (n) => n.f === 'pno')).filter((c) => c.vmax >= 100).map((c) => c.top));


// --- Climax and recapitulation ---
add('climax-chords', { name: 'Climax chord storm', section: 'Climax', from: 388, to: 421.5, rule: 'roll clusters 388-421.5 s with >= 4 notes and loudest >= 110; of each, the lowest and highest note', why: 'The development\'s climax: the piano hammering full-keyboard chords, fff (the movement\'s loudest stretch, 398-405 s).' },
  outer(clusters(inWin(roll, 388, 421.5)).filter((c) => c.ns.length >= 4 && c.vmax >= 110)));
add('climax-trill', { name: 'Climax trill', section: 'Climax', from: 416.9, to: 418.8, source: 'pack', rule: 'pack notes F#5/G5 (78/79) in 416.9-418.8 s', why: 'The one long trill of the movement (F#5-G5) at the top of the climax, right before the march.' },
  inWin(packNotes, 416.9, 418.8, (n) => n.m === 78 || n.m === 79));
add('t1-head-a3', { name: 'Theme 1 head, A\'\' (recap, strings ff)', section: 'A\'\'', from: 423.8, to: 433.8, pair: 't1-head', rule: 'skyline of string-family roll notes 423.8-433.8 s at midi >= 55, minDur 0.15', why: 'The first theme returns an octave higher, ff, under the piano\'s march chords: D-C-Bb-Ab-Bb-G, C-D-Eb-D-Eb-D-C-Bb-Ab-G-F. Same shape as t1-head-a.' },
  skyline(roll, 423.8, 433.8, (n) => STR(n) && n.m >= 55));
add('t1-answer-a3', { name: 'Theme 1 answer, A\'\' (recap, strings)', section: 'A\'\'', from: 434.05, to: 445.3, pair: 't1-answer', rule: 'skyline of string-family roll notes 434.05-445.3 s, minDur 0.15', why: 'The answering phrase in the recap, up to Ab5 at 440.8 s and down to C5: same shape as t1-answer-a.' },
  skyline(roll, 434.05, 445.3, STR));
add('march-chords', { name: 'March chords (recap)', section: 'A\'\'', from: 421.5, to: 446, rule: 'roll piano clusters 421.5-446 s with >= 4 notes and loudest >= 107; of each, the lowest and highest note', why: 'The piano\'s march (alla marcia) chords against the returning theme: dotted, regular, heavy.' },
  outer(clusters(inWin(roll, 421.5, 446, (n) => n.f === 'pno')).filter((c) => c.ns.length >= 4 && c.vmax >= 107)));
add('march-bass', { name: 'March bass (recap)', section: 'A\'\'', from: 421.5, to: 446, source: 'pack', rule: 'pack notes midi <= 48 in 421.5-446 s, the lowest of each cluster, velocity >= 70', why: 'The bass octaves that walk under the march.' },
  clusters(inWin(packNotes, 421.5, 446, (n) => n.m <= 48 && n.v >= 70)).map((c) => c.low));
add('t1-rise-a3', { name: 'Theme 1 continuation rising, A\'\' (recap, piano)', section: 'A\'\' cont.', from: 448, to: 476, pair: 't1-rise', rule: 'skyline of roll piano notes 448-476 s at midi >= 62, minDur 0.3', why: 'After the march the piano takes the rising continuation (F4-G4-Ab4 ... to D6 at 475 s), as the strings did in t1-rise-a2.' },
  skyline(roll, 448, 476, (n) => n.f === 'pno' && n.m >= 62, 0.3));
add('descent-bass', { name: 'Descent into the horn solo (bass)', section: 'Dissolve', from: 492, to: 521.5, source: 'pack', rule: 'pack notes midi <= 38 in 492-521.5 s, the lowest of each cluster', why: 'The register sinks (pitch centroid 62 to 42) and thins: the bass steps that lead down to the horn.' },
  clusters(inWin(packNotes, 492, 521.5, (n) => n.m <= 38)).map((c) => c.low));
add('t2-head-b3', { name: 'Theme 2 head, B\' (horn, Ab major)', section: 'B\'', from: 522, to: 536.2, pair: 't2-head', rule: 'skyline of wind-family roll notes 522-536.2 s, minDur 0.3', why: 'The second theme returns in the horn, a fifth lower (Eb-Ab-Bb-C-Db-C-Bb-Ab-G-Ab-F-G-E): the same intervals as t2-head-b, pianissimo.' },
  skyline(roll, 522, 536.2, (n) => n.f === 'wind', 0.3));
add('t2-tail-b3', { name: 'Theme 2 tail, B\' (horn/bassoon)', section: 'B\'', from: 536.2, to: 556, pair: 't2-tail', rule: 'skyline of non-piano roll notes 536.2-556 s, minDur 0.3', why: 'The horn\'s continuation and the strings\' entry at 550.9 s, the quietest part of the movement.' },
  skyline(roll, 536.2, 556, (n) => n.f !== 'pno', 0.3));
add('t2-echo-b4', { name: 'Theme 2 echoes, strings and oboe', section: 'B\'\'', from: 556, to: 575, pair: 't2-tail', rule: 'skyline of all roll notes 556-575 s, minDur 0.35', why: 'Clarinet, violins, oboe and piano pass the theme-2 fragments around (C4-Eb4-F4-D4-Eb4, G4-Ab4-F#4-G4).' },
  skyline(roll, 556, 575, ALL, 0.35));
add('meno-high', { name: 'Meno mosso: the high piano', section: 'Meno mosso', from: 575, to: 614, rule: 'skyline of roll piano notes 575-614 s at midi >= 79, minDur 0.3', why: 'The dreamy high piano before the coda: slow, soft points from G5 up to Ab6.' },
  skyline(roll, 575, 614, (n) => n.f === 'pno' && n.m >= 79, 0.3));

// --- Coda ---
add('coda-sweep', { name: 'Coda sweep (C to C7)', section: 'Coda I', from: 615.9, to: 618.5, source: 'pack', rule: 'pack notes 615.9-618.5 s, top of each cluster', why: 'After the pause at 614 s: a low C1 then a C-major arpeggio sweeping six octaves to C7. One gesture, about a dozen attacks.' },
  clusters(inWin(packNotes, 615.9, 618.5)).map((c) => c.top));
add('coda-run', { name: 'Coda rising run and peak', section: 'Coda I', from: 643.5, to: 650, rule: 'skyline of roll piano notes 643.5-650 s at midi >= 60, minDur 0.12', why: 'The C minor scale rising Eb4-G4-B4-C5-D5-Eb5-F5-G5-B5 into the coda\'s first peak (646-649 s).' },
  skyline(roll, 643.5, 650, (n) => n.f === 'pno' && n.m >= 60, 0.12));
add('coda-build', { name: 'Coda build accents', section: 'Coda II', from: 680, to: 692.2, rule: 'top note of roll piano clusters 680-692.2 s whose loudest note is >= 90', why: 'The last crescendo: its strongest strokes, getting denser toward the end.' },
  clusters(inWin(roll, 680, 692.2, (n) => n.f === 'pno')).filter((c) => c.vmax >= 90).map((c) => c.top));
add('final-run', { name: 'Final rising scale (strings)', section: 'Coda II', from: 692.2, to: 694.7, rule: 'skyline of string-family roll notes 692.2-694.7 s, minDur 0', why: 'The orchestra\'s scale A4-B4-C5-D5-Eb5-E5-F5 ... G5 that launches the last chords.' },
  skyline(roll, 692.2, 694.7, STR, 0));
add('final-chords', { name: 'Final chords', section: 'Coda II', from: 694.6, to: 697, source: 'pack', rule: 'pack clusters 694.6-697 s, whole chord', why: 'The last four chords: C1 to C7 ff at 694.77, then 695.36, 695.67, 695.96. The notes end here; the rest to 706 s is decay.' },
  inWin(packNotes, 694.6, 697));


// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (n[1] < n[0] || n[2] < 0 || n[2] > 127 || n[3] < 0 || n[3] > 127) throw new Error(`${s.id} bad note ${n}`);
  if (s.notes[0][0] < s.from || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside from/to`);
}
const out = { song: 'rach-concerto-2', made: 'gen-picks.mjs', noteSource: 'picker roll: YourMT3 rows with pack velocity (else loudness-derived); source "pack" sets use pack.notes', sets: sets.map(({ attacks, ...s }) => ({ id: s.id, name: s.name, why: s.why, rule: s.rule, section: s.section, pair: s.pair, source: s.source, from: s.from, to: s.to, attacks, notes: s.notes })) };
const dir = join(W, 'docs/compositions/rach-concerto-2');
mkdirSync(dir, { recursive: true });
// one note per line, as canonicalShow writes them
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(dir, 'picks.json'), text + '\n');
for (const s of sets) console.log(`${s.id.padEnd(18)} ${String(s.attacks).padStart(3)} att ${String(s.notes.length).padStart(3)} notes ${s.from}-${s.to} ${s.source} | ${s.notes.slice(0, 14).map((n) => nm(n[2])).join(' ')}`);
console.log(sets.length, 'sets');
