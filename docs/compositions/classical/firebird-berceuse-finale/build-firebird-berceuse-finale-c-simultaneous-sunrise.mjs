// Builds shows/firebird-berceuse-finale-c-simultaneous-sunrise.json from picks.json (this folder) and the plan below.
// Run: node_modules/.bin/tsx docs/compositions/classical/firebird-berceuse-finale/build-firebird-berceuse-finale-c-simultaneous-sunrise.mjs
//
// THE PLAN ("Simultaneous sunrise": delaunay, and only delaunay)
// Robert Delaunay's three discs of simultaneous colour are the whole Firebird. The hero is one painting on one set (picks:sun)
// from the lullaby's first strike to the coda's cut, played by nine instances (critic, round 4): eight windows of different
// sizes standing on the screen's bottom edge (night 0.6, swell 0.8, reprise 0.6, asleep/spell 0.48, horn 0.66, strings 0.8,
// third 0.95, crescendo 1.12), each cut on a real note, then the day at full size from the 7/4 blow. The Finale's one long
// crescendo becomes one long approach that ends in the 2x tutti (THE DOLLY, below). The story is also told by its knobs, set
// per note on its one curated set (a value holds from its attack to the next, so nothing changes without a note):
//  - contrast (Delaunay's "simultaneous contrast": a lit colour sets its complementary beside it) is the sunrise itself.
//    0.1 in the night (each note only its own colour), a first glimpse at the swell's A-major strikes, 0 in the spell,
//    then statement by statement up to 1 at the tutti.
//  - cut: big halves for the lullaby and the horn, quarters for the strings' statement, eighths for the third, sixteenths
//    from the crescendo on: "ring set against ring".
//  - turn: barely turning in the berceuse, still in the spell, then the wheel gathers speed with the hymn.
//  - memory: the lullaby's colours linger (6 s), the spell's eight frozen chords hang (8), the 7/4 stamps flash (1.2).
//  - pulse: soft swells in the night, every ring thrown outward by the 7/4 and the Maestoso (1).
// Five more delaunay instances (tutti, climb, ground, final, last) are the serendipity, each on a real event:
//  - The tutti (303.48 s): the camera falls into the painting. A 2x window of the composition's lower-right quarter, so
//    the treble disc (the hymn in octave 6) fills the right half and the arcs of the middle and bass discs fill the rest.
//  - The hush (319.1 s, subito pp, -5 to -34 dB in a second): the sky goes out within 0.35 s. Only the treble disc, seen
//    through a mask at its own place, lights up again on the violins' climb (fast-runs), a small sun on black.
//  - The 7/4 blow (324.13 s): the whole composition is back in one step, stamping.
//  - The F1 blow (348.56 s, the lowest note of the piece): a giant bass disc (a 2x window centred on it) opens under the
//    composition and throbs with the Maestoso's bass, simultaneous discs at two scales. It sinks away after the arrival
//    on B (380.74 s).
//  - 401.15 s: a hard cut to black for the one second of silence. 402.40 s: the final chord re-lights a fresh composition.
//    The chord is a roll swelling for 10 s; its strokes (audio onsets, four tones each) climb B major from B1 to B6, so the chord
//    fills the discs from the bass up to the treble, and the last stroke (412.61 s) sounds all sixteen and throws every ring
//    outward. Out at 413.3 s, before the applause. (B major's D# is the berceuse's Eb: the lullaby's tonic is the last chord's third.)
// What the previews taught (three rounds):
//  - memory is the light. At short memory the finale was as dark as the night (the glaze dominates); with the colours held
//    6-8 s they pile up statement by statement, and the tutti zoom blazes. The night stays a dim stained glass.
//  - The tutti had ~10 roll notes per line and showed bare glaze: its strokes are taken from the audio (AUDIO_TUTTI).
//  - The spell did not look darker than the lullaby: after its last chord change (217.58 s) the hero sinks to 0.35 and wakes
//    on the horn's first note (226.69 s). No attack falls in the dip; the script checks every attack against every curve.
//  - B major colours are cool on Delaunay's circle of fifths (viridian, cerulean, violet): the warm reds arrive only with the
//    7/4's white-key C/G harmony (334.3 s), true to the score.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'firebird-berceuse-finale-c-simultaneous-sunrise', SONG = 'firebird-berceuse-finale';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const S = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const win = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const r3 = (x) => Math.round(x * 1000) / 1000;
/** Merge note lists, sorted; a note of the same pitch starting within 30 ms of one already kept is dropped. */
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
const vals = (ns, fn) => ns.map((n, i) => withValues([n[0], n[1], n[2], n[3]], fn(n, i, ns)));
const lerp = (a, b, k) => a + (b - a) * k;

// ======================= the hero's set: what one hears, section by section =======================
// The tutti (303.4-319.0 s) is ff but the roll has ~10 notes per line there: its strokes from the audio (librosa onsets, onset
// strength >= 0.6, >= 0.15 s apart; the two strongest chroma pitch classes; velocity from rms). F# rings through every one
// (the dominant pedal) and goes to the middle disc (octave 4); the moving second class goes to octave 6, where the strings
// carry the hymn. [t, pc1, pc2, velocity].
const AUDIO_TUTTI = [[303.425, 6, 11, 82], [304.331, 6, 7, 88], [304.516, 6, 4, 101], [304.76, 6, 3, 103], [304.934, 6, 3, 108], [305.236, 6, 11, 102],
  [305.608, 6, 3, 91], [305.759, 6, 3, 100], [306.026, 6, 3, 105], [306.211, 6, 3, 101], [306.536, 6, 3, 101], [306.85, 6, 4, 96], [307.001, 6, 4, 100],
  [307.674, 6, 4, 94], [308.022, 6, 3, 93], [309.102, 6, 1, 96], [309.253, 6, 1, 100], [309.671, 6, 1, 100], [309.845, 6, 1, 95], [310.263, 6, 8, 94],
  [310.414, 6, 8, 100], [310.635, 6, 11, 103], [310.786, 6, 11, 100], [311.227, 6, 3, 97], [311.564, 4, 6, 99], [311.773, 6, 4, 100], [311.947, 4, 1, 104],
  [312.318, 6, 4, 103], [312.469, 6, 4, 104], [312.678, 6, 4, 104], [312.887, 6, 4, 101], [313.328, 6, 3, 98], [313.827, 6, 4, 97], [314.048, 6, 4, 104],
  [314.454, 4, 8, 103], [314.64, 6, 4, 100], [315.0, 6, 3, 100], [315.151, 6, 3, 106], [315.615, 6, 1, 99], [315.778, 6, 1, 101], [316.219, 6, 8, 103],
  [316.393, 6, 11, 106], [316.614, 6, 4, 106], [316.811, 6, 8, 103], [317.148, 8, 4, 106], [317.322, 6, 8, 97], [318.054, 6, 10, 109], [318.518, 10, 6, 108]];
const tuttiStrokes = AUDIO_TUTTI.flatMap(([t, a, b, v]) => [[t, t + 0.3, 60 + a, v], [t, t + 0.3, 84 + b, v]]);
const BERCEUSE_END = 194, SPELL_END = 226.6, HUSH = 319.1, BLOW74 = 324.127, F1 = 348.555, CODA = 380.74, CUT = 401.15;
const heroNotes = merge(
  // the lullaby: the rocking cradle (audio), the Eb floor, the harp, the bassoon, the winds' answers, the voiced line
  win(S('harp-rocking'), 0, BERCEUSE_END), win(S('eb-pedal'), 0, BERCEUSE_END), win(S('berceuse-harp-track'), 0, BERCEUSE_END),
  S('lullaby-bassoon'), S('wind-answers'), win(S('voice-track'), 0, BERCEUSE_END), win(S('melody-voiced'), 6, 80.6),
  S('strings-lament'),
  // the swell: A major struck six times, the violins' long notes, the D tolls
  S('swell-entry'), S('swell-violins'), S('d-pedal-tolls'),
  // the harp bridge, the reprise, the wind choir, the dissolve, falling asleep
  S('harp-bridge'), S('reprise-descant'), S('reprise-bassoon'), win(S('melody-voiced'), 138, 172), S('lullaby-dissolve'), S('last-rocking'),
  // the spell: eight frozen chord changes
  S('frozen-tremolo'),
  // the hymn, one statement after another, and the bass falling under the crescendo
  S('horn-hymn'), S('hymn-strings'), S('hymn-third'), S('hymn-crescendo'), win(S('falling-bass'), 252.4, 303.48),
  win(S('keys-finale'), 267, 303.48),
  // the tutti (covered by the zoom; the hero hears it so it comes back with that memory)
  S('hymn-tutti'), win(S('bass-line'), 303.48, HUSH), win(S('keys-finale'), 303.48, HUSH), tuttiStrokes,
  // the 7/4 stamps, the Maestoso's strokes and its melody, the coda's brass chords
  S('seven-four-strokes'), S('maestoso-strokes'), S('maestoso-top'), S('coda-chords'),
).filter((n) => n[0] >= 6.5 && n[0] < CUT && !(n[0] >= HUSH && n[0] < BLOW74));

// The knob story, per section: [from, turn, contrast, pulse, memory, cut]. cut < 0.34 halves/quarters, < 0.67 x2, else x4.
const STORY = [
  [0, 0.05, 0.1, 0.2, 6, 0.1],        // berceuse: barely turning, each note its own colour, colours linger
  [80.6, 0.12, 0.45, 0.45, 5, 0.1],   // the swell's A-major strikes: the first glimpse of opposite colours
  [90.6, 0.06, 0.2, 0.3, 6, 0.1],     // the long Ab5/D5 and the D tolls
  [110, 0.04, 0.1, 0.15, 3, 0.1],     // harp bridge: bells, short glows
  [118.2, 0.05, 0.1, 0.2, 6, 0.1],    // reprise, wind choir, dissolve
  [172, 0.02, 0.05, 0.12, 7, 0.1],    // falling asleep
  [194, 0, 0, 0.05, 8, 0.1],          // the spell: still, the frozen chords hang
  [226.6, 0.03, 0.15, 0.2, 8, 0.1],   // the horn: one note at a time, halves, each note stays lit
  [252.4, 0.1, 0.35, 0.3, 7, 0.45],   // strings an octave up: quarters
  [267, 0.18, 0.55, 0.4, 6, 0.55],    // third statement
  [282.8, 0.25, 0.75, 0.5, 6, 0.8],   // the crescendo: sixteenths, ring against ring (turn ramps to 0.5, below); colours pile up
  [303.48, 0.6, 1, 0.75, 8, 1],       // tutti: the discs fill with colour
  [324.1, 0.45, 1, 1, 2.5, 0.7],      // 7/4: every stamp throws the rings outward
  [348.5, 0.6, 1, 1, 5, 1],           // Maestoso: blazing
  [373.8, 0.35, 1, 1, 6, 1],          // ritardando
  [380.7, 0.12, 1, 0.6, 8, 0.5],      // coda: the brass chords glow and hold
];
const storyAt = (t) => { let s = STORY[0]; for (const r of STORY) if (t >= r[0]) s = r; return s; };
const knobsAt = (t) => {
  const [, turn0, contrast, pulse, memory, cut] = storyAt(t);
  const turn = t >= 282.8 && t < 303.48 ? lerp(0.25, 0.5, (t - 282.8) / (303.48 - 282.8)) : turn0;
  return { turn, contrast, pulse, memory, cut };
};
const sets = {};
sets.sun = vals(heroNotes, (n) => knobsAt(n[0]));

// the tutti zoom hears the same tutti
sets.tutti = merge(S('hymn-tutti'), win(S('bass-line'), 303.4, HUSH), win(S('keys-finale'), 303.4, HUSH), win(S('violins-line'), 303.4, HUSH),
  win(S('violas-inner'), 303.4, HUSH), win(S('cellos-low'), 303.4, HUSH), tuttiStrokes).filter((n) => n[0] >= 303.4 && n[0] < HUSH);
// the small sun in the hush: the violins' climb
sets.climb = S('fast-runs');
// the giant ground disc: the Maestoso's bass and bar starts
sets.ground = merge(win(S('maestoso-bass'), F1 - 0.01, CODA + 0.05), win(S('maestoso-downbeats'), F1 - 0.01, CODA + 0.05).filter((n) => n[2] < 60));
// the final chord
// The final chord is a roll that swells for 10 s (audio onsets every ~0.1 s, 402.39-412.48, -33 to -15 dB), then the last
// stroke (412.61). Its strokes, one every ~0.4 s (onset strength >= 0.62), climb through B major's chord tones from B1 to B6:
// the chord fills the discs from the bass disc up to the treble disc as the roll swells, a sunrise in ten seconds. The last
// stroke sounds every one of them at once. Velocity from rms as for the tutti. [t, rms dB].
const ROLL = [[402.393, -33.5], [402.869, -29.8], [403.392, -28.2], [403.868, -25.8], [404.39, -25.0], [404.762, -21.0], [405.18, -23.4],
  [405.598, -22.0], [405.899, -23.1], [406.584, -21.9], [406.909, -19.6], [407.316, -22.1], [407.85, -19.1], [408.198, -17.4], [408.755, -17.6],
  [409.115, -20.6], [409.522, -17.4], [409.963, -18.2], [410.392, -18.8], [410.578, -16.3], [410.95, -14.8], [411.472, -17.9], [411.797, -15.1],
  [412.053, -14.2]];
const B_MAJOR = [35, 39, 42, 47, 51, 54, 59, 63, 66, 71, 75, 78, 83, 87, 90, 95];
const vOf = (db) => Math.round(Math.max(30, Math.min(118, 110 + 3 * (db + 16))));
// A roll's earlier tones keep sounding: each stroke re-sounds its new top tone and the three chord tones below it, so a band of
// light climbs the discs (critic, round 4: one tone per stroke left most of the canvas as glaze until the last stroke).
const rollNotes = ROLL.flatMap(([t, db], k) => {
  const top = Math.min(B_MAJOR.length - 1, Math.round(k * (B_MAJOR.length - 1) / (ROLL.length - 1)));
  return B_MAJOR.slice(Math.max(0, top - 3), top + 1).map((m) => [t, t + 0.4, m, vOf(db)]);
});
const lastStroke = B_MAJOR.map((m) => [412.61, 413.29, m, 120]);
// per note: the wheel starts to turn and the swells grow with the roll; the last stroke throws everything outward
sets.final = vals(merge(rollNotes, lastStroke), (n) => {
  const k = Math.min(1, (n[0] - 402.39) / (412.05 - 402.39));
  return n[0] >= 412.6 ? { turn: 0.5, pulse: 1, memory: 8, contrast: 1, cut: 0.5 } : { turn: lerp(0.04, 0.35, k), pulse: lerp(0.08, 0.3, k), memory: 8, contrast: 1, cut: 0.5 };
});

// ======================= the composition's geometry (lab/tools/delaunay.js) =======================
const DISC = { bass: [0.355, 0.6, 0.47], middle: [0.7, 0.37, 0.36], treble: [0.875, 0.78, 0.235] };
/** A window that shows the whole canvas at scale s, centred at (x, y) on the screen. */
const zoom = (x, y, s, blend = 'over') => ({ mode: 'window', shape: 'rect', x, y, w: s, h: s, feather: 0, fit: 'stretch', blend });
/** The same window, placed so the given disc's centre lands at screen (sx, sy). */
const onDisc = (name, sx, sy, s, blend) => { const [fx, fy] = DISC[name]; return zoom(sx - (fx - 0.5) * s, sy - (fy - 0.5) * s, s, blend); };

// ======================= clips =======================
const clips = [];
const piv = (pts) => pts.map(([t, v, shape]) => ({ t: r3(t), v: Math.round(v * 1000) / 1000, ...(shape ? { shape } : {}) }));
const clip = (c) => { clips.push({ ...c, start: r3(c.start), end: r3(c.end) }); };

// THE DOLLY (critic, round 4). The hero is one painting seen from a changing distance: each stage is its own instance on the
// same set, cut on a real note (the first note of the swell, the harp bridge, the last rocking, each hymn statement). The
// night is a small medallion in the dark; the swell steps it closer for a moment; falling asleep and the spell push it
// further away; then every statement of the hymn steps closer, so the Finale's one long crescendo becomes one long approach
// that ends in the composer's 2x fall into the painting at the tutti. After the hush the day is the painting at its own size.
// The composition (the three discs) spans about x 0.09-1.0, y 0.01-1.07 of its canvas: centre C.
const CX = 0.545, CY = 0.54;
const framed = (s) => zoom(0.5 - (CX - 0.5) * s, 0.5 - (CY - 0.5) * s, s);
// The canvas crops the bass disc's bottom (it reaches y 1.07): in a small centred window that shows as a flat cut. So below
// full size the window stands on the screen's bottom edge, and the crop is the horizon: the painting is a low sun in a black
// sky that grows upward, statement by statement (round-4 preview: centred medallions looked like cropped prints).
const risen = (s) => zoom(0.5 - (CX - 0.5) * s, 1 - s / 2, s);
const STAGES = [
  // [id, start, end, scale, curve]
  ['night', 6.55, 80.665, 0.6, null],                                     // the medallion appears with the first rocking note
  ['swell', 80.665, 110.383, 0.8, null],                                      // the first A-major strike: the dream comes closer
  ['reprise', 110.383, 173.055, 0.6, null],                                   // the harp bridge: back to the distance
  // the last rocking: further away still; after the spell's last chord change the discs sink to a dark glaze
  ['asleep', 173.055, 226.69, 0.48, [[217.7, 1], [223.5, 0.35, 'ease'], [226.66, 0.35]]],
  ['horn', 226.69, 252.475, 0.66, null],                                       // the horn's first note wakes it, closer
  ['strings', 252.475, 267.035, 0.8, null],                                   // strings an octave up
  ['third', 267.035, 282.805, 0.95, null],                                    // third statement
  ['crescendo', 282.805, 303.4, 1.12, null],                                  // the crescendo: the rings press at the edges
];
for (const [id, start, end, s, curve] of STAGES) {
  clip({ id: `hero-${id}`, track: 1, start, end, fade: 0, widget: 'delaunay', listen: 'picks:sun', region: risen(s), ...(curve ? { intensity: piv(curve) } : {}) });
}
// The day: the 7/4 blow brings the whole painting back at its own size, through the Maestoso and the coda.
clip({ id: 'hero-day', track: 1, start: BLOW74 - 0.005, end: CUT, fade: 0, widget: 'delaunay', listen: 'picks:sun' });
// The tutti: the lower-right quarter of the painting at 2x (treble disc right, middle disc's arc above, bass disc's left).
clip({ id: 'tutti', track: 2, start: 303.4, end: HUSH + 0.4, fade: 0, widget: 'delaunay', listen: 'picks:tutti',
  knobs: { turn: 0.6, contrast: 1, pulse: 0.75, memory: 8, cut: 1 }, region: zoom(0, 0, 2),
  intensity: piv([[HUSH + 0.02, 1], [HUSH + 0.35, 0]]) });
// The hush: the treble disc alone, through a mask at its own place, on the violins' climb.
const [tx, ty, tr] = DISC.treble;
clip({ id: 'climb', track: 2, start: 319.7, end: BLOW74, fade: 0, widget: 'delaunay', listen: 'picks:climb',
  knobs: { turn: 0.25, contrast: 1, pulse: 1, memory: 4, cut: 1 },
  region: { mode: 'spot', shape: 'ellipse', x: tx, y: ty, w: tr * 2 * 1.3 * 9 / 16, h: tr * 2 * 1.3, feather: 0.2 } });
// The giant ground disc under the Maestoso.
clip({ id: 'ground', track: 0, start: F1 - 0.005, end: CODA + 2.4, fade: 0, widget: 'delaunay', listen: 'picks:ground',
  knobs: { turn: 0.3, contrast: 1, pulse: 1, memory: 4, cut: 0.5, presence: 0.4 }, region: onDisc('bass', 0.5, 0.5, 2),
  intensity: piv([[CODA + 0.3, 1], [CODA + 2.4, 0, 'ease']]) });
// The final chord: a fresh composition, fading up with the swell.
// The roll starts as the night's low sun on the horizon (B major's D# is the berceuse's Eb); the last stroke cuts it to a sun
// bigger than the screen, centred: the one dramatic change of scale in the coda.
clip({ id: 'final', track: 1, start: 402.35, end: 412.605, fade: 0, widget: 'delaunay', listen: 'picks:final',
  knobs: { turn: 0.12, contrast: 1, pulse: 1, memory: 8, cut: 0.5 }, region: risen(0.72) });
clip({ id: 'last', track: 1, start: 412.605, end: 413.3, fade: 0, widget: 'delaunay', listen: 'picks:final',
  knobs: { turn: 0.12, contrast: 1, pulse: 1, memory: 8, cut: 0.5 }, region: framed(1.45),
  intensity: piv([[413.0, 1], [413.3, 0]]) });

// ======================= checks: every attack passes its clip's curve =======================
const OFFSET = 0x811c9dc5, PRIME = 0x01000193;
const fnv32 = (s) => { let h = OFFSET; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h ^= c & 0xff; h = Math.imul(h, PRIME); h ^= c >>> 8; h = Math.imul(h, PRIME); } return h >>> 0; };
const passes = (t, a, salt) => {
  if (a >= 1) return true; if (!(a > 0)) return false;
  let h = OFFSET; const x = salt >>> 0, y = Math.round(t * 1000) >>> 0;
  for (let i = 0; i < 4; i++) { h ^= (x >>> (8 * i)) & 0xff; h = Math.imul(h, PRIME); }
  for (let i = 0; i < 4; i++) { h ^= (y >>> (8 * i)) & 0xff; h = Math.imul(h, PRIME); }
  return (h >>> 0) / 4294967296 < a;
};
const curveAt = (p, t) => {
  if (!p || !p.length) return 1; const n = p.length;
  if (t <= p[0].t) return p[0].v; if (t >= p[n - 1].t) return p[n - 1].v;
  let a = 0; while (a + 1 < n && p[a + 1].t <= t) a++;
  const P0 = p[a], q = p[a + 1]; if (q.t === P0.t) return q.v; let u = (t - P0.t) / (q.t - P0.t);
  if (P0.shape === 'hold') return P0.v; if (P0.shape === 'ease') u = u * u * (3 - 2 * u);
  return P0.v + (q.v - P0.v) * u;
};
const attacks = (ns) => { const out = []; for (const n of ns) if (!out.length || n[0] - out[out.length - 1] >= 0.04) out.push(n[0]); return out; };

// Each set trimmed to its clips (a pick nobody hears is a warning).
const picks = {};
for (const [id, ns] of Object.entries(sets)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  picks[id] = { notes: ns.filter((n) => cs.some((c) => n[0] >= c.start && n[0] < c.end)) };
}
let dropped = 0;
for (const c of clips) {
  const id = c.listen.slice(6), key = `${c.widget}@picks:${id}#${c.id}`, salt = fnv32(key);
  for (const t of attacks(picks[id].notes)) {
    if (t < c.start || t >= c.end) continue;
    const a = curveAt(c.intensity, t);
    if (!passes(t, a, salt)) { dropped++; console.log(`  DROPPED ${c.id} attack ${t.toFixed(3)} (curve ${a.toFixed(2)})`); }
  }
}
console.log(`attacks dropped by curves: ${dropped}`);
// ground's presence 0.4: delaunay skips a note when the share of the pack's velocities below it is under (1-p)*0.95
{ const vs = pack.notes.map((n) => n[3]).sort((a, b) => a - b), need = (1 - 0.4) * 0.95;
  const lost = picks.ground.notes.filter((n) => vs.filter((v) => v < n[3]).length / vs.length < need);
  console.log(`ground notes lost to presence 0.4: ${lost.length}`); if (lost.length) throw new Error('ground presence drops notes'); }

// Lit notes per disc per section (bass < 48, middle 48-71, treble >= 72).
const SECTIONS = [[6.4, 'rocking'], [18.4, 'bassoon 1'], [31.3, 'middle phrase'], [46.4, 'bassoon 2'], [60.4, 'lament'], [80.6, 'swell'],
  [110, 'harp bridge'], [118.2, 'reprise'], [138, 'wind choir'], [154, 'dissolve'], [172, 'asleep'], [194, 'spell'], [226.6, 'horn'],
  [252.4, 'hymn 2'], [267, 'hymn 3'], [282.8, 'crescendo'], [303.5, 'tutti'], [319.1, 'hush'], [324.1, '7/4'], [348.5, 'maestoso'],
  [380.7, 'coda'], [401.2, 'silence'], [402.3, 'final'], [413.3, 'end']];
for (let i = 0; i + 1 < SECTIONS.length; i++) {
  const [a, name] = SECTIONS[i], b = SECTIONS[i + 1][0];
  const ns = picks.sun.notes.filter((n) => n[0] >= a && n[0] < b);
  const d = [0, 0, 0]; for (const n of ns) d[n[2] < 48 ? 0 : n[2] < 72 ? 1 : 2]++;
  console.log(`  ${name.padEnd(14)} ${a.toFixed(1).padStart(6)}-${b.toFixed(1).padEnd(6)} hero notes ${String(ns.length).padStart(4)}  bass ${d[0]} middle ${d[1]} treble ${d[2]}`);
}

// ======================= write =======================
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Firebird, Berceuse and Finale · C · Simultaneous sunrise: Delaunay alone, its three discs (bass, middle, treble) as the whole Firebird; per-note knobs turn the night\'s single colours into simultaneous contrast, statement by statement; a 2x fall into the painting at the tutti, a lone treble sun in the hush, a giant bass disc under the Maestoso, a fresh composition on the final chord',
  composer: { by: 'claude', at: new Date().toISOString() }, clips: clips.sort((a, b) => a.start - b.start || a.track - b.track), picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets (${Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ')})`);
console.log(`errors ${errors.length}`, errors.slice(0, 20));
console.log(`warnings ${warnings.length}`, warnings.slice(0, 30));
if (!errors.length) { writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show)); console.log(`wrote shows/${ID}.json`); }
