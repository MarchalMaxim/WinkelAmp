// Builds shows/liszt-hungarian-2-b-hot-plate.json: show B "Hot plate" on Liszt's Hungarian Rhapsody No. 2 (orchestra).
// Run from the worktree root: node_modules/.bin/tsx docs/compositions/classical/liszt-hungarian-2/build-liszt-hungarian-2-b-hot-plate.mjs
//
// The family: heat and liquid. One molten surface (Perlin) carries the whole piece and tells its temperature; water drops
// skate on it (Leidenfrost); the last of the water flees as steam (Flee); the real ff blows go off (Fireworks).
//
// The story is the plate's temperature, and its colour changes only where the piece changes key of feeling:
//   the lassan  (3.4-251.5)  AMBER, a slow molten surface. Its sea level is the clip's curve (intensityMoves present): at the
//                            cellos' p theme only the notes raise islands out of the black; at the sudden f the whole
//                            surface floods; at each ff break-off it sinks at once. The climax cut-off (251.5) is a hard cut.
//   the A-major song (264.5-307) PEARL: the one tender patch cools the surface to mother-of-pearl.
//   the dissolve (307-361.5)  INDIGO, nearly still (churn ~0.02): the plate has gone cold. The grand pause is black.
//   the friska  (383.5-628.6) AMBER again, heating: its churn is the measured pulse of the dance (0.92 s -> 0.29 s), set
//                            per note, so the accelerando brings the surface to a boil. Nothing else drives the churn.
// The drops:
//   - the Lento's cimbalom knocks flick a drop across the plate (the first water on it);
//   - the solo voice of the lassan (clarinet cadenza, the G# taps and garlands, the dance tune, the first glitter, the high
//     shake, the sinking clarinet) is ONE drop; it splits only at the first glitter and its beads boil off as the clarinet sinks;
//   - the friska's high line (the clarinet's pp dawn, then the violins' staccato, the glitter, the whirl, the spray, the
//     dying tremolo) is the drop that splits into beads on loud hits and boils away as the heat rises;
//   - the stomps (tutti blows, cello/viola accents, the stretta and the last chords) kick ONE big drop that never splits.
// The prestissimo's unorganised mass (pack notes, listen all) is Flee in bone: the water has become steam, and it flees.
// Fireworks only on the real ff blows: the Lento's deep strokes (small), 78.8, the ff of 89-92, the climax strokes, the
// friska tuttis, the stomps, the stretta, the B chord, the last blow (one huge burst whose smoke hangs through the held chord,
// which has no new attack) and the F# major chords.
//
// Weights per 30 s (perlin: its sea level, the clip's curve; drops/flee/fireworks: on = the clip plays, - = off):
//   s        plate (colour)   knock  solo   friska  stomp  flee  fireworks
//   0-30     amber .32-.5     on     -      -       -      -     3 small strokes
//   30-60    amber .5/.1/.7   to 40  -      -       -      -     -
//   60-90    amber .7-1       -      -      -       -      -     78.8, 89.6
//   90-120   amber 1/.1-.3    -      on     -       -      -     91.4 (cut at 92.5)
//   120-150  amber .35-.5     -      on     -       -      -     -
//   150-180  amber .5/.1/.55  from 174 to 174 -     -      -     176.1
//   180-210  amber .6         on     -      -       -      -     190.8
//   210-240  amber .5-.75     to 212 -      -       -      -     -
//   240-270  amber -1, CUT; pearl .3-.55  -  253-264 -     -     -     climax 246.6-250.8 (cut at 251.5)
//   270-300  pearl .5-.6      -      -      -       -      -     -
//   300-330  pearl>indigo .3  -      -      -       -      -     -
//   330-360  indigo .25-.68   -      -      -       -      -     -
//   360-390  black; amber .08-.2      -     on (own ember plate .32)  -  -  -
//   390-420  amber .3-1       -      -      on      410-   -     410-420
//   420-450  amber .35-.4     -      -      on      to 421 -     -
//   450-480  amber .3-.7      -      -      on      -      -     -
//   480-510  amber 1/.75      -      -      on      to 500 -     483-498
//   510-540  amber .3/.72-.9  -      -      on      539-   -     529.9, 533.1
//   540-570  amber 1          -      -      on      on     -     539.8-568.2
//   570-600  amber .5-.14-.22 -      -      tremolo -      584-  -
//   600-628.6 amber .1-1      -      -      -       612-   to 604 615.7-627.1
//
// What the previews taught (and why it stayed):
//   - Perlin cast as a sea-level instrument: at a low curve only what the notes raise breaks the black, so the cellos'
//     p theme (40.4-56) is ONE island growing out of the dark, and each ff break-off (92.5, 251.5) sinks the whole plate.
//   - A window region with w/h ABOVE 1 and fit cover is a close-up lens: the friska drops at 1.15, the stomp drop at 1.7.
//     At 1.3 the friska's dawn drop wandered off the visible part of its plate, so 1.15.
//   - The colour is the temperature: amber, pearl (rough held at 0.22, so the tender song is satin, not crinkled foil),
//     indigo nearly still in the dissolve, amber again for the friska.
//   - The tremolo has a clip of its own: its first hits shatter one drop into beads, the rest boil them away. Running the
//     friska drops on into it emptied the plate and Leidenfrost refilled it with a drop no note brought (a fake attack).
//     Same in the sinking clarinet (166-174): its boil is kept low so a bead survives.
//   - The lassan's fireworks were enlarged (78.8-91.4: 1.3-1.5; climax 1.6-2.3): at size 1 they vanished in the amber.
//   - Flee in bone (pal 2): the water's last steam, fleeing in the prestissimo.
//
// The critic's pass (2026-11-06; the weights table above predates it):
//   - Fireworks: ember red only on the Lento's deep strokes (ff-1, ff-3, on a low sea); every ff tutti is a BLUE flame (hue 0.55,
//     amber's complement), as red over full amber read as pink fog. Friska tuttis linger 0.25. The 26.3 stroke (vel 74) is gone.
//   - The friska plate's skin crinkles finer with the heat (rough 0.33 -> 0.65, per note), and on the last blow (620.5) the plate
//     goes WHITE-HOT (colour pearl, per note, to the end): the one colour flip of the show, on a real attack.
//   - The prestissimo plate is raised to 0.3-0.46, so the boil (churn 1.2-1.45) shows under the Flee; the dissolve to 0.36-0.5.
//   - The A-major song gets a calm drop on the violins' tune (song-drop: no boil, no burst, no zoom).
//   - The friska drops are four clips (new water at 455.88, 500.7, 527.11) with a low boil until the tremolo: a headless
//     simulation of the widget (lab/tools/leidenfrost.js run through src/widgets/instantiate) found one long clip always
//     splitting its water to nothing and refilling with a drop no note brought. 16-22 seeds now run clean on every drop clip.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'liszt-hungarian-2-b-hot-plate', SONG = 'liszt-hungarian-2';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const set = (id, from = -1, to = 1e9) => {
  const s = P[id]; if (!s) throw new Error(`no set ${id}`);
  return s.notes.filter((n) => n[0] >= from && n[0] < to).map((n) => [n[0], n[1], n[2], n[3]]);
};
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
/** Several sets as one strand: sorted, one note per pitch within 40 ms. */
const union = (...lists) => {
  const all = lists.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2]), out = [];
  for (const n of all) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
  return out;
};
const attacks = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) {
    const l = out[out.length - 1];
    if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]);
  }
  return out;
};

// ---------- the tempo of the plate: churn from the measured pulse (ANALYSIS.md, "Tempo") ----------
// The lassan has no steady pulse: a slow simmer, quicker in the lilting dance (0.53 -> 0.41 s); the friska tightens
// 0.92 -> 0.41 -> 0.36 -> 0.35 -> 0.31 -> 0.29 s, and the churn follows it to a boil.
const churnAt = curve([
  [0, 0.1], [40, 0.07], [56, 0.13], [92, 0.17], [104, 0.1], [131, 0.16], [160, 0.3], [173, 0.1], [212, 0.14], [246, 0.28],
  [264, 0.09], [300, 0.07], [312, 0.03], [350, 0.02], [358, 0.05],
  [363, 0.18], [384, 0.42], [432, 0.62], [444, 0.68], [500, 0.74], [504, 0.8], [528, 1.02], [584, 1.2], [600, 1.45], [628, 1.5],
]);
const churned = (ns) => ns.map((n) => withValues(n, { churn: r3(churnAt(n[0])) }));

// ---------- the surfaces' strands ----------
// Amber lassan: the low line, the cellos, the lassan theme's three entries, the Lento's proclamations and deep strokes, the
// dance's G# drone, the climax strokes.
const plateLassan = churned(union(
  set('bass-all', 3, 251.5), set('cello-line', 3, 251.5), set('lento-proclamations'), set('lento-strokes'),
  set('lento-proclamations-return'), set('lassan-theme-cellos'), set('lassan-theme-strings'), set('lassan-theme-return'),
  set('dance-pedal'), set('climax-strokes'),
));
// Pearl song: the whole tender song (its tune, its soft bass, the harp's rolled chords).
const plateSong = churned(union(set('a-major-song'), set('a-major-bass'), set('harp-arpeggio')));
// Indigo dissolve: the pp murmur, its faintest touches from the audio, the C# swell.
const plateCold = churned(union(set('dissolve-murmur'), set('dissolve-audio'), set('dominant-swell')));
// Amber friska: the oom-pah bass, the deep tolls, the G# pedal, the plunge (its bulges sweep right to left as it falls),
// the prestissimo's C#3 pulse, the stretta's low notes, the last chords without the notes inside the held chord.
const held = (n) => n[0] > 620.7 && n[0] < 624.4;   // the Bb0/A1 chord is held ff with no new attack
// The critic's pass: as the friska heats, the skin crinkles (rough rises with the pulse, from satin to a fine boiling grain),
// and on the last blow (620.5) the plate goes WHITE-HOT: the pearl of the tender song comes back, now boiling, and stays to
// the end (colour set per note on the blow and on every chord after it; the held chord has no attack, so nothing flips there).
const roughAt = curve([[383, 0.33], [421, 0.36], [480, 0.42], [539, 0.5], [584, 0.58], [612, 0.62], [628, 0.65]]);
const plateFriska = churned(union(
  set('friska-vamp-bass'), set('deep-tolls'), set('dominant-pedal'), set('plunge'), set('prestissimo-bass'),
  set('stretta-chords').filter((n) => n[2] < 62), set('final-chords').filter((n) => !held(n)),
)).map((n) => withValues(n, n[0] >= 620.4 ? { rough: 0.6, colour: 3 } : { rough: r3(roughAt(n[0])) }));

// ---------- the drops' strands ----------
// The Lento's knocks: a drop flicked by each ornament; the hardest knock of a group splits it, now and then.
const knocks = attacks(set('lento-knocks')).flatMap((a) => {
  const top = Math.max(...a.map((n) => n[3]));
  return a.map((n) => withValues(n, { burst: n[3] === top && top >= 99 ? 0.6 : 0, push: r3(clamp(0.25 + (n[3] - 64) / 80, 0.2, 0.7)) }));
});

// The lassan's solo voice, one drop: calm (erratic low) while the clarinet sings, splitting only at the first glitter;
// its beads skitter on the high shake and boil off as the clarinet sinks pp.
const soloNotes = union(
  set('clarinet-cadenza-1'), set('cadenza-hush-knocks'), set('gsharp-repeats'), set('clarinet-garlands'),
  set('interlude-line', 112.8, 131), set('dance-lilt'), set('glitter-1'), set('high-alternation'), set('clarinet-sinking'),
  set('clarinet-cadenza-2'),
);
const inSet = (id) => { const s = P[id].notes; return (n) => s.some((m) => m[2] === n[2] && Math.abs(m[0] - n[0]) < 0.04); };
const isGlitter1 = inSet('glitter-1'), isShake = inSet('high-alternation'), isSinking = inSet('clarinet-sinking');
const solo = soloNotes.map((n) => {
  const t = n[0];
  const v = { burst: 0, boil: 0.15, erratic: 0.3, push: r3(clamp(0.2 + (n[3] - 40) / 140, 0.15, 0.55)), steam: 0.45 };
  if (t >= 100 && t < 104) Object.assign(v, { push: 0.15, steam: 0.3 });                         // the hush's soft re-touches
  if (t >= 131 && t < 160) v.erratic = r3(curve([[131, 0.35], [160, 0.55]])(t));                 // the dance quickens
  if (isGlitter1(n)) Object.assign(v, { burst: n[3] >= 80 ? 0.55 : 0.2, boil: 0.25, erratic: 0.6 });
  if (isShake(n)) Object.assign(v, { burst: 0.08, boil: 0.18, erratic: 0.7, push: 0.55 });
  if (isSinking(n) || (t > 166 && t < 174)) Object.assign(v, { burst: 0, boil: 0.12, erratic: 0.25, push: 0.2, steam: 0.6 });   // a low boil: an empty plate would refill with a drop no note brought
  if (t >= 253) Object.assign(v, { burst: 0, boil: 0.1, erratic: 0.25, push: r3(t < 255.6 ? 0.45 : 0.22), steam: 0.4 });
  return withValues(n, v);
});

// The friska's high line, one strand from the clarinet's pp dawn to the dying tremolo.
const topNotes = union(
  set('friska-dawn'), set('friska-strings-theme'), set('friska-violins'), set('glitter-2'), set('high-whirl'),
  set('dip-line'), set('fireworks'), set('high-tremolo'),
);
const isSpray = inSet('fireworks'), isGlitter2 = inSet('glitter-2'), isWhirl = inSet('high-whirl'), isTrem = inSet('high-tremolo');
const boilAt = curve([[363, 0.05], [421, 0.08], [500, 0.12], [526, 0.15], [570, 0.2], [578, 1]]);   // kept low: the headless check found one long clip emptying (and refilling with no note) at 0.4-0.65
const erraticAt = curve([[363, 0.28], [385, 0.45], [432, 0.6], [500, 0.8], [528, 0.9], [570, 0.6]]);
const steamAt = curve([[363, 0.35], [385, 0.5], [480, 0.7], [528, 0.85], [584, 1]]);
const plateAt = curve([[363, 0.32], [383, 0.42], [386, 0.2], [392, 0]]);   // the drop's own ember glow, until the amber surface is up
let firstViolin = true;
const top = topNotes.map((n) => {
  const t = n[0], loud = clamp((n[3] - 70) / 40, 0, 1);
  const v = { boil: r3(boilAt(t)), erratic: r3(erraticAt(t)), steam: r3(steamAt(t)), plate: r3(plateAt(t)),
    push: r3(clamp(0.25 + 0.6 * loud, 0.2, 0.9)), burst: 0 };
  if (t >= 385 && t < 421) v.burst = r3(t < 399 ? 0.12 * loud : 0.35 * loud);    // the strings' crescendo splits the drop
  if (t >= 385.3 && firstViolin) { v.burst = 1; firstViolin = false; }             // the violins take the tune: it splits
  if (t >= 421) v.burst = r3(0.15 * loud);
  if (isGlitter2(n)) v.burst = r3(0.25 + 0.3 * loud);
  if (isWhirl(n)) Object.assign(v, { burst: 0.35, erratic: 1 });
  if (isSpray(n)) Object.assign(v, { burst: 1, push: 0.9 });                       // the highest burst: every bead splits
  // the dying tremolo (a clip of its own): its first hits shatter one drop into beads, the rest boil them away
  if (isTrem(n)) Object.assign(v, { burst: t < 572.6 ? 1 : 0, boil: t < 572.6 ? 0.3 : 1, push: 0.3, plate: 0, steam: t < 572.6 ? 0.35 : 0.7 });
  return withValues(n, v);
});

// The stomps: one big drop, kicked hard by every blow, never split, never boiled.
const stompNotes = union(
  set('tutti-1-blows'), set('stomp-blows'), set('loudest-stomp-blows'), set('stretta-chords', 612),
  set('final-chords').filter((n) => !held(n)),
);
const stomps = stompNotes.map((n) => withValues(n, { push: r3(clamp(0.45 + (n[3] - 90) / 40, 0.35, 1)) }));

// ---------- the real ff blows (Fireworks) ----------
// Chosen by ear and by the audio (the loudest 2 s windows reach -1 to -5 dB), about one a second at most.
const BLOWS = [
  [10.4, 0.6], [15.8, 0.7],                                   // the Lento's deep strokes, small, dark (26.3, vel 74, dropped: not ff)
  [176.1, 0.6], [190.8, 0.65],                                // the same in the Lento's return
  [78.8, 1.45], [89.6, 1.3], [91.4, 1.5],                      // the lassan's one blow, and its ff
  [246.6, 1.6], [248.1, 1.75], [249.4, 1.9], [250.8, 2.3],     // the climax strokes; the A1/A2 blow is the biggest
  [410.7, 1], [412.3, 1.2], [413.8, 1.05], [416.3, 1.05], [419.4, 1.15],
  [483.6, 1.05], [485.4, 1], [486.8, 1], [488.1, 1.25], [489.8, 1.05], [493.8, 1], [494.7, 1.1], [498.4, 1.05],
  [529.9, 1], [533.1, 1.05],
  [539.8, 1.2], [542.3, 1.05], [546.6, 1], [548.0, 1], [552.8, 1.2], [557.1, 1.15], [559.3, 1], [563.1, 1.05], [566.9, 1.05], [568.2, 1.2],
  [615.7, 1], [616.6, 1.05], [618.7, 1.15],
  [619.1, 1.1],                                                // the B chord before the rest
  [620.5, 2.4],                                                // the last blow: one burst fills the sky, its smoke hangs
  [624.9, 1], [625.9, 1.05], [626.8, 1.15], [627.1, 1.25],    // the F# major chords
];
const blowPool = union(
  set('ff-blows'), set('lento-strokes'), set('lento-proclamations'), set('lento-proclamations-return'), set('climax-strokes'),
  set('lassan-ff-peaks'), set('tutti-1-blows'), set('stomp-blows'), set('loudest-stomp-blows'), set('stomp-bursts'),
  set('stretta-chords'), set('final-chords'), set('deep-tolls'),
);
const blows = [];
for (const [t, size] of BLOWS) {
  const ch = blowPool.filter((n) => Math.abs(n[0] - t) <= 0.05);
  if (!ch.length) throw new Error(`no blow at ${t}`);
  const t0 = Math.min(...ch.map((n) => n[0]));
  const v = { size };
  if (t === 620.5) v.linger = 1;            // smoke for the held chord
  else if (t >= 624.9) v.linger = 0.6;
  for (const n of ch.filter((n) => n[0] - t0 < 0.035)) blows.push(withValues(n, v));
}
blows.sort((a, b) => a[0] - b[0] || a[2] - b[2]);

const picks = {
  'plate-lassan': { notes: plateLassan }, 'plate-song': { notes: plateSong }, 'plate-cold': { notes: plateCold },
  'plate-friska': { notes: plateFriska }, 'knocks': { notes: knocks }, 'solo-drop': { notes: solo },
  'friska-top': { notes: top }, 'stomps': { notes: stomps }, 'ff-real': { notes: blows }, 'song-drop': { notes: set('a-major-song') },
};

// ---------- clips ----------
/** Pivots; a third element 'step' makes a jump at that time (from the previous value). */
const iv = (pts) => {
  const out = [];
  for (const [t, v, s] of pts) {
    if (s === 'step') { const prev = out[out.length - 1]; out.push({ t: r3(t - 0.02), v: prev ? prev.v : v }); }
    out.push(s === 'ease' ? { t, v, shape: 'ease' } : { t, v });
  }
  return out;
};
const PERLIN = (colour, extra = {}) => ({ colour, churn: { base: 0.15, drive: '', depth: 0 }, ...extra });
/** A small copy bigger than the stage: the drops seen closer (the middle of their plate, zoomed). */
const ZOOM = (k) => ({ mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: k, h: k, feather: 0, fit: 'cover' });
const DROP = (extra) => ({ plate: 0, burst: { base: 0, drive: '', depth: 0 }, ...extra });

const clips = [
  // ===== the plates =====
  { id: 'plate-amber-lassan', start: 3.3, end: 251.5, track: 0, fade: 0, widget: 'perlin', listen: 'picks:plate-lassan',
    knobs: PERLIN(2), intensityMoves: 'present',
    intensity: iv([
      [3.3, 0.32], [12, 0.42], [36, 0.5], [40.3, 0.5],
      [40.4, 0.1, 'step'], [55.9, 0.12],                                  // the cellos alone: islands out of the black
      [56.0, 0.7, 'step'], [76, 0.78], [78.8, 0.92], [88, 1], [92.4, 1],  // the sudden f, to the ff
      [92.5, 0.12, 'step'], [99.9, 0.08], [104, 0.18], [113, 0.3], [131, 0.38], [146, 0.48], [160, 0.52],
      [166.5, 0.38], [172, 0.12],                                          // the clarinet sinks pp
      [173.9, 0.55, 'step'], [211, 0.6], [212.4, 0.5], [236, 0.72], [246.4, 0.95], [250.5, 1],
    ]) },
  { id: 'plate-pearl-song', start: 264.3, end: 310, track: 1, fade: 2, widget: 'perlin', listen: 'picks:plate-song',
    knobs: PERLIN(3, { rough: { base: 0.22, drive: '', depth: 0 }, size: { base: 1.35, drive: '+bass', depth: 0.3 } }), intensityMoves: 'present',
    intensity: iv([[264.3, 0.3], [268, 0.55], [276, 0.6], [290, 0.5], [304, 0.42], [310, 0.3]]) },
  { id: 'plate-indigo-dissolve', start: 305, end: 361.6, track: 2, fade: 2, widget: 'perlin', listen: 'picks:plate-cold',
    knobs: PERLIN(0), intensityMoves: 'present',
    intensity: iv([[305, 0.36], [316, 0.4], [340, 0.36], [344, 0.42], [355.5, 0.5], [357.5, 0.68, 'ease'], [361, 0.15]]) },
  { id: 'plate-amber-friska', start: 383.5, end: 628.6, track: 0, fade: 2, widget: 'perlin', listen: 'picks:plate-friska',
    knobs: PERLIN(2), intensityMoves: 'present',
    intensity: iv([
      [383.5, 0.08], [385, 0.15], [399, 0.3], [405, 0.45], [410.3, 0.55],
      [410.6, 1, 'step'], [420.8, 1],                    // first tutti
      [421.0, 0.35, 'step'], [438, 0.4], [455.9, 0.5],   // the tune in F# major, p
      [456.0, 0.3, 'step'], [468, 0.45], [480.5, 0.7],   // second build over the G# pedal
      [480.7, 1, 'step'], [500.3, 1],                    // stomping tutti
      [500.4, 0.75, 'step'], [510.2, 0.75],              // high whirl
      [510.3, 0.3, 'step'], [526.4, 0.45],               // the dip
      [526.5, 0.72, 'step'], [534.4, 0.8], [539.3, 0.9], // the spray and the plunge
      [539.4, 1, 'step'], [570.3, 1],                    // the loudest stomp
      [570.4, 0.5, 'step'], [580, 0.3], [584, 0.3],      // the tremolo dies
      [592, 0.4], [600, 0.46], [602.5, 0.24],            // the prestissimo: pp, but the plate is at a rolling boil (churn 1.2-1.45), and it must show
      [606, 0.2], [612, 0.6], [614, 1], [628.6, 1],      // the stretta to the end
    ]) },

  // ===== the drops =====
  { id: 'knock-drop-1', start: 3.3, end: 40.4, track: 3, fade: 0.2, widget: 'leidenfrost', listen: 'picks:knocks',
    knobs: DROP({ erratic: 0.32, boil: 0.3, steam: 0.5 }) },
  { id: 'knock-drop-2', start: 173.85, end: 212.4, track: 3, fade: 0.2, widget: 'leidenfrost', listen: 'picks:knocks',
    knobs: DROP({ erratic: 0.32, boil: 0.3, steam: 0.5 }) },
  { id: 'solo-drop-1', start: 93.75, end: 174, track: 4, fade: 0.25, widget: 'leidenfrost', listen: 'picks:solo-drop',
    knobs: DROP({ plate: 0.3, erratic: 0.3, boil: 0.15, steam: 0.45 }) },
  { id: 'solo-drop-2', start: 253.05, end: 264.5, track: 4, fade: 0.25, widget: 'leidenfrost', listen: 'picks:solo-drop',
    knobs: DROP({ plate: 0.3, erratic: 0.25, boil: 0.1, steam: 0.4 }) },
  // The friska's water is poured anew at three turns of the form, each on a real note: the F# tune's end (455.9), the high
  // whirl's loud C#6 (500.72, as the stomp drop leaves: at 481.44 the new drop stacked on the stomp drop in the middle), the
  // spray (527.13). The headless check (scratchpad sim of the widget) showed one clip
  // over 363-570 always splitting its water down to nothing by ~450 and ~505, and an empty plate refills with a drop no note
  // brought. A fresh clip starts with ONE big drop at its first note: new water on the plate, on a real attack.
  ...[[363.55, 455.88], [455.88, 500.7], [500.7, 527.11], [527.11, 570.45]].map(([s, e], i) => (
    { id: `friska-drops-${i + 1}`, start: s, end: e, region: ZOOM(1.15), track: 4, fade: i ? 0.2 : 0.3, widget: 'leidenfrost', listen: 'picks:friska-top',
      knobs: DROP({ plate: i ? 0 : 0.32, erratic: 0.28, boil: 0.15, steam: 0.35 }) })),
  { id: 'tremolo-drops', start: 570.5, end: 584.3, track: 4, fade: 0.8, widget: 'leidenfrost', listen: 'picks:friska-top',
    region: ZOOM(1.15), knobs: DROP({ erratic: 0.6, boil: 0.3, steam: 0.5 }) },
  ...[[410.4, 421.4], [480.6, 500.6], [539.3, 570.6], [611.9, 628.6]].map(([s, e], i) => (
    { id: `stomp-drop-${i + 1}`, start: s, end: e, track: 5, fade: 0.4, widget: 'leidenfrost', listen: 'picks:stomps', region: ZOOM(1.7),
      knobs: DROP({ boil: 0, erratic: 0.3, steam: 0.8 }) })),

  // The A-major song's violin tune: ONE calm drop on the cool pearl (the solo voice's drop again; on a cool plate it no longer
  // skates: no boil, no burst, a slow drift, each note a soft nudge). No zoom: at 1.25 it drifted to the edge and was cut in half.
  { id: 'song-drop', start: 265.4, end: 307.2, track: 3, fade: 1, widget: 'leidenfrost', listen: 'picks:song-drop',
    knobs: DROP({ push: 0.3, boil: 0, erratic: 0.12, steam: 0.2 }) },

  // ===== the steam flees =====
  { id: 'steam-flees', start: 583.8, end: 604.5, track: 6, fade: 1.2, widget: 'flee', listen: 'all', knobs: { pal: 2 },
    intensity: iv([[583.8, 0.85], [592, 1], [602.5, 1], [604.5, 0.4]]) },

  // ===== the real ff blows =====
  // The critic's pass: ember red only for the Lento's deep strokes (on a low sea, where red reads); every ff tutti is a BLUE
  // flame (hue 0.55, amber's complement: the plate is now hot enough to burn blue). Red over full amber turned to pink fog.
  // The friska tuttis' smoke hangs shorter (linger 0.25) so it doesn't build into a brown haze; the 620.5 blow keeps 1.
  ...[[8.5, 22, 0.6, 'red'], [76.5, 92.6, 0], [174.5, 194, 0.6, 'red'], [246.3, 251.5, 0], [410.3, 422, 0.6, 'short'], [482.3, 501, 0.6, 'short'],
    [529.5, 570.4, 0.6, 'short'], [615.3, 628.6]]
    .map(([s, e, fade, kind], i) => ({ id: `ff-${i + 1}`, start: s, end: e, track: 7, fade: fade ?? 0.6, widget: 'fireworks',
      listen: 'picks:ff-real', knobs: kind === 'red' ? { hue: 0.015, range: 0.12, swirl: 0.6, size: 1.2 }
        : { hue: 0.55, range: 0.1, swirl: 0.6, size: 1.2, ...(kind === 'short' ? { linger: 0.25 } : {}) } })),
];

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Liszt: Hungarian Rhapsody No. 2 · B "Hot plate": a Perlin molten surface whose temperature is the form (amber lassan, pearl song, indigo dissolve, amber friska boiling with the measured tempo), Leidenfrost drops for the knocks, the solo voice, the friska\'s high line and the stomps, Flee as steam on the prestissimo, Fireworks on the real ff blows',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips; ` + Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ') + `; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
