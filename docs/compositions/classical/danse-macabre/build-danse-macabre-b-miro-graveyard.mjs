// Danse macabre, show B: "Miró graveyard". Miró's cream sheet, Rorschach's sepia ink, Death's fiddle scrawling in a
// hole of night, and a fold that mirrors the whole sheet on the devil's tritone.
// Builds shows/danse-macabre-b-miro-graveyard.json from picks.json (this folder; gen-picks.mjs makes it) and the roll.
// Run from the worktree root:  node_modules/.bin/tsx docs/compositions/classical/danse-macabre/build-danse-macabre-b-miro-graveyard.mjs
//
// THE STRANDS (each clip hears its own pick set, sliced to the clip)
// - miro (the ground, a cream sheet that is always there): the TUNE. Its black line wanders with the waltz, a dot or a star
//   on every note of it; the chord tones struck with the tune (roll notes starting with it, held >= 0.4 s) swell into the
//   red, blue and yellow blobs. Six pages: a new sheet at the fugato, the chorale, the woodwind interlude, the
//   recapitulation and the cock-crow (overlapping clips, the newer one fading in over the older).
// - rorschach (just above the sheet: the judged order): the pizzicato bass, the tolls, the drums; the xylophone's bones
//   and the hammered chords fling specks. A sepia blot by day. In the chorale it turns into an indigo rose (sym 6).
// - scribble (Death's fiddle) in a window with blend "over": its black box stays, so wherever Death plays, a soft oval of
//   NIGHT opens in the middle of the sheet and his pen scrawls bone and red inside it. The hole opens only while the fiddle
//   (or theme B, or the tritone) sounds, and it is wider each time: a tear at the tuning, four small pits in the fugato
//   (one per entering voice, critic's pass), a clean hole above the ink for the recapitulation's theme B,
//   nearly all of it in the frenzy. At the cock-crow it is gone; for the farewell a last small hole, closing as the
//   skeletons flee. Rorschach sits ABOVE the hole: the same blot is sepia ink on the sheet and glowing embers in the night.
// - fold (top): a ghost mirror at Death's tuning; one 2-second gesture on the hammered Ab octaves (170.25-172.1), where the
//   bass is the tritone of the home D and the mirror swings flat; the chorale (the Dies irae), slow, turning only with the
//   B pedal; the frenzy, on every note, its folds multiplying blow by blow to a kaleidoscope on the nine last blows.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'danse-macabre', ID = 'danse-macabre-b-miro-graveyard';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const DUR = pack.duration;
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---- notes ----
const roll = [];
for (const o of Object.values(pack.tracks)) for (const [t, e, m, v] of o.notes) roll.push([t, e, m, v]);
roll.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
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
/** The chord struck with each tune note: roll notes starting within 30 ms of it, at least 3 semitones below, held
    >= minDur s; one per pitch class, at most `max`, aligned to the tune note's start (one attack). */
const withChords = (tune, minDur = 0.4, max = 2) => {
  const out = [...tune];
  for (const t of tune) {
    const pcs = new Set([t[2] % 12]); let k = 0;
    for (const n of roll) {
      if (n[0] < t[0] - 0.03) continue; if (n[0] > t[0] + 0.03) break;
      if (n[2] > t[2] - 3 || n[1] - n[0] < minDur || pcs.has(n[2] % 12)) continue;
      pcs.add(n[2] % 12); out.push([t[0], n[1], n[2], n[3]]); if (++k >= max) break;
    }
  }
  return merge(out);
};
const rollIn = (a, b, f = () => true) => merge(roll.filter((n) => n[0] >= a && n[0] < b && f(n)));
/** Heard velocity capped (legato lines: a pitch change must not scratch like a strike). */
const cap = (ns, vmax) => ns.map((n) => (n[3] > vmax ? withValues(n, { intensity: vmax / n[3] }) : n));
const boost = (ns, k) => ns.map((n) => withValues(n, { intensity: k }));
const knobAt = (ns, key, f) => ns.map((n) => { const v = f(n[0]); return v == null ? n : withValues(n.slice(0, 4), { ...(typeof n[4] === 'number' ? { intensity: n[4] } : n[4] ?? {}), [key]: v }); });

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
  if (o.intensity) c.intensity = o.intensity.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v }));
  if (o.moves) c.intensityMoves = 'present';
  clips.push(c);
  return c;
}
// Critic's pass: four night tracks for the fugato's four holes (below the ink: embers), one night track ABOVE the ink for
// the recapitulation's clean hole, and a second fold track for the mirror that creeps in before the frenzy.
const T = { MIRO_A: 0, MIRO_B: 1, NIGHT_A: 2, NIGHT_B: 3, NIGHT_C: 4, NIGHT_D: 5, INK_A: 6, INK_B: 7, NIGHT_TOP: 8, FOLD: 9, FOLD_B: 10 };
/** A hole of night in the middle of the sheet: scribble's own black box, kept ('over'), a feathered oval. */
/** The farewell's last patch of night: a wider, much softer oval, so the lone pen's wide loops (which reach the corners
    of its canvas) still show, in the feathered rim, instead of vanishing behind a hard edge. */
const patch = (w, h) => ({ mode: 'window', shape: 'ellipse', x: 0.5, y: 0.5, w, h, feather: 0.6, fit: 'stretch', blend: 'over' });
const hole = (w, h, y = 0.5) => ({ mode: 'window', shape: 'ellipse', x: 0.5, y, w, h, feather: 0.32, fit: 'stretch', blend: 'over' });
/** A small hole anywhere on the sheet (the fugato's four voices). */
const pit = (x, y, w, h, fit = 'stretch') => ({ mode: 'window', shape: 'ellipse', x, y, w, h, feather: 0.3, fit, blend: 'over' });

// ===== miro: the tune on a cream sheet, six pages =====
// P1 0-121: midnight, the hush, the tuning's open fifths, the waltz, theme A in D, the tutti, the close.
const m1 = merge(
  set('clock-strokes'), set('hush-chord'), set('tuning-fifths'), set('dance-begins'),
  withChords(set('theme-a-flute')), set('harp-chords-31'),
  set('long-notes', 41.3, 55.1),                       // under Death's theme B: only the held notes keep the line going
  withChords(set('theme-a-in-d')), set('winds-56'),
  withChords(set('theme-a-tutti')),
  withChords(set('long-notes', 86.4, 100.6), 0.6, 2),  // theme B tutti belongs to the fiddle; the sheet keeps the long notes
  withChords(set('theme-a-xylophone-d')), set('repeated-d-chords'),
  set('exposition-close'),
);
clip('miro', T.MIRO_A, 0, 123.3, { set: 'm1-waltz', notes: m1, fade: 3 });
// P2 120.3-176: the fugato's upper voices, the brass, the line over the pedals.
const m2 = merge(withChords(set('thread-high', 120.4, 145.4)), set('brass-calls', 145, 149.6), set('pedal-line-high'), set('winds-156'), set('brass-calls', 170, 175.4));
clip('miro', T.MIRO_B, 120.3, 176.0, { set: 'm2-fugato-line', notes: m2, fade: 0.7 });
// P3 174.5-247: the chorale (its long notes swell into big blobs; the harp ripples dots along the line), the build, the second tutti.
const m3 = merge(withChords(set('chorale-top'), 0.6, 3), set('harp-arpeggios'), withChords(set('tutti-c-line')), set('brass-calls', 228, 231.5), set('stop-244'));
clip('miro', T.MIRO_A, 174.5, 247.0, { set: 'm3-chorale', notes: m3, fade: 0.6,
  // the chorale's sky stays and builds (life), the blobs swell bigger: a slow page for a slow hymn
  knobs: { life: 26, swell: 1.35 } });
// P4 245.3-323.5: the woodwind interlude (doubled lanes: chords, so blobs), the cascade, the development, the long build.
const m4 = merge(set('winds-interlude'), set('cascade-262'), withChords(set('development-line')), withChords(set('build-line')), set('repeated-d-303'), set('chromatic-ascent'));
clip('miro', T.MIRO_B, 245.3, 323.5, { set: 'm4-interlude', notes: m4, fade: 1.5 });
// P5 321.5-379.2: the recapitulation's high line and the brass, then the ff blows and the nine last blows (crescents, stains).
// (critic's pass: plus theme A's return, recap-line with its chord tones, and the high thread under it)
const m5 = merge(set('recap-high'), withChords(set('recap-line')), set('thread-high', 337.5, 360.5), set('brass-calls', 338, 345), set('ff-blows'), set('final-hammer'));
clip('miro', T.MIRO_A, 321.5, 379.2, { set: 'm5-blows', notes: m5, fade: 1.0 });
// P6 376.85-end: a clean sheet dissolves in as the last blow dies; the cock-crow, the pale chords of dawn; then the sky
// clears to a few marks (present: life, web and swell go down) and the page goes dark with the last chord.
const m6 = merge(set('cock-crow'), set('dawn-chords'));
clip('miro', T.MIRO_B, 376.85, DUR, { set: 'm6-dawn', notes: m6, fade: 2.2, moves: true,
  intensity: [[376.85, 0.55], [383.5, 0.55], [384.5, 0.9], [395, 0.8], [405, 0.3], [429, 0.2]] });

// ===== rorschach: the pizzicato bass, the tolls, the drums; specks for the bones =====
const r1 = merge(set('grave-pizz'), set('pizz-waltz-bass'), set('bass-tutti-1'), set('hammered-chords-80'), set('xylophone-bones', 100, 116),
  set('exposition-close').filter((n) => n[2] < 55), set('thread-low', 120.4, 149.5));
clip('rorschach', T.INK_A, 13.35, 149.9, { set: 'r1-pizz', notes: r1, fade: 0.5, knobs: { size: 0.7 } });
// the tolls: E2, then A2, struck again and again: a four-way blot
clip('rorschach', T.INK_B, 149.6, 175.7, { set: 'r2-toll', notes: merge(set('pedal-e-toll'), set('pedal-a-toll'), set('brass-calls', 170, 175.4).filter((n) => n[2] < 55)), fade: 0.5,
  knobs: { sym: 2 } });
// the chorale: the slow B pedal opens an indigo rose (cast against type: the violent blot as a still window)
clip('rorschach', T.INK_A, 175.3, 213.4, { set: 'r3-rose', notes: set('chorale-bass'), fade: 1.2, knobs: { sym: 6, ink: 1, fade: 13 } });
// from the build to the frenzy: one long blot strand; quiet in the interlude (present), full in the tutti and the frenzy
const r4 = merge(set('build-213').filter((n) => n[2] < 55), set('bass-tutti-2'), set('xylophone-bones', 230, 240), set('stop-244'),
  set('thread-low', 248, 275), set('bass-development'), set('bass-finale'), set('drum-strikes', 320, 377), set('octave-hammer-g'), set('bass-trill'));
clip('rorschach', T.INK_B, 213.0, 377.6, { set: 'r4-bass', notes: r4, fade: 0.7, knobs: { size: 0.85 }, moves: true,
  intensity: [[213, 1], [244, 1], [248, 0.35], [272, 0.45], [297, 0.8], [322, 1]] });
// the end: Bb-G-D pizzicato, the D major and G minor chords
clip('rorschach', T.INK_A, 423.7, DUR, { set: 'r5-last', notes: merge(set('scurry').filter((n) => n[2] < 60), set('final-pizz')), fade: 1.2, knobs: { size: 0.7 } });

// ===== scribble: Death's fiddle in a hole of night that widens each time =====
clip('scribble', T.NIGHT_A, 18.6, 26.45, { set: 's1-tuning', notes: merge(boost(set('tuning-tritone'), 2)), fade: 0.7, knobs: { weight: 1.8 }, region: hole(0.36, 0.52) });
clip('scribble', T.NIGHT_B, 41.25, 55.95, { set: 's2-theme-b', notes: boost(set('theme-b-solo-violin'), 1.5), fade: 0.8, knobs: { weight: 1.8 }, region: hole(0.44, 0.62) });
clip('scribble', T.NIGHT_A, 68.4, 71.85, { set: 's3-swell', notes: set('build-to-tutti'), fade: 0.5, region: hole(0.5, 0.7) });
clip('scribble', T.NIGHT_B, 86.25, 100.95, { set: 's4-theme-b-tutti', notes: cap(set('theme-b-tutti'), 64), fade: 0.8, region: hole(0.52, 0.72) });
// The fugato (critic's pass): instead of one big hole, ONE SMALL HOLE PER VOICE, each opening at its own entry, so the
// sheet is perforated by night voice by voice as the fugato piles up and crescendos (-41 dB at 121 to -25 dB at 148);
// all four close together as the fugato's last held note dies, just before the tutti E toll at 149.7. Low voices sit low, high ones high, alternating sides.
// The transcription bleeds (the cello track copies the viola's notes), so the voices are told apart by entry and register,
// not by track: the cello's subject at 120.87, the viola's at 122.89, the (second) violins' at 125.05, the upper violins'
// at 130.64. A note goes to the voice whose band it falls in; until that voice has entered, to the highest voice that has.
{
  const ENTRY = [120.85, 122.85, 125.0, 130.6], BAND = (m) => (m < 50 ? 0 : m < 57 ? 1 : m < 64 ? 2 : 3);
  const strings = merge(['cello', 'viola', 'violin'].flatMap((k) => pack.tracks[k].notes.filter((n) => n[0] >= 120.8 && n[0] < 149.6).map((n) => n.slice(0, 4))));
  const voices = [[], [], [], []];
  for (const n of strings) {
    let v = BAND(n[2]); while (v > 0 && n[0] < ENTRY[v] - 0.02) v--;
    if (n[0] >= ENTRY[0] - 0.02) voices[v].push(n);
  }
  const keys = voices.map((vs) => new Set(vs.map((n) => `${Math.round(n[0] * 100)}:${n[2]}`)));
  let shared = 0; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (const k of keys[i]) if (keys[j].has(k)) shared++;
  console.log(`fugato voices: ${voices.map((v) => v.length).join(' / ')} notes, ${shared} shared`);
  const PLACE = [[0.22, 0.72, 'stretch'], [0.78, 0.62, 'stretch'], [0.25, 0.34, 'stretch'], [0.76, 0.26, 'cover']];
  const NAMES = ['s5a-fugato-cello', 's5b-fugato-viola', 's5c-fugato-violins', 's5d-fugato-upper-violins'];
  const TR = [T.NIGHT_A, T.NIGHT_B, T.NIGHT_C, T.NIGHT_D];
  voices.forEach((vs, i) => {
    const [x, y, fit] = PLACE[i];
    clip('scribble', TR[i], ENTRY[i] - 0.15, 149.6, { set: NAMES[i], notes: vs, fade: 0.7,
      knobs: { pens: 1, weight: 2.5 }, region: pit(x, y, 0.24, 0.34, fit) });
  });
}
clip('scribble', T.NIGHT_B, 214.9, 246.4, { set: 's6-build', notes: merge(set('build-213').filter((n) => n[2] > 60), set('xylophone-bones', 230, 240), set('stop-244')), fade: 0.6,
  region: hole(0.62, 0.84) });
// The long build (297-320) stays on the sheet (it is the waltz, Miró's); the night tears open with the chromatic ascent
// (Death's fiddle running up into the return) and holds through the recapitulation, where theme B's harmony returns.
// Critic's pass: the hole now holds only the chromatic ascent and theme B's return (320.15-337.6) and sits ABOVE the ink,
// so its night is clean black (no oxblood haze) with the blot's tendrils reaching out round it onto the sheet. When the
// waltz's repeated Ds come back (338.37) it closes and the recapitulation's theme A belongs to Miró again, so the frenzy's
// night (1.25 × 1.4) bursts in on a bright sheet instead of growing out of a 40-second dark oval.
clip('scribble', T.NIGHT_TOP, 320.15, 337.75, { set: 's7-recap', notes: merge(set('chromatic-ascent'), cap(set('recap-theme-b-line'), 66)), fade: 0.6,
  knobs: { weight: 2 }, region: hole(0.6, 0.82) });
clip('scribble', T.NIGHT_B, 360.6, 377.5, { set: 's9-frenzy', notes: merge(set('frenzy-line'), set('octave-hammer-g').filter((n) => n[2] > 55)), fade: 0.6,
  knobs: { pens: 4 }, region: hole(1.25, 1.4) });
clip('scribble', T.NIGHT_B, 395.5, 418.15, { set: 's10-farewell', notes: set('farewell-violin'), fade: 1.0, knobs: { pens: 1, weight: 2.5, stay: 14 }, region: patch(0.5, 0.64) });   // one pen, heavier: the hole is small
clip('scribble', T.NIGHT_A, 417.9, 424.3, { set: 's11-flee', notes: merge(set('last-trill'), set('scurry')), fade: 0.4,
  knobs: { pens: 2, weight: 2.5 }, region: patch(0.34, 0.44) });

// ===== fold =====
// Death tunes his fiddle: a ghost mirror down the middle; its seam flashes on every tritone and every fifth.
clip('fold', T.FOLD, 18.75, 26.5, { set: 'f1-tuning', notes: merge(set('tuning-tritone'), set('tuning-fifths')), fade: 0.8, knobs: { strength: 0.55, flip: 0, turn: 0 } });   // upright: the hole mirrors onto itself
// The hammered Ab octaves (170.25-172.1): Ab is the tritone of the home D, so the mirror swings flat for two seconds.
// Fold reads its home from the notes it hears, so it also hears the A toll (unseen: strength and seam 0 on those notes):
// A is home, upright; the Ab octaves land 5 fifths away and the mirror swings nearly flat (75 degrees) for two seconds.
const AB = 170.2;
const f2 = merge(set('pedal-a-toll', 162.5, AB), rollIn(AB, 172.1, (n) => n[2] < 50))
  .map((n) => withValues(n.slice(0, 4), n[0] < AB ? { strength: 0, seam: 0 } : { strength: 1, seam: 0.6 }));
clip('fold', T.FOLD, 162.5, 172.15, { set: 'f2-ab-octaves', notes: f2, fade: 0.2, knobs: { flip: 0 } });
// The chorale (Dies irae): a slow mirror on the B pedal, no flips, a faint seam (legato: nothing may flash).
clip('fold', T.FOLD, 175.4, 213.3, { set: 'f3-dies-irae', notes: set('chorale-bass'), fade: 1.5, knobs: { flip: 0, seam: 0.1, strength: 0.9 } });
// The frenzy: every note; chords flip the mirror; the folds multiply blow by blow (the Ab blow at 367.34 lays it flat).
// Critic's pass: the mirror creeps in before the frenzy. Over the dominant pedal (349-361, A with C#, quiet, -26 dB) a
// single fold on the bass notes rises from nothing (its intensity curve), turning with the bass, so Miró's sky and the
// blot slowly become symmetric: the devil gathering. The frenzy's fold takes over at 360.75 and multiplies it.
clip('fold', T.FOLD_B, 349.0, 361.3, { set: 'f-gathering', notes: set('bass-finale', 349, 361), fade: 0.6,
  knobs: { strength: 0.8, seam: 0.2, flip: 0 }, intensity: [[349, 0], [352, 0.3], [357, 0.55], [360.4, 0.85]] });
const foldsAt = (t) => (t < 367.3 ? 1 : t < 371.2 ? 2 : t < 373.95 ? 3 : t < 375.3 ? 4 : t < 375.8 ? 5 : 6);
clip('fold', T.FOLD, 360.75, 377.55, { set: 'f4-frenzy', notes: knobAt(rollIn(360.8, 376.9), 'folds', foldsAt), fade: 0.65 });

// ---- write ----
const show = { version: 3, id: ID, song: SONG,
  title: 'Danse macabre · B · Miró graveyard: Miró\'s cream sheet carries the waltz, Rorschach\'s sepia ink the pizzicato, Death\'s fiddle scrawls in a hole of night that widens each time he plays, and a fold mirrors the sheet on the tritone',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks };
const { errors, warnings } = validateShow(show, { duration: DUR, widgets: loadCatalogue().widgets, tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${clips.length} clips, ${Object.keys(picks).length} sets, ${Object.values(picks).reduce((s, p) => s + p.notes.length, 0)} notes; errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
