// Barber, Adagio for Strings, show C: "One tree".
// Writes shows/barber-adagio-c-one-tree.json from picks.json (this folder; gen-picks.mjs makes it).
// Run: node docs/compositions/classical/barber-adagio/build-barber-adagio-c-one-tree.mjs
//
// The idea. Tree's own life is the Adagio's arc: it grows a step on every attack it hears (low notes the lower boughs,
// high notes the crown, loud ones a whole spray), its sky goes from first light to dusk over the piece, and after the
// loudest stretch of its middle a blight runs through it limb by limb, leaves turning and falling on later attacks. So
// one tree hears every voice (the clean violin, viola and cello lines, the bass, the cadence and hymn chords, and the
// notes measured from the audio where the 19% transcription is silent), and the show is built around what that one tree
// does, with four deliberate interventions, each on a turn of the form:
//   1. The iris (0.9-86 s). The theme alone, pp: the tree is seen only through a soft lit oval around its trunk; the rest
//      of the sky dawns step by step with each statement (answer, A2, the first ascent) and is whole at the first forte.
//   2. The cut (328.8-353.0 s). The climax's chord changes (measured from the audio) and the one fff blow each land a
//      casket strike on the golden crown: a slash, a melt, drips. Nothing else in the show strikes.
//   3. The silence (353.0-356.6 s). Every clip ends dead on the cut-off: black, Barber's rest.
//   4. The hymn (356.6-376.5 s). The same tree comes back, the very same drawing (Tree works out its whole life from its
//      notes, so a new clip lands on the same picture), but in first frost: white leaves on a cold blue. The hymn's
//      remote chords are another world. In the breath (376.5-380.6) it goes dark and the gold dusk returns with the
//      theme's long Bb4 (382.3); the leaves fall on the last attacks and the tree ends as a black drawing as the last
//      chord fades (465.4).
// What the previews showed (two rounds):
//   - Tree's own climax detection lands: replayed on this set (treeForecast below) the blight starts at 328.4 s, on the
//     climax's first chord (328.79). The leaves then turn and fall through the hymn and the reprise, and at 455 s the
//     tree stands bare against the violet dusk, as the concept asked, without any knob.
//   - The iris is the find of this show: at feather 0.7 the spot reads as a pale halo rising behind the trunk over the
//     firs, and the theme's first leaves land in it. Round 1 had it on the trunk's foot and the leaves fell in the dark.
//   - The sky clip also dims to two thirds in the low strophe: the one place the hero was a still photo.
//   - The casket on Tree: each strike is a ~1 s melt and one slash on the crown, healed by Tree's next repaint. That
//     is right for chord changes. Its default drips were red and green chips on the gold: drips 0.
//   - The canopy was full by about 150 s (Tree's own leaf curve), so 150-320 s was one rich, slowly lit picture.
// The critic's round (two more previews): the sky and iris tree is now a thin lace (leaves 0.25), and the full tree ('crown')
// is crossfaded over it on the swells only, so the tree grows fuller swell by swell, thins in the low strophe, and is
// whole for the first time on the climax's first chord. The big limbs of the two trees coincide (the layout comes from the
// notes); the small twigs differ a little, which shows as a faint second lace while the crown is half in: it reads as
// depth. The frost now goes out by 379.0 and the gold dusk starts at 380.4, so the breath is a second, short black.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'barber-adagio-c-one-tree', SONG = 'barber-adagio';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- the tree's set: every voice, once
// The union of the clean lines (each set is cleaned of the transcribers' vibrato fragments, so no fake attacks), the
// held chords, and the audio-measured notes (the lower strings' entrance, the climax's chord changes and its blow, two
// hymn chords, the last chords).
const UNION = ['melody', 'violin-line', 'viola-line', 'cello-line', 'bass-line', 'cadence-chords', 'hymn-chords',
  'stretto-cells', 'octave-doublings', 'climax-line', 'climax-chord', 'last-chords', 'audio-fills'];
// The third build's swell (266.5-275.1 s) is loud (-13.6 dB at 268 s) and untranscribed. Two chord changes measured
// from the audio here (onset peaks on a change in chroma_cqt, 0.25 s bins; librosa in C:/Users/maxim/.venvs/wa):
// 267.26 s F minor (F C Eb Ab, the swell's top at 268 s), 269.82 s to Ab/Cb (Ab B F Eb). Velocity from gen-picks'
// fit v = 133.8 + 3.76 dB on the analysis' levels (-13.6 and -18 dB). Pitches: the strongest chroma, in the violins'
// register there (F5/C5, Ab4/Cb5).
const SWELL = [[267.26, 269.82, 77, 82], [267.26, 269.82, 72, 78], [269.82, 274.6, 68, 66], [269.82, 274.6, 71, 64]];
const seen = new Map();
for (const id of UNION) for (const n of P[id].notes) {
  const key = `${Math.round(n[0] * 100)}:${n[2]}`;
  if (!seen.has(key)) seen.set(key, n.slice(0, 4));
}
for (const n of SWELL) seen.set(`${Math.round(n[0] * 100)}:${n[2]}`, n);
let tree = [...seen.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
// No attack in the cut-off silence (353.0-356.4 s) and nothing after the music (465.5 s).
tree = tree.filter((n) => !(n[0] >= 353.0 && n[0] < 356.4) && n[0] < 465.5);

// The casket's set: the climax's first chord (the violins' Eb6 at 328.79, the top of the ascent), its five chord
// changes and the one fff blow at 346.21. Nothing before or after strikes.
const cuts = [...P['ascent-to-top'].notes.filter((n) => n[0] > 328.7), ...P['climax-line'].notes, ...P['climax-chord'].notes]
  .map((n) => n.slice(0, 4)).sort((a, b) => a[0] - b[0] || a[2] - b[2]);

// ---------------------------------------------------------------- what Tree will do with it (its own rules, replayed)
// tree.js: chords by 40 ms, energy per attack from velocity against the set's 5th..95th percentile, one year (dur x
// wither / 400 rounds to 1), the blight starting 2 s after the loudest 10 s of 45-72 % of the piece.
function treeForecast(N, wither = 1) {
  const ch = []; for (const [s, , m, v] of N) { const l = ch[ch.length - 1]; if (l && s - l.t < 0.04) { l.n++; l.vel = Math.max(l.vel, v); } else ch.push({ t: s, n: 1, vel: v }); }
  const vs = N.map((n) => n[3]).sort((a, b) => a - b), v5 = vs[Math.floor(vs.length * 0.05)], v95 = vs[Math.floor(vs.length * 0.95)];
  const e = ch.map((c) => Math.min(1, Math.pow(Math.max(0.04, Math.min(1, (c.vel - v5) / Math.max(5, v95 - v5))), 1.5) * (1 + 0.14 * Math.min(4, c.n - 1))));
  const dur = ch[ch.length - 1].t, years = Math.max(1, Math.round(dur * Math.max(0.5, wither) / 400));
  const E = (a, b) => ch.reduce((s, c, i) => s + (c.t >= a && c.t < b ? e[i] : 0), 0);
  let best = dur * 0.58, bestE = -1;
  for (let t = dur * 0.45; t < dur * 0.72; t += Math.max(2, dur / 60)) { const x = E(t - 5, t + 5); if (x > bestE) { bestE = x; best = t; } }
  return { attacks: ch.length, v5, v95, dur, years, blight: best + 2, dusk: [0.56 * dur, 0.97 * dur], day: 0.2 * dur };
}
const fc = treeForecast(tree);
console.log(`tree set: ${tree.length} notes, ${fc.attacks} attacks; v5 ${fc.v5} v95 ${fc.v95}; one year: ${fc.years === 1}; ` +
  `day from ${fc.day.toFixed(1)} s, dusk ${fc.dusk.map((x) => x.toFixed(1)).join('-')} s, blight from ${fc.blight.toFixed(1)} s`);

// ---------------------------------------------------------------- the clips
const GOLD = { colours: 3 };          // ginkgo gold on a grey-lavender sky; every other knob is ours
// The critic's change (2026-11-06): two trees on the same notes, crossfaded, so the crown keeps building to the climax.
// Tree's own leaf curve fills the canopy by about 150 s, so a single tree is one picture from 150 to 320 s. THIN is the
// same tree with leaves 0.25 (a knob moved for the concept; 0.4 still filled up by 240 s, so the low strophe did not thin): a lace of wood and a few leaves, a lot of sky. It carries the
// iris and the sky. CROWN (our default leaves) lies over it and is let in step by step on the swells' pressure points
// only, so each swell leaves the tree fuller than the last and the ascent to the climax is the first time it is whole.
const THIN = { colours: 3, leaves: 0.25 };
const FROST = { colours: 6 };         // first frost: white on a cold blue; the same tree (the plan ignores the colours)
const iv = (pairs, shape) => pairs.map(([t, v, s]) => ({ t, v, ...(s ? { shape: s } : shape ? { shape } : {}) }));

// Where the trunk and first forks stand: Tree picks a layout and a mirror from a hash of its notes (tree.js hashNotes).
function treeLayout(N) {
  let h = 2166136261; for (let i = 0; i < N.length; i += Math.max(1, N.length >> 8)) { h = Math.imul(h ^ Math.round(N[i][2]), 16777619); h = Math.imul(h ^ Math.round(N[i][0] * 50), 16777619); }
  const seed = (h ^ N.length) >>> 0, L = [[[1262, 800], [770, 345]], [[1080, 800], [760, 400]], [[1215, 800], [860, 470]]][seed % 3], flip = !!(seed & 64);
  const fx = (x) => (flip ? 1280 - x : x);
  return { seed, flip, layout: seed % 3, base: [fx(L[0][0]), L[0][1]], top: [fx(L[1][0]), L[1][1]] };
}
const lay = treeLayout(tree);   // (the layout comes from the notes alone, so THIN and GOLD stand on the same trunk)
console.log(`layout ${lay.layout}, flip ${lay.flip}, trunk ${lay.base} -> ${lay.top}`);
// The iris: a soft round halo behind the trunk's upper half and the first forks, reaching the top of the picture, where the
// theme's notes (the high ranks of this set) put their first leaves. Seen in the first preview: centred on the trunk
// (0.32, 0.72) it made a pale moon over the firs, but the theme's leaves landed above it, in the dark.
const IRIS = { mode: 'spot', shape: 'ellipse', x: r3(lay.top[0] / 1280 - 0.04), y: 0.42, w: 0.48, h: 1.05, feather: 0.7 };

const clips = [
  // 1. The iris: the trunk seen through a soft oval, dawning with the long Bb4 (-43 -> -29 dB by 8.6 s).
  { id: 'iris', start: 0.9, end: 90, track: 0, fade: 0, widget: 'tree', listen: 'picks:tree', knobs: THIN, region: IRIS,
    intensity: iv([[0.9, 0], [3.95, 0.35, 'ease'], [8.6, 0.85, 'ease'], [21.1, 1], [90, 1]], 'ease') },
  // The whole sky, opening by statements: a glimmer in the first rest, more with the answer, A2, the first ascent; whole at
  // the first forte's Ab1 toll (86.2). The two clips draw the very same picture, so inside the oval nothing changes.
  { id: 'sky', start: 0.9, end: 353.0, track: 1, fade: 0, widget: 'tree', listen: 'picks:tree', knobs: THIN,
    intensity: iv([[0.9, 0], [8.6, 0], [21.1, 0.16, 'ease'], [30.0, 0.16, 'ease'], [49.5, 0.34, 'ease'], [53.4, 0.34, 'ease'],
      [70.1, 0.55, 'ease'], [86.2, 1, 'ease'], [353.0, 1]], 'ease') },
  // The crown: the full tree over the thin one, let in on the swells. Each ramp starts on a heard attack and takes 2.5 s
  // or more, so no leaves appear without a note. The first swell's forte (93-97.5) a third; the second build's F5, Db5 and
  // held Eb5 (144.6-149.5) over half; in the low strophe (the dark middle: low register, long notes far apart) it thins
  // back to a quarter, so the tree is a lace again while the cellos sing; the third build's push (257.5) and the
  // untranscribed swell (268) bring it back; the waves (278.8-284.9), the stretto (304-314.2) and the ascent (315.1-328.8)
  // fill it, and it is whole for the first time on the climax's first chord (328.79).
  { id: 'crown', start: 86.2, end: 353.0, track: 2, fade: 0, widget: 'tree', listen: 'picks:tree', knobs: GOLD,
    intensity: iv([[86.2, 0], [93.0, 0, 'ease'], [97.5, 0.32], [144.6, 0.32, 'ease'], [149.5, 0.55], [203.0, 0.55, 'ease'],
      [220.4, 0.22], [257.5, 0.22, 'ease'], [260.0, 0.45], [267.26, 0.45, 'ease'], [270.0, 0.58], [278.8, 0.58, 'ease'],
      [284.9, 0.72], [304.0, 0.72, 'ease'], [314.2, 0.86], [315.1, 0.86, 'ease'], [328.79, 1], [353.0, 1]]) },
  // 2. The cut: one strike on each of the climax's chords, on the full golden crown.
  { id: 'cut', start: 328.4, end: 353.0, track: 3, fade: 0, widget: 'casket', listen: 'picks:climax-cuts',
    // drips 0: at the default they fell as small red and green chips over the gold, foreign bits that read as confetti;
    // the melt and the one slash per chord are the searing part. Every other knob is ours.
    knobs: { drips: 0 } },
  // 3. Black 353.0-356.6. 4. The hymn: the same tree in first frost.
  { id: 'frost', start: 356.4, end: 380.6, track: 0, fade: 0, widget: 'tree', listen: 'picks:tree', knobs: FROST,
    intensity: iv([[356.4, 0], [356.6, 0.2], [358.4, 0.85, 'ease'], [374, 1, 'ease'], [376.5, 1, 'ease'], [379.0, 0], [380.6, 0]], 'ease') },
  // The reprise: the gold dusk back with the theme's long Bb4, to the end; the last chord fades to black at 465.4.
  { id: 'dusk', start: 380.4, end: 466.0, track: 1, fade: 0, widget: 'tree', listen: 'picks:tree', knobs: GOLD,
    intensity: iv([[380.4, 0], [382.3, 0.9, 'ease'], [396, 1], [448.5, 1, 'ease'], [454.4, 0.7, 'ease'], [455.4, 0.75, 'ease'], [465.4, 0], [466, 0]], 'ease') },
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Barber: Adagio for Strings · C · One tree: a single Tree (ginkgo gold) on every voice, seen first through an iris; ' +
    'the casket on the climax\'s chord changes; black at the cut-off; the same tree in first frost for the hymn; gold dusk to a bare drawing',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips,
  picks: { tree: { notes: tree }, 'climax-cuts': { notes: cuts } },
};
const out = join(ROOT, 'shows', `${ID}.json`);
// One note a line, as the studio writes them.
let json = JSON.stringify(show, null, 2);
json = json.replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2, $3, $4]');
writeFileSync(out, json + '\n');
console.log(`wrote ${out}: ${clips.length} clips; tree ${tree.length} notes, climax-cuts ${cuts.length}`);
