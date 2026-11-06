// Builds shows/romeo-juliet-6-coda-a-milk-and-thorn.json: cycle A "Milk and thorn" on the coda (funeral march, chorale,
// the love theme transfigured, the hammered closing chords).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-6-coda/build-romeo-juliet-6-coda-a-milk-and-thorn.mjs
//
// The cycle's mapping (the same in all six packs): fate / funeral timpani / ff blows -> squares-snap (red); the love theme
// -> Ivory rows; the Friar's chorale and its descendants -> handover (milky slabs); the strings -> crimp; the harp ->
// pluck; the ground -> fields.
//
// The idea of this piece: the cycle's last page, told by the same marks, each one at its end.
//   - The funeral march is ONE squares clip on a single fate set: the timpani's 37 strokes, every one a heavy red square
//     that has just sunk when the next lands (life 1.2, the stroke period is 1.23 s); the procession weakens as the march
//     dies (per-note size falls over the last six strokes). No field: on black.
//   - The broken love theme: five short Ivory rows in small copies, one per broken phrase, each cracked (cracks 5:
//     "broken" is exactly what that knob draws) and each one lower on the screen than the last, until the fifth phrase,
//     a single B3, is one key near the floor. Ivory ages its keys from white to cream, honey and umber before they go:
//     the greying keys of the palette are the widget's own ageing.
//   - The strings under the march are crimp with the friar's CALM knobs: dead-straight hairlines. In the friar the
//     strings frayed into wool with anguish; here the anguish is spent and the lines lie flat.
//   - The breath (46-49.7): black.
//   - The consoling chorale enters ALONE as milky handover slabs on black, exactly as the Friar's chorale opened the
//     cycle (goneBy 2.5, ring 1.3: the friar's knobs). From 63.5 the bass slab joins under it and a dim plum field is born.
//   - SERENDIPITY: the love theme transfigured (101.5-141) is mirrored. Fold returns from the feud, where it was "the two
//     houses, each other's mirror image" in hatred; at the end of the play the houses are reconciled over the lovers'
//     bodies, so the mirror now holds the love theme whole: every Ivory row stands in the left half (a full-size small
//     copy, cover-fitted) and fold (upright and still: turn 0, flip 0) gives it its twin on the right. Two rows of clean
//     keys (cracks 0) facing each other across a gold seam that is stitched by each love note. The harp is pluck in the
//     same half, so its threads are mirrored into a lyre. The field warms from plum toward rose with the crescendo.
//   - The timpani roll before the end (140.4-142.9, from the audio's onsets) is the same squares clip: tiny squares that
//     grow stroke by stroke while the love keys age out and the field drains.
//   - The hammered closing chords: fate's squares at full size (per-note size, shake), on black.
//   - The last blow (158.66): the largest square, sinking for three seconds, and the field floods oxblood for the first
//     time in the whole cycle, holding the last chord; every clip is cut dead at 166.0 with the orchestra. Then black.
//
// What the previews showed (three rounds):
//   - FOUND: as the fold fades out (139.9-141.4) the mirrored twin on the right goes first, while the last row on the
//     left ages white -> honey -> umber -> black a moment later: one lover dies, then the other, just before fate's
//     drum roll. Kept exactly so (the fold's end and the last row's ageing are timed to it).
//   - The transfigured field came out oxblood (home follows the loudness by default): home is held (drive '') and set per
//     note, plum to rose, so the oxblood flood is the last chord's alone.
//   - The chorale's slabs were small and grey (p, velocities 20-75): per-note intensity lifts them to milk, size 1.4 (the
//     friar grew its slabs 1.0 -> 1.3 statement by statement; this is the last and largest); the field under it lifted.
//   - 156.1-158.0 went black under a ff (the hammering below ff-blows' strength cut): filled from the audio's onsets.
//   - The crater (Ivory's default 0.35) made grey smudges in small copies and doubled in the mirror: 0.1.
//   - The plucked track's C3-C7 white-key sweep at 36.88 s is not in the audio (no onsets, the 5-11 kHz band falls to
//     -66 dB): an artefact, left out; the coda's only harp is 102-140.
//
// The critic's pass (fresh eyes, one round):
//   - The ff close (143-158) was the loudest 15 s of the piece and the darkest: one thread, sinking to embers between the
//     blows. Now MILK AND THORN AT LAST: the strings' seven-note B-major tutti chords (one per wave of hammering) are a
//     handover stair of milky slabs under fate's red squares, and the oxblood field seeps in under them chord by chord, so
//     the flood at the last blow is an arrival, not a switch.
//   - The run-up (155.65-158.6) is the cellos' transcribed B2s and the strings' climbing octave pairs, not audio onsets.
//   - The chorale's field is plum (home -0.8, chords 0: the teal drift is gone) and holds through the long rests (dyn 0.3);
//     its slabs grow with the phrases (per-note size 1.3 -> 2 at the swell -> 1.5).
//   - The transfigured rows and harp are stretched into the left half instead of cover-cropped: every key is whole.
//   - The roll's audio onsets (140.4-142.9) were checked: every one has a low-band rise (+1 to +8 dB, 20-120 Hz) inside a
//     steady crescendo of the low band, so they are strokes of the roll, not fake attacks. Kept.
//
// Plan (pack seconds):
//   0-1.7      black
//   1.7-47.4   squares (timpani, 37) | Ivory rows 7.85, 15.19, 22.62, 31.18, 41.01 (small, cracked, sinking) | crimp calm
//              on the string harmony under the theme
//   47.4-49.7  the breath: black
//   49.4-63.5  handover alone on the chorale's top voice (a deliberate spare entrance, the frame of the cycle)
//   63.5-102.4 handover top + handover bass; the plum field born under it, swelling with the chorale's swell (73-83)
//   101.5-141  field warming (per-note home), Ivory 5 transfigured rows (left half, cover), pluck on the harp (left half),
//              fold over everything (turn 0, flip 0, seam .3) on the love notes
//   140.4-142.9 the roll: squares growing from tiny; the last row ages; the field drains to black
//   142.9-158  squares at full size on the ff blows, on black
//   158.66-166 the last blow: the giant square + the oxblood field, hard cut at 166.0
//   166-180.1  black
//
// Weight table (rough clip intensity; s squares, i Ivory, c crimp, h handover, b handover bass, f field, p pluck, F fold):
//   0-30 s1 i1 c.8 | 30-47 s1-.5 i1 c.8 | 47-63 h1 | 63-90 h1 b1 f.3-.55 | 90-102 h1 b1 f.4 | 102-130 f.45-.9 i1 p1 F1 |
//   130-141 f.7-.4 i1 p.8 F1 | 141-143 s(roll) f->0 | 143-158 s1 | 158.7-166 s(last) f1 | 166-180 black
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-6-coda-a-milk-and-thorn', SONG = 'romeo-juliet-6-coda';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const sortN = (ns) => ns.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const dedupe = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
  return out;
};
const attacks = (ns) => {
  const out = [];
  for (const n of sortN([...ns])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
const tracks = (names, a, b) => names.flatMap((k) => within(pack.tracks[k].notes, a, b).map((n) => [n[0], n[1], n[2], n[3]]));
const STRINGS = ['violin', 'viola', 'cello', 'strings'];

// ---------- fate: ONE squares clip, one set, per-note size / life / shake ----------
// squares-snap's size: (110 + max(0, split - m) * 9) * (0.55 + 0.45 v / 110) * size. With split 72 (the clip's knob, so
// every register of the closing chords makes a slab) a note's `size` is chosen to land a square of `px` pixels.
const SPLIT = 72;
const sizeFor = (m, v, px) => r3(clamp(px / ((110 + Math.max(0, SPLIT - m) * 9) * (0.55 + 0.45 * Math.min(127, v) / 110)), 0.3, 2));
const timpani = set('funeral-timpani');
const march = timpani.map((n, i) => {
  // heavy: 300-430 px by the stroke's loudness; the coda's first blow larger; the last six strokes die away with the march
  let px = 300 + (n[3] - 90) * 4;
  if (i === 0) px *= 1.25;
  const fromEnd = timpani.length - 1 - i;
  if (fromEnd < 6) px *= lerp(0.45, 1, fromEnd / 6);
  return withValues(n, { size: sizeFor(n[2], n[3], px), life: 1.2, shake: 0, ...(i === 0 ? { intensity: 1.3 } : {}) });
});
// the roll before the end, from the audio's onsets (strength rising 0.08 -> 0.8): B2, velocity from the level after
const roll = ev.onsets.filter((o) => o[0] >= 140.4 && o[0] < 142.9).map((o) => {
  const v = Math.round(clamp(20 + 2.4 * (o[2] + 60), 15, 122)), k = (o[0] - 140.4) / 2.5;
  return withValues([r3(o[0]), r3(o[0] + 0.15), 47, v], { size: sizeFor(47, v, lerp(40, 260, k * k)), life: 0.3, shake: 0 });
});
// the hammered closing chords: full size, by the blow's register and loudness; the last blow alone, the largest
const LAST = 158.66;
const blows = set('ff-blows').filter((n) => n[0] < LAST - 0.03).map((n) => {
  const px = n[2] < 48 ? 640 : n[2] < 72 ? 520 : 420;
  return withValues(n, { size: sizeFor(n[2], n[3], px), life: 0.5, shake: 1.5 });
});
const lastBlow = set('ff-blows').filter((n) => Math.abs(n[0] - LAST) < 0.03 && n[2] < 48)
  .map((n) => withValues(n, { size: sizeFor(n[2], n[3], 900), life: 3, shake: 2, intensity: 1.6 }));
// the run-up into the last chord (155.65-158.6): the cellos' hammered B2s (155.65-157.63) and then the strings' octave
// pairs climbing into the last chord (157.70-158.54). Critic: these are TRANSCRIBED notes (the composer had filled
// 156.1-158.0 from audio onsets); the cellos come at 0.1 s, so their squares are smaller and sink faster.
const cellos = tracks(['cello'], 155.6, 157.7).map((n) => withValues(n, { size: sizeFor(n[2], n[3], 300), life: 0.35, shake: 0.6 }));
const octPairs = attacks(tracks(['strings'], 157.65, LAST - 0.03)).map((a) => a.reduce((b, n) => (n[2] < b[2] ? n : b)))
  .map((n, i, all) => withValues(n, { size: sizeFor(n[2], n[3], lerp(380, 560, i / (all.length - 1))), life: 0.45, shake: 1.2 }));
const runUp = [...cellos, ...octPairs];
const fate = sortN(dedupe([...march, ...roll, ...blows, ...runUp, ...lastBlow]));

// ---------- the broken love theme: five rows, one per phrase (own sets, so no row hears the next) ----------
const broken = set('broken-love');
const BROKEN_STARTS = [7.85, 15.19, 22.62, 31.18, 41.01];
const brokenRows = BROKEN_STARTS.map((a, i) => within(broken, a - 0.05, (BROKEN_STARTS[i + 1] ?? 60) - 0.05));
// the fifth phrase is one lone B3: a key of one note stands at a fifth of the height, so it is played stronger (bigger, brighter)
brokenRows[4] = brokenRows[4].map((n) => withValues(n, { intensity: 1.6 }));

// ---------- the love theme transfigured: five rows, top note per attack, the low octave doublings dropped ----------
const love = within(set('love-theme'), 100, 142);
const T_STARTS = [102.41, 113.17, 119.2, 125.96, 133.42];
const topOnly = (ns) => attacks(ns).map((a) => a.reduce((b, n) => (n[2] > b[2] ? n : b)));
const loveRows = T_STARTS.map((a, i) => topOnly(within(love, a - 0.05, (T_STARTS[i + 1] ?? 142) - 0.05)));

// ---------- strings under the march: the harmony the theme floats on (string tracks, minus the theme's own notes) ----------
const isTheme = (n) => broken.some((b) => Math.abs(b[0] - n[0]) < 0.06 && b[2] === n[2]);
const marchStrings = dedupe(tracks(STRINGS, 7, 46).filter((n) => !isTheme(n) && n[1] - n[0] >= 0.25));

// ---------- the chorale: top voice (alone first), then the chord's lowest note as the bass slab ----------
// The chorale is p (-44 dB) and its roll velocities 20-75: at those the slabs come out small and grey. Each note's
// intensity lifts it to about velocity 115, so the slabs are the cycle's milk white and as large as the friar's.
// Critic: the slabs also GROW with the chorale's phrases (per-note size): modest at the lone entrance, swelling to the
// largest with the swell at 76-81, settling after; the bass slab a step smaller than the voice it carries.
const choraleSize = (t) => t < 63.5 ? 1.3 : t < 76 ? lerp(1.4, 1.7, (t - 63.5) / 12.5) : t < 81.5 ? 2 : t < 90 ? 1.7 : 1.5;
const milkUp = (ns, k = 1) => ns.map((n) => withValues(n, { intensity: r3(clamp(115 / n[3], 1, 2)), size: r3(choraleSize(n[0]) * k) }));
const chorale = milkUp(within(set('coda-chorale'), 49, 103));
const choraleBass = milkUp(attacks(within(set('coda-chorale-chords'), 63.5, 103)).map((a) => a.reduce((b, n) => (n[2] < b[2] ? n : b)))
  .filter((n) => n[2] < 60), 0.8);

// ---------- Critic: MILK AND THORN AT LAST. The closing tutti's B-major chords (strings, seven notes: B2 B3 D#4 F#4 B4
// D#5 B5) arrive every two seconds, at the crest of each wave of hammering. They take the chorale's milk: handover, one
// slab per note, a rising stair of milky slabs struck bone-hot that shrinks to nothing as the next chord comes, with
// fate's red squares striking over it. The two marks of the cycle, the friar's consolation and fate, share the screen
// for the first time; the major key is the consolation. One attack per chord (the double strokes at 153.6-153.8 and
// 155.35-155.52 are one chord each: the loudest of the cluster), so a slab never flashes. The last chord is fate's alone.
const tuttiAll = attacks(tracks(['strings'], 144.5, 155.7));
const tutti = [];
for (const a of tuttiAll) {
  const prev = tutti[tutti.length - 1];
  if (prev && a[0][0] - prev[0][0] < 0.35) { if (a[0][3] >= prev[0][3]) tutti[tutti.length - 1] = a; } else tutti.push(a);
}
const tuttiNotes = tutti.flatMap((a) => a.filter((n, i) => a.findIndex((o) => o[2] === n[2]) === i).map((n) => withValues([r3(a[0][0]), r3(Math.max(n[1], a[0][0] + 1.2)), n[2], n[3]],
  { intensity: r3(clamp(118 / n[3], 1, 2)) })));

// ---------- the ground: the chorale's chords and the transfiguration's bass; per-note home warms with the love ----------
const groundNotes = sortN(dedupe([...within(set('coda-chorale-chords'), 63.5, 101.5), ...within(set('bass-line'), 101.5, 140.4)]));
const ground = groundNotes.map((n) => {
  const t = n[0];
  // Critic: the chorale's ground is plum (-0.8), not the navy -0.95 that, with chords 0.25, drifted teal at 76 s; and it
  // holds (dyn 0.3) through the chorale's long rests (91-101), which had gone almost black
  const home = t < 101.5 ? -0.8 : t < 128 ? lerp(-0.8, -0.45, (t - 101.5) / 26.5) : lerp(-0.45, -0.75, (t - 128) / 12);
  return withValues(n, { home: r3(home), ...(t < 101.5 ? { dyn: 0.3 } : {}) });
});
// Critic: THE BLOOD SEEPS IN. The oxblood field no longer switches on at the last blow: it is born dimly under the first
// tutti chord (144.97) and darkens chord by chord (home from a dim rose toward oxblood), so the flood at 158.66 is an
// arrival. The last chord itself: from its last blow to the cut-off, a held colour (dyn 0.2).
const blood = [
  ...tutti.map((a, i) => { const n = a.reduce((b, x) => (x[2] < b[2] ? x : b));
    return withValues([r3(n[0]), r3(n[0] + 1.5), n[2], n[3]], { home: r3(lerp(-0.3, 0.1, i / (tutti.length - 1))), dyn: 0.45 }); }),
  withValues([LAST, 166.0, 47, 120], { home: 0.15, dyn: 0.2 }),
];

// ---------- the harp under the transfigured love theme ----------
const harp = set('harp');

const picks = {
  'fate': { notes: fate },
  ...Object.fromEntries(brokenRows.map((r, i) => [`broken-${i + 1}`, { notes: r }])),
  ...Object.fromEntries(loveRows.map((r, i) => [`love-${i + 1}`, { notes: r }])),
  'love-seam': { notes: sortN(loveRows.flat().filter((n) => n[0] > 102.6).map((n) => [...n])) },
  'march-strings': { notes: marchStrings },
  'chorale': { notes: chorale },
  'chorale-bass': { notes: choraleBass },
  'ground': { notes: ground },
  'harp': { notes: harp },
  'tutti': { notes: tuttiNotes },
  'blood': { notes: blood },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const CUT = 166.0;
const lastOf = (ns) => Math.max(...ns.map((n) => n[0]));
// Ivory lives until 2 s after its last note plus 1.5 s of ageing. crater 0.1 on every row: in a small copy, and doubled by
// the mirror, the default dent (0.35) reads as a grey smudge beside the keys
const ivoryEnd = (ns) => r3(lastOf(ns) + 3.6);
// the broken rows: small copies, each lower than the last, the last one small near the floor
const BROKEN_AT = [[0.3, 0.3, 0.5], [0.7, 0.38, 0.5], [0.3, 0.52, 0.5], [0.7, 0.62, 0.5], [0.5, 0.68, 0.62]];
const LEFT_HALF = { mode: 'window', shape: 'rect', x: 0.25, y: 0.5, w: 0.5, h: 1, feather: 0.03, fit: 'stretch' };   // critic: 'cover' cut the outer keys off

const clips = [
  // fate: the whole coda's squares, one clip (so the procession's picture never resets), cut dead with the orchestra
  { id: 'c1', start: 1.4, end: CUT, track: 8, fade: 0, widget: 'squares-snap', listen: 'picks:fate',
    knobs: { size: 1, life: 1.2, blur: 0.6, shake: 0, split: SPLIT } },
  // the strings under the march: straight hairlines (the friar's calm crimp)
  { id: 'c2', start: 7.5, end: 47.4, track: 1, fade: 1.5, widget: 'crimp', listen: 'picks:march-strings',
    knobs: { slack: 1, fibres: 5, reach: 1.2, stays: 3 } },
  // the broken love theme: cracked rows in small copies, sinking down the screen
  ...brokenRows.map((r, i) => {
    const [x, y, w] = BROKEN_AT[i];
    return { id: `c3${'abcde'[i]}`, start: r3(r[0][0] - 0.2), end: ivoryEnd(r), track: 3 + (i % 2), fade: 0.15, widget: 'ivory',
      listen: `picks:broken-${i + 1}`, knobs: { cracks: 5, crater: 0.1 },
      region: { mode: 'window', shape: 'rect', x, y, w, h: w, feather: 0.06, fit: 'contain' } };
  }),
  // the chorale: alone, then with its bass (the friar's knobs)
  { id: 'c4', start: 49.4, end: 102.45, track: 6, fade: 0.4, widget: 'handover', listen: 'picks:chorale', knobs: { goneBy: 2.5, ring: 1.3, size: 1.4 } },
  { id: 'c5', start: 63.5, end: 102.45, track: 5, fade: 0.4, widget: 'handover', listen: 'picks:chorale-bass', knobs: { goneBy: 2.5, ring: 1.3 } },
  // the ground: one plum field born under the chorale's bass, warming with the transfigured love, drained by the roll
  { id: 'c6', start: 63.3, end: 142.9, track: 0, fade: 0, widget: 'fields', listen: 'picks:ground',
    // home held (drive ''): the colour is set per note, plum to rose, so oxblood is kept for the last chord alone
    knobs: { home: { base: -0.8, drive: '', depth: 0 }, chords: 0, back: 0.75, n: 1, dyn: 0.6 },
    intensity: iv([[63.3, 0], [66.5, 0.6, 'ease'], [73, 0.62], [79, 0.88, 'ease'], [84, 0.7], [97, 0.68], [102.4, 0.55],
      [114, 0.7], [126, 0.9], [131, 0.75], [138.6, 0.55], [140.4, 0.4], [142.7, 0]]) },
  // the transfigured love: full-size clean rows in the left half (the fold gives each its twin)
  ...loveRows.map((r, i) => ({
    id: `c7${'abcde'[i]}`, start: r3(r[0][0] - 0.2), end: i < 4 ? r3(Math.min(ivoryEnd(r), T_STARTS[i + 1] + 0.6)) : ivoryEnd(r),
    track: 3 + (i % 2), fade: 0.3, widget: 'ivory', listen: `picks:love-${i + 1}`, knobs: { cracks: 0, crater: 0.1 }, region: LEFT_HALF })),
  // the harp: plucked threads in the same half
  { id: 'c8', start: 102.0, end: 141.2, track: 2, fade: 0.6, widget: 'pluck', listen: 'picks:harp', knobs: { touch: 3 }, region: LEFT_HALF },
  // the mirror: the houses reconciled. Upright and still; the seam stitched by each love note
  { id: 'c9', start: 102.5, end: 141.4, track: 9, fade: 1.5, widget: 'fold', listen: 'picks:love-seam',
    knobs: { turn: 0, flip: 0, seam: 0.3 } },
  // the blood: born dim under the first tutti chord, darkening chord by chord, flooding with the last blow; cut dead at
  // 166.0. dyn 0.2 on the last chord: a still painting, so the held chord is a held colour that is still lit when the
  // cut comes (at the default the note's glow had faded by 165.7 s and the cut read as a fade-out)
  { id: 'c10', start: 144.8, end: CUT, track: 0, fade: 0, widget: 'fields', listen: 'picks:blood',
    knobs: { home: { base: 0.15, drive: '', depth: 0 }, chords: 0, back: 0.5, n: 1, dyn: 0.2 },
    intensity: iv([[144.8, 0.18], [149, 0.26], [153.5, 0.34], [158.5, 0.38, 'hold'], [158.62, 1]]) },
  // milk and thorn at last: the tutti's B-major chords as a stair of milky slabs under fate's squares (the friar's knobs;
  // goneBy 2.5, so a chord's stair has shrunk away before the run-up)
  { id: 'c11', start: 144.8, end: 158.0, track: 7, fade: 0, widget: 'handover', listen: 'picks:tutti',
    knobs: { goneBy: 2.5, ring: 1.3, size: 0.9 } },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 6. Coda · A "Milk and thorn": one Snap squares procession on the funeral timpani, the closing hammer blows at full size; the broken love theme as cracked Ivory rows sinking and ageing in small copies over straight Crimp hairlines; the chorale\'s milky Handover slabs alone, as the cycle began, over a plum field; the transfigured love mirrored whole by Fold, clean Ivory rows and Pluck\'s harp; and at the close milk and thorn at last: the tutti B-major chords as a stair of milky Handover slabs under the red blows while the oxblood field seeps in, flooding with the last blow, cut dead',
  composer: { by: 'claude', at: '2026-11-06T21:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
