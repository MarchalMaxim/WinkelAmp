// Builds shows/bald-mountain-a-black-mass.json: "Black mass" on Mussorgsky's Night on Bald Mountain.
// Run from the worktree root: node_modules/.bin/tsx docs/compositions/classical/bald-mountain/build-bald-mountain-a-black-mass.mjs
//
// The score (bottom -> top; every motif clip listens to its own pick set, the notes one hears as that strand):
//   horizon      <- all notes, dawn only. Its curve moves how present (0 -> 1 over two minutes): the sunrise itself.
//   rorschach    <- the low line (deep bass + the cellos' lowest held notes, below G3): Chernabog's ink. Per-note blot size:
//                   huge in the brass blasts (the mirrored ink opens like wings), small pulses on the D pedal, growing
//                   through the final build. In the low wind hush (the darkest sound of the piece) it turns soot and gold.
//   strings      <- the violins' and violas' notes inside each whirl gesture: the whirl. Its curve moves how present, so the
//                   pp trill is one calm crossing and the din knots up. Cold (ink blue) for the octave shrieks over the
//                   D pedal, one clean thread for the hush at 208 s, and at dawn recast as the harp: a gold band laid on
//                   the horizon line (a strip window).
//   squares      <- the low blows (ff bass strikes, the Db chord strokes, the ff blows' lowest notes). The six Db strokes
//                   shrink one by one as they die away.
//   flee         <- all notes, only in the densest shrieking stretches (never on picks).
//   blocks       <- the climax strokes (hammering, Bb hammer, Eb climax, the 30 hammer strokes, A major climax, last build).
//   murmuration  <- a small flock first, in a window, at the diminished pulses (the spirits gathering); then the sabbath
//                   flock (the melody, its chord strokes re-forming it into their figures). At the church bell it is alone:
//                   every stroke (D2 + D4, found in the audio) re-forms it into one figure, a clock hand pointing at D,
//                   drained of red; it dissolves as the dawn rises.
//   current      <- the dawn's line: the violins' chromatic rises, the horn answers, the wind solo. One lone white-gold thread.
//   casket       <- the 20 biggest blows of the piece (ff-peaks: a sparse set, so every one of them cuts and nothing else).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show';
import { withValues } from '../../../../src/studio/show/note-values';
import { loadCatalogue } from '../../../../scripts/node/catalogue';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const ID = 'bald-mountain-a-black-mass', SONG = 'bald-mountain';
const picksIn = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'songs', SONG, 'pack.json'), 'utf8'));
const S = (id) => { const s = picksIn[id]; if (!s) throw new Error(`no set ${id}`); return s.notes.map((n) => [n[0], n[1], n[2], n[3]]); };
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
const iv = (pts) => pts.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v }));
const inAny = (t, spans) => spans.some(([a, b]) => t >= a && t < b);
const within = (ns, a, b) => ns.filter((n) => n[0] >= a && n[0] < b);
/** Sorted, exact duplicates (same start and pitch) dropped. */
const merge = (...lists) => {
  const seen = new Set(), out = [];
  for (const n of lists.flat().sort((a, b) => a[0] - b[0] || a[2] - b[2])) {
    const k = `${n[0].toFixed(3)}:${n[2]}`; if (seen.has(k)) continue; seen.add(k); out.push(n);
  }
  return out;
};
/** Group into attacks (a note joins when it starts < 40 ms after the attack's first). */
const attacks = (ns) => {
  const out = [];
  for (const n of [...ns].sort((a, b) => a[0] - b[0])) { const l = out[out.length - 1]; if (l && n[0] - l[0][0] < 0.04) l.push(n); else out.push([n]); }
  return out;
};
const picks = {};
const put = (id, notes) => { if (!notes.length) throw new Error(`${id}: empty`); picks[id] = { notes }; return `picks:${id}`; };
const TR = pack.tracks;

// ================= the pick sets =================

// ---- ink: the low line, one drop per low attack (0.12 s apart, the lower kept). Blot size per note tells the story.
const BRASS = [[16.1, 30.6], [60.3, 73.2], [180.3, 190.4]];
const PEDAL = [[30.6, 40.3], [91.9, 115], [393.7, 404]];
function lowLine(a, b) {
  const raw = merge(S('deep-bass'), S('cellos-line').filter((n) => n[2] < 55)).filter((n) => n[0] >= a && n[0] < b && !inAny(n[0], PEDAL));
  const out = [];
  for (const n of raw) { const p = out[out.length - 1]; if (p && n[0] - p[0] < 0.12) { if (n[2] < p[2]) out[out.length - 1] = n; } else out.push(n); }
  return merge(out, within(S('d-pedal-repeats'), a, b));
}
const inkSize = (t) => {
  if (inAny(t, BRASS)) return 2.1;                                    // Chernabog's wings
  if (inAny(t, PEDAL)) return 0.55;                                   // the D struck again and again: small pulses
  if (t >= 404) return curve([[404, 0.9], [430, 2.2], [440, 2.4]])(t); // the final build swells to the last chord
  if (t >= 235.5) return 1.15;                                        // the sabbath
  return 1;
};
const inkOf = (ns) => ns.map((n) => withValues(n, { size: r3(inkSize(n[0])) }));
const ink1 = put('ink-1', inkOf(lowLine(3, 42.45)));
const ink2 = put('ink-2', inkOf(lowLine(45, 161.3)));
const inkHush = put('ink-hush', S('low-wind-hush').map((n) => withValues(n, { size: 1.7 })));
const ink3 = put('ink-3', inkOf(lowLine(172, 440.4)));
// (critic) the rose window's ink: the same low line in the Eb climax, at size 0.8 so the eight folds stay eight separate
// petals (at the wings' 2.1 they flood into one disc within a second).
const inkRose = put('ink-rose', lowLine(180, 190.6).map((n) => withValues(n, { size: 0.8 })));

// ---- whirl: the violins' and violas' notes inside each whirl gesture (the analyst's whirl set marks the gestures).
const WH = S('whirl'), STR = merge(TR.violin.notes, TR.viola.notes).map((n) => [n[0], n[1], n[2], n[3]]);
const whirlNotes = (a, b) => STR.filter((n) => n[0] >= a && n[0] < b && WH.some((g) => n[0] >= g[0] - 0.02 && n[0] < g[1]));
const shimmer = S('opening-shimmer');
const whirl1 = put('whirl-1', merge(within(shimmer, 0, 4), whirlNotes(3.2, 42.4)));
const whirl2 = put('whirl-2', merge(within(shimmer, 44, 48), whirlNotes(46.9, 99)));
const cries = put('cries', merge(within(S('octave-cries'), 99, 116), within(S('winds-line'), 99, 116)));
const whirl3 = put('whirl-3', whirlNotes(117.5, 208.2));
const hush = put('hush', S('hush-208'));
const whirl4 = put('whirl-4', whirlNotes(213, 393.5));
const cries2 = put('cries-2', merge(within(S('octave-cries'), 393, 405), within(S('winds-line'), 393, 405)));
const whirl5 = put('whirl-5', whirlNotes(404, 440.3));
const harp = put('harp', S('harp'));

// ---- dread: the low blows. Size by how hard; the Db chord strokes shrink as they die away.
const lowest = (ns) => attacks(ns).map((a) => a.reduce((b, n) => (n[2] < b[2] ? n : b)));
const blows = merge(S('bass-strikes'), lowest(S('ff-blows')).filter((n) => n[2] < 55));
const db = S('db-blows'), dbAtt = attacks(db);
const dbSize = new Map();
for (const [a, b] of [[28.8, 30.1], [69.2, 70.8]]) {
  const grp = dbAtt.filter((x) => x[0][0] >= a && x[0][0] < b);
  grp.forEach((x, i) => x.forEach((n) => dbSize.set(n, 1.6 - 1.05 * i / Math.max(1, grp.length - 1))));
}
const dread = merge(blows.filter((n) => !db.some((d) => Math.abs(d[0] - n[0]) < 0.05)), db)
  .map((n) => withValues(n, { size: r3(dbSize.get(n) ?? clamp(0.8 + (n[3] - 85) / 35, 0.75, 1.6)) }));
const dread1 = put('dread-1', within(dread, 15, 42.45));
const dread2 = put('dread-2', within(dread, 59, 440.4));

// ---- tears: the climax strokes for the glitch blocks.
const tears = put('tears', merge(
  S('dominant-hammer'), within(S('ff-blows'), 117.8, 129.8), within(S('bass-strikes'), 156.3, 161.4), S('eb-climax'),
  S('hammer-strokes'), S('a-major-climax'), within(S('final-build'), 420, 440.4)));

// ---- spirits: the diminished pulses with every note of each chord (the full chord makes the flock's figure).
const ALL = merge(pack.notes, ...Object.values(TR).map((t) => t.notes)).map((n) => [n[0], n[1], n[2], n[3]]);
const spiritT = attacks(S('dim-pulses')).map((a) => a[0][0]);
const spirits = put('spirits', merge(...spiritT.map((t) => ALL.filter((n) => Math.abs(n[0] - t) < 0.035))));

// ---- flock: the sabbath. The melody makes the ribbon, the chord strokes re-form the flock into their figures.
//      Then the church bell: 11 strokes on D found in the audio (chroma: D is the strongest class at 10 of the 11),
//      written as D2 + D4. Their velocity is ours (the audio is at -28 to -33 dB): loud enough to re-form the flock,
//      with bleed 0 so the figure is drained of red, and a crisp, held figure: a clock hand pointing at D.
const bell = S('church-bell').map((n) => withValues([n[0], n[1], n[2], 96], { bleed: 0, tight: 0.9, hold: 3.2, strike: 1 }));
const flock = put('flock', merge(
  within(S('melody'), 221, 438), S('sabbath-chords'), S('hammer-strokes'), S('a-major-climax'), within(S('final-build'), 404, 440.4),
  S('last-chord'), bell,
  // daybreak: the night's flock, drained of red and loosened, follows the violins' first four chromatic rises and thins
  // away (between the rises it still sinks into its dark knot: the night's last breaths; gone before the harp)
  within(S('dawn-rise'), 462, 490).map((n) => withValues(n, { bleed: 0, tight: 0.35 }))));

// ---- (critic) amen: the harp's last arpeggio climbs D-A-D-F#-A-D and completes D major when its top D5 lands (574.71);
//      all four upper notes are sounding then (piano track, held to 577.52). Written as one chord at that attack, it
//      re-forms the flock one last time, on the same clock the bell struck: the bell's lone hand at D becomes the D major
//      triangle, its spoke still pointing at D. Velocity 84 is ours (the harp is pp), loud enough to form a figure.
const amen = put('amen', [62, 66, 69, 74].map((m) => withValues([574.71, 577.52, m, 84], { bleed: 0, tight: 0.92, hold: 6, strike: 1 })));

// ---- the dawn's line for the current's lone thread.
const dawn = put('dawn-line', merge(S('dawn-rise'), S('horn-dawn'), S('wind-solo')));

// ---- the casket: the 20 biggest blows.
const cuts = put('cuts', S('ff-peaks'));

// ================= the clips =================
const LAYER = { horizon: 0, rorschach: 1, strings: 2, squares: 3, flee: 4, blocks: 5, murmuration: 6, current: 7, casket: 8 };
const clips = [];
const C = (widget, start, end, o = {}) => clips.push({ id: '', start, end, track: 0, fade: o.fade ?? 0.5, widget, ...o });
const X = 42.45;   // the A chord is cut off: everything stops (the general pause is black)

// ---- Part I (0-42.45) and its return a semitone up (45-91.9 and on)
C('strings', 2.0, X, { fade: 0.15, listen: whirl1, intensityMoves: 'present',
  intensity: iv([[2.0, 0], [3.2, 0.15], [16, 0.85, 'ease'], [28.9, 0.85], [30.6, 0.45], [40.3, 0.5], [41.1, 1]]) });
C('rorschach', 3.0, X, { fade: 0.15, listen: ink1, intensity: iv([[3.0, 0.75], [16.1, 1], [30.6, 0.8], [40.3, 1]]) });
C('squares', 15.8, X, { fade: 0.15, listen: dread1 });
C('casket', 16, X, { fade: 0.15, listen: cuts });

C('strings', 44.9, 98.9, { fade: 0.2, listen: whirl2, intensityMoves: 'present',
  intensity: iv([[44.9, 0.1], [46.9, 0.15], [60.3, 0.9, 'ease'], [73.2, 0.9], [74, 0.6], [83.6, 1], [91.9, 1], [93, 0.35]]) });
C('rorschach', 46.5, 161.3, { fade: 0.5, listen: ink2,
  intensity: iv([[46.5, 0.75], [60.3, 1], [91.9, 1], [94, 0.7], [115, 0.7], [117.8, 1], [146, 1], [156.3, 1], [161.3, 0.6]]) });
C('squares', 59.5, 440.4, { fade: 0.3, listen: dread2,
  intensity: iv([[59.5, 1], [91.9, 1], [93, 0.4], [115, 0.4], [117.8, 1], [161.3, 1], [162, 0.2], [172, 0.6], [180.3, 1], [208.3, 0.5],
    [213, 0.4], [235.5, 1], [393.7, 0.5], [404, 0.5], [425, 1]]) });
C('casket', 60, 440.4, { fade: 0.2, listen: cuts });
// the spirits gather: a small flock in an oval window, re-formed by each diminished pulse
C('murmuration', 73.0, 92.5, { fade: 0.6, listen: spirits, knobs: { hold: 1.4 },
  region: { mode: 'window', shape: 'ellipse', x: 0.5, y: 0.47, w: 0.42, h: 0.62, feather: 0.35, fit: 'contain' } });
C('blocks', 83.3, 92.2, { fade: 0.2, listen: tears });

// ---- Part III: the shrieks over the D pedal, cold threads (ink blue) over small ink pulses
C('strings', 98.8, 117.6, { fade: 0.8, listen: cries, knobs: { heat: 0 }, intensityMoves: 'present', intensity: iv([[98.8, 0.4], [112, 0.6], [115, 0.3]]) });

// ---- Part IV: the outburst, the dialogue, the Bb strikes, the high figure, the Bb hammer
C('strings', 117.2, 208.4, { fade: 0.3, listen: whirl3, intensityMoves: 'present',
  intensity: iv([[117.2, 1], [129.8, 0.7], [141.7, 1], [161.4, 0.2], [172, 0.3], [179.8, 0.75, 'ease'], [180.6, 0.35], [190.0, 0.35], [190.8, 0.8], [208.3, 0.4]]) });
// (critic) in the Eb climax the threads step back to 0.35 so the rose window leads
C('flee', 117.6, 156.6, { fade: 0.4,
  intensity: iv([[117.6, 1], [129.8, 1], [131, 0.25], [140.5, 0.25], [141.7, 1], [156.3, 1]]) });
C('blocks', 117.6, 130.4, { fade: 0.2, listen: tears });
C('blocks', 156.0, 162, { fade: 0.2, listen: tears });
// the low wind hush: the darkest sound of the piece, soot and gold ink alone
C('rorschach', 161.0, 173.5, { fade: 1.2, listen: inkHush, knobs: { ink: 2 } });

// ---- Part V: the build, the Eb climax (Chernabog glorified), the hush at 208, the C# minor crescendo
// (critic) Chernabog glorified: for the ten seconds of the Eb climax the one-fold ink opens into an eight-fold kaleidoscope,
// a rose window of oxblood: the only time in the piece the mirror changes. The crossfades sit on the blast's first blow
// (180.3) and on its release (190.4), so the window blooms on a note and folds back on the subsiding line.
const INK3_IV = iv([[171.5, 0.7], [180.3, 1], [190.4, 0.85], [208.3, 0.15], [213, 0.2], [235.5, 0.85], [393.7, 0.65], [404, 0.65], [425, 1]]);
C('rorschach', 171.5, 180.5, { fade: 0.3, listen: ink3, intensity: INK3_IV.filter((p) => p.t <= 180.3) });
C('rorschach', 180.05, 193.2, { fade: 0.3, listen: inkRose, knobs: { sym: 8 }, intensity: iv([[180.05, 1], [190.4, 0.85], [193, 0, 'ease']]) });
C('rorschach', 190.3, 440.4, { fade: 0.4, listen: ink3, intensity: INK3_IV.filter((p) => p.t >= 190.4) });
C('blocks', 180.0, 190.6, { fade: 0.2, listen: tears });
C('strings', 207.0, 213.9, { fade: 0.4, listen: hush, intensityMoves: 'present', intensity: iv([[207, 0.08]]) });
// in the sabbath the threads step back (fewer of them, fainter) so the flock leads
C('strings', 213.0, 393.8, { fade: 0.4, listen: whirl4,
  intensity: iv([[213, 0.15], [235.5, 0.6, 'ease'], [298.7, 0.6], [307.4, 0.45], [336, 0.45], [351.1, 0.8], [364, 0.6], [393.7, 0.6]]) });
// the flock gathers through the crescendo and rules the sabbath, through the last chord, the bell, into the dawn
C('murmuration', 221.0, 491, { fade: 0.8, listen: flock, knobs: { strike: 0.8 },
  intensity: iv([[221, 0.2], [235.5, 1, 'ease'], [462.9, 1], [479, 0.75], [488.8, 0.3], [490.6, 0]]) });

// ---- Part VI: the sabbath
C('blocks', 298.4, 307.8, { fade: 0.15, listen: tears });  // the 30 hammer strokes: every one tears the picture
C('flee', 322.3, 336.2, { fade: 0.4 });
C('blocks', 351.0, 364, { fade: 0.2, listen: tears });
C('flee', 371.8, 389.0, { fade: 0.4, intensity: iv([[371.8, 1], [379.2, 1], [381, 0.5], [388.8, 0.5]]) });

// ---- Part VII: the D pedal recalled, the final build, the last chords
C('strings', 393.3, 405.0, { fade: 0.6, listen: cries2, knobs: { heat: 0 }, intensityMoves: 'present', intensity: iv([[393.3, 0.4], [404, 0.6]]) });
C('strings', 404.0, 440.4, { fade: 0.4, listen: whirl5, intensityMoves: 'present', intensity: iv([[404, 0.3], [430, 1, 'ease']]) });
C('blocks', 419.8, 440.4, { fade: 0.2, listen: tears });

// ---- Part VIII: the bell (the flock alone), then daybreak
C('horizon', 460.5, 578.2, { fade: 3, intensityMoves: 'present', knobs: { colour: 1 },
  intensity: iv([[460.5, 0], [489.7, 0.35, 'ease'], [529.5, 0.7], [567.9, 1]]) });
C('current', 462.5, 577.6, { fade: 2.5, listen: dawn, knobs: { threads: 1, presence: 0.6, width: 1.9, hue: 45 } });
C('strings', 489.4, 577.6, { fade: 0.6, listen: harp, knobs: { heat: 1, bend: 0 }, intensityMoves: 'present', intensity: iv([[489.4, 0.3]]),
  region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 0.3, feather: 0.4, fit: 'stretch' } });

// (critic) the last gesture: the flock comes back for one chord, the D major the harp completes, over the lit sea.
C('murmuration', 574.66, 578.8, { fade: 0.05, listen: amen, intensity: iv([[574.66, 1], [577.4, 1], [578.7, 0, 'ease']]) });

// ================= trim every set to the clips that hear it; report crowding =================
for (const [id, set] of Object.entries(picks)) {
  const users = clips.filter((c) => c.listen === `picks:${id}`);
  set.notes = set.notes.filter((n) => users.some((c) => n[0] >= c.start + 0.02 && n[0] < c.end - 0.08));
}
{
  const ev = clips.flatMap((c) => [[c.start, 1, c], [c.end, -1, c]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let n = 0; const busy = [];
  for (const [t, d, c] of ev) { n += d; if (n > 6 && d > 0) busy.push(`${t.toFixed(1)}:${n}(${c.widget})`); }
  if (busy.length) console.log('more than 6 at', busy.join(' '));
}

// ================= tracks, ids, check, write =================
const BAND = 4, byTrack = new Map();
const overl = (a, b) => a.start < b.end - 5e-4 && b.start < a.end - 5e-4;
for (const c of [...clips].sort((a, b) => a.start - b.start)) {
  let t = LAYER[c.widget] * BAND;
  while ((byTrack.get(t) ?? []).some((o) => overl(o, c))) t++;
  if (Math.floor(t / BAND) !== LAYER[c.widget]) throw new Error(`band overflow ${c.widget} ${c.start}`);
  c.track = t; byTrack.set(t, [...(byTrack.get(t) ?? []), c]);
}
const used = [...byTrack.keys()].sort((a, b) => a - b);
for (const c of clips) { c.track = used.indexOf(c.track); c.start = r3(c.start); c.end = r3(c.end); }
clips.sort((a, b) => a.start - b.start || a.track - b.track);
clips.forEach((c, i) => { c.id = `c${i + 1}`; });

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Night on Bald Mountain · A "Black mass": Rorschach oxblood ink on the low line, Dread squares on the low blows, Woven threads on the whirl, Flee on the shrieking masses, Murmuration on the sabbath and the church bell, Glitch blocks and the Casket on the climaxes; Horizon and the Current at daybreak',
  composer: { by: 'claude', at: '2026-11-06T18:00:00.000Z' }, clips, picks,
};
const { widgets } = await loadCatalogue();
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks) });
for (const e of [...errors, ...warnings]) console.log(`${e.path}: ${e.message}`);
console.log(`${ID}: ${clips.length} clips, ${Object.keys(picks).length} sets (${Object.entries(picks).map(([k, v]) => `${k} ${v.notes.length}`).join(', ')}); errors ${errors.length}, warnings ${warnings.length}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, 'shows', `${ID}.json`), canonicalShow(show));
