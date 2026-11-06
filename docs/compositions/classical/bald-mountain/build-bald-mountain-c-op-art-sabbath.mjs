// Builds shows/bald-mountain-c-op-art-sabbath.json: show C "Op-art sabbath" on Mussorgsky's Night on Bald Mountain.
// Run from the worktree root: node_modules/.bin/tsx docs/compositions/classical/bald-mountain/build-bald-mountain-c-op-art-sabbath.mjs
//
// THE CONCEPT: one Bridget Riley stripe field (riley) carries the whole night, alone or with one of its three untested
// partners, each on its own strand:
//   riley      <- every note (the night); the church bell's strokes (a second Riley, rings); every note at dawn
//   fifths     <- Chernabog's chords: tutti attacks of 3+ notes at velocity >= 85 in the brass passages (derived below,
//                 set `chernabog`). It is drawn with 'lighten', so it only shows through Riley's BLACK bands: a stencil.
//   timeslice  <- the sabbath dance (melody picks): its now line follows the tune, the stripes break into staircases
//   pixelsort  <- the climaxes (set `tears`: the 20 biggest blows, the A blow, the Eb and A major climaxes, the last
//                 hammering) and, separately, the 30 hammer strokes (set `hammer-strokes`)
//
// PLAN (sections from ANALYSIS.md; "presence" = riley's how-present curve, intensityMoves "present": low = a few broad,
// clean bands, high = the full fine field bending and fizzing; it follows the arc, not the loudness alone):
//   0-2       black (real silence).
//   2-16.3    out of silence: Riley fades in with the pp trill (opacity 0 -> 1 over 2.0-3.3), broad (presence 0.3); the
//             whirl bends it.                                                                          [riley]
//   16.3      brass blast I: hard switch to the live presence curve on the F blow; Chernabog's chords glow through the
//             black bands.                                                                  [riley + fifths]
//   30.6-40.3 the D pedal: broad bands, lenses on every low D.                                          [riley]
//   41.10     THE A BLOW: the first tear (the A major tutti chord), the stripes snap fine, and at 42.45, where the
//             orchestra cuts the chord off, the picture is CUT TO BLACK (fade 0). The general pause is true black.
//   45-61.1   the trill again out of the black, then whirl II (opacity ramp, presence 0.35).                 [riley]
//   61.1-92   blast II, the diminished pulses (the spirits gathering: the tritones glow VIOLET through the bands, the
//             bass swells lenses, presence climbing to 1), the hammering on A and D.          [riley + fifths + tears]
//   92-117.8  the shrieks over the D pedal: Riley alone, broad and breathing.                            [riley]
//   117.8-156 outburst, dialogue, Bb strikes, the bassless high figure (no lenses: the field goes flat but for ripples).
//   156-161   the Bb hammer: presence 1, the lenses swell on every Bb1.
//   161.4-172 the low wind hush, the darkest sound: presence 0.08, a few broad bands.                    [riley]
//   172-208   build, the Eb glorification of Chernabog (fifths, tears), subsiding.
//   208-235.5 the hush, then the C# minor crescendo: presence 0.1 -> 0.85.
//   235-336.5 THE SABBATH: time slice (columns) over the stripes on the dance tune; tears on the peaks (258.40, 282.55);
//             the 30 hammer strokes (298.7-307.4) tear the field stroke by stroke (a second pixel sort, short life).
//                                                                      [riley + fifths + timeslice + pixelsort]
//   336-351   the ostinato: time slice leaves; fifths on the brass calls (from 343.5).
//   351-394   A major climax to the D blow: time slice comes back in RINGS (a target cut in time), all four together
//             at the climax.                                                [riley + fifths + timeslice + pixelsort]
//   394-404   the D pedal recalled: Riley alone, broad.
//   404-440.4 the final build on D: fifths' web thickens, the last hammering and the last chord (438.04) tear the field;
//             at 440.36 THE NIGHT BREAKS OFF: cut to black (fade 0) while the soft D chord dies.
//   441.8-466 THE BELL: a second Riley, in RINGS, seen only through a round window on black, hears only the 11 bell
//             strokes (from the audio; boosted x2): each stroke swells a lens and sends a ripple through the rings.
//             The partners are gone.                                                         [riley (bell)]
//   462.9-578.5 DAYBREAK: Riley's stripes return broad and almost still, and for the first time in COLOUR: ink blue and
//             ochre (colours 3), the first light. The presence curve breathes once per chromatic rise (8 rises): the
//             bands narrow and bend a little as each rise climbs, and settle back. FOUND IN PREVIEW: as the bell's rings
//             fade (462.9-466) they lie over the returning dawn bands, a moire of rings on stripes, the bell dissolving
//             into the day. Harp and the wind solo: Riley alone. The last chord fades to black over 577-579. [riley (dawn)]
//
// KNOBS moved from our defaults, each for the concept:
//   riley (bell)  pattern 2 (rings: the bell's shape), presence 0.6 (rings broad enough to read in a small window)
//   riley (dawn)  colours 3 (ink blue / ochre: the daybreak), presence via the curve
//   riley (opening, whirl II) presence 0.3 / 0.35 (a fixed broad field while the opacity ramps in)
//   fifths        line 1.8, fill 0.4: at the defaults the web was hairlines that the stripes swallowed (preview 1); the
//                 stencil must glow. The Eb glorification: fill 0.6, line 2.2, Chernabog's chords as lit coloured shapes
//   riley (night) the ostinato (336-351) at presence 0.35: at 0.5 the held A/D pedal swelled one white disc over the screen
//   timeslice     mode 2 for the A major climax (rings: the field becomes a target cut in time)
//   pixelsort     own 0.08 and pick 0: the stripes torn into solid grey and white bars, almost no colour of its own
//                 (the combos row: keep riley black and white); band 1.5, len 1.0 (the combos row's "worth trying");
//                 hammer strokes: life 0.45, band 1, so each of the 30 strokes flicks instead of piling into a sheet.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'bald-mountain-c-op-art-sabbath', SONG = 'bald-mountain';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const r3 = (v) => Math.round(v * 1000) / 1000;
const set = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [r3(n[0]), r3(n[1]), n[2], n[3]]); };
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const dedupe = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0] || a[2] - b[2])) if (!out.some((d) => d[2] === n[2] && Math.abs(d[0] - n[0]) < 0.04)) out.push(n);
  return out;
};

// ---------- chernabog: the tutti chords of the brass passages, for fifths ----------
// Every note the pack has (piano-model roll and the YourMT3+ tracks), grouped into attacks (< 40 ms); an attack is a
// chord when it holds 3+ distinct notes and its loudest is >= 85. Attacks closer than 0.2 s keep the first. Notes are
// held at least 0.35 s so the polygon is seen.
const ALL = [...pack.notes, ...Object.values(pack.tracks).flatMap((t) => t.notes)].map((n) => [n[0], n[1], n[2], n[3]]).sort((a, b) => a[0] - b[0]);
const attacks = [];
for (const n of ALL) { const l = attacks[attacks.length - 1]; if (l && n[0] - l[0][0] < 0.04) l.push(n); else attacks.push([n]); }
const SPANS = [[16.1, 30.6], [60.5, 92], [117.8, 129.8], [180.3, 190.4], [235.5, 299], [343.5, 364], [404, 440.3]];
const chern = [];
let lastT = -9;
for (const a of attacks) {
  const t = a[0][0];
  if (!SPANS.some(([s, e]) => t >= s && t < e)) continue;
  const ms = [...new Map(a.map((n) => [n[2], n])).values()];
  const vmax = Math.max(...ms.map((n) => n[3]));
  if (ms.length < 3 || vmax < 85 || t - lastT < 0.2) continue;
  lastT = t;
  for (const n of ms) chern.push([r3(t), r3(Math.max(t + 0.35, n[1])), n[2], n[3]]);
}
chern.sort((a, b) => a[0] - b[0] || a[2] - b[2]);

// ---------- tears: the climaxes, for pixel sort ----------
const tears = dedupe([
  ...set('ff-peaks'), ...set('a-blow'), ...set('eb-climax').filter((n) => n[3] >= 94), ...set('a-major-climax'),
  ...within(set('final-build'), 430.4, 438.1).filter((n) => n[3] >= 85),
]).filter((n) => n[0] >= 40.9 && n[0] < 440.3);

// ---------- the bell: 11 strokes from the audio, D2 + D4, boosted (they are v35-41, -28 to -33 dB) ----------
const bell = set('church-bell').map((n) => withValues(n, { intensity: 2 }));

// ---------- clips ----------
const iv = (pts) => pts.map(([t, v, s]) => (s ? { t, v, shape: s } : { t, v }));
const BELL_WINDOW = { mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w: 0.5625, h: 1, feather: 0.3, fit: 'cover' };
const HUSH1 = 161.3, EB = 180.3, HUSH2 = 208.2, SABBATH = 235.5;
const TS_SABBATH = [SABBATH, 336.5], TS_CLIMAX = [350.5, 394];
// Dawn: the night's standing stripes LIE DOWN. Riley is drawn alone and fitted into a box twice the picture, turned 90
// degrees: the bands are horizontal (a horizon) and twice as broad (a few calm bands, which stripe's 60 maximum cannot give).
const DAWN_WINDOW = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 2, h: 2, rot: 90, feather: 0, blend: 'over', fit: 'cover' };

const clips = [
  // ---- Riley, the night (track 0) ----
  { id: 'riley-opening', start: 2, end: 16.3, track: 5, fade: 0, widget: 'riley', knobs: { presence: 0.3 },
    intensity: iv([[2, 0, 'ease'], [3.3, 1]]) },
  { id: 'riley-part-1', start: 16.3, end: 42.45, track: 5, fade: 0, widget: 'riley', intensityMoves: 'present',
    intensity: iv([[16.3, 0.55], [20.6, 0.8], [25, 0.6], [28.9, 0.65], [30.6, 0.3], [37.8, 0.2], [40.2, 0.3], [41.1, 1]]) },
  // 42.45-45.0: black. The orchestra cuts the A chord off; the general pause.
  { id: 'riley-whirl-2', start: 45, end: 61.1, track: 5, fade: 0, widget: 'riley', knobs: { presence: 0.35 },
    intensity: iv([[45, 0, 'ease'], [46.9, 1]]) },
  // The night field in three pieces: the two hushes take it away (see the slits below).
  { id: 'riley-night', start: 61.1, end: HUSH1, track: 5, fade: 0, widget: 'riley', intensityMoves: 'present',
    intensity: iv([
      [61.1, 0.6], [64.7, 0.75], [69.4, 0.7], [73.2, 0.5], [83.6, 0.85], [86, 1], [91.6, 0.9], [92.5, 0.3], [112, 0.35],
      [115, 0.35], [117.8, 0.55], [120, 0.9], [129.8, 0.6], [140.5, 0.7], [141.7, 0.9], [146, 0.55], [151.9, 0.75],
      [156.3, 1],
    ]) },
  { id: 'riley-glorification', start: EB, end: HUSH2, track: 5, fade: 0, widget: 'riley', intensityMoves: 'present',
    intensity: iv([[EB, 0.8], [183.6, 1], [190.4, 0.75], [205.4, 0.55]]) },
  { id: 'riley-sabbath', start: SABBATH, end: 440.36, track: 5, fade: 0, widget: 'riley', intensityMoves: 'present',
    intensity: iv([
      [SABBATH, 0.85], [258.4, 1], [276, 0.85], [282.5, 1], [298.7, 1], [307.4, 0.8],
      [322.5, 0.85], [336, 0.35], [349, 0.4], [351, 0.85], [353.5, 1], [363.8, 0.7], [372, 1], [388.8, 1, 'ease'], [393.7, 0.25],
      [404, 0.25], [414, 0.45], [430.9, 0.9], [438, 1],
    ]) },
  // 440.36-441.8: black. The night breaks off while the soft D chord dies.

  // ---- THE HUSHES: the field is taken away and rebuilt slit by slit (tracks 0-4, under the field) ----
  // Low wind hush (161.3, where the Bb hammer's last stroke drops 15 dB in half a second): the whole field is cut to ONE
  // vertical slit of night, the darkest sound. The build's whirls (172.3, 176.3) each open a pair more; on the Eb climax
  // (180.3) the full field slams back. The C# minor hush (208.2, one soft held line) is the same gesture turned on its
  // side: one horizontal slot, and the crescendo's whirls (217.1, 225.3) open a pair more each, until the sabbath (235.5).
  // Each slit is its own Riley seen through a mask (spot), so the slots are windows onto a field that is not all there yet.
  ...[
    [0, HUSH1, [0.5]], [1, 172.3, [0.36, 0.64]], [3, 176.3, [0.22, 0.78]],
  ].flatMap(([k, s, xs]) => xs.map((xc, j) => ({
    id: `riley-slit-${k + j + 1}`, start: s, end: EB, track: k + j, fade: 0, widget: 'riley', knobs: { presence: 0.5 },
    region: { mode: 'spot', shape: 'rect', x: xc, y: 0.5, w: 0.06, h: 1, feather: 0.3 },
  }))),
  ...[
    [0, HUSH2, [0.5], 0.07], [1, 217.1, [0.36, 0.64], 0.08], [3, 225.3, [0.22, 0.78], 0.09],
  ].flatMap(([k, s, ys, h]) => ys.map((yc, j) => ({
    id: `riley-slot-${k + j + 1}`, start: s, end: SABBATH, track: k + j, fade: 0, widget: 'riley', knobs: { presence: 0.6 },
    region: { mode: 'spot', shape: 'rect', x: 0.5, y: yc, w: 1, h, feather: 0.3 },
  }))),

  // ---- the bell: a second Riley in rings, through a round window (track 1) ----
  { id: 'riley-bell', start: 441.8, end: 466, track: 6, fade: 2, widget: 'riley', listen: 'picks:church-bell',
    knobs: { pattern: 2, presence: 0.6 }, region: BELL_WINDOW },

  // ---- dawn: ink blue and ochre, broad, breathing once per rise (track 0) ----
  { id: 'riley-dawn', start: 462.9, end: 579, track: 5, fade: 2.5, widget: 'riley', knobs: { colours: 3 }, region: DAWN_WINDOW, intensityMoves: 'present',
    intensity: iv([
      [462.9, 0.15], [463.1, 0.15, 'ease'], [468, 0.32, 'ease'], [471.6, 0.18, 'ease'], [476.5, 0.34, 'ease'],
      [479.2, 0.2, 'ease'], [483.5, 0.36, 'ease'], [485.3, 0.22, 'ease'], [488.8, 0.45, 'ease'], [491, 0.3],
      [497.1, 0.2, 'ease'], [499.9, 0.18, 'ease'], [505, 0.33, 'ease'], [509.4, 0.2, 'ease'], [514.5, 0.35, 'ease'],
      [517.2, 0.22, 'ease'], [522, 0.37, 'ease'], [524.8, 0.24, 'ease'], [529.5, 0.48, 'ease'], [532, 0.3],
      [539.2, 0.2, 'ease'], [541, 0.15], [567.9, 0.15, 'ease'], [571.5, 0.22], [575.4, 0.25, 'ease'], [577, 0.15],
    ]) },

  // ---- fifths: Chernabog's chords glowing through the black bands (track 1) ----
  ...[[15.8, 31], [60.3, 92.3], [117.5, 130.2], [EB, 191.2], [SABBATH, 299.5], [343, 364.5], [403.5, 440.36]].map(([s, e], i) => ({
    id: `fifths-${i + 1}`, start: s, end: e, track: 7, fade: e === 440.36 ? 0.3 : 1, widget: 'fifths', listen: 'picks:chernabog',
    knobs: s === EB ? { fill: 0.6, line: 2.2 } : { fill: 0.4, line: 1.8 },
  })),

  // ---- time slice: the sabbath dance (track 2) ----
  { id: 'timeslice-sabbath', start: TS_SABBATH[0], end: TS_SABBATH[1], track: 8, fade: 1.5, widget: 'timeslice', listen: 'picks:melody' },
  { id: 'timeslice-climax', start: TS_CLIMAX[0], end: TS_CLIMAX[1], track: 8, fade: 1, widget: 'timeslice', listen: 'picks:melody',
    knobs: { mode: 2 } },
  // (A gentle time slice in rows on the dawn rises was tried in previews 1 and 2 and dropped: even at far 0.6 the rows
  // shredded the dawn bands into horizontal tears and ghost doubles. The dawn is Riley alone, as the concept says.)

  // ---- pixel sort: the climaxes tear the field (track 3), the hammer strokes (track 4) ----
  // the first tear ends with the cut to black at 42.45 (its held melt would otherwise sort grey bars into the pause)
  ...[[40.5, 42.45], [60.3, 440.36]].map(([s, e], i) => ({ id: `pixelsort-tears-${i + 1}`, start: s, end: e, track: 9, fade: 0,
    widget: 'pixelsort', listen: 'picks:tears', knobs: { own: 0.08, pick: 0, band: 1.5, len: 1 } })),
  { id: 'pixelsort-hammer', start: 298.4, end: 308, track: 10, fade: 0.2, widget: 'pixelsort', listen: 'picks:hammer-strokes',
    knobs: { own: 0.08, pick: 0, band: 1, len: 0.8, life: 0.45 } },
];

const melody = set('melody').filter((n) => (n[0] >= TS_SABBATH[0] + 1.5 && n[0] < TS_SABBATH[1] - 0.3) || (n[0] >= TS_CLIMAX[0] + 1 && n[0] < TS_CLIMAX[1] - 0.3));
const picks = {
  chernabog: { notes: chern },
  tears: { notes: tears },
  'hammer-strokes': { notes: within(set('hammer-strokes'), 298.6, 307.7) },
  melody: { notes: melody },
  'church-bell': { notes: bell },
};

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Night on Bald Mountain · C "Op-art sabbath": one Riley stripe field carries the night, Chernabog\'s chords glowing through its black bands (fifths), the sabbath dance slicing it in time (time slice), the climaxes tearing it into grey bars (pixel sort); the bell a ring of Riley in the dark, the dawn its first colour',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
const per = SPANS.map(([s, e]) => `${s}-${e}: ${new Set(within(chern, s, e).map((n) => n[0])).size}`).join(', ');
console.log(`${ID}: ${clips.length} clips; chernabog ${chern.length} notes (${per}); tears ${tears.length}; melody ${melody.length}; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
