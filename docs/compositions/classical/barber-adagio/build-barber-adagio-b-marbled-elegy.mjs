// Builds shows/barber-adagio-b-marbled-elegy.json from picks.json (this folder) and the plan below.
// Run: node_modules/.bin/tsx docs/compositions/classical/barber-adagio/build-barber-adagio-b-marbled-elegy.mjs
//
// THE PLAN ("Marbled elegy": marbling, vine, fold, pixel sort)
// One bath of ink, one mirror, one living line, one tear.
//  - The bath (marbling, track 0) hears the chant: every note of the lead line drops ink and pushes the older ink outward
//    into bands. Drop size follows loudness (per-note intensity lifts the pp opening, whose velocities are 17-48), each
//    theme head (the long Bb that opens a statement) is the biggest drop of its phrase, so every statement opens with a
//    bloom that pushes the last one out like a turned page. Ink: blood and bone; in the dark middle (199.6-257.5 s) the
//    chant drains to slate (indigo palette); the inner voices (the lower strings' entrance, the stretto's cell in the
//    violas and cellos) are slate drops among the red. The untranscribed swell (267-275 s) is five audio chord changes.
//  - The mirror (fold, on top of everything) is the second voice: the first drop (the long Bb4) lies alone on the black,
//    and the mirror appears at 3.95 s, when the lower strings slip in under it. Its line turns with the bass (home F
//    upright, the Gb bass lays it almost flat), its gold seam is the gutter of an open book: a marbled endpaper. Its
//    strength grows over the first half minute. In the stretto every voice that enters with the cell adds a mirror
//    (2, 3, 4 folds); the climax's first chord opens it into a six-fold rosette, which then unfolds with the chord
//    changes (4, 2) and opens to one mirror, the open book, on the fff arrival. The mirrored vine reads as the
//    endpaper's ornament: tendrils that curl symmetrically about the gutter (found in the preview, kept).
//  - The living line (vine, a full-frame window, blend lighten) hears the low strings: the cello track's line, the bass
//    line and the dark middle's low strophe. Born with the lower strings' entrance (3.95 s), it creeps on each long bass
//    note, leads in the dark middle where the marble is sparse and cold (it hardly withers there), becomes a thicket in
//    the stretto (the cellos sing the cell), and withers through the climax, where no low voice is heard. It is hidden,
//    alive, through the silence (normal intensity 0: frames still run) and grows back from its remnants on the hymn's
//    sinking bass. (Not intensityMoves: only a normal curve can hide it through the silence and keep its state; its
//    growth moves per note instead: spread, branch, wither.)
//  - The tear (pixel sort, only 328.6-353.0 s, ABOVE the fold since the critic pass: the tears break the symmetry) hears the climax's chord
//    changes (audio, with the chroma's inner notes) and the one fff arrival, whose melt holds (life 3).
//  - 353.0 s: every clip ends, fade 0: the cut-off is black (the shared fade empties the screen in a quarter second).
//  - The hymn: a new bath, drawn in lines, the colours by pitch class (a rainbow round the circle of fifths), so each of
//    the seven chords in its far keys (Cb, Fb, A, D, Bm, C, F) rings in its own colour. No mirror: the mirror broke.
//  - The reprise (382.28 s, the long Bb4 again, in octaves): the ink turns solid blood and bone on that note, and the
//    mirror returns with it (the octave doubling is the reflection). Through the coda the mirror fades (strength), the
//    seam goes out, the vine withers; the last chord (F over F, 455.4) stands the mirror upright on the fold's home, F,
//    the dominant: suspended, not resolved. Black at 465.4.
//
// Weights per stretch (0..1; what each thread shows):
// | s        | bath (marbling)        | mirror (fold)          | vine (cello)       | tear |
// | 0-21     | 0.4 one drop, beads    | 0 -> 0.6 from 3.95     | 0.1 one shoot      | 0    |
// | 21-86    | 0.6 bands fill         | 0.7 -> 1               | 0.3 creeps         | 0    |
// | 86-200   | 0.8 swells flood       | 1 (loud chords +1 fold)| 0.5                | 0    |
// | 200-257  | 0.6 slate, calm comb   | 0.9                    | 1 leads            | 0    |
// | 257-303  | 0.9 swell, waves       | 1                      | 0.6                | 0    |
// | 303-315  | 1 + slate cells        | 2 -> 4 folds           | 0.9 thicket        | 0    |
// | 315-346  | 1 beads, raked, swirl  | 4, 6, 2 (upright cross)| withering          | 1    |
// | 346-353  | arrival, swirl         | 2 (four-way blazon)    | withering          | 1    |
// | 353-356.5| black                  | -                      | hidden             | -    |
// | 356.5-384| 0.5 lines, by fifths (own clip, dissolves) | 0 | 0.7 regrows | 0    |
// | 382-426  | 0.8 solid, a fresh bath| 1                      | 0.5                | 0    |
// | 426-465  | 0.5, verdigris+ash 448 | 0.7 -> 0.3             | 0.3 withers        | 0    |
// CRITIC PASS (2026-11-06): see the CRITIC comments; two full previews. Legend: barber-adagio-b-marbled-elegy.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'barber-adagio-b-marbled-elegy', SONG = 'barber-adagio';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const S = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const win = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Merge note lists, sorted; a note with the same pitch starting within 30 ms of one already kept is dropped. */
function merge(...lists) {
  const all = lists.flat().map((n) => [...n]).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const out = [];
  for (const n of all) {
    let dup = false;
    for (let k = out.length - 1; k >= 0 && n[0] - out[k][0] < 0.03; k--) if (out[k][2] === n[2]) { dup = true; break; }
    if (!dup) out.push(n);
  }
  return out;
}
/** Piecewise-linear curve through [t, value] points, flat outside. */
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, a] = pts[i - 1], [t1, b] = pts[i]; return a + (b - a) * (t - t0) / (t1 - t0); }
  return pts[pts.length - 1][1];
};
const step = (pts) => (t) => { let v = pts[0][1]; for (const [t0, x] of pts) if (t >= t0) v = x; return v; };
const vals = (ns, fn) => ns.map((n, i) => withValues([n[0], n[1], n[2], n[3]], fn(n, i, ns)));
const piv = (pts) => pts.map(([t, v, shape]) => ({ t: r3(t), v: Math.round(v * 1000) / 1000, ...(shape ? { shape } : {}) }));

const CUT = 353.0, HYMN = 356.45, REPRISE = 382.2, END = 465.4;

// ---------------- audio-derived notes (librosa on songs/barber-adagio/audio.mp3, chroma per 0.5 s + top CQT bins) ----
// The untranscribed swell 266.5-275.1 s: one note per chord change, the top bin, velocity from the level
// (v = 133.8 + 3.76 dB, the analysis' fit): C5 over F minor (267.1), F5 at the peak (268.15, -13.6 dB), Eb5 as the
// Ab/F/Cb chord comes (270.06), Cb5 (271.5), Bb4 on the Bb7 (274.4).
const SWELL = [[267.09, 268.15, 72, 60], [268.15, 270.0, 77, 82], [270.06, 271.5, 75, 68], [271.5, 274.38, 71, 66], [274.38, 275.1, 70, 68]];
// The climax's chord changes (climax-line, audio) with their inner notes from the chroma the analysis measured
// (330.2 F# Bb C# G, 332.8 Eb Bb C, 333.8 Bb B C# F, 336.9 B Bb G F#, 342.7 Eb enters), the first chord (Eb6 + Eb5,
// 328.79, the ascent's octaves) and the arrival (Ab5 + Ab6 from the pick set, G and Eb from its chroma, 346.21).
const CLIMAX = [
  [328.79, 329.65, [87, 75], 113],
  [330.23, 332.81, [90, 73, 70, 66], 112],
  [332.81, 333.83, [94, 72, 70, 63], 115],
  [333.83, 336.9, [94, 73, 71, 65], 113],
  [336.9, 342.67, [94, 71, 67, 66], 110],
  [342.67, 345.5, [94, 70, 67, 63], 104],
  [346.21, CUT, [92, 80, 67, 63], 120],
].flatMap(([s, e, ms, v]) => ms.map((m) => [s, e, m, v])).sort((a, b) => a[0] - b[0] || a[2] - b[2]);

const sets = {}, clips = [];
const clip = (c) => clips.push({ id: `c${clips.length + 1}`, ...c, start: r3(c.start), end: r3(c.end) });

// ======================= the bath: marbling =======================
// The heard velocity is lifted by a constant (not multiplied), so the pp opening's steps stay steps and its crest
// (Eb5, 20.1 s) is no flood. Climax drops are smaller than loud: a fff flood rinses the bath black (round 1).
const LIFT = curve([[0, 28], [80, 28], [90, 12], [160, 12], [199, 20], [257, 20], [262, 8], [300, 6], [315, 0]]);
const lift = (t, v) => clamp((v + LIFT(t)) / v, 1, 2);
const DROP = curve([[0, 1.3], [70, 1.3], [86, 1.25], [100, 1.15], [199, 1.4], [257, 1.15], [303, 1.05], [328, 0.9], [345, 0.9]]);
const COMB = curve([[0, 0.5], [86, 0.6], [199, 0.3], [257, 0.6], [303, 0.9], [328, 1.3]]);
const heads = new Set(S('theme-heads').map((n) => n[0]));
const inner = new Set([...S('stretto-cells'), ...S('audio-fills').filter((n) => n[0] < 10)].map((n) => `${n[0]}:${n[2]}`));
const ink1 = merge(win(S('melody'), 0, 330), S('audio-fills').filter((n) => n[0] < 10), S('stretto-cells'), SWELL, CLIMAX);
sets.ink = vals(ink1, (n) => {
  const t = n[0], head = heads.has(t), slate = inner.has(`${t}:${n[2]}`) || (t >= 199.5 && t < 257.5);
  return {
    intensity: lift(t, n[3]),
    // The climax's chord changes are beads, not floods (round 2: floods rinsed the rosette down to a small flower):
    // they press the stretto's and the ascent's ink into thin bands, and the swirl turns the bath through the held
    // chord (336.9-342.7), movement without a new attack.
    drop: head ? 1.8 : t >= 346 ? 1.6 : t >= 336.5 ? 1.05 : t >= 333.8 ? 1.45 : t >= 330 ? 0.6 : DROP(t),
    twist: t >= 346 ? 0.9 : t >= 328.7 ? 0.5 : 0.1,
    combing: t >= 346 ? 1.5 : COMB(t),
    palette: slate ? 1 : 0,
    fill: 0.8,
  };
});
clip({ start: 0.85, end: CUT, track: 0, fade: 0, widget: 'marbling', listen: 'picks:ink' });

// After the silence: a new bath. The hymn in lines, coloured by pitch class; the reprise solid blood and bone again.
const GAIN2 = curve([[356, 2], [376, 2], [382, 1.5], [426, 1.7], [448, 1.6], [456, 2]]);
const hymn = S('hymn-chords');
const twin = win(S('octave-doublings'), 380, 430);
const ink2 = merge(hymn, win(S('melody'), 380, 470), twin, S('last-chords'));
const bath2 = (n) => {
  const t = n[0], h = t < 380;
  return {
    intensity: clamp(GAIN2(t), 0, 2),
    drop: h ? 1.15 : heads.has(t) ? 1.8 : t >= 448 ? 1.6 : 1.3,
    combing: h ? 0.12 : 0.45,
    // CRITIC: the last chords (448.5, 455.4) drop verdigris and ash, the one palette the show has kept back: the blood
    // is pushed outward by grey-green ink, the endpaper going to ash as the music dies (it was concentric red targets).
    palette: h ? 3 : t >= 448 ? 2 : 0,
    fill: h ? 0.05 : 0.8,
    ...(t >= 426 && !h ? { combing: 0.75, twist: 0.35 } : {}),
  };
};
// CRITIC: two baths, not one. In one bath the reprise's fill 0.8 (read every frame) filled every hymn line-ring solid at
// 382.28: green and magenta blobs for ~6 s, an event no note made. Now the hymn (lines, by fifths) is its own clip over
// a fresh blood-and-bone bath that starts on the reprise's Bb4; the hymn dissolves over it (fade 1.5) as the head blooms.
sets.ink2 = vals(ink2.filter((n) => n[0] < 380), (n) => bath2(n));
sets.ink3 = vals(ink2.filter((n) => n[0] >= 380), (n) => bath2(n));
clip({ start: HYMN, end: 384.3, track: 1, fade: 1.5, widget: 'marbling', listen: 'picks:ink2' });
clip({ start: REPRISE, end: END, track: 0, fade: 0, widget: 'marbling', listen: 'picks:ink3',
  intensity: piv([[REPRISE, 1], [455.4, 1], [END, 0.25, 'ease']]) });

// ======================= the living line: vine on the cello =======================
const VG = curve([[0, 2], [21, 2], [86, 1.3], [199, 1.7], [257, 1.2], [300, 1], [356, 2], [440, 2]]);
const SPREAD = curve([[21, 0.7], [86, 1], [199, 1.4], [257, 1.1], [303, 1.5], [316, 1], [356, 1.3], [426, 0.8]]);
const BRANCH = curve([[21, 0.3], [86, 0.45], [199, 0.65], [257, 0.5], [303, 0.85], [316, 0.5], [356, 0.55], [426, 0.3]]);
const WITHER = curve([[21, 0.6], [190, 0.5], [199, 0.15], [257, 0.2], [262, 1], [356, 0.7], [426, 1.6]]);
// The low strings: the cello track's line, the bass line (cellos and basses) and, in the dark middle, the low strophe
// (long low notes, the cellos' rising cell, the violas' rocking), which is where the vine leads (round 2: on the cello
// track alone it had 9 notes in 58 s there and withered before it was seen).
const cello = merge(S('cello-line'), S('bass-line'), win(S('low-strophe'), 199.5, 257.5), S('last-chords').filter((n) => n[2] < 50));
sets['low-strings'] = vals(cello, (n) => ({ intensity: clamp(VG(n[0]), 0, 2), spread: SPREAD(n[0]), branch: BRANCH(n[0]), wither: WITHER(n[0]) }));
clip({ start: 3.9, end: END, track: 2, fade: 0.5, widget: 'vine', listen: 'picks:low-strings', knobs: { weight: 3.2 },
  // lighten, not see-through: the see-through stamp lifted the vine's near-black ground to a brown veil over the whole bath
  region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch', blend: 'lighten' },
  intensity: piv([[3.9, 1, 'hold'], [CUT, 0, 'hold'], [HYMN, 1], [448, 1], [END, 0.3]]) });

// ======================= the mirror: fold =======================
// Strength grows from a ghost (the lower strings' entrance) to full by 30 s; the folds multiply with the stretto's entries.
// From the held chord on, the mirror is a strong ghost, not an eraser: at full strength it laid the black of the source half
// over the climax's high ink in the other half, and the arrival went mostly black (round 4).
// CRITIC: from the held chord on the mirror is crisp again (0.95), on an axis that stands still (turn 0), see HELD below.
const STR = (t) => (t >= 336.85 ? 0.95 : curve([[3.9, 0.7], [21, 0.85], [30, 1]])(t));
// The arrival (346.21, the one fff blow) collapses the rosette back to one mirror: the open book, held, then cut.
// The fold only ever mirrors from the lower half (its source wedge starts on the line, turning clockwise), while the
// climax's high chords drop their ink high: so the rosette unfolds as the climax opens out (round 3: at six folds the held
// chord's picture went black). Folded in by the stretto's entries, it opens 6 -> 4 -> 2 on the chord changes and to the
// one mirror, an open book, on the arrival.
// CRITIC: the 4-fold step at 333.8 copied an empty wedge (black at 334.5-336.8, inside the fff), and the 2-fold and
// 1-fold at 336.85 and 346.2, on an axis turned by the bass at strength 0.55, showed a lone half-dimmed target and a
// half-black arrival. Now: the rosette holds its six folds (and its source side: flip 0 at 333.83) through the first
// three chord changes; on the held chord (336.9) it opens to two folds on an upright cross that stands still (turn 0),
// and that chord flips the source to the upper-left quarter (flip 1; later chords flip 0), where the climax's high ink
// lands (marbling puts high notes high; the fold copies one wedge from the line). The bath's left side was full in
// every frame of round 1 from 337 to 352, so the held chord and the arrival are a four-way blazon, torn by pixel sort.
// The side is simulated from the set (every second full chord flips it at the default 0.5): side 0 at 330.23, so 1 here.
const FOLDS = step([[0, 1], [304.0, 2], [307.5, 3], [311.9, 4], [328.79, 6], [336.85, 2]]);
const HELD = (t) => (t >= 336.85 ? { turn: 0, flip: t < 337.2 ? 1 : 0 } : t >= 333.8 ? { flip: 0 } : {});
// The mirror fades to 60% when nothing louder than soft has sounded for a few seconds; soft notes are lifted towards 86
// (just below the loud-chord extra fold, at 88) so the endpaper reads as one symmetric sheet, not a double exposure:
// a weak mirror lays the black of the source half over the other half's own drops as dim ghosts (rounds 1 and 4).
const firm = (v) => (v < 86 ? Math.min(2, 86 / v) : 1);
const SEAM = curve([[3.9, 0.3], [53, 0.45], [86, 0.6], [303, 0.6], [328, 0.8]]);
const spine1 = merge(win(S('bass-line'), 0, CUT), win(S('melody'), 0, 330), win(S('cadence-chords'), 0, CUT), S('stretto-cells'), SWELL, CLIMAX,
  S('audio-fills').filter((n) => n[0] < 10));
sets.spine = vals(win(spine1, 3.9, CUT), (n) => ({ intensity: firm(n[3]), folds: FOLDS(n[0]), strength: STR(n[0]), seam: SEAM(n[0]), ...HELD(n[0]) }));
clip({ start: 3.9, end: CUT, track: 3, fade: 0, widget: 'fold', listen: 'picks:spine' });

const STR2 = curve([[382, 0.85], [403, 1], [426, 0.85], [448, 0.55], [460, 0.4]]);
const SEAM2 = curve([[382, 0.45], [426, 0.35], [448, 0.15], [460, 0.08]]);
const spine2 = merge(win(S('bass-line'), REPRISE, 470), win(S('melody'), REPRISE, 470), twin, win(S('cadence-chords'), REPRISE, 470), S('last-chords'));
sets.spine2 = vals(spine2, (n) => ({ intensity: firm(n[3]), folds: 1, strength: STR2(n[0]), seam: SEAM2(n[0]) }));
clip({ start: 382.25, end: END, track: 3, fade: 0, widget: 'fold', listen: 'picks:spine2' });

// ======================= the tear: pixel sort at the climax =======================
// CRITIC: ABOVE the fold now (it was under it, and the fold's after-pass painted most tears out: the tear could not be
// judged). The tears cut across the mirrored endpaper, so the climax breaks the symmetry, and after the silence there is
// no mirror: the mirror broke. Solid bars of the marble's own reds and bone (pick low, own low), long, wide, held; the
// fff arrival (346.21, the loudest moment of the recording) is the one widest, longest, held tear, until the cut.
sets.tear = vals(CLIMAX, (n) => (n[0] >= 346 ? { life: 3, band: 2.5, len: 1.6 } : { life: 2.2 }));
clip({ start: 328.6, end: CUT, track: 4, fade: 0, widget: 'pixelsort', listen: 'picks:tear', knobs: { own: 0.1, band: 2, len: 1.3, pick: 0.05 } });

// ======================= write =======================
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Barber: Adagio for Strings · B · Marbled elegy: the chant drops ink in a marbling bath, a fold mirrors it on a line that turns with the bass, a vine creeps on the cellos, pixel sort tears the climax',
  composer: { by: 'claude', at: new Date().toISOString() },
  clips, picks: Object.fromEntries(Object.entries(sets).map(([k, ns]) => [k, { notes: ns }])),
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
for (const [k, ns] of Object.entries(sets)) console.log(`${k}: ${ns.length} notes, ${ns[0][0]}-${ns[ns.length - 1][0]}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
console.log(`wrote shows/${ID}.json: ${clips.length} clips`);
