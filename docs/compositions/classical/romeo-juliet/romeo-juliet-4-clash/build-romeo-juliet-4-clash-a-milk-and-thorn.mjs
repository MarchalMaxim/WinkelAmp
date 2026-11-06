// Builds shows/romeo-juliet-4-clash-a-milk-and-thorn.json: cycle A "Milk and thorn" on the development (the clash).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-4-clash/build-romeo-juliet-4-clash-a-milk-and-thorn.mjs
//
// The cycle's mapping (the same in all six packs):
//   handover     <- the Friar's chorale (horns, clarinet echoes; at the climax the trumpets): milky slabs
//   prickle      <- the feud's syncopated accents: one thorn per accent, from alternate edges
//   interlock    <- the sword clashes (cymbal-bright strokes from the audio)
//   crimp        <- the running strings (violins/violas and cellos runs), wool in the feud, straight when held
//   squares-snap <- fate: the low strokes (timpani, bass sforzandi), small and calm
//   fields       <- the ground: rust in the feud, a cold plum field in the hush, an ember field at the climax
//
// The story of this piece, and the daring bits (each answers the music):
//   1. The Friar comes closer. Every chorale note carries its own slab size: the first horn notes (17.1 s) are small
//      tiles far off (0.55), the hushed horns bigger, the chorale against the feud bigger again, the build's horns
//      larger, and at the climax the trumpets' chorale lands as slabs at the largest size (1.45; at 2 one slab whites out the frame): the hymn the feud
//      could not drown is suddenly the whole sky. The trumpets are not transcribed: their notes are found in the
//      audio (the held pitch class of the trumpets' register, E4-Eb6 chroma, held >= 0.7 s), each starting on the
//      audio onset nearest the pitch change, so every slab lands on a real blow. They climb in sequences
//      (F#-B-C#, B-C#-Eb, Ab, B), as the chorale does in the score.
//   2. Fate is heard before it arrives. The same low strokes that knock under the horns' chorale (G2 at 51.8-56.9,
//      Eb2 at 74.9-80.9) are tiny, calm squares; at the climax they arrive full size.
//   3. The hush (59.7-70.8) is a stillness: the feud is cut where the orchestra drops to pp; on a dim plum field only
//      one bone hairline (the violins' held B5, never fraying) and the horn's lone G4 as one milky slab.
//   4. The hammered F# (122-135.9) is ONE needle: every hammer of the orchestra on the dominant drives the same
//      interlock needle deeper (ratchet), until 130.5; then the breath (131-134.8, the loudness falls 12 dB): the
//      needle withdraws, the field sinks; the last F# blow (134.86) drives the deepest, widest needle of the piece,
//      and the feud's return (136.07) shears the picture with the cycle's sword cut (the casket, as in the feud).
//   5. The recapitulation has no milk: the Friar is gone, only red thorns, needles and wool, on an ember field that
//      cools to plum as the music falls onto A/D (157.5) and hands over to the love music of the next pack.
//
// Weight table (rough clip intensity; f field, c crimp runs, s straight crimp, h handover, p prickle, i interlock,
// q squares, k casket):
//   0-30   f.15-.6 c.6-1 p1 h(small) i(1)          | 22-33 f.35 s1 h c.5 (hushed: spare)
//   30-60  f.5-.8 c1 p1 h q(tiny 51-57) i(1)        | 59.7-70.8 f(plum).3 s1 h   (stillness)
//   60-90  f.3-.7 c.5-1 h q(tiny 75-91) t(time slice 81.5-96.4)  | 90-120 f(ember).8 c.7 h(size 1.45) p1 i1 q1
//   120-150 f1 c.6 i(nail) q k(136.07) p1 i1       | 150-160 f1->.3 c->straight p i q
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-4-clash-a-milk-and-thorn', SONG = 'romeo-juliet-4-clash';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [t0, a] = pts[i - 1], [t1, b] = pts[i];
    return a + (b - a) * (t - t0) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
};
const attacks = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
const top = (a) => a.reduce((b, n) => (n[2] > b[2] ? n : b));
const sortN = (ns) => ns.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const ALL = [...pack.notes, ...Object.values(pack.tracks).flatMap((t) => t.notes)];
const struckAt = (t, w = 0.06) => ALL.filter((n) => Math.abs(n[0] - t) <= w);
const velOf = (dB) => Math.round(clamp(20 + 2.4 * (dB + 60), 15, 122));
const onsetNear = (t, w = 0.25) => ev.onsets.filter((o) => Math.abs(o[0] - t) <= w).sort((a, b) => Math.abs(a[0] - t) - Math.abs(b[0] - t))[0];

// ---------- sections ----------
const HUSH = 59.75, HUSH_END = 70.8, CLIMAX = 97.6, HAMMER = 122.0, BREATH = 130.6, LAST_F = 134.86, RECAP = 136.07, END = 159.9;

// ---------- the Friar's chorale: the horns and the clarinets' echoes (winds-line), then the trumpets from the audio ----------
// Slab size per note: the Friar comes closer with every appearance.
const sizeAt = (t) => (t < 20 ? 0.55 : t < 29 ? 0.7 : t < 50 ? 0.85 : t < 59 ? 1.15 : t < 70 ? 1.0 : 1.4);
// The analyst's friar-chorale notes all; the other wind notes only when held >= 0.6 s (at ~2 notes a second, 0.4 s
// notes made the slabs flash against the feud, the rejected 'handover on a fast line').
const chorale = set('friar-chorale');
const isChorale = (n) => chorale.some((c) => Math.abs(c[0] - n[0]) < 0.02 && c[2] === n[2]);
const winds = within(set('winds-line'), 16.8, 80).filter((n) => isChorale(n) || n[1] - n[0] >= 0.6).map((n) => withValues(n, { size: sizeAt(n[0]) }));
// The trumpets (97.6-122): runs of one dominant pitch class in the trumpets' register (harmonic part, chroma E4-E6,
// median 0.2 s, held >= 0.7 s), from librosa; each note starts on the audio onset nearest its pitch change (<= 0.1 s)
// and lasts to the end of its run. [run start, run end, pitch class]; the E at 109.5 is the strongest blow there
// (2.15), where the full chroma holds E 109-113 s.
const TRUMPET_RUNS = [[99.64, 101.3, 0], [102.26, 102.96, 4], [102.98, 103.67, 2], [105.54, 106.41, 6], [106.42, 107.26, 11],
  [107.27, 108.15, 1], [109.5, 111.45, 4], [111.53, 112.52, 7], [113.10, 114.10, 11], [114.11, 114.92, 1], [114.93, 115.82, 3],
  [116.44, 117.36, 8], [118.36, 119.13, 8], [119.79, 122.0, 11]];
const midiOfPc = (pc) => (pc >= 4 ? 60 + pc : 72 + pc);   // E4..Eb5: the chorale's sounding register, read as one octave
const trumpets = TRUMPET_RUNS.map(([a, b, pc]) => {
  const o = onsetNear(a, 0.25); const t = r3(o ? o[0] : a);
  return withValues([t, r3(Math.max(b, t + 0.5)), midiOfPc(pc), velOf(o ? o[2] : -20)], { size: 1.3, ring: 1.8 });
});
const friar = sortN([...winds, ...trumpets]);

// ---------- the thorns: the feud's accents ----------
// In the feud stretches the analysis' feud-accents (audio onsets with their notes) and the violins' held syncopations,
// one thorn per attack, at least 0.45 s apart (the audio's accent wins). From 96.4 s (the thorns return with the climax)
// to the climax's end, audio onsets at least 0.55 of the strongest within 1.5 s, strength >= 0.28, >= 0.5 s apart, and
// not on a trumpet slab (the thorns fall between the Friar's notes). The hammered F# has none (it is the needle's).
const feudSpan = (t) => (t < 22.1) || (t >= 33.3 && t < 51.3) || (t >= RECAP - 0.1 && t < END);
const FA = attacks(set('feud-accents')).filter((a) => feudSpan(a[0][0])).map((a) => ({ n: top(a), w: 2 }));
const VI = attacks(set('violins')).filter((a) => (a[0][0] >= 2 && a[0][0] < 22.1) || (a[0][0] >= 33.3 && a[0][0] < 51.3)).map((a) => ({ n: top(a), w: 1 }));
const trumpetT = trumpets.map((n) => n[0]);
const O = ev.onsets.filter((o) => o[0] >= 96.4 && o[0] < HAMMER - 0.05 && !trumpetT.some((t) => Math.abs(t - o[0]) < 0.12));
const cand = O.filter((o) => o[1] >= 0.28 && o[1] >= 0.55 * Math.max(...O.filter((p) => Math.abs(p[0] - o[0]) <= 1.5).map((p) => p[1])));
cand.sort((a, b) => b[1] - a[1]);
const acc = [];
for (const c of cand) if (acc.every((s) => Math.abs(s[0] - c[0]) >= 0.5)) acc.push(c);
const fromAudio = acc.map((o) => {
  const st = struckAt(o[0]); const t = r3(o[0]);
  const n = st.length ? (() => { const tn = top(st); return [t, r3(Math.max(t + 0.08, tn[1])), tn[2], velOf(o[2])]; })() : [t, r3(t + 0.3), 72 + o[3], velOf(o[2])];
  return { n, w: 2 };
});
const pool = [...FA, ...VI, ...fromAudio].sort((a, b) => b.w - a.w || a.n[0] - b.n[0]);
const kept = [];
// in the recap the feud-accents run at ~3 a second: keep one thorn per 0.45 s there too (the strongest first by order)
for (const c of pool) if (kept.every((k) => Math.abs(k.n[0] - c.n[0]) >= 0.45)) kept.push(c);
const ffT = attacks(set('ff-blows')).map((a) => a[0][0]);
const nearFF = (t) => ffT.some((f) => Math.abs(f - t) <= 0.08);
const broadAt = curve([[0, 0.55], [22, 1], [33.3, 0.75], [51, 1], [88, 0.6], [97.5, 1.1], [122, 1.1], [136, 1.2], [156, 1.2], [158.5, 0.6]]);
const thorns = sortN(kept.map(({ n }) => withValues([n[0], n[1], n[2], n[3]], nearFF(n[0]) ? { broad: 1.4, intensity: 1.4 } : { broad: r3(broadAt(n[0])) })));

// ---------- the strings: runs (violins/violas and cellos), every note, one clip ----------
const runsOf = (tracks) => {
  const out = [];
  for (const tr of tracks) {
    const at = attacks(pack.tracks[tr].notes).map(top);
    let ch = [at[0]];
    const flush = () => { if (ch.length >= 5) out.push(...ch); };
    for (let i = 1; i < at.length; i++) { if (at[i][0] - at[i - 1][0] <= 0.2) ch.push(at[i]); else { flush(); ch = [at[i]]; } }
    flush();
  }
  sortN(out);
  const ded = [];
  for (const n of out) if (!ded.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) ded.push([n[0], n[1], n[2], n[3]]);
  return ded;
};
// How the strings' wool tells the piece: straight under the horns' chorale, wool in the feud, wool thickening through
// the build, held back at the climax (the milk leads) and at the hammer (the needle leads), full wool in the recap,
// combed straight as the music falls at the end.
const SLACK = curve([[0, 3], [15, 5], [22, 4], [33.3, 4.5], [50.5, 5.5], [51.3, 2], [57.3, 2], [59, 5.5], [70.8, 1.2], [80, 2.5], [97, 6.5],
  [99.5, 5], [121.9, 5], [122, 2.2], [135.9, 2.2], [136, 6], [155.5, 6], [158.5, 1.5]]);
const FIBRES = curve([[0, 9], [15, 14], [33.3, 12], [50.5, 15], [51.3, 8], [57.3, 8], [59, 15], [70.8, 6], [97, 21], [99.5, 11], [121.9, 11],
  [122, 6], [135.9, 6], [136, 15], [155.5, 15], [158.5, 5]]);
// The build's strings play repeated, syncopated chords, not runs (78-97.6): their chord attacks (outer voices) join.
const buildChords = within(set('chord-blocks'), 76, CLIMAX);
const runNotes = runsOf(['violin', 'viola', 'cello']);
const runs = sortN([...runNotes, ...buildChords.filter((c) => !runNotes.some((n) => n[2] === c[2] && Math.abs(n[0] - c[0]) < 0.04))])
  .filter((n) => (n[0] < HUSH - 0.05) || n[0] >= HUSH_END)
  .map((n) => withValues(n, { slack: r3(SLACK(n[0])), fibres: Math.round(FIBRES(n[0])) }));
// The straight strings: the violins' repeated Bb5 of the hushed horns (each repeat yanks its line straight) and the
// hush's held notes (the B5 that never frays, the long B4).
const CALM = { slack: 1, fibres: 5, reach: 1.2, stays: 3 };
const bbRepeats = within(set('violins'), 22.6, 33.0).map((n) => withValues(n, { ...CALM, fibres: 4, stays: 1.6 }));
const hushStrings = sortN([...within(set('rising-strings'), 58.9, 72), ...set('hush-cover').filter((n) => [71, 74, 76, 83].includes(n[2]) && n[0] < 70.8)]);
const heldStrings = []; for (const n of hushStrings) if (!heldStrings.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.05)) heldStrings.push(n);
const held = heldStrings.map((n) => withValues(n, { ...CALM }));

// ---------- the clashes, and the nail ----------
// The clash strokes, except 121.9-135.9: there the hammered F# takes the needle. Every hammer (brass-blows, the
// orchestra on F#) is one F#4 needle; the same pitch again drives it deeper (ratchet 16 from a low bite, so it reaches
// its cap on the 130.5 blow); the last F# (134.86, after the breath) is the deepest and widest at once.
const clashes = set('clash-strokes').filter((n) => (n[0] < HUSH || n[0] >= 96.4) && (n[0] < 121.9 || n[0] >= 135.9));
const hammerA = attacks(within(set('brass-blows'), HAMMER, 136)).map((a) => a[0]);
const nail = hammerA.map((n) => {
  const last = Math.abs(n[0] - LAST_F) < 0.05;
  return withValues([n[0], r3(Math.max(n[1], n[0] + 0.3)), 66, n[3]], last ? { bite: 2, width: 2, stays: 1.2, ratchet: 0 } : { bite: 0.2, ratchet: 16, stays: 1.6, width: 1.7 });
});
const needles = sortN([...clashes, ...nail]);

// ---------- fate: the low strokes ----------
// Tiny and calm under the horns' chorale (foreshadowing), full size from the climax; the last F#'s stroke is the largest.
const lows = set('low-strokes');
const fate = sortN([
  ...within(lows, 51, 57.5).map((n) => withValues(n, { size: 0.4, life: 0.9 })),
  ...within(lows, 74, 81.5).map((n) => withValues(n, { size: 0.45, life: 0.9 })),
  ...within(lows, 81.5, 91).map((n) => withValues(n, { size: 0.55 })),
  ...within(lows, 91, 97.6).map((n) => withValues(n, { size: 0.7 })),
  ...within(lows, 97.6, END).map((n) => (Math.abs(n[0] - 134.81) < 0.05 ? withValues(n, { size: 1.6, life: 2.2, intensity: 1.5 }) : withValues(n, { size: n[0] < 136 ? 1.1 : 0.9 }))),
]);

// ---------- the sword cut: the feud's return ----------
const rc = onsetNear(RECAP, 0.1);
const swordCut = [withValues([r3(rc[0]), r3(rc[0] + 0.5), 71, 122], { melt: 2.6, drips: 0.45, gap: 2.2, shake: 1.5 })];

// ---------- the hush ground ----------
const hushCover = set('hush-cover');

// ---------- (critic) the taut wire: the cellos' D pedal and its chromatic climb ----------
// 36.9-43 the cellos hammer a D2 pedal under the violins' falling syncopations (the loudest stretch so far, 0.72, where
// the runs set is empty); 43.84-46.4 the bass climbs chromatically C2, C#2, D2, Eb2, each held ~0.75 s. Every stroke
// yanks one straight low line taut again: a wire under tension, then a wire that steps up.
const pedalA = attacks(pack.tracks.cello.notes.filter((n) => n[0] >= 36.9 && n[0] < 47 && n[2] <= 39)).map((a) => a[0]);
const pedal = pedalA.map((n) => withValues([n[0], n[1], n[2], n[3]], n[0] >= 43.8 ? { slack: 1, fibres: 7, reach: 1.4, stays: 1.4 } : { slack: 1.3, fibres: 5, reach: 1.4, stays: 0.9 }));

const picks = {
  'friar': { notes: friar },
  'thorns': { notes: thorns },
  'runs': { notes: runs },
  'bb-repeats': { notes: bbRepeats },
  'held-strings': { notes: held },
  'needles': { notes: needles },
  'fate': { notes: fate },
  'sword-cut': { notes: swordCut },
  'hush-cover': { notes: hushCover },
  'pedal': { notes: pedal },
  // the strings' notes of the build's second half, without the wool values (the time slice's own set)
  'stair-cuts': { notes: runs.filter((n) => n[0] >= 81.5 && n[0] < 96.4).map((n) => [n[0], n[1], n[2], n[3]]) },
};

// ---------- clips ----------
const iv = (pts, shape) => pts.map(([t, v, s]) => (s || shape ? { t, v, shape: s || shape } : { t, v }));
const RUST = { home: 0.6, chords: 0.12, back: 0.9, n: 2 };
const clips = [
  // ground: the rust field rises out of black with the feud's crescendo, cools in the hushed horns, heats again
  // (critic) back 0.7, not 0.9: 36-51 is the loudest stretch so far (0.72) and the ground was nearly black there
  { id: 'rust', start: 0, end: HUSH, track: 0, fade: 0.3, widget: 'fields', knobs: { ...RUST, back: 0.7 },
    intensity: iv([[0, 0], [5, 0.3], [11, 0.6], [16, 0.55], [21.5, 0.6], [24, 0.32], [33, 0.35], [40, 0.6], [47, 0.75], [59.5, 0.85]]) },
  // the hush: one cold plum field, breathing on the held notes
  { id: 'night', start: HUSH, end: 72.5, track: 1, fade: 0.4, widget: 'fields', listen: 'picks:hush-cover',
    // (critic) a glowing Rothko plum, not a black hole: back 0.3 so the stillness is a painting you can stand in
    knobs: { home: -0.75, chords: 0.2, back: 0.3, n: 1 }, intensity: iv([[HUSH, 0.6, 'ease'], [61.5, 1], [70, 0.9], [72.5, 0]]) },
  // the build: rust again, warming with the loudness
  { id: 'build', start: 70, end: 99.5, track: 0, fade: 1.5, widget: 'fields', knobs: { ...RUST },
    intensity: iv([[70, 0], [72, 0.3], [80, 0.45], [90, 0.7], [97, 0.85], [99.5, 0.7]]) },
  // the ember field: rises with the climax, pulses through the hammer, sinks in the breath, burns in the recap, cools at the end
  { id: 'ember', start: 96.5, end: END, track: 1, fade: 1.5, widget: 'fields',
    knobs: { home: 0.7, chords: 0.25, back: 1.3, n: 2 },
    // the hammer darkens the stage at its first blow (the needle needs black), the breath nearly puts it out, the last
    // F# and the sword cut light it again (each step on a real blow)
    intensity: iv([[96.5, 0, 'ease'], [99.6, 0.8], [121.9, 0.85, 'hold'], [122.07, 0.18], [130.5, 0.2], [131.5, 0.08, 'hold'], [134.86, 0.45],
      [135.9, 0.45, 'hold'], [136.07, 0.75], [155.5, 0.75], [159.9, 0.2]]) },
  // the strings' runs, one crimp for the whole section: wool or straight per note (see SLACK)
  { id: 'runs-a', start: 4.5, end: HUSH, track: 2, fade: 0.3, widget: 'crimp', listen: 'picks:runs',
    intensity: iv([[4.5, 0.8], [22.1, 0.8], [23, 0.45], [33, 0.45], [34, 1]]) },
  { id: 'runs-b', start: HUSH_END, end: END, track: 2, fade: 1, widget: 'crimp', listen: 'picks:runs', intensityMoves: 'present',
    intensity: iv([[HUSH_END, 0.5], [97, 1], [99.6, 0.75], [121.9, 0.75], [122.05, 0.55], [135.9, 0.55], [136.07, 1], [156, 1], [159.9, 0.4]]) },
  // straight strings: the Bb5 repeats under the hushed horns, the hush's held B5
  { id: 'bb', start: 22.3, end: 33.6, track: 3, fade: 0.5, widget: 'crimp', listen: 'picks:bb-repeats', knobs: { ...CALM } },
  { id: 'pedal', start: 36.7, end: 47.6, track: 3, fade: 0.3, widget: 'crimp', listen: 'picks:pedal', knobs: { ...CALM } },
  { id: 'held', start: 58.8, end: 73, track: 3, fade: 0.8, widget: 'crimp', listen: 'picks:held-strings', knobs: { ...CALM, fibres: 7, reach: 1.4 } },
  // the Friar: milky slabs, closer with every appearance; the trumpets at the climax
  { id: 'friar', start: 16.8, end: 81, track: 4, fade: 0.4, widget: 'handover', listen: 'picks:friar', knobs: { goneBy: 2.5, ring: 1.3 } },
  // (critic) The pillar: at the climax the trumpets' chorale stands as a tall column of milk in the middle of the
  // battle instead of one card over everything. A small copy stretched into a narrow full-height window (fit stretch
  // squeezes every slab four times narrower, so each blow is a lancet of light), while the feud's thorns stab in from
  // both edges and the needles cross it: the hymn the feud cannot drown, and the feud still visible around it.
  { id: 'trumpets', start: 99.5, end: HAMMER + 0.15, track: 4, fade: 0.2, widget: 'handover', listen: 'picks:friar', knobs: { goneBy: 2.5, ring: 1.3 },
    region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.3, h: 1, feather: 0.04, fit: 'stretch' } },
  // the thorns
  { id: 'thorns-a', start: 2, end: HUSH, track: 5, fade: 0.2, widget: 'prickle', listen: 'picks:thorns' },
  { id: 'thorns-b', start: 96.4, end: HAMMER + 0.1, track: 5, fade: 0.3, widget: 'prickle', listen: 'picks:thorns' },
  { id: 'thorns-c', start: 135.9, end: END, track: 5, fade: 0.3, widget: 'prickle', listen: 'picks:thorns' },
  // the swords, and the nail
  { id: 'swords-a', start: 21, end: HUSH, track: 6, fade: 0.3, widget: 'interlock', listen: 'picks:needles' },
  { id: 'swords-b', start: 96.4, end: END, track: 6, fade: 0.3, widget: 'interlock', listen: 'picks:needles' },
  // fate
  { id: 'fate-a', start: 51.5, end: 57.6, track: 7, fade: 0.3, widget: 'squares-snap', listen: 'picks:fate' },
  { id: 'fate-b', start: 74.6, end: END, track: 7, fade: 0.3, widget: 'squares-snap', listen: 'picks:fate' },
  // the long build's second half: the strings climb by steps (Eb, E, F#, A, Bb); a slit-scan over the wool chops the
  // strips into stepped blocks, every string chord cutting a band of the present (time slice, default knobs, its cuts on
  // the strings). It works on the finished picture, so the thorns and needles wait for the climax (96.4) rather than
  // be shredded with it.
  { id: 'stairs', start: 81.5, end: 96.4, track: 9, fade: 1.5, widget: 'timeslice', listen: 'picks:stair-cuts',
    // (critic) mode 2, rings: the now line is a ring whose radius follows the strings' top note, so as the strings
    // climb by steps the ring of the present widens step by step, a shock ring that bursts into the climax
    knobs: { mode: 2 },
    intensity: iv([[81.5, 0.3, 'ease'], [86, 0.8], [94, 1], [96.4, 0.6]]) },
  // the sword cut at the feud's return
  { id: 'cut', start: 135.8, end: 140, track: 8, fade: 0, widget: 'casket', listen: 'picks:sword-cut' },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 4. The clash · A "Milk and thorn": the Friar\'s chorale as Handover\'s milky slabs that grow from far-off tiles to the trumpets\' sky, Prickle thorns on the feud\'s accents, Interlock needles on the sword clashes and one needle hammered deeper on the F#, Crimp wool on the running strings (chopped into steps by a time slice in the build), Snap squares for fate, rust, plum and ember fields; one casket sword cut at the feud\'s return',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);

// per 5 s: attacks each set lands inside a live clip, and clips alive
const live = (t) => clips.filter((c) => c.start <= t && t < c.end);
const heard = (setId, a, b) => {
  const cs = clips.filter((c) => c.listen === `picks:${setId}`);
  return attacks(picks[setId].notes).filter((x) => x[0][0] >= a && x[0][0] < b && cs.some((c) => c.start <= x[0][0] && x[0][0] < c.end)).length;
};
console.log('from  clips | friar thorns runs bb held needles fate');
for (let a = 0; a < 160; a += 5) {
  const ids = Object.keys(picks).filter((k) => k !== 'sword-cut' && k !== 'hush-cover');
  console.log(`${String(a).padStart(3)}  ${Math.max(...[0, 1, 2, 3, 4].map((d) => live(a + d + 0.5).length))} | ${ids.map((k) => String(heard(k, a, a + 5)).padStart(3)).join(' ')}`);
}
console.log(`${ID}: ${clips.length} clips; friar ${friar.length} (trumpets ${trumpets.length}), thorns ${thorns.length}, runs ${runs.length}, needles ${needles.length} (nail ${nail.length}), fate ${fate.length}; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
