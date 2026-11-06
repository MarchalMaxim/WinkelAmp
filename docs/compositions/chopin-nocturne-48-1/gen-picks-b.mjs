// Pick sets for the second-half micro scenes of Chopin's Nocturne Op. 48 No. 1 (songs/chopin-nocturne-48-1), deterministic.
// Run: node docs/compositions/chopin-nocturne-48-1/gen-picks-b.mjs   -> writes picks-b.json next to this file and prints
// each set's attacks, attacks a second and first notes (the numbers in ANALYSIS-B.md).
// Note source, as in docs/compositions/rach-concerto-2/gen-picks.mjs: the note picker's roll, the YourMT3 rows of
// notes.ymt3.json, each with the velocity of the nearest same-pitched pack note within 80 ms; where none is near (the
// picker's guessed 70) the velocity comes from the loudness curve, v = clamp(25 + 85 * loudness(t), 20, 115). This is a solo
// piano, so the piano model (pack.notes, bytedance) is the better source for the bass, which YourMT3 fills with guessed
// notes; sets marked source "pack" take pack.notes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const SONG = join(ROOT, 'songs/chopin-nocturne-48-1');
const pack = JSON.parse(readFileSync(join(SONG, 'pack.json'), 'utf8'));
const labels = JSON.parse(readFileSync(join(SONG, 'notes.ymt3.json'), 'utf8')).notes;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const L = pack.loudness, loud = (t) => L.values[Math.min(L.values.length - 1, Math.max(0, Math.round(t / L.hop)))];

// ---- the roll ----
const byPitch = new Map();
for (const n of pack.notes) { const l = byPitch.get(n[2]); if (l) l.push(n); else byPitch.set(n[2], [n]); }
const roll = labels.map(([t, e, m], k) => {
  let v = 70, near = 0.08, guessed = true;
  for (const n of byPitch.get(m) ?? []) { const d = Math.abs(n[0] - t); if (d < near) { near = d; v = n[3]; guessed = false; } }
  if (guessed) v = Math.max(20, Math.min(115, Math.round(25 + 85 * loud(t))));
  return { t, e, m, v, k, guessed };
}).sort((a, b) => a.t - b.t || a.k - b.k);
const packNotes = pack.notes.map(([t, e, m, v], k) => ({ t, e, m, v, k })).sort((a, b) => a.t - b.t || a.k - b.k);

// ---- helpers (as in the concerto's generator) ----
/** 40 ms clusters from the first note (groupChords' rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of ns) { if (cur && n.t - cur.t < 0.04) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; cur.vmax = Math.max(cur.vmax, n.v); } else { cur = { t: n.t, ns: [n], top: n, low: n, vmax: n.v }; out.push(cur); } }
  return out;
}
const inWin = (src, a, b, filter = () => true) => src.filter((n) => n.t >= a && n.t < b && filter(n));
/** Skyline melody: the top of each onset cluster, unless a note more than a tone higher, begun within `hold` s, still
    sounds; notes shorter than minDur dropped; a repeat of the same pitch within 0.15 s merged. */
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
/** Each chord thinned to its lowest and highest note: one attack per chord, fewer notes. */
const outer = (cs) => cs.flatMap((c) => [...new Set([c.low, c.top])]);
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];

const sets = [];
function add(id, o, notes) {
  notes = [...notes].sort((x, y) => x.t - y.t || x.m - y.m);
  const seen = new Set(); notes = notes.filter((n) => { const key = `${n.t}|${n.m}`; if (seen.has(key)) return false; seen.add(key); return true; });
  sets.push({ id, ...o, attacks: clusters(notes).length, source: o.source ?? 'roll', notes: notes.map(asTuple) });
}

// ================= the sets, by scene =================
// Melody notes are the loud tops: in the doppio movimento the theme sings at v 70-100 over chords at v 35-65.
// Notes YourMT3 found and the piano model did not (guessed velocity) are left out of the lines: here they are mostly a held
// note split into repeats.
const melody = (a, b, minV = 62, minM = 62) => skyline(roll, a, b, (n) => n.m >= minM && !n.guessed, 0.15).filter((n) => n.v >= minV);
/** The bass on its beats: the lowest note of each pack cluster with nothing lower struck in the 0.8 s before or 0.3 s after
    (the left hand's triplets above a bass note are left out). */
const lowline = (a, b, maxM, minV) => clusters(inWin(packNotes, a, b, (n) => n.m <= maxM && n.v >= minV)).map((c) => c.low)
  .filter((n) => !inWin(packNotes, n.t - 0.8, n.t + 0.3).some((x) => x.m < n.m));
const melodyTimes = (ms) => new Set(ms.map((n) => n.t));

// --- b1, 239.6-250.2: the doppio movimento enters, sotto voce ---
{
  const A = 239.9, B = 250.2, mel = melody(A, B, 50);
  add('b1-theme', { name: 'Agitato theme (top line)', scene: 'b1', from: A, to: B, rule: 'skyline of roll notes >= D4 the piano model also has, minDur 0.15, velocity >= 50', why: 'The C minor theme back over the throbbing chords: Eb5-G5, C5-Ab5-G5, Eb5-F5-Eb5-Eb5-F5-G5-C5, C5-D5-C5.' }, mel);
  const mt = melodyTimes(mel);
  add('b1-octave', { name: 'Theme, lower octave', scene: 'b1', from: A, to: B, rule: 'for each b1-theme note, the roll note an octave below within 50 ms', why: 'Where the right hand doubles the theme an octave down: the same line one register lower, for a second, sparser layer.' },
    mel.flatMap((n) => inWin(roll, n.t - 0.05, n.t + 0.05, (x) => x.m === n.m - 12).slice(0, 1)));
  // The throb: the repeated chords between bass and tune, one note each (their top, under the tune), every attack.
  add('b1-throb', { name: 'Triplet chord throb', scene: 'b1', from: A, to: B, rule: 'roll clusters with a note in 51..74 that is not a theme note; of each, its highest note in 51..74 below the theme, velocity < 70', why: 'The restless repeated chords of the doppio movimento, as one pulsing strand: what makes the passage agitated.' },
    clusters(inWin(roll, A, B, (n) => n.m >= 51 && n.m <= 74 && !mt.has(n.t) && n.v < 70)).map((c) => c.top));
  add('b1-bass', { name: 'Bass steps', scene: 'b1', from: A, to: B, source: 'pack', rule: 'pack notes midi <= 50 and velocity >= 40, the lowest of each cluster with nothing lower struck 0.8 s before or 0.3 s after', why: 'The bass of the left hand on its beats, under its own triplets.' },
    lowline(A, B, 50, 40));
}

// --- b2, 294.3-304.6: the loudest stretch of the second half, the theme ff in octaves, up to C6 ---
{
  const A = 294.6, B = 304.6, mel = melody(A, B, 66, 64);
  add('b2-theme', { name: 'Theme ff, top of the octaves', scene: 'b2', from: A, to: B, rule: 'skyline of roll notes >= E4 the piano model also has, minDur 0.15, velocity >= 66', why: 'The theme in octaves at full voice: Eb5-F5-Eb5-Eb5-F5-G5, C5 x3, F5-Eb5-F5, B4-C5-D5-C5-D5-Eb5, up to C6 at 303.81 and the hardest note of the half (G5 v104, 304.09) under it.' }, mel);
  // The same line cut into its phrases, one short Ivory row each (the user, 2026-11-06: "make the ivory sequences shorter").
  // Each ends on its own extreme note, where Ivory stomps.
  const PHRASES = [
    ['b2-p1', 294.6, 296.5, 'Eb5-F5-Eb5-Eb5-F5-G5-G5: the theme\'s cell, up to G5'],
    ['b2-p2', 296.9, 299.5, 'C5-C5-C5-F5-Eb5-F5: three knocks and a lift to F5'],
    ['b2-p3', 300.2, 302.25, 'F5-D5-C5-D5-C5-C5: falling back to C5'],
    ['b2-p4', 302.3, 304.0, 'D5-Eb5-G4-C6: the leap to the climax note C6 (303.81)'],
  ];
  for (const [id, a, b, why] of PHRASES) add(id, { name: `Theme ff, phrase ${id.slice(-1)}`, scene: 'b2', from: a, to: b, rule: `b2-theme notes in ${a}-${b} s`, why }, mel.filter((n) => n.t >= a && n.t < b));
  add('b2-chords', { name: 'ff chord blocks', scene: 'b2', from: A, to: B, source: 'pack', rule: 'pack clusters with >= 4 notes and loudest >= 88; of each, the lowest and highest note', why: 'The full chords that carry the climax, struck hardest (pack velocities: the roll guesses ~107 for notes it alone has).' },
    outer(clusters(inWin(packNotes, A, B)).filter((c) => c.ns.length >= 4 && c.vmax >= 88)));
  add('b2-bass', { name: 'Bass octaves ff', scene: 'b2', from: A, to: B, source: 'pack', rule: 'pack notes midi <= 45 and velocity >= 70, the lowest of each cluster with nothing lower struck 0.8 s before or 0.3 s after', why: 'The bass octaves hammered under the climax (Eb, Ab, G, Ab, Eb1).' },
    lowline(A, B, 45, 70));
}

// --- b3, 315.1-327.9: the collapse: bass octaves fall, a broken arpeggio flares up to Ab5, a recitative sinks ---
{
  add('b3-bells', { name: 'Falling bass octaves', scene: 'b3', from: 315.3, to: 327.9, source: 'pack', rule: 'pack notes midi <= 43 with velocity >= 75, the lowest of each cluster', why: 'F#1 (315.54), F#1 (317.72), F1 (318.12), G1 (321.24), G1 (324.22): the bass tolls after the climax breaks off.' },
    clusters(inWin(packNotes, 315.3, 327.9, (n) => n.m <= 43 && n.v >= 75)).map((c) => c.low));
  add('b3-flare', { name: 'Arpeggio flare to Ab5', scene: 'b3', from: 318.4, to: 320.6, rule: 'roll notes >= C#4 in 318.4-320.6 s', why: 'C#4-F4-Ab4-C#5-E5-F5-Ab5: one broken chord flaring upward, peak Ab5 at 320.48.' },
    inWin(roll, 318.4, 320.6, (n) => n.m >= 61));
  add('b3-sink', { name: 'Recitative sinking', scene: 'b3', from: 324.6, to: 327.9, rule: 'skyline of roll notes >= Eb4 in 324.6-327.9 s, minDur 0.15', why: 'Ab4-G4-F#4-F4 ... Eb4: the line sinks by semitones toward the coda.' },
    skyline(roll, 324.6, 327.9, (n) => n.m >= 63, 0.15));
  add('b3-inner', { name: 'Inner repeated chords', scene: 'b3', from: 315.3, to: 327.9, rule: 'roll notes 50..71 that are not in the other b3 sets, of clusters after 316 s', why: 'The middle voices that keep knocking on the same keys (Eb3/Ab3/C3, then D3/F3/Ab3/B3): the pulse that is left.' },
    inWin(roll, 316.2, 327.9, (n) => n.m >= 50 && n.m <= 71 && !(n.t >= 318.4 && n.t < 320.6 && n.m >= 61) && !(n.t >= 324.6 && n.m >= 63 && n.e - n.t >= 0.15)));
}

// --- b4, 336.6-346.6: the last climb, one voice alone from G3 to C6 ---
{
  add('b4-line', { name: 'The last climb (single line)', scene: 'b4', from: 336.9, to: 346.6, rule: 'roll notes >= G3 in 336.9-346.6 s', why: 'One voice, unaccompanied: G3-C4-D4-Eb4-F#4-Ab4-G4-B4-D5-C5-Eb5-F#5-G5-Bb5-Ab5-G5, C6 at 345.79.' },
    inWin(roll, 336.9, 346.6, (n) => n.m >= 55));
  add('b4-bass', { name: 'Low tolls under the climb', scene: 'b4', from: 336, to: 346.6, source: 'pack', rule: 'pack notes midi <= 45 in 336-346.6 s, the lowest of each cluster', why: 'C1 (336.05), Ab2 (342.82), Ab1 (345.79): three low strokes, far apart.' },
    clusters(inWin(packNotes, 336, 346.6, (n) => n.m <= 45)).map((c) => c.low));
  add('b4-turns', { name: 'Leading tones of the climb', scene: 'b4', from: 336.9, to: 346.6, rule: 'the b4-line notes on F#, B and Bb, and the final C6', why: 'The notes that lean on the next one (F#4, B4, F#5, Bb5) and the arrival C6: the climb\'s tension points, sparse.' },
    inWin(roll, 336.9, 346.6, (n) => n.m >= 55 && ([6, 11, 10].includes(n.m % 12) || n.m === 84)));
}

// --- b5, 349.8-360.3: the final bars, three soft C minor chords ---
{
  add('b5-top', { name: 'Final chords, top Eb4', scene: 'b5', from: 350, to: 360, source: 'pack', rule: 'pack notes Eb4 (63) in 350-360 s', why: 'The top of each closing chord is the same Eb4 (351.25, 353.69, 357.62): the minor third, sounding three times.' },
    inWin(packNotes, 350, 360, (n) => n.m === 63));
  add('b5-body', { name: 'Final chords, inner notes', scene: 'b5', from: 350, to: 360, source: 'pack', rule: 'pack notes 50..62 in 350-360 s', why: 'Eb3/G3/C4 inside each closing chord, pianissimo.' },
    inWin(packNotes, 350, 360, (n) => n.m >= 50 && n.m <= 62));
  add('b5-bass', { name: 'Final chords, bass C', scene: 'b5', from: 350, to: 360, source: 'pack', rule: 'pack notes 36..49 in 350-360 s', why: 'C2 and C3 under each closing chord: the tonic, three times.' },
    inWin(packNotes, 350, 360, (n) => n.m >= 36 && n.m <= 49));
}

// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  if (!s.notes.length) throw new Error(`${s.id} has no notes`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  for (const n of s.notes) if (n[1] < n[0] || n[2] < 0 || n[2] > 127 || n[3] < 0 || n[3] > 127) throw new Error(`${s.id} bad note ${n}`);
  if (s.notes[0][0] < s.from || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside from/to`);
}
const out = { song: 'chopin-nocturne-48-1', made: 'gen-picks-b.mjs', noteSource: 'picker roll: YourMT3 rows with pack velocity (else loudness-derived); source "pack" sets use pack.notes', sets: sets.map(({ attacks, ...s }) => ({ id: s.id, name: s.name, why: s.why, rule: s.rule, scene: s.scene, source: s.source, from: s.from, to: s.to, attacks, notes: s.notes })) };
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks-b.json'), text + '\n');
for (const s of sets) {
  const span = s.notes[s.notes.length - 1][0] - s.notes[0][0];
  console.log(`${s.id.padEnd(11)} ${String(s.attacks).padStart(3)} att ${(s.attacks / Math.max(1, span)).toFixed(1).padStart(4)}/s ${String(s.notes.length).padStart(3)} notes ${s.notes[0][0]}-${s.notes[s.notes.length - 1][0]} ${s.source} | ${s.notes.slice(0, 16).map((n) => nm(n[2]) + ':' + n[3]).join(' ')}`);
}
console.log(sets.length, 'sets');
