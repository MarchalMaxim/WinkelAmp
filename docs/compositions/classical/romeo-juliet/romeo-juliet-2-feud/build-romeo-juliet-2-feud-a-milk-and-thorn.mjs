// Builds shows/romeo-juliet-2-feud-a-milk-and-thorn.json: cycle A "Milk and thorn" on the feud (Allegro giusto).
// Run from the worktree root: node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-2-feud/build-romeo-juliet-2-feud-a-milk-and-thorn.mjs
//
// The cycle's mapping (the same in all six packs):
//   prickle   <- the feud's syncopated accents, about 1-2 a second at most: `feud-thorns` (the violins' syncopated long
//                notes where the strings play the figure alone, the audio's accents in the tutti)
//   interlock <- the sword clashes, cymbal-bright strokes from the audio: `clash-strokes`
//   crimp     <- the running string figures, violins, violas and cellos: `string-runs` (each ribbon at its pitch: cellos
//                low left, violins high right);
//                in the hush, tamed to a few calm lines, the clarinet and bassoon `transition-winds`
//   fields    <- the ground: a rust field that heats with the tutti; in the hush a cold plum field on the held A
//
// THE LEGEND (beyond the cast; the serendipity, each answering the form):
//   fold      <- the fugal chase (28.3-49.5): the strings imitate each other, so the picture imitates itself. A mirror
//                whose line turns with the bass round the circle of fifths. What the preview showed: the horizontal
//                ribbons fold into chevrons and crossed hatches (#), crossed blades, with fold's gold stitched seam
//                through them; and the chase's few thorns arrive mirrored, two thorns thrusting at one point from both
//                edges: the two houses, "both alike in dignity", as each other's mirror image. Found by trying it; the
//                best frames of the show. It comes back, quietly (strength 0.75, seam 0.25), in the hush, where the
//                clarinet and bassoon trade the falling figure (imitation again), turning with their notes (`wind-trades`).
//   fold again <- the build (49.5-61.02, the critic's pass): one more mirror on each semitone the bass climbs (F F# G Ab A,
//                then the push), 1 -> 6 folds on the chords (`build-mirrors`), over crimp ribbons on the same chords
//                (`build-pile`): stars, a pentagon, a hexagonal rose window of thorns and needles; cut dead on the first
//                sword clash (61.02), so the ordered window shatters into the flat fight. In the hush the mirrors unwind
//                as the winds' figure falls: 3 folds, 2 from 104.2, 1 from 109.8 (`wind-trades`).
//   casket    <- two strokes only, `sword-cuts`: the loudest crash of the pack (73.77, right after the breath) shears
//                the whole picture with a jolt; the last tutti blow (96.04) melts it into stepped columns and drips it
//                down into the hush: the fall.
//   pixelsort <- the heaviest tutti blows (`ff-blows`, 67.4-91.3), no paint of its own (own 0.15): the thorns, needles
//                and ribbons torn into short streaks on the blows only.
//   interlock escalates: needles stay 1.4 s in the first volleys, 2 s from the build, 2.6 s (and wider, deeper) in the
//                loudest volley, 3.2 s (wider still) in the most violent: the swords' mesh thickens volley by volley,
//                and a repeated pitch ratchets its needle deeper (61-70, the F# volley).
//   the breath (70-73.7): a deliberate stillness, the field nearly out, only the runs; then everything at once.
//   the field is kept far back (back 1.65): everything above draws 'lighten', and a brighter field swallowed the dim
//                red bodies of the thorns and needles (first preview), leaving only their strikes.
//
// Weight table (clip intensity per stretch; F field, R runs, T thorns, S swords, M mirror, P tear, C casket):
//   0-11.3 F .12-.5, T (8 thorns), S (1 clash): a spare entrance on black
//   11.3-28.3 F .9-.8, R 1, T, S                 28.3-47.7 F .7-.5, R 1, T (8), M 1
//   47.7-61 F .5-.75, R, T (9), S, M out by 49.5   61-70 F .92, R, T, S (stays 2), P
//   70-73.7 F .1, R alone                          73.7-92 F 1-.9, R, T, S (2.6, 3.2), P, C at 73.77
//   92-98.1 F .9 -> 0, R, T, S, C at 96.04 (the melt)   98.1-118 night field .75-.6, crimp winds .8-.35, M .8
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-2-feud-a-milk-and-thorn', SONG = 'romeo-juliet-2-feud';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
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
/** Group notes into attacks (a note joins when it starts < 40 ms after the attack's first). */
const attacks = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};
const top = (a) => a.reduce((b, n) => (n[2] > b[2] ? n : b));
const ALL = [...pack.notes, ...Object.values(pack.tracks).flatMap((t) => t.notes)];
const struckAt = (t, w = 0.06) => ALL.filter((n) => Math.abs(n[0] - t) <= w);

// ---------- feud-thorns: the feud's syncopated figure, as the ear follows it ----------
// Where the strings play the figure without tutti accents (0-10.9 and the chase/build 27.5-60.8), the violins' held
// syncopations (feud-violins). In the tutti, audio onsets at least 0.55 of the strongest within 1.5 s, strength >= 0.28,
// strongest-first and at least 0.5 s apart: one thorn per accent the ear counts, never a flicker.
const FV = attacks(set('feud-violins')).map(top);
const quietFigure = (t) => t < 10.9 || (t >= 27.5 && t < 60.8);
const fromViolins = FV.filter((n) => quietFigure(n[0]));
const O = ev.onsets.filter((o) => o[0] >= 10.9 && o[0] < 97.5 && !quietFigure(o[0]));
const cand = O.filter((o) => o[1] >= 0.28 && o[1] >= 0.55 * Math.max(...O.filter((p) => Math.abs(p[0] - o[0]) <= 1.5).map((p) => p[1])));
cand.sort((a, b) => b[1] - a[1]);
const acc = [];
for (const c of cand) if (acc.every((s) => Math.abs(s[0] - c[0]) >= 0.5)) acc.push(c);
acc.sort((a, b) => a[0] - b[0]);
const ffT = attacks(set('ff-blows')).map((a) => a[0][0]);
const nearFF = (t) => ffT.some((f) => Math.abs(f - t) <= 0.08);
const thorns = [];
fromViolins.forEach((n, i) => {
  // the opening's thorns broaden with the crescendo; the chase's are slimmer (the figure is quieter there)
  const broad = n[0] < 10.9 ? curve([[0, 0.5], [10.9, 1]])(n[0]) : curve([[27.5, 0.7], [47.7, 0.7], [60.8, 1]])(n[0]);
  const k = { broad: r3(broad) };
  if (i === 0) k.goneBy = 2.5;   // the held B4 that opens the feud stays as long as a thorn may
  thorns.push(withValues([n[0], n[1], n[2], n[3]], k));
});
for (const o of acc) {
  const st = struckAt(o[0]);
  const vel = Math.round(clamp(20 + 2.4 * (o[2] + 60), 15, 122));
  const t = r3(o[0]);
  const n = st.length ? (() => { const tn = top(st); return [t, r3(Math.max(t + 0.08, tn[1])), tn[2], vel]; })()
    : [t, r3(t + 0.3), 72 + o[3], vel];
  thorns.push(withValues(n, nearFF(o[0]) ? { intensity: 1.4, broad: 1.3 } : {}));   // an ff blow: a broader thorn, cracked harder
}
thorns.sort((a, b) => a[0] - b[0]);

// ---------- string-runs: the running figures, every note ----------
// Per track the top note of each attack; a chain of 5+ attacks <= 0.2 s apart is a run (the feud's figures leap and
// repeat as well as step). Violins, violas and cellos together; a note two of them play at once counts once.
const runsOf = (tracks) => {
  const out = [];
  for (const tr of tracks) {
    const at = attacks(pack.tracks[tr].notes).map(top);
    let ch = [at[0]];
    const flush = () => { if (ch.length >= 5) out.push(...ch); };
    for (let i = 1; i < at.length; i++) { if (at[i][0] - at[i - 1][0] <= 0.2) ch.push(at[i]); else { flush(); ch = [at[i]]; } }
    flush();
  }
  out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const ded = [];
  for (const n of out) if (!ded.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) ded.push([n[0], n[1], n[2], n[3]]);
  return ded.filter((n) => n[0] < 98);
};
const stringRuns = runsOf(['violin', 'viola', 'cello']);

// ---------- clash-strokes: the swords. The mesh thickens volley by volley ----------
// Clashes I keep the defaults; from the build on the needles stay longer (the mesh holds), and the loudest volley
// (73.7-81.3) and the most violent (81.3-95.5) drive them wider and deeper. A volley's repeated pitch ratchets its needle
// in further (interlock's own ratchet), so the F# volley of 61-70 drives one sword deeper stroke by stroke.
// `stays` is read every frame: it only grows, and only at a clash with no older clash in the window it opens (checked
// below), so no faded needle comes back.
const ESC = [[0, {}], [52, { stays: 2 }], [73.6, { width: 1.5, bite: 1.5, stays: 2.6 }], [81.3, { width: 1.8, bite: 1.8, stays: 3.2 }]];
const clashes = set('clash-strokes').map((n) => withValues(n, ESC.filter((e) => n[0] >= e[0]).pop()[1]));
{
  let S = 1.4;
  clashes.forEach((n, i) => {
    const v = n[4] && typeof n[4] === 'object' ? n[4] : {}, S2 = v.stays ?? 1.4;
    if (S2 > S && clashes.slice(0, i).some((p) => n[0] - p[0] >= S && n[0] - p[0] < S2)) throw new Error(`stays grows at ${n[0]} over a faded needle`);
    S = S2;
  });
}

// ---------- sword-cuts: two strokes of the casket ----------
// 73.77: the loudest crash of the pack, after the breath (a shear and a jolt, a short melt).
// 96.04: the last tutti blow (the audio falls from -22 to -44 dB in 2 s after it): a long melt with drips, the fall.
const cutAt = (t) => { const st = struckAt(t, 0.05); const tn = st.length ? top(st) : [t, t + 0.4, 74, 122]; return [r3(t), r3(Math.max(t + 0.3, tn[1])), tn[2], 122]; };
const swordCuts = [withValues(cutAt(73.77), { melt: 1.2, drips: 0.15, gap: 2.2, shake: 1.6 }),
  withValues(cutAt(96.04), { melt: 4.5, drips: 0.35, gap: 1.2, shake: 0.6 })];   // drips 0.6 -> 0.35 (critic): fewer of its built-in olive drips

// ---------- transition-winds: the hush. The lines go slacker and shorter as the figure falls ----------
const winds = set('transition-winds').map((n) => withValues(n, {
  slack: r3(curve([[98.5, 1.6], [117, 4.5]])(n[0])), reach: r3(curve([[98.5, 1.1], [117, 0.6]])(n[0])),
}));
const aPedal = set('a-pedal');

// ---------- the build: the chords pile up, and the mirrors pile up with them (the critic's pass) ----------
// 49.5-61 had nothing for its own strand (the runs stop 50.7-59.8), so the screen sat nearly empty through a crescendo.
// Its strand is the chords piling up over a bass that climbs a semitone at a time: F 49.7, F# 51.3, G 53.0, Ab 54.6,
// A 57.4, then the last push on F#/D from 59.4. `build-pile`: every chord's outer voices, for crimp's ribbons (they stay
// 2.4 s, so they pile). `build-mirrors`: the same chords for fold, each carrying `folds`: one more mirror on each bass
// step, 1 -> 6, so the picture closes into a rose window of thorns, needles and ribbons as the build tightens; the clip
// ends dead on the first sword clash (61.02): the kaleidoscope shatters back to one plane on the stroke.
const BUILD_FOLDS = [[49.5, 1], [51.3, 2], [52.9, 3], [54.55, 4], [57.4, 5], [59.4, 6]];
const pileNotes = set('chord-blocks').filter((n) => n[0] >= 49.5 && n[0] < 61.0);
const buildMirrors = pileNotes.map((n) => withValues(n, { folds: BUILD_FOLDS.filter((f) => n[0] >= f[0]).pop()[1] }));

const picks = {
  'feud-thorns': { notes: thorns },
  'clash-strokes': { notes: clashes },
  'string-runs': { notes: stringRuns },
  'sword-cuts': { notes: swordCuts },
  'ff-blows': { notes: set('ff-blows') },
  'transition-winds': { notes: winds },
  // the same notes without crimp's values, for the mirror; the build's mirrors unwind as the figure falls (critic): 3 folds, 2 from 104.2, 1 from 109.8
  'wind-trades': { notes: set('transition-winds').filter((n) => n[0] >= 99).map((n) => withValues(n, { folds: n[0] < 104.2 ? 3 : n[0] < 109.8 ? 2 : 1 })) },
  'a-pedal': { notes: aPedal },
  'build-pile': { notes: pileNotes },
  'build-mirrors': { notes: buildMirrors },
};

// ---------- clips ----------
const iv = (pts, shape) => pts.map(([t, v, s]) => (s || shape ? { t, v, shape: s || shape } : { t, v }));
const clips = [
  // the rust field: one enormous Rothko field, oxblood at rest, warming to rust with the loudness (home follows +level); chords
  // barely move it. Kept far back (back 1.65): every mark above is drawn 'lighten', so a brighter field would swallow the
  // thorns' and needles' dim red bodies and leave only their strikes
  { id: 'field', start: 0, end: 99.5, track: 0, fade: 1.5, widget: 'fields', knobs: { home: 0.1, chords: 0.12, back: 1.65, n: 1 },
    intensity: iv([[0, 0.12], [4.5, 0.25], [10.6, 0.5], [11.3, 0.9], [16.5, 0.8], [28.3, 0.7], [33, 0.5], [47.7, 0.5],
      [56, 0.75], [61, 0.92], [69.8, 0.92], [70.3, 0.1], [73.5, 0.1, 'hold'], [73.77, 1], [81.3, 0.95], [92, 0.9], [96.5, 0.85],
      [99.5, 0]]) },
  // the night field: one cold plum field, breathing on the held A
  { id: 'night', start: 97, end: 118, track: 1, fade: 1, widget: 'fields', listen: 'picks:a-pedal',
    knobs: { home: -0.6, chords: 0.2, back: 0.45, n: 1 },
    intensity: iv([[97, 0], [99.4, 0.7, 'ease'], [101, 0.75], [113, 0.65], [117.4, 0.6], [118, 0.15]]) },
  // the strings' ribbons: the scurrying runs (the wool lies a little longer than the default, so a run leaves a trail)
  { id: 'runs', start: 13.5, end: 97.5, track: 3, fade: 0.5, widget: 'crimp', listen: 'picks:string-runs', intensityMoves: 'present',
    knobs: { stays: 1.8 },
    intensity: iv([[13.5, 0.75], [16.5, 1]]) },
  // the swords: a pair of needles crossing the middle line on every clash
  { id: 'swords', start: 7, end: 97, track: 4, fade: 0.3, widget: 'interlock', listen: 'picks:clash-strokes' },
  // the two houses: one thorn per accent, from the left, then the right
  { id: 'thorns', start: 0, end: 98.5, track: 5, fade: 0.2, widget: 'prickle', listen: 'picks:feud-thorns' },
  // the fugal chase: the picture imitates itself, the mirror turning with the bass
  { id: 'mirror', start: 28, end: 49.5, track: 6, fade: 1.2, widget: 'fold',
    intensity: iv([[28, 0], [30, 1, 'ease'], [46.5, 1], [49.5, 0, 'ease']]) },
  // the build: the chords' ribbons pile up (they stay 2.4 s, so they accumulate): the strand the runs leave empty
  { id: 'pile', start: 49.5, end: 61.6, track: 2, fade: 0.6, widget: 'crimp', listen: 'picks:build-pile', knobs: { stays: 2.4 } },
  // the build: one more mirror on each semitone the bass climbs (1 -> 6 folds), cut dead on the clash at 61.02
  { id: 'mirrors', start: 49.5, end: 61.02, track: 6, fade: 0, widget: 'fold', listen: 'picks:build-mirrors',
    intensity: iv([[49.5, 0, 'ease'], [50.6, 1]]) },
  // the hush: clarinet and bassoon trade the falling figure, imitation again, so the mirror comes back, quietly
  { id: 'mirror2', start: 99, end: 118, track: 6, fade: 2, widget: 'fold', listen: 'picks:wind-trades', knobs: { strength: 0.75, seam: 0.25 },
    intensity: iv([[99, 0], [102, 0.8, 'ease'], [114, 0.8], [118, 0]]) },
  // the heaviest tutti blows tear what is there: the thorns, needles and ribbons sorted into streaks (no paint of its own)
  { id: 'tear', start: 66.8, end: 93, track: 7, fade: 0.3, widget: 'pixelsort', listen: 'picks:ff-blows', knobs: { own: 0.15 } },
  // two sword strokes through everything
  { id: 'cuts', start: 72.5, end: 99.5, track: 8, fade: 0, widget: 'casket', listen: 'picks:sword-cuts' },
  // the hush: a few calm lines on the clarinet and bassoon, slacker and shorter as the figure falls
  { id: 'winds', start: 98.2, end: 118, track: 2, fade: 0.6, widget: 'crimp', listen: 'picks:transition-winds',
    knobs: { fibres: 5, stays: 2.4 }, intensity: iv([[98.2, 0.8], [112, 0.65], [118, 0.35]]) },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 2. The feud · A "Milk and thorn": Prickle thorns from alternate edges on the syncopated accents, Interlock needles on the sword clashes, Crimp ribbons on the running strings, a rust field heating under the tutti; a mirror for the fugal chase, two casket strokes',
  composer: { by: 'claude', at: '2026-11-06T12:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
const per = (ns, a, b) => attacks(ns).filter((x) => x[0][0] >= a && x[0][0] < b).length;
const secs = [[0, 11.3], [11.3, 16.5], [16.5, 28.3], [28.3, 47.7], [47.7, 61], [61, 70], [70, 73.7], [73.7, 81.3], [81.3, 92], [92, 98.1]];
for (const [a, b] of secs) console.log(`${a}-${b}: thorns ${per(thorns, a, b)}, clashes ${per(clashes, a, b)}, runs ${per(stringRuns, a, b)}`);
console.log(`${ID}: ${clips.length} clips; thorns ${thorns.length}, clashes ${clashes.length}, string-runs ${stringRuns.length}, winds ${winds.length}; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
