// Builds shows/bald-mountain-b-spines-and-bell.json: "Spines and the bell", the nature widgets on a contour map.
// Run from the worktree root: node docs/compositions/classical/bald-mountain/build-bald-mountain-b-spines-and-bell.mjs
// then: npm run check-show -- shows/bald-mountain-b-spines-and-bell.json
//
// THE STORY (Mussorgsky / Rimsky-Korsakov, Night on Bald Mountain, 580 s)
// Night: the mountain is a glowing topographic map (contours, all notes: warm hills where it is loud, cool pits where it
// falls back). The tremolo whirl of the strings lays crimp's ribbons, dead straight while the bow whirls and woolly the
// moment it lands on its held note. A field of dark-teal spines, the gathered spirits, is born on Chernabog's first blow
// (16.35 s) and turns at every blow to stab at it (urchin on the blows); only the 20 biggest blows turn the whole field
// (per-note reach). The field brightens as the spirits gather (per-note ground, stepped on real blows). Mica flashes
// silver on the ff shrieks above C6, cut stands a knife slab on each hammered chord that the next chords crumble, and
// pluck pulls a long thread for every low bass stroke. The quiet D-pedal passages (91.9, 393.7) lay the night page of
// Agnes Martin under the map: the D world the dawn will light.
// The general pause (43.5-45.0) is the one moment of total black. At 440.4 the night breaks off: only the spines and
// the bell's rings remain. The field turns to the bell eleven times (one spot, high in the middle), and at every stroke
// it lies a little lower and darker (per-note ground, stab and reach falling), until it is gone.
// Dawn: the night page returns, and at each of the violins' chromatic rises the next, lighter Martin page fades in
// over it (a chain of 8 pages, paper 0 -> 1, at 463.1, 471.6, 479.2, 485.3, 499.8, 509.4, 517.2, 524.8; crossfading
// neighbours instead of night into day avoids a grey veil): by the last rise to D6 it is day paper. On it the mountain is drawn again as a blue survey map (contours on the rise, the horn
// and the solo), and the harp's threads (pluck, in a full-frame see-through window so they stay solid on the paper).
// The spirits' widgets all draw with 'lighten': in daylight they could not be seen even if they were there.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'bald-mountain-b-spines-and-bell', SONG = 'bald-mountain';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const r3 = (x) => Math.round(x * 1000) / 1000;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const set = (id) => P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]);
const byStart = (a, b) => a[0] - b[0] || a[2] - b[2];
const dedupe = (ns) => { const seen = new Set(); return ns.filter((n) => { const k = `${n[0].toFixed(3)}|${n[2]}`; if (seen.has(k)) return false; seen.add(k); return true; }); };
const union = (...ids) => dedupe(ids.flatMap(set)).sort(byStart);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
/** 40 ms clusters (the widgets' own rule). */
function clusters(ns) {
  const out = []; let cur = null;
  for (const n of [...ns].sort(byStart)) { if (cur && n[0] - cur.t < 0.04) cur.ns.push(n); else { cur = { t: n[0], ns: [n] }; out.push(cur); } }
  return out;
}
/** A note with knob values, in the stored form (keys sorted, rounded). */
const withVals = (n, vals) => {
  const o = {}; for (const k of Object.keys(vals).sort()) o[k] = r4(vals[k]);
  return [r4(n[0]), r4(n[1]), n[2], n[3], Object.keys(o).length === 1 && o.intensity != null ? o.intensity : o];
};
const plain = (n) => [r4(n[0]), r4(n[1]), n[2], n[3]];

// ---------------------------------------------------------------- the pick sets
const peaks = set('ff-peaks').map((n) => n[0]);
const isPeak = (t) => peaks.some((p) => Math.abs(p - t) < 0.08);

// tremolo (crimp): the RAW violin slices inside every whirl gesture (unmerged, so each re-bowing re-straightens the
// ribbon), the top of each 40 ms cluster, plus the held note each gesture lands on.
const VIOLIN = pack.tracks.violin.notes;
const tremolo = [];
for (const [s, e] of set('whirl').map((n) => [n[0], n[1]])) {
  const raw = VIOLIN.filter((n) => n[0] >= s - 0.02 && n[0] < e + 0.02);
  for (const c of clusters(raw)) tremolo.push(c.ns.reduce((a, b) => (b[2] > a[2] ? b : a)));
}
const tremoloSet = dedupe(tremolo).sort(byStart);
// viola tremolo (a second crimp, the critic's addition): the violas whirl with the violins but lower and on the move
// (48-75 against 80-84). Same rule: the top of each 40 ms cluster of the raw viola slices inside each whirl gesture.
// Not in the quiet passages (the D worlds, the low wind hush, the hush at 208): slow quiet music gets no busy red.
const VIOLA = pack.tracks.viola.notes;
const QUIET = [[91.9, 117.8], [161.4, 172], [208.3, 222], [393.7, 405.4]];
const violaTrem = [];
for (const [s, e] of set('whirl').map((n) => [n[0], n[1]])) {
  if (QUIET.some(([a, b]) => s >= a && s < b)) continue;
  const raw = VIOLA.filter((n) => n[0] >= s - 0.02 && n[0] < e + 0.02);
  for (const c of clusters(raw)) violaTrem.push(c.ns.reduce((a, b) => (b[2] > a[2] ? b : a)));
}
const violaSet = dedupe(violaTrem).filter((n) => n[0] < 434).sort(byStart);

// ground(t): how much the resting field shows, the spirits gathering (stepped on real blows only).
const ground = (t) => t < 46 ? 0.18 : t < 73 ? 0.22 : t < 92 ? 0.22 + 0.1 * (t - 73) / 19 : t < 235 ? 0.32 : t < 393 ? 0.35 : t < 404 ? 0.28 : 0.35;
// blows (urchin): Chernabog's blows: ff tutti blows, loud low strokes, the Db strokes, the peaks; one spot per blow
// (its lowest note), at least 0.3 s apart. The 20 peaks turn the whole field.
const blowSrc = union('ff-blows', 'bass-strikes', 'db-blows', 'ff-peaks').filter((n) => n[0] < 440.3);
const blows = [];
for (const c of clusters(blowSrc)) {
  const low = c.ns.reduce((a, b) => (b[2] < a[2] ? b : a)), v = Math.max(...c.ns.map((n) => n[3]));
  const peak = isPeak(c.t), last = blows[blows.length - 1];
  if (last && c.t - last.t < 0.3) { if (peak && !last.peak) blows.pop(); else continue; }
  blows.push({ t: c.t, n: [c.t, low[1], low[2], v], peak });
}
const blowSet = blows.map((b) => withVals(b.n, { ground: ground(b.t), reach: b.peak ? 2 : 1.3, stab: b.peak ? 1 : 0.7 }));

// bell (urchin): one note per stroke, so the field turns to one spot (high in the middle); per stroke the field lies a
// little lower: ground, stab and reach fall; intensity shapes the heard velocity (first stroke faint, then fading).
const strokes = clusters(set('church-bell'));
const HEARD = [62, 100, 96, 92, 88, 84, 78, 72, 66, 58, 50];
const bellSet = strokes.map((c, i) => {
  const n = c.ns.find((x) => x[2] === 62) ?? c.ns[0], k = i / (strokes.length - 1);
  return withVals([n[0], n[1], 62, n[3]], { ground: 0.35 * (1 - k) ** 0.7, stab: 0.4 - 0.32 * k, reach: 2 - 0.9 * k, intensity: Math.min(2, HEARD[i] / n[3]) });
});
// bell-rings (contours): the dying D chord and the strokes on D5, so the rings stand as high as the spines' spot.
const ringSet = [...set('last-chord').filter((n) => n[0] > 440), ...strokes.map((c) => { const n = c.ns[0]; return [n[0], n[1], 74, n[3]]; })].sort(byStart);

const shrieks = union('high-cries', 'octave-cries').filter((n) => n[0] < 440.3);
const chords = union('dim-pulses', 'dominant-hammer', 'eb-climax', 'sabbath-chords', 'hammer-strokes', 'a-major-climax', 'final-build')
  .concat(set('last-chord').filter((n) => n[0] < 440)).sort(byStart);
const bass = set('deep-bass').filter((n) => n[0] < 440.3);
const dWorld = union('d-pedal-repeats', 'octave-cries', 'winds-line').filter((n) => (n[0] >= 91.9 && n[0] < 115.5) || (n[0] >= 393.7 && n[0] < 404.3));
const dawn = union('dawn-rise', 'horn-dawn', 'dawn-pedal', 'wind-solo', 'dawn-chords');
const sunrise = union('dawn-rise', 'horn-dawn', 'wind-solo');
const harp = set('harp');

// ---------------------------------------------------------------- clips
const clips = [];
const T = { MARTIN_NIGHT: 0, MARTIN_DAY: 1, CONTOURS: 2, URCHIN: 3, PLUCK: 4, CRIMP_VLA: 5, CRIMP: 6, CUT: 7, MICA: 8 };
let cid = 0;
/** pivots: [t, v] or [t, v, shape]. */
const curve = (pv) => pv.map(([t, v, shape]) => (shape ? { t: r3(t), v, shape } : { t: r3(t), v }));
function clip(widget, track, start, end, o = {}) {
  const c = { id: `c${++cid}`, start: r3(start), end: r3(end), track, fade: o.fade ?? 1, widget };
  if (o.listen) c.listen = o.listen;
  if (o.knobs) c.knobs = o.knobs;
  if (o.region) c.region = o.region;
  if (o.intensity) c.intensity = curve(o.intensity);
  clips.push(c);
  return c;
}
const FULL_WINDOW = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch' };

// The map is compressed (max 0.81) only where cut's slabs must read over it; elsewhere the storm gets the full map.
const CUT_SPANS = [[73.0, 91.95], [180.2, 190.6], [235.4, 308.2], [352.9, 364.2], [405.4, 440.35]];
const squash = (pv) => pv.map(([t, v, sh]) => [t, v > 0.5 && CUT_SPANS.some(([a, b]) => t >= a && t < b) ? 0.5 + (v - 0.5) * 0.62 : v, sh]);
// Night, the map: all notes. The weight follows the form (and is 0 in the general pause, total black).
clip('contours', T.CONTOURS, 2.0, 440.35, { fade: 0.3, intensity: squash([
  [2.0, 0.3], [3.2, 0.5, 'ease'], [16.0, 0.6], [16.4, 0.9], [30.6, 0.85], [31.5, 0.6], [40.2, 0.65], [40.3, 1, 'hold'],
  [42.4, 0, 'hold'], [45.0, 0.25], [46.9, 0.6, 'ease'], [60.2, 0.6], [60.5, 0.9], [73.2, 0.85], [74, 0.75], [83.6, 0.8], [84, 0.95],
  [91.9, 0.9], [94, 0.45, 'ease'], [115, 0.45], [117.8, 0.75], [118, 1], [129.8, 1], [131, 0.7], [141.7, 0.75], [142, 0.95],
  [146, 0.9], [147, 0.75], [156.3, 0.8], [156.5, 1], [161.4, 1], [163, 0.35, 'ease'], [172, 0.35], [180.3, 0.9], [180.5, 1],
  [190.4, 1], [208.3, 0.6], [209.5, 0.3, 'ease'], [213, 0.42], [235.5, 0.75, 'ease'], [237, 0.5, 'ease'], [298.7, 0.5], [307.4, 0.5],
  [309, 0.75], [322.5, 0.85], [336, 0.85], [338, 0.6], [351, 0.6], [351.5, 1], [363.8, 1], [365, 0.7], [372, 0.9], [379.2, 0.9],
  [380, 0.75], [388.8, 0.8], [389, 0.95], [393.7, 0.9], [396, 0.45, 'ease'], [404, 0.45], [432.6, 1, 'ease'], [440.35, 1],
]) });
// The spirits: born on the first blow, in the field until the bell. Butts the bell clip at 440.35 with fade 0 (same seed:
// the same field, no blink).
clip('urchin', T.URCHIN, 16.3, 440.35, { fade: 0, listen: 'picks:blows', knobs: { ground: 0.18, ring: 1.4, spines: 380 }, intensity: [
  [16.3, 1], [42.4, 1, 'hold'], [42.45, 0, 'hold'], [46.9, 0], [48.5, 1, 'ease'], [161.4, 1], [163.5, 0.55, 'ease'], [172, 0.55],
  [175, 1, 'ease'], [208.3, 1], [209.5, 0.55, 'ease'], [213, 0.55], [220, 1, 'ease'],
] });
clip('urchin', T.URCHIN, 440.35, 462.0, { fade: 0, listen: 'picks:bell', knobs: { ground: 0.35, ring: 2.6, stab: 0.4, reach: 2, spines: 380 } });
// The bell's rings on the map: bone, drifting outward.
clip('contours', T.CONTOURS, 440.35, 462.6, { fade: 0.5, listen: 'picks:bell-rings', knobs: { tint: 0.5, flow: 2, decay: 5 } });
// The tremolo whirl: crimp, from the first trill out of the silence to the last whirl. Both crimps (violins, violas)
// draw in one GALE window: their whole picture enlarged 1.2x (same aspect, no distortion) and tilted 16 degrees up to
// the right, so the whirl flies up the mountain on a slant. The critic first tried the violas alone at 28 degrees,
// crossing the violins' level band: it read as a struck-through sign. Parallel, it reads as wind.
const GALE = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1.2, h: 1.2, rot: -16, feather: 0, fit: 'stretch' };
clip('crimp', T.CRIMP, 2.0, 434.0, { fade: 0.2, listen: 'picks:tremolo', region: GALE, intensity: [[2, 1], [42.4, 1, 'hold'], [42.45, 0, 'hold'], [45.0, 0], [45.3, 1]] });
// The violas' whirl: a second crimp on the same slant, lower and on the move (it follows the violas' pitch, which the
// violins' band does not). Fewer fibres (9 against 15): the violins lead. It rests under cut's hammered chords, so
// the slabs lead there (and at most six layers play at once).
const VLA_SPANS = [[16.0, 73.0], [117.5, 180.2], [190.6, 235.4], [308.2, 352.9], [364.2, 393.7]];   // not under cut, not in the D worlds
for (const [a, b] of VLA_SPANS) {
  clip('crimp', T.CRIMP_VLA, a, b, { fade: 0.3, listen: 'picks:viola-tremolo', region: GALE, knobs: { fibres: 9 },
    intensity: a < 42 ? [[a, 1], [42.4, 1, 'hold'], [42.45, 0, 'hold'], [46.9, 0], [47.5, 1]] : undefined });
}
// The deep bass: pluck's long low threads.
clip('pluck', T.PLUCK, 5.5, 440.35, { fade: 0.3, listen: 'picks:bass', intensity: [[5.5, 1], [42.4, 1, 'hold'], [42.45, 0, 'hold'], [46.9, 0], [47.5, 1]] });
// The shrieks: mica.
// spread 300 and size 72 (defaults 120, 56): a shriek glints across the whole sky, not in a band at its pitch.
clip('mica', T.MICA, 22.5, 440.35, { fade: 0.3, listen: 'picks:shrieks', knobs: { spread: 300, size: 72 }, intensity: [[22.5, 1], [42.4, 1, 'hold'], [42.45, 0, 'hold'], [46.9, 0], [47.5, 1]] });
// The hammered chords: cut, one clip per passage (each passage's loudness is its own).
// grain 0.08 (default 0.4), steps 5 (default 8), size 0.9: fewer, larger slabs that wear to fine sugar, so the newest
// chord stands out as the sharp one.
for (const [a, b] of CUT_SPANS) {
  clip('cut', T.CUT, a, b, { fade: 0.3, listen: 'picks:chords', knobs: { wet: 0.15, size: 0.9, grain: 0.08, steps: 5 } });
}
// The D world: Martin's night page under the quiet D-pedal passages.
clip('martin', T.MARTIN_NIGHT, 91.95, 116.5, { fade: 2.5, listen: 'picks:d-world', knobs: { paper: 0 } });
clip('martin', T.MARTIN_NIGHT, 393.7, 405.35, { fade: 2, listen: 'picks:d-world', knobs: { paper: 0 } });

// Dawn.
const PAGES = [[462.6, 0], [471.62, 0.14], [479.23, 0.28], [485.25, 0.42], [499.83, 0.57], [509.44, 0.71], [517.24, 0.85], [524.77, 1]];
PAGES.forEach(([t, paper], i) => {
  const next = PAGES[i + 1], end = next ? next[0] + 6 : 579.6;
  // wash rises through the middle pages (default 0.55): the dawn passes through rose and blue, not through grey.
  const wash = [0.55, 0.75, 0.9, 1, 1, 0.9, 0.72, 0.55][i];
  clip('martin', i % 2 ? T.MARTIN_DAY : T.MARTIN_NIGHT, t, end, { fade: i ? 0 : 1, listen: 'picks:dawn', knobs: { paper, wash },
    // the last page holds the final D chord (to 577.0) and goes out in the silence, slowly: no cut without a note.
    intensity: next ? [[t, 0], [t + 5, 1, 'ease']] : [[t, 0], [t + 5, 1, 'ease'], [577.0, 1], [579.5, 0, 'ease']] });
});
clip('contours', T.CONTOURS, 462.9, 577.5, { fade: 2, listen: 'picks:sunrise', knobs: { tint: 0.15, decay: 6, flow: 1.2, lines: 10 } });
for (const [a, b] of [[489.4, 498.5], [529.2, 540.5], [571.2, 577.6]]) {
  clip('pluck', T.PLUCK, a, b, { fade: 0.3, listen: 'picks:harp', region: FULL_WINDOW });
}

// ---------------------------------------------------------------- picks: only the notes inside a clip that hears them
const sets = {
  blows: blowSet, bell: bellSet, 'bell-rings': ringSet.map(plain), tremolo: tremoloSet.map(plain), 'viola-tremolo': violaSet.map(plain), bass: bass.map(plain),
  shrieks: shrieks.map(plain), chords: chords.map(plain), 'd-world': dWorld.map(plain), dawn: dawn.map(plain),
  sunrise: sunrise.map(plain), harp: harp.map(plain),
};
const picks = {};
for (const [id, ns] of Object.entries(sets)) {
  const users = clips.filter((c) => c.listen === `picks:${id}`);
  const kept = ns.filter((n) => users.some((c) => n[0] >= c.start && n[0] < c.end)).sort(byStart);
  picks[id] = { notes: kept };
  console.log(`${id.padEnd(11)} ${String(kept.length).padStart(5)} notes, ${clusters(kept).length} attacks`);
}
clips.sort((a, b) => a.start - b.start || a.track - b.track);
const show = {
  version: 3, id: ID, song: SONG,
  title: 'Night on Bald Mountain · B · Spines and the bell: contours map (all notes), urchin spines on the blows and the bell, crimp on the tremolo whirl, mica on the shrieks, cut on the hammered chords, pluck on the bass and the harp, Martin night to day',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
writeFileSync(join(ROOT, `shows/${ID}.json`), JSON.stringify(show, null, 1) + '\n');
console.log(`shows/${ID}.json: ${clips.length} clips`);
