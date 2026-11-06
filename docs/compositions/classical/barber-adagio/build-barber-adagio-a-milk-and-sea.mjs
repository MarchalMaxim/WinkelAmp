// Builds shows/barber-adagio-a-milk-and-sea.json from picks.json (this folder) and the plan below.
// Run: node_modules/.bin/tsx docs/compositions/classical/barber-adagio/build-barber-adagio-a-milk-and-sea.mjs
//
// THE PLAN ("Milk and sea": horizon, handover, ivory, murmuration, pixelsort)
// One sea, one line of light, and milk. The ground is Sugimoto's horizon from the first bar to the cut-off, and it tells
// the whole arc by itself, through knob values carried on its own notes (the "sea" set: every clean note of the piece,
// plus the climax and swell chords measured from the audio):
//  - It is born as a hairline. Its how-present curve starts at 0, so at the long B flat there is only the line of light
//    across a black sea; the lower strings (3.95 s) start a dawn that lasts the whole first statement.
//  - Its contrast, height and haze follow the recording's loudness (DB below, measured with librosa): fog and a soft,
//    low horizon in the pp chant; the sea rises and the line hardens to a knife edge with every swell; at the fff
//    arrival the sky is white over a black sea. The seven theme heads (the long B flats that open each statement) glint
//    twice as brightly: the toll returns on the line.
//  - It is cut dead at 353.0 s with the orchestra, and comes back at the reprise as a hairline again, dawns once more,
//    and sinks back to a hairline on the last, unresolved chord.
// On that sea:
//  - Rising phrases are BUILT: each is a huddled Ivory row standing on the horizon line (a small copy whose keys' feet
//    sit exactly on the line at that moment), and each row of the climb is larger than the last: theme, theme restated,
//    first ascent, second build, waves; then the summit (the violins' ascent to G flat 6, and on through the climax's
//    G flat 6 and four B flat 6 re-strikes) full frame with hard strikes, standing in the fff while every chord change
//    sorts it, its stomp on the last B flat 6 (342.67 s); the arrival presses one key back and the keys age out. Rising cells of the LOWER voices stand
//    under the water instead (submerged, dimmer rows): the answer's inner climb (41 s), the cellos' cell in the dark middle
//    (232 s), and the stretto, where each voice's entry is its own little hammered row, entering left to right in canon.
//  - Falling and winding phrases are HANDED OVER: milky handover slabs, one per note, each gone as the next lands (the
//    chant: the answer, the strophes, the descent, the low strophe's long notes, the held cadence chords). The bass is a
//    second, smaller handover: milk tiles low in the sea, one per walking bass note.
//  - The violas and cellos are the murmuration (the user's favourite): a few faint birds when the lower strings enter,
//    the lead when they take the theme (first swell, violas) and in the dark middle; at the stretto the flock is startled
//    red by each hammered entry; at the climax every chord change re-forms it into that chord's own figure (the chords'
//    pitch classes measured from the audio, as the tracks hear nothing there).
//  - Pixel sort is the tear that grows: a few thin threads at the first forte (93 s), a little more at each swell
//    (145, 258, 279, 304 s), until the climax chords sort the sea itself (horizon + murmuration + pixelsort, own 0.1).
//  - The single gesture: the fff arrival (346.21 s, F flat major) floods the sky with two giant milk slabs (handover size
//    2 on those two notes) that the pixel sort pours into the black sea, the flock's F flat triangle over it, held to the
//    cut-off. 353.0: every clip ends with fade 0. Black for the silence.
//  - The hymn: handover alone on black, small soft slabs, one chord at a time. Then the sea again (the reprise).
//
// What the previews showed, and what changed:
//  - Handover over the horizon struck bone and then sank to a grey ghost (its envelope expects the shared canvas's fade,
//    and the horizon repaints every frame): every handover on the sea now draws on its own full-frame copy, lightened over it.
//  - Found by accident: the summit row's deep crater (Ivory's ground, crater 1) stands behind the keys like a dark island
//    on the horizon. Kept. And the keys looked best standing IN the fff, so the row now goes on through the climax on the
//    violins' G flat 6 and four B flat 6 re-strikes (twin keys), stomps on the last of them as the final chord swells, and
//    every climax chord sorts the keys into the sea; the arrival floods milk over them, and they age to ember and go.
//  - The flock's dread knot is blood red by design; in the dark middle and the plateau it is turned down so it stays a
//    faint knot rather than a red texture. The swell chords taken from the audio (267-274 s) carry the sea's knobs only.
//
// The critic's pass (fresh eyes, from the full render):
//  - The dark middle (199-257 s) was a still sea, one slab and a red knot for a minute: the viola and cello tracks hear
//    almost nothing there. The flock now also follows the low strophe (the line sunk into the lower strings' register),
//    so it is a pale ribbon that sinks with the line, and a knot only in the real gaps (the G flat chord held 220-227).
//  - The untranscribed swell (267-275 s) now re-forms the flock into its four harmonies (strike 1, intensity 1.4, pale
//    bleed 0.2): the first time the flock draws a harmony, the climax foreshadowed. The flock is turned full up for it.
//  - Serendipity: the reprise is the theme in octaves, so each reprise row gets its double turned over in the water (a
//    second Ivory on the same picks, rotated 180 degrees under the line, presence 0.38). Only there.
//  - The stretto's four rows are larger (0.46-0.58), the held C5 of the reprise (396-403) thins the flock instead of a
//    red knot, and the reprise row now ends as the answer row begins.
//
// Weights per 30 s (0..1; how much each strand shows; crossfaded at the form's turns, not at the marks):
// | s       | sea (horizon) | chant (handover) | keys (ivory)       | flock (murmuration) | bass tiles | tear (pixelsort) |
// | 0-30    | 0 -> .5 dawn  | .3 cadence       | 1 opening row      | 0 -> .15            | .4         | 0                |
// | 30-60   | .55-.7        | 1 answer         | .6 inner (sunk)    | .25-.35             | .4         | 0                |
// | 60-90   | .75-.95       | .3               | 1 restated, ascent | .3 -> .75           | .4         | 0                |
// | 90-120  | 1             | .8 swell         | 0                  | .85 (violas' theme) | .6 tolls   | .25              |
// | 120-150 | 1             | .6               | 1 second build     | .5                  | .5         | .45              |
// | 150-180 | 1             | 1 descent        | .3                 | .5                  | .4         | 0                |
// | 180-210 | 1             | .8               | 0                  | .65 -> .8           | .4         | 0                |
// | 210-240 | 1 (fog)       | .5 long notes    | .6 cellos (sunk)   | .95 lead            | .5         | 0                |
// | 240-270 | 1             | .8 pushed        | 0                  | .7                  | .5         | .55              |
// | 270-300 | 1             | .5 plateau       | 1 waves            | .6                  | .2         | .65              |
// | 300-330 | 1 stark       | 0                | 1 stretto, summit  | 1 red               | 0          | .75 -> 1         |
// | 330-353 | 1 knife edge  | 1 milk flood     | .3 melting         | 1 chord figures     | 0          | 1                |
// | 353-357 | black         | black            | black              | black               | black      | black            |
// | 357-380 | 0             | 1 hymn alone     | 0                  | 0                   | 0          | 0                |
// | 380-426 | 0 -> .7 dawn  | .2               | 1 reprise rows     | .3-.4 (lower octave)| .4         | 0                |
// | 426-466 | .5 -> 0       | 1 coda, chords   | 0                  | .25 -> 0            | .4         | 0                |
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'barber-adagio-a-milk-and-sea', SONG = 'barber-adagio';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const S = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const win = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CUT = 353.0;   // the cut-off: everything ends here, hard
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
const same = (a, b) => Math.abs(a[0] - b[0]) < 0.03 && a[2] === b[2];
const without = (ns, ...drop) => ns.filter((n) => !drop.flat().some((d) => same(n, d)));
const vals = (ns, fn) => ns.map((n, i) => withValues([n[0], n[1], n[2], n[3]], fn(n, i, ns)));

// ---------------------------------------------------------------------------------------------------------------
// The recording's loudness: mean rms dB per 2 s (librosa, hop 512 at 22.05 kHz, ref 1.0; index k = k*2 .. k*2+2 s).
// Measured once from songs/barber-adagio/audio.mp3; the climax is about -20, the opening -46, the hymn -40.
const DB = [-74, -57, -46, -47, -50, -48, -47, -46, -44, -40, -43, -42, -57, -55, -47, -46, -44, -45, -47, -47, -45, -46, -45, -44, -47, -46, -55, -51, -44, -41,
  -44, -42, -42, -40, -38, -39, -39, -39, -41, -37, -36, -36, -37, -34, -36, -36, -34, -31, -31, -33, -34, -39, -38, -36, -39, -36, -39, -37, -36, -36,
  -33, -37, -35, -35, -37, -36, -48, -39, -38, -34, -34, -33, -33, -31, -32, -31, -33, -32, -33, -36, -39, -39, -37, -35, -35, -38, -37, -33, -33, -33,
  -38, -31, -30, -32, -36, -38, -38, -39, -39, -39, -38, -37, -36, -32, -33, -31, -37, -43, -45, -39, -40, -36, -37, -38, -38, -39, -38, -38, -39, -38,
  -36, -42, -42, -36, -39, -38, -38, -33, -33, -30, -34, -36, -39, -36, -32, -36, -36, -33, -32, -31, -31, -28, -30, -29, -31, -33, -31, -32, -32, -31,
  -32, -32, -29, -28, -28, -30, -27, -26, -26, -27, -29, -28, -27, -25, -22, -22, -21, -20, -21, -22, -21, -21, -22, -18, -19, -19, -30, -50, -47, -39,
  -42, -43, -39, -40, -42, -38, -37, -39, -50, -56, -46, -38, -37, -36, -35, -37, -35, -34, -33, -43, -50, -40, -36, -40, -38, -39, -34, -36, -37, -37,
  -39, -38, -49, -49, -41, -38, -40, -43, -53, -45, -38, -38, -35, -31, -38, -37, -45, -49, -43, -45, -47, -53, -72, -95, -95, -95, -95, -95, -95, -95, -95];
const dbAt = (t) => { const k = clamp(t / 2 - 0.5, 0, DB.length - 1), i = Math.floor(k), f = k - i; return DB[i] * (1 - f) + DB[Math.min(DB.length - 1, i + 1)] * f; };
/** Loudness 0..1, smoothed over +-5 s (the sea moves slowly): -46 dB -> 0, -20 dB -> 1. */
const loud = (t) => { let s = 0, n = 0; for (let u = -5; u <= 5; u += 1) { s += dbAt(t + u); n++; } return clamp((s / n + 46) / 26, 0, 1); };
// The sea's knobs as functions of the loudness: the horizon rises (level falls) and hardens as the music swells.
const SEA = {
  level: (u) => 0.535 - 0.1 * u,
  contrast: (u) => 0.1 + 0.88 * Math.pow(u, 1.35),
  soft: (u) => 0.68 - 0.62 * u,
  colour: (u) => 0.35 + 0.5 * u,
};
const seaAt = (t, mute = 1) => { const u = loud(t) * mute; return { level: SEA.level(u), contrast: SEA.contrast(u), soft: SEA.soft(u), colour: SEA.colour(u) }; };

// ---------------------------------------------------------------------------------------------------------------
// The climax, which the tracks do not hear: each chord change (climax-line, climax-chord) voiced from the audio's
// chroma_cqt 0.15-0.9 s after the change (pitch classes >= 0.7 of the strongest; the first named is put in the bass,
// octave 2). The top note is the set's own. The arrival is F flat major (E, G sharp, B): Barber's climax chord.
const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const CLIMAX = [
  [328.79, 330.23, 87, 113, ['Bb', 'F']],                 // E flat 6 on top (the summit's last note)
  [330.23, 332.81, 90, 112, ['Gb', 'Bb', 'Db']],          // G flat major, G flat 6
  [332.81, 333.83, 94, 115, ['Eb', 'Ab', 'Bb']],          // B flat 6 re-struck
  [333.83, 336.9, 94, 113, ['B', 'F', 'Db', 'Bb']],
  [336.9, 342.67, 94, 110, ['B', 'Gb', 'Bb']],            // the held harmony
  [342.67, 345.5, 94, 104, ['B', 'Gb', 'Bb', 'Eb']],      // E flat enters with the swell (ANALYSIS.md)
  [346.21, CUT, 92, 120, ['E', 'Ab', 'B']],               // the arrival, F flat major, cut off dead
];
const voiced = CLIMAX.map(([t, e, top, v, pcs]) => {
  const ns = [[t, e, 36 + ((PC[pcs[0]] + 12 - 0) % 12), v]];
  for (const p of pcs) for (const o of [48, 60]) ns.push([t, e, o + PC[p], Math.round(v * 0.9)]);
  if (t >= 346) ns.push([t, e, 80, v]);                    // the arrival's A flat 5 (climax-chord)
  ns.push([t, e, top, v]);
  return merge(ns);
});
const CLIMAX_CHORDS = voiced.flat();
const ARRIVAL = 346.21;

// The untranscribed swell of the third build (266.5-275.1 s): its harmony changes from the audio chroma, for the sea
// only (they glint on the horizon and carry its contrast up; nothing else hears them). Velocity from the dB fit.
const SWELL = [[267.2, 270, [41, 53, 60, 63, 65], 70], [270.0, 272, [41, 56, 60, 65, 68], 74], [272.0, 274, [44, 59, 63, 65, 68], 72], [274.0, 275.1, [46, 53, 58, 65, 68], 70]]
  .flatMap(([t, e, ms, v]) => ms.map((m) => [t, e, m, v]));

// ---------------------------------------------------------------------------------------------------------------
const sets = {};
const clips = [];
const LAYER = { sea: 0, bass: 1, flock: 2, chant: 3, keys: 4, tear: 5 };
const clip = (c) => { clips.push({ id: '', track: 0, ...c, start: r3(c.start), end: r3(c.end) }); };
const piv = (pts) => pts.map(([t, v, shape]) => ({ t: r3(t), v: Math.round(v * 1000) / 1000, ...(shape ? { shape } : {}) }));

// ======================= the keys: Ivory rows =======================
// A row standing on the horizon: a small copy (same aspect as the frame) whose keys' feet (Ivory's ground is 0.88 of
// its height) sit on the horizon line at that moment.
const onLine = (t, h, x = 0.5) => { const y = seaAt(t).level; return { mode: 'window', shape: 'rect', x, y: r3(y - 0.38 * h), w: h, h, feather: 0.08, fit: 'contain' }; };
// A row under the water: lower voices.
const sunk = (y, h, x = 0.5) => ({ mode: 'window', shape: 'rect', x, y, w: h, h, feather: 0.12, fit: 'contain' });
const ROWS = [];
function row(id, notes, region, knobs, endAt) {
  sets[id] = notes.map((n) => [...n]);
  const end = endAt ?? notes[notes.length - 1][0] + 3.7;
  ROWS.push({ id, notes, end });
  clip({ start: notes[0][0] - 0.4, end, fade: 0.3, layer: 'keys', widget: 'ivory', listen: `picks:${id}`, knobs, ...(region ? { region } : {}) });
}
const KEYS = { huddle: 0.7, cracks: 1 };
const opening = S('theme-opening');
row('keys-opening', opening, onLine(0.93, 0.4), { ...KEYS, strike: 0, crater: 0.3, ripple: 2 });
const innerClimb = win(S('theme-answer'), 41.0, 49.0).filter((n) => !(n[0] < 41.5 && n[2] > 64));
row('keys-inner', innerClimb, sunk(0.74, 0.36, 0.5), { ...KEYS, strike: 0, crater: 0.2, ripple: 1.5, presence: 0.6 });
const restated = win(S('theme-restated'), 53.4, 70.0);
const ascent1 = S('first-ascent');
row('keys-restated', restated, onLine(53.48, 0.46), { ...KEYS, strike: 0, crater: 0.35, ripple: 2.2 }, ascent1[0][0] + 1.2);
row('keys-ascent', ascent1, onLine(70.08, 0.54), { ...KEYS, strike: 0.2, crater: 0.45, ripple: 2.8 });
const build2 = win(S('second-build'), 136.0, 158);
row('keys-build', build2, onLine(136.35, 0.6), { ...KEYS, strike: 0.4, crater: 0.5, ripple: 3.2 });
const cellos = win(S('low-strophe'), 231.8, 235.3);
row('keys-cellos', cellos, sunk(0.74, 0.38, 0.5), { ...KEYS, strike: 0, crater: 0.25, ripple: 1.6, presence: 0.6 });
const waves = win(S('waves'), 275.0, 286.0);
row('keys-waves', waves, onLine(275.16, 0.68), { ...KEYS, strike: 0.6, crater: 0.55, ripple: 3.6 });
// The stretto: each voice's entry is a little hammered row under the water, left to right, in canon.
const stretto = S('stretto-cells').filter((n) => n[2] !== 70);
[[304.0, 305.5, 0.2], [306.0, 307.3, 0.4], [307.5, 310.0, 0.6], [310.5, 314.5, 0.8]].forEach(([a, b, x], i) => {
  row(`keys-stretto-${i + 1}`, win(stretto, a, b), sunk(0.74, 0.46 + 0.04 * i, x),{ ...KEYS, strike: 1, crater: 0.4, ripple: 2.5, presence: 0.7 + 0.1 * i });
});
// The summit: full frame, hard strikes, the deepest crater of the show.
// The row goes on through the climax on the violins' top notes (G flat 6, then B flat 6 re-struck four times, each a twin
// key beside the last), so the keys stand in the fff and every chord change sorts them. Its stomp is the last B flat 6
// (342.67 s), as the final chord swells to the breath; the arrival's A flat 6 presses one key back into the ground.
const summit = merge(S('ascent-to-top').filter((n) => n[2] >= 80), S('climax-line'), S('climax-chord').filter((n) => n[2] === 92));
row('keys-summit', summit, null, { huddle: 0, cracks: 2, strike: 1, crater: 1, ripple: 6 });
const reprise = S('reprise-theme');
const answer = win(S('reprise-answer'), 403.4, 421.0);
row('keys-reprise', reprise, onLine(382.28, 0.46, 0.5), { ...KEYS, strike: 0, crater: 0.35, ripple: 2.2 }, answer[0][0] - 0.4);   // CRITIC: was +1.0; it now hands over as the answer row begins (8 clips at once otherwise)
row('keys-answer', answer, onLine(403.45, 0.52, 0.5), { ...KEYS, strike: 0.1, crater: 0.4, ripple: 2.6 });
// CRITIC (serendipity): the reprise is the theme doubled an octave lower, the same notes at the same moment one floor
// down. So each reprise row has its double turned over in the water: a second Ivory on the same picks, the same row
// rotated 180 degrees with its feet on the horizon line from below, dim (presence 0.38). Only here, because only here
// does the whole theme sound in octaves; the rows of the climb above have no reflection.
const underLine = (t, h, x = 0.5) => { const y = seaAt(t, 0.75).level; return { mode: 'window', shape: 'rect', x, y: r3(y + 0.38 * h), w: h, h, rot: 180, feather: 0.22, fit: 'contain', blend: 'lighten' }; };
for (const [id, t0, h, endAt, knobs] of [['keys-reprise', 382.28, 0.46, answer[0][0] - 0.4, { strike: 0, crater: 0.35, ripple: 2.2 }], ['keys-answer', 403.45, 0.52, null, { strike: 0.1, crater: 0.4, ripple: 2.6 }]]) {
  const ns = sets[id];
  clip({ start: ns[0][0] - 0.4, end: endAt ?? ns[ns.length - 1][0] + 3.7, fade: 0.3, layer: 'keys', widget: 'ivory', listen: `picks:${id}`, knobs: { ...KEYS, ...knobs, presence: 0.38 }, region: underLine(t0, h) });
}
const inRow = (t) => ROWS.some((r) => t >= r.notes[0][0] - 0.1 && t <= r.notes[r.notes.length - 1][0] + 0.2 && !r.id.startsWith('keys-stretto') && !['keys-inner', 'keys-cellos'].includes(r.id));
const rowNotes = ROWS.flatMap((r) => r.notes);

// ======================= the chant: handover, milky =======================
// Over the horizon (which repaints the whole frame every step) a slab would be a strike and then a grey ghost: Handover's
// envelope is tuned for the shared canvas's fade. So every handover clip on the sea draws on its own full-frame canvas
// (a small copy the size of the frame), laid over the sea with lighten: the milk is always brighter than the sea.
const OWN = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch', blend: 'lighten' };
// Falling and winding phrases, held chords and long notes: one slab per note, gone as the next lands. The notes the
// rows build are left out, and so are the bass notes (the bass has its own, smaller handover).
const cad = S('cadence-chords').filter((n) => n[2] >= 50);
const chant1 = without(merge(
  cad.filter((n) => n[0] < CUT), S('theme-answer'), S('first-swell'), S('second-strophe'), win(S('second-build'), 134, 136), S('violins-descent'),
  S('low-strophe'), S('third-build'), win(S('waves'), 286.5, 304), win(S('long-tones'), 0, 329),
), rowNotes).filter((n) => !inRow(n[0]) && n[0] >= 21).concat(S('climax-chord'));   // the arrival floods milk over the keys
sets.chant = vals(chant1, (n) => {
  if (n[0] >= ARRIVAL) return { size: 2, ring: 3, goneBy: 2.5 };          // the milk flood
  if (n[0] >= 330) return { size: 1.35, ring: 2.2 };                       // the climax's chord changes, high in the sky
  return { intensity: n[0] < 86 ? 1.7 : n[3] < 40 ? 1.4 : 1 };            // the pp chant's tiny velocities
});
// Silent through the stretto and the summit (the keys have the line there): two clips on the one set.
for (const [a, b] of [[21.0, 303.6], [329.9, CUT]]) clip({ start: a, end: b, fade: 0, layer: 'chant', widget: 'handover', listen: 'picks:chant', knobs: { goneBy: 2.5, ring: 1.6, size: 0.9 }, region: OWN });

const hymn = S('hymn-chords');
const chant2 = merge(hymn, win(S('reprise-answer'), 421.0, 427), S('coda-cell'), S('last-chords').filter((n) => n[2] >= 50));
sets.hymn = vals(chant2, (n) => (n[0] < 380 ? { intensity: 2 } : { intensity: n[3] < 40 ? 1.8 : 1.3 }));
// The hymn on black, as it is; from the reprise on, over the sea again, on its own canvas.
clip({ start: 356.4, end: 380.0, fade: 0, layer: 'chant', widget: 'handover', listen: 'picks:hymn', knobs: { goneBy: 2.5, ring: 1.8, size: 0.8 } });
clip({ start: 380.0, end: 466.0, fade: 0, layer: 'chant', widget: 'handover', listen: 'picks:hymn', knobs: { goneBy: 2.5, ring: 1.8, size: 0.8 }, region: OWN });

// ======================= the bass: small milk tiles in the sea =======================
const bass = S('bass-line');
sets.bass = vals(win(bass, 3.9, 300), (n) => ({ intensity: n[0] < 86 ? 1.8 : 1.2 }));
clip({ start: 3.9, end: 300, fade: 1, layer: 'bass', widget: 'handover', listen: 'picks:bass', knobs: { goneBy: 2.5, ring: 2, size: 0.55 }, region: OWN });
sets['bass-reprise'] = vals(win(bass, 380, 466), () => ({ intensity: 1.5 }));
clip({ start: 381.0, end: 466.0, fade: 1, layer: 'bass', widget: 'handover', listen: 'picks:bass-reprise', knobs: { goneBy: 2.5, ring: 2, size: 0.55 }, region: OWN });

// ======================= the flock: murmuration on the violas and cellos =======================
const tolls = S('deep-tolls');
// CRITIC: in the dark middle (199.6-257.5) the line itself sinks into the lower strings' register (B flat 3-A flat 4), and
// the viola and cello tracks hear almost nothing there, so the flock had no line to trace and sat as a red knot for a
// minute. It now follows the low strophe's notes too: a pale ribbon that sinks with the line, a knot only in its real gaps.
const lowStrophe = win(S('low-strophe'), 199.5, 257.5);
// CRITIC: the untranscribed swell (267-275 s) re-forms the flock, once per harmony the strings swell into (F minor, A flat
// over F, the C flat colour, B flat 7): the first time the flock draws the harmony itself, a foreshadowing of the climax.
// Each is a real change of chord measured from the audio; strike 1 and intensity 1.4 so the soft-velocity guesses pass the
// widget's bar, hold 2.4 so each figure lasts until the next.
const swellChords = SWELL.map((n) => [...n]);
const flock1 = merge(win(S('viola-line'), 21, 330), win(S('cello-line'), 21, 330), lowStrophe, tolls, swellChords, CLIMAX_CHORDS);
sets.flock = vals(flock1, (n) => {
  if (n[0] >= 328.7) return { hold: n[0] >= ARRIVAL ? 6 : 4.5 };             // each climax chord holds its figure
  if (swellChords.some((d) => same(n, d))) return { intensity: 1.4, strike: 1, hold: 2.4, bleed: 0.2 };   // CRITIC round 2: pale, not a red blow (a swell, not an ff attack)
  if (tolls.some((d) => same(n, d))) return { intensity: 2 };              // the deep tolls throb the knot
  return { intensity: n[0] < 86 ? 1.6 : 1 };
});
clip({ start: 21.1, end: CUT, fade: 0, layer: 'flock', widget: 'murmuration', listen: 'picks:flock', intensityMoves: 'present',
  intensity: piv([[21.1, 0.1], [30, 0.15], [41, 0.3], [49.5, 0.2], [53.4, 0.15], [80, 0.25], [86.2, 0.75, 'ease'], [97, 0.88], [103.5, 0.55],
    [134.6, 0.45], [146, 0.6], [162.8, 0.5], [180.3, 0.68], [199.6, 0.72, 'ease'], [210, 0.8], [231.5, 0.85], [236, 0.85], [244, 0.7], [252, 0.75], [257.5, 0.65],
    [266.2, 0.65, 'ease'], [267.2, 1], [275.1, 1, 'ease'], [279, 0.62], [287, 0.45], [301, 0.5], [303.3, 1], [CUT, 1]]) });
// The reprise: the lower octave of the doubled theme.
sets['flock-reprise'] = merge(win(S('viola-line'), 382, 452), win(S('cello-line'), 382, 452));
clip({ start: 382.0, end: 452.0, fade: 1.5, layer: 'flock', widget: 'murmuration', listen: 'picks:flock-reprise', intensityMoves: 'present',
  // CRITIC: the held C5 (396.1-403.4) has no attack, so the flock sank into its red knot; it thins to a few birds there.
  intensity: piv([[382, 0.12], [396, 0.35], [397.5, 0.08, 'ease'], [403, 0.08], [405, 0.35, 'ease'], [412.9, 0.42], [426, 0.25], [440, 0.12], [452, 0.05]]) });

// ======================= the tear: pixel sort, growing swell by swell =======================
const tears = merge(S('forte-accents'), S('ff-blows').filter((n) => n[0] < 328.7), CLIMAX_CHORDS);
sets.tear = vals(tears, (n) => (n[0] >= ARRIVAL ? { band: 2.5, len: 1.6, life: 3 } : n[0] >= 328.7 ? { band: 2.2, len: 1.5, life: 2.6 } : {}));
clip({ start: 93.0, end: CUT, fade: 0, layer: 'tear', widget: 'pixelsort', listen: 'picks:tear', knobs: { own: 0.1 }, intensityMoves: 'present',
  intensity: piv([[93, 0.22], [140, 0.25], [144.5, 0.42], [250, 0.42], [258, 0.52], [278, 0.62], [303.3, 0.72], [315, 0.85], [328.7, 1], [CUT, 1]]) });

// ======================= the sea: horizon =======================
const heads = S('theme-heads');
const seaNotes = (a, b) => merge(win(S('melody'), a, b), win(S('bass-line'), a, b), win(S('viola-line'), a, b), win(S('cello-line'), a, b),
  win(S('audio-fills'), a, b), win(S('cadence-chords'), a, b), win(S('stretto-cells'), a, b), win(CLIMAX_CHORDS, a, b), win(SWELL, a, b), win(S('last-chords'), a, b));
const seaValues = (mute) => (n) => {
  const v = { ...seaAt(n[0], mute) };
  if (n[0] >= ARRIVAL) Object.assign(v, { contrast: 1, soft: 0.02, level: 0.42, colour: 0.9 });
  if (heads.some((h) => same(n, h))) Object.assign(v, { shimmer: 2, intensity: 2 });   // the toll glints on the line
  // The swell's harmony changes are no attacks: they carry the knobs only, and light nothing (no glint, no bloom).
  // ...and climb as a staircase, one step per harmony change, to the -13.6 dB peak: the sea swells and hardens.
  const step = [[267.2, 0.6, 0.48], [270.0, 0.72, 0.465], [272.0, 0.8, 0.45], [274.0, 0.7, 0.455]].find(([t]) => Math.abs(n[0] - t) < 0.03);
  if (SWELL.some((w) => same(n, w))) Object.assign(v, { shimmer: 0, intensity: 0.3, contrast: step[1], level: step[2], soft: 0.15 });
  for (const k of ['level', 'contrast', 'soft', 'colour']) v[k] = Math.round(v[k] * 1000) / 1000;
  return v;
};
sets.sea = vals(seaNotes(0.5, CUT), seaValues(1));
const sea0 = seaAt(0.9);
clip({ start: 0.6, end: CUT, fade: 0, layer: 'sea', widget: 'horizon', listen: 'picks:sea', intensityMoves: 'present',
  knobs: { level: { base: r3(sea0.level), drive: '', depth: 0 }, contrast: { base: r3(sea0.contrast), drive: '', depth: 0 }, soft: r3(sea0.soft), colour: r3(sea0.colour) },
  intensity: piv([[0.6, 0], [0.93, 0.02], [3.95, 0.1, 'ease'], [8.64, 0.3], [21.1, 0.5], [30, 0.56], [53.4, 0.7], [70, 0.8], [86.2, 0.95], [97, 1], [CUT, 1]]) });
// The reprise: the same sea, foggier (its loudness counted at 0.75), from a hairline again, sinking back to one.
sets['sea-reprise'] = vals(seaNotes(380.6, 466), seaValues(0.75));
const sea1 = seaAt(382, 0.75);
clip({ start: 380.6, end: 466.0, fade: 1, layer: 'sea', widget: 'horizon', listen: 'picks:sea-reprise', intensityMoves: 'present',
  knobs: { level: { base: r3(sea1.level), drive: '', depth: 0 }, contrast: { base: r3(sea1.contrast), drive: '', depth: 0 }, soft: r3(sea1.soft), colour: r3(sea1.colour) },
  intensity: piv([[380.6, 0], [382.28, 0.04], [388, 0.3, 'ease'], [396, 0.55], [412.9, 0.7], [426, 0.55], [440, 0.32], [448.5, 0.2], [455.4, 0.1], [465.4, 0]]) });

// ======================= tracks, ids, write =======================
const BAND = 8, byTrack = new Map();
const overl = (a, b) => a.start < b.end - 5e-4 && b.start < a.end - 5e-4;
for (const c of [...clips].sort((a, b) => a.start - b.start)) {
  let t = LAYER[c.layer] * BAND;
  while ((byTrack.get(t) ?? []).some((o) => overl(o, c))) t++;
  if (Math.floor(t / BAND) !== LAYER[c.layer]) throw new Error(`band overflow ${c.layer} ${c.start}`);
  c.track = t; byTrack.set(t, [...(byTrack.get(t) ?? []), c]);
}
const used = [...byTrack.keys()].sort((a, b) => a - b);
for (const c of clips) { c.track = used.indexOf(c.track); delete c.layer; }
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });
// Each set trimmed to its clips (a pick nobody hears is a warning); nothing may sound in the silence.
const picks = {};
for (const [id, ns] of Object.entries(sets)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  if (!cs.length) continue;
  const kept = ns.filter((n) => cs.some((c) => n[0] >= c.start && n[0] < c.end));
  for (const n of kept) if (n[0] >= CUT && n[0] < 356.4) throw new Error(`${id}: an attack in the silence at ${n[0]}`);
  picks[id] = { notes: kept };
}
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Barber, Adagio for Strings · A · Milk and sea: a Sugimoto horizon born as a hairline, rising and hardening with every swell; rising phrases built as huddled Ivory rows standing on the line (the lower voices\' cells under the water, the stretto in canon); the chant handed over in milky slabs, the bass as milk tiles in the sea; the violas and cellos as murmuration, re-formed into each climax chord\'s figure; pixel sort tearing a little more at each swell until it sorts the sea; the F flat arrival a flood of milk poured into the sea, cut dead; the hymn in milk alone on black',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, tracks 0..${used.length - 1}`);
for (const r of ROWS) console.log(`  ${r.id}: ${r.notes.length} keys ${r.notes[0][0].toFixed(2)}-${r.notes[r.notes.length - 1][0].toFixed(2)} (${r.notes.map((n) => n[2]).join(' ')})`);
for (const [id, s] of Object.entries(picks)) console.log(`  set ${id}: ${s.notes.length} notes`);
console.log(`errors ${errors.length}`, errors.slice(0, 20));
console.log(`warnings ${warnings.length}`, warnings.slice(0, 30));
const ev = clips.flatMap((c) => [[c.start, 1], [c.end, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
let n = 0, most = 0, at = 0; for (const [t, d] of ev) { n += d; if (n > most) { most = n; at = t; } }
console.log('most clips at once', most, 'at', at);
if (!errors.length) { writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show)); console.log(`wrote shows/${ID}.json`); }
