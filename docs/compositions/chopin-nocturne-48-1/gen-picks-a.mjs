// Pick sets for the first-half micro scenes of Chopin's Nocturne Op. 48 No. 1 (songs/chopin-nocturne-48-1), deterministic.
// Run: node docs/compositions/chopin-nocturne-48-1/gen-picks-a.mjs   -> writes picks-a.json next to this file and prints
// every set's notes. ANALYSIS-A.md has the sections; build-shows-a.ts turns these sets into the five shows.
// Note source: the note picker's roll (src/studio/ui/picker-logic.ts pickerNotes): the YourMT3 rows of notes.ymt3.json (all
// labelled "Acoustic Piano", so strands are told apart by register and role, never by instrument), each with the velocity of
// the nearest same-pitched pack note within 80 ms. Where none is near (the picker's guessed 70) the velocity comes from the
// loudness curve instead, v = clamp(25 + 85 * loudness(t), 20, 115), as in rach-concerto-2/gen-picks.mjs.
// One rule for every scene: a note belongs to one strand only. The melody is found first; the pulse and inner sets are what
// is left, so two widgets never fire on the same note.
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
  return { t, e, m, v, k };
}).sort((a, b) => a.t - b.t || a.m - b.m);

// ---- helpers ----
/** Clusters of notes whose onsets lie within `gap` of the cluster's first note (groupChords' 40 ms by default). */
function clusters(ns, gap = 0.04) {
  const out = []; let cur = null;
  for (const n of ns) {
    if (cur && n.t - cur.t < gap) { cur.ns.push(n); if (n.m > cur.top.m) cur.top = n; if (n.m < cur.low.m) cur.low = n; cur.vmax = Math.max(cur.vmax, n.v); }
    else { cur = { t: n.t, ns: [n], top: n, low: n, vmax: n.v }; out.push(cur); }
  }
  return out;
}
const inWin = (a, b, f = () => true) => roll.filter((n) => n.t >= a && n.t < b && f(n));
const at = (t, m) => { const n = roll.find((x) => x.m === m && Math.abs(x.t - t) < 0.03); if (!n) throw new Error(`no ${nm(m)} at ${t}`); return n; };
/** Notes given by hand as [time, midi] pairs, each checked against the roll. */
const hand = (pairs) => pairs.map(([t, m]) => at(t, m));
const outer = (cs) => cs.flatMap((c) => [...new Set([c.low, c.top])]);
const minus = (ns, taken) => { const k = new Set(taken.map((n) => n.k)); return ns.filter((n) => !k.has(n.k)); };
const asTuple = (n) => [r4(n.t), r4(Math.max(n.e, n.t + 0.05)), n.m, Math.max(1, Math.min(127, Math.round(n.v)))];

const sets = [];
function add(id, o, notes) {
  notes = [...new Map(notes.map((n) => [n.k, n])).values()].sort((x, y) => x.t - y.t || x.m - y.m);
  if (!notes.length) throw new Error(`${id}: empty`);
  sets.push({ id, ...o, attacks: clusters(notes).length, notes: notes.map(asTuple) });
  return notes;
}

// ================= a1: the opening (3-14.4 s) =================
// Melody (right hand, top): G5 Ab5 G5, then the rise D5-Eb5-F5-Eb5-D5-Eb5-F5-G5 to the bar line at 13.18.
const a1Head = add('a1-melody-head', { name: 'Opening: the first three melody notes', scene: 'a1', from: 5, to: 10,
  rule: 'G5 5.06, Ab5 7.58, G5 9.55 (the top of each cluster, by hand)',
  why: 'The theme begins with three long notes, G-Ab-G, one per bar: the lone voice before the line moves.' },
hand([[5.06, 79], [7.58, 80], [9.55, 79]]));
const a1Rise = add('a1-melody-rise', { name: 'Opening: the rising line to G5', scene: 'a1', from: 10.7, to: 13.3,
  rule: 'roll notes 10.7-13.3 s at midi >= 74 (D5 and up)',
  why: 'D5-Eb5-F5-Eb5-D5-Eb5-F5-G5: eight notes climbing a fourth, peak G5 at 13.18 s. Short and stepwise, so Ivory keeps its keys huddled.' },
inWin(10.7, 13.3, (n) => n.m >= 74));
const a1Bass = add('a1-bass', { name: 'Opening: bass octaves', scene: 'a1', from: 3.5, to: 14.2,
  rule: 'roll notes 3.5-14.2 s at midi <= 48, clustered by 80 ms, lowest and highest of each',
  why: 'The left hand strikes a low octave on each beat (C2/C3, C2/C3, B1/B2, C2/C3, Ab1/Ab2): the heavy half of the pulse.' },
outer(clusters(inWin(3.5, 14.2, (n) => n.m <= 48), 0.08)));
add('a1-chords', { name: 'Opening: off-beat chords', scene: 'a1', from: 5, to: 14.2,
  rule: 'roll notes 5-14.2 s at midi 49-71, minus the melody sets, whole clusters (80 ms)',
  why: 'The answering chord after each bass octave (G3-Eb4-G4, Ab3-Eb4-Ab4, G3-D4-F4-G4, G3-C4-Eb4-G4, C4-Eb4-Ab4): the light half of the pulse.' },
minus(inWin(5, 14.2, (n) => n.m > 48 && n.m < 72), [...a1Head, ...a1Rise]));

// ================= a2: the theme returns with its turn (23-34 s) =================
const a2Turn = inWin(30.7, 32.4, (n) => n.m >= 74);
add('a2-turn', { name: 'Return: the turn', scene: 'a2', from: 30.7, to: 32.4,
  rule: 'roll notes 30.7-32.4 s at midi >= 74',
  why: 'The ornament the return adds: Eb5-F5-Eb5-F5-Eb5-D5-Eb5-F5-G5 in 1.5 s, the fastest notes of the opening. Four pitches flicking.' },
a2Turn);
const a2Mel = add('a2-melody', { name: 'Return: the melody (long notes)', scene: 'a2', from: 24.5, to: 33,
  rule: 'G5 24.72, Ab5 26.90, G5 28.73, F5 29.91, D5 32.62 (by hand: the skyline would take the chord tops under the held notes)',
  why: 'G5 Ab5 G5 F5, then after the turn D5 (32.62): the theme\'s long notes, one slab each.' },
hand([[24.72, 79], [26.9, 80], [28.73, 79], [29.91, 77], [32.62, 74]]));
add('a2-bass', { name: 'Return: bass octaves', scene: 'a2', from: 23.5, to: 33.6,
  rule: 'roll notes 23.5-33.6 s at midi <= 50, clustered by 80 ms, lowest and highest of each',
  why: 'Eb1/Eb2, Ab1/Ab2, Bb1/Bb2, B1/B2-C2/C3, D2/D3: the bass climbs by steps under the return.' },
outer(clusters(inWin(23.5, 33.6, (n) => n.m <= 50), 0.08)));
add('a2-chords', { name: 'Return: off-beat chords', scene: 'a2', from: 24.5, to: 33.6,
  rule: 'roll notes 24.5-33.6 s at midi 51-69, minus the melody and the turn',
  why: 'The off-beat chords (G3-Bb3-Eb4-G4, F3-C4-Eb4, Bb3-D4-Ab4, A3-Eb4-G4, D4): the inner pulse.' },
minus(inWin(24.5, 33.6, (n) => n.m > 50 && n.m < 70), [...a2Mel, ...a2Turn]));

// ================= a3: the climax of the opening section (101.2-111.4 s) =================
const a3Rise = add('a3-rise', { name: 'Climax: the rise to C6', scene: 'a3', from: 102.1, to: 104.3,
  rule: 'B4 102.14, C5 102.42, D5 102.64, Eb5 102.84, C6 104.21 (by hand)',
  why: 'The line climbs B4-C5-D5-Eb5 and leaps to C6 (v93), the highest note of the first section: five keys, the stomp on C6.' },
hand([[102.14, 71], [102.42, 72], [102.64, 74], [102.84, 75], [104.21, 84]]));
const a3Fall = add('a3-fall', { name: 'Climax: the chromatic fall from B5', scene: 'a3', from: 105.9, to: 107.3,
  rule: 'B5 105.92, Bb5 106.22, A5 106.47, Ab5 106.72, F5 107.00, Ab4 107.26 (by hand)',
  why: 'Straight after the peak the melody slides down B5-Bb5-A5-Ab5 and drops through F5 to Ab4 (v94 at the top): the same keys falling.' },
hand([[105.92, 83], [106.22, 82], [106.47, 81], [106.72, 80], [107.0, 77], [107.26, 68]]));
const a3After = add('a3-after', { name: 'Climax: the melody after the fall', scene: 'a3', from: 107.5, to: 110.9,
  rule: 'roll notes 107.5-110.9 s at midi >= 72, minus the fall',
  why: 'C#5, then C5-Eb5-C#5-C5 turning and climbing E5-Ab5-G5, C5-F5: the line picking itself up for the next wave.' },
minus(inWin(107.5, 110.9, (n) => n.m >= 72), a3Fall));
const a3Bass = add('a3-bass', { name: 'Climax: bass', scene: 'a3', from: 101.2, to: 110.6,
  rule: 'roll clusters (80 ms) 101.2-110.6 s whose lowest note is at midi <= 52: that lowest note',
  why: 'Eb3, Eb2, Eb2, F1, C#3, G1, E3, Ab1: one stroke per beat under the climax.' },
clusters(inWin(101.2, 110.6), 0.08).filter((c) => c.low.m <= 52).map((c) => c.low));
add('a3-chords', { name: 'Climax: the beat chords', scene: 'a3', from: 101.9, to: 110.6,
  rule: 'roll notes 101.9-110.6 s below midi 80 (after the C5-D5 turn), minus the melody sets and the bass',
  why: 'What the left hand and thumbs add on each beat (Ab3-C4, Bb2-G4, Eb3-C4, F2, Ab3-C#4, E4, G2, Bb3-C4, Ab2-F4): the chord under every melody step.' },
minus(inWin(101.9, 110.6, (n) => n.m < 80), [...a3Rise, ...a3Fall, ...a3After, ...a3Bass]));

// ================= a4: the hush into the chorale (117-127.8 s) =================
add('a4-bass', { name: 'Chorale: cadence and roots', scene: 'a4', from: 117.5, to: 127.5,
  rule: 'C1/C2 at 117.60 (the C minor cadence), then the lowest note of each roll cluster 123-127.5 s at midi <= 45',
  why: 'The deep C that ends the first section, a silence, then the chorale\'s roots C2, G1, G2: few, slow, low.' },
[...hand([[117.6, 24], [117.6, 36]]), ...clusters(inWin(123, 127.5, (n) => n.m <= 45), 0.08).map((c) => c.low)]);
add('a4-voice', { name: 'Chorale: the lone voice', scene: 'a4', from: 118.9, to: 127.3,
  rule: 'the link notes Bb3 118.94, A3 120.15, F#3 120.21, Ab3 121.63, F3 121.68, then the chorale\'s top note E4 123.65, D4 126.02, E4 127.16 (by hand)',
  why: 'After the cadence a single quiet voice wanders down (Bb3-A3-F#3-Ab3-F3) and becomes the chorale\'s soprano (E4-D4-E4): the ball of light before the hymn.' },
hand([[118.94, 58], [120.15, 57], [120.21, 54], [121.63, 56], [121.68, 53], [123.65, 64], [126.02, 62], [127.16, 64]]));
add('a4-chorale', { name: 'Chorale: the first chords', scene: 'a4', from: 123.6, to: 127.5,
  rule: 'roll notes 123.6-127.5 s at midi 46-63, the soprano excluded',
  why: 'Poco più lento: the hymn\'s chords, C major (C3-E3-G3-C4), G7 (F3-B3), (F3-B3): soft (v40-50), held, spaced.' },
minus(inWin(123.6, 127.5, (n) => n.m >= 46 && n.m < 64), hand([[123.65, 64], [126.02, 62], [127.16, 64]])));

// ================= a5: the octave storm (216.6-227.8 s) =================
const a5Climb = add('a5-octaves', { name: 'Storm: bass octaves climbing, then trembling', scene: 'a5', from: 217.2, to: 222,
  rule: 'roll notes 217.2-222 s at midi <= 61, clustered by 40 ms, lowest and highest of each',
  why: 'The left hand climbs in octaves A2-Bb2-B2-C3-C#3-D3, then shakes G2/G3-A2/A3 back and forth (220-221.5), then G1/G2 fff at 221.95.' },
outer(clusters(inWin(217.2, 222, (n) => n.m <= 61))));
const a5Chords = add('a5-chords', { name: 'Storm: the hammered chords', scene: 'a5', from: 217.2, to: 225,
  rule: 'roll clusters 217.2-225 s at midi >= 64 with >= 3 notes; of each, lowest and highest',
  why: 'The right hand\'s G4-F5-G5 chords over the climbing bass, the v99 C-E chord at 219.00, then the fff chords G-E-G-E (221.95) to C6 (224.84): the blows.' },
outer(clusters(inWin(217.2, 225, (n) => n.m >= 64)).filter((c) => c.ns.length >= 3)));
add('a5-arpeggio', { name: 'Storm: left-hand arpeggios', scene: 'a5', from: 222.5, to: 225,
  rule: 'roll notes 222.5-225 s at midi <= 67, minus the chord set',
  why: 'Between the fff chords the left hand runs up G3-D4-F4, G3-E4, G3-D4-G4, C3-G3-C4: an inner voice that springs up into each blow.' },
minus(inWin(222.5, 225, (n) => n.m <= 67), a5Chords));
add('a5-descent', { name: 'Storm: the octave melody falling from C7', scene: 'a5', from: 225.4, to: 227.55,
  rule: 'top note of each roll cluster 225.4-227.55 s',
  why: 'The melody in four octaves from C7: C-D-C-G-A-G-E-F-E-C-D-C, falling a step at a time through the top of the keyboard.' },
clusters(inWin(225.4, 227.55)).map((c) => c.top));

// ---- checks and output ----
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const s of sets) {
  if (!slug.test(s.id)) throw new Error(`${s.id} is not a slug`);
  for (let i = 1; i < s.notes.length; i++) if (s.notes[i][0] < s.notes[i - 1][0]) throw new Error(`${s.id} unsorted`);
  if (s.notes[0][0] < s.from || s.notes[s.notes.length - 1][0] >= s.to) throw new Error(`${s.id}: notes outside from/to`);
}
// one strand per note, within a scene
for (const sc of new Set(sets.map((s) => s.scene))) {
  const seen = new Map();
  for (const s of sets.filter((x) => x.scene === sc)) for (const n of s.notes) {
    const key = `${n[0]}|${n[2]}`; if (seen.has(key)) throw new Error(`${key} in ${seen.get(key)} and ${s.id}`); seen.set(key, s.id);
  }
}
const out = { song: 'chopin-nocturne-48-1', made: 'gen-picks-a.mjs', noteSource: 'picker roll: YourMT3 rows with pack velocity (else loudness-derived)',
  sets: sets.map(({ attacks, ...s }) => ({ id: s.id, name: s.name, why: s.why, rule: s.rule, scene: s.scene, from: s.from, to: s.to, attacks, notes: s.notes })) };
const text = JSON.stringify(out, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(join(HERE, 'picks-a.json'), text + '\n');
for (const s of sets) console.log(`${s.id.padEnd(16)} ${String(s.attacks).padStart(3)} att ${String(s.notes.length).padStart(3)} n | ${s.notes.map((n) => `${nm(n[2])}@${n[0].toFixed(2)}/${n[3]}`).join(' ')}`);
