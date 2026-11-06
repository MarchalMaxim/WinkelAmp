// Builds shows/romeo-juliet-2-feud-b-ink-and-wash.json: cycle B "Ink and wash" on the feud (Allegro giusto, B minor).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/romeo-juliet/romeo-juliet-2-feud/build-romeo-juliet-2-feud-b-ink-and-wash.mjs
//
// THE CYCLE'S MAPPING (the same in all six packs of cycle B):
//   scribble <- the syncopated strings (violins and violas): nervous pens, a red or bone scratch on each accent
//   kline    <- the sword clashes (cymbal-bright audio strokes), in a full-frame see-through window: one bone bar a clash
//   klee     <- all notes: the polyphony mosaic, the ground
//
// THE PLAN (sections from ANALYSIS.md; weights are each clip's curve, `present` = intensityMoves present)
//   0-11.3   opening crescendo, held B4: a SPARE ENTRANCE. One pen on the held B4; a second pen enters on the low stroke at
//            4.74, the third on the tutti sforzando at 7.64 (presence steps on real attacks); the mosaic grows out of the
//            dark with the crescendo (klee fade-in, present 0.25 -> 0.8). The first bone bar on the 7.64 sforzando.
//   11.3-28.3 first tutti and the feud theme: everything full. Pens coil tight (rate), red scratches on the accents, bars
//            on the clash volleys 11.0-16.4 and 24.9-27.3.
//   28.3-47.7 the fugal chase: no clashes, so kline is empty; Klee leads (its subject is polyphony: each voice its own row,
//            glazes mixing where they cross), the pens step back a little (present 0.8).
//   47.7-61  the build: chords pile up -> the pens' lines STAY longer and longer (per-note `stay` 7 -> 17), so the sheet
//            fills into a graphite thicket as the tension mounts; first bars 52.2.
//   61-70    clashes I: bone bars, the thicket at its densest.
//   70-73.7  THE BREATH: near stillness. The mosaic thins to a trace (present 0.12), the pens drop to one or two and their
//            lines clear quickly; no bars. Only the runs move.
//   73.77    the loudest crash of the pack: from here the bars are BLOOD RED (a second kline clip, colour 1), the mosaic
//            and the pens back at full on the same attack. Red stays to the end: the feud has drawn blood.
//   73.7-96.4 clashes II and III, the last blows; the ff blows that are not clashes make the pens stab (long strokes).
//   96.43    the last tutti blow: the bars still up become the SCAR, a red lattice that stops soaking (stay 24) until the
//            held A, then soaks back over 13 s through the hush: gone by ~110, the last bars are the night's alone.
//   98.1-118 the hushed transition: the pens hear the clarinet and bassoon now (named so in the set), loosened into long
//            open arcs (per-note loops/speed); presence falls to one lone pen. The mosaic fades to the winds' sparse blocks;
//            the held A in the low strings lays one thin, dry red beam low on the page (99.8) beside the scar.
//
// FOUND IN THE PREVIEWS: Kline ranks a chord against the notes of its own set (a routed instance's NOTES), so in each
// volley the harder clashes strike bars and the softer ones lay its brush marks: a graded, broken line, kept (it reads as
// the clashes' own dynamics); the strokes that must be bars get the set's top velocities. Klee "present" left the tiles
// glowing through the breath, so the mosaic has a plain weight curve: the breath really goes dark. Scribble and Kline sit
// in full-frame see-through windows: without one, scribble's own lighten would lose its red scratches on ochre tiles.
// KNOBS (only where they serve the concept): kline `thresh` 0.55 (so every clash strikes a bar, not a small mark: the
// clashes in a volley are equally loud and sit on the 0.8 line); kline `colour` 1 in the blood clip; per-note values
// documented where they are made. Klee and scribble at our defaults.
// CRITIC'S PASS (2026-11-06), seen in the full preview:
//   - The fugal chase was 19 s of a uniform mosaic carpet under thin grey tangles. Now it is THREE STAVES: one scribble per
//     string section (violins, violas, cellos, honest tracks), one pen each, in three full-width bands, stretched; each
//     pen races (per-note speed 1.9) only while its own section runs, walks (0.8) otherwise. Weight 2 and stay 12 so the
//     handwriting holds against the mosaic. The full-frame pens rest from 29.6 to 47.71 (the build's first attack).
//   - Klee is two clips moved by how present: the first thins to bare rows for the chase (0.15) and piles back up with the
//     build's chords, then fades out through the breath (70-72.6), which is now truly dark; the second is struck fresh
//     by the loudest crash (73.77), so the blood bar lands on a new, sparse mosaic, and it thins to rows for the hush.
//   - The breath's string attacks lock the pens' stay at 1.5: the feud's tangle clears instead of lingering.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../../src/studio/show/show';
import { withValues } from '../../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../../..');
const ID = 'romeo-juliet-2-feud-b-ink-and-wash', SONG = 'romeo-juliet-2-feud';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const ev = JSON.parse(readFileSync(join(HERE, 'audio-events.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const lerpPts = (pts) => (t) => {
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
const T = pack.tracks;
const ALL = [...pack.notes, ...Object.values(T).flatMap((t) => t.notes)];
const near = (ts, t, w) => ts.some((x) => Math.abs(x - t) <= w);

// ---------- feud-strings (scribble): the violins and violas, accents shaped ----------
// Every violin and viola note before 98.1 s (a pitch both tracks start within 40 ms counts once). The velocities are
// loudness-derived in the pack, so every note would scratch; here a plain note is held at 20-52 (it jolts and presses
// its pen, a scratch needs about 69), and an ACCENT is 86-91 (a scratch, red 40-60 % of the time, no stab).
// Accents: the feud-accents attacks (audio onsets >= 0.6, the syncopated sforzandi), and in the opening crescendo the
// tutti sforzandi 7.64 and 9.29 s (clash/low strokes). At an accent the strings struck within 90 ms (the audio onset and the roll disagree by that much) join with up to
// four notes across the registers (violins, violas and the cellos struck with them), so several pens scratch at once.
// ff blows that are not cymbal clashes (the heavy low tutti blows) go to 104: the pens stab a long stroke there,
// while kline owns the clashes.
// The feud theme (16.5-28.3) and the build (47.7-61) carry their accents lower than the tutti: there the audio onsets
// that stand out locally (theme >= 0.5, build >= 0.38, at least 0.4 / 0.5 s apart) are the sforzandi the ear follows.
// The fugal chase has none (no onset reaches 0.35): its pens coil without scratching.
const localAcc = (a, b, min, gap) => {
  const out = [];
  for (const o of ev.onsets.filter((o) => o[0] >= a && o[0] < b && o[1] >= min).sort((p, q) => q[1] - p[1])) if (out.every((t) => Math.abs(t - o[0]) >= gap)) out.push(o[0]);
  return out;
};
const accT = attacks(set('feud-accents')).map((a) => a[0][0]).concat([7.64, 9.29], localAcc(16.5, 28.3, 0.5, 0.4), localAcc(47.7, 61, 0.38, 0.5))
  .sort((a, b) => a - b).filter((t, i, A) => i === 0 || t - A[i - 1] >= 0.06);
const clashT = set('clash-strokes').map((n) => n[0]);
const ffT = attacks(set('ff-blows')).map((a) => a[0][0]);
const stabT = ffT.filter((t) => !near(clashT, t, 0.15));
const strNotes = [];
for (const tr of ['violin', 'viola']) for (const n of T[tr].notes) if (n[0] < 98.1) strNotes.push([n[0], n[1], n[2], n[3]]);
strNotes.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const ded = [];
for (const n of strNotes) if (!ded.slice(-12).some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) ded.push(n);
const acc = new Set();
const shaped = ded.map((n) => [r3(n[0]), r3(Math.max(n[0] + 0.05, n[1])), n[2], clamp(Math.round(n[3] * 0.62), 20, 52)]);
// at each accent: the strings struck with it (cellos too), spread to <= 4 notes, loud
const cellos = T.cello.notes;
for (const t of accT) {
  // only the one attack nearest the onset (within 90 ms), so an accent scratches once
  const cand = attacks([...ded, ...cellos].filter((n) => Math.abs(n[0] - t) <= 0.09));
  if (!cand.length) continue;
  const struck = cand.reduce((b, a) => (Math.abs(a[0][0] - t) < Math.abs(b[0][0] - t) ? a : b)).sort((a, b) => a[2] - b[2]);
  const pickIdx = struck.length <= 4 ? struck.map((_, i) => i) : [0, Math.floor(struck.length / 3), Math.floor(2 * struck.length / 3), struck.length - 1];
  const stab = near(stabT, t, 0.08);
  for (const i of pickIdx) {
    const n = struck[i], s = r3(n[0]);
    const vel = stab ? 104 : 86 + Math.round(5 * clamp((n[3] - 60) / 60, 0, 1));
    // replace the plain copy if it is there, else add (a cello note)
    const j = shaped.findIndex((m) => m[2] === n[2] && Math.abs(m[0] - s) < 0.001);
    if (j >= 0) shaped[j][3] = vel; else shaped.push([s, r3(Math.max(n[0] + 0.05, n[1])), n[2], vel]);
    acc.add(s);
  }
}
shaped.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
// per-note values: the build fills the sheet (stay 7 -> 17 over 47.7-61), back to the default 7 at the clashes;
// the last string attack (the fall after the last blow) opens the loops into long arcs.
const stayBuild = lerpPts([[47.7, 8], [60.95, 17]]);
const lastStr = shaped[shaped.length - 1][0];
// CRITIC: the chase (29.6-47.71) is drawn by the three staves below, so the full-frame pens rest there (their notes
// leave this set). The breath (70.0-73.77): every string attack locks stay 1.5, so the feud's tangle clears in a second
// or two and the runs draw short-lived lines on an emptying page; the crash at 73.77 lands on near-black.
const CH_A = 29.6, CH_B = 47.71;
const feudStrings = shaped.filter((n) => n[0] < CH_A || n[0] >= CH_B).map((n) => {
  if (n[0] >= 70.0 && n[0] < 73.76) return withValues(n, { stay: 1.5 });
  if (n[0] >= 47.7 && n[0] < 61) return withValues(n, { stay: r3(stayBuild(n[0])) });
  if (n[0] >= lastStr - 0.001) return withValues(n, { loops: 0.15, speed: 0.7 });
  return n;
});
// the hush: the clarinet and bassoon now drive the pens, in long open arcs that slow as the figure falls; stay 5 so the
// feud's red tangle clears within seconds of the first wind note (no busy red in the pp), the arcs stay a few seconds
for (const n of set('transition-winds')) {
  feudStrings.push(withValues([n[0], n[1], n[2], n[3]], { loops: 0.06, speed: r3(lerpPts([[98.5, 0.7], [117, 0.45]])(n[0])), stay: 5 }));
}

// ---------- the swords (kline): bone until the breath, blood from the loudest crash ----------
// Each clash with the lowest note struck with it (roll and pack, within 60 ms): a chord's span makes Kline's bar long
// (a wide tutti -> a bar across the page) and its mean register sets the angle (low lies flat, high stands up).
// Velocity from the audio: 100 + the high-band jump (dB) -> 100..127, so the hardest clashes are the heaviest bars.
// (Kline ranks a chord against the other notes of its own set: the harder half of the clashes strike bars, the softer
// ones lay its short brush marks between them, a broken line. So the strokes that must be bars are given the top
// velocities: the loudest crash at 73.77, the two last blows, the A.)
// vel: forced velocity (the strokes that must strike a bar).
const hiPeak = (t) => ev.hi_peaks.reduce((b, p) => (Math.abs(p[0] - t) < Math.abs(b[0] - t) ? p : b));
const sword = (t, top, values, force) => {
  const struck = ALL.filter((n) => Math.abs(n[0] - t) <= 0.06);
  const low = struck.length ? struck.reduce((a, n) => (n[2] < a[2] ? n : a)) : null;
  const hp = hiPeak(t), vel = force ?? clamp(Math.round(100 + 1.2 * Math.max(0, hp[3])), 100, 126);
  const end = r3(t + 0.4), out = [withValues([r3(t), end, top, vel], values)];
  if (low && low[2] <= top - 12) out.unshift([r3(t), end, low[2], vel]);
  return out;
};
const clashes = set('clash-strokes');
const swordsBone = clashes.filter((n) => n[0] < 72).flatMap((n) => sword(n[0], n[2]));
const swordsBlood = clashes.filter((n) => n[0] >= 72).flatMap((n) => sword(n[0], n[2], undefined, Math.abs(n[0] - 73.77) < 0.05 ? 127 : undefined));
// the last two tutti blows (95.99 and 96.43 s, onset strength 1.14 / 1.19, hi-band peaks): the second is the scar,
// soaking back over 24 s instead of 4 (the knob is read every frame: the bars still up soak slower too, all but gone by then)
swordsBlood.push(...sword(95.99, 86, undefined, 127));
swordsBlood.push(...sword(96.43, 83, { stay: 24 }, 127));
// the held A of the low strings (99.8): one thin, dry beam lying low; from it the bars still up soak back over 13 s,
// so the scar is gone by about 110 and the last bars of the hush are the night's alone
// (A1 with the A2 an octave above, as the pack hears the pedal: a wide enough span for a long beam)
// (velocity 124: high in the set's ranking so it lands as a bar after the 3 s gap; weight 0.35 thins it to a dry beam,
// order 0 lets it lie free, low, instead of being built onto the bars still up)
swordsBlood.push([99.785, 102.5, 33, 124], withValues([99.785, 102.5, 45, 124], { stay: 13, weight: 0.35, order: 0 }));
swordsBlood.sort((a, b) => a[0] - b[0] || a[2] - b[2]);

// ---------- CRITIC: the fugal chase as three staves (scribble, one pen each) ----------
// The chase is the strings chasing each other in runs, a polyphony of sections. So each section gets its own scribble,
// one pen, in its own horizontal band (violins top, violas middle, cellos bottom): one widget in three places, a score of
// three voices. Velocities shaped as in feud-strings (x0.62, 20-52: no scratches, the chase has no sforzandi). Each
// stave RACES when its own line runs: an attack in a run (4+ attacks of that section <= 0.16 s apart) locks speed 1.9,
// any other attack returns the pen to its clip speed (0.8, a walk). So the violins and violas tear off together at 34.3
// while the cellos keep walking, and all three race at 39.2, 43.6 and 45.2.
const stave = (tr) => {
  const ns = T[tr].notes.filter((n) => n[0] >= 28.69 && n[0] < CH_B).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const at = attacks(ns).map((a) => a[0][0]);
  const inRun = new Set();
  let cur = [at[0]];
  const flush = () => { if (cur.length >= 4) cur.forEach((t) => inRun.add(t)); };
  for (let i = 1; i < at.length; i++) { if (at[i] - at[i - 1] <= 0.16) cur.push(at[i]); else { flush(); cur = [at[i]]; } }
  flush();
  const out = [];
  for (const a of attacks(ns)) for (const n of a) {
    const m = [r3(n[0]), r3(Math.max(n[0] + 0.05, n[1])), n[2], clamp(Math.round(n[3] * 0.62), 20, 52)];
    out.push(inRun.has(a[0][0]) ? withValues(m, { speed: 1.9 }) : m);
  }
  return out;
};
const staveV = stave('violin'), staveA = stave('viola'), staveC = stave('cello');

const picks = {
  'chase-violins': { notes: staveV },
  'chase-violas': { notes: staveA },
  'chase-cellos': { notes: staveC },
  'feud-strings': { notes: feudStrings },
  'swords-bone': { notes: swordsBone },
  'swords-blood': { notes: swordsBlood },
};

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const FULL = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch' };
const clips = [
  // the ground: Klee's mosaic on all notes. Grows out of the dark with the crescendo, leads the fugal chase, thins to a
  // trace in the breath, back at the crash, fades with the hush.
  // (a plain curve, not "present": present leaves the old tiles glowing through the breath; a weight dims the page)
  // CRITIC: two mosaics, both moved by how present (thin rows of tiles at the left end, the full carpet at the right).
  // The first grows out of the dark, crowds the tutti, THINS in the chase so each voice reads as its own row (the
  // polyphony laid bare), piles back up with the build's chords, and fades out through the breath (70.0-72.6), so the
  // breath is truly dark. The second is struck fresh by the loudest crash (73.77) and thins to bare rows for the hush.
  { id: 'mosaic', start: 0, end: 72.6, track: 0, fade: 2.6, widget: 'klee', intensityMoves: 'present',
    intensity: iv([[0, 0.25], [11.3, 1], [28.3, 1], [31, 0.15], [47.7, 0.15], [61, 1]]) },
  { id: 'mosaic-blood', start: 73.76, end: 118, track: 0, fade: 0, widget: 'klee', intensityMoves: 'present',
    intensity: iv([[73.76, 1], [96.5, 1], [103, 0.3], [112, 0.12], [118, 0]]) },
  // the feud's pens: one lone pen on the held B4, a second at 4.74, the third at 7.64 (steps on real attacks)
  { id: 'pens', start: 0, end: CH_A, track: 1, fade: 0.9, widget: 'scribble', listen: 'picks:feud-strings', region: FULL,
    intensityMoves: 'present',
    intensity: iv([[0, 0, 'hold'], [4.74, 0.45, 'hold'], [7.64, 0.8], [11.3, 1]]) },
  // the staves (the chase): one pen each, in three bands; they come in on the chase's first run (28.70) as the
  // full-frame pens fade, and hand back to them on the build's first attack (47.71)
  ...[['stave-violins', 'chase-violins', 0.2], ['stave-violas', 'chase-violas', 0.5], ['stave-cellos', 'chase-cellos', 0.8]].map(([id, set, y], i) => (
    { id, start: 28.69, end: 48.5, track: 4 + i, fade: 0.8, widget: 'scribble', listen: `picks:${set}`,
      region: { mode: 'window', shape: 'rect', x: 0.5, y, w: 1, h: 0.36, feather: 0.15, fit: 'stretch' },
      knobs: { pens: 1, speed: 0.8, weight: 2, stay: 12 } })),
  { id: 'pens-build', start: CH_B, end: 118, track: 1, fade: 0.3, widget: 'scribble', listen: 'picks:feud-strings', region: FULL,
    intensityMoves: 'present',
    intensity: iv([[CH_B, 1], [69.9, 1], [70.6, 0.3, 'hold'], [73.77, 1], [96.5, 1], [104, 0.6], [112, 0.4], [118, 0.3]]) },
  // the swords, bone: every clash strikes a bar; they soak back between volleys
  { id: 'swords', start: 7, end: 74, track: 2, fade: 1, widget: 'kline', listen: 'picks:swords-bone', region: FULL,
    knobs: { thresh: 0.55 } },
  // the swords, blood: from the loudest crash to the end; the scar and the A's beam soak through the hush
  { id: 'blood', start: 73, end: 118, track: 3, fade: 0.7, widget: 'kline', listen: 'picks:swords-blood', region: FULL,
    knobs: { thresh: 0.55, colour: 1 } },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Romeo and Juliet · 2. The feud · B "Ink and wash": Scribble pens on the violins and violas, scratching on every accent; Kline bone bars on the sword clashes, blood red from the loudest crash; Klee\'s polyphony mosaic on all notes; the breath, the scar of the last blow, and one loose pen for the hush',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
const secs = [[0, 11.3], [11.3, 16.5], [16.5, 28.3], [28.3, 47.7], [47.7, 61], [61, 70], [70, 73.7], [73.7, 81.3], [81.3, 92], [92, 98.1], [98.1, 118]];
const cnt = (ns, a, b, f = () => true) => attacks(ns).filter((x) => x[0][0] >= a && x[0][0] < b && f(x)).length;
for (const [a, b] of secs) console.log(`${a}-${b}: strings ${cnt(feudStrings, a, b)} (accents ${cnt(feudStrings, a, b, (x) => x.some((n) => n[3] >= 80))}, stabs ${cnt(feudStrings, a, b, (x) => x.some((n) => n[3] >= 100))}), bone ${cnt(swordsBone, a, b)}, blood ${cnt(swordsBlood, a, b)}`);
console.log(`${ID}: ${clips.length} clips; feud-strings ${feudStrings.length}, swords-bone ${swordsBone.length}, swords-blood ${swordsBlood.length}; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
