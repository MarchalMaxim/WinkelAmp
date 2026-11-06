// Holst, Mars · C · "Black film": builds shows/holst-mars-c-black-film.json from picks.json (this folder) and the pack.
// Run: node_modules/.bin/tsx docs/compositions/classical/holst-mars/build-holst-mars-c-black-film.mjs
//
// THE IDEA. The war in black and silver, as one reel of film. Four black-ground widgets layered through clear windows:
//   ridges   the FRONT (ground, track 0): every slice of the music a ridgeline. It hears every note the pack has plus the
//            analyst's audio-derived hole fillers (the pp opening, the pile-up, the last blows), so it never goes flat
//            where the orchestra is loudest. Its how-present curve is the arc of the piece; per-note knobs change the
//            terrain at the turns of the form (needles in the mechanical episode, a far receding landscape in the slow
//            middle, the landscape slammed flat into a wall at the armoured return, peaks at full height in the pile-up).
//   len lye  the col legno strokes scratched into the film (track 2, on the stage: it draws with 'lighten'): the
//            ostinato wherever it runs, and the long held tones that rub against it (they boil while held). Bursts
//            only on real ff blows (per-note burst; 0 on the routine strokes).
//   ikeda    the brass as data. For most of the reel it is the film's optical SOUNDTRACK: a window turned on its side
//            in the empty left margin (ridges never reaches the outer 12 %), so every code prints as horizontal bars,
//            like a variable-density soundtrack. At the armoured return the codes leave the strip and take the whole
//            frame (the hammered G is one code stamped again and again); then back to the strip; and on the final
//            hammer blows they take the frame again, the same chord the same code, with a white flash on each blow.
//   blocks   red glitch tears, on top, reading the stack (ridges, the film, the stamped ikeda window): the first
//            climax, the hammered Db chords, the strike, the ff blow after the general pause, the armour of the return
//            (ikeda + blocks over ridges), the pile-up (a tear that hangs for seconds), the blows.
// Serendipity: in "no bass: the high repeats" (164.9-185.6) the ground falls away (the front ends) and
// a second ridges, turned upside down in a clear window, hangs the high repeats from the top of the frame. (A first
// try kept the front underneath at low presence: the sky then read only as one thin line; alone it is a landscape.)
// The general pause wipes the reel: the front ends at 185.6 and a fresh one starts on the Eb blow (186.43). Each of the
// final blows out of silence is its own short shot (a fresh landscape, codes, a tear), black leader between them; the
// last chord stacks the same ridgeline again and again; then the film runs out (the scratches go with the chord,
// the dust runs on into the reverb and fades).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalShow, validateShow } from '../../../../src/studio/show/show.ts';
import { withValues } from '../../../../src/studio/show/note-values.ts';
import { loadCatalogue } from '../../../../scripts/node/catalogue.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const SONG = 'holst-mars', ID = 'holst-mars-c-black-film';
const P = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, `songs/${SONG}/pack.json`), 'utf8'));
const S = (id) => { if (!P[id]) throw new Error(`no set ${id}`); return P[id].notes.map((n) => [n[0], n[1], n[2], n[3]]); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const within = (a, b) => (n) => n[0] >= a && n[0] < b;

// The deliberate silences (ANALYSIS.md): nothing starts in one, a note sounding into one ends where it begins.
const SILENCES = [[185.6, 186.4], [397.9, 399.1], [403.4, 405.2], [407.8, 409.5], [413.5, 415.6], [421.8, 1e9]];
const clipSil = (ns) => ns.filter((n) => !SILENCES.some(([a, b]) => n[0] >= a && n[0] < b))
  .map((n) => { const s = SILENCES.find(([a]) => n[0] < a && n[1] > a); return s ? [n[0], r3(s[0]), n[2], n[3], n[4]].filter((v) => v !== undefined) : n; });
// Union of note lists, sorted, exact duplicates (same start and pitch) dropped.
function union(...lists) {
  const seen = new Set(), out = [];
  for (const n of lists.flat()) { const k = `${n[0].toFixed(3)}:${n[2]}`; if (seen.has(k)) continue; seen.add(k); out.push(n); }
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}
// Values by time span: [[from, to, values], ...]; the first span that holds the note's start wins.
const valuesBy = (spans) => (n) => { const s = spans.find(([a, b]) => n[0] >= a && n[0] < b); return s ? s[2] : undefined; };
const apply = (ns, fn) => ns.map((n) => { const v = fn(n); return v ? withValues([n[0], n[1], n[2], n[3]], v) : [n[0], n[1], n[2], n[3]]; });

// ---------------------------------------------------------------------------------------------------- the pick sets
// front (ridges): every pack note, plus the audio-derived hole fillers the pack lacks.
const AUDIO = ['ostinato-dawn', 'theme-creep', 'hole-38-48', 'brass-swell-65', 'climax-1', 'hole-middle', 'climax-pileup',
  'aftermath-held', 'final-blows', 'blow-echoes', 'last-chord'];
const packNotes = pack.notes.map((n) => [r3(n[0]), r3(n[1]), n[2], n[3]]);
const FRONT_KNOBS = valuesBy([
  [83.5, 131.0, { sharp: 0.9 }],                           // the hammered episode: needles, a machine's readout
  [131.0, 131.7, { sharp: 0.9, height: 1.6 }],              // the strike
  [186.4, 189.5, { height: 1.8, sharp: 0.7 }],              // the ff blow after the pause
  [189.5, 256.5, { depth: 0.9, sharp: 0.1 }],               // the slow middle: a far landscape, soft hills
  [256.5, 304.0, { depth: 0, sharp: 0.8, height: 1.4 }],   // the armoured return: the landscape slammed flat, a wall
  [358.85, 367.0, { height: 2.2, sharp: 0.6 }],             // the pile-up: the peaks at full height
  [415.6, 422, { height: 2.2, sharp: 0.75, depth: 0.5, speed: 24 }], // the last chord: one ridgeline stacked fast, a range of it
  [396.4, 415.6, { height: 1.9, sharp: 0.75, depth: 0.15 }], // the last blows
]);
const front = apply(clipSil(union(packNotes, ...AUDIO.map(S))), FRONT_KNOBS);

// film (len lye): the col legno ostinato and the strokes that carry it on, with the held tones that rub against it.
const lowOf = (ns, max) => ns.filter((n) => n[2] <= max);
const FF = new Set(S('ff-blows').map((n) => n[0].toFixed(2)));
const filmRaw = union(
  S('ostinato-opening'), S('theme-creep'), S('cello-ostinato-2'), S('climax-1'),
  S('pedal-bass'), S('strike-131'), S('ostinato-second'), S('unison-calls'),
  S('ff-blow-186'), S('dying-throb'), S('hole-middle').filter(within(197.2, 212.8)), S('middle-bass'),
  S('recap-bass'), S('ostinato-canon'), lowOf(S('final-build'), 59), S('climax-pileup'), S('aftermath-held'),
  lowOf(S('hush-rise'), 55), S('pesante-g'), S('final-blows'), S('last-chord'),
);
const film = apply(clipSil(filmRaw), (n) => {
  const t = n[0];
  // a burst and a flash only on the real blows: the first climax, the strike, the Eb blow, the pile-up, the last blows
  const blow = (t >= 80.79 && t < 80.81) || (t >= 81.96 && t < 81.98) || (t >= 131.1 && t < 131.2) || (t >= 358.89 && t < 358.91)
    || FF.has(t.toFixed(2)) || (t >= 396.4 && S('final-blows').some((b) => Math.abs(b[0] - t) < 0.01));
  if (t >= 415.7) return { burst: 1.6, life: 1.1 };        // the last chord: its scratches boil on to the cut
  if (blow) return { burst: 1.6 };
  if (t < 20.6) return { fps: 8 };                          // the dawn: slow, jerky stop-motion
  if (t >= 256.5 && t < 304) return { fps: 20 };           // the return: fast flicker
  return undefined;
});

// codes (ikeda): the brass, and the strokes that stamp one code again and again.
const codesRaw = union(
  S('theme-swell'), S('brass-swell-65'), S('brass-chords-1'), S('climax-1'), S('high-blasts'), S('strike-131'),
  S('high-repeats'),
  S('ff-blow-186'), S('tuba-theme'), S('trumpet-calls'),
  S('ostinato-tutti'), S('brass-tenor-line').filter(within(256.5, 340)),
  S('final-build').filter((n) => n[2] >= 67), S('climax-pileup'), S('hush-rise').filter((n) => n[0] >= 393 && n[2] >= 66),
  S('final-blows'), S('blow-echoes'),
);
const ECHO = new Set(S('blow-echoes').map((n) => n[0].toFixed(3)));
const codes = apply(clipSil(codesRaw), (n) => {
  if (ECHO.has(n[0].toFixed(3))) return { intensity: 0.75 };           // the weaker answer: the same code, narrower, no flash
  if (n[0] >= 197.2 && n[0] < 215.3) return { intensity: 1.9 };        // the tenor tuba is soft (v17-55): print it
  if (n[0] >= 212.8 && n[0] < 257.2) return { intensity: 1.25 };
  return undefined;
});

// sky (the hanging ridges): the high repeats, no bass at all.
const sky = clipSil(S('high-repeats'));

// tears (blocks)
const tearsRaw = union(
  S('climax-1'), S('chord-hammer'), S('strike-131'), S('ff-blow-186'),
  S('middle-chords').filter(within(246, 256.6)), S('ostinato-tutti').filter(within(256.5, 268.2)), S('recap-blocks'),
  S('canon-blocks'), S('final-build'), S('climax-pileup'), S('final-blows'),
);
const tears = apply(clipSil(tearsRaw), valuesBy([
  [80.7, 83.6, { settle: 2.6, jump: 1.5 }],                 // the first climax: a tear that hangs
  [131.0, 131.7, { settle: 2.2, jump: 1.6, amount: 2 }],    // the strike
  [186.4, 186.6, { settle: 2.4, jump: 1.8, amount: 2.4 }],  // the Eb chord, the strongest onset of the piece (not the rumble)
  [358.85, 367, { settle: 5, jump: 2, amount: 3 }],         // the pile-up: the torn frame hangs for seconds
  [396.4, 422, { settle: 1.2, jump: 1.6, amount: 2 }],
]));

// ---------------------------------------------------------------------------------------------------------- regions
// The soundtrack strip: ikeda's whole picture stretched into a box turned -90 degrees in the left margin, so its pitch
// axis runs up the side of the frame (bass at the bottom) and every barcode prints as horizontal bars.
const STRIP = { mode: 'window', shape: 'rect', x: 0.072, y: 0.5, w: 0.5625, h: 0.24, rot: -90, feather: 0.04, fit: 'stretch' };
const FULL = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0, fit: 'stretch' };
const STRIP_R = { ...STRIP, x: 0.928 };
const HANG = { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, rot: 180, feather: 0, fit: 'stretch' };
// (critic) the sky band for the trumpet calls: Ikeda squeezed into the top 28 % of the frame.
const SKYBAND = { mode: 'window', shape: 'rect', x: 0.5, y: 0.145, w: 1, h: 0.28, feather: 0.04, fit: 'stretch' };

// ------------------------------------------------------------------------------------------------------------ clips
const clips = [];
const pv = (pts) => pts.map(([t, v, shape]) => (shape ? { t, v, shape } : { t, v }));
const add = (c) => clips.push({ id: `c${clips.length + 1}`, ...c, start: r3(c.start), end: r3(c.end) });

// Track 0: the front (ridges). Its curve (how present) is the arc of the piece.
// It ends as the bass vanishes (164.9): the ground falls away, and only the hanging sky is left until the pause.
add({ start: 7.6, end: 165.2, track: 0, fade: 0.6, widget: 'ridges', listen: 'picks:front', intensityMoves: 'present',
  intensity: pv([[7.6, 0.04], [16.3, 0.14], [20.6, 0.3], [48.6, 0.48], [57.4, 0.75], [80.8, 1], [131.1, 1], [131.7, 0.72],
    [164.6, 0.72], [165.2, 0.5]]) });
add({ start: 186.36, end: 397.9, track: 0, fade: 0.05, widget: 'ridges', listen: 'picks:front', intensityMoves: 'present',
  intensity: pv([[186.36, 1], [189.5, 0.62], [197.2, 0.3], [212.8, 0.4], [240, 0.55], [256.4, 0.8], [256.6, 1], [303.9, 1],
    [305.5, 0.7], [343.6, 0.72], [358.9, 1], [367, 0.75], [380, 0.18], [387, 0.3], [393.2, 0.85], [396.4, 1]]) });
// The blows out of silence: one fresh landscape per shot, black leader between.
// Each shot opens 60 ms before its blow (399.151, 405.281, 409.6, 415.753), so nothing lights before the note.
const SHOTS = [[399.091, 403.4], [405.221, 407.8], [409.54, 413.5], [415.693, 421.8]];
for (const [a, b] of SHOTS) add({ start: a, end: b, track: 0, fade: 0.03, widget: 'ridges', listen: 'picks:front' });

// Track 1: the sky, upside down, on the high repeats.
add({ start: 164.6, end: 185.6, track: 1, fade: 0.5, widget: 'ridges', listen: 'picks:sky', region: HANG, knobs: { height: 1.6, sharp: 0.6 } });

// Track 2: the film (len lye), base burst 0: only the blows burst (per note).
const FILM_K = { burst: 0 };
add({ start: 7.6, end: 185.6, track: 2, fade: 0.6, widget: 'lenlye', listen: 'picks:film', knobs: FILM_K, intensityMoves: 'present',
  intensity: pv([[7.6, 0.2], [20.6, 0.45], [57.4, 0.8], [80.8, 1], [131.7, 1], [133, 0.8]]) });
add({ start: 186.36, end: 397.9, track: 2, fade: 0.05, widget: 'lenlye', listen: 'picks:film', knobs: FILM_K, intensityMoves: 'present',
  intensity: pv([[186.36, 1], [189.5, 0.55], [212.8, 0.45], [256.5, 0.85], [304, 0.75], [358.9, 1], [367, 0.55], [386, 0.35], [396.4, 1]]) });
for (const [a, b] of SHOTS.slice(0, -1)) add({ start: a, end: b, track: 2, fade: 0.03, widget: 'lenlye', listen: 'picks:film', knobs: FILM_K });
// The last chord, then the film runs out: the scratches go with the chord, the dust runs on into the reverb and fades.
add({ start: 415.693, end: 424.2, track: 2, fade: 0.03, widget: 'lenlye', listen: 'picks:film', knobs: { burst: 0, dirt: 2 },
  intensity: pv([[415.693, 1], [421.8, 1], [424.2, 0]]) });
// A second reel of dust over the cut, so the runout reads (no notes reach it: it is only the battered leader).
add({ start: 421.6, end: 424.2, track: 1, fade: 0.25, widget: 'lenlye', listen: 'picks:film', knobs: { dirt: 2 },
  intensity: pv([[421.6, 1], [422.8, 1], [424.2, 0]]) });

// Track 3: the codes (ikeda). Never a curve below 1 (its how present filters notes): shaped by clip edges only.
const STRIP_K = { flash: 0 };   // white flashes only on the final blows
add({ start: 48.3, end: 185.6, track: 3, fade: 0.5, widget: 'ikeda', listen: 'picks:codes', knobs: STRIP_K, region: STRIP });
add({ start: 186.36, end: 212.8, track: 3, fade: 0.05, widget: 'ikeda', listen: 'picks:codes', knobs: STRIP_K, region: STRIP });
// (critic) The calls: the trumpets leave the soundtrack strip and print in the SKY, a band across the top of the frame
// above the far landscape, pitch running left to right, so the rising pairs climb rightward like signals on a horizon.
// The tenor tuba stays low, in the strip at the side; the trumpets take the top. Back to the strip at the return.
add({ start: 212.8, end: 256.45, track: 3, fade: 0.8, widget: 'ikeda', listen: 'picks:codes', knobs: STRIP_K, region: SKYBAND });
add({ start: 256.45, end: 303.9, track: 3, fade: 0.05, widget: 'ikeda', listen: 'picks:codes', knobs: { flash: 0 }, region: FULL });
add({ start: 303.9, end: 396.444, track: 3, fade: 0.3, widget: 'ikeda', listen: 'picks:codes', knobs: STRIP_K, region: STRIP });
const BLOW_K = { flash: 1, slam: 1 };
for (const [a, b] of [[396.444, 397.9], ...SHOTS]) add({ start: a, end: b, track: 3, fade: 0.03, widget: 'ikeda', listen: 'picks:codes', knobs: BLOW_K, region: FULL });

// The canon: the theme answering itself gets its own strip in the right margin, so the answers cross the frame.
add({ start: 303.6, end: 345.5, track: 1, fade: 0.3, widget: 'ikeda', listen: 'picks:answers', knobs: STRIP_K, region: STRIP_R });

// Track 4: the tears (blocks), on the stage, over everything.
add({ start: 80.6, end: 133.5, track: 4, fade: 0.15, widget: 'blocks', listen: 'picks:tears', intensityMoves: 'present',
  intensity: pv([[80.6, 1], [83.6, 1], [84.0, 0.45], [130.9, 0.45], [131.05, 1]]) });
add({ start: 186.36, end: 191.5, track: 4, fade: 0.05, widget: 'blocks', listen: 'picks:tears' });
add({ start: 245.8, end: 304.5, track: 4, fade: 0.2, widget: 'blocks', listen: 'picks:tears', intensityMoves: 'present',
  intensity: pv([[245.8, 0.15], [256.4, 0.4], [256.6, 0.75], [268.2, 1]]) });
add({ start: 304.5, end: 343.4, track: 4, fade: 0.2, widget: 'blocks', listen: 'picks:tears', intensityMoves: 'present',
  intensity: pv([[304.5, 0.25]]) });   // the canon's Ab4 strokes: a few red bars, small shivers
add({ start: 343.4, end: 368.5, track: 4, fade: 0.2, widget: 'blocks', listen: 'picks:tears', intensityMoves: 'present',
  intensity: pv([[343.4, 0.25], [358.6, 0.7], [358.85, 1]]) });
for (const [a, b] of [[396.444, 397.9], ...SHOTS]) add({ start: a, end: b, track: 4, fade: 0.03, widget: 'blocks', listen: 'picks:tears' });

// Track 5 (critic): the canon as a slit-scan. While the theme answers itself, the whole film is re-timed strip by strip:
// each column of the picture is a different moment of the last bar, so the landscape shears into a staircase of its
// own past, an echo of itself across the frame. The now line follows the canon's voice (picks:answers) and each of its
// notes cuts a sharp band of the present through the smear. far 1.78 = one bar of the 5/4 ostinato (the onset bar),
// so the furthest strip lags exactly one bar, the distance of the answer. A spot (mask), so it re-times the whole stack.
add({ start: 304.0, end: 343.6, track: 5, fade: 1.2, widget: 'timeslice', listen: 'picks:answers',
  knobs: { far: 1.78 }, region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, feather: 0 } });

// ------------------------------------------------------------------------------------------- picks: only what is heard
const answers = clipSil(S('canon-theme'));
const sets = { front, film, codes, sky, tears, answers };
const picks = {};
for (const [id, ns] of Object.entries(sets)) {
  const cs = clips.filter((c) => c.listen === `picks:${id}`);
  const heard = ns.filter((n) => cs.some((c) => n[0] >= c.start + Math.min(0.05, c.fade ?? 1) && n[0] < c.end - 0.05));
  if (!heard.length) throw new Error(`${id}: nothing heard`);
  picks[id] = { notes: heard };
  console.log(`${id}: ${heard.length} of ${ns.length} notes heard`);
}

const show = {
  version: 3, id: ID, song: SONG,
  title: 'Holst: Mars · C · Black film: ridges as the front (every note), Len Lye scratching the col legno ostinato, Ikeda printing the brass and the machine’s strokes as a soundtrack strip (a second strip for the canon’s answers) that takes the frame at the armoured return and the last blows, glitch blocks tearing it all; an upside-down ridges hangs the bassless high repeats from the sky',
  composer: { by: 'claude', at: new Date().toISOString() }, clips, picks,
};
const widgets = loadCatalogue().widgets;
const { errors, warnings } = validateShow(show, { duration: pack.duration, widgets, tracks: Object.keys(pack.tracks ?? {}) });
for (const e of [...errors, ...warnings]) console.log(`${errors.includes(e) ? 'ERROR' : 'warn'} ${e.path}: ${e.message}`);
if (errors.length) process.exit(1);
writeFileSync(join(ROOT, `shows/${ID}.json`), canonicalShow(show));
console.log(`wrote shows/${ID}.json: ${clips.length} clips`);
