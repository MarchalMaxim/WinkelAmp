// Gymnopédie (jazz), show B: "Grain and ennui". A new family, dots and stains: Lazy's huge green stains lie under
// everything and can't be bothered; pointillist dusk dots for the comping; two halftone screens (a coarse red one for the
// bass, a fine pale one for the brushes, hats and the tick figure); a cell of a mosaic for each melody note; amber gliss
// smoke for the runs and the fills.
// Builds shows/gymnopedie-jazz-b-grain-and-ennui.json from picks.json (this folder; gen-picks.mjs makes it), the pack's
// notes and b-grain-and-ennui-brushes.json (the brushes heard from the audio; b-grain-and-ennui-brushes.py makes it).
// Run from the worktree root:
//   node_modules/.bin/tsx docs/compositions/classical/gymnopedie-jazz/build-gymnopedie-jazz-b-grain-and-ennui.mjs
//
// THE PLAN (sections from ANALYSIS.md)
//   0-13.8   A0 vamp: a deliberate spare entrance. Pointillism ALONE ON BLACK: each beat-2 chord dabs a burst, each
//            delay echo a smaller, softer one; the dots settle into dusk fields. Nothing else.
//   13.8     A1: the tick figure enters -> the pale screen's first ripples, and Lazy's heap seeps in under it (0 -> 0.35
//            by the ride at 28.3). 15.57 the faint downbeat bass -> the red screen's first slow swells.
//   28.3     A2: brushes, hats and ride (from the AUDIO's 5-11 kHz percussive onsets) -> the pale screen fills.
//   69.2     the band: the bass (G2 at 69.2, which the pack misses, added from the audio) swells the red screen at full
//            size, the beat-2 "pah" chords take over the dots.
//   76.7     the tune: the mosaic opens, a cell for each melody note (Satie's held, voiced-out notes).
//   131.5    cadence: the three steps, then the ff blows (C 133.27, D 134.99): the red screen prints in negative, the dots
//            flinch, and Lazy, which has not stirred once, lets one stain get up (the only notes it hears hard).
//   135-138.5 ring-out: no attacks. The D chord's notes keep sounding until 138.46 (the pack's own ends), so the red
//            screen's last rings and the dots' fields settle while the stain hangs, slowly (nothing new is struck).
//   138.5    C interlude: the vamp returns (the intro picture, over the green now), the mosaic is gone.
//   159.2    D: the tune an octave up: a fresh mosaic.
//   200.8    cadence 2, the same gesture; ring-out 2 (204.2-207.1).
//   207.09   the first drum fill: the first amber smoke. The groove: everything at once, the walking bass (from the audio)
//            on the red screen, the ride and snare on the pale one, the comping in dots, the solo's non-run notes in cells
//            (its blue notes Eb, F, Ab turn their cells cool), the runs and tom fills in smoke. Lazy swells and sours
//            towards acid as the solo climbs (it hears every note and moves for almost none of them).
//   275.2    the closing song: its long falling notes' cells linger and fill the mosaic.
//   285.6    close: C, C-E-G, then the A4+D5 hit (287.30, the loudest note): the last hit asks a stain to get up as the heap fades.
//   287.6    the echo tail: dots on black again (a bookend to the intro), dissolving with the delay. Black from 291.5.
//
// WEIGHTS (intensity per 30 s window; lazy fades, the others use intensityMoves "present", so no note is ever dropped)
//             0    30   60   90   120  150  180  210  240  270
//   lazy      0-.2 .35  .5   .65  .7   .55  .65  .75  .9   1->0
//   dots      1    .8   .7   .6   .7   1    .6   .8   .65  .6->1
//   red       -    .5   .5-1 1    1    .6   1    1    1    1
//   pale      .6   .9   .9   .6   .6   .8   .65  .9   .9   .9
//   cells     -    -    1    1    1    -    1    .7   .8   1
//   gliss     -    -    -    -    -    -    -    1    1    1
//
// KNOBS (only where the concept asks; everything else is our default)
//   lazy  lazy 0.85 on every note (a dead weight that hardly ever stirs: ennui), lazy 0 + lift 1 on the ff blows and the
//         last hit (the only times it bothers); green 0.12 -> 0.78 and fat 0.82 -> 1.45 per note along the piece (the
//         heap swells and sours slowly towards the solo's climax, regardless of the groove; at 0.85 / 1.55 the second
//         preview showed one shapeless acid wash, so the top is held where the stains keep their form); every note's heard
//         loudness capped at the song's median, so only the blows rank hard enough to make a stain get up.
//   pale halftone  grid 13: the brushes are a fine screen next to the bass's coarse one.
//   cells pebble 1 (rounded stains with gaps, not tiles: the dots-and-stains family) and, over the theme's dark green, a
//         "lighten" window (the default "clear" stamp turned cells' dark ground into a brown veil there; first preview);
//         over the groove's bright green the default "clear" (lighten let the green swallow the cells; second preview);
//         stay 4.5 on the closing song's notes (its cells linger and fill the last mosaic).
//   dots  layout 2 (the wheel round the home key) on the groove's comping: the groove's harmony walks round the circle
//         of fifths (G/D, then Em, Am, Dm, F, C), so its dots land round the wheel, not in the theme's field. With 35 comp attacks
//         in 66 s the ring is too sparse to read as one; it only scatters the groove's dots differently.
//   dots  stay 2.5 on the echo tail's notes: the painting dissolves with the delay.
//
// LEGEND: what the previews showed, and the choices off the map
// - Ennui cast literally: the ground hears all 2500 notes and moves for almost none of them. Its heard loudness is capped
//   and its laziness held at 0.85, so the only notes that make it stir are the piece's real blows (the two cadences and the
//   last hit). The lazy-only test render (128-146 s) shows one stain's end curling up on the C blow and hanging through the
//   ring-out: small, as Lazy is; the most it ever bothers.
// - The red screen in negative is kept for the ff blows: velocity x1.07 / x1.1 / x1.05 lifts three of them over halftone's
//   flash threshold (100, 5 notes), and the frames at 133.2 s show the whole screen printed red for an instant.
// - Brushes from the audio: 527 onsets of the 5-11 kHz percussive band (b-grain-and-ennui-brushes.py), placed across the
//   pale plate by how bright each hit is. The pale screen's fine grid also leaves a faint stipple over everything: grain.
// - Two blends for one widget: over the theme's dark green, "lighten" keeps the stains and the cells' pebbles. Over the
//   groove's acid green, "clear" lets the pebbles' dark ground show, and the stains glow only in the gaps between them,
//   like bright grout in a terrazzo floor. Nobody planned that: it turned up in the third preview, and it is the solo's
//   own picture. It lays a warm veil over the green from the solo's first note (215.2 s); the user may prefer it lighter.
// - Bookends: the piece opens on dots alone on black and ends the same way, the echo tail's dabs dissolving into black.
//
// CRITIC'S PASS (2026-11-06)
// - Ennui gets the stage: in each ring-out (the D chord rings with no new attack) the dots, both screens and the
//   mosaic dissolve (their curves drop to 0, so the dots' painting and the screens' waves die out on their own, then the
//   clips' fades), and Lazy is left alone with the one stain it bothered to lift on the blows: 136.4-138.4 and 205.3-207.1.
//   Under the full stack that lift was hidden by rings; alone it is the gesture of the piece. The vamp's bass and ticks
//   (138.46) and the drum fill (207.09) bring everything back, so every return lands on a note. Lazy holds full there.
// - The pale screen's life 0.9 (default 2.2): brushes and ticks are quick ripples; at 2.2 their rings crossed the
//   whole screen and the picture was ring soup. Shape 3 (lines: the brushes as hatching) was tried and dropped: its
//   base screen laid a diagonal hatch veil over every frame.
// - The groove's comping: dot 7 and burst 1.6 on its notes (short, punchy chords), so it is not lost under smoke and pebbles.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'gymnopedie-jazz', ID = 'gymnopedie-jazz-b-grain-and-ennui';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const BR = JSON.parse(readFileSync(join(HERE, 'b-grain-and-ennui-brushes.json'), 'utf8')).hits;
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const DUR = pack.duration;
const r3 = (x) => Math.round(x * 1000) / 1000, r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- notes ----
const roll = pack.notes.map((n) => n.slice(0, 4)).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
const set = (id, a = 0, b = 1e9) => {
  if (!P[id]) throw new Error(`no set ${id}`);
  return P[id].notes.filter((n) => n[0] >= a && n[0] < b).map((n) => n.slice(0, 4));
};
const merge = (...lists) => {
  const seen = new Set(), out = [];
  for (const n of lists.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2])) {
    const k = `${Math.round(n[0] * 100)}:${n[2]}`; if (seen.has(k)) continue; seen.add(k); out.push(n);
  }
  return out;
};
const key = (n) => `${n[0].toFixed(3)}:${n[2]}`;
const without = (ns, drop) => { const d = new Set(drop.map(key)); return ns.filter((n) => !d.has(key(n))); };
const vals = (n) => (n[4] == null ? {} : typeof n[4] === 'number' ? { intensity: n[4] } : { ...n[4] });
const put = (ns, f) => ns.map((n) => { const v = f(n); return v ? withValues(n.slice(0, 4), { ...vals(n), ...v }) : n; });
/** piecewise-linear in song time */
const lin = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (t - a) / (b - a); }
  return pts[pts.length - 1][1];
};

// ---- clips ----
const clips = [], picks = {};
let cn = 0;
/** One clip; its set (if any) is sliced to [start + 0.02, end - 0.05) and stored under its own id. */
function clip(widget, track, start, end, o = {}) {
  const c = { id: `c${++cn}`, start: r3(start), end: r3(Math.min(end, DUR)), track, fade: o.fade ?? 1, widget };
  if (o.notes) {
    const ns = o.notes.filter((n) => n[0] >= c.start + 0.02 && n[0] < c.end - 0.05);
    if (!ns.length) throw new Error(`${o.set}: no notes in ${c.start}-${c.end}`);
    picks[o.set] = { notes: ns };
    c.listen = `picks:${o.set}`;
  }
  if (o.knobs) c.knobs = o.knobs;
  if (o.region) c.region = o.region;
  if (o.intensity) c.intensity = o.intensity.map(([t, v, shape]) => (shape ? { t: r3(t), v, shape } : { t: r3(t), v }));
  if (o.moves) c.intensityMoves = 'present';
  clips.push(c);
  return c;
}
const T = { LAZY: 0, DOTS: 1, RED: 2, PALE: 3, CELLS: 4, SMOKE: 5 };

// The ff blows (C 133.27, D 134.99, C 202.50, D 204.22) and the last hit (287.30): the only real blows of the piece.
const blows = set('cadence-blows');
const lastHit = set('closing-hits', 287.2, 287.4);
const blowStarts = [133.27, 134.99, 202.5, 204.22, 287.29];
const isBlow = (n) => blowStarts.some((b) => Math.abs(n[0] - b) < 0.05);

// ===== lazy: the ground, every note the piano model heard =====
// It hears nothing for ~3.8 s before each cadence's first blow and before the last hit (the steps, the closing chords), and its curve is 1 at the blows (an attack
// thinned away could be the blow), so its slow "jolt" clock is free and the rate has settled when the blow lands.
const deaf = [[129.4, 133.2], [198.6, 202.45], [283.5, 287.25]];   // ~3.8 s: the jolt clock and the rate settle
const vSorted = roll.map((n) => n[3]).sort((a, b) => a - b);
const vCap = vSorted[Math.floor(vSorted.length * 0.5)];
const greenAt = lin([[0, 0.12], [69, 0.25], [76.7, 0.32], [114, 0.45], [135, 0.45], [146, 0.3], [159, 0.32], [184, 0.5], [205, 0.55], [262, 0.78], [292, 0.78]]);
const fatAt = lin([[0, 0.82], [69, 0.88], [114, 1.05], [135, 1.1], [146, 0.95], [159, 0.98], [184, 1.15], [205, 1.2], [262, 1.4], [292, 1.45]]);
const lazyNotes = put(roll.filter((n) => !deaf.some(([a, b]) => n[0] >= a && n[0] < b)), (n) => {
  const base = { green: r4(greenAt(n[0])), fat: r4(fatAt(n[0])) };
  if (isBlow(n)) return { ...base, lazy: 0, lift: 1 };
  return { ...base, lazy: 0.85, ...(n[3] > vCap ? { intensity: r4(vCap / n[3]) } : {}) };
});
clip('lazy', T.LAZY, 13.6, 291.2, { set: 'lazy-all', notes: lazyNotes, fade: 1,
  knobs: { lazy: 0.85, green: 0.12, fat: 0.82 },
  intensity: [[13.8, 0], [28.3, 0.35], [69.2, 0.45], [77, 0.62], [114, 0.7], [131.4, 0.72], [133.1, 1], [138.4, 1], [140, 0.62], [159, 0.55], [184, 0.65],
    [200.7, 0.68], [202.4, 1], [207.1, 1], [208.6, 0.72], [235, 0.82], [253, 0.95], [262, 1], [287.3, 1], [290.4, 0]] });

// ===== pointillism: the comping (the beat-2 chord in every guise), and the delay echoes =====
const dots = merge(
  set('vamp-chords'), set('chord-echoes'), set('pah-chords'), set('cadence-approach'), blows,
  put(set('groove-comp'), () => ({ layout: 2, dot: 7, burst: 1.6 })), set('closing-hits'),   // the groove's short, punchy comping: fat dabs
  put(set('echo-tail'), () => ({ stay: 2.5 })),   // the painting dissolves with the delay
);
// THE RING-OUTS (critic): after each cadence's D blow everything but Lazy dissolves (its curve drops, so its painting
// fades in 2.5 s, then the clip's own fade), and the stains are alone while the chord rings; the vamp's first chord (139.04)
// and the drum fill (207.09) bring the dots back on a clean canvas.
const RO = { a: [135.2, 136.4, 137.0], b: [204.5, 205.3, 205.9] };   // curve starts down, reaches 0, clip ends
const out = (k) => [[RO[k][0], 1], [RO[k][1], 0]];
clip('pointillism', T.DOTS, 0, RO.a[2], { set: 'dots-a', notes: dots, fade: 0.6, moves: true,
  intensity: [[0.3, 1], [27.5, 1], [28.4, 0.8], [69.2, 0.75], [76.7, 0.6], [131.4, 0.6], [133.2, 1], ...out('a')] });
clip('pointillism', T.DOTS, 138.4, RO.b[2], { set: 'dots-b', notes: dots, fade: 0.3, moves: true,
  intensity: [[138.4, 1], [159.2, 1], [160.5, 0.6], [200.6, 0.6], [202.4, 1], ...out('b')] });
clip('pointillism', T.DOTS, 207.0, 292.4, { set: 'dots-c', notes: dots, fade: 0.25, moves: true,
  intensity: [[207.0, 0.9], [252.7, 0.9], [275, 0.6], [285.5, 1]] });

// ===== halftone, the red screen: the bass =====
// low-all: the vamp's faint downbeat bass, the band's oom (with its first G2 at 69.2, which the pack misses: from the audio),
// the groove's walking bass (from the audio). The blows ride along (their low notes swell, the full chord prints the red
// screen in negative: velocity x1.05-1.1 lifts C 133.27, D 134.99 and D 204.22 over the flash's threshold of 100).
const g2 = [[69.2, 70.9, 43, 80]];
const blowBoost = { 133.27: 1.07, 134.99: 1.1, 202.5: 1.0, 204.22: 1.05 };
const red = merge(set('low-all'), g2,
  put(blows, (n) => { const b = Object.keys(blowBoost).find((k) => Math.abs(n[0] - Number(k)) < 0.05); return b && blowBoost[b] !== 1 ? { intensity: blowBoost[b] } : null; }),
  set('closing-hits'));
clip('halftone', T.RED, 14.9, RO.a[2], { set: 'red-a', notes: red, fade: 0.6, moves: true,
  intensity: [[15.3, 0.5], [68.5, 0.5], [69.2, 1], ...out('a')] });
clip('halftone', T.RED, 138.3, RO.b[2], { set: 'red-b', notes: red, fade: 0.15, moves: true,
  intensity: [[138.3, 0.6], [159, 0.6], [160, 1], ...out('b')] });
clip('halftone', T.RED, 207.0, 288.6, { set: 'red-c', notes: red, fade: 0.15, moves: true });

// ===== halftone, the pale screen: the tick figure, A2's high strokes, and the brushes, hats and ride from the audio =====
// The brushes: 5-11 kHz percussive onsets, minus the piano's own transients (within 35 ms of a pack attack and not on a
// YourMT3 drum row), minus the interlude (no cymbals there: what the band hears is the ticks). A hit has no pitch, so its
// place across the screen comes from how bright it is (its band centroid), mapped to MIDI 70-100 (the pale plate is >= 58).
const drumRows = ['ride', 'hats', 'snare', 'crash', 'toms'].flatMap((k) => P[k].notes.map((n) => n[0])).sort((a, b) => a - b);
const near = (arr, t, d) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < t - d) lo = m + 1; else hi = m; } return lo < arr.length && arr[lo] <= t + d; };
const rollT = roll.map((n) => n[0]);
const ticks = set('tick-loop');
const tickT = ticks.map((n) => n[0]);
const brushHits = BR.filter(([t, db]) => t >= 28.2 && t < 287.5 && db >= -32
  && !(t >= 133 && t < 159.2 && !near(drumRows, t, 0.04))
  && !near(tickT, t, 0.035)
  && (!near(rollT, t, 0.035) || near(drumRows, t, 0.04)));
const cs = brushHits.map((h) => h[2]).sort((a, b) => a - b), c5 = cs[Math.floor(cs.length * 0.05)], c95 = cs[Math.floor(cs.length * 0.95)];
const brushes = brushHits.map(([t, db, c]) => [r4(t), r4(t + 0.12), Math.round(70 + 30 * clamp((c - c5) / (c95 - c5), 0, 1)), Math.round(clamp(45 + (db + 27.5) / 23.3 * 55, 35, 105))]);
const pale = merge(ticks, set('high-strokes'), brushes);
const paleKnobs = { grid: 13, life: 0.9 };   // a short life: brushes are quick ripples, not rings that cross the screen (shape 3, lines, was tried: a hatch veil over everything)
clip('halftone', T.PALE, 13.3, RO.a[2], { set: 'pale-a', notes: pale, fade: 0.6, moves: true, knobs: paleKnobs,
  intensity: [[13.6, 0.6], [28, 0.6], [28.4, 0.9], [69.2, 0.9], [76.7, 0.6], ...out('a').map(([t, v]) => [t, v * 0.6])] });
clip('halftone', T.PALE, 138.3, RO.b[2], { set: 'pale-b', notes: pale, fade: 0.15, moves: true, knobs: paleKnobs,
  intensity: [[138.3, 0.8], [159.2, 0.8], [160, 0.65], [RO.b[0], 0.65], [RO.b[1], 0]] });
clip('halftone', T.PALE, 207.0, 288.4, { set: 'pale-c', notes: pale, fade: 0.15, moves: true, knobs: paleKnobs,
  intensity: [[207, 0.9]] });

// ===== cells: a cell for each melody note =====
// A full-frame window (its own canvas) laid on with "lighten", so the mosaic's dark ground never veils the stains.
const glass = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch', blend: 'lighten' };
const pebbles = { pebble: 1 };
clip('cells', T.CELLS, 76.35, RO.a[2], { set: 'cells-theme', notes: set('theme-a'), fade: 0.4, region: glass, knobs: pebbles });
clip('cells', T.CELLS, 159.4, RO.b[2], { set: 'cells-return', notes: set('theme-b'), fade: 0.6, region: glass, knobs: pebbles });
// The groove: the solo's notes that are not in its sixteenth runs (those are smoke), its hardest notes, then the closing song.
const solo = merge(without(set('solo-line'), set('solo-runs')), set('solo-accents'));
const closing = put(set('lead-descent'), () => ({ stay: 4.5 }));
// Here the stains are bright acid green, and "lighten" let them swallow the cells (seen in the second preview): this
// window keeps the default "clear" stamp, so the cells stay vivid; its faint warm veil reads as smoke over the sour green.
clip('cells', T.CELLS, 214.9, 287.6, { set: 'cells-solo', notes: merge(solo, closing), fade: 0.8, region: { ...glass, blend: undefined }, knobs: pebbles, moves: true,
  intensity: [[214.9, 0.7], [240, 0.8], [274.5, 0.8], [275.2, 1]] });

// ===== gliss: amber smoke on the runs and the fills =====
// Gliss makes one bell per sweep (notes closer than 0.8 s); a sweep longer than 6 s only shows its fast climbs. So the
// set is built from windows that each make one sweep: the fills (drums; their "pitch" is the GM key, so the bell's
// height is small), the piano's runs, and tom runs where no piano run is near.
const runWins = [
  [207.05, 207.85],                 // the first fill: snare, snare, tom, tom, kick
  [211.1, 212.95],                  // the eight-stroke tom run
  [222.45, 225.05],                 // the solo's first run with the toms under it
  [235.9, 239.45],                  // solo run 1 (sixteenths around A5)
  [243.7, 245.7], [247.45, 250.1],  // tom figures with the piano
  [250.9, 252.3], [253.9, 254.9],   // solo runs
  [258.55, 259.2], [260.4, 261.5], [262.6, 263.55],
  [266.2, 268.6],                   // toms into the last solo run
  [269.4, 274.45],                  // the solo's last climbs to C7 with the tom figures
];
const inWin = (n) => runWins.some(([a, b]) => n[0] >= a && n[0] < b);
const smoke = merge(
  set('drum-fill').filter(inWin), set('solo-runs').filter(inWin), set('toms', 205).filter(inWin),
  roll.filter((n) => inWin(n) && n[2] >= 57 && ((n[0] >= 222.45 && n[0] < 225.05) || (n[0] >= 243.7 && n[0] < 250.1) || (n[0] >= 269.4 && n[0] < 274.45))),
);
clip('gliss', T.SMOKE, 206.9, 276.2, { set: 'smoke-runs', notes: smoke, fade: 0.5 });

// ---- report: the sweeps gliss will make (its own rule), so none is lost to the 6 s limit ----
{
  const at = []; for (const n of smoke) { const l = at[at.length - 1]; if (l && n[0] - l < 0.04) continue; at.push(n[0]); }
  let from = 0; const sw = [];
  for (let i = 1; i <= at.length; i++) { if (i < at.length && at[i] - at[i - 1] < 0.8) continue; sw.push([at[from], at[i - 1], i - from]); from = i; }
  console.log('gliss sweeps:', sw.map(([a, b, k]) => `${a.toFixed(2)}-${b.toFixed(2)} (${k}${b - a > 6 ? ' TOO LONG' : ''})`).join(', '));
  console.log(`brushes kept ${brushes.length} of ${BR.length}; lazy cap v${vCap}; lazy hears ${lazyNotes.length}`);
}

// ---- write ----
const show = { version: 3, id: ID, song: SONG,
  title: 'Gymnopédie (jazz) · B · Grain and ennui: Lazy\'s green stains under everything (all notes; they stir only on the ff blows), pointillist dusk dots for the comping, halftone\'s coarse red screen for the bass and fine pale screen for the brushes and ticks, a cell for each melody note, amber gliss smoke on the runs and fills',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks };
const { errors, warnings } = validateShow(show, { duration: DUR, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, ${Object.values(picks).reduce((s, p) => s + p.notes.length, 0)} notes; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
